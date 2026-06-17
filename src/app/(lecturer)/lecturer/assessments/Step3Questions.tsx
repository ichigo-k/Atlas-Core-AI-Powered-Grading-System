"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Step3State, QuestionFormState, SectionFormState, SectionTypeEnum } from "@/lib/assessment-types"
import { Plus, Library, Trash2, ChevronDown, Target, PenLine, AlertCircle } from "lucide-react"
import QuestionBuilderA from "./QuestionBuilderA"
import QuestionBuilderB from "./QuestionBuilderB"
import ImportFromBankModal from "./ImportFromBankModal"
import { cn } from "@/lib/utils"

interface Step3QuestionsProps {
  state: Step3State
  onChange: (s: Step3State) => void
  errors: Record<string, string>
  courseId: number | null
  assessmentType?: string
}

function newQuestion(order: number): QuestionFormState {
  return {
    id: crypto.randomUUID(),
    order,
    body: "",
    marks: "",
    answerType: "",
    options: ["", ""],
    correctOption: null,
    rubricCriteria: [],
  }
}

function newSection(): SectionFormState {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "",
    requiredQuestionsCount: "",
    pointsPerQuestion: "",
    questions: [],
  }
}

// ─── Section summary helpers ──────────────────────────────────────────────────

function sectionTotalMarks(section: SectionFormState): number {
  if (section.requiredQuestionsCount && section.pointsPerQuestion) {
    const req = parseInt(section.requiredQuestionsCount) || 0
    const pts = parseInt(section.pointsPerQuestion) || 0
    return req * pts
  }
  return section.questions.reduce((sum, q) => sum + (parseInt(q.marks) || 0), 0)
}

function sectionHasError(section: SectionFormState): boolean {
  if (!section.type) return false
  return section.questions.some((q) => !q.body.trim() || !(parseInt(q.marks) > 0))
}

// ─── Section accordion header ─────────────────────────────────────────────────

interface SectionHeaderProps {
  section: SectionFormState
  index: number
  isOpen: boolean
  onToggle: () => void
  onRemove: () => void
}

function SectionHeader({ section, index, isOpen, onToggle, onRemove }: SectionHeaderProps) {
  const totalMarks = sectionTotalMarks(section)
  const hasError = sectionHasError(section)
  const isObjective = section.type === "OBJECTIVE"
  const isSubjective = section.type === "SUBJECTIVE"
  const TypeIcon = isObjective ? Target : isSubjective ? PenLine : null
  const required = parseInt(section.requiredQuestionsCount) || null
  const qCount = section.questions.length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      className={cn(
        "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors cursor-pointer",
        isOpen ? "bg-white" : "bg-slate-50/60 hover:bg-slate-50"
      )}
    >
      {/* Index badge */}
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition-colors",
        isOpen ? "bg-[#002388] text-white" : "bg-slate-200 text-slate-600"
      )}>
        {index + 1}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-sm font-semibold truncate",
            section.name ? "text-slate-900" : "text-slate-400 italic"
          )}>
            {section.name || "Untitled section"}
          </span>
          {hasError && (
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
        </div>

        {/* Summary pills — only when collapsed */}
        {!isOpen && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {section.type && (
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border",
                isObjective
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-purple-50 text-purple-700 border-purple-200"
              )}>
                {TypeIcon && <TypeIcon className="h-2.5 w-2.5" />}
                {isObjective ? "Objective" : "Subjective"}
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              {qCount} {qCount === 1 ? "question" : "questions"}
            </span>
            {required && (
              <span className="text-[11px] text-slate-400">
                · {required} required
              </span>
            )}
            {totalMarks > 0 && (
              <span className="text-[11px] font-semibold text-slate-600">
                · {totalMarks} marks
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side: marks chip + delete + chevron */}
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        {totalMarks > 0 && isOpen && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#002388]/8 text-[#002388] border border-[#002388]/15">
            {totalMarks} marks
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <ChevronDown
        size={16}
        className={cn(
          "text-slate-400 transition-transform duration-200 shrink-0",
          isOpen && "rotate-180"
        )}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Step3Questions({ state, onChange, errors, courseId, assessmentType }: Step3QuestionsProps) {
  const [openSectionId, setOpenSectionId] = useState<string | null>(
    state.sections[0]?.id ?? null
  )
  const [bankModal, setBankModal] = useState<{ open: boolean; sectionId: string | null; type: string }>({
    open: false, sectionId: null, type: "",
  })

  const toggleSection = (id: string) => {
    setOpenSectionId((prev) => (prev === id ? null : id))
  }

  const addSection = () => {
    const s = newSection()
    onChange({ sections: [...state.sections, s] })
    setOpenSectionId(s.id)
  }

  const updateSection = (id: string, updates: Partial<SectionFormState>) => {
    onChange({
      sections: state.sections.map((s) => {
        if (s.id !== id) return s
        const next = { ...s, ...updates }
        if ("pointsPerQuestion" in updates) {
          next.questions = next.questions.map((q) => ({ ...q, marks: updates.pointsPerQuestion! }))
        }
        return next
      }),
    })
  }

  const removeSection = (id: string) => {
    const remaining = state.sections.filter((s) => s.id !== id)
    onChange({ sections: remaining })
    if (openSectionId === id) {
      setOpenSectionId(remaining[remaining.length - 1]?.id ?? null)
    }
  }

  const addQuestion = (sectionId: string) => {
    onChange({
      sections: state.sections.map((s) => {
        if (s.id !== sectionId) return s
        return { ...s, questions: [...s.questions, newQuestion(s.questions.length + 1)] }
      }),
    })
  }

  const updateQuestion = (sectionId: string, qId: string, updated: QuestionFormState) => {
    onChange({
      sections: state.sections.map((s) => {
        if (s.id !== sectionId) return s
        return { ...s, questions: s.questions.map((q) => (q.id === qId ? updated : q)) }
      }),
    })
  }

  const removeQuestion = (sectionId: string, qId: string) => {
    onChange({
      sections: state.sections.map((s) => {
        if (s.id !== sectionId) return s
        let order = 1
        return { ...s, questions: s.questions.filter((q) => q.id !== qId).map((q) => ({ ...q, order: order++ })) }
      }),
    })
  }

  const moveQuestion = (sectionId: string, qId: string, direction: "up" | "down") => {
    onChange({
      sections: state.sections.map((s) => {
        if (s.id !== sectionId) return s
        const idx = s.questions.findIndex((q) => q.id === qId)
        if (idx === -1) return s
        const swapIdx = direction === "up" ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= s.questions.length) return s
        const qs = [...s.questions]
        const tempOrder = qs[idx].order
        qs[idx].order = qs[swapIdx].order
        qs[swapIdx].order = tempOrder
        qs.sort((a, b) => a.order - b.order)
        return { ...s, questions: qs }
      }),
    })
  }

  const handleImport = (imported: QuestionFormState[]) => {
    const { sectionId } = bankModal
    if (!sectionId) return
    onChange({
      sections: state.sections.map((s) => {
        if (s.id !== sectionId) return s
        let nextOrder = s.questions.length + 1
        return { ...s, questions: [...s.questions, ...imported.map((q) => ({ ...q, order: nextOrder++ }))] }
      }),
    })
    setBankModal({ open: false, sectionId: null, type: "" })
  }

  return (
    <div className="space-y-3">
      {state.sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">No sections yet. Add a section to start building questions.</p>
        </div>
      )}

      {/* Accordion */}
      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {state.sections.map((section, secIdx) => {
          const isOpen = openSectionId === section.id
          const isObjective = section.type === "OBJECTIVE"

          return (
            <div key={section.id} className="bg-white">
              <SectionHeader
                section={section}
                index={secIdx}
                isOpen={isOpen}
                onToggle={() => toggleSection(section.id)}
                onRemove={() => removeSection(section.id)}
              />

              {/* Accordion body */}
              {isOpen && (
                <div className="border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-150" onClick={(e) => e.stopPropagation()}>
                  {/* Section config */}
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40">
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Name */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Section Name</Label>
                        <Input
                          value={section.name}
                          onChange={(e) => updateSection(section.id, { name: e.target.value })}
                          placeholder="e.g. Section A — Multiple Choice"
                          className="h-9 border-slate-200 bg-white text-sm focus-visible:ring-[#002388]/30"
                        />
                      </div>

                      {/* Type */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Question Type</Label>
                        <Select
                          value={section.type}
                          onValueChange={(v: SectionTypeEnum) => updateSection(section.id, { type: v })}
                        >
                          <SelectTrigger className="h-9 border-slate-200 bg-white text-sm focus:ring-[#002388]/30">
                            <SelectValue placeholder="Select type…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OBJECTIVE">Objective (MCQ)</SelectItem>
                            <SelectItem value="SUBJECTIVE">Subjective (Open Ended)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Required count */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Questions to Answer</Label>
                        <Input
                          type="number"
                          min={1}
                          value={section.requiredQuestionsCount}
                          onChange={(e) => updateSection(section.id, { requiredQuestionsCount: e.target.value })}
                          placeholder="Leave blank for all"
                          className="h-9 border-slate-200 bg-white text-sm focus-visible:ring-[#002388]/30"
                        />
                      </div>

                      {/* Points per question — only when required count is set */}
                      {section.requiredQuestionsCount && (
                        <div className="flex-1 space-y-1 animate-in fade-in duration-200">
                          <Label className="text-[11px] text-slate-500 uppercase tracking-wider">Points / Question</Label>
                          <Input
                            type="number"
                            min={1}
                            value={section.pointsPerQuestion}
                            onChange={(e) => updateSection(section.id, { pointsPerQuestion: e.target.value })}
                            placeholder="Marks"
                            className="h-9 border-slate-200 bg-white text-sm focus-visible:ring-[#002388]/30"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Questions area */}
                  <div className="px-5 py-4">
                    {section.type ? (
                      <div className="space-y-4">
                        {/* Toolbar */}
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">
                            {section.questions.length} {section.questions.length === 1 ? "question" : "questions"}
                            {section.requiredQuestionsCount && (
                              <span className="text-slate-400"> · {section.requiredQuestionsCount} required to answer</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setBankModal({ open: true, sectionId: section.id, type: section.type })}
                              className="h-8 px-3 text-xs text-[#002388] hover:bg-[#002388]/5"
                            >
                              <Library size={13} className="mr-1.5" />
                              Import from Bank
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => addQuestion(section.id)}
                              className="h-8 px-3 text-xs bg-[#002388] hover:bg-[#0B4DBB] text-white"
                            >
                              <Plus size={13} className="mr-1.5" />
                              Add Question
                            </Button>
                          </div>
                        </div>

                        {section.questions.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                            <p className="text-sm text-slate-400">No questions yet. Add one above.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {section.questions.map((q, idx) =>
                              isObjective ? (
                                <QuestionBuilderA
                                  key={q.id}
                                  question={q}
                                  onChange={(updated) => updateQuestion(section.id, q.id, updated)}
                                  onRemove={() => removeQuestion(section.id, q.id)}
                                  onMoveUp={() => moveQuestion(section.id, q.id, "up")}
                                  onMoveDown={() => moveQuestion(section.id, q.id, "down")}
                                  isFirst={idx === 0}
                                  isLast={idx === section.questions.length - 1}
                                  readonlyMarks={!!section.requiredQuestionsCount}
                                />
                              ) : (
                                <QuestionBuilderB
                                  key={q.id}
                                  question={q}
                                  onChange={(updated) => updateQuestion(section.id, q.id, updated)}
                                  onRemove={() => removeQuestion(section.id, q.id)}
                                  onMoveUp={() => moveQuestion(section.id, q.id, "up")}
                                  onMoveDown={() => moveQuestion(section.id, q.id, "down")}
                                  isFirst={idx === 0}
                                  isLast={idx === section.questions.length - 1}
                                  readonlyMarks={!!section.requiredQuestionsCount}
                                  assessmentType={assessmentType}
                                />
                              )
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                        <p className="text-sm text-slate-400">Select a question type above to start adding questions.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add section */}
      <button
        type="button"
        onClick={addSection}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-[#002388]/30 hover:text-[#002388] hover:bg-[#002388]/5 transition-all text-sm"
      >
        <Plus size={16} />
        Add Section
      </button>

      <ImportFromBankModal
        open={bankModal.open}
        onClose={() => setBankModal({ open: false, sectionId: null, type: "" })}
        onImport={handleImport}
        courseId={courseId}
        type={bankModal.type}
      />
    </div>
  )
}
