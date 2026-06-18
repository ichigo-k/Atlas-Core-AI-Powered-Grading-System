"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  BookOpen,
  Library,
  Loader2,
  ArrowRight,
  Globe,
  Lock,
} from "lucide-react"
import LoadingLogo from "@/components/ui/LoadingLogo"
import { TableSkeleton } from "@/components/ui/table-skeleton"
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Bank {
  id: number
  title: string
  courseId: number | null
  course: { code: string; title: string } | null
  lecturerId: number
  isShared: boolean
  isOwn: boolean
  _count: { items: number }
  typeCounts: { OBJECTIVE: number; SUBJECTIVE: number }
  createdAt: string
}

interface LecturerCourse {
  id: number
  code: string
  title: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// ─── Create Bank Sheet ─────────────────────────────────────────────────────────

interface CreateBankSheetProps {
  open: boolean
  courses: LecturerCourse[]
  onCreated: (bank: Bank) => void
  onClose: () => void
}

function CreateBankSheet({ open, courses, onCreated, onClose }: CreateBankSheetProps) {
  const [title, setTitle] = useState("")
  const [courseId, setCourseId] = useState<string>("")
  const [isShared, setIsShared] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClose = () => {
    setTitle("")
    setCourseId("")
    setIsShared(false)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error("Bank title is required"); return }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/lecturer/question-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), courseId: courseId ? parseInt(courseId) : null, isShared }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create bank")
      }
      const bank = await res.json()
      const course = courses.find((c) => c.id === (courseId ? parseInt(courseId) : -1)) ?? null
      toast.success("Question bank created")
      onCreated({
        ...bank,
        course: course ? { code: course.code, title: course.title } : null,
        isOwn: true,
        _count: { items: 0 },
        typeCounts: { OBJECTIVE: 0, SUBJECTIVE: 0 },
      })
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bank")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="sm:max-w-md w-full flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b border-slate-100">
          <SheetTitle>New Question Bank</SheetTitle>
          <SheetDescription>
            Create a bank to store reusable questions for your assessments.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex-1 px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Bank Title <span className="text-red-500">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Structures Midterm Pool"
                className="rounded-sm border-slate-200 focus-visible:ring-[#002388]"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Course (optional)
              </Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="w-full rounded-sm border-slate-200">
                  <SelectValue placeholder="No course filter — available for all" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                Linking to a course makes this bank easier to find when creating assessments.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Visibility
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsShared(false)}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-sm border text-[12px] font-semibold transition-colors ${!isShared ? "border-[#002388] bg-[#dbeafe] text-[#002388]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  <Lock size={13} /> Private
                </button>
                <button
                  type="button"
                  onClick={() => setIsShared(true)}
                  className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-sm border text-[12px] font-semibold transition-colors ${isShared ? "border-[#16a34a] bg-[#dcfce7] text-[#16a34a]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  <Globe size={13} /> Shared
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Shared banks are visible to all lecturers (read-only for others).
              </p>
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t border-slate-100 flex-row justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose} className="rounded-sm">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-sm bg-[#002388] hover:bg-[#002388]/90 gap-1.5"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
              ) : (
                <><Plus className="h-4 w-4" />Create Bank</>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function QuestionBankClient() {
  const router = useRouter()
  const [banks, setBanks] = useState<Bank[]>([])
  const [courses, setCourses] = useState<LecturerCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const fetchBanks = useCallback(async () => {
    try {
      const res = await fetch("/api/lecturer/question-banks")
      if (!res.ok) throw new Error()
      const data: Bank[] = await res.json()
      setBanks(data)
    } catch {
      toast.error("Failed to load question banks")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleToggleShare = async (bank: Bank) => {
    setTogglingId(bank.id)
    try {
      const res = await fetch(`/api/lecturer/question-banks/${bank.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isShared: !bank.isShared }),
      })
      if (!res.ok) throw new Error()
      setBanks((prev) => prev.map((b) => b.id === bank.id ? { ...b, isShared: !bank.isShared } : b))
      toast.success(bank.isShared ? "Bank set to private" : "Bank shared with all lecturers")
    } catch {
      toast.error("Failed to update sharing")
    } finally {
      setTogglingId(null)
    }
  }

  useEffect(() => {
    fetchBanks()
    fetch("/api/lecturer/courses")
      .then((r) => r.json())
      .then((data: LecturerCourse[]) => setCourses(data))
      .catch(() => {})
  }, [fetchBanks])

  const handleBankCreated = (bank: Bank) => {
    setBanks((prev) => [bank, ...prev])
    router.refresh()
  }

  const handleDeleteBank = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/lecturer/question-banks/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      toast.success("Question bank deleted")
      setBanks((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error("Failed to delete bank")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {loading ? "" : `${banks.length} bank${banks.length !== 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          onClick={() => setShowCreateSheet(true)}
          className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Bank
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="relative">
          <TableSkeleton />
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
            <div className="scale-75 opacity-80">
              <LoadingLogo />
            </div>
          </div>
        </div>
      ) : banks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-white px-6 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Library className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-[14px] font-semibold text-[#1e293b]">No question banks yet</p>
          <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
            Question banks let you store and reuse questions across multiple assessments. Create your first bank to get started.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateSheet(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create your first bank
          </button>
        </div>
      ) : (
        <div className="rounded-sm border border-slate-200 overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="pl-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Bank Name
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Course
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Questions
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Visibility
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Created
                </TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((bank) => {
                const isOwner = bank.isOwn
                return (
                  <TableRow
                    key={bank.id}
                    className="group cursor-pointer hover:bg-slate-50/80"
                    onClick={() => router.push(`/lecturer/question-bank/${bank.id}`)}
                  >
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-[13px] font-semibold text-[#1e293b]">{bank.title}</span>
                        {!isOwner && (
                          <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded-sm bg-slate-100">Shared with you</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {bank.course ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]" style={{ background: "#dbeafe", color: "#1e40af" }}>
                          {bank.course.code}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">All courses</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {bank.typeCounts.OBJECTIVE > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.04em]" style={{ background: "#fef9c3", color: "#854d0e" }}>
                            {bank.typeCounts.OBJECTIVE} Obj
                          </span>
                        ) : null}
                        {bank.typeCounts.SUBJECTIVE > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-[0.04em]" style={{ background: "#f3e8ff", color: "#6b21a8" }}>
                            {bank.typeCounts.SUBJECTIVE} Subj
                          </span>
                        ) : null}
                        {bank._count.items === 0 && (
                          <span className="text-[11px] text-muted-foreground italic">No questions yet</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => handleToggleShare(bank)}
                          disabled={togglingId === bank.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                            bank.isShared
                              ? "border-[#bbf7d0] bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]"
                              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {bank.isShared ? <Globe size={11} /> : <Lock size={11} />}
                          {bank.isShared ? "Shared" : "Private"}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[#bbf7d0] bg-[#dcfce7] text-[#166534] text-[11px] font-semibold">
                          <Globe size={11} /> Shared
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-[11px] text-muted-foreground">
                      {formatDate(bank.createdAt)}
                    </TableCell>

                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {isOwner && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(bank)
                            }}
                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateBankSheet
        open={showCreateSheet}
        courses={courses}
        onCreated={handleBankCreated}
        onClose={() => setShowCreateSheet(false)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Question Bank?"
        description={`Delete "${deleteTarget?.title}" and all its questions? This cannot be undone.`}
        confirmText="Delete Bank"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDeleteBank}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
