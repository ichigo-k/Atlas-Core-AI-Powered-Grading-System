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
}

export type SectionWithProgress = {
  id: number
  name: string
  type: string
  requiredQuestionsCount: number | null
  questions: { id: number; order: number; body: string; marks: number; answerType: string | null; options: unknown }[]
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

  return sections.map((section) => ({
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
    for (const q of section.questions) {
      const opts = Array.isArray(q.options) ? q.options : []
      if (opts.length > 1) {
        map.set(q.id, seededOptionShuffle(q.id, opts.length))
      }
    }
  }
  return map
}

// ─── Question Selection Screen ────────────────────────────────────────────────
// Shown when a section has requiredQuestionsCount < total questions.
// Student must pick exactly N questions before they can answer any.

function QuestionSelectionScreen({
  section,
  required,
  selectedIds,
  isReselecting,
  onToggle,
  onConfirm,
}: {
  section: SectionWithProgress
  required: number
  selectedIds: Set<number>
  isReselecting?: boolean
  onToggle: (id: number) => void
  onConfirm: () => void
}) {
  const count = selectedIds.size
  const ready = count === required

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-16 py-6 lg:py-10">
      {/* Instruction banner */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9ca3af] mb-1">
          {section.name}
        </p>
        <h2 className="text-[20px] font-semibold text-[#111827] mb-1" style={{ fontFamily: "var(--font-sans,'Poppins',sans-serif)" }}>
          {isReselecting ? "Change your selection" : "Choose your questions"}
        </h2>
        <p className="text-[14px] text-[#6b7280]" style={{ fontFamily: "var(--font-sans,'Poppins',sans-serif)" }}>
          {isReselecting
            ? <>Update your selection — pick exactly <strong className="text-[#111827]">{required}</strong> questions from the {section.questions.length} below.</>
            : <>Select exactly <strong className="text-[#111827]">{required}</strong> questions to answer from the {section.questions.length} below.</>
          }
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

      {/* Question list */}
      <div className="flex flex-col divide-y divide-[#f3f4f6]">
        {section.questions.map((q, idx) => {
          const checked = selectedIds.has(q.id)
          const disabled = !checked && count >= required
          return (
            <label
              key={q.id}
              className={[
                "flex items-start gap-4 py-4 cursor-pointer transition-colors",
                disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[#fafafa]",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => !disabled && onToggle(q.id)}
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
                    Q{idx + 1}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
                </div>
                <p className="mt-0.5 text-[15px] text-[#374151] leading-relaxed" style={{ fontFamily: "'Georgia','Times New Roman',serif" }}>
                  {q.body}
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
            Select {required - count} more question{required - count !== 1 ? "s" : ""} to continue
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Submit Dialog ────────────────────────────────────────────────────────────

function SubmitDialog({ sections, totalRequired, answeredCount, isPending, onConfirm, onCancel }: {
  sections: SectionWithProgress[]
  totalRequired: number
  answeredCount: number
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const unanswered = totalRequired - answeredCount
  const allAnswered = unanswered <= 0

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-[#e5e7eb] overflow-hidden">
        <div className="px-6 py-5 border-b border-[#e5e7eb]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${allAnswered ? "bg-[#eff6ff]" : "bg-[#fffbeb]"}`}>
                {allAnswered ? <Send size={17} className="text-[#1d4ed8]" /> : <AlertTriangle size={17} className="text-[#d97706]" />}
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#111827]">
                  {allAnswered ? "Submit assessment?" : "Unanswered questions"}
                </h2>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  {allAnswered ? "This action cannot be undone." : "You still have required questions unanswered."}
                </p>
              </div>
            </div>
            <button type="button" onClick={onCancel}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors" aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6b7280]">Required questions answered</span>
              <span className={`font-semibold ${allAnswered ? "text-[#16a34a]" : "text-[#d97706]"}`}>
                {Math.min(answeredCount, totalRequired)} / {totalRequired}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#f3f4f6] overflow-hidden">
              <div className={`h-1.5 rounded-full transition-all ${allAnswered ? "bg-[#16a34a]" : "bg-[#f59e0b]"}`}
                style={{ width: `${totalRequired > 0 ? Math.min((answeredCount / totalRequired) * 100, 100) : 0}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-[#e5e7eb] divide-y divide-[#f3f4f6] overflow-hidden">
            {sections.map((section) => {
              const required = section.requiredQuestionsCount ?? section.questions.length
              const done = section.answeredCount
              const complete = done >= required
              return (
                <div key={section.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
                  <span className="text-sm text-[#374151] truncate flex-1 mr-3">{section.name}</span>
                  <span className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold ${complete ? "text-[#16a34a]" : "text-[#d97706]"}`}>
                    {done}/{required}
                    {complete && <CheckCircle2 size={12} />}
                  </span>
                </div>
              )
            })}
          </div>

          {!allAnswered && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-4 py-3">
              <AlertTriangle size={14} className="shrink-0 text-[#d97706] mt-0.5" />
              <p className="text-sm text-[#92400e]">
                <strong>{Math.max(0, unanswered)}</strong> required question{unanswered !== 1 ? "s" : ""} still unanswered.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-[#e5e7eb] px-6 py-4 bg-[#f9fafb]">
          <button type="button" onClick={onCancel} disabled={isPending}
            className="flex-1 rounded-lg border border-[#d1d5db] bg-white px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-50">
            Go back
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${allAnswered ? "bg-[#002388] hover:bg-[#0B4DBB]" : "bg-[#d97706] hover:bg-[#b45309]"}`}>
            {isPending
              ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Submitting…</>
              : <><Send size={13} />{allAnswered ? "Submit" : "Submit anyway"}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Question Palette ─────────────────────────────────────────────────────────

function QuestionPalette({ questions, answeredIds, selectedIds, activeIndex, onSelect }: {
  questions: { id: number; order: number }[]
  answeredIds: Set<number>
  selectedIds: Set<number> | null
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {questions.map((q, i) => {
        const isActive = i === activeIndex
        const isAnswered = answeredIds.has(q.id)
        const isLocked = selectedIds !== null && !selectedIds.has(q.id)
        const displayNum = i + 1
        return (
          <button key={q.id} type="button" onClick={() => onSelect(i)} title={`Question ${displayNum}`}
            disabled={isLocked}
            className={["flex h-7 w-full items-center justify-center rounded text-[11px] font-semibold transition-all",
              isLocked ? "bg-[#fafafa] text-[#d1d5db] cursor-not-allowed"
              : isActive ? "bg-[#002388] text-white"
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

export default function AttemptShell({ attempt, assessment, assessmentId, proctorSession }: AttemptShellProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const lockdownRef = useRef<LockdownOverlayHandle>(null)
  const [proctorActive] = useState(true)

  // ── Violation store ───────────────────────────────────────────────────────
  // Zustand store is the single source of truth — no prop drilling needed.
  const { reset: resetViolations, syncCount, showFinalWarning } = useViolationStore()

  // Hydrate violation count from server on mount so page refreshes don't reset the dots.
  useEffect(() => {
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

  // selectedQIds: per-section map of chosen question IDs (only for quota sections)
  // null means "no quota" — all questions are open
  // Set means "confirmed selection" — only those IDs are answerable
  // undefined means "not yet selected" — show selection screen
  const [sectionSelections, setSectionSelections] = useState<Map<number, Set<number> | undefined>>(() => {
    const map = new Map<number, Set<number> | undefined>()
    for (const s of sections) {
      const required = s.requiredQuestionsCount
      if (required !== null && required < s.questions.length) {
        // Check if student already has answers in this section (resuming attempt)
        const answeredInSection = s.questions.filter((q) => {
          const a = attempt.answers.find((a) => a.questionId === q.id)
          return a && (a.answerText !== null || a.selectedOption !== null || a.fileUrl !== null)
        })
        if (answeredInSection.length > 0) {
          // Pre-populate selection from existing answers
          map.set(s.id, new Set(answeredInSection.map((q) => q.id)))
        } else {
          map.set(s.id, undefined) // needs selection
        }
      }
      // No entry = no quota = all open
    }
    return map
  })

  // Pending selection state (before confirming)
  const [pendingSelection, setPendingSelection] = useState<Set<number>>(new Set())

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

  // For a quota section: returns the confirmed Set, or undefined if not yet selected
  function getSectionSelectedIds(sectionId: number): Set<number> | null | undefined {
    if (!sectionSelections.has(sectionId)) return null // no quota
    return sectionSelections.get(sectionId) // undefined = needs selection, Set = confirmed
  }

  const sectionsWithProgress: SectionWithProgress[] = sections.map((s) => ({
    ...s,
    answeredCount: s.questions.filter((q) => hasAnswerValue(answers.get(q.id))).length,
  }))

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? firstSection
  const activeSectionRequired = activeSection?.requiredQuestionsCount ?? null
  const activeSectionHasQuota = activeSectionRequired !== null && activeSectionRequired < (activeSection?.questions.length ?? 0)

  // Is the active section in "needs selection" mode?
  const activeSectionSelection = activeSection ? getSectionSelectedIds(activeSection.id) : null
  const needsSelection = activeSectionHasQuota && activeSectionSelection === undefined

  // Questions visible in the palette — for quota sections, only the confirmed selection
  const visibleQuestions = activeSection
    ? activeSectionSelection instanceof Set
      ? activeSection.questions.filter((q) => (activeSectionSelection as Set<number>).has(q.id))
      : activeSection.questions
    : []

  const activeQuestion: QuestionWithAnswer | null = activeSection && visibleQuestions.length > 0
    ? (() => {
        // Clamp index in case visibleQuestions shrank (e.g. after confirming a smaller selection)
        const clampedIndex = Math.min(activeQuestionIndex, visibleQuestions.length - 1)
        const q = visibleQuestions[clampedIndex]
        if (!q) return null
        return { ...q, sectionType: activeSection.type, existingAnswer: answers.get(q.id) ?? null }
      })()
    : null

  const totalQuestionsInSection = visibleQuestions.length
  // Use clamped index everywhere so header/nav stay consistent
  const safeActiveIndex = Math.min(activeQuestionIndex, Math.max(0, totalQuestionsInSection - 1))

  const totalRequired = sections.reduce((sum, s) => sum + (s.requiredQuestionsCount ?? s.questions.length), 0)
  const totalAnsweredAll = sectionsWithProgress.reduce((sum, s) => sum + Math.min(s.answeredCount, s.requiredQuestionsCount ?? s.questions.length), 0)

  const answeredIdsInSection = new Set(
    visibleQuestions.filter((q) => hasAnswerValue(answers.get(q.id))).map((q) => q.id)
  )

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSectionSelect(sectionId: number) {
    setActiveSectionId(sectionId)
    setActiveQuestionIndex(0)
    setPendingSelection(new Set())
  }

  function handleTogglePending(qId: number) {
    setPendingSelection((prev) => {
      const next = new Set(prev)
      if (next.has(qId)) next.delete(qId)
      else next.add(qId)
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
    const current = getSectionSelectedIds(activeSection.id)
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

  async function handleExpire() {
    // Disable the beforeunload prompt so the browser doesn't ask "leave site?"
    // when we redirect after the timer hits zero.
    lockdownRef.current?.allowUnload()
    await submitAttempt(attempt.id, "TIMED_OUT")
    window.location.href = `/student/assessments/${assessmentId}`
  }

  function handleSubmitConfirm(reason?: "TIMED_OUT" | "FULLSCREEN_VIOLATION" | "TAB_SWITCH" | ViolationReason) {
    startTransition(async () => {
      lockdownRef.current?.allowUnload()
      const dbReason = reason === "FULLSCREEN_EXIT" ? "FULLSCREEN_VIOLATION"
        : reason === "TAB_SWITCH" ? "TAB_SWITCH"
        : reason
      await submitAttempt(attempt.id, dbReason as "TIMED_OUT" | "FULLSCREEN_VIOLATION" | "TAB_SWITCH" | undefined)
      window.location.href = `/student/assessments/${assessmentId}`
    })
  }

  const activeSectionIdx = sections.findIndex((s) => s.id === activeSectionId)
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
            {sectionsWithProgress.map((section) => {
              const isActive = section.id === activeSectionId
              const required = section.requiredQuestionsCount ?? section.questions.length
              const complete = section.answeredCount >= required
              const sel = getSectionSelectedIds(section.id)
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
                questions={visibleQuestions}
                answeredIds={answeredIdsInSection}
                selectedIds={null}
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

        {/* Submit */}
        <div className="border-t border-[#ebebeb] p-3 shrink-0">
          <button type="button" onClick={() => { setShowSubmitDialog(true); onClose?.() }} disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#002388] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0B4DBB] disabled:opacity-50">
            <Send size={13} />Submit Assessment
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <LockdownOverlay ref={lockdownRef} isSecured={isSecured} attemptId={attempt.id} onSubmit={(reason) => handleSubmitConfirm(reason)} />
      <AntiCheatGuard isSecured={isSecured} attemptId={attempt.id} onSubmit={(reason) => handleSubmitConfirm(reason)} />
      <ViolationOverlay assessmentId={assessmentId} />
      {assessment.proctoringEnabled && <ProctorCamera attemptId={attempt.id} />}

      {showSubmitDialog && (
        <SubmitDialog
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

      <div className="fixed inset-0 z-50 flex overflow-hidden bg-white">

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
              section={{ ...activeSection, answeredCount: 0 }}
              required={activeSectionRequired!}
              selectedIds={pendingSelection}
              isReselecting={activeSection ? everConfirmedSections.has(activeSection.id) : false}
              onToggle={handleTogglePending}
              onConfirm={handleConfirmSelection}
            />
          ) : (
            <>
              {/* Question area */}
              <div className="flex-1 overflow-y-auto">
                <div className="w-full px-4 sm:px-8 lg:px-16 py-6 lg:py-10">
                  {activeQuestion ? (
                    <QuestionRenderer
                      key={activeQuestion.id}
                      question={activeQuestion}
                      attemptId={attempt.id}
                      displayNumber={safeActiveIndex + 1}
                      shuffledOptions={optionShuffleMap.get(activeQuestion.id)}
                      assessmentType={assessment.type}
                      onAnswerChange={handleAnswerChange}
                    />
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
                    {visibleQuestions.slice(0, 20).map((q, i) => (
                      <button key={q.id} type="button" onClick={() => setActiveQuestionIndex(i)}
                        className={`rounded-full transition-all ${
                          i === safeActiveIndex ? "w-5 h-1.5 bg-[#002388]"
                          : answeredIdsInSection.has(q.id) ? "w-1.5 h-1.5 bg-[#86efac]"
                          : "w-1.5 h-1.5 bg-[#e5e7eb]"
                        }`}
                        aria-label={`Go to question ${i + 1}`}
                      />
                    ))}
                    {visibleQuestions.length > 20 && (
                      <span className="text-[10px] text-[#9ca3af] ml-1">+{visibleQuestions.length - 20}</span>
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
                  <button type="button" onClick={() => setShowSubmitDialog(true)} disabled={isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-[#002388] px-3 sm:px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0B4DBB] transition-colors disabled:opacity-50"
                  >
                    <Send size={13} /><span className="hidden sm:inline">Submit</span>
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
