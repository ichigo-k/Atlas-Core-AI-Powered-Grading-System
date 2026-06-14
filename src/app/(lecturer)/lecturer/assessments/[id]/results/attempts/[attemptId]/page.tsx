import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ShieldAlert, AlertTriangle } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAttemptGradingDetail } from "@/lib/grading-feedback"
import {
  McqQuestion,
  SubjectiveQuestion,
  ScoreBar,
  type AttemptDetail,
  type QuestionDetail,
} from "../../AttemptDetailContent"

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function fetchAttemptDetail(
  assessmentId: number,
  attemptId: number,
  lecturerUserId: number,
): Promise<AttemptDetail | null> {
  // Verify lecturer owns the assessment and fetch questions
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

  if (!assessment || assessment.lecturerId !== lecturerUserId) return null

// Verify attempt belongs to this assessment
   const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      assessmentId: true,
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

  if (!attempt || attempt.assessmentId !== assessmentId) return null

  // Fetch AI grading detail (may be null if not yet graded)
  const gradingDetail = await getAttemptGradingDetail(attemptId)

  // Build lookup maps
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]))
  const feedbackMap = new Map(
    gradingDetail?.answerFeedbacks.map((f) => [f.questionId, f]) ?? [],
  )

// Build questions array
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
         answer: answer
           ? {
               answerText: answer.answerText,
               selectedOption: answer.selectedOption,
               fileUrl: answer.fileUrl,
             }
           : null,
         lecturerNotes: answer?.lecturerNotes ?? null,
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
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>
}) {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") {
    redirect("/login")
  }

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

  // Group questions by section
  const sectionMap = new Map<string, QuestionDetail[]>()
  for (const q of detail.questions) {
    const key = q.sectionName
    if (!sectionMap.has(key)) sectionMap.set(key, [])
    sectionMap.get(key)!.push(q)
  }

  const scoreDisplay =
    detail.score !== null
      ? `${detail.score} / ${detail.totalMarks}`
      : `— / ${detail.totalMarks}`

  const submittedDate = detail.submittedAt
    ? new Date(detail.submittedAt).toLocaleString()
    : "Not submitted"

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/lecturer/assessments/${assessmentId}/results`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ChevronLeft size={15} />
        Back to Results
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Attempt #{detail.attemptNumber}
            </p>
            <h1 className="text-xl font-bold text-slate-900">
              {detail.student.name ?? detail.student.email}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{detail.student.email}</p>
          </div>
          {detail.plagiarismFlagged && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 shrink-0">
              <ShieldAlert size={13} />
              Plagiarism Flagged
            </span>
          )}
        </div>

        {/* Score summary */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Score</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {scoreDisplay}
            </span>
          </div>
          {detail.score !== null && (
            <ScoreBar score={detail.score} max={detail.totalMarks} />
          )}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>Submitted: {submittedDate}</span>
            <span className="capitalize">{detail.status.toLowerCase().replace("_", " ")}</span>
          </div>
        </div>

        {/* Grader error notes */}
        {detail.errorNotes && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={14} className="shrink-0 text-amber-600 mt-0.5" />
            <p className="text-xs text-amber-800">{detail.errorNotes}</p>
          </div>
        )}
      </div>

      {/* Questions grouped by section */}
      {Array.from(sectionMap.entries()).map(([sectionName, questions]) => (
        <div key={sectionName} className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-1">
            {sectionName}
          </h2>
{questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
            >
              {/* Question header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span className="shrink-0 text-xs font-bold text-slate-400 mt-0.5 w-5">
                    {idx + 1}.
                  </span>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed">
                    {q.body}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                  {q.marks} mark{q.marks !== 1 ? "s" : ""}
                </span>
              </div>

              {q.sectionType === "OBJECTIVE" ? (
                <McqQuestion q={q} />
              ) : (
                <SubjectiveQuestion q={q} assessmentId={assessmentId} attemptId={detail.attemptId} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
