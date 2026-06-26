"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, CheckCircle2, Loader2, Search, Library, Check, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { QuestionFormState } from "@/lib/assessment-types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankItem {
  id: number
  type: string
  body: string
  marks: number
  answerType?: string | null
  options?: string[] | null
  correctOption?: number | null
  rubricCriteria?: Array<{ description: string; maxMarks: number; order: number }>
}

interface QuestionBank {
  id: number
  title: string
  courseId: number | null
  course?: { code: string; title: string } | null
  _count?: { items: number }
  typeCounts?: { OBJECTIVE: number; SUBJECTIVE: number }
}

interface ImportFromBankModalProps {
  open: boolean
  onClose: () => void
  onImport: (questions: QuestionFormState[]) => void
  courseId: number | null
  type: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportFromBankModal({
  open,
  onClose,
  onImport,
  courseId,
  type,
}: ImportFromBankModalProps) {
  const [banks, setBanks] = useState<QuestionBank[]>([])
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null)
  const [items, setItems] = useState<BankItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState("")
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)

  const isObjective = type === "OBJECTIVE"
  const typeLabel = isObjective ? "objective" : "subjective"

  // ── Load banks when opened ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setLoadingBanks(true)
    setSelectedBankId(null)
    setItems([])
    setSelectedIds(new Set())
    setSearch("")

    fetch("/api/lecturer/question-banks")
      .then((r) => r.json())
      .then((data: QuestionBank[]) => {
        const filtered = courseId
          ? data.filter((b: any) => b.courseId === courseId || b.courseId === null)
          : data
        setBanks(filtered.length > 0 ? filtered : data)
      })
      .catch(() => setBanks([]))
      .finally(() => setLoadingBanks(false))
  }, [open, courseId])

  // ── Load items when a bank is chosen ────────────────────────────────────────
  useEffect(() => {
    if (selectedBankId === null) { setItems([]); return }
    setLoadingItems(true)
    setSelectedIds(new Set())
    setSearch("")

    fetch(`/api/lecturer/question-banks/${selectedBankId}/items`)
      .then((r) => r.json())
      .then((data: BankItem[]) => setItems(data.filter((item: any) => item.type === type)))
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false))
  }, [selectedBankId, type])

  const selectedBank = banks.find((b: any) => b.id === selectedBankId) ?? null

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((i: any) => i.body.toLowerCase().includes(q))
  }, [items, search])

  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id))

  const toggleItem = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredItems.forEach((i: any) => next.delete(i.id))
      else filteredItems.forEach((i: any) => next.add(i.id))
      return next
    })
  }

  const handleImport = () => {
    const toImport = items.filter((item: any) => selectedIds.has(item.id))
    const questions: QuestionFormState[] = toImport.map((item: any) => ({
      id: crypto.randomUUID(),
      order: 0,
      body: item.body,
      marks: String(item.marks),
      answerType: (item.answerType as QuestionFormState["answerType"]) ?? "",
      options: Array.isArray(item.options) ? [...item.options] : ["", ""],
      correctOption: item.correctOption ?? null,
      rubricCriteria: (item.rubricCriteria ?? []).map((r: any) => ({
        id: crypto.randomUUID(),
        description: r.description,
        maxMarks: String(r.maxMarks),
        order: r.order,
      })),
    }))
    onImport(questions)
    handleClose()
  }

  const handleClose = () => {
    setSelectedBankId(null)
    setItems([])
    setSelectedIds(new Set())
    setSearch("")
    onClose()
  }

  const bankCount = (b: QuestionBank) =>
    b.typeCounts ? (isObjective ? b.typeCounts.OBJECTIVE : b.typeCounts.SUBJECTIVE) : b._count?.items ?? 0

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="sm:max-w-xl w-full flex flex-col gap-0 p-0">
        {/* ── Header ── */}
        <SheetHeader className="px-6 py-4 border-b border-border space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#dbeafe] shrink-0">
              <Library className="h-4 w-4 text-[#002388]" />
            </div>
            <div>
              <SheetTitle className="text-[15px] font-semibold text-[#1e293b]">
                Import from question bank
              </SheetTitle>
              <SheetDescription className="text-[12px] text-muted-foreground">
                Add <span className="font-medium text-[#1e293b]">{typeLabel}</span> questions to this section.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Step 1: source bank ── */}
        <div className="px-6 py-4 border-b border-border space-y-2">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
            Source bank
          </label>
          {loadingBanks ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground h-9">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading banks…
            </div>
          ) : banks.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-slate-50 px-4 py-5 text-center">
              <p className="text-[12px] text-muted-foreground">No question banks available.</p>
            </div>
          ) : (
            <Select
              value={selectedBankId ? String(selectedBankId) : ""}
              onValueChange={(v) => setSelectedBankId(parseInt(v))}
            >
              <SelectTrigger className="w-full rounded-sm border-border">
                <SelectValue placeholder="Choose a question bank…" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank: any) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-[#002388]" />
                      {bank.title}
                      {bank.course && (
                        <span className="text-[10px] font-bold text-[#1e40af]">{bank.course.code}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        · {bankCount(bank)} {typeLabel}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Step 2: questions ── */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedBankId === null ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Inbox className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-[13px] font-semibold text-[#1e293b]">Select a bank to begin</p>
              <p className="mt-1 max-w-xs text-[12px] text-muted-foreground">
                Choose a question bank above to browse and import its {typeLabel} questions.
              </p>
            </div>
          ) : (
            <>
              {/* Toolbar: search + select all */}
              <div className="px-6 pt-4 pb-3 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${typeLabel} questions…`}
                    className="w-full rounded-sm border border-border bg-white py-2 pl-8 pr-3 text-[12px] text-[#1e293b] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-400"
                  />
                </div>
                {filteredItems.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-3 py-2 text-[11px] font-semibold text-[#1e293b] hover:bg-slate-50 transition-colors"
                  >
                    <Check className="h-3 w-3" />
                    {allFilteredSelected ? "Clear" : "Select all"}
                  </button>
                )}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-6 pb-4">
                {loadingItems ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-border bg-slate-50 px-4 py-12 text-center">
                    <p className="text-[12px] text-muted-foreground">
                      No {typeLabel} questions in this bank.
                    </p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-border bg-slate-50 px-4 py-12 text-center">
                    <p className="text-[12px] text-muted-foreground">No questions match “{search}”.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredItems.map((item: any) => {
                      const selected = selectedIds.has(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          className={cn(
                            "w-full text-left rounded-sm border p-3 transition-colors",
                            selected
                              ? "border-[#002388]/30 bg-[#002388]/[0.04]"
                              : "border-border bg-white hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                              selected ? "bg-[#002388] border-[#002388] text-white" : "border-slate-300 bg-white"
                            )}>
                              {selected && <CheckCircle2 className="h-3 w-3" />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <p className="text-[13px] text-[#1e293b] leading-relaxed line-clamp-2">
                                {item.body}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-slate-100 text-slate-600">
                                  {item.marks} {item.marks === 1 ? "mark" : "marks"}
                                </span>
                                {item.answerType && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold uppercase border bg-slate-50 text-slate-500 border-border">
                                    {item.answerType.replace("_", " ")}
                                  </span>
                                )}
                                {Array.isArray(item.options) && item.options.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">{item.options.length} options</span>
                                )}
                                {item.rubricCriteria && item.rubricCriteria.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">{item.rubricCriteria.length} criteria</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer summary ── */}
        <SheetFooter className="px-6 py-3.5 border-t border-border flex-row items-center justify-between gap-2">
          <p className="text-[12px] text-muted-foreground">
            {selectedIds.size > 0
              ? <><span className="font-semibold text-[#1e293b]">{selectedIds.size}</span> selected{selectedBank ? ` from ${selectedBank.title}` : ""}</>
              : "No questions selected"}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="rounded-sm h-9 text-[12px]">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={selectedIds.size === 0}
              className="rounded-sm h-9 text-[12px] bg-primary hover:bg-[#001570] gap-1.5"
            >
              Import{selectedIds.size > 0 ? ` ${selectedIds.size}` : ""}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
