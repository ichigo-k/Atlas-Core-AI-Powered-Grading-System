import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAction } from "@/lib/audit"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== "LECTURER") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    const { id, attemptId: attemptIdStr } = await params
    const assessmentId = parseInt(id)
    const attemptId = parseInt(attemptIdStr)
    if (isNaN(assessmentId) || isNaN(attemptId)) {
      return NextResponse.json({ error: "INVALID_PARAMS" }, { status: 400 })
    }

    const body = await req.json()
    const { questionId, adjustedScore, reason } = body

    if (typeof questionId !== "number") {
      return NextResponse.json({ error: "INVALID_QUESTION" }, { status: 400 })
    }
    if (typeof adjustedScore !== "number" || adjustedScore < 0) {
      return NextResponse.json({ error: "INVALID_SCORE" }, { status: 400 })
    }
    if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

    // Verify lecturer owns the assessment
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        lecturerId: true,
        sections: { select: { questions: { select: { id: true, marks: true, correctOption: true } } } },
      },
    })
    if (!assessment || assessment.lecturerId !== user.id) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    // Validate adjusted score doesn't exceed question max marks
    const allQuestions = assessment.sections.flatMap((s) => s.questions)
    const question = allQuestions.find((q) => q.id === questionId)
    if (!question) return NextResponse.json({ error: "INVALID_QUESTION" }, { status: 400 })
    if (adjustedScore > question.marks) {
      return NextResponse.json({ error: "SCORE_EXCEEDS_MAX" }, { status: 400 })
    }

    // Verify attempt belongs to this assessment
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: {
        assessmentId: true,
        answers: {
          select: {
            questionId: true,
            selectedOption: true,
            lecturerAdjustedScore: true,
          },
        },
      },
    })
    if (!attempt || attempt.assessmentId !== assessmentId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    // Save per-question adjustment (upsert — answer row may not exist for unanswered questions)
    await prisma.studentAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        lecturerAdjustedScore: adjustedScore,
        lecturerAdjustReason: reason.trim(),
      },
      update: {
        lecturerAdjustedScore: adjustedScore,
        lecturerAdjustReason: reason.trim(),
      },
    })

    // Recompute total attempt score using: adjusted > AI score > MCQ auto-score
    // Fetch AI feedback for this attempt
    const gradingResult = await prisma.gradingResult.findUnique({
      where: { attemptId },
      select: { answerFeedbacks: { select: { questionId: true, totalScore: true } } },
    })
    const aiFeedbackMap = new Map(
      (gradingResult?.answerFeedbacks ?? []).map((f) => [f.questionId, f.totalScore]),
    )

    // Get all answers after update
    const updatedAnswers = await prisma.studentAnswer.findMany({
      where: { attemptId },
      select: { questionId: true, selectedOption: true, lecturerAdjustedScore: true },
    })
    const answerMap = new Map(updatedAnswers.map((a) => [a.questionId, a]))

    let newTotal = 0
    for (const q of allQuestions) {
      const answer = answerMap.get(q.id)
      if (answer?.lecturerAdjustedScore !== null && answer?.lecturerAdjustedScore !== undefined) {
        newTotal += answer.lecturerAdjustedScore
      } else {
        const aiScore = aiFeedbackMap.get(q.id)
        if (aiScore !== undefined) {
          newTotal += aiScore
        } else if (q.correctOption !== null && answer) {
          // MCQ auto-score
          newTotal += answer.selectedOption === q.correctOption ? q.marks : 0
        }
      }
    }

    await prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { score: newTotal },
    })

    await logAction(
      "SCORE_ADJUSTED",
      `Lecturer ${user.id} adjusted question ${questionId} score to ${adjustedScore} on attempt ${attemptId} (assessment ${assessmentId}). Reason: ${reason.trim()}. New total: ${newTotal}.`,
      "SYSTEM"
    )

    return NextResponse.json({ ok: true, newTotal })
  } catch (err) {
    console.error("[POST adjust-question]", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
