import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeLecturerForAttempt, cleanupStaleSignals, parseSignals } from '@/lib/live-view'

/**
 * POST /api/lecturer/attempts/[id]/signal
 *
 * Lecturer signaling poll for one attempt:
 *  - persists outgoing lecturer->student signals (offer/ice/bye);
 *    an empty (or omitted) signals array makes this a pure poll
 *  - returns and marks consumed all unconsumed STUDENT signals
 *
 * Returns 409 ATTEMPT_NOT_IN_PROGRESS once the attempt has ended so the
 * lecturer client can stop polling gracefully.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const authz = await authorizeLecturerForAttempt(id)
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }
    const attemptId = authz.attempt.id

    if (authz.attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'ATTEMPT_NOT_IN_PROGRESS' }, { status: 409 })
    }

    let body: { signals?: unknown } = {}
    try {
      const text = await request.text()
      if (text && text.trim() !== '') body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    }

    const outgoing = parseSignals(body.signals)
    if (outgoing === null) {
      return NextResponse.json({ error: 'INVALID_SIGNALS' }, { status: 400 })
    }

    if (outgoing.length > 0) {
      await prisma.proctorSignal.createMany({
        data: outgoing.map((s) => ({
          attemptId,
          sender: 'LECTURER',
          type: s.type,
          payload: s.payload as object,
        })),
      })
    }

    const now = new Date()
    const signals = await prisma.proctorSignal.findMany({
      where: { attemptId, sender: 'STUDENT', consumedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, payload: true, createdAt: true },
    })
    if (signals.length > 0) {
      await prisma.proctorSignal.updateMany({
        where: { id: { in: signals.map((s) => s.id) } },
        data: { consumedAt: now },
      })
    }

    await cleanupStaleSignals(attemptId)

    return NextResponse.json({
      signals: signals.map((s) => ({
        id: s.id,
        type: s.type,
        payload: s.payload,
        createdAt: s.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error('[POST /api/lecturer/attempts/[id]/signal]', {
      attemptId: id,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
