import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authorizeLecturerForAttempt } from '@/lib/live-view'
import { applyProctorFlag } from '@/lib/proctor-flag'

/**
 * POST /api/lecturer/attempts/[id]/flag
 *
 * Lecturer-issued proctoring flag. Uses the same shared logic as the
 * student self-report route (applyProctorFlag): increments flagCount,
 * appends a proctoringLog entry (type "LECTURER_FLAG", source "LECTURER"),
 * and auto-submits the attempt when flagThreshold is reached.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const authz = await authorizeLecturerForAttempt(id)
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    if (authz.attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'ATTEMPT_NOT_IN_PROGRESS' }, { status: 409 })
    }

    let body: { reason?: unknown } = {}
    try {
      const text = await request.text()
      if (text && text.trim() !== '') body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    }

    const reason = typeof body.reason === 'string' && body.reason.trim() !== ''
      ? body.reason.trim()
      : undefined

    const result = await applyProctorFlag({
      attemptId: authz.attempt.id,
      violationType: 'LECTURER_FLAG',
      source: 'LECTURER',
      reason,
    })

    if (!result.found) {
      return NextResponse.json({ error: 'NO_PROCTOR_RECORD' }, { status: 404 })
    }

    return NextResponse.json({
      flagCount: result.flagCount,
      willAutoSubmit: result.willAutoSubmit,
    })
  } catch (err) {
    console.error('[POST /api/lecturer/attempts/[id]/flag]', {
      attemptId: id,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
