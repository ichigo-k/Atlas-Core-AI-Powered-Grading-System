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
    pct >= 70 ? "bg-[#23A559]" : pct >= 50 ? "bg-[#F0B132]" : pct >= 20 ? "bg-[#F97316]" : "bg-[#F23F42]"
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-black text-slate-900 tabular-nums w-10 text-right">
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
    <div className="space-y-4">
      <div className="grid gap-2">
        {options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrectOpt = correct === i
          let cls =
            "flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all w-full "
          if (isCorrectOpt)
            cls += "border-[#23A559]/20 bg-[#E6F4EA] text-[#23A559]"
          else if (isSelected && !isCorrectOpt)
            cls += "border-[#F23F42]/20 bg-[#FEE7E9] text-[#F23F42]"
          else cls += "border-slate-100 bg-slate-50 text-slate-600"

          return (
            <div key={i} className={cls}>
              <span className="shrink-0 font-black text-[10px] mt-0.5 w-5 h-5 flex items-center justify-center rounded bg-white/50 border border-current/10">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 leading-tight mt-0.5">{opt}</span>
              {isCorrectOpt && (
                <CheckCircle2 size={16} className="shrink-0 text-[#23A559]" strokeWidth={3} />
              )}
              {isSelected && !isCorrectOpt && (
                <XCircle size={16} className="shrink-0 text-[#F23F42]" strokeWidth={3} />
              )}
            </div>
          )
        })}
      </div>
      {selected === null && (
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic px-1">No answer selected</p>
      )}
      <div className="flex items-center gap-2 px-1 pt-1">
        {isCorrect ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#23A559]">
            <CheckCircle2 size={12} strokeWidth={3} /> Correct — {q.marks} Marks awarded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#F23F42]">
            <XCircle size={12} strokeWidth={3} /> Incorrect — 0 Marks awarded
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
          className="inline-flex items-center gap-2.5 rounded-xl border-2 border-discord-blurple/10 bg-discord-blurple/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-discord-blurple hover:bg-discord-blurple/10 transition-all shadow-sm"
        >
          <FileText size={16} strokeWidth={3} />
          View attachment
        </a>
      ) : q.answer?.answerText ? (
        <div className="rounded-2xl border-2 border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
          {q.answer.answerText}
        </div>
      ) : (
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic px-1">No answer provided</p>
      )}

      {/* AI feedback */}
      {fb ? (
        <div className="discord-card !bg-slate-50/30">
          {/* Score header */}
          <div className="flex items-center justify-between px-5 py-4 bg-slate-100/50 border-b border-slate-100">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <span className="text-xs font-black text-slate-900 uppercase tracking-widest shrink-0">
                {fb.totalScore} / {fb.maxScore} <span className="text-slate-400 font-bold ml-0.5">pts</span>
              </span>
              <div className="flex-1 min-w-0">
                <ScoreBar score={fb.totalScore} max={fb.maxScore} />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {fb.bedrockError && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFF4E5] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#F0B132] border border-[#F0B132]/20">
                  <Zap size={10} strokeWidth={3} /> AI ERROR
                </span>
              )}
              {fb.flag && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#FEE7E9] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#F23F42] border border-[#F23F42]/20">
                  <ShieldAlert size={10} strokeWidth={3} /> {fb.flag}
                </span>
              )}
              <ChevronDown size={16} className="text-slate-400" strokeWidth={2.5} />
            </div>
          </div>

          <div className="divide-y divide-slate-100/50">
            {/* Flag reason */}
            {fb.flagReason && (
              <div className="flex items-start gap-3 px-5 py-4 bg-[#FEE7E9]/40">
                <AlertTriangle size={14} className="shrink-0 text-[#F23F42] mt-0.5" strokeWidth={3} />
                <p className="text-xs font-bold text-[#F23F42] uppercase tracking-tight">{fb.flagReason}</p>
              </div>
            )}

            {/* Per-criterion breakdown */}
            {fb.criteriaFeedback.length > 0 ? (
              fb.criteriaFeedback.map((c, i) => (
                <div key={i} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em] flex-1">
                      {c.criterion}
                    </span>
                    <span className="text-[10px] font-black text-slate-500 shrink-0 tabular-nums bg-slate-100 px-2 py-0.5 rounded">
                      {c.awarded} / {c.max}
                    </span>
                  </div>
                  <ScoreBar score={c.awarded} max={c.max} />
                  {c.justification && (
                    <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
                      "{c.justification}"
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic text-center">Breakdown Unavailable</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-100 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic text-center">
          Awaiting AI Grading
        </div>
      )}

      {/* Lecturer notes */}
      {q.answer?.lecturerNotes && (
        <div className="discord-card !border-discord-blurple/20 !bg-discord-blurple/5">
          <div className="px-5 py-3 bg-discord-blurple/10 border-b border-discord-blurple/10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-discord-blurple">Lecturer Feedback</span>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap italic">
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
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Back nav */}
      <Link
        href={`/student/assessments/${assessmentId}`}
        className="group inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-discord-blurple transition-all"
      >
        <ChevronLeft size={16} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
        Back to Assessment
      </Link>

      {/* Header card */}
      <div className="discord-card p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight uppercase">{assessment.title}</h1>
          <p className="mt-3 flex items-center gap-2.5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <BookOpen size={16} className="text-discord-blurple" strokeWidth={2.5} />
            {assessment.courseTitle}
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
            {assessment.courseCode}
          </p>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 border-t border-slate-100 pt-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Your Performance
            </p>
            {score != null ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-slate-900 leading-none">{score}</span>
                <span className="text-xl font-bold text-slate-300 leading-none">/ {assessment.totalMarks}</span>
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-400 italic">Not yet scored</p>
            )}
          </div>

          <div className="flex flex-col justify-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Completion Pct</p>
            {scorePct !== null && score != null ? (
               <ScoreBar score={score} max={assessment.totalMarks} />
            ) : <div className="h-2 bg-slate-100 rounded-full" />}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">
              Final Grade
            </p>
            <div className="flex justify-end">
              {latestSubmitted.grade ? (
                <div className="h-14 w-14 rounded-2xl bg-discord-blurple flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-discord-blurple/20">
                  {latestSubmitted.grade}
                </div>
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-slate-100" />
              )}
            </div>
          </div>
        </div>

        {gradingDetail?.plagiarismFlagged && (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-[#F23F42]/20 bg-[#FEE7E9] p-4">
             <ShieldAlert size={24} className="text-[#F23F42]" strokeWidth={3} />
             <p className="text-xs font-black uppercase tracking-widest text-[#F23F42]">SECURITY ALERT: PLAGIARISM DETECTED</p>
          </div>
        )}
      </div>

      {/* Questions by section */}
      {sections.map((section) => (
        <div key={section.id} className="space-y-4">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">{section.name}</h2>
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">{section.questions.length} Items</span>
          </div>

          <div className="grid gap-6">
            {section.questions.map((q, qi) => (
              <div key={q.id} className="discord-card p-6 space-y-6 transition-all hover:border-slate-300">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white text-sm font-black shadow-lg shadow-black/10">
                      {qi + 1}
                    </span>
                    <p className="text-base font-bold text-slate-800 leading-relaxed pt-0.5">{q.body}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-slate-900 tabular-nums">{q.marks} Pts</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weighting</p>
                  </div>
                </div>

                <div className="pl-0 sm:pl-12 border-l-4 border-slate-100 sm:border-l-0">
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
        <div className="discord-card p-16 text-center">
           <AlertTriangle size={48} className="text-slate-200 mx-auto mb-4" strokeWidth={3} />
           <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Assessment data unavailable.</p>
        </div>
      )}
    </div>
  )
}
