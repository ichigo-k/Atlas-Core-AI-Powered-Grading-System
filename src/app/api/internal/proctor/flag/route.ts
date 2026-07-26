import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { applyProctorFlag } from '@/lib/proctor-flag'
import { VIOLATION_REASONS } from '@/lib/violation-tracker'

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

    if (!Number.isInteger(attemptId) || attemptId <= 0) {
      return NextResponse.json({ error: 'Invalid attemptId' }, { status: 400 })
    }

    // Only accept known violation types — violationType is written straight
    // into the proctoring log and rendered back to lecturers, so an unbounded
    // client-supplied string does not belong in there.
    if (!VIOLATION_REASONS.includes(violationType as never)) {
      return NextResponse.json({ error: 'Invalid violationType' }, { status: 400 })
    }

    // Authorize — the attempt must belong to the caller. Without this any
    // logged-in student could POST another student's attemptId and drive their
    // flag count to the threshold, force-submitting someone else's exam.
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { student: { select: { email: true } } },
    })
    if (!attempt || attempt.student.email !== session.user.email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await applyProctorFlag({
      attemptId,
      violationType,
      source: 'CLIENT',
      detectedAt,
    })

    if (!result.found) {
      // Non-proctored exam — graceful no-op
      return NextResponse.json({ success: true, flagCount: 0 })
    }

    return NextResponse.json({
      success: true,
      flagCount: result.flagCount,
      violationType,
      source: 'CLIENT',
      willAutoSubmit: result.willAutoSubmit,
    })
  } catch (err) {
    console.error('[POST /api/internal/proctor/flag]', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
