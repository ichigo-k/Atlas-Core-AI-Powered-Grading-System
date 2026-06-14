/**
 * Server-side query functions for the lecturer proctoring dashboard.
 *
 * Both functions require the caller to have LECTURER or ADMIN role (Requirements 9.5).
 * Role is verified via Prisma using the provided userId parameter.
 *
 * Requirements: 9.1, 9.3, 9.5
 */

import { prisma } from '@/lib/prisma'
import { type ProctoringLogEntry, deserializeProctoringLog } from '@/lib/proctor-log'

export type ProctoringAttemptRow = {
  attemptId: number
  sessionId: string
  flagCount: number
  flagThreshold: number
  status: string
  consentAt: Date
  createdAt: Date
  studentName: string | null
}

/**
 * Verify that the given userId belongs to a LECTURER or ADMIN.
 * Throws an error if the user is not found or does not have the required role.
 */
async function requireLecturerOrAdmin(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  if (user.role !== 'LECTURER' && user.role !== 'ADMIN') {
    throw new Error(`User ${userId} does not have permission to view proctoring data`)
  }
}

/**
 * Returns all ProctorRecord rows for the given assessment, joined with the
 * student's name, sorted by flagCount descending.
 *
 * Requirements: 9.1, 9.3, 9.5
 */
export async function getProctoringAttempts(
  assessmentId: number,
  userId: number,
): Promise<ProctoringAttemptRow[]> {
  await requireLecturerOrAdmin(userId)

  const records = await prisma.proctorRecord.findMany({
    where: {
      attempt: { assessmentId },
    },
    orderBy: { flagCount: 'desc' },
    select: {
      id: true,
      attemptId: true,
      sessionId: true,
      flagCount: true,
      flagThreshold: true,
      status: true,
      consentAt: true,
      createdAt: true,
      attempt: {
        select: {
          student: {
            select: { name: true },
          },
        },
      },
    },
  })

  return records.map((record) => ({
    attemptId: record.attemptId,
    sessionId: record.sessionId,
    flagCount: record.flagCount,
    flagThreshold: record.flagThreshold,
    status: record.status,
    consentAt: record.consentAt,
    createdAt: record.createdAt,
    studentName: record.attempt.student.name ?? null,
  }))
}

/**
 * Returns the full proctoringLog for a single attempt, deserialized into
 * a typed ProctoringLogEntry array.
 *
 * Requirements: 9.1, 9.2, 9.5
 */
export async function getProctoringLog(
  attemptId: number,
  userId: number,
): Promise<ProctoringLogEntry[]> {
  await requireLecturerOrAdmin(userId)

  const record = await prisma.proctorRecord.findUnique({
    where: { attemptId },
    select: { proctoringLog: true },
  })

  if (!record) {
    throw new Error(`ProctorRecord not found for attemptId ${attemptId}`)
  }

  return deserializeProctoringLog(JSON.stringify(record.proctoringLog))
}
