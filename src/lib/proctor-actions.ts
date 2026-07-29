'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

/**
 * Confirms the signed-in user is allowed to read this attempt's proctor state.
 *
 * Students may only read their own attempt; lecturers and admins may read any
 * (they already have full visibility through Live View and the results pages).
 * Without this, any signed-in student could poll another student's flag count
 * by guessing an attempt id — both a privacy leak and a way to watch a peer's
 * exam go wrong in real time.
 */
async function canReadAttempt(attemptId: number): Promise<boolean> {
  const session = await getSession()
  if (!session?.user?.email) return false
  if (session.user.role === 'ADMIN' || session.user.role === 'LECTURER') return true

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: { student: { select: { email: true } } },
  })
  return attempt?.student.email === session.user.email
}

/**
 * Returns the current flag count for the given attempt's ProctorRecord.
 * Returns 0 if no ProctorRecord exists for the attempt, or if the caller is
 * not permitted to read it.
 */
export async function getProctorFlagCount(attemptId: number): Promise<number> {
  try {
    if (!(await canReadAttempt(attemptId))) return 0
    const record = await prisma.proctorRecord.findUnique({
      where: { attemptId },
      select: { flagCount: true },
    })
    return record?.flagCount ?? 0
  } catch (err) {
    console.error('[getProctorFlagCount] failed to read proctor flag count', {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return 0
  }
}

/**
 * Returns the current flag count AND the latest log entry's violationType and source.
 * Used by the exam UI to show the correct flag overlay when the server count
 * increases.
 */
export async function getProctorStatus(attemptId: number): Promise<{
  flagCount: number
  latestViolationType: string | null
  latestSource: 'CLIENT' | null
}> {
  const empty = { flagCount: 0, latestViolationType: null, latestSource: null }
  try {
    if (!(await canReadAttempt(attemptId))) return empty
    const record = await prisma.proctorRecord.findUnique({
      where: { attemptId },
      select: { flagCount: true, proctoringLog: true },
    })
    if (!record) return empty

    const log = Array.isArray(record.proctoringLog) ? record.proctoringLog : []
    const latest = log[log.length - 1] as { violationType?: string; source?: string } | undefined

    return {
      flagCount: record.flagCount,
      latestViolationType: (latest?.violationType as string) ?? null,
      latestSource: (latest?.source as 'CLIENT') ?? null,
    }
  } catch (err) {
    console.error('[getProctorStatus] failed to read proctor status', {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return empty
  }
}
