"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { QuestionFormState } from "@/lib/assessment-types"
import { ChevronUp, ChevronDown, Trash2, Plus, X } from "lucide-react"

interface QuestionBuilderBProps {
  question: QuestionFormState
  onChange: (q: QuestionFormState) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  readonlyMarks?: boolean
  assessmentType?: string
}

export default function QuestionBuilderB({
  question,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  readonlyMarks = false,
  assessmentType,
}: QuestionBuilderBProps) {
  const addCriterion = () => {
    onChange({
      ...question,
      rubricCriteria: [
        ...question.rubricCriteria,
        {
          id: crypto.randomUUID(),
          description: "",
          maxMarks: "",
          order: question.rubricCriteria.length + 1,
        },
      ],
    })
  }

  const updateCriterion = (id: string, field: "description" | "maxMarks", value: string) => {
    onChange({
      ...question,
      rubricCriteria: question.rubricCriteria.map((c: any) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    })
  }

  const removeCriterion = (id: string) => {
    const updated = question.rubricCriteria
      .filter((c: any) => c.id !== id)
      .map((c, i) => ({ ...c, order: i + 1 }))
    onChange({ ...question, rubricCriteria: updated })
  }

  const questionMarks = parseInt(String(question.marks)) || 0
  const rubricTotal = question.rubricCriteria.reduce(
    (sum, c) => sum + (parseInt(String(c.maxMarks)) || 0),
    0
  )
  const rubricOverLimit = questionMarks > 0 && rubricTotal > questionMarks

  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white text-[11px] font-medium">
            {question.order}
          </div>
          <span className="text-xs text-slate-400">Subjective</span>
        </div>

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
        {/* Question body */}
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

        {/* Config row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Answer Format</Label>
            <Select
              value={question.answerType}
              onValueChange={(v) => onChange({ ...question, answerType: v as QuestionFormState["answerType"] })}
            >
              <SelectTrigger className="h-9 border-slate-200 bg-white text-sm focus:ring-[#002388]/30">
                <SelectValue placeholder="Select format..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FILL_IN">Text / Rich Editor</SelectItem>
                {assessmentType === "ASSIGNMENT" && (
                  <SelectItem value="PDF_UPLOAD">PDF Upload</SelectItem>
                )}
                <SelectItem value="CODE">Code Sandbox</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Marks</Label>
            <Input
              type="number"
              min={1}
              value={question.marks}
              onChange={(e) => onChange({ ...question, marks: e.target.value })}
              placeholder="0"
              disabled={readonlyMarks}
              className={`h-9 border-slate-200 bg-white text-center font-medium focus-visible:ring-[#002388]/30 ${
                readonlyMarks ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            {readonlyMarks && (
              <p className="text-[10px] text-center text-slate-400 italic">Synced to section</p>
            )}
          </div>
        </div>

        {/* Rubric */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Grading Rubric</Label>
              <p className="text-[10px] text-slate-400 mt-0.5">Define how AI distributes marks</p>
            </div>
            <button
              type="button"
              onClick={addCriterion}
              className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-[#002388] bg-[#002388]/5 hover:bg-[#002388]/10 transition-all"
            >
              <Plus size={12} />
              Add Criterion
            </button>
          </div>

          {question.rubricCriteria.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <p className="text-xs text-slate-400">No rubric criteria yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {question.rubricCriteria.map((criterion: any) => (
                <div
                  key={criterion.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50/50 hover:border-slate-200 transition-all"
                >
                  <div className="flex-1">
                    <Input
                      value={criterion.description}
                      onChange={(e) => updateCriterion(criterion.id, "description", e.target.value)}
                      placeholder="e.g. Correct use of data structures"
                      className="h-8 border-none bg-transparent focus-visible:ring-0 shadow-none text-sm px-0"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">Max:</span>
                    <Input
                      type="number"
                      min={1}
                      value={criterion.maxMarks}
                      onChange={(e) => updateCriterion(criterion.id, "maxMarks", e.target.value)}
                      placeholder="0"
                      className={`h-8 w-16 text-center text-sm font-medium focus-visible:ring-[#002388]/30 ${
                        rubricOverLimit ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => removeCriterion(criterion.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 rounded transition-all"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Rubric total */}
              <div className={`flex items-center justify-end gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                rubricOverLimit
                  ? "bg-red-50 text-red-600"
                  : rubricTotal === questionMarks && questionMarks > 0
                  ? "bg-green-50 text-green-600"
                  : "bg-slate-50 text-slate-500"
              }`}>
                <span>Rubric total:</span>
                <span>{rubricTotal} / {questionMarks || "?"}</span>
                {rubricOverLimit && (
                  <span className="text-red-500">— exceeds question marks by {rubricTotal - questionMarks}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
