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

  // The entry is built WITHOUT flagCountAfter — the database fills that in from
  // the post-increment value so it can never disagree with flagCount.
  const partialEntry: Omit<ProctoringLogEntry, 'flagCountAfter'> = {
    violationType,
    source,
    confidence: null,
    detectedAt,
    ...(reason ? { reason } : {}),
  }

  // Increment the counter and append the log entry in ONE statement.
  //
  // The previous implementation read proctoringLog, then wrote back
  // [...existingLog, newEntry]. Camera, audio, and focus flags fire
  // independently and can overlap, so two concurrent flags would both read the
  // same array and the second write would silently drop the first one's entry.
  // Worse, flagCount was returned as `record.flagCount + 1` from that same
  // stale read, so concurrent flags reported the SAME count to both clients and
  // the `>= flagThreshold` termination check could be skipped entirely — a
  // student could exceed the threshold without the attempt ever auto-submitting.
  //
  // Doing it as a single UPDATE makes both parts atomic: `||` appends to the
  // jsonb array server-side, and every reference to "flagCount" inside SET sees
  // the pre-update value, so flagCountAfter and the new count always agree.
  // RETURNING gives back the post-update row.
  const rows = await prisma.$queryRaw<Array<{ flagCount: number; flagThreshold: number }>>`
    UPDATE "proctor_records"
       SET "flagCount" = "flagCount" + 1,
           "proctoringLog" = COALESCE("proctoringLog", '[]'::jsonb) || jsonb_build_array(
             jsonb_set(
               ${JSON.stringify(partialEntry)}::jsonb,
               '{flagCountAfter}',
               to_jsonb("flagCount" + 1)
             )
           ),
           "updatedAt" = NOW()
     WHERE "attemptId" = ${attemptId}
    RETURNING "flagCount", "flagThreshold"
  `

  if (rows.length === 0) {
    return { found: false }
  }

  const { flagCount: newFlagCount, flagThreshold } = rows[0]
  const isTerminating = newFlagCount >= flagThreshold

  if (isTerminating) {
    // Only submit on the transition into the terminated state. Flags can keep
    // arriving after the threshold (in-flight requests, the camera loop's next
    // tick), and without this guard each one would re-run submission on an
    // already-submitted attempt.
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { assessmentId: true, status: true },
    })
    if (attempt && attempt.status === 'IN_PROGRESS') {
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
