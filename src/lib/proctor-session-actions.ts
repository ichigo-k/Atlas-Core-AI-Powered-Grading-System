'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export type CreateProctorSessionResult =
  | { sessionId: string; livekitToken: string; livekitUrl: string }
  | { error: string }

/**
 * Creates an Oracle proctoring session and persists the resulting ProctorRecord
 * in the Portal database.
 *
 * Steps:
 * 1. Authenticate the student.
 * 2. Fetch the attempt + assessment from the DB to get studentId and assessmentEndsAt.
 * 3. POST to Oracle's /api/sessions/ endpoint.
 * 4. Create the ProctorRecord row in the Portal DB (stores livekitToken in the
 *    signalingToken column — no schema migration required).
 * 5. Return { sessionId, livekitToken, livekitUrl } on success.
 *
 * Falls back gracefully when ORACLE_BASE_URL is unset (Requirements 10.6):
 * returns synthetic values so the student can still proceed to the exam
 * without proctoring.
 *
 * Requirements: 2.6, 2.7, 10.6
 */
export async function createProctorSession(
  attemptId: number,
): Promise<CreateProctorSessionResult> {
  // 1. Authenticate
  const session = await getSession()
  if (!session?.user?.email) return { error: 'UNAUTHORIZED' }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return { error: 'UNAUTHORIZED' }

  // 2. Fetch attempt + assessment
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      assessmentId: true,
      status: true,
      assessment: {
        select: {
          endsAt: true,
        },
      },
    },
  })

  if (!attempt) return { error: 'ATTEMPT_NOT_FOUND' }
  if (attempt.studentId !== user.id) return { error: 'UNAUTHORIZED' }
  if (attempt.status !== 'IN_PROGRESS') return { error: 'ATTEMPT_NOT_IN_PROGRESS' }

  const oracleBaseUrl = process.env.ORACLE_BASE_URL

  // 3. POST to Oracle (or fall back when ORACLE_BASE_URL is unset)
  let sessionId: string
  let livekitToken: string
  let livekitUrl: string

  if (!oracleBaseUrl) {
    // Graceful fallback — no Oracle running; generate placeholder values so the
    // student can still proceed to the exam (Requirement 10.6).
    sessionId = `fallback-${attemptId}-${Date.now()}`
    livekitToken = `fallback-token-${attemptId}`
    livekitUrl = 'ws://localhost:7880'
  } else {
    try {
      const oracleRes = await fetch(`${oracleBaseUrl}/api/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: attempt.id,
          studentId: attempt.studentId,
          assessmentId: attempt.assessmentId,
          assessmentEndsAt: attempt.assessment.endsAt.toISOString(),
        }),
      })

      if (!oracleRes.ok) {
        const text = await oracleRes.text().catch(() => '')
        console.error('[createProctorSession] Oracle error:', oracleRes.status, text)
        return { error: 'ORACLE_SESSION_CREATION_FAILED' }
      }

      const data = (await oracleRes.json()) as {
        sessionId: string
        livekitToken: string
        livekitUrl: string
      }
      sessionId = data.sessionId
      livekitToken = data.livekitToken
      livekitUrl = data.livekitUrl
    } catch (err) {
      console.error('[createProctorSession] Oracle fetch error:', err)
      return { error: 'ORACLE_UNREACHABLE' }
    }
  }

  // 4. Create (or upsert) the ProctorRecord in the Portal DB.
  //    The livekitToken is stored in the signalingToken column — this column
  //    is reused so no schema migration is required (per task 10.1 spec).
  try {
    await prisma.proctorRecord.upsert({
      where: { attemptId },
      create: {
        attemptId,
        sessionId,
        signalingToken: livekitToken,
        consentAt: new Date(),
        flagCount: 0,
        flagThreshold: 5,
        proctoringLog: [],
        status: 'ACTIVE',
      },
      update: {
        // If a record already exists (e.g. student refreshed the onboarding page),
        // update the session credentials and reset consent timestamp.
        sessionId,
        signalingToken: livekitToken,
        consentAt: new Date(),
        status: 'ACTIVE',
      },
    })
  } catch (err) {
    console.error('[createProctorSession] DB error:', err)
    return { error: 'DB_ERROR' }
  }

  return { sessionId, livekitToken, livekitUrl }
}
