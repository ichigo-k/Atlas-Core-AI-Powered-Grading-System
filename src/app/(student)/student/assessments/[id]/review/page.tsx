import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ShieldAlert,
  Zap,
  BookOpen,
  Award,
} from "lucide-react"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import {
  getAssessmentWithQuestions,
  getStudentAttempts,
  getActiveAttempt,
} from "@/lib/student-queries"
import { getAttemptGradingDetail } from "@/lib/grading-feedback"
import type { CriterionFeedback } from "@/lib/grading-feedback"

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionWithMeta = {
  id: number
  order: number
  body: string
  marks: number
  sectionName: string
  sectionType: string
  answerType: string | null
  options: unknown
  correctOption: number | null
  answer: {
    answerText: string | null
    selectedOption: number | null
    fileUrl: string | null
    lecturerNotes: string | null
  } | null
  feedback: {
    totalScore: number
    maxScore: number
    flag: string
    flagReason: string
    bedrockError: boolean
    criteriaFeedback: CriterionFeedback[]
  } | null
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : pct >= 20 ? "bg-orange-400" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-slate-500 tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  )
}

// ─── MCQ Question ─────────────────────────────────────────────────────────────

function McqQuestion({ q }: { q: QuestionWithMeta }) {
  const options = Array.isArray(q.options) ? (q.options as string[]) : []
  const selected = q.answer?.selectedOption ?? null
  const correct = q.correctOption ?? null
  const isCorrect = selected !== null && selected === correct

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrectOpt = correct === i
          let cls =
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors w-full"
          if (isCorrectOpt)
            cls += " border-green-200 bg-green-50 text-green-800"
          else if (isSelected && !isCorrectOpt)
            cls += " border-red-200 bg-red-50 text-red-700"
          else cls += " border-slate-100 bg-slate-50 text-slate-600"

          return (
            <div key={i} className={cls}>
              <span className="shrink-0 font-semibold text-[11px] mt-0.5 w-4">
                {String.fromCharCode(65 + i)}.
              </span>
              <span className="flex-1">{opt}</span>
              {isCorrectOpt && (
                <CheckCircle2 size={14} className="shrink-0 text-green-600 mt-0.5" />
              )}
              {isSelected && !isCorrectOpt && (
                <XCircle size={14} className="shrink-0 text-red-500 mt-0.5" />
              )}
            </div>
          )
        })}
      </div>
      {selected === null && (
        <p className="text-xs text-slate-400 italic">No answer selected</p>
      )}
      <div className="flex items-center gap-2">
        {isCorrect ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
            <CheckCircle2 size={12} /> Correct — {q.marks} / {q.marks} marks
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
            <XCircle size={12} /> Incorrect — 0 / {q.marks} marks
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Subjective Question ──────────────────────────────────────────────────────

function SubjectiveQuestion({ q }: { q: QuestionWithMeta }) {
  const fb = q.feedback

  return (
    <div className="space-y-3">
      {/* Student answer */}
      {q.answer?.fileUrl ? (
        <a
          href={q.answer.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#002388]/20 bg-[#f0f3ff] px-3 py-2 text-sm font-medium text-[#002388] hover:bg-[#e0e7ff] transition-colors"
        >
          <FileText size={14} />
          View submitted file
        </a>
      ) : q.answer?.answerText ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
          {q.answer.answerText}
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">No answer provided</p>
      )}

      {/* AI feedback */}
      {fb ? (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Score header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-800 shrink-0">
                {fb.totalScore} / {fb.maxScore}
                <span className="text-xs font-normal text-slate-400 ml-1">marks</span>
              </span>
              <div className="flex-1 min-w-0">
                <ScoreBar score={fb.totalScore} max={fb.maxScore} />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {fb.bedrockError && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Zap size={9} /> AI error
                </span>
              )}
              {fb.flag && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  <ShieldAlert size={9} /> {fb.flag}
                </span>
              )}
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Flag reason */}
            {fb.flagReason && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50">
                <AlertTriangle size={13} className="shrink-0 text-red-500 mt-0.5" />
                <p className="text-xs text-red-700">{fb.flagReason}</p>
              </div>
            )}

            {/* Per-criterion breakdown */}
            {fb.criteriaFeedback.length > 0 ? (
              fb.criteriaFeedback.map((c, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-700 flex-1">
                      {c.criterion}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 shrink-0 tabular-nums">
                      {c.awarded} / {c.max}
                    </span>
                  </div>
                  <ScoreBar score={c.awarded} max={c.max} />
                  {c.justification && (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {c.justification}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-3">
                <p className="text-xs text-slate-400 italic">No criterion breakdown available.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400 italic">
          Not yet graded by AI
        </div>
      )}

      {/* Lecturer notes (visible only when results released) */}
      {q.answer?.lecturerNotes && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/30 overflow-hidden">
          <div className="px-4 py-3 bg-blue-100/50 border-b border-blue-200">
            <span className="text-sm font-semibold text-blue-800">Lecturer's Notes</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{q.answer.lecturerNotes}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AssessmentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const assessmentId = Number(id)
  if (Number.isNaN(assessmentId)) notFound()

  // 1. Verify session
  const session = await getSession()
  const email = session?.user?.email
  if (!email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (!user) redirect("/login")
  const studentId = user.id

  // 2. Fetch assessment with enrollment check
  const assessment = await getAssessmentWithQuestions(assessmentId, studentId)
  if (!assessment) redirect(`/student/assessments/${assessmentId}`)

  // 3. Guard: check resultsReleased
  const assessmentMeta = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { resultsReleased: true },
  })
  if (!assessmentMeta?.resultsReleased) {
    redirect(`/student/assessments/${assessmentId}`)
  }

  // 4. Get the latest submitted attempt
  const attempts = await getStudentAttempts(studentId, assessmentId)
  const latestSubmitted = attempts
    .filter((a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT")
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0] ?? null

  if (!latestSubmitted) {
    redirect(`/student/assessments/${assessmentId}`)
  }

  // 5. Fetch the attempt's answers
  const attemptWithAnswers = await getActiveAttempt(latestSubmitted.id, studentId)
  if (!attemptWithAnswers) {
    redirect(`/student/assessments/${assessmentId}`)
  }

  // 6. Fetch AI feedback
  const gradingDetail = await getAttemptGradingDetail(latestSubmitted.id)

  // 7. Fetch correctOption for MCQ questions (not included in getAssessmentWithQuestions)
  const questionIds = assessment.sections.flatMap((s) => s.questions.map((q) => q.id))
  const questionsWithCorrect = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, correctOption: true },
  })
  const correctOptionMap = new Map(questionsWithCorrect.map((q) => [q.id, q.correctOption]))

  // 8. Build answer and feedback maps
  const answerMap = new Map(attemptWithAnswers.answers.map((a) => [a.questionId, a]))
  const feedbackMap = new Map(
    gradingDetail?.answerFeedbacks.map((f) => [f.questionId, f]) ?? [],
  )

  // 9. Build enriched question list grouped by section
  type SectionGroup = {
    id: number
    name: string
    type: string
    questions: QuestionWithMeta[]
  }

  const sections: SectionGroup[] = assessment.sections.map((section) => ({
    id: section.id,
    name: section.name,
    type: section.type,
    questions: section.questions.map((q) => {
      const answer = answerMap.get(q.id) ?? null
      const feedback = feedbackMap.get(q.id) ?? null
      return {
        id: q.id,
        order: q.order,
        body: q.body,
        marks: q.marks,
        sectionName: section.name,
        sectionType: section.type,
        answerType: q.answerType ?? null,
        options: q.options,
        correctOption: correctOptionMap.get(q.id) ?? null,
        answer: answer
          ? {
              answerText: answer.answerText,
              selectedOption: answer.selectedOption,
              fileUrl: answer.fileUrl,
              lecturerNotes: answer.lecturerNotes,
            }
          : null,
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
  }))

  const score = latestSubmitted.score
  const scorePct =
    score != null && assessment.totalMarks > 0
      ? Math.round((score / assessment.totalMarks) * 100)
      : null

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Back nav */}
      <Link
        href={`/student/assessments/${assessmentId}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ChevronLeft size={16} />
        Back to Assessment
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{assessment.title}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <BookOpen size={14} />
            {assessment.courseTitle}
            <span className="text-slate-300">·</span>
            <span className="font-mono text-xs text-slate-400">{assessment.courseCode}</span>
          </p>
        </div>

        {/* Score summary */}
        <div className="flex items-center gap-6 flex-wrap border-t border-slate-100 pt-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
              Your Score
            </p>
            {score != null ? (
              <p className="text-2xl font-semibold text-slate-900 flex items-center gap-1">
                <Award size={16} className="text-slate-400" />
                {score}
                <span className="text-sm font-normal text-slate-400 ml-0.5">
                  / {assessment.totalMarks}
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">Not yet scored</p>
            )}
          </div>

          {scorePct !== null && score != null && (
            <div className="flex-1 min-w-32">
              <ScoreBar score={score} max={assessment.totalMarks} />
            </div>
          )}

          {latestSubmitted.grade && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                Grade
              </p>
              <p className="text-2xl font-semibold text-slate-900">{latestSubmitted.grade}</p>
            </div>
          )}

          {gradingDetail?.plagiarismFlagged && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <ShieldAlert size={12} />
              Plagiarism flagged
            </span>
          )}
        </div>

        {/* Grader error notes */}
        {gradingDetail?.errorNotes && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={13} className="shrink-0 text-amber-500 mt-0.5" />
            <p className="text-xs text-amber-800">{gradingDetail.errorNotes}</p>
          </div>
        )}
      </div>

      {/* Questions by section */}
      {sections.map((section) => (
        <div key={section.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {/* Section header */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              {section.name}
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {section.questions.map((q, qi) => (
              <div key={q.id} className="px-6 py-5 space-y-3">
                {/* Question header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded bg-[#002388] text-white text-[10px] font-semibold mt-0.5">
                      {qi + 1}
                    </span>
                    <p className="text-sm text-slate-800 leading-relaxed">{q.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                    {q.marks} {q.marks === 1 ? "mark" : "marks"}
                  </span>
                </div>

                {/* Answer + feedback */}
                {section.type === "OBJECTIVE" ? (
                  <McqQuestion q={q} />
                ) : (
                  <SubjectiveQuestion q={q} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {sections.every((s) => s.questions.length === 0) && (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm text-slate-400">No questions found for this assessment.</p>
        </div>
      )}
    </div>
  )
}
