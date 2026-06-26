"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2, XCircle, AlertTriangle, FileText, ShieldAlert,
  Zap, ChevronDown, ChevronUp, Pencil, MessageSquare, RefreshCw,
  Star, SlidersHorizontal, ChevronLeft, ChevronRight, Layers, Award,
  Clock, Calendar, Eye,
} from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type CriterionFeedback = {
  criterion: string
  awarded: number
  max: number
  justification: string
}

export type QuestionDetail = {
  id: number
  order: number
  body: string
  marks: number
  sectionName: string
  sectionType: string
  answerType: string | null
  options: unknown
  correctOption: number | null
  rubricCriteria: { description: string; maxMarks: number; order: number }[]
  answer: {
    answerText: string | null
    selectedOption: number | null
    fileUrl: string | null
  } | null
  lecturerNotes: string | null
  lecturerAdjustedScore: number | null
  lecturerAdjustReason: string | null
  feedback: {
    totalScore: number
    maxScore: number
    flag: string
    flagReason: string
    bedrockError: boolean
    criteriaFeedback: CriterionFeedback[]
  } | null
}

export type AttemptSummary = {
  attemptId: number
  attemptNumber: number
  score: number | null
  submittedAt: string | null
  isHighest: boolean
}

export type AttemptDetail = {
  attemptId: number
  attemptNumber: number
  status: string
  score: number | null
  totalMarks: number
  startedAt: string
  submittedAt: string | null
  student: { name: string | null; email: string }
  plagiarismFlagged: boolean
  gradedAt: string | null
  errorNotes: string
  questions: QuestionDetail[]
  allAttempts: AttemptSummary[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const color =
    pct >= 70 ? "bg-[#22c55e]" : pct >= 50 ? "bg-amber-400" : pct >= 20 ? "bg-orange-400" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  )
}

export { ScoreBar }

function scoreColor(pct: number): string {
  if (pct >= 70) return "#22c55e"
  if (pct >= 50) return "#f59e0b"
  if (pct >= 20) return "#f97316"
  return "#ef4444"
}

function scoreColorClass(pct: number): string {
  if (pct >= 70) return "text-green-600"
  if (pct >= 50) return "text-amber-600"
  return "text-red-600"
}

// ─── Notes panel (shared MCQ + Subjective) ────────────────────────────────────

function NotesPanel({ q, assessmentId, attemptId }: { q: QuestionDetail; assessmentId: number; attemptId: number }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(q.lecturerNotes ?? "")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/lecturer/assessments/${assessmentId}/attempts/${attemptId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: q.id, lecturerNotes: value }),
        },
      )
      if (!res.ok) throw new Error()
      toast.success("Note saved")
      setEditing(false)
      router.refresh()
    } catch {
      toast.error("Failed to save note")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-sm border border-[#dce6f7] bg-[#f0f4fb] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#dce6f7]">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase tracking-[0.05em]">
          <MessageSquare size={11} /> Lecturer Note
        </span>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 h-6 px-2.5 rounded-sm border border-[#b8cef0] bg-white text-[11px] font-semibold text-primary hover:bg-[#dce6f7] transition-colors"
          >
            <Pencil size={10} /> {q.lecturerNotes ? "Edit" : "Add note"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="p-3 space-y-2.5">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Write your feedback for this answer…"
            rows={3}
            className="w-full rounded-sm border border-border bg-white px-3 py-2 text-[13px] text-[#1e293b] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setEditing(false); setValue(q.lecturerNotes ?? "") }}
              disabled={saving}
              className="h-7 px-3 rounded-sm border border-border bg-white text-[11px] font-semibold text-muted-foreground hover:bg-[#f3f2f1] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="h-7 px-3 rounded-sm bg-primary text-[11px] font-semibold text-white hover:bg-[#001570] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          {q.lecturerNotes ? (
            <p className="text-[12px] text-[#1e293b] whitespace-pre-wrap leading-relaxed">{q.lecturerNotes}</p>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">No note added yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Per-question Grade Adjustment ───────────────────────────────────────────

function QuestionAdjustPanel({
  q,
  assessmentId,
  attemptId,
}: {
  q: QuestionDetail
  assessmentId: number
  attemptId: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState(
    q.lecturerAdjustedScore !== null ? String(q.lecturerAdjustedScore) : ""
  )
  const [reason, setReason] = useState(q.lecturerAdjustReason ?? "")
  const [isPending, startSave] = useTransition()

  function handleSave() {
    const parsed = parseFloat(score)
    if (isNaN(parsed) || parsed < 0 || parsed > q.marks) {
      toast.error(`Score must be between 0 and ${q.marks}`)
      return
    }
    if (reason.trim().length < 3) {
      toast.error("Please provide a reason for the adjustment")
      return
    }
    startSave(async () => {
      const res = await fetch(
        `/api/lecturer/assessments/${assessmentId}/attempts/${attemptId}/adjust-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: q.id, adjustedScore: parsed, reason: reason.trim() }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error === "SCORE_EXCEEDS_MAX" ? `Max score for this question is ${q.marks}` : "Failed to save adjustment")
        return
      }
      toast.success("Score adjusted — total updated")
      setOpen(false)
      router.refresh()
    })
  }

  const hasAdjustment = q.lecturerAdjustedScore !== null

  return (
    <div className="rounded-sm border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#fafaf9] hover:bg-[#f3f2f1] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={11} className={hasAdjustment ? "text-primary" : "text-muted-foreground"} />
          <span className={`text-[11px] font-semibold ${hasAdjustment ? "text-primary" : "text-muted-foreground"}`}>
            Score Adjustment
          </span>
          {hasAdjustment && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#dce6f7] border border-[#b8cef0] text-[10px] font-bold text-primary tabular-nums">
              {q.lecturerAdjustedScore} / {q.marks} marks (adjusted)
            </span>
          )}
        </div>
        {open ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3.5 space-y-3 bg-white">
          {hasAdjustment && q.lecturerAdjustReason && (
            <div className="rounded-sm border border-[#b8cef0] bg-[#dce6f7]/40 px-3 py-2.5 space-y-0.5">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-[0.05em]">Current override</p>
              <p className="text-[13px] font-bold text-[#1e293b] tabular-nums">{q.lecturerAdjustedScore} / {q.marks}</p>
              <p className="text-[11px] text-muted-foreground italic">"{q.lecturerAdjustReason}"</p>
            </div>
          )}
          <div className="flex gap-3">
            <div className="w-28 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                New score <span className="text-muted-foreground/60">(max {q.marks})</span>
              </label>
              <input
                type="number"
                min={0}
                max={q.marks}
                step={0.5}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder={`0–${q.marks}`}
                className="w-full h-8 rounded-sm border border-border bg-white px-2.5 text-[13px] text-[#1e293b] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Reason <span className="text-red-500">*</span>
                <span className="text-muted-foreground/60 font-normal ml-1">— shown to student</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you overriding this score?"
                rows={2}
                className="w-full rounded-sm border border-border bg-white px-2.5 py-1.5 text-[13px] text-[#1e293b] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setOpen(false); setScore(q.lecturerAdjustedScore !== null ? String(q.lecturerAdjustedScore) : ""); setReason(q.lecturerAdjustReason ?? "") }}
              className="h-7 px-3 rounded-sm border border-border bg-white text-[11px] font-semibold text-muted-foreground hover:bg-[#f3f2f1] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="h-7 px-3 rounded-sm bg-primary text-[11px] font-semibold text-white hover:bg-[#001570] disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save Override"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MCQ Question (for sheet detail) ──────────────────────────────────────────

function McqQuestion({ q, assessmentId, attemptId }: { q: QuestionDetail; assessmentId: number; attemptId: number }) {
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
          let cls = "flex items-start gap-2.5 rounded-sm border px-3 py-2.5 text-[13px] transition-colors"
          if (isCorrectOpt) cls += " border-[#bbf7d0] bg-[#dcfce7] text-[#166534]"
          else if (isSelected && !isCorrectOpt) cls += " border-[#fecaca] bg-[#fee2e2] text-[#991b1b]"
          else cls += " border-border bg-[#f3f2f1] text-[#475569]"
          return (
            <div key={i} className={cls}>
              <span className="shrink-0 font-bold text-[11px] mt-0.5 w-4 tabular-nums">
                {String.fromCharCode(65 + i)}.
              </span>
              <span className="flex-1 leading-relaxed">{opt}</span>
              {isCorrectOpt && <CheckCircle2 size={14} className="shrink-0 text-[#22c55e] mt-0.5" />}
              {isSelected && !isCorrectOpt && <XCircle size={14} className="shrink-0 text-red-500 mt-0.5" />}
            </div>
          )
        })}
      </div>
      {selected === null && (
        <p className="text-[12px] text-muted-foreground italic">No answer selected</p>
      )}
      <div className="flex items-center gap-2">
        {isCorrect ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#166534]">
            <CheckCircle2 size={13} className="text-[#22c55e]" /> Correct — {q.marks} / {q.marks} marks
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#991b1b]">
            <XCircle size={13} className="text-red-500" /> Incorrect — 0 / {q.marks} marks
          </span>
        )}
      </div>
      <NotesPanel q={q} assessmentId={assessmentId} attemptId={attemptId} />
      <QuestionAdjustPanel q={q} assessmentId={assessmentId} attemptId={attemptId} />
    </div>
  )
}

// ─── Subjective Question (for sheet detail) ───────────────────────────────────

function SubjectiveQuestion({ q, assessmentId, attemptId }: { q: QuestionDetail; assessmentId: number; attemptId: number }) {
  const [expanded, setExpanded] = useState(true)
  const fb = q.feedback

  return (
    <div className="space-y-3">
      {/* Student answer */}
      {q.answer?.fileUrl ? (
        <a
          href={q.answer.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-sm border border-[#b8cef0] bg-[#dce6f7] px-3 py-2 text-[13px] font-medium text-primary hover:bg-[#c8dcf5] transition-colors"
        >
          <FileText size={13} /> View submitted file
        </a>
      ) : q.answer?.answerText ? (
        <div className="rounded-sm border border-border bg-[#f3f2f1] px-4 py-3 text-[13px] text-[#1e293b] leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
          {q.answer.answerText}
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground italic">No answer provided</p>
      )}

      {/* AI feedback */}
      {fb ? (
        <div className="rounded-sm border border-border overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 bg-[#f3f2f1] cursor-pointer select-none"
            onClick={() => setExpanded((v) => !v)}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-[#1e293b] shrink-0">
                {fb.totalScore} / {fb.maxScore}
                <span className="text-[11px] font-normal text-muted-foreground ml-1">marks (AI)</span>
              </span>
              <div className="flex-1 min-w-0">
                <ScoreBar score={fb.totalScore} max={fb.maxScore} />
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {fb.bedrockError && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Zap size={9} /> AI error
                </span>
              )}
              {fb.flag && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[#fecaca] bg-[#fee2e2] px-2 py-0.5 text-[10px] font-semibold text-[#991b1b]">
                  <ShieldAlert size={9} /> {fb.flag}
                </span>
              )}
              {expanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
            </div>
          </div>
          {expanded && (
            <div className="divide-y divide-[#f1f5f9]">
              {fb.flagReason && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-[#fee2e2]">
                  <AlertTriangle size={13} className="shrink-0 text-red-500 mt-0.5" />
                  <p className="text-[12px] text-[#991b1b]">{fb.flagReason}</p>
                </div>
              )}
              {fb.criteriaFeedback.length > 0 ? (
                fb.criteriaFeedback.map((c, i) => (
                  <div key={i} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] font-semibold text-[#1e293b] flex-1">{c.criterion}</span>
                      <span className="text-[12px] font-semibold text-[#1e293b] shrink-0 tabular-nums">
                        {c.awarded} / {c.max}
                      </span>
                    </div>
                    <ScoreBar score={c.awarded} max={c.max} />
                    {c.justification && (
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{c.justification}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-4 py-3">
                  <p className="text-[12px] text-muted-foreground italic">No criterion breakdown available.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-border px-4 py-3 text-[12px] text-muted-foreground italic bg-[#f3f2f1]">
          Not yet graded by AI
        </div>
      )}

      <NotesPanel q={q} assessmentId={assessmentId} attemptId={attemptId} />
      <QuestionAdjustPanel q={q} assessmentId={assessmentId} attemptId={attemptId} />
    </div>
  )
}

// ─── Question Detail Sheet ────────────────────────────────────────────────────

function QuestionDetailSheet({
  question,
  questionIndex,
  assessmentId,
  attemptId,
  open,
  onOpenChange,
  onNavigate,
  totalInSection,
}: {
  question: QuestionDetail
  questionIndex: number
  assessmentId: number
  attemptId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (direction: "prev" | "next") => void
  totalInSection: number
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!w-full !max-w-[600px] sm:!max-w-[600px] overflow-y-auto p-0">
        <SheetHeader className="px-5 py-4 border-b border-border bg-[#fafaf9] sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-white text-[11px] font-bold">
                {questionIndex + 1}
              </span>
              <div className="min-w-0">
                <SheetTitle className="text-[14px] font-semibold text-[#1e293b] truncate">
                  Question {questionIndex + 1}
                </SheetTitle>
                <SheetDescription className="text-[11px] text-muted-foreground mt-0.5">
                  {question.sectionName} · {question.marks} mark{question.marks !== 1 ? "s" : ""} · {question.sectionType === "OBJECTIVE" ? "MCQ" : "Subjective"}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onNavigate("prev")}
                disabled={questionIndex === 0}
                className="h-7 w-7 flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:bg-[#f3f2f1] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums px-1">
                {questionIndex + 1}/{totalInSection}
              </span>
              <button
                onClick={() => onNavigate("next")}
                disabled={questionIndex >= totalInSection - 1}
                className="h-7 w-7 flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:bg-[#f3f2f1] disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </SheetHeader>

        <div className="px-5 py-5 space-y-4">
          {/* Question body */}
          <div className="rounded-sm border border-border bg-[#fafaf9] px-4 py-3">
            <p className="text-[13px] font-medium text-[#1e293b] leading-relaxed">{question.body}</p>
          </div>

          {/* Rubric criteria (if any) */}
          {question.rubricCriteria.length > 0 && (
            <details className="group">
              <summary className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.05em] cursor-pointer hover:text-[#1e293b] transition-colors list-none flex items-center gap-1.5">
                <ChevronRight size={11} className="transition-transform group-open:rotate-90" />
                Rubric Criteria ({question.rubricCriteria.length})
              </summary>
              <div className="mt-2 space-y-1.5 pl-4">
                {question.rubricCriteria.map((rc, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>{rc.description}</span>
                    <span className="font-semibold tabular-nums text-[#1e293b]">{rc.maxMarks}m</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Answer + feedback */}
          {question.sectionType === "OBJECTIVE" ? (
            <McqQuestion q={question} assessmentId={assessmentId} attemptId={attemptId} />
          ) : (
            <SubjectiveQuestion q={question} assessmentId={assessmentId} attemptId={attemptId} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Re-grade button ──────────────────────────────────────────────────────────

function RegradeButton({ assessmentId, attemptId }: { assessmentId: number; attemptId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRegrade() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/lecturer/assessments/${assessmentId}/attempts/${attemptId}/regrade`,
        { method: "POST" },
      )
      if (res.status === 429) {
        const body = await res.json()
        toast.error(`Rate limited. Try again in ${body.retryAfterSeconds}s.`)
        return
      }
      if (!res.ok) { toast.error("Re-grading failed."); return }
      toast.success("Re-grading complete.")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRegrade}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border bg-white text-[12px] font-semibold text-muted-foreground hover:bg-[#f3f2f1] disabled:opacity-50 transition-colors"
    >
      <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
      {loading ? "Re-grading…" : "Re-grade AI"}
    </button>
  )
}

// ─── Attempt Switcher ─────────────────────────────────────────────────────────

function AttemptSwitcher({
  attempts,
  current,
  assessmentId,
}: {
  attempts: AttemptSummary[]
  current: number
  assessmentId: number
}) {
  const router = useRouter()
  if (attempts.length <= 1) return null

  return (
    <div className="flex items-center gap-2 rounded-sm border border-border bg-white px-4 py-2.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.05em] mr-1">Attempt</span>
      {attempts.map((a: any) => {
        const isCurrent = a.attemptId === current
        return (
          <button
            key={a.attemptId}
            onClick={() => router.push(`/lecturer/assessments/${assessmentId}/results/attempts/${a.attemptId}`)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-[11px] font-semibold transition-colors ${isCurrent
              ? "bg-[#dce6f7] border border-[#b8cef0] text-primary"
              : "border border-border text-muted-foreground hover:bg-[#f3f2f1]"
              }`}
          >
            #{a.attemptNumber}
            {a.isHighest && (
              <Star size={9} className={isCurrent ? "text-primary" : "text-amber-400"} fill="currentColor" />
            )}
            {a.score !== null && (
              <span className="tabular-nums">{a.score}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main exported view (AWS-style: overview first, detail in sheet) ──────────

export function AttemptDetailView({
  detail,
  assessmentId,
}: {
  detail: AttemptDetail
  assessmentId: number
}) {
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionDetail | null>(null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [selectedSectionQuestions, setSelectedSectionQuestions] = useState<QuestionDetail[]>([])

  const scoreDisplay =
    detail.score !== null ? `${detail.score} / ${detail.totalMarks}` : `— / ${detail.totalMarks}`
  const pct =
    detail.score !== null && detail.totalMarks > 0
      ? Math.round((detail.score / detail.totalMarks) * 100)
      : null

  const overrideCount = detail.questions.filter((q: any) => q.lecturerAdjustedScore !== null).length
  const flaggedCount = detail.questions.filter((q: any) => q.feedback?.flag).length

  const submittedDate = detail.submittedAt
    ? new Date(detail.submittedAt).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
    : "Not submitted"

  // Build sections
  const sections: { name: string; type: string; questions: QuestionDetail[] }[] = []
  const seen = new Map<string, QuestionDetail[]>()
  for (const q of detail.questions) {
    if (!seen.has(q.sectionName)) {
      const arr: QuestionDetail[] = []
      seen.set(q.sectionName, arr)
      sections.push({ name: q.sectionName, type: q.sectionType, questions: arr })
    }
    seen.get(q.sectionName)!.push(q)
  }

  // Section performance
  const sectionPerformance = sections.map((section: any) => {
    let earned = 0
    let possible = 0
    let answered = 0

    for (const q of section.questions) {
      possible += q.marks
      if (section.type === "OBJECTIVE") {
        if (q.answer?.selectedOption != null) {
          answered++
          if (q.answer.selectedOption === q.correctOption) earned += q.marks
        }
      } else {
        if (q.lecturerAdjustedScore !== null) {
          answered++
          earned += q.lecturerAdjustedScore
        } else if (q.feedback) {
          answered++
          earned += q.feedback.totalScore
        }
      }
    }
    const sectionPct = possible > 0 ? Math.round((earned / possible) * 100) : 0
    return { ...section, earned, possible, answered, pct: sectionPct }
  })

  function openQuestion(sectionQuestions: QuestionDetail[], index: number) {
    setSelectedSectionQuestions(sectionQuestions)
    setSelectedQuestionIndex(index)
    setSelectedQuestion(sectionQuestions[index])
  }

  function handleNavigate(direction: "prev" | "next") {
    const newIndex = direction === "prev" ? selectedQuestionIndex - 1 : selectedQuestionIndex + 1
    if (newIndex >= 0 && newIndex < selectedSectionQuestions.length) {
      setSelectedQuestionIndex(newIndex)
      setSelectedQuestion(selectedSectionQuestions[newIndex])
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[900px] space-y-5 pb-16">
      {/* Attempt switcher */}
      <AttemptSwitcher attempts={detail.allAttempts} current={detail.attemptId} assessmentId={assessmentId} />

      {/* ── Score Overview Card ── */}
      <div className="rounded-sm border border-border bg-white overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
        <div className={`h-[3px] w-full ${pct !== null ? (pct >= 70 ? "bg-[#22c55e]" : pct >= 50 ? "bg-amber-400" : "bg-red-400") : "bg-[#94a3b8]"}`} />
        <div className="px-5 py-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
                Attempt #{detail.attemptNumber}
                {detail.allAttempts.find((a: any) => a.attemptId === detail.attemptId)?.isHighest && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-amber-500">
                    <Star size={9} fill="currentColor" /> Highest
                  </span>
                )}
              </p>
              <h1 className="text-[18px] font-bold text-[#1e293b]">
                {detail.student.name ?? detail.student.email}
              </h1>
              <p className="text-[12px] text-muted-foreground mt-0.5">{detail.student.email}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {detail.plagiarismFlagged && (
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#fecaca] bg-[#fee2e2] px-2.5 py-1 text-[11px] font-semibold text-[#991b1b]">
                  <ShieldAlert size={12} /> Plagiarism
                </span>
              )}
              <RegradeButton assessmentId={assessmentId} attemptId={detail.attemptId} />
            </div>
          </div>

          {/* Score + metadata grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 border-t border-[#f1f5f9] pt-5">
            {/* Score with circular indicator */}
            <div className="flex items-center gap-4">
              {(() => {
                const r = 26, c = 2 * Math.PI * r
                const col = pct !== null ? scoreColor(pct) : "#94a3b8"
                return (
                  <div className="relative h-16 w-16 flex-shrink-0">
                    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
                      <circle cx="32" cy="32" r={r} fill="none" stroke="#eef0f3" strokeWidth="6" />
                      <circle
                        cx="32" cy="32" r={r} fill="none" stroke={col} strokeWidth="6"
                        strokeLinecap="round" strokeDasharray={c}
                        strokeDashoffset={c * (1 - (pct ?? 0) / 100)}
                      />
                    </svg>
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[14px] font-bold tabular-nums"
                      style={{ color: col }}
                    >
                      {pct !== null ? `${pct}%` : "–"}
                    </span>
                  </div>
                )
              })()}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Score</p>
                <p className="text-[18px] font-bold text-[#1e293b] tabular-nums mt-0.5">{scoreDisplay}</p>
                {overrideCount > 0 && (
                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-sm bg-[#dce6f7] border border-[#b8cef0] text-[10px] font-semibold text-primary">
                    {overrideCount} override{overrideCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Status info */}
            <div className="flex flex-col justify-center gap-2">
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-muted-foreground" />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Submitted</p>
                  <p className="text-[12px] font-semibold text-[#1e293b]">{submittedDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-muted-foreground" />
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className="text-[12px] font-semibold text-[#1e293b] capitalize">
                    {detail.status.toLowerCase().replace("_", " ")}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-col justify-center gap-2">
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-muted-foreground" />
                <span className="text-[12px] text-[#1e293b]">
                  <span className="font-semibold">{detail.questions.length}</span> questions
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Layers size={12} className="text-muted-foreground" />
                <span className="text-[12px] text-[#1e293b]">
                  <span className="font-semibold">{sections.length}</span> section{sections.length !== 1 ? "s" : ""}
                </span>
              </div>
              {flaggedCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="text-[12px] text-red-600 font-semibold">{flaggedCount} flagged</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Grader error */}
        {detail.errorNotes && (
          <div className="mx-5 mb-4 flex items-start gap-2.5 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={13} className="shrink-0 text-amber-600 mt-0.5" />
            <p className="text-[12px] text-amber-800">{detail.errorNotes}</p>
          </div>
        )}
      </div>

      {/* ── Section Performance Overview ── */}
      <div className="rounded-sm border border-border bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-[#fafaf9]">
          <Layers size={14} className="text-primary" />
          <span className="text-[13px] font-semibold text-[#1e293b]">Section Performance</span>
        </div>
        <div className="divide-y divide-[#f1f5f9]">
          {sectionPerformance.map((section: any) => (
            <div key={section.name} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#1e293b]">{section.name}</span>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-sm ${section.type === "OBJECTIVE"
                        ? "bg-[#dbeafe] text-[#1e40af]"
                        : "bg-[#f3e8ff] text-[#6b21a8]"
                      }`}
                  >
                    {section.type === "OBJECTIVE" ? "MCQ" : "SUB"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {section.answered}/{section.questions.length} answered
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 max-w-[200px] h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${section.pct}%`, background: scoreColor(section.pct) }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{section.pct}%</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-bold tabular-nums" style={{ color: scoreColor(section.pct) }}>
                  {section.earned}/{section.possible}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Questions List (click to open sheet) ── */}
      {sections.map((section, sIdx) => (
        <div key={section.name} className="rounded-sm border border-border bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-[#fafaf9]">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary text-white text-[10px] font-bold">
                {sIdx + 1}
              </span>
              <span className="text-[13px] font-semibold text-[#1e293b]">{section.name}</span>
              <span className={`text-[9px] font-bold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-sm ${section.type === "OBJECTIVE"
                  ? "bg-[#dbeafe] text-[#1e40af]"
                  : "bg-[#f3e8ff] text-[#6b21a8]"
                }`}>
                {section.type === "OBJECTIVE" ? "MCQ" : "SUB"}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {section.questions.length} question{section.questions.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="divide-y divide-[#f1f5f9]">
            {section.questions.map((q, qIdx) => {
              // Compute question score
              let qScore: number | null = null
              if (q.lecturerAdjustedScore !== null) {
                qScore = q.lecturerAdjustedScore
              } else if (section.type === "OBJECTIVE") {
                qScore = (q.answer?.selectedOption != null && q.answer.selectedOption === q.correctOption) ? q.marks : 0
              } else if (q.feedback) {
                qScore = q.feedback.totalScore
              }

              const qPct = q.marks > 0 && qScore !== null ? Math.round((qScore / q.marks) * 100) : null
              const hasNote = !!q.lecturerNotes
              const hasAdjust = q.lecturerAdjustedScore !== null
              const hasFlag = !!q.feedback?.flag

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => openQuestion(section.questions, qIdx)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#f8f9fa] transition-colors text-left group"
                >
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-sm bg-[#e2e8f0] text-[10px] font-bold text-[#475569] group-hover:bg-primary group-hover:text-white transition-colors">
                    {qIdx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#1e293b] truncate leading-tight">{q.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {hasNote && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary">
                          <MessageSquare size={9} /> Note
                        </span>
                      )}
                      {hasAdjust && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary">
                          <SlidersHorizontal size={9} /> Adjusted
                        </span>
                      )}
                      {hasFlag && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-red-600">
                          <ShieldAlert size={9} /> {q.feedback!.flag}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {qScore !== null ? (
                      <span className={`text-[12px] font-bold tabular-nums ${scoreColorClass(qPct ?? 0)}`}>
                        {qScore}/{q.marks}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">–/{q.marks}</span>
                    )}
                    <Eye size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Question detail sheet */}
      {selectedQuestion && (
        <QuestionDetailSheet
          question={selectedQuestion}
          questionIndex={selectedQuestionIndex}
          assessmentId={assessmentId}
          attemptId={detail.attemptId}
          open={!!selectedQuestion}
          onOpenChange={(open) => { if (!open) setSelectedQuestion(null) }}
          onNavigate={handleNavigate}
          totalInSection={selectedSectionQuestions.length}
        />
      )}
    </div>
  )
}

// Keep legacy named exports for backward compat
export { McqQuestion, SubjectiveQuestion }
