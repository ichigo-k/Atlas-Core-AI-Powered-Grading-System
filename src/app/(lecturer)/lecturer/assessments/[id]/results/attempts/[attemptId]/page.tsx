import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ClipboardList } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAttemptGradingDetail } from "@/lib/grading-feedback"
import { AttemptDetailView, type AttemptDetail, type AttemptSummary, type QuestionDetail } from "../../AttemptDetailContent"

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchAttemptDetail(
  assessmentId: number,
  attemptId: number,
  lecturerUserId: number,
): Promise<AttemptDetail | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      lecturerId: true,
      totalMarks: true,
      title: true,
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

  if (!assessment || assessment.lecturerId !== lecturerUserId) return null

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
          lecturerAdjustedScore: true,
          lecturerAdjustReason: true,
        },
      },
      student: {
        select: { name: true, email: true },
      },
    },
  })

  if (!attempt || attempt.assessmentId !== assessmentId) return null

  // All attempts for this student on this assessment
  const siblingAttempts = await prisma.assessmentAttempt.findMany({
    where: {
      assessmentId,
      studentId: attempt.studentId,
      status: { in: ["SUBMITTED", "TIMED_OUT"] },
    },
    orderBy: { attemptNumber: "asc" },
    select: { id: true, attemptNumber: true, score: true, submittedAt: true },
  })

  // Highest = attempt with greatest score
  let highestId: number | null = null
  let highestScore = -Infinity
  for (const a of siblingAttempts) {
    const effective = a.score ?? -1
    if (effective > highestScore) { highestScore = effective; highestId = a.id }
  }

  const allAttempts: AttemptSummary[] = siblingAttempts.map((a) => ({
    attemptId: a.id,
    attemptNumber: a.attemptNumber,
    score: a.score,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    isHighest: a.id === highestId,
  }))

  const gradingDetail = await getAttemptGradingDetail(attemptId)

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]))
  const feedbackMap = new Map(
    gradingDetail?.answerFeedbacks.map((f) => [f.questionId, f]) ?? [],
  )

  const questions: QuestionDetail[] = assessment.sections.flatMap((section) =>
    section.questions.map((q) => {
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
        rubricCriteria: q.rubricCriteria.map((rc) => ({
          description: rc.description,
          maxMarks: rc.maxMarks,
          order: rc.order,
        })),
        answer: answer ? {
          answerText: answer.answerText,
          selectedOption: answer.selectedOption,
          fileUrl: answer.fileUrl,
        } : null,
        lecturerNotes: answer?.lecturerNotes ?? null,
        lecturerAdjustedScore: answer?.lecturerAdjustedScore ?? null,
        lecturerAdjustReason: answer?.lecturerAdjustReason ?? null,
        feedback: feedback ? {
          totalScore: feedback.totalScore,
          maxScore: feedback.maxScore,
          flag: feedback.flag,
          flagReason: feedback.flagReason,
          bedrockError: feedback.bedrockError,
          criteriaFeedback: feedback.criteriaFeedback as any,
        } : null,
      }
    }),
  )

  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    score: attempt.score,
    totalMarks: assessment.totalMarks,
    startedAt: attempt.startedAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    student: attempt.student,
    plagiarismFlagged: gradingDetail?.plagiarismFlagged ?? false,
    gradedAt: gradingDetail?.gradedAt?.toISOString() ?? null,
    errorNotes: gradingDetail?.errorNotes ?? "",
    questions,
    allAttempts,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>
}) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/login")

  const { id, attemptId: attemptIdStr } = await params
  const assessmentId = parseInt(id)
  const attemptId = parseInt(attemptIdStr)
  if (isNaN(assessmentId) || isNaN(attemptId)) notFound()

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  })
  if (!user) redirect("/login")

  const detail = await fetchAttemptDetail(assessmentId, attemptId, user.id)
  if (!detail) notFound()

  return (
    <div className="min-h-screen bg-[#f3f2f1]">
      {/* Top nav strip */}
      <div className="bg-white border-b border-border px-4 py-3 md:px-6 lg:px-8">
        <div className="max-w-[900px] flex items-center gap-3">
          <Link
            href={`/lecturer/assessments/${assessmentId}?tab=results`}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-[#1e293b] transition-colors"
          >
            <ChevronLeft size={14} /> Back to Results
          </Link>
          <span className="text-[#d1d5db]">/</span>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <ClipboardList size={11} />
            {detail.student.name ?? detail.student.email}
          </span>
        </div>
      </div>

      <AttemptDetailView detail={detail} assessmentId={assessmentId} />
    </div>
  )
}
