import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { submitAttemptInternal } from '@/lib/assessment-actions'
import { getSession } from '@/lib/session'

interface ClientEventBody {
  attemptId: number
  violationType: string
  detectedAt: string
}

// POST /api/internal/proctor/flag
export async function POST(request: NextRequest) {
  try {
    // Guard against empty body (e.g. preflight or mis-fired requests)
    const text = await request.text()
    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    let body: ClientEventBody
    try {
      body = JSON.parse(text) as ClientEventBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Authenticate — must be a logged-in student
    const session = await getSession()
    if (!session?.user || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attemptId, violationType, detectedAt } = body

    // Find the existing record first
    const record = await prisma.proctorRecord.findUnique({
      where: { attemptId },
      select: { id: true, flagCount: true, flagThreshold: true, proctoringLog: true },
    })

    if (!record) {
      // Non-proctored exam — graceful no-op
      return NextResponse.json({ success: true, flagCount: 0 })
    }

    const newFlagCount = record.flagCount + 1
    const existingLog = Array.isArray(record.proctoringLog) ? record.proctoringLog : []
    const newEntry = {
      violationType,
      source: 'CLIENT',
      confidence: null,
      detectedAt,
      flagCountAfter: newFlagCount,
      thumbnailBase64: null,
    }

    // Use atomic increment to avoid transaction contention under rapid firing
    await prisma.proctorRecord.update({
      where: { id: record.id },
      data: {
        flagCount: { increment: 1 },
        proctoringLog: [...existingLog, newEntry],
      },
    })

    const isTerminating = newFlagCount >= record.flagThreshold

    if (isTerminating) {
      // Fetch assessmentId for submitAttemptInternal
      const attempt = await prisma.assessmentAttempt.findUnique({
        where: { id: attemptId },
        select: { assessmentId: true },
      })
      if (attempt) {
        try {
          await submitAttemptInternal(attemptId, attempt.assessmentId, 'PROCTOR_VIOLATION')
        } catch (err) {
          console.error('[proctor/flag] submitAttemptInternal error:', {
            attemptId,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      flagCount: newFlagCount,
      violationType,
      source: 'CLIENT',
      willAutoSubmit: isTerminating,
    })
  } catch (err) {
    console.error('[POST /api/internal/proctor/flag]', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
