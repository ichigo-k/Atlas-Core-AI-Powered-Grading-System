'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { computeHash, shuffleWithSeed } from '@/lib/student-utils'

export type AttemptResult = { attemptId: number } | { error: string }
export type SubmitResult = { success: true } | { error: string }
export type AnswerPayload = {
  answerText?: string | null
  selectedOption?: number | null
  fileUrl?: string | null
}

async function getStudentId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email } })
  return user?.id ?? null
}

export async function expireAbandonedAttempts(assessmentId: number, studentId: number): Promise<number> {
  const result = await prisma.assessmentAttempt.updateMany({
    where: { assessmentId, studentId, status: 'IN_PROGRESS' },
    data: { status: 'TIMED_OUT', submittedAt: new Date() },
  })

  return result.count
}

export async function createOrResumeAttempt(
  assessmentId: number,
  password?: string,
): Promise<AttemptResult> {
  try {
    const session = await getSession()
    if (!session?.user || session.user.role !== 'STUDENT') return { error: 'UNAUTHORIZED' }

    const studentId = await getStudentId(session.user.email!)
    if (!studentId) return { error: 'UNAUTHORIZED' }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        passwordProtected: true,
        accessPassword: true,
        maxAttempts: true,
        shuffleQuestions: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
    })
    if (!assessment) return { error: 'NOT_FOUND' }

    // Enforce assessment window — server-side time check
    const now = new Date()
    if (assessment.status !== 'PUBLISHED') return { error: 'NOT_AVAILABLE' }
    if (now < assessment.startsAt) return { error: 'NOT_STARTED' }

    // If assessment time has expired, auto-mark any abandoned IN_PROGRESS attempts as TIMED_OUT
    // so they properly count against maxAttempts and the user understands they used that slot
    if (now > assessment.endsAt) {
      await expireAbandonedAttempts(assessmentId, studentId)
      return { error: 'ENDED' }
    }

    // Resume an in-progress attempt if one exists (no password check needed for resume)
    const existing = await prisma.assessmentAttempt.findFirst({
      where: { assessmentId, studentId, status: 'IN_PROGRESS' },
      select: { id: true },
    })
    if (existing) return { attemptId: existing.id }

    // Password check only needed when creating a NEW attempt, not resuming
    if (assessment.passwordProtected) {
      if (!password || password !== assessment.accessPassword) return { error: 'INVALID_PASSWORD' }
    }

    // Count only completed attempts (SUBMITTED / TIMED_OUT) against the limit.
    // IN_PROGRESS attempts are already handled above (resume), so they don't
    // consume an extra slot here.
    const completedCount = await prisma.assessmentAttempt.count({
      where: { assessmentId, studentId, status: { in: ['SUBMITTED', 'TIMED_OUT'] } },
    })
    if (completedCount >= assessment.maxAttempts) return { error: 'MAX_ATTEMPTS_REACHED' }

    // Total attempts (including any in-progress) determines the next attempt number
    const totalCount = await prisma.assessmentAttempt.count({ where: { assessmentId, studentId } })

    let questionOrder: { questionId: number }[] = []
    if (assessment.shuffleQuestions) {
      const questions = await prisma.question.findMany({ where: { assessmentId }, select: { id: true } })
      questionOrder = shuffleWithSeed(questions.map((q) => q.id)).map((id) => ({ questionId: id }))
    }

    const newAttempt = await prisma.assessmentAttempt.create({
      data: { assessmentId, studentId, status: 'IN_PROGRESS', startedAt: new Date(), attemptNumber: totalCount + 1, questionOrder },
      select: { id: true },
    })

    return { attemptId: newAttempt.id }
  } catch (err) {
    console.error('[createOrResumeAttempt] Failed to create/resume attempt', {
      assessmentId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return { error: 'SERVER_ERROR' }
  }
}

export async function saveAnswer(
  attemptId: number,
  questionId: number,
  payload: AnswerPayload,
): Promise<void> {
  try {
    const session = await getSession()
    if (!session?.user || session.user.role !== 'STUDENT') return

    const studentId = await getStudentId(session.user.email!)
    if (!studentId) return

    const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, select: { studentId: true } })
    if (!attempt || attempt.studentId !== studentId) return

    await prisma.studentAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, answerText: payload.answerText ?? null, selectedOption: payload.selectedOption ?? null, fileUrl: payload.fileUrl ?? null },
      update: { answerText: payload.answerText ?? null, selectedOption: payload.selectedOption ?? null, fileUrl: payload.fileUrl ?? null },
    })
  } catch (err) {
    console.error('[saveAnswer] Failed to save answer', {
      attemptId,
      questionId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
  }
}

export async function logTabSwitch(attemptId: number, timestamp: string): Promise<void> {
  try {
    const session = await getSession()
    if (!session?.user || session.user.role !== 'STUDENT') return

    const studentId = await getStudentId(session.user.email!)
    if (!studentId) return

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true, tabSwitchLog: true },
    })
    if (!attempt || attempt.studentId !== studentId) return

    const log = Array.isArray(attempt.tabSwitchLog) ? attempt.tabSwitchLog : []
    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { tabSwitchLog: [...log, { timestamp, event: 'tab_switch' }] },
    })
  } catch (err) {
    console.error('[logTabSwitch] Failed to log tab switch', {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
  }
}

export async function submitAttempt(attemptId: number, reason?: 'TIMED_OUT' | 'FULLSCREEN_VIOLATION' | 'TAB_SWITCH' | 'PROCTOR_VIOLATION'): Promise<SubmitResult> {
  try {
    const session = await getSession()
    if (!session?.user || session.user.role !== 'STUDENT') return { error: 'UNAUTHORIZED' }

    const studentId = await getStudentId(session.user.email!)
    if (!studentId) return { error: 'UNAUTHORIZED' }

    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { studentId: true, assessmentId: true },
    })
    if (!attempt || attempt.studentId !== studentId) return { error: 'NOT_FOUND' }

    return submitAttemptInternal(attemptId, attempt.assessmentId, reason)
  } catch (err) {
    console.error('[submitAttempt] Failed to submit attempt', {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return { error: 'SERVER_ERROR' }
  }
}

/**
 * Internal submit — no session check. Used by server-side callers such as the
 * proctor flag API route (which has already authenticated the request via HMAC
 * or session cookie before calling this).
 */
export async function submitAttemptInternal(
  attemptId: number,
  assessmentId: number,
  reason?: 'TIMED_OUT' | 'FULLSCREEN_VIOLATION' | 'TAB_SWITCH' | 'PROCTOR_VIOLATION',
): Promise<SubmitResult> {
  try {
    // Fetch all answers and MCQ questions in parallel
    const [answers, questions, currentAttempt] = await Promise.all([
      prisma.studentAnswer.findMany({
        where: { attemptId },
        select: { id: true, questionId: true, answerText: true, selectedOption: true },
      }),
      prisma.question.findMany({
        where: {
          assessmentId,
          section: { type: 'OBJECTIVE' },
          correctOption: { not: null },
        },
        select: { id: true, marks: true, correctOption: true, options: true },
      }),
      prisma.assessmentAttempt.findUnique({
        where: { id: attemptId },
        select: { tabSwitchLog: true },
      }),
    ])

    // Explicit null guard — attempt may have been deleted in a race
    if (!currentAttempt) {
      console.error('[submitAttemptInternal] Attempt not found', { attemptId, assessmentId })
      return { error: 'NOT_FOUND' }
    }

    // Auto-score MCQ questions
    const questionMap = new Map(questions.map((q) => [q.id, q]))
    let mcqScore = 0

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId)
      if (!question) continue

      // Bounds guard: warn if correctOption is outside the options array
      const optCount = Array.isArray(question.options) ? question.options.length : null
      if (optCount !== null && (question.correctOption! < 0 || question.correctOption! >= optCount)) {
        console.error('[submitAttemptInternal] correctOption out of bounds', {
          attemptId,
          questionId: question.id,
          correctOption: question.correctOption,
          optionsLength: optCount,
        })
        continue
      }

      if (answer.selectedOption === question.correctOption) {
        mcqScore += question.marks
      }
    }

    const existingLog = Array.isArray(currentAttempt.tabSwitchLog) ? currentAttempt.tabSwitchLog : []
    const logWithReason = reason
      ? [...existingLog, { timestamp: new Date().toISOString(), event: reason }]
      : existingLog

    const dbStatus = reason ? 'TIMED_OUT' : 'SUBMITTED'
    const submittedAt = new Date()

    // Atomically hash all answers + mark attempt submitted in one transaction
    await prisma.$transaction([
      ...answers.map((a) =>
        prisma.studentAnswer.update({
          where: { id: a.id },
          data: { answerHash: computeHash(a.answerText ?? null) },
        })
      ),
      prisma.assessmentAttempt.update({
        where: { id: attemptId },
        data: {
          status: dbStatus,
          submittedAt,
          score: mcqScore,
          tabSwitchLog: logWithReason,
        },
      }),
    ])

    // Fire-and-forget: end Oracle proctoring session if one exists for this attempt
    const oracleBaseUrl = process.env.ORACLE_BASE_URL
    if (oracleBaseUrl) {
      const proctorRecord = await prisma.proctorRecord.findUnique({
        where: { attemptId },
        select: { sessionId: true },
      })
      if (proctorRecord?.sessionId) {
        fetch(`${oracleBaseUrl}/api/sessions/${proctorRecord.sessionId}/end`, { method: 'POST' })
          .catch(() => { }) // fire-and-forget — Oracle failures must not block submission
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[submitAttemptInternal] Failed to submit attempt', {
      attemptId,
      assessmentId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return { error: 'SERVER_ERROR' }
  }
}
