"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Step3State, QuestionFormState, SectionFormState, GroupFormState, SectionTypeEnum } from "@/lib/assessment-types"
import { Plus, Library, Trash2, ChevronDown, Target, PenLine, AlertCircle, Layers } from "lucide-react"
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
    groups: [],
  }
}

function newGroup(order: number): GroupFormState {
  return {
    id: crypto.randomUUID(),
    order,
    context: "",
    totalMarks: "",
    questions: [newQuestion(1)],
  }
}

// ─── Section summary helpers ──────────────────────────────────────────────────

// Sum of a group's sub-question marks (what the sub-parts currently add up to).
function groupQuestionMarks(group: GroupFormState): number {
  return group.questions.reduce((sum, q) => sum + (parseInt(q.marks) || 0), 0)
}

function sectionTotalMarks(section: SectionFormState): number {
  let base: number
  if (section.requiredQuestionsCount && section.pointsPerQuestion) {
    const req = parseInt(section.requiredQuestionsCount) || 0
    const pts = parseInt(section.pointsPerQuestion) || 0
    base = req * pts
  } else {
    base = section.questions.reduce((sum, q) => sum + (parseInt(q.marks) || 0), 0)
  }
  // Each group contributes its declared total marks.
  const groupMarks = (section.groups ?? []).reduce((sum, g) => sum + (parseInt(g.totalMarks) || 0), 0)
  return base + groupMarks
}

// A group is invalid if it has no sub-questions, any sub-question is incomplete,
// or the sub-questions' marks exceed the group's declared total.
function groupHasError(group: GroupFormState): boolean {
  if (group.questions.length === 0) return true
  if (!(parseInt(group.totalMarks) > 0)) return true
  if (groupQuestionMarks(group) > (parseInt(group.totalMarks) || 0)) return true
  return group.questions.some((q) => !q.body.trim() || !(parseInt(q.marks) > 0))
}

function sectionHasError(section: SectionFormState): boolean {
  if (!section.type) return false
  if (section.questions.some((q: any) => !q.body.trim() || !(parseInt(q.marks) > 0))) return true
  return (section.groups ?? []).some(groupHasError)
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
  const qCount = section.questions.length + (section.groups ?? []).reduce((s, g) => s + g.questions.length, 0)

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

// ─── Group card ───────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: GroupFormState
  index: number
  isObjective: boolean
  assessmentType?: string
  onChange: (updates: Partial<GroupFormState>) => void
  onRemove: () => void
  onAddQuestion: () => void
  onUpdateQuestion: (qId: string, updated: QuestionFormState) => void
  onRemoveQuestion: (qId: string) => void
}

function GroupCard({
  group,
  index,
  isObjective,
  assessmentType,
  onChange,
  onRemove,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
}: GroupCardProps) {
  const subMarks = groupQuestionMarks(group)
  const cap = parseInt(group.totalMarks) || 0
  const over = cap > 0 && subMarks > cap

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50/60 border-b border-indigo-100">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white">
          <Layers size={13} />
        </div>
        <span className="text-sm font-semibold text-indigo-900">Question Group {index + 1}</span>
        <span className="text-[11px] text-indigo-400">
          {group.questions.length} {group.questions.length === 1 ? "part" : "parts"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] text-slate-500">Total marks</Label>
            <Input
              type="number"
              min={1}
              value={group.totalMarks}
              onChange={(e) => onChange({ totalMarks: e.target.value })}
              placeholder="—"
              className="h-8 w-20 border-slate-200 bg-white text-sm focus-visible:ring-indigo-300"
            />
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Shared context */}
        <div className="space-y-1">
          <Label className="text-[11px] text-slate-500 uppercase tracking-wider">
            Shared context <span className="text-slate-300 normal-case">(optional)</span>
          </Label>
          <textarea
            value={group.context}
            onChange={(e) => onChange({ context: e.target.value })}
            placeholder="Shared passage / scenario shown above all sub-questions. Leave blank to just group them."
            rows={3}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
          />
        </div>

        {/* Marks tally / cap warning */}
        <div className={cn(
          "flex items-center gap-2 text-[12px]",
          over ? "text-rose-600" : "text-slate-500",
        )}>
          {over && <AlertCircle size={13} />}
          <span>
            Sub-questions total <strong>{subMarks}</strong>
            {cap > 0 && <> / {cap} marks{over && " — exceeds the group total"}</>}
          </span>
        </div>

        {/* Sub-questions */}
        <div className="space-y-3">
          {group.questions.map((q, idx) =>
            isObjective ? (
              <QuestionBuilderA
                key={q.id}
                question={q}
                onChange={(updated) => onUpdateQuestion(q.id, updated)}
                onRemove={() => onRemoveQuestion(q.id)}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                isFirst={idx === 0}
                isLast={idx === group.questions.length - 1}
                readonlyMarks={false}
              />
            ) : (
              <QuestionBuilderB
                key={q.id}
                question={q}
                onChange={(updated) => onUpdateQuestion(q.id, updated)}
                onRemove={() => onRemoveQuestion(q.id)}
                onMoveUp={() => {}}
                onMoveDown={() => {}}
                isFirst={idx === 0}
                isLast={idx === group.questions.length - 1}
                readonlyMarks={false}
                assessmentType={assessmentType}
              />
            ),
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddQuestion}
          className="h-8 px-3 text-xs text-indigo-700 hover:bg-indigo-100"
        >
          <Plus size={13} className="mr-1.5" />
          Add sub-question
        </Button>
      </div>
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
      sections: state.sections.map((s: any) => {
        if (s.id !== id) return s
        const next = { ...s, ...updates }
        if ("pointsPerQuestion" in updates) {
          next.questions = next.questions.map((q: any) => ({ ...q, marks: updates.pointsPerQuestion! }))
        }
        return next
      }),
    })
  }

  const removeSection = (id: string) => {
    const remaining = state.sections.filter((s: any) => s.id !== id)
    onChange({ sections: remaining })
    if (openSectionId === id) {
      setOpenSectionId(remaining[remaining.length - 1]?.id ?? null)
    }
  }

  const addQuestion = (sectionId: string) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        return { ...s, questions: [...s.questions, newQuestion(s.questions.length + 1)] }
      }),
    })
  }

  const updateQuestion = (sectionId: string, qId: string, updated: QuestionFormState) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        return { ...s, questions: s.questions.map((q: any) => (q.id === qId ? updated : q)) }
      }),
    })
  }

  const removeQuestion = (sectionId: string, qId: string) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        let order = 1
        return { ...s, questions: s.questions.filter((q: any) => q.id !== qId).map((q: any) => ({ ...q, order: order++ })) }
      }),
    })
  }

  const moveQuestion = (sectionId: string, qId: string, direction: "up" | "down") => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        const idx = s.questions.findIndex((q: QuestionFormState) => q.id === qId)
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
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        let nextOrder = s.questions.length + 1
        return { ...s, questions: [...s.questions, ...imported.map((q: any) => ({ ...q, order: nextOrder++ }))] }
      }),
    })
    setBankModal({ open: false, sectionId: null, type: "" })
  }

  // ── Group handlers ───────────────────────────────────────────────────────────

  const addGroup = (sectionId: string) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        const groups = s.groups ?? []
        return { ...s, groups: [...groups, newGroup(groups.length + 1)] }
      }),
    })
  }

  const updateGroup = (sectionId: string, groupId: string, updates: Partial<GroupFormState>) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        return { ...s, groups: (s.groups ?? []).map((g: any) => (g.id === groupId ? { ...g, ...updates } : g)) }
      }),
    })
  }

  const removeGroup = (sectionId: string, groupId: string) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        return { ...s, groups: (s.groups ?? []).filter((g: any) => g.id !== groupId) }
      }),
    })
  }

  const addGroupQuestion = (sectionId: string, groupId: string) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        return {
          ...s,
          groups: (s.groups ?? []).map((g: any) =>
            g.id === groupId ? { ...g, questions: [...g.questions, newQuestion(g.questions.length + 1)] } : g,
          ),
        }
      }),
    })
  }

  const updateGroupQuestion = (sectionId: string, groupId: string, qId: string, updated: QuestionFormState) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        return {
          ...s,
          groups: (s.groups ?? []).map((g: any) =>
            g.id === groupId
              ? { ...g, questions: g.questions.map((q: any) => (q.id === qId ? updated : q)) }
              : g,
          ),
        }
      }),
    })
  }

  const removeGroupQuestion = (sectionId: string, groupId: string, qId: string) => {
    onChange({
      sections: state.sections.map((s: any) => {
        if (s.id !== sectionId) return s
        return {
          ...s,
          groups: (s.groups ?? []).map((g: any) => {
            if (g.id !== groupId) return g
            let order = 1
            return { ...g, questions: g.questions.filter((q: any) => q.id !== qId).map((q: any) => ({ ...q, order: order++ })) }
          }),
        }
      }),
    })
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
                              variant="ghost"
                              size="sm"
                              onClick={() => addGroup(section.id)}
                              className="h-8 px-3 text-xs text-indigo-700 hover:bg-indigo-50"
                            >
                              <Layers size={13} className="mr-1.5" />
                              Add Group
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

                        {section.questions.length === 0 && (section.groups ?? []).length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
                            <p className="text-sm text-slate-400">No questions yet. Add a question or a group above.</p>
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

                            {/* Question groups */}
                            {(section.groups ?? []).map((g, gIdx) => (
                              <GroupCard
                                key={g.id}
                                group={g}
                                index={gIdx}
                                isObjective={isObjective}
                                assessmentType={assessmentType}
                                onChange={(updates) => updateGroup(section.id, g.id, updates)}
                                onRemove={() => removeGroup(section.id, g.id)}
                                onAddQuestion={() => addGroupQuestion(section.id, g.id)}
                                onUpdateQuestion={(qId, updated) => updateGroupQuestion(section.id, g.id, qId, updated)}
                                onRemoveQuestion={(qId) => removeGroupQuestion(section.id, g.id, qId)}
                              />
                            ))}
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
