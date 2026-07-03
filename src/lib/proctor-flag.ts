/**
 * Shared server-side proctor flag logic.
 *
 * Used by both the student self-report route (/api/internal/proctor/flag)
 * and the lecturer Live View flag route (/api/lecturer/attempts/[id]/flag).
 *
 * Semantics (identical for both callers):
 *  - flagCount is incremented by 1
 *  - a ProctoringLogEntry is appended to ProctorRecord.proctoringLog
 *  - if the new flagCount reaches flagThreshold, the attempt is
 *    auto-submitted via submitAttemptInternal(..., 'PROCTOR_VIOLATION')
 */

import { prisma } from '@/lib/prisma'
import { submitAttemptInternal } from '@/lib/assessment-actions'
import type { ProctoringLogEntry } from '@/lib/proctor-log'

export type ApplyProctorFlagInput = {
  attemptId: number
  violationType: string
  source: 'CLIENT' | 'LECTURER'
  detectedAt?: string
  /** Free-text reason, recorded for LECTURER-issued flags */
  reason?: string
}

export type ApplyProctorFlagResult =
  | { found: false }
  | { found: true; flagCount: number; willAutoSubmit: boolean }

/**
 * Increment the flag count for an attempt's ProctorRecord, append a log
 * entry, and auto-submit the attempt when the threshold is reached.
 *
 * Returns { found: false } when no ProctorRecord exists (non-proctored exam)
 * so callers can no-op gracefully. Never throws for the auto-submit step —
 * submission errors are logged and swallowed, matching the original
 * internal flag route behaviour.
 */
export async function applyProctorFlag(
  input: ApplyProctorFlagInput,
): Promise<ApplyProctorFlagResult> {
  const { attemptId, violationType, source, reason } = input
  const detectedAt = input.detectedAt ?? new Date().toISOString()

  const record = await prisma.proctorRecord.findUnique({
    where: { attemptId },
    select: { id: true, flagCount: true, flagThreshold: true, proctoringLog: true },
  })

  if (!record) {
    return { found: false }
  }

  const newFlagCount = record.flagCount + 1
  const existingLog = Array.isArray(record.proctoringLog) ? record.proctoringLog : []
  const newEntry: ProctoringLogEntry = {
    violationType,
    source,
    confidence: null,
    detectedAt,
    flagCountAfter: newFlagCount,
    ...(reason ? { reason } : {}),
  }

  // Use atomic increment to avoid transaction contention under rapid firing
  await prisma.proctorRecord.update({
    where: { id: record.id },
    data: {
      flagCount: { increment: 1 },
      proctoringLog: [...existingLog, newEntry as object],
    },
  })

  const isTerminating = newFlagCount >= record.flagThreshold

  if (isTerminating) {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { assessmentId: true },
    })
    if (attempt) {
      try {
        await submitAttemptInternal(attemptId, attempt.assessmentId, 'PROCTOR_VIOLATION')
      } catch (err) {
        console.error('[applyProctorFlag] submitAttemptInternal error:', {
          attemptId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return { found: true, flagCount: newFlagCount, willAutoSubmit: isTerminating }
}
