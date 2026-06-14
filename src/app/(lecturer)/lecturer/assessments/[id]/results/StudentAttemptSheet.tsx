"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react"
import {
  ScoreBar,
  McqQuestion,
  SubjectiveQuestion,
  type AttemptDetail,
  type QuestionDetail,
} from "./AttemptDetailContent"

interface Props {
  open: boolean
  assessmentId: number
  attemptId: number | null
  studentName: string
  onClose: () => void
}

export default function StudentAttemptSheet({
  open,
  assessmentId,
  attemptId,
  studentName,
  onClose,
}: Props) {
  const [detail, setDetail] = useState<AttemptDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !attemptId) return
    setDetail(null)
    setError(null)
    setLoading(true)

    fetch(`/api/lecturer/assessments/${assessmentId}/attempts/${attemptId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load attempt")
        return r.json()
      })
      .then((d) => setDetail(d))
      .catch(() => setError("Could not load attempt details. Please try again."))
      .finally(() => setLoading(false))
  }, [open, assessmentId, attemptId])

  // Group questions by section
  const sections = detail
    ? Array.from(
        detail.questions.reduce((map, q) => {
          if (!map.has(q.sectionName)) map.set(q.sectionName, [])
          map.get(q.sectionName)!.push(q)
          return map
        }, new Map<string, QuestionDetail[]>())
      )
    : []

  const scorePct =
    detail?.score != null && detail.totalMarks > 0
      ? Math.round((detail.score / detail.totalMarks) * 100)
      : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-2xl p-0 gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0">
          <SheetTitle className="text-base">{studentName}</SheetTitle>
          <SheetDescription>
            {detail
              ? `Attempt ${detail.attemptNumber} · submitted ${
                  detail.submittedAt
                    ? format(new Date(detail.submittedAt), "MMM d, yyyy HH:mm")
                    : "—"
                }`
              : "Loading attempt…"}
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-slate-400">{error}</p>
            </div>
          )}

          {detail && (
            <div className="space-y-0">
              {/* Score summary bar */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-6 flex-wrap">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                    Score
                  </p>
                  {detail.score != null ? (
                    <p className="text-2xl font-semibold text-slate-900">
                      {detail.score}
                      <span className="text-sm font-normal text-slate-400 ml-1">
                        / {detail.totalMarks}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Not graded</p>
                  )}
                </div>

                {scorePct !== null && (
                  <div className="flex-1 min-w-32">
                    <ScoreBar score={detail.score!} max={detail.totalMarks} />
                  </div>
                )}

                {detail.plagiarismFlagged && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    <ShieldAlert size={12} />
                    Plagiarism flagged
                  </span>
                )}

                {detail.gradedAt && (
                  <p className="text-[11px] text-slate-400 ml-auto">
                    Graded {format(new Date(detail.gradedAt), "MMM d, HH:mm")}
                  </p>
                )}
              </div>

              {/* Error notes from grader */}
              {detail.errorNotes && (
                <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle size={13} className="shrink-0 text-amber-500 mt-0.5" />
                  <p className="text-xs text-amber-800">{detail.errorNotes}</p>
                </div>
              )}

              {/* Questions by section */}
              {sections.map(([sectionName, questions]) => (
                <div key={sectionName} className="mt-4">
                  {/* Section label */}
                  <div className="px-6 py-2 bg-slate-50 border-y border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                      {sectionName}
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {questions.map((q, qi) => (
                      <div key={q.id} className="px-6 py-5 space-y-3">
                        {/* Question header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded bg-[#002388] text-white text-[10px] font-semibold mt-0.5">
                              {qi + 1}
                            </span>
                            <p className="text-sm text-slate-800 leading-relaxed">
                              {q.body}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                            {q.marks} {q.marks === 1 ? "mark" : "marks"}
                          </span>
                        </div>

                        {/* Answer + feedback */}
                        {q.sectionType === "OBJECTIVE" ? (
                          <McqQuestion q={q} />
                        ) : (
                          <SubjectiveQuestion q={q} assessmentId={assessmentId} attemptId={attemptId!} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
