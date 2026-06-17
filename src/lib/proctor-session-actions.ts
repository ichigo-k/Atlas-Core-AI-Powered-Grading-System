'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { randomUUID } from 'crypto'

export type CreateProctorSessionResult =
  | { sessionId: string }
  | { error: string }

/**
 * Creates a local proctoring session record in the database.
 * No external service is called — proctoring runs entirely client-side via
 * TensorFlow.js / COCO-SSD / BlazeFace.
 */
export async function createProctorSession(
  attemptId: number,
): Promise<CreateProctorSessionResult> {
  try {
    const session = await getSession()
    if (!session?.user?.email) return { error: 'UNAUTHORIZED' }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) return { error: 'UNAUTHORIZED' }

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, studentId: true, status: true },
    })

    if (!attempt) return { error: 'ATTEMPT_NOT_FOUND' }
    if (attempt.studentId !== user.id) return { error: 'UNAUTHORIZED' }
    if (attempt.status !== 'IN_PROGRESS') return { error: 'ATTEMPT_NOT_IN_PROGRESS' }

    const sessionId = randomUUID()

    await prisma.proctorRecord.upsert({
      where: { attemptId },
      create: {
        attemptId,
        sessionId,
        consentAt: new Date(),
        flagCount: 0,
        flagThreshold: 10,
        proctoringLog: [],
        status: 'ACTIVE',
      },
      update: {
        sessionId,
        consentAt: new Date(),
        status: 'ACTIVE',
      },
    })

    return { sessionId }
  } catch (err) {
    console.error('[createProctorSession] DB error:', {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return { error: 'DB_ERROR' }
  }
}
