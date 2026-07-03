import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { cleanupStaleSignals, parseSignals } from '@/lib/live-view'
import type { ProctoringLogEntry } from '@/lib/proctor-log'

/**
 * POST /api/student/attempts/[id]/live
 *
 * Single combined Live View poll the exam client hits every ~2s:
 *  - persists outgoing student->lecturer signals (answer/ice/bye)
 *  - returns and marks delivered any undelivered lecturer chat messages
 *  - returns and marks consumed any unconsumed lecturer signals (offer/ice/bye)
 *  - returns current flagCount and any lecturer-issued flags since the
 *    previous poll (derived from proctoringLog entries with source
 *    "LECTURER" whose detectedAt is newer than the previous lastSeenAt;
 *    client should dedupe by detectedAt)
 *  - updates ProctorRecord.lastSeenAt (presence heartbeat)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const attemptId = parseInt(id)
  try {
    if (isNaN(attemptId)) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    const session = await getSession()
    if (!session?.user?.email || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, studentId: true, status: true },
    })
    if (!attempt || attempt.studentId !== user.id) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
    if (attempt.status !== 'IN_PROGRESS') {
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

    const record = await prisma.proctorRecord.findUnique({
      where: { attemptId },
      select: { id: true, flagCount: true, proctoringLog: true, lastSeenAt: true },
    })
    if (!record) {
      // Non-proctored exam / no proctor session — graceful no-op
      return NextResponse.json({ error: 'NO_PROCTOR_RECORD' }, { status: 404 })
    }

    const now = new Date()

    // 1. Persist outgoing student signals
    if (outgoing.length > 0) {
      await prisma.proctorSignal.createMany({
        data: outgoing.map((s) => ({
          attemptId,
          sender: 'STUDENT',
          type: s.type,
          payload: s.payload as object,
        })),
      })
    }

    // 2. Undelivered chat messages -> mark delivered
    const messages = await prisma.proctorMessage.findMany({
      where: { attemptId, deliveredAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, senderRole: true, body: true, createdAt: true },
    })
    if (messages.length > 0) {
      await prisma.proctorMessage.updateMany({
        where: { id: { in: messages.map((m) => m.id) } },
        data: { deliveredAt: now },
      })
    }

    // 3. Unconsumed lecturer signals -> mark consumed
    const signals = await prisma.proctorSignal.findMany({
      where: { attemptId, sender: 'LECTURER', consumedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, payload: true, createdAt: true },
    })
    if (signals.length > 0) {
      await prisma.proctorSignal.updateMany({
        where: { id: { in: signals.map((s) => s.id) } },
        data: { consumedAt: now },
      })
    }

    // 4. Lecturer-issued flags since previous poll.
    //    Cutoff = previous lastSeenAt, or last 10s on the first poll.
    const cutoff = record.lastSeenAt ?? new Date(now.getTime() - 10_000)
    const log = (Array.isArray(record.proctoringLog) ? record.proctoringLog : []) as unknown as ProctoringLogEntry[]
    const lecturerFlags = log
      .filter(
        (e) =>
          e &&
          e.source === 'LECTURER' &&
          typeof e.detectedAt === 'string' &&
          new Date(e.detectedAt) > cutoff,
      )
      .map((e) => ({
        type: e.violationType,
        message: e.reason ?? null,
        detectedAt: e.detectedAt,
        flagCountAfter: e.flagCountAfter,
      }))

    // 5. Presence heartbeat
    await prisma.proctorRecord.update({
      where: { id: record.id },
      data: { lastSeenAt: now },
    })

    // 6. Opportunistic cleanup of stale signal rows
    await cleanupStaleSignals(attemptId)

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        senderRole: m.senderRole,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
      signals: signals.map((s) => ({
        id: s.id,
        type: s.type,
        payload: s.payload,
        createdAt: s.createdAt.toISOString(),
      })),
      flagCount: record.flagCount,
      lecturerFlags,
    })
  } catch (err) {
    console.error('[POST /api/student/attempts/[id]/live]', {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
