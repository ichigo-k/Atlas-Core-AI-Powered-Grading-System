import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAttemptGradingDetail } from "@/lib/grading-feedback"

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

// GET /api/lecturer/assessments/[id]/attempts/[attemptId]
// Returns full attempt detail: questions, student answers, AI feedback
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const lecturerId = await getLecturerId(session.user.email!)
  if (!lecturerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id, attemptId: attemptIdStr } = await params
  const assessmentId = parseInt(id)
  const attemptId = parseInt(attemptIdStr)
  if (isNaN(assessmentId) || isNaN(attemptId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Verify lecturer owns the assessment
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      lecturerId: true,
      totalMarks: true,
      sections: {
        include: {
          questions: {
            include: { rubricCriteria: { orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  })
  if (!assessment || assessment.lecturerId !== lecturerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Verify attempt belongs to this assessment
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      assessmentId: true,
      studentId: true,
      attemptNumber: true,
      status: true,
      score: true,
      startedAt: true,
      submittedAt: true,
answers: {
        select: {
          questionId: true,
          answerText: true,
          selectedOption: true,
          fileUrl: true,
          lecturerNotes: true,
        },
      },
      student: {
        select: { name: true, email: true },
      },
    },
  })
  if (!attempt || attempt.assessmentId !== assessmentId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Fetch AI grading detail (may be null if not yet graded)
  const gradingDetail = await getAttemptGradingDetail(attemptId)

  // Build answer map for quick lookup
  const answerMap = new Map(attempt.answers.map((a: any) => [a.questionId, a]))
  // Build feedback map for quick lookup
  const feedbackMap = new Map(
    gradingDetail?.answerFeedbacks.map((f: any) => [f.questionId, f]) ?? []
  )

  // Build the response — one entry per question
  const questions = assessment.sections.flatMap((section: any) =>
    section.questions.map((q: any) => {
      const answer = answerMap.get(q.id) ?? null
      const feedback = feedbackMap.get(q.id) ?? null
      return {
        id: q.id,
        order: q.order,
        body: q.body,
        marks: q.marks,
        sectionName: section.name,
        sectionType: section.type,
        answerType: q.answerType,
        options: q.options,
        correctOption: q.correctOption,
        rubricCriteria: q.rubricCriteria.map((rc: any) => ({
          description: rc.description,
          maxMarks: rc.maxMarks,
          order: rc.order,
        })),
        // Student's answer
        answer: answer
          ? {
              answerText: answer.answerText,
              selectedOption: answer.selectedOption,
              fileUrl: answer.fileUrl,
              lecturerNotes: answer.lecturerNotes,
            }
          : null,
        // AI feedback (null if not graded or MCQ)
        feedback: feedback
          ? {
              totalScore: feedback.totalScore,
              maxScore: feedback.maxScore,
              flag: feedback.flag,
              flagReason: feedback.flagReason,
              bedrockError: feedback.bedrockError,
              criteriaFeedback: feedback.criteriaFeedback,
            }
          : null,
      }
    })
  )

  return NextResponse.json({
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    score: attempt.score,
    totalMarks: assessment.totalMarks,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    student: attempt.student,
    plagiarismFlagged: gradingDetail?.plagiarismFlagged ?? false,
    gradedAt: gradingDetail?.gradedAt ?? null,
    errorNotes: gradingDetail?.errorNotes ?? "",
    questions,
  })
}
