"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { QuestionFormState } from "@/lib/assessment-types"
import { ChevronUp, ChevronDown, Trash2, Plus, X } from "lucide-react"
import { CollapsedQuestionRow } from "./QuestionRow"

interface QuestionBuilderAProps {
  question: QuestionFormState
  onChange: (q: QuestionFormState) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  readonlyMarks?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

export default function QuestionBuilderA({
  question,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  readonlyMarks = false,
  collapsed = false,
  onToggleCollapsed,
}: QuestionBuilderAProps) {
  if (collapsed && onToggleCollapsed) {
    return (
      <CollapsedQuestionRow
        order={question.order}
        body={question.body}
        typeLabel="MCQ"
        marks={question.marks}
        onExpand={onToggleCollapsed}
        onRemove={onRemove}
      />
    )
  }

  const updateOption = (index: number, value: string) => {
    const options = [...question.options]
    options[index] = value
    onChange({ ...question, options })
  }

  const addOption = () => {
    onChange({ ...question, options: [...question.options, ""] })
  }

  const removeOption = (index: number) => {
    if (question.options.length <= 2) return
    const options = question.options.filter((_, i) => i !== index)
    const correctOption =
      question.correctOption === index
        ? null
        : question.correctOption !== null && question.correctOption > index
          ? question.correctOption - 1
          : question.correctOption
    onChange({ ...question, options, correctOption })
  }

  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          disabled={!onToggleCollapsed}
          className="flex items-center gap-2.5 disabled:cursor-default"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white text-[11px] font-medium">
            {question.order}
          </div>
          <span className="text-xs text-slate-400">Objective</span>
          {onToggleCollapsed && <ChevronUp size={14} className="text-slate-400" />}
        </button>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 text-slate-400 hover:text-[#002388] hover:bg-[#002388]/5 rounded-md transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 text-slate-400 hover:text-[#002388] hover:bg-[#002388]/5 rounded-md transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronDown size={15} />
          </button>
          <div className="w-px h-3.5 bg-slate-200 mx-1" />
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Question body + marks */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4 items-start">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Question</Label>
            <textarea
              value={question.body}
              onChange={(e) => onChange({ ...question, body: e.target.value })}
              placeholder="Type your question here..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none resize-none focus:border-[#002388]/40 focus:ring-2 focus:ring-[#002388]/10 transition-all placeholder:text-slate-400 leading-relaxed"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500 uppercase tracking-wider text-center block">Marks</Label>
            <Input
              type="number"
              min={1}
              value={question.marks}
              onChange={(e) => onChange({ ...question, marks: e.target.value })}
              placeholder="0"
              disabled={readonlyMarks}
              className={`h-11 border-slate-200 bg-white text-center font-medium text-base focus-visible:ring-[#002388]/30 ${
                readonlyMarks ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            {readonlyMarks && (
              <p className="text-[10px] text-center text-slate-400 italic">Synced to section</p>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Answer Options</Label>
            <span className="text-[10px] text-slate-400">Click radio to mark correct</span>
          </div>

          <div className="space-y-2">
            {question.options.map((opt, i) => {
              const isCorrect = question.correctOption === i
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                    isCorrect
                      ? "border-[#002388]/20 bg-[#002388]/5"
                      : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onChange({ ...question, correctOption: i })}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      isCorrect ? "border-[#002388]" : "border-slate-300 bg-white"
                    }`}
                  >
                    {isCorrect && <div className="h-2 w-2 rounded-full bg-[#002388]" />}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="h-8 border-none bg-transparent focus-visible:ring-0 shadow-none text-sm px-0"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={question.options.length <= 2}
                    className="p-1 text-slate-300 hover:text-rose-500 rounded transition-all disabled:hidden opacity-0 group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={addOption}
            className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 hover:text-[#002388] hover:border-[#002388]/30 hover:bg-[#002388]/5 transition-all"
          >
            <Plus size={13} />
            Add option
          </button>
        </div>
      </div>
    </div>
  )
}
