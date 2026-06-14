import crypto from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { submitAttemptInternal } from '@/lib/assessment-actions'
import { getSession } from '@/lib/session'

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

interface OracleWebhookBody {
  attemptId: number
  sessionId: string
  anomalyType: string
  confidence: number
  detectedAt: string
  // thumbnailBase64 intentionally omitted — Oracle no longer sends thumbnail data
}

interface ClientEventBody {
  attemptId: number
  violationType: 'FULLSCREEN_EXIT' | 'TAB_SWITCH' | 'CONNECTION_LOST'
  detectedAt: string
}

type RequestBody = OracleWebhookBody | ClientEventBody

function isOracleWebhook(body: RequestBody): body is OracleWebhookBody {
  return 'anomalyType' in body
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification
// ---------------------------------------------------------------------------

function verifyOracleSignature(rawBody: string, receivedSignature: string): boolean {
  const secret = process.env.ORACLE_WEBHOOK_SECRET ?? ''
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  // timingSafeEqual requires equal-length buffers
  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(receivedSignature)

  if (expectedBuf.length !== receivedBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf)
}

// ---------------------------------------------------------------------------
// POST /api/internal/proctor/flag
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // We need the raw body text for HMAC verification, so read it once upfront.
  const rawBody = await request.text()

  let body: RequestBody
  try {
    body = JSON.parse(rawBody) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ------------------------------------------------------------------
  // Determine request shape and authenticate accordingly
  // ------------------------------------------------------------------

  let violationType: string
  let source: 'CLIENT' | 'ORACLE'
  let confidence: number | null
  let detectedAt: string
  let thumbnailBase64: string | null
  let sessionId: string | undefined

  if (isOracleWebhook(body)) {
    // Shape 1 — Oracle webhook: verify HMAC signature
    const receivedSignature = request.headers.get('X-Oracle-Signature') ?? ''

    if (!receivedSignature || !verifyOracleSignature(rawBody, receivedSignature)) {
      return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 403 })
    }

    violationType = body.anomalyType
    source = 'ORACLE'
    confidence = body.confidence
    detectedAt = body.detectedAt
    // Oracle no longer sends thumbnailBase64 — always store null for Oracle events
    thumbnailBase64 = null
    sessionId = body.sessionId
  } else {
    // Shape 2 — Client-side event: authenticate via session cookie
    const session = await getSession()

    if (!session?.user || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    violationType = body.violationType
    source = 'CLIENT'
    confidence = null
    detectedAt = body.detectedAt
    thumbnailBase64 = null
  }

  const { attemptId } = body

  // ------------------------------------------------------------------
  // Prisma transaction: find record, increment flag, append log entry
  // ------------------------------------------------------------------

  let newFlagCount: number
  let flagThreshold: number
  let resolvedSessionId: string | undefined
  let attemptAssessmentId: number | undefined

  try {
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.proctorRecord.findUnique({
        where: { attemptId },
        select: {
          id: true,
          flagCount: true,
          flagThreshold: true,
          proctoringLog: true,
          sessionId: true,
        },
      })

      if (!record) {
        return null
      }

      const updatedFlagCount = record.flagCount + 1

      const existingLog = Array.isArray(record.proctoringLog) ? record.proctoringLog : []

      const newEntry = {
        violationType,
        source,
        confidence,
        detectedAt,
        flagCountAfter: updatedFlagCount,
        thumbnailBase64,
      }

      const updated = await tx.proctorRecord.update({
        where: { id: record.id },
        data: {
          flagCount: updatedFlagCount,
          proctoringLog: [...existingLog, newEntry],
        },
        select: {
          flagCount: true,
          flagThreshold: true,
          sessionId: true,
          attempt: { select: { assessmentId: true } },
        },
      })

      return updated
    })

    if (!result) {
      // No ProctorRecord for this attempt — return a graceful no-op for client
      // events (non-proctored exam) rather than a hard 404.
      return NextResponse.json({ success: true, flagCount: 0 })
    }

    newFlagCount = result.flagCount
    flagThreshold = result.flagThreshold
    resolvedSessionId = sessionId ?? result.sessionId
    attemptAssessmentId = result.attempt.assessmentId
  } catch (err) {
    console.error('[proctor/flag] Transaction error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // ------------------------------------------------------------------
  // Final flag — submit immediately (server-side) so the attempt is
  // safely recorded even if the student closes the tab.
  // We also return willAutoSubmit: true so the client can show a
  // "final warning" overlay with the reason before redirecting.
  // ------------------------------------------------------------------

  const isTerminating = newFlagCount >= flagThreshold

  if (isTerminating) {
    try {
      await submitAttemptInternal(attemptId, attemptAssessmentId!, 'PROCTOR_VIOLATION')
    } catch (err) {
      console.error('[proctor/flag] submitAttemptInternal error:', err)
    }

    // Notify Oracle to end the session (best-effort)
    const oracleBaseUrl = process.env.ORACLE_BASE_URL
    if (oracleBaseUrl && resolvedSessionId) {
      try {
        await fetch(`${oracleBaseUrl}/api/sessions/${resolvedSessionId}/end`, {
          method: 'POST',
        })
      } catch (err) {
        console.error('[proctor/flag] Oracle session-end error:', err)
      }
    }
  }

  return NextResponse.json({
    success: true,
    flagCount: newFlagCount,
    violationType,
    source,
    // Tells the client to show the final-warning overlay before redirecting.
    // The submission has already happened server-side at this point.
    willAutoSubmit: isTerminating,
  })
}
