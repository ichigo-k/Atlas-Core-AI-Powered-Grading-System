"use client"

import { ChevronDown, Trash2, GripVertical, Layers } from "lucide-react"

interface CollapsedQuestionRowProps {
  order: number
  body: string
  typeLabel: string
  marks: string
  onExpand: () => void
  onRemove: () => void
}

// Compact one-line summary of a question shown when it isn't being edited.
// Click anywhere to expand into the full editor; trash removes it.
export function CollapsedQuestionRow({
  order,
  body,
  typeLabel,
  marks,
  onExpand,
  onRemove,
}: CollapsedQuestionRowProps) {
  const marksNum = parseInt(String(marks)) || 0
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand() } }}
      className="group/row flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 cursor-pointer transition-colors"
    >
      <GripVertical size={15} className="text-slate-300 shrink-0" />
      <span className="w-5 shrink-0 text-center text-[13px] font-medium text-slate-500">{order}</span>
      <span className={`flex-1 truncate text-sm ${body.trim() ? "text-slate-700" : "text-slate-400 italic"}`}>
        {body.trim() || "Untitled question"}
      </span>
      <span className="shrink-0 rounded-md bg-[#002388]/8 px-2 py-0.5 text-[11px] font-medium text-[#002388]">
        {typeLabel}
      </span>
      <span className="shrink-0 text-[11px] text-slate-400 tabular-nums w-14 text-right">
        {marksNum} {marksNum === 1 ? "mark" : "marks"}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover/row:opacity-100"
      >
        <Trash2 size={14} />
      </button>
      <ChevronDown size={15} className="text-slate-400 shrink-0" />
    </div>
  )
}

interface CollapsedGroupRowProps {
  index: number
  context: string
  partCount: number
  totalMarks: string
  onExpand: () => void
  onRemove: () => void
}

// Compact one-line summary of a question group when it isn't being edited.
export function CollapsedGroupRow({
  index,
  context,
  partCount,
  totalMarks,
  onExpand,
  onRemove,
}: CollapsedGroupRowProps) {
  const marksNum = parseInt(String(totalMarks)) || 0
  const preview = context.trim()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand() } }}
      className="group/row flex items-center gap-3 px-4 py-2.5 border border-slate-200 border-l-[3px] border-l-[#002388] bg-white hover:border-slate-300 cursor-pointer transition-colors"
    >
      <Layers size={15} className="text-[#002388] shrink-0" />
      <span className="flex-1 truncate text-sm text-slate-700">
        <span className="font-medium">Group {index + 1}</span>
        {preview && <span className="text-slate-400"> — {preview}</span>}
      </span>
      <span className="shrink-0 text-[11px] text-slate-400">{partCount} {partCount === 1 ? "part" : "parts"}</span>
      <span className="shrink-0 text-[11px] text-slate-400 tabular-nums w-14 text-right">
        {marksNum} {marksNum === 1 ? "mark" : "marks"}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover/row:opacity-100"
      >
        <Trash2 size={14} />
      </button>
      <ChevronDown size={15} className="text-slate-400 shrink-0" />
    </div>
  )
}
