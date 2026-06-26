/**
 * Read-only queries for grader feedback tables.
 *
 * These tables (grader_gradingresult, grader_answerfeedback) are owned and
 * written to exclusively by the verion-ai-grader Django service. This module
 * only ever READS from them — never writes, updates or deletes.
 */

import { prisma } from '@/lib/prisma'

export type CriterionFeedback = {
  criterion: string
  awarded: number
  max: number
  justification: string
}

export type AnswerFeedbackItem = {
  questionId: number
  totalScore: number
  maxScore: number
  flag: string
  flagReason: string
  criteriaFeedback: CriterionFeedback[]
  bedrockError: boolean
}

export type AttemptGradingDetail = {
  attemptId: number
  assessmentId: number
  score: number
  plagiarismFlagged: boolean
  gradedAt: Date
  errorNotes: string
  answerFeedbacks: AnswerFeedbackItem[]
}

/**
 * Fetch the full grading detail for a single attempt, including per-answer
 * AI feedback and per-criterion scores.
 *
 * Returns null if the attempt has not been graded yet (no GradingResult row).
 */
export async function getAttemptGradingDetail(
  attemptId: number,
): Promise<AttemptGradingDetail | null> {
  const result = await prisma.gradingResult.findUnique({
    where: { attemptId },
    include: {
      answerFeedbacks: {
        orderBy: { questionId: 'asc' },
      },
    },
  })

  if (!result) return null

  return {
    attemptId: result.attemptId,
    assessmentId: result.assessmentId,
    score: result.score,
    plagiarismFlagged: result.plagiarismFlagged,
    gradedAt: result.gradedAt,
    errorNotes: result.errorNotes,
    answerFeedbacks: result.answerFeedbacks.map((fb: any) => ({
      questionId: fb.questionId,
      totalScore: fb.totalScore,
      maxScore: fb.maxScore,
      flag: fb.flag,
      flagReason: fb.flagReason,
      criteriaFeedback: parseCriteriaFeedback(fb.criteriaFeedback),
      bedrockError: fb.bedrockError,
    })),
  }
}

/**
 * Fetch grading results for all attempts in an assessment.
 * Useful for the lecturer results page to show per-student AI feedback.
 */
export async function getAssessmentGradingResults(
  assessmentId: number,
): Promise<AttemptGradingDetail[]> {
  const results = await prisma.gradingResult.findMany({
    where: { assessmentId },
    include: {
      answerFeedbacks: {
        orderBy: { questionId: 'asc' },
      },
    },
    orderBy: { gradedAt: 'desc' },
  })

  return results.map((result: any) => ({
    attemptId: result.attemptId,
    assessmentId: result.assessmentId,
    score: result.score,
    plagiarismFlagged: result.plagiarismFlagged,
    gradedAt: result.gradedAt,
    errorNotes: result.errorNotes,
    answerFeedbacks: result.answerFeedbacks.map((fb: any) => ({
      questionId: fb.questionId,
      totalScore: fb.totalScore,
      maxScore: fb.maxScore,
      flag: fb.flag,
      flagReason: fb.flagReason,
      criteriaFeedback: parseCriteriaFeedback(fb.criteriaFeedback),
      bedrockError: fb.bedrockError,
    })),
  }))
}

/**
 * Check whether a specific attempt has been graded.
 * Lightweight — only fetches the existence of a GradingResult row.
 */
export async function isAttemptGraded(attemptId: number): Promise<boolean> {
  const count = await prisma.gradingResult.count({ where: { attemptId } })
  return count > 0
}

/**
 * Fetch all plagiarism-flagged attempts for an assessment.
 */
export async function getFlaggedAttempts(assessmentId: number): Promise<number[]> {
  const results = await prisma.gradingResult.findMany({
    where: { assessmentId, plagiarismFlagged: true },
    select: { attemptId: true },
  })
  return results.map((r: any) => r.attemptId)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseCriteriaFeedback(raw: unknown): CriterionFeedback[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is CriterionFeedback =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as any).criterion === 'string' &&
      typeof (item as any).awarded === 'number' &&
      typeof (item as any).max === 'number' &&
      typeof (item as any).justification === 'string',
  )
}
