"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileSpreadsheet,
  Loader2,
  BookOpen,
  Target,
  PenLine,
  Library,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LecturerDetailSkeleton } from "@/components/ui/page-loaders"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import QuestionBuilderA from "@/app/(lecturer)/lecturer/assessments/QuestionBuilderA"
import QuestionBuilderB from "@/app/(lecturer)/lecturer/assessments/QuestionBuilderB"
import type { QuestionFormState, AnswerTypeEnum } from "@/lib/assessment-types"
import ExcelImportModal from "../ExcelImportModal"

// ─── Types ────────────────────────────────────────────────────────────────────

type BankItemType = "OBJECTIVE" | "SUBJECTIVE"

interface RubricItem {
  id: number
  description: string
  maxMarks: number
  order: number
}

interface BankItem {
  id: number
  type: BankItemType
  body: string
  marks: number
  answerType: AnswerTypeEnum | null
  options: string[] | null
  correctOption: number | null
  createdAt: string
  rubricCriteria: RubricItem[]
}

interface BankDetail {
  id: number
  title: string
  course: { code: string; title: string } | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newQuestionForm(): QuestionFormState {
  return {
    id: crypto.randomUUID(),
    order: 1,
    body: "",
    marks: "",
    answerType: "",
    options: ["", ""],
    correctOption: null,
    rubricCriteria: [],
  }
}

// ─── Add Item Sheet ────────────────────────────────────────────────────────────

interface AddItemSheetProps {
  open: boolean
  bankId: number
  onAdded: () => void
  onClose: () => void
}

function AddItemSheet({ open, bankId, onAdded, onClose }: AddItemSheetProps) {
  const [itemType, setItemType] = useState<BankItemType | "">("")
  const [question, setQuestion] = useState<QuestionFormState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleTypeChange = (val: BankItemType) => {
    setItemType(val)
    setQuestion(newQuestionForm())
  }

  const handleClose = () => {
    setItemType("")
    setQuestion(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!question || !itemType) return
    if (!question.body.trim()) { toast.error("Question body is required"); return }
    const marks = parseInt(String(question.marks))
    if (!marks || marks < 1) { toast.error("Marks must be at least 1"); return }
    if (itemType === "OBJECTIVE") {
      const validOptions = question.options.filter((o: any) => o.trim())
      if (validOptions.length < 2) { toast.error("Need at least 2 options"); return }
      if (question.correctOption === null) { toast.error("Please select the correct answer"); return }
    }
    if (itemType === "SUBJECTIVE" && !question.answerType) {
      toast.error("Please select an answer type"); return
    }
    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = { type: itemType, body: question.body, marks }
      if (itemType === "OBJECTIVE") {
        payload.options = question.options.filter((o: any) => o.trim())
        payload.correctOption = question.correctOption
      }
      if (itemType === "SUBJECTIVE") {
        payload.answerType = question.answerType
        if (question.rubricCriteria.length > 0) {
          payload.rubricCriteria = question.rubricCriteria.map((c, i) => ({
            description: c.description,
            maxMarks: parseInt(c.maxMarks) || 0,
            order: i + 1,
          }))
        }
      }
      const res = await fetch(`/api/lecturer/question-banks/${bankId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to add item")
      }
      toast.success("Question added")
      onAdded()
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add item")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="sm:max-w-lg w-full flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b border-slate-100">
          <SheetTitle>Add Question</SheetTitle>
          <SheetDescription>Add a single question to this bank manually.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Question Type <span className="text-red-500">*</span>
            </Label>
            <Select value={itemType} onValueChange={(v) => handleTypeChange(v as BankItemType)}>
              <SelectTrigger className="w-full rounded-xl border-slate-200">
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OBJECTIVE">Objective — Multiple Choice (MCQ)</SelectItem>
                <SelectItem value="SUBJECTIVE">Subjective — Open-ended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {question && itemType === "OBJECTIVE" && (
            <QuestionBuilderA
              question={question}
              onChange={setQuestion}
              onRemove={handleClose}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
              isFirst
              isLast
            />
          )}
          {question && itemType === "SUBJECTIVE" && (
            <QuestionBuilderB
              question={question}
              onChange={setQuestion}
              onRemove={handleClose}
              onMoveUp={() => {}}
              onMoveDown={() => {}}
              isFirst
              isLast
            />
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-slate-100 flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !question}
            className="rounded-xl bg-[#002388] hover:bg-[#002388]/90 gap-1.5"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
            ) : (
              <><Plus className="h-4 w-4" />Save Question</>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Questions Table ───────────────────────────────────────────────────────────

interface QuestionsTableProps {
  items: BankItem[]
  onDelete: (item: BankItem) => void
}

function QuestionsTable({ items, onDelete }: QuestionsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
        <p className="text-sm text-slate-400">No questions in this section yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="pl-4 w-8 text-xs text-slate-400">#</TableHead>
            <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Question</TableHead>
            <TableHead className="w-20 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Marks</TableHead>
            <TableHead className="w-28 text-xs font-semibold text-slate-500 uppercase tracking-wider">Answer Type</TableHead>
            <TableHead className="w-10 pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={item.id} className="group">
              <TableCell className="pl-4 text-xs text-slate-400 w-8">{idx + 1}</TableCell>
              <TableCell className="text-sm text-slate-800 max-w-xl">
                <p className="line-clamp-2 leading-relaxed">{item.body}</p>
                {item.type === "OBJECTIVE" && Array.isArray(item.options) && item.options.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.options.map((opt, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${
                          item.correctOption === i
                            ? "bg-green-50 border-green-200 text-green-700 font-semibold"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}
                      >
                        <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                        {item.correctOption === i && (
                          <span className="text-green-600">✓</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {item.rubricCriteria.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {item.rubricCriteria.length} rubric {item.rubricCriteria.length === 1 ? "criterion" : "criteria"}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right text-sm font-semibold text-slate-700 pr-4">
                {item.marks}
              </TableCell>
              <TableCell>
                {item.answerType ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border bg-slate-50 text-slate-600 border-slate-200">
                    {item.answerType.replace("_", " ")}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">MCQ</span>
                )}
              </TableCell>
              <TableCell className="pr-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(item)}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BankDetailClient({ bankId }: { bankId: number }) {
  const router = useRouter()
  const [bank, setBank] = useState<BankDetail | null>(null)
  const [items, setItems] = useState<BankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [deleteItem, setDeleteItem] = useState<BankItem | null>(null)
  const [isDeletingItem, setIsDeletingItem] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [banksRes, itemsRes] = await Promise.all([
        fetch("/api/lecturer/question-banks"),
        fetch(`/api/lecturer/question-banks/${bankId}/items`),
      ])
      if (!banksRes.ok || !itemsRes.ok) throw new Error()

      const banks = await banksRes.json()
      const found = banks.find((b: BankDetail & { id: number }) => b.id === bankId)
      if (!found) { router.push("/lecturer/question-bank"); return }
      setBank(found)

      const data: BankItem[] = await itemsRes.json()
      setItems(data)
    } catch {
      toast.error("Failed to load bank")
    } finally {
      setLoading(false)
    }
  }, [bankId, router])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDeleteItem = async () => {
    if (!deleteItem) return
    setIsDeletingItem(true)
    try {
      const res = await fetch(
        `/api/lecturer/question-banks/${bankId}/items/${deleteItem.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error()
      toast.success("Question deleted")
      setItems((prev) => prev.filter((i: any) => i.id !== deleteItem.id))
      setDeleteItem(null)
    } catch {
      toast.error("Failed to delete question")
    } finally {
      setIsDeletingItem(false)
    }
  }

  const objective = items.filter((i: any) => i.type === "OBJECTIVE")
  const subjective = items.filter((i: any) => i.type === "SUBJECTIVE")

  if (loading) {
    return <div className="px-4 py-5 md:px-6 lg:px-8"><LecturerDetailSkeleton /></div>
  }

  if (!bank) return null

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] pb-16 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <BookOpen className="text-[#002388]" size={24} />
            {bank.title}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {bank.course && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border bg-blue-50 text-blue-700 border-blue-200">
                {bank.course.code} — {bank.course.title}
              </span>
            )}
            {objective.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="font-bold">{objective.length}</span> Objective
              </span>
            )}
            {subjective.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                <span className="font-bold">{subjective.length}</span> Subjective
              </span>
            )}
            {items.length === 0 && (
              <span className="text-xs text-slate-400 italic">No questions yet</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
            className="rounded-xl border-green-200 text-green-700 hover:bg-green-50 gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </Button>
          <Button
            onClick={() => setShowAddSheet(true)}
            className="rounded-xl bg-[#002388] hover:bg-[#002388]/90 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Objective section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
            <Target className="h-4 w-4 text-amber-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">
            Objective Questions
            <span className="ml-2 text-xs font-normal text-slate-400">
              Multiple choice — {objective.length} {objective.length === 1 ? "question" : "questions"}
            </span>
          </h2>
        </div>
        <QuestionsTable items={objective} onDelete={setDeleteItem} />
      </section>

      {/* Subjective section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
            <PenLine className="h-4 w-4 text-purple-600" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">
            Subjective Questions
            <span className="ml-2 text-xs font-normal text-slate-400">
              Open-ended — {subjective.length} {subjective.length === 1 ? "question" : "questions"}
            </span>
          </h2>
        </div>
        <QuestionsTable items={subjective} onDelete={setDeleteItem} />
      </section>

      <AddItemSheet
        open={showAddSheet}
        bankId={bankId}
        onAdded={fetchData}
        onClose={() => setShowAddSheet(false)}
      />

      <ExcelImportModal
        open={showImport}
        bankId={bankId}
        bankTitle={bank.title}
        onClose={() => setShowImport(false)}
        onImported={fetchData}
      />

      <ConfirmModal
        open={!!deleteItem}
        title="Delete Question?"
        description="Remove this question from the bank? This cannot be undone."
        confirmText="Delete"
        isDestructive
        isLoading={isDeletingItem}
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  )
}
