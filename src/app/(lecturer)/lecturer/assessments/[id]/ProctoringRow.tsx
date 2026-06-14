"use client"

import { useState, useTransition } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import type { ProctoringAttemptRow } from "@/lib/proctor-queries"
import type { ProctoringLogEntry } from "@/lib/proctor-log"
import { getProctoringLogAction } from "./proctor-actions"

interface Props {
  row: ProctoringAttemptRow
  userId: number
}

function FlagBadge({ flagCount, flagThreshold }: { flagCount: number; flagThreshold: number }) {
  let cls: string
  if (flagCount === 0) {
    cls = "bg-green-50 text-green-700 border-green-200"
  } else if (flagCount < flagThreshold) {
    cls = "bg-amber-50 text-amber-700 border-amber-200"
  } else {
    cls = "bg-red-50 text-red-700 border-red-200"
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${cls}`}
    >
      {flagCount}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    ENDED: "bg-slate-100 text-slate-600 border-slate-200",
    TIMED_OUT: "bg-red-50 text-red-700 border-red-200",
  }
  const cls = map[status] ?? "bg-slate-100 text-slate-500 border-slate-200"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {status.replace("_", " ")}
    </span>
  )
}

export default function ProctoringRow({ row, userId }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [log, setLog] = useState<ProctoringLogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (log !== null) return
    startTransition(async () => {
      try {
        const entries = await getProctoringLogAction(row.attemptId, userId)
        setLog(entries)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load log")
      }
    })
  }

  return (
    <>
      <tr
        className="hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
        onClick={handleToggle}
      >
        <td className="px-5 py-3.5 text-sm text-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 shrink-0">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            {row.studentName ?? <span className="italic text-slate-400">Unknown</span>}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <FlagBadge flagCount={row.flagCount} flagThreshold={row.flagThreshold} />
        </td>
        <td className="px-5 py-3.5">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-5 py-3.5 text-xs text-slate-500">
          {format(new Date(row.consentAt), "MMM d, yyyy · HH:mm")}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={4} className="px-0 py-0 bg-slate-50 border-b border-slate-100">
            <div className="px-8 py-4">
              {isPending && (
                <p className="text-xs text-slate-400 animate-pulse">Loading log…</p>
              )}
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              {!isPending && !error && log !== null && log.length === 0 && (
                <p className="text-xs text-slate-400 italic">No log entries for this attempt.</p>
              )}
              {!isPending && !error && log !== null && log.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="pb-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider pr-4">Violation</th>
                        <th className="pb-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider pr-4">Source</th>
                        <th className="pb-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider pr-4">Confidence</th>
                        <th className="pb-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider pr-4">Detected At</th>
                        <th className="pb-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider pr-4">Flags After</th>
                        <th className="pb-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Thumbnail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {log.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-white transition-colors">
                          <td className="py-2 pr-4 text-slate-800 font-medium">{entry.violationType}</td>
                          <td className="py-2 pr-4">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              entry.source === "ORACLE"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {entry.source}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {entry.confidence !== null ? entry.confidence.toFixed(3) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {format(new Date(entry.detectedAt), "MMM d, yyyy · HH:mm:ss")}
                          </td>
                          <td className="py-2 pr-4 text-slate-700 font-medium">{entry.flagCountAfter}</td>
                          <td className="py-2">
                            {entry.thumbnailBase64 ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`data:image/jpeg;base64,${entry.thumbnailBase64}`}
                                alt="Thumbnail"
                                style={{ maxWidth: 160 }}
                                className="rounded border border-slate-200"
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
