'use server'

import { prisma } from '@/lib/prisma'

/**
 * Returns the current flag count for the given attempt's ProctorRecord.
 * Returns 0 if no ProctorRecord exists for the attempt.
 */
export async function getProctorFlagCount(attemptId: number): Promise<number> {
  try {
    const record = await prisma.proctorRecord.findUnique({
      where: { attemptId },
      select: { flagCount: true },
    })
    return record?.flagCount ?? 0
  } catch {
    return 0
  }
}

/**
 * Returns the current flag count AND the latest log entry's violationType and source.
 * Used by the exam UI to show the correct Oracle flag overlay when the server count
 * increases due to an Oracle webhook.
 */
export async function getProctorStatus(attemptId: number): Promise<{
  flagCount: number
  latestViolationType: string | null
  latestSource: 'CLIENT' | 'ORACLE' | null
}> {
  try {
    const record = await prisma.proctorRecord.findUnique({
      where: { attemptId },
      select: { flagCount: true, proctoringLog: true },
    })
    if (!record) return { flagCount: 0, latestViolationType: null, latestSource: null }

    const log = Array.isArray(record.proctoringLog) ? record.proctoringLog : []
    const latest = log[log.length - 1] as { violationType?: string; source?: string } | undefined

    return {
      flagCount: record.flagCount,
      latestViolationType: (latest?.violationType as string) ?? null,
      latestSource: (latest?.source as 'CLIENT' | 'ORACLE') ?? null,
    }
  } catch {
    return { flagCount: 0, latestViolationType: null, latestSource: null }
  }
}
