"use client"

import { useState } from "react"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Zap,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react"

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
  feedback: {
    totalScore: number
    maxScore: number
    flag: string
    flagReason: string
    bedrockError: boolean
    criteriaFeedback: CriterionFeedback[]
  } | null
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
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

export function ScoreBar({ score, max }: { score: number; max: number }) {
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

// ─── McqQuestion ──────────────────────────────────────────────────────────────

export function McqQuestion({ q }: { q: QuestionDetail }) {
  const options = Array.isArray(q.options) ? (q.options as string[]) : []
  const selected = q.answer?.selectedOption ?? null
  const correct = q.correctOption ?? null
  const isCorrect = selected !== null && selected === correct

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => {
          const isSelected = selected === i
          const isCorrectOpt = correct === i
          let cls =
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          if (isCorrectOpt)
            cls += " border-green-200 bg-green-50 text-green-800"
          else if (isSelected && !isCorrectOpt)
            cls += " border-red-200 bg-red-50 text-red-700"
          else cls += " border-slate-100 bg-slate-50 text-slate-600"

          return (
            <div key={i} className={cls + " w-full"}>
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

// ─── SubjectiveQuestion ───────────────────────────────────────────────────────

export function SubjectiveQuestion({ q, assessmentId, attemptId }: { q: QuestionDetail; assessmentId: number; attemptId: number }) {
  const [expanded, setExpanded] = useState(true)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(q.lecturerNotes ?? "")
  const [savingNotes, setSavingNotes] = useState(false)

  const fb = q.feedback

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      const res = await fetch(
        `/api/lecturer/assessments/${assessmentId}/attempts/${attemptId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: q.id, lecturerNotes: notesValue }),
        }
      )
      if (!res.ok) {
        throw new Error("Failed to save notes")
      }
      setEditingNotes(false)
      window.location.reload()
    } catch (err) {
      console.error("[SubjectiveQuestion] Failed to save notes", err)
      alert("Failed to save notes. Please try again.")
    } finally {
      setSavingNotes(false)
    }
  }

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
          <div
            className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer select-none"
            onClick={() => setExpanded((v) => !v)}
          >
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
              {expanded ? (
                <ChevronUp size={14} className="text-slate-400" />
              ) : (
                <ChevronDown size={14} className="text-slate-400" />
              )}
            </div>
          </div>

          {expanded && (
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
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-400 italic">
          Not yet graded by AI
        </div>
      )}

      {/* Lecturer notes section */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-blue-100/50 border-b border-blue-200">
          <span className="text-sm font-semibold text-blue-800">Lecturer's Notes</span>
          {!editingNotes && (
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <Pencil size={12} />
              {q.lecturerNotes ? "Edit" : "Add"}
            </button>
          )}
        </div>

        {editingNotes ? (
          <div className="p-4 space-y-3">
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Add your feedback or notes for this answer..."
              className="w-full h-24 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingNotes(false)
                  setNotesValue(q.lecturerNotes ?? "")
                }}
                disabled={savingNotes}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        ) : (
          q.lecturerNotes ? (
            <div className="px-4 py-3">
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{q.lecturerNotes}</p>
            </div>
          ) : (
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 italic">No notes added yet.</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
