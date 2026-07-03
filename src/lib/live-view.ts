/**
 * Shared helpers for the Live View proctoring API routes
 * (Postgres-backed WebRTC signaling, presence, chat and lecturer flags).
 */

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** A student is considered online if lastSeenAt is within this window. */
export const ONLINE_WINDOW_MS = 15_000

/** Signals older than this are opportunistically deleted by signal routes. */
export const SIGNAL_TTL_MS = 5 * 60_000

export const VALID_SIGNAL_TYPES = ['offer', 'answer', 'ice', 'bye'] as const
export type SignalType = (typeof VALID_SIGNAL_TYPES)[number]

export type IncomingSignal = { type: string; payload: unknown }

/** Validate a client-supplied signals array; returns null when invalid. */
export function parseSignals(raw: unknown): IncomingSignal[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) return null
  const out: IncomingSignal[] = []
  for (const s of raw) {
    if (
      typeof s !== 'object' ||
      s === null ||
      typeof (s as { type?: unknown }).type !== 'string' ||
      !VALID_SIGNAL_TYPES.includes((s as { type: string }).type as SignalType) ||
      (s as { payload?: unknown }).payload === undefined
    ) {
      return null
    }
    out.push({ type: (s as { type: string }).type, payload: (s as { payload: unknown }).payload })
  }
  return out
}

export type LecturerAttemptAuth =
  | {
      ok: true
      lecturerId: number
      attempt: { id: number; assessmentId: number; studentId: number; status: string }
    }
  | { ok: false; status: number; error: string }

/**
 * Authenticate the session as a LECTURER and verify they own the assessment
 * that the given attempt belongs to. Returns a discriminated result — never
 * throws for auth/ownership failures.
 */
export async function authorizeLecturerForAttempt(
  attemptIdRaw: string,
): Promise<LecturerAttemptAuth> {
  const session = await auth()
  if (!session || session.user.role !== 'LECTURER') {
    return { ok: false, status: 403, error: 'FORBIDDEN' }
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) return { ok: false, status: 403, error: 'FORBIDDEN' }

  const attemptId = parseInt(attemptIdRaw)
  if (isNaN(attemptId)) return { ok: false, status: 404, error: 'NOT_FOUND' }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      assessmentId: true,
      studentId: true,
      status: true,
      assessment: { select: { lecturerId: true } },
    },
  })

  if (!attempt || attempt.assessment.lecturerId !== user.id) {
    return { ok: false, status: 404, error: 'NOT_FOUND' }
  }

  return {
    ok: true,
    lecturerId: user.id,
    attempt: {
      id: attempt.id,
      assessmentId: attempt.assessmentId,
      studentId: attempt.studentId,
      status: attempt.status,
    },
  }
}

/**
 * Opportunistically delete stale signal rows for an attempt (cheap deleteMany).
 * Errors are logged, never propagated — cleanup must not break polling.
 */
export async function cleanupStaleSignals(attemptId: number): Promise<void> {
  try {
    await prisma.proctorSignal.deleteMany({
      where: { attemptId, createdAt: { lt: new Date(Date.now() - SIGNAL_TTL_MS) } },
    })
  } catch (err) {
    console.error('[cleanupStaleSignals]', {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
