"use client"

import { useState, useTransition, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { submitAttempt } from "@/lib/assessment-actions"
import type { SerializedActiveAttempt, SerializedAssessmentDetail, ProctorSession } from "./page"
import LockdownOverlay from "@/components/student/LockdownOverlay"
import type { LockdownOverlayHandle } from "@/components/student/LockdownOverlay"
import AntiCheatGuard from "@/components/student/AntiCheatGuard"
import FlagOverlay from "@/components/student/FlagOverlay"
import type { ViolationReason } from "@/lib/violation-tracker"
import { MAX_VIOLATIONS } from "@/lib/violation-tracker"
import { useViolationStore } from "@/lib/violation-store"
import QuestionRenderer from "@/components/student/QuestionRenderer"
import CountdownTimer from "@/components/student/CountdownTimer"
import ProctorCamera from "@/components/student/ProctorCamera"
import ProctorAudio from "@/components/student/ProctorAudio"
import {
  CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
  Send, X, BookOpen, Clock, Layers, ListChecks, Video,
  Menu, PanelLeft,
} from "lucide-react"
import { getProctorFlagCount } from "@/lib/proctor-actions"

// Single overlay subscribed to the Zustand store — renders for all violation types
function ViolationOverlay({ assessmentId }: { assessmentId: number }) {
  const { activeEvent, terminated, finalWarning, dismissEvent, terminate } = useViolationStore()

  function handleFinalRedirect() {
    terminate()
    window.location.href = `/student/assessments/${assessmentId}`
  }

  return (
    <FlagOverlay
      event={activeEvent}
      terminated={terminated}
      finalWarning={finalWarning}
      onDismiss={dismissEvent}
      onReturnFullscreen={() => {
        document.documentElement.requestFullscreen()
          .then(() => dismissEvent())
          .catch(() => {})
      }}
      onFinalRedirect={handleFinalRedirect}
    />
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AttemptShellProps = {
  attempt: SerializedActiveAttempt
  assessment: SerializedAssessmentDetail
  assessmentId: number
  proctorSession: ProctorSession
  simulation?: boolean
  simulationReturnUrl?: string
}

export type SectionWithProgress = {
  id: number
  name: string
  type: string
  requiredQuestionsCount: number | null
  questions: { id: number; order: number; body: string; marks: number; answerType: string | null; options: unknown }[]
  groups?: {
    id: number
    order: number
    context: string | null
    totalMarks: number
    questions: { id: number; order: number; body: string; marks: number; answerType: string | null; options: unknown }[]
  }[]
  totalQuestionCount: number
  requiredCount: number
  answeredCount: number
}

export type QuestionWithAnswer = {
  id: number; order: number; body: string; marks: number
  answerType: string | null; options: unknown; sectionType: string
  existingAnswer: { answerText: string | null; selectedOption: number | null; fileUrl: string | null } | null
}

type AnswerMap = Map<number, { answerText: string | null; selectedOption: number | null; fileUrl: string | null }>

// ─── Shuffle helpers ──────────────────────────────────────────────────────────

// Reorder questions within each section according to the saved questionOrder array.
// questionOrder is stored as [{ questionId: number }, ...] in the attempt.
function applyQuestionOrder(
  sections: SerializedAssessmentDetail["sections"],
  questionOrder: unknown,
): SerializedAssessmentDetail["sections"] {
  if (!Array.isArray(questionOrder) || questionOrder.length === 0) return sections

  // Build a position map: questionId → position in the saved order
  const posMap = new Map<number, number>()
  for (let i = 0; i < questionOrder.length; i++) {
    const entry = questionOrder[i]
    if (entry && typeof entry === "object" && "questionId" in entry) {
      posMap.set(Number((entry as { questionId: number }).questionId), i)
    }
  }

  if (posMap.size === 0) return sections

  return sections.map((section: any) => ({
    ...section,
    questions: [...section.questions].sort((a, b) => {
      const pa = posMap.has(a.id) ? posMap.get(a.id)! : Infinity
      const pb = posMap.has(b.id) ? posMap.get(b.id)! : Infinity
      return pa - pb
    }),
  }))
}

// Deterministic Fisher-Yates shuffle seeded by a number.
// Returns a shuffled array of option indices [0, 1, 2, ...] for a question.
function seededOptionShuffle(questionId: number, optionCount: number): number[] {
  const indices = Array.from({ length: optionCount }, (_, i) => i)
  // Simple LCG seeded by questionId
  let seed = questionId
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0x100000000
  }
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices
}

// Build a map of questionId → shuffled option indices for all objective questions.
function buildOptionShuffleMap(
  sections: SerializedAssessmentDetail["sections"],
): Map<number, number[]> {
  const map = new Map<number, number[]>()
  for (const section of sections) {
    if (section.type !== "OBJECTIVE") continue
    for (const q of allSectionQuestions(section)) {
      const opts = Array.isArray(q.options) ? q.options : []
      if (opts.length > 1) {
        map.set(q.id, seededOptionShuffle(q.id, opts.length))
      }
    }
  }
  return map
}

// ─── Group / page helpers ───────────────────────────────────────────────────────

type SectionQuestion = SerializedAssessmentDetail["sections"][number]["questions"][number]

// Every answerable question in a section — standalone questions plus all grouped
// sub-questions. Used for progress counting and scoring-adjacent logic.
function allSectionQuestions(section: SerializedAssessmentDetail["sections"][number]): SectionQuestion[] {
  const grouped = (section.groups ?? []).flatMap((g) => g.questions)
  return [...section.questions, ...grouped]
}

// A "page" is one navigable screen: either a single standalone question, or a
// whole group (shared context + all its sub-questions stacked on one page).
export type ExamPage =
  | { key: string; kind: "single"; question: SectionQuestion }
  | {
      key: string
      kind: "group"
      groupId: number
      context: string | null
      totalMarks: number
      questions: SectionQuestion[]
    }

// All answerable question ids on a page (one for a single, many for a group).
function pageIdsOf(p: ExamPage): number[] {
  return p.kind === "single" ? [p.question.id] : p.questions.map((q) => q.id)
}

// Build the ordered list of pages for a section: standalone questions first
// (each its own page), then each group as a single multi-question page.
function buildSectionPages(section: SerializedAssessmentDetail["sections"][number]): ExamPage[] {
  const pages: ExamPage[] = []
  for (const q of section.questions) {
    pages.push({ key: `q${q.id}`, kind: "single", question: q })
  }
  for (const g of section.groups ?? []) {
    pages.push({
      key: `g${g.id}`,
      kind: "group",
      groupId: g.id,
      context: g.context,
      totalMarks: g.totalMarks,
      questions: g.questions,
    })
  }
  return pages
}

// ─── Question Selection Screen ────────────────────────────────────────────────
// Shown when a section requires fewer units than it has. A "unit" is one
// standalone question OR one whole group. The student picks exactly N units.

function QuestionSelectionScreen({
  sectionName,
  pages,
  required,
  selectedKeys,
  isReselecting,
  onToggle,
  onConfirm,
}: {
  sectionName: string
  pages: ExamPage[]
  required: number
  selectedKeys: Set<string>
  isReselecting?: boolean
  onToggle: (key: string) => void
  onConfirm: () => void
}) {
  const count = selectedKeys.size
  const ready = count === required

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-16 py-6 lg:py-10">
      {/* Instruction banner */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9ca3af] mb-1">
          {sectionName}
        </p>
        <h2 className="text-[20px] font-semibold text-[#111827] mb-1" style={{ fontFamily: "var(--font-sans,'Poppins',sans-serif)" }}>
          {isReselecting ? "Change your selection" : "Choose what to answer"}
        </h2>
        <p className="text-[14px] text-[#6b7280]" style={{ fontFamily: "var(--font-sans,'Poppins',sans-serif)" }}>
          Select exactly <strong className="text-[#111827]">{required}</strong> of the {pages.length} below.
          {pages.some((p) => p.kind === "group") && " A group counts as one — picking it includes all its parts."}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 w-48 rounded-full bg-[#f3f4f6] overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all ${ready ? "bg-[#16a34a]" : "bg-[#002388]"}`}
              style={{ width: `${(count / required) * 100}%` }}
            />
          </div>
          <span className={`text-[12px] font-semibold ${ready ? "text-[#16a34a]" : "text-[#374151]"}`}>
            {count} / {required} selected
          </span>
        </div>
      </div>

      {/* Unit list */}
      <div className="flex flex-col divide-y divide-[#f3f4f6]">
        {pages.map((p, idx) => {
          const checked = selectedKeys.has(p.key)
          const disabled = !checked && count >= required
          const isGroup = p.kind === "group"
          const marks = isGroup ? p.totalMarks : p.question.marks
          const body = isGroup
            ? (p.context?.trim() || `Group of ${p.questions.length} sub-questions`)
            : p.question.body
          return (
            <label
              key={p.key}
              className={[
                "flex items-start gap-4 py-4 cursor-pointer transition-colors",
                disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#fafafa]",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => !disabled && onToggle(p.key)}
                className="sr-only"
              />
              {/* Custom checkbox */}
              <div className={[
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                checked
                  ? "border-[#002388] bg-[#002388]"
                  : "border-[#d1d5db] bg-white",
              ].join(" ")}>
                {checked && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#9ca3af]">
                    {isGroup ? `Group ${idx + 1}` : `Q${idx + 1}`}
                  </span>
                  {isGroup && (
                    <span className="text-[11px] text-[#9ca3af]">{p.questions.length} {p.questions.length === 1 ? "part" : "parts"}</span>
                  )}
                  <span className="text-[11px] text-[#9ca3af]">{marks} {marks === 1 ? "mark" : "marks"}</span>
                </div>
                <p className="mt-0.5 text-[15px] text-[#374151] leading-relaxed line-clamp-3" style={{ fontFamily: "'Georgia','Times New Roman',serif" }}>
                  {body}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      {/* Confirm button — sticky at bottom */}
      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!ready}
          className="flex items-center gap-2 rounded-lg bg-[#002388] px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0B4DBB] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ListChecks size={15} />
          Confirm selection &amp; begin answering
        </button>
        {!ready && (
          <span className="text-[12px] text-[#9ca3af]">
            Select {required - count} more to continue
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Submit Review Screen (full page) ─────────────────────────────────────────

function SubmitReviewScreen({ assessment, sections, totalRequired, answeredCount, isPending, onConfirm, onCancel }: {
  assessment: SerializedAssessmentDetail
  sections: SectionWithProgress[]
  totalRequired: number
  answeredCount: number
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const answered = Math.min(answeredCount, totalRequired)
  const unanswered = Math.max(0, totalRequired - answeredCount)
  const allAnswered = unanswered <= 0
  const pct = totalRequired > 0 ? Math.min((answeredCount / totalRequired) * 100, 100) : 0

  return (
    <div className="fixed inset-0 z-[200] bg-[#f8f9fa] flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[#ebebeb] bg-white px-4 sm:px-8 py-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eef2ff]">
            <BookOpen size={15} className="text-[#002388]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#111827] leading-tight">{assessment.title}</p>
            <p className="text-[10px] uppercase tracking-wider font-medium text-[#9ca3af]">Review &amp; Submit</p>
          </div>
        </div>
        <button type="button" onClick={onCancel} disabled={isPending}
          className="flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-50">
          <ChevronLeft size={14} />Back to assessment
        </button>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-2xl">

          {/* Heading */}
          <div className="flex items-start gap-4 mb-8">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${allAnswered ? "bg-[#dcfce7]" : "bg-[#fef3c7]"}`}>
              {allAnswered
                ? <CheckCircle2 size={24} className="text-[#16a34a]" />
                : <AlertTriangle size={24} className="text-[#d97706]" />}
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-[24px] font-semibold text-[#111827] leading-tight">
                {allAnswered ? "You're ready to submit" : "You have unanswered questions"}
              </h1>
              <p className="mt-1 text-[14px] text-[#6b7280]">
                {allAnswered
                  ? "You've answered all required questions. Review the breakdown below, then submit when you're ready."
                  : `You can still go back and complete them. Once you submit, this attempt is final and cannot be changed.`}
              </p>
            </div>
          </div>

          {/* Progress summary card */}
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-6 mb-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af]">Required questions answered</p>
                <p className="mt-1 text-[32px] font-bold leading-none text-[#111827] font-mono tabular-nums">
                  {answered}<span className="text-[#9ca3af] text-[20px] font-semibold"> / {totalRequired}</span>
                </p>
              </div>
              <span className={`text-[13px] font-semibold ${allAnswered ? "text-[#16a34a]" : "text-[#d97706]"}`}>
                {Math.round(pct)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#f3f4f6] overflow-hidden">
              <div className={`h-2 rounded-full transition-all ${allAnswered ? "bg-[#16a34a]" : "bg-[#f59e0b]"}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Section breakdown */}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-2 px-1">By section</p>
          <div className="rounded-xl border border-[#e5e7eb] bg-white divide-y divide-[#f3f4f6] overflow-hidden mb-5">
            {sections.map((section: any) => {
              const required = section.requiredCount
              const done = Math.min(section.answeredCount, required)
              const complete = done >= required
              return (
                <div key={section.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {complete
                      ? <CheckCircle2 size={16} className="shrink-0 text-[#16a34a]" />
                      : <AlertTriangle size={16} className="shrink-0 text-[#d97706]" />}
                    <span className="text-[14px] text-[#374151] truncate">{section.name}</span>
                  </div>
                  <span className={`shrink-0 text-[13px] font-semibold font-mono tabular-nums ${complete ? "text-[#16a34a]" : "text-[#d97706]"}`}>
                    {done}/{required}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Unanswered warning */}
          {!allAnswered && (
            <div className="flex items-start gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4 mb-5">
              <AlertTriangle size={18} className="shrink-0 text-[#d97706] mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold text-[#92400e]">
                  {unanswered} required question{unanswered !== 1 ? "s" : ""} still unanswered
                </p>
                <p className="text-[13px] text-[#a16207] mt-0.5">
                  Unanswered questions will be scored as zero. Go back to complete them if you have time remaining.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
            <button type="button" onClick={onCancel} disabled={isPending}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-5 py-3 text-[14px] font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-50">
              <ChevronLeft size={16} />Back to assessment
            </button>
            <button type="button" onClick={onConfirm} disabled={isPending}
              className={`flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-[14px] font-semibold text-white transition-colors disabled:opacity-60 ${allAnswered ? "bg-[#002388] hover:bg-[#0B4DBB]" : "bg-[#d97706] hover:bg-[#b45309]"}`}>
              {isPending
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Submitting…</>
                : <><Send size={15} />{allAnswered ? "Submit assessment" : "Submit anyway"}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Question Palette ─────────────────────────────────────────────────────────

function QuestionPalette({ items, activeIndex, onSelect }: {
  // One entry per page (a standalone question or a whole group).
  items: { key: string; answered: boolean }[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {items.map((item, i) => {
        const isActive = i === activeIndex
        const isAnswered = item.answered
        const displayNum = i + 1
        return (
          <button key={item.key} type="button" onClick={() => onSelect(i)} title={`Question ${displayNum}`}
            className={["flex h-7 w-full items-center justify-center rounded text-[11px] font-semibold transition-all",
              isActive ? "bg-[#002388] text-white"
              : isAnswered ? "bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0] hover:bg-[#bbf7d0]"
              : "bg-[#f3f4f6] text-[#6b7280] border border-[#e5e7eb] hover:bg-[#e5e7eb]",
            ].join(" ")}
          >
            {displayNum}
          </button>
        )
      })}
    </div>
  )
}
// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AttemptShell({ attempt, assessment, assessmentId, proctorSession, simulation = false, simulationReturnUrl }: AttemptShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const lockdownRef = useRef<LockdownOverlayHandle>(null)
  const [proctorActive] = useState(true)

  // ── Violation store ───────────────────────────────────────────────────────
  // Zustand store is the single source of truth — no prop drilling needed.
  const { reset: resetViolations, syncCount, showFinalWarning } = useViolationStore()

  // Hydrate violation count from server on mount so page refreshes don't reset the dots.
  // Skip in simulation mode — no real attempt exists.
  useEffect(() => {
    if (simulation) return
    getProctorFlagCount(attempt.id).then((serverCount) => {
      if (serverCount > 0) {
        syncCount(serverCount)
        if (serverCount >= MAX_VIOLATIONS) showFinalWarning()
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id])

  // Reset store when the attempt page unmounts
  useEffect(() => {
    return () => resetViolations()
  }, [resetViolations])


  // ── Apply saved question order (shuffleQuestions) ─────────────────────────
  // The server saved a randomised order in attempt.questionOrder at creation time.
  // We reorder the sections' questions to match it so every student sees the
  // same shuffled order for their attempt, even after a page refresh.
  const orderedSections = assessment.shuffleQuestions
    ? applyQuestionOrder(assessment.sections, attempt.questionOrder)
    : assessment.sections

  // ── Build per-question option shuffle map (shuffleOptions) ────────────────
  // Deterministically seeded by questionId so the order is stable across renders.
  const optionShuffleMap = assessment.shuffleOptions
    ? buildOptionShuffleMap(orderedSections)
    : new Map<number, number[]>()

  // Use the (possibly reordered) sections everywhere below
  const sections = orderedSections

  const firstSection = sections[0]
  const [activeSectionId, setActiveSectionId] = useState<number>(firstSection?.id ?? 0)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Per-section unit selection for "answer N of M" quota sections.
  // A "unit" is one page: a standalone question OR a whole group. We store the
  // chosen page keys ("q123" / "g45").
  //   absent key  → no quota (everything open)
  //   undefined   → quota, not yet selected (show selection screen)
  //   Set<string> → confirmed selection of unit keys
  const [sectionSelections, setSectionSelections] = useState<Map<number, Set<string> | undefined>>(() => {
    const map = new Map<number, Set<string> | undefined>()
    for (const s of sections) {
      const pages = buildSectionPages(s)
      const required = s.requiredQuestionsCount
      if (required !== null && required < pages.length) {
        // Resuming: pre-select any unit the student already started answering.
        const startedKeys = pages
          .filter((p) =>
            pageIdsOf(p).some((id) => {
              const a = attempt.answers.find((ans: any) => ans.questionId === id)
              return a && (a.answerText !== null || a.selectedOption !== null || a.fileUrl !== null)
            }),
          )
          .map((p) => p.key)
        map.set(s.id, startedKeys.length > 0 ? new Set(startedKeys) : undefined)
      }
      // No entry = no quota = all open
    }
    return map
  })

  // Pending selection state (before confirming) — page keys.
  const [pendingSelection, setPendingSelection] = useState<Set<string>>(new Set())

  const [answers, setAnswers] = useState<AnswerMap>(() => {
    const map: AnswerMap = new Map()
    for (const a of attempt.answers) {
      map.set(a.questionId, { answerText: a.answerText, selectedOption: a.selectedOption, fileUrl: a.fileUrl })
    }
    return map
  })

  const isSecured = assessment.type === "EXAM" || assessment.type === "QUIZ"

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function hasAnswerValue(a: { answerText: string | null; selectedOption: number | null; fileUrl: string | null } | undefined) {
    return a && (a.answerText !== null || a.selectedOption !== null || a.fileUrl !== null)
  }

  // A unit (page) is "complete" when every question on it has an answer. For a
  // group that means all its sub-questions; blanks are allowed, they just leave
  // the unit incomplete (the submit review nudges but never blocks).
  const pageComplete = (p: ExamPage) => {
    const ids = pageIdsOf(p)
    return ids.length > 0 && ids.every((id) => hasAnswerValue(answers.get(id)))
  }

  // For a quota section: returns the confirmed Set, or undefined if not yet selected
  function getSectionSelection(sectionId: number): Set<string> | null | undefined {
    if (!sectionSelections.has(sectionId)) return null // no quota
    return sectionSelections.get(sectionId) // undefined = needs selection, Set = confirmed
  }

  const sectionsWithProgress: SectionWithProgress[] = sections.map((s: any) => {
    const pages = buildSectionPages(s)
    const sel = getSectionSelection(s.id)
    const visible = sel instanceof Set ? pages.filter((p) => sel.has(p.key)) : pages
    // requiredCount is in units: the configured quota for quota sections, else all units.
    const requiredCount = sectionSelections.has(s.id) ? (s.requiredQuestionsCount as number) : pages.length
    return {
      ...s,
      totalQuestionCount: pages.length,
      requiredCount,
      answeredCount: visible.filter(pageComplete).length,
    }
  })

  const activeSection = sections.find((s: any) => s.id === activeSectionId) ?? firstSection
  const activeSectionRequired = activeSection?.requiredQuestionsCount ?? null

  // Pages for the active section — standalone questions (one each) + group pages.
  const activePages: ExamPage[] = activeSection ? buildSectionPages(activeSection) : []
  // "Choose N of M" quota applies whenever fewer units are required than exist —
  // a group counts as one selectable unit, same as a standalone question.
  const activeSectionHasQuota =
    activeSectionRequired !== null && activeSectionRequired < activePages.length

  // Is the active section in "needs selection" mode?
  const activeSectionSelection = activeSection ? getSectionSelection(activeSection.id) : null
  const needsSelection = activeSectionHasQuota && activeSectionSelection === undefined

  // For quota sections, restrict to the confirmed selection of units.
  const visiblePages: ExamPage[] =
    activeSectionSelection instanceof Set
      ? activePages.filter((p) => (activeSectionSelection as Set<string>).has(p.key))
      : activePages

  // Navigation now moves page-by-page. activeQuestionIndex holds the page index.
  const totalQuestionsInSection = visiblePages.length
  const safeActiveIndex = Math.min(activeQuestionIndex, Math.max(0, totalQuestionsInSection - 1))
  const activePage: ExamPage | null = visiblePages[safeActiveIndex] ?? null

  // Required + answered totals are counted in units (standalone questions + groups).
  const totalRequired = sectionsWithProgress.reduce((sum, s) => sum + s.requiredCount, 0)
  const totalAnsweredAll = sectionsWithProgress.reduce(
    (sum, s) => sum + Math.min(s.answeredCount, s.requiredCount),
    0,
  )

  // Per-page answered state for the palette / footer dots.
  const paletteItems = visiblePages.map((p) => ({ key: p.key, answered: pageComplete(p) }))

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSectionSelect(sectionId: number) {
    setActiveSectionId(sectionId)
    setActiveQuestionIndex(0)
    setPendingSelection(new Set())
  }

  function handleTogglePending(key: string) {
    setPendingSelection((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Track which sections have had their selection confirmed at least once (for re-selection UX)
  const [everConfirmedSections, setEverConfirmedSections] = useState<Set<number>>(new Set())

  function handleConfirmSelection() {
    if (!activeSection) return
    setSectionSelections((prev) => new Map(prev).set(activeSection.id, new Set(pendingSelection)))
    setEverConfirmedSections((prev) => new Set(prev).add(activeSection.id))
    setActiveQuestionIndex(0)
  }

  function handleChangeSelection() {
    if (!activeSection) return
    const current = getSectionSelection(activeSection.id)
    setPendingSelection(current instanceof Set ? new Set(current) : new Set())
    setSectionSelections((prev) => new Map(prev).set(activeSection.id, undefined))
    setActiveQuestionIndex(0)
  }
  const handleAnswerChange = useCallback((
    questionId: number,
    payload: { answerText: string | null; selectedOption: number | null; fileUrl: string | null }
  ) => {
    setAnswers((prev) => new Map(prev).set(questionId, payload))
  }, [])

  // Stable identity so CountdownTimer's effect doesn't tear down/rebuild its
  // interval on every keystroke (which made the timer flicker while typing).
  const handleExpire = useCallback(async () => {
    if (simulation) {
      window.location.href = simulationReturnUrl ?? `/lecturer/assessments/${assessmentId}`
      return
    }
    // Mark submitting so the fullscreen-exit/blur from navigating away isn't flagged.
    useViolationStore.getState().beginSubmit()
    // Disable the beforeunload prompt so the browser doesn't ask "leave site?"
    // when we redirect after the timer hits zero.
    lockdownRef.current?.allowUnload()
    await submitAttempt(attempt.id, "TIMED_OUT")
    window.location.href = `/student/assessments/${assessmentId}`
  }, [simulation, simulationReturnUrl, assessmentId, attempt.id])

  function handleSubmitConfirm(reason?: "TIMED_OUT" | "FULLSCREEN_VIOLATION" | "TAB_SWITCH" | ViolationReason) {
    startTransition(async () => {
      if (simulation) {
        window.location.href = simulationReturnUrl ?? `/lecturer/assessments/${assessmentId}`
        return
      }
      // Mark submitting so the fullscreen-exit/blur from navigating away isn't flagged.
      useViolationStore.getState().beginSubmit()
      lockdownRef.current?.allowUnload()
      const dbReason = reason === "FULLSCREEN_EXIT" ? "FULLSCREEN_VIOLATION"
        : reason === "TAB_SWITCH" ? "TAB_SWITCH"
        : reason
      await submitAttempt(attempt.id, dbReason as "TIMED_OUT" | "FULLSCREEN_VIOLATION" | "TAB_SWITCH" | undefined)
      window.location.href = `/student/assessments/${assessmentId}`
    })
  }

  const activeSectionIdx = sections.findIndex((s: any) => s.id === activeSectionId)
  const nextSection = sections[activeSectionIdx + 1]

  // ── Sidebar content (shared between desktop aside and mobile drawer) ──────────

  function SidebarContent({ onClose }: { onClose?: () => void }) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Title */}
        <div className="px-4 py-4 border-b border-[#ebebeb] flex items-start justify-between gap-2 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eef2ff]">
              <BookOpen size={14} className="text-[#002388]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#111827] leading-tight">{assessment.title}</p>
              <p className="mt-0.5 text-[10px] text-[#9ca3af] uppercase tracking-wider font-medium">{assessment.type}</p>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="shrink-0 p-1 rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Timer */}
        {assessment.durationMinutes != null && (
          <div className="px-4 py-3 border-b border-[#ebebeb] shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-1.5 flex items-center gap-1.5">
              <Clock size={10} />Time Remaining
            </p>
            <CountdownTimer startedAt={attempt.startedAt} durationMinutes={assessment.durationMinutes} onExpire={handleExpire} />
          </div>
        )}

        {/* Overall progress */}
        <div className="px-4 py-2.5 border-b border-[#ebebeb] shrink-0">
          <div className="flex items-center justify-between text-[11px] text-[#9ca3af] mb-1.5">
            <span>Overall progress</span>
            <span className="font-semibold text-[#374151]">{totalAnsweredAll}/{totalRequired}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#f3f4f6] overflow-hidden">
            <div className="h-1.5 rounded-full bg-[#002388] transition-all"
              style={{ width: `${totalRequired > 0 ? Math.min((totalAnsweredAll / totalRequired) * 100, 100) : 0}%` }} />
          </div>
        </div>

        {/* Sections */}
        <div className="px-3 py-3 border-b border-[#ebebeb] shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-2 px-1 flex items-center gap-1.5">
            <Layers size={10} />Sections
          </p>
          <div className="flex flex-col gap-0.5">
            {sectionsWithProgress.map((section: any) => {
              const isActive = section.id === activeSectionId
              const required = section.requiredCount
              const complete = section.answeredCount >= required
              const sel = getSectionSelection(section.id)
              const pending = sel === undefined
              return (
                <button key={section.id} type="button"
                  onClick={() => { handleSectionSelect(section.id); onClose?.() }}
                  className={["flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors",
                    isActive ? "bg-[#eef2ff] text-[#002388]" : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#374151]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {complete
                      ? <CheckCircle2 size={12} className="shrink-0 text-[#16a34a]" />
                      : pending
                      ? <ListChecks size={12} className="shrink-0 text-[#d97706]" />
                      : <div className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${isActive ? "border-[#002388]" : "border-[#d1d5db]"}`} />
                    }
                    <span className="truncate text-[12px] font-medium">{section.name}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#9ca3af]">
                    {pending ? "choose" : `${section.answeredCount}/${required}`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Question palette */}
        {!needsSelection && (
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-2 px-1">Questions</p>
            {activeSection && (
              <QuestionPalette
                items={paletteItems}
                activeIndex={safeActiveIndex}
                onSelect={(i) => { setActiveQuestionIndex(i); onClose?.() }}
              />
            )}
            <div className="mt-3 flex flex-col gap-1.5 px-1">
              {[
                { color: "bg-[#002388]", label: "Current" },
                { color: "bg-[#dcfce7] border border-[#bbf7d0]", label: "Answered" },
                { color: "bg-[#f3f4f6] border border-[#e5e7eb]", label: "Not answered" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 text-[10px] text-[#9ca3af]">
                  <div className={`h-2 w-2 rounded ${color}`} />{label}
                </div>
              ))}
            </div>
          </div>
        )}

        {needsSelection && <div className="flex-1" />}

        {/* Proctor camera dock (desktop sidebar only — ProctorCamera portals its
            preview in here; on mobile the cam stays hidden/off-screen). */}
        {!onClose && assessment.proctoringEnabled && (
          <div className="border-t border-[#ebebeb] px-3 py-3 shrink-0">
            <div id="proctor-cam-slot" />
          </div>
        )}

        {/* Submit */}
        <div className="border-t border-[#ebebeb] p-3 shrink-0">
          <button type="button" onClick={() => { simulation ? handleSubmitConfirm() : (setShowSubmitDialog(true), onClose?.()) }} disabled={isPending}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${simulation ? "bg-amber-600 hover:bg-amber-700" : "bg-[#002388] hover:bg-[#0B4DBB]"}`}>
            <Send size={13} />{simulation ? "End Simulation" : "Submit Assessment"}
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {!simulation && <LockdownOverlay ref={lockdownRef} isSecured={isSecured} attemptId={attempt.id} onSubmit={(reason) => handleSubmitConfirm(reason)} />}
      {!simulation && <AntiCheatGuard isSecured={isSecured} attemptId={attempt.id} onSubmit={(reason) => handleSubmitConfirm(reason)} />}
      {!simulation && <ViolationOverlay assessmentId={assessmentId} />}
      {!simulation && assessment.proctoringEnabled && <ProctorCamera attemptId={attempt.id} />}
      {!simulation && <ProctorAudio attemptId={attempt.id} />}

      {showSubmitDialog && (
        <SubmitReviewScreen
          assessment={assessment}
          sections={sectionsWithProgress}
          totalRequired={totalRequired}
          answeredCount={totalAnsweredAll}
          isPending={isPending}
          onConfirm={() => handleSubmitConfirm()}
          onCancel={() => setShowSubmitDialog(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          {/* Sheet slides up from bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#e5e7eb]" />
            </div>
            <SidebarContent onClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {simulation && (
        <div className="fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-[12px] font-semibold text-white">
          <span>SIMULATION MODE</span>
          <span className="opacity-60">·</span>
          <span className="font-normal opacity-90">No answers will be saved. Click "End Simulation" to exit.</span>
        </div>
      )}

      <div className={`fixed inset-0 z-50 flex overflow-hidden bg-white ${simulation ? "pt-[34px]" : ""}`}>

        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col overflow-hidden border-r border-[#ebebeb] bg-[#fafafa]">
          <SidebarContent />
        </aside>

        {/* ── Main content ── */}
        <main className="flex flex-1 flex-col overflow-hidden bg-white min-w-0">

          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-[#ebebeb] px-3 sm:px-6 lg:px-10 py-2.5 shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile menu toggle */}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md text-[#6b7280] hover:bg-[#f3f4f6] transition-colors shrink-0"
                aria-label="Open navigation"
              >
                <PanelLeft size={17} />
              </button>

              {activeSection && (
                <span className={`hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                  activeSection.type === "OBJECTIVE" ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-[#f5f3ff] text-[#6d28d9]"
                }`}>
                  {activeSection.type}
                </span>
              )}
              <span className="text-[13px] font-medium text-[#374151] truncate">{activeSection?.name}</span>
              {!needsSelection && (
                <span className="text-[12px] text-[#9ca3af] shrink-0">· {safeActiveIndex + 1}/{totalQuestionsInSection}</span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Mobile timer pill */}
              {assessment.durationMinutes != null && (
                <div className="flex lg:hidden items-center gap-1 text-[12px] font-semibold text-[#374151] bg-[#f3f4f6] px-2.5 py-1 rounded-full">
                  <Clock size={12} className="text-[#6b7280]" />
                  <CountdownTimer startedAt={attempt.startedAt} durationMinutes={assessment.durationMinutes} onExpire={handleExpire} compact />
                </div>
              )}

              {activeSectionHasQuota && !needsSelection && (
                <button
                  type="button"
                  onClick={handleChangeSelection}
                  className="hidden sm:flex items-center gap-1.5 rounded-md border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors"
                >
                  <ListChecks size={12} className="text-[#6b7280]" />
                  <span className="hidden md:inline">Change selection</span>
                </button>
              )}

              {/* Progress pill */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-1 w-20 rounded-full bg-[#f3f4f6] overflow-hidden">
                  <div className="h-1 rounded-full bg-[#002388] transition-all"
                    style={{ width: `${totalRequired > 0 ? Math.min((totalAnsweredAll / totalRequired) * 100, 100) : 0}%` }} />
                </div>
                <span className="text-[11px] text-[#9ca3af]">{totalAnsweredAll}/{totalRequired}</span>
              </div>

              {proctorActive && (
                <div className="flex items-center gap-1 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                  <Video size={10} className="text-[#16a34a]" />
                  <span className="hidden sm:inline text-[10px] font-medium text-[#16a34a]">Proctored</span>
                </div>
              )}
            </div>
          </header>

          {/* ── Selection screen OR question area ── */}
          {needsSelection && activeSection ? (
            <QuestionSelectionScreen
              sectionName={activeSection.name}
              pages={activePages}
              required={activeSectionRequired!}
              selectedKeys={pendingSelection}
              isReselecting={activeSection ? everConfirmedSections.has(activeSection.id) : false}
              onToggle={handleTogglePending}
              onConfirm={handleConfirmSelection}
            />
          ) : (
            <>
              {/* Question area */}
              <div className="flex-1 overflow-y-auto">
                <div className="w-full px-4 sm:px-8 lg:px-16 py-6 lg:py-10">
                  {activePage && activePage.kind === "single" ? (
                    <QuestionRenderer
                      key={activePage.question.id}
                      question={{ ...activePage.question, sectionType: activeSection!.type, existingAnswer: answers.get(activePage.question.id) ?? null }}
                      attemptId={attempt.id}
                      displayNumber={safeActiveIndex + 1}
                      shuffledOptions={optionShuffleMap.get(activePage.question.id)}
                      assessmentType={assessment.type}
                      simulation={simulation}
                      onAnswerChange={handleAnswerChange}
                    />
                  ) : activePage && activePage.kind === "group" ? (
                    <div className="flex flex-col gap-8">
                      {/* Shared group context (optional) */}
                      <div className="rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9ca3af]">
                            Question {safeActiveIndex + 1}
                          </p>
                          <span className="shrink-0 rounded-full bg-white border border-[#e5e7eb] px-2.5 py-1 text-[11px] font-semibold text-[#6b7280] tabular-nums">
                            {activePage.totalMarks} {activePage.totalMarks === 1 ? "mark" : "marks"}
                          </span>
                        </div>
                        {activePage.context && activePage.context.trim() !== "" && (
                          <p className="mt-2.5 text-[16px] font-normal text-[#111827] leading-[1.75]">
                            {activePage.context}
                          </p>
                        )}
                      </div>

                      {/* Sub-questions stacked; scroll down through 1a, 1b, 1c… */}
                      {activePage.questions.map((q, subIdx) => (
                        <div key={q.id} className="border-l-2 border-[#eef2ff] pl-4 sm:pl-6">
                          <QuestionRenderer
                            question={{ ...q, sectionType: activeSection!.type, existingAnswer: answers.get(q.id) ?? null }}
                            attemptId={attempt.id}
                            displayNumber={safeActiveIndex + 1}
                            displayLabel={`${safeActiveIndex + 1}${String.fromCharCode(97 + subIdx)}`}
                            shuffledOptions={optionShuffleMap.get(q.id)}
                            assessmentType={assessment.type}
                            simulation={simulation}
                            onAnswerChange={handleAnswerChange}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <BookOpen size={24} className="text-[#d1d5db]" />
                      <p className="mt-3 text-sm text-[#9ca3af]">No questions in this section.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom nav */}
              <footer className="flex items-center justify-between border-t border-[#ebebeb] px-3 sm:px-6 lg:px-10 py-3 shrink-0 gap-2">
                <button type="button"
                  onClick={() => setActiveQuestionIndex((i) => Math.max(0, i - 1))}
                  disabled={safeActiveIndex === 0}
                  className="flex items-center gap-1 sm:gap-1.5 rounded-lg border border-[#e5e7eb] px-3 sm:px-4 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={15} /><span className="hidden sm:inline">Previous</span>
                </button>

                {/* Centre: dot progress on sm+, "Q N" label on mobile */}
                <div className="flex items-center gap-2">
                  <span className="sm:hidden text-[12px] text-[#6b7280] font-medium">
                    Q {safeActiveIndex + 1} of {totalQuestionsInSection}
                  </span>
                  <div className="hidden sm:flex items-center gap-1">
                    {paletteItems.slice(0, 20).map((item, i) => (
                      <button key={item.key} type="button" onClick={() => setActiveQuestionIndex(i)}
                        className={`rounded-full transition-all ${
                          i === safeActiveIndex ? "w-5 h-1.5 bg-[#002388]"
                          : item.answered ? "w-1.5 h-1.5 bg-[#86efac]"
                          : "w-1.5 h-1.5 bg-[#e5e7eb]"
                        }`}
                        aria-label={`Go to question ${i + 1}`}
                      />
                    ))}
                    {paletteItems.length > 20 && (
                      <span className="text-[10px] text-[#9ca3af] ml-1">+{paletteItems.length - 20}</span>
                    )}
                  </div>
                  {/* Mobile: open drawer button */}
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(true)}
                    className="sm:hidden flex items-center gap-1 text-[12px] font-semibold text-[#002388] border border-[#002388]/20 bg-[#eef2ff] px-2.5 py-1 rounded-full"
                  >
                    <Menu size={12} />Questions
                  </button>
                </div>

                {safeActiveIndex < totalQuestionsInSection - 1 ? (
                  <button type="button"
                    onClick={() => setActiveQuestionIndex((i) => Math.min(totalQuestionsInSection - 1, i + 1))}
                    className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-[#002388] px-3 sm:px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0B4DBB] transition-colors"
                  >
                    <span className="hidden sm:inline">Next</span><ChevronRight size={15} />
                  </button>
                ) : nextSection ? (
                  <button type="button" onClick={() => handleSectionSelect(nextSection.id)}
                    className="flex items-center gap-1 sm:gap-1.5 rounded-lg bg-[#002388] px-3 sm:px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0B4DBB] transition-colors"
                  >
                    <span className="hidden sm:inline">Next Section</span><ChevronRight size={15} />
                  </button>
                ) : (
                  <button type="button" onClick={() => simulation ? handleSubmitConfirm() : setShowSubmitDialog(true)} disabled={isPending}
                    className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 text-[13px] font-medium text-white transition-colors disabled:opacity-50 ${simulation ? "bg-amber-600 hover:bg-amber-700" : "bg-[#002388] hover:bg-[#0B4DBB]"}`}
                  >
                    <Send size={13} /><span className="hidden sm:inline">{simulation ? "End Simulation" : "Submit"}</span>
                  </button>
                )}
              </footer>
            </>
          )}
        </main>
      </div>
    </>
  )
}
