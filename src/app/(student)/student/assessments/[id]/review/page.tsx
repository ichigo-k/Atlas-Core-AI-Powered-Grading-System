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
  ClipboardList,
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
    pct >= 70 ? "bg-[#10B981]" : pct >= 50 ? "bg-[#F59E0B]" : pct >= 20 ? "bg-[#F97316]" : "bg-[#EF4444]"
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-[#1e293b] tabular-nums w-10 text-right">
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
      <div className="grid gap-1.5">
        {options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrectOpt = correct === i
          let cls =
            "flex items-start gap-3 rounded-sm border px-3 py-2 text-[12px] font-semibold transition-all w-full "
          if (isCorrectOpt)
            cls += "border-emerald-200 bg-emerald-50 text-emerald-800"
          else if (isSelected && !isCorrectOpt)
            cls += "border-red-200 bg-red-50 text-red-800"
          else cls += "border-border bg-white text-slate-600 hover:bg-slate-50"

          return (
            <div key={i} className={cls}>
              <span className="shrink-0 font-bold text-[10px] mt-0.5 w-5 h-5 flex items-center justify-center rounded-sm bg-slate-100 border border-border text-[#1e293b]">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 leading-tight mt-0.5">{opt}</span>
              {isCorrectOpt && (
                <CheckCircle2 size={14} className="shrink-0 text-emerald-600" strokeWidth={2} />
              )}
              {isSelected && !isCorrectOpt && (
                <XCircle size={14} className="shrink-0 text-red-600" strokeWidth={2} />
              )}
            </div>
          )
        })}
      </div>
      {selected === null && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground italic px-1">No answer selected</p>
      )}
      <div className="flex items-center gap-2 px-1 pt-1">
        {isCorrect ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
            <CheckCircle2 size={12} strokeWidth={2} /> Correct — {q.marks} Marks awarded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
            <XCircle size={12} strokeWidth={2} /> Incorrect — 0 Marks awarded
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
    <div className="space-y-4">
      {/* Student answer */}
      {q.answer?.fileUrl ? (
        <a
          href={q.answer.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
        >
          <FileText size={14} strokeWidth={2} />
          View attachment
        </a>
      ) : q.answer?.answerText ? (
        <div className="rounded-sm border border-border bg-slate-50/50 px-4 py-3 text-[12px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
          {q.answer.answerText}
        </div>
      ) : (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground italic px-1">No answer provided</p>
      )}

      {/* AI feedback */}
      {fb ? (
        <div className="bg-white border border-border rounded-sm overflow-hidden">
          {/* Score header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-border">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-[#1e293b] uppercase tracking-wider shrink-0">
                {fb.totalScore} / {fb.maxScore} <span className="text-slate-400 font-medium ml-0.5">pts</span>
              </span>
              <div className="flex-1 min-w-0">
                <ScoreBar score={fb.totalScore} max={fb.maxScore} />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {fb.bedrockError && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                  <Zap size={10} strokeWidth={2} /> AI ERROR
                </span>
              )}
              {fb.flag && (
                <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded-sm px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                  <ShieldAlert size={10} strokeWidth={2} /> {fb.flag}
                </span>
              )}
              <ChevronDown size={14} className="text-slate-400" strokeWidth={2} />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Flag reason */}
            {fb.flagReason && (
              <div className="flex items-start gap-2.5 px-4 py-2.5 bg-red-50/50 border-b border-red-100">
                <AlertTriangle size={14} className="shrink-0 text-red-600 mt-0.5" strokeWidth={2} />
                <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">{fb.flagReason}</p>
              </div>
            )}

            {/* Per-criterion breakdown */}
            {fb.criteriaFeedback.length > 0 ? (
              fb.criteriaFeedback.map((c, i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-wide flex-1">
                      {c.criterion}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                      {c.awarded} / {c.max}
                    </span>
                  </div>
                  <ScoreBar score={c.awarded} max={c.max} />
                  {c.justification && (
                    <p className="text-[11px] font-medium text-muted-foreground leading-relaxed italic">
                      "{c.justification}"
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground italic text-center">Breakdown Unavailable</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-border bg-slate-50/30 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground italic text-center">
          Awaiting AI Grading
        </div>
      )}

      {/* Lecturer notes */}
      {q.answer?.lecturerNotes && (
        <div className="bg-white border border-primary/20 bg-primary/5 rounded-sm overflow-hidden">
          <div className="px-4 py-2 bg-primary/10 border-b border-primary/10">
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Lecturer Feedback</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-[12px] font-semibold text-slate-700 whitespace-pre-wrap italic">
              {q.answer.lecturerNotes}
            </p>
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

  const session = await getSession()
  const email = session?.user?.email
  if (!email) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (!user) redirect("/login")
  const studentId = user.id

  const assessment = await getAssessmentWithQuestions(assessmentId, studentId)
  if (!assessment) redirect(`/student/assessments/${assessmentId}`)

  const assessmentMeta = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { resultsReleased: true },
  })
  if (!assessmentMeta?.resultsReleased) {
    redirect(`/student/assessments/${assessmentId}`)
  }

  const attempts = await getStudentAttempts(studentId, assessmentId)
  const latestSubmitted = attempts
    .filter((a) => a.status === "SUBMITTED" || a.status === "TIMED_OUT")
    .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0] ?? null

  if (!latestSubmitted) {
    redirect(`/student/assessments/${assessmentId}`)
  }

  const attemptWithAnswers = await getActiveAttempt(latestSubmitted.id, studentId)
  if (!attemptWithAnswers) {
    redirect(`/student/assessments/${assessmentId}`)
  }

  const gradingDetail = await getAttemptGradingDetail(latestSubmitted.id)

  const questionIds = assessment.sections.flatMap((s) => s.questions.map((q) => q.id))
  const questionsWithCorrect = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, correctOption: true },
  })
  const correctOptionMap = new Map(questionsWithCorrect.map((q) => [q.id, q.correctOption]))

  const answerMap = new Map(attemptWithAnswers.answers.map((a) => [a.questionId, a]))
  const feedbackMap = new Map(
    gradingDetail?.answerFeedbacks.map((f) => [f.questionId, f]) ?? [],
  )

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
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full">
      {/* Command bar */}
      <div className="bg-white border-b border-[#edebe9] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1 text-[11px] text-[#8a8886] mb-0.5">
            <span>Student</span>
            <span className="mx-0.5">›</span>
            <span>Grades</span>
            <span className="mx-0.5">›</span>
            <span>Results</span>
            <span className="mx-0.5">›</span>
            <span className="text-[#002388] font-medium">Review</span>
          </div>
          <h1 className="text-[17px] font-semibold text-[#323130]">Assessment Review</h1>
        </div>
        <Link
          href={`/student/assessments/${assessmentId}/results`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#323130] hover:bg-[#f8f9fa] border border-transparent hover:border-[#8a8886] rounded transition-colors"
        >
          <ChevronLeft size={13} />
          Back to Results
        </Link>
      </div>
      <div className="px-4 py-4 md:px-6 space-y-4 pb-12 max-w-[1280px]">

        {/* Header card */}
        <div className="bg-white border border-border rounded-sm p-6 space-y-5">
          <div>
            <h1 className="text-lg font-bold text-[#1e293b] leading-tight">{assessment.title}</h1>
            <p className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <BookOpen size={12} className="text-primary" strokeWidth={2} />
              {assessment.courseTitle}
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="text-[#1e293b]">{assessment.courseCode}</span>
            </p>
          </div>

          {/* Score summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-[#f1f5f9] pt-5">
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your Performance
              </p>
              {score != null ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[#1e293b] leading-none">{score}</span>
                  <span className="text-sm font-semibold text-slate-400 leading-none">/ {assessment.totalMarks}</span>
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-400 italic">Not yet scored</p>
              )}
            </div>

            <div className="flex flex-col justify-center gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Completion Pct</p>
              {scorePct !== null && score != null ? (
                <ScoreBar score={score} max={assessment.totalMarks} />
              ) : <div className="h-2 bg-slate-100 rounded-sm" />}
            </div>

            <div className="space-y-0.5 sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-right">
                Final Grade
              </p>
              <div className="flex sm:justify-end mt-1">
                {latestSubmitted.grade ? (
                  <div className="h-10 w-10 rounded-sm bg-primary flex items-center justify-center text-white text-lg font-bold">
                    {latestSubmitted.grade}
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-sm bg-slate-100 border border-border" />
                )}
              </div>
            </div>
          </div>

          {gradingDetail?.plagiarismFlagged && (
            <div className="flex items-center gap-3 rounded-sm border border-red-100 bg-red-50 p-4">
              <ShieldAlert size={16} className="text-red-600 shrink-0" strokeWidth={2} />
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Security Alert: Plagiarism Detected</p>
            </div>
          )}
        </div>

        {/* Questions by section */}
        {sections.map((section) => (
          <div key={section.id} className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#1e293b]">{section.name}</h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border border-border px-2 py-0.5 rounded-sm">{section.questions.length} Items</span>
            </div>

            <div className="grid gap-4">
              {section.questions.map((q, qi) => (
                <div key={q.id} className="bg-white border border-border rounded-sm p-5 space-y-4 transition-all hover:border-slate-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-sm bg-[#1e293b] text-white text-xs font-bold">
                        {qi + 1}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed pt-0.5">{q.body}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] font-bold text-[#1e293b] tabular-nums">{q.marks} Pts</p>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Weighting</p>
                    </div>
                  </div>

                  <div className="pl-0 sm:pl-9">
                    {section.type === "OBJECTIVE" ? (
                      <McqQuestion q={q} />
                    ) : (
                      <SubjectiveQuestion q={q} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {sections.every((s) => s.questions.length === 0) && (
          <div className="bg-white border border-[#edebe9] rounded p-16 text-center flex flex-col items-center gap-3">
            <AlertTriangle size={36} className="text-[#c8c6c4]" strokeWidth={2} />
            <p className="text-[13px] font-semibold text-[#8a8886] uppercase tracking-wider">Assessment data unavailable.</p>
          </div>
        )}
      </div>
    </div>
  )
}
