import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeLecturerForAttempt } from '@/lib/live-view'

/**
 * POST /api/lecturer/attempts/[id]/message
 *
 * Creates a lecturer->student chat message. The student receives it on the
 * next combined poll (/api/student/attempts/[id]/live), which marks it
 * delivered.
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

    let body: { body?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
    }

    if (typeof body.body !== 'string' || body.body.trim() === '') {
      return NextResponse.json({ error: 'BODY_REQUIRED' }, { status: 400 })
    }

    const message = await prisma.proctorMessage.create({
      data: {
        attemptId: authz.attempt.id,
        senderId: authz.lecturerId,
        senderRole: 'LECTURER',
        body: body.body.trim(),
      },
      select: { id: true, body: true, createdAt: true },
    })

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[POST /api/lecturer/attempts/[id]/message]', {
      attemptId: id,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
