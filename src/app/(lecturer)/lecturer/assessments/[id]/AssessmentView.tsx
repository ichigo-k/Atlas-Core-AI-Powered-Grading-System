"use client"

import { useState, useEffect, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft, MapPin, Lock, Shuffle, RotateCcw, Clock, Users, BookOpen,
  Calendar, Edit2, Send, Eye, EyeOff, Download, ShieldAlert, ChevronRight,
  ArrowUpDown, ClipboardList, RefreshCw, Trash2, MoreVertical, X,
  Settings, AlertTriangle,
} from "lucide-react"
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend,
} from "chart.js"
import { Bar, Doughnut } from "react-chartjs-2"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import type { AssessmentWithDetails } from "@/lib/assessment-types"
import type { AssessmentResultsData } from "./results/AssessmentResultsView"

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "results" | "proctoring"
type SortKey = "name" | "class" | "status" | "score" | "submittedAt"
type SortDir = "asc" | "desc"

const ALL_EXPORT_FIELDS = [
  "studentId", "studentName", "email", "score", "totalMarks",
  "percentage", "grade", "attemptNumber", "submittedAt", "plagiarismFlagged",
] as const

const EXPORT_FIELD_LABELS: Record<string, string> = {
  studentId: "Student ID", studentName: "Student Name", email: "Email",
  score: "Score", totalMarks: "Total Marks", percentage: "Percentage (%)",
  grade: "Grade", attemptNumber: "Attempt #", submittedAt: "Submitted At",
  plagiarismFlagged: "Plagiarism Flagged",
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-3">
      {children}
    </p>
  )
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#f1f5f9] last:border-0">
      <div className="w-4 shrink-0 text-muted-foreground flex items-center justify-center">{icon}</div>
      <span className="w-32 shrink-0 text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[13px] text-[#1e293b]">{value}</span>
    </div>
  )
}

function StatTile({ value, label, icon }: { value: React.ReactNode; label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-5 border-r border-[#f1f5f9] last:border-r-0 group">
      {icon && <span className="text-muted-foreground/60 mb-0.5">{icon}</span>}
      <span className="text-[26px] font-bold text-[#1e293b] leading-none tabular-nums">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</span>
    </div>
  )
}

const typeBadge: Record<string, string> = {
  EXAM: "bg-[#fee2e2] text-[#991b1b] border-[#fecaca]",
  QUIZ: "bg-[#fef9c3] text-[#854d0e] border-[#fef08a]",
  ASSIGNMENT: "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]",
}

const statusBadge: Record<string, { cls: string; dot: string }> = {
  DRAFT: { cls: "bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]", dot: "bg-[#94a3b8]" },
  PUBLISHED: { cls: "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]", dot: "bg-[#22c55e]" },
  CLOSED: { cls: "bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]", dot: "bg-[#94a3b8]" },
}

// ─── Edit Settings inline panel ───────────────────────────────────────────────

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const dt = new Date(d)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function EditSettingsSheet({ assessment, open, onClose }: {
  assessment: AssessmentWithDetails
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(new Date(assessment.endsAt)))
  const [durationMinutes, setDurationMinutes] = useState(
    assessment.durationMinutes != null ? String(assessment.durationMinutes) : ""
  )
  const [maxAttempts, setMaxAttempts] = useState(String(assessment.maxAttempts))
  const [passwordProtected, setPasswordProtected] = useState(assessment.passwordProtected)
  const [accessPassword, setAccessPassword] = useState(assessment.accessPassword ?? "")

  function handleSave() {
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        endsAt, maxAttempts: parseInt(maxAttempts) || 1, passwordProtected,
        accessPassword: passwordProtected ? accessPassword : null,
        durationMinutes: durationMinutes.trim() ? parseInt(durationMinutes) : null,
      }
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Failed to save settings")
        return
      }
      toast.success("Settings updated")
      onClose()
      router.refresh()
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-sm p-0">
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <SheetTitle className="text-[14px] font-semibold text-[#1e293b]">Edit Settings</SheetTitle>
          <SheetDescription className="text-[12px]">
            Adjust timing, attempts, and access. Questions cannot be changed once published.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Calendar size={12} /> Close Date &amp; Time
            </label>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
              className="w-full h-9 rounded-sm border border-border bg-white px-3 text-[13px] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <Clock size={12} /> Duration (minutes)
              <span className="text-muted-foreground font-normal">— blank = unlimited</span>
            </label>
            <input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="e.g. 60"
              className="w-full h-9 rounded-sm border border-border bg-white px-3 text-[13px] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <RotateCcw size={12} /> Max Attempts
            </label>
            <input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)}
              className="w-full h-9 rounded-sm border border-border bg-white px-3 text-[13px] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={passwordProtected} onChange={(e) => setPasswordProtected(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary/20" />
              <Lock size={12} /> Password Protected
            </label>
            {passwordProtected && (
              <input type="text" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)}
                placeholder="Access password"
                className="w-full h-9 rounded-sm border border-border bg-white px-3 text-[13px] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            )}
          </div>
        </div>
        <SheetFooter className="px-6 py-4 border-t border-border shrink-0 flex-row justify-end gap-2">
          <button onClick={onClose}
            className="h-8 px-4 rounded-sm border border-border text-[12px] text-muted-foreground hover:bg-[#f3f2f1] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isPending}
            className="h-8 px-4 rounded-sm bg-primary text-[12px] text-white font-semibold hover:bg-[#001570] disabled:opacity-50 transition-colors">
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  assessment: AssessmentWithDetails
  resultsData: AssessmentResultsData | null
  userId: number
  initialTab?: Tab
  proctoringContent?: React.ReactNode
}

export default function AssessmentView({ assessment, resultsData, userId, initialTab = "overview", proctoringContent }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  // Action bar state
  const [showSettings, setShowSettings] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, startPublishing] = useTransition()
  const [isReopening, startReopening] = useTransition()

  // Results state
  const [gradingStatus, setGradingStatus] = useState<"NOT_GRADED" | "GRADING" | "GRADED">(
    resultsData?.gradingStatus ?? "NOT_GRADED"
  )
  const [resultsReleased, setResultsReleased] = useState(resultsData?.resultsReleased ?? false)
  const [pollingError, setPollingError] = useState<string | null>(null)
  const [regradingAttemptId, setRegradingAttemptId] = useState<number | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [selectedFields, setSelectedFields] = useState<string[]>([...ALL_EXPORT_FIELDS])
  const [isExporting, setIsExporting] = useState(false)
  const [isGrading, startGrading] = useTransition()
  const [isReleasing, startReleasing] = useTransition()
  const [isUnreleasing, startUnreleasing] = useTransition()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  // Grading status polling
  useEffect(() => {
    if (gradingStatus !== "GRADING" || !resultsData) return
    let consecutiveFailures = 0
    let intervalId: ReturnType<typeof setInterval> | null = null
    async function poll() {
      if (document.visibilityState === "hidden") return
      try {
        const res = await fetch(`/api/lecturer/assessments/${assessment.id}/status`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        consecutiveFailures = 0
        if (json.gradingStatus === "GRADED") {
          setGradingStatus("GRADED")
          if (intervalId) clearInterval(intervalId)
          router.refresh()
        }
      } catch {
        consecutiveFailures++
        if (consecutiveFailures >= 3) {
          if (intervalId) clearInterval(intervalId)
          setPollingError("Unable to check grading status. Refresh manually.")
        }
      }
    }
    intervalId = setInterval(poll, 15_000)
    const onVisibility = () => { if (document.visibilityState === "visible") poll() }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [gradingStatus, assessment.id, resultsData, router])

  // ─── Action handlers ──────────────────────────────────────────────────────

  function handlePublish() {
    startPublishing(async () => {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      })
      if (!res.ok) { toast.error("Failed to publish"); return }
      toast.success("Assessment published")
      router.refresh()
    })
  }

  async function handleClose() {
    setIsClosing(true)
    try {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed") }
      toast.success("Assessment closed")
      setShowClose(false)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to close")
    } finally {
      setIsClosing(false)
    }
  }

  function handleReopen() {
    startReopening(async () => {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed to re-open"); return }
      toast.success("Assessment re-opened")
      router.refresh()
    })
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Assessment deleted")
      router.push("/lecturer/assessments")
      router.refresh()
    } catch {
      toast.error("Failed to delete assessment")
    } finally {
      setIsDeleting(false)
    }
  }

  function handleStartGrading() {
    startGrading(async () => {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/start-grading`, { method: "POST" })
      if (!res.ok) { toast.error("Failed to start grading. Please try again."); return }
      setGradingStatus("GRADING")
      toast.success("Assessment sent to grader.")
    })
  }

  function handleReleaseResults() {
    startReleasing(async () => {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/release-results`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error === "Cannot release results before grading is complete" ? "Grading is not complete yet." : "Failed to release results.")
        return
      }
      setResultsReleased(true)
      toast.success("Results released — students can now see their scores.")
    })
  }

  function handleUnreleaseResults() {
    startUnreleasing(async () => {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/unrelease-results`, { method: "POST" })
      if (!res.ok) { toast.error("Failed to un-release results."); return }
      setResultsReleased(false)
      toast.success("Results hidden — students can no longer see their scores.")
    })
  }

  async function handleRegrade(attemptId: number) {
    setRegradingAttemptId(attemptId)
    try {
      const res = await fetch(`/api/lecturer/assessments/${assessment.id}/attempts/${attemptId}/regrade`, { method: "POST" })
      if (res.status === 429) {
        const body = await res.json()
        toast.error(`Rate limited. Try again in ${body.retryAfterSeconds}s.`)
        return
      }
      if (!res.ok) { toast.error("Re-grading failed."); return }
      toast.success("Re-grading complete.")
      router.refresh()
    } finally {
      setRegradingAttemptId(null)
    }
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const allSelected = selectedFields.length === 0 || selectedFields.length === ALL_EXPORT_FIELDS.length
      let url = `/api/lecturer/assessments/${assessment.id}/export/marks`
      if (!allSelected) {
        const params = new URLSearchParams()
        for (const f of selectedFields) params.append("fields", f)
        url += `?${params.toString()}`
      }
      const res = await fetch(url)
      if (!res.ok) { toast.error("Failed to export marks."); return }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl; a.download = `marks-${assessment.id}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
      setShowExportDialog(false)
    } finally {
      setIsExporting(false)
    }
  }

  // ─── Results table rows ───────────────────────────────────────────────────

  const submissionByStudent = useMemo(
    () => new Map((resultsData?.submissions ?? []).map((s) => [s.studentId, s])),
    [resultsData]
  )

  const tableRows = useMemo(() => {
    if (!resultsData) return []
    const filtered = resultsData.enrolledStudents.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.className.toLowerCase().includes(search.toLowerCase())
    )
    return [...filtered].sort((a, b) => {
      const subA = submissionByStudent.get(a.id)
      const subB = submissionByStudent.get(b.id)
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "class") cmp = a.className.localeCompare(b.className)
      else if (sortKey === "status") {
        const ord = { GRADED: 0, SUBMITTED: 1, undefined: 2 }
        cmp = (ord[subA?.status as keyof typeof ord] ?? 2) - (ord[subB?.status as keyof typeof ord] ?? 2)
      }
      else if (sortKey === "score") cmp = (subA?.score ?? -1) - (subB?.score ?? -1)
      else if (sortKey === "submittedAt") {
        cmp = (subA?.submittedAt ? new Date(subA.submittedAt).getTime() : 0) -
          (subB?.submittedAt ? new Date(subB.submittedAt).getTime() : 0)
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [resultsData, search, sortKey, sortDir, submissionByStudent])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  // ─── Derived values ───────────────────────────────────────────────────────

  const totalQuestions = assessment.sections.reduce((acc, s) => acc + s.questions.length, 0)
  const status = statusBadge[assessment.status] ?? statusBadge.DRAFT
  const submittedCount = resultsData?.submissions.length ?? 0
  const gradedCount = (resultsData?.submissions ?? []).filter((s) => s.status === "GRADED").length
  const notSubmittedCount = (resultsData?.enrolledStudents.length ?? 0) - submittedCount
  const submissionRate = (resultsData?.enrolledStudents.length ?? 0) > 0
    ? Math.round((submittedCount / (resultsData?.enrolledStudents.length ?? 1)) * 100) : 0

  // Chart data
  const scoredSubmissions = (resultsData?.submissions ?? []).filter((s) => s.score != null)
  const bucketCounts = [0, 0, 0, 0, 0]
  for (const sub of scoredSubmissions) {
    const pct = ((sub.score ?? 0) / (resultsData?.totalMarks ?? 1)) * 100
    bucketCounts[Math.min(Math.floor(pct / 20), 4)]++
  }
  const barData = {
    labels: ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"],
    datasets: [{ label: "Students", data: bucketCounts, backgroundColor: "#002388", borderRadius: 4, borderSkipped: false as const }],
  }
  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, color: "#94a3b8" } },
      y: { grid: { color: "#f1f5f9" }, border: { display: false }, ticks: { font: { size: 11 }, color: "#94a3b8", stepSize: 1 } },
    },
  }
  const doughnutData = {
    labels: ["Submitted", "Not Submitted"],
    datasets: [{ data: [submittedCount, notSubmittedCount], backgroundColor: ["#002388", "#e2e8f0"], borderWidth: 0, hoverOffset: 4 }],
  }
  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false, cutout: "72%",
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: { parsed: number }) => ` ${ctx.parsed} students` } } },
  }

  // ─── Tabs config ──────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(assessment.status !== "DRAFT" ? [{ id: "results" as Tab, label: "Results" }] : []),
    ...(assessment.proctoringEnabled ? [{ id: "proctoring" as Tab, label: "Proctoring" }] : []),
  ]

  // ─── Action bar ───────────────────────────────────────────────────────────

  function ActionBar() {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* DRAFT actions */}
        {assessment.status === "DRAFT" && (
          <>
            <Link
              href={`/lecturer/assessments/${assessment.id}/edit`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-primary text-white text-[12px] font-semibold hover:bg-[#001570] transition-colors"
            >
              <Edit2 size={12} /> Edit Assessment
            </Link>
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-[#bbf7d0] bg-[#dcfce7] text-[#166534] text-[12px] font-semibold hover:bg-[#bbf7d0] disabled:opacity-50 transition-colors"
            >
              {isPublishing ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
              {isPublishing ? "Publishing…" : "Publish"}
            </button>
          </>
        )}

        {/* PUBLISHED actions */}
        {assessment.status === "PUBLISHED" && (
          <>
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border bg-white text-[12px] font-semibold text-muted-foreground hover:bg-[#f3f2f1] transition-colors"
            >
              <Settings size={12} /> Edit Settings
            </button>
            <button
              onClick={() => setShowClose(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-amber-200 bg-amber-50 text-amber-700 text-[12px] font-semibold hover:bg-amber-100 transition-colors"
            >
              Close Assessment
            </button>
          </>
        )}

        {/* CLOSED actions */}
        {assessment.status === "CLOSED" && (
          <>
            <button
              onClick={handleReopen}
              disabled={isReopening}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border bg-white text-[12px] font-semibold text-muted-foreground hover:bg-[#f3f2f1] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={isReopening ? "animate-spin" : ""} />
              {isReopening ? "Re-opening…" : "Re-open"}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border bg-white text-[12px] font-semibold text-muted-foreground hover:bg-[#f3f2f1] transition-colors"
            >
              <Settings size={12} /> Edit Settings
            </button>
            {/* Grading status indicator */}
            {gradingStatus === "GRADING" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-amber-200 bg-amber-50 text-[12px] font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Grading {gradedCount}/{submittedCount}
              </span>
            )}
            {gradingStatus === "GRADED" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[#bbf7d0] bg-[#dcfce7] text-[12px] font-semibold text-[#166534]">
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Graded
              </span>
            )}
            {/* Grade button */}
            {(gradingStatus === "NOT_GRADED" || gradingStatus === "GRADING") && submittedCount > 0 && (
              <button
                onClick={handleStartGrading}
                disabled={isGrading}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-primary text-white text-[12px] font-semibold hover:bg-[#001570] disabled:opacity-50 transition-colors"
              >
                {isGrading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send size={12} />}
                {isGrading ? "Starting…" : gradingStatus === "GRADING" ? "Retry Grade" : "Grade Assessment"}
              </button>
            )}
            {/* Release / Unrelease */}
            {gradingStatus === "GRADED" && !resultsReleased && (
              <button
                onClick={handleReleaseResults}
                disabled={isReleasing}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-[#16a34a] text-white text-[12px] font-semibold hover:bg-[#15803d] disabled:opacity-50 transition-colors"
              >
                {isReleasing ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Eye size={12} />}
                {isReleasing ? "Releasing…" : "Release Results"}
              </button>
            )}
            {resultsReleased && (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[#bbf7d0] bg-[#dcfce7] text-[12px] font-semibold text-[#166534]">
                  <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Released
                </span>
                <button
                  onClick={handleUnreleaseResults}
                  disabled={isUnreleasing}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border bg-white text-[12px] font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 transition-colors"
                >
                  <EyeOff size={12} />
                  {isUnreleasing ? "Hiding…" : "Hide Results"}
                </button>
              </>
            )}
            {/* Export */}
            {gradingStatus === "GRADED" && (
              <button
                onClick={() => setShowExportDialog(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-border bg-white text-[12px] font-semibold text-muted-foreground hover:bg-[#f3f2f1] transition-colors"
              >
                <Download size={12} /> Export
              </button>
            )}
          </>
        )}

        {/* Polling error */}
        {pollingError && (
          <span className="text-[11px] text-rose-600 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-sm">{pollingError}</span>
        )}

        {/* ··· overflow menu with Delete */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 flex items-center justify-center rounded-sm border border-border bg-white text-muted-foreground hover:bg-[#f3f2f1] transition-colors">
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-sm">
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 text-[13px]"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Assessment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  // ─── Overview tab ─────────────────────────────────────────────────────────

  function OverviewTab() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-sm border border-border bg-white p-5">
            <SectionLabel>Schedule</SectionLabel>
            <MetaRow icon={<Calendar size={13} />} label="Opens" value={format(new Date(assessment.startsAt), "MMM d, yyyy · HH:mm")} />
            <MetaRow icon={<Calendar size={13} />} label="Closes" value={format(new Date(assessment.endsAt), "MMM d, yyyy · HH:mm")} />
            <MetaRow icon={<Clock size={13} />} label="Duration" value={assessment.durationMinutes ? `${assessment.durationMinutes} minutes` : "Unlimited"} />
            <MetaRow icon={<RotateCcw size={13} />} label="Max Attempts" value={assessment.maxAttempts} />
          </div>
          <div className="rounded-sm border border-border bg-white p-5">
            <SectionLabel>Configuration</SectionLabel>
            <MetaRow icon={<MapPin size={13} />} label="Location" value={assessment.isLocationBound ? (assessment.location || "Location-Bound") : "Anywhere"} />
            <MetaRow icon={<Lock size={13} />} label="Password" value={assessment.passwordProtected ? "Protected" : "None"} />
            <MetaRow icon={<Shuffle size={13} />} label="Shuffle Questions" value={<span className={assessment.shuffleQuestions ? "text-primary font-medium" : "text-muted-foreground"}>{assessment.shuffleQuestions ? "Yes" : "No"}</span>} />
            <MetaRow icon={<Shuffle size={13} />} label="Shuffle Options" value={<span className={assessment.shuffleOptions ? "text-primary font-medium" : "text-muted-foreground"}>{assessment.shuffleOptions ? "Yes" : "No"}</span>} />
          </div>
          <div className="rounded-sm border border-border bg-white p-5 md:col-span-2">
            <SectionLabel><span className="flex items-center gap-1.5"><Users size={11} /> Assigned Classes</span></SectionLabel>
            {assessment.classes.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No classes assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assessment.classes.map((c) => (
                  <span key={c.id} className="inline-flex items-center px-3 py-1.5 rounded-sm border border-border bg-[#f3f2f1] text-[12px] text-[#1e293b]">
                    {c.className}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {assessment.sections.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-[#f3f2f1] p-10 text-center">
            <p className="text-[13px] text-muted-foreground">No sections have been added yet.</p>
          </div>
        ) : (
          <div className="rounded-sm border border-border bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <SectionLabel>Sections</SectionLabel>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[#f3f2f1] border-b border-border">
                <tr>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em] w-10">#</th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Section</th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Type</th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Questions</th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {assessment.sections.map((section, secIdx) => {
                  const isObjective = section.type === "OBJECTIVE"
                  const required = section.requiredQuestionsCount ?? section.questions.length
                  const sectionMarks = section.questions.map((q) => q.marks).sort((a, b) => b - a).slice(0, required).reduce((acc, m) => acc + m, 0)
                  const pct = assessment.totalMarks > 0 ? Math.round((sectionMarks / assessment.totalMarks) * 100) : 0
                  return (
                    <tr key={section.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary text-white text-[10px] font-semibold">{secIdx + 1}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#1e293b]">
                        {section.name || <span className="italic text-muted-foreground">Untitled</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]"
                          style={isObjective ? { background: "#dbeafe", color: "#1e40af" } : { background: "#f3e8ff", color: "#6b21a8" }}>
                          {isObjective ? "Objective" : "Subjective"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[11px] text-muted-foreground">
                        {section.requiredQuestionsCount ? `Answer ${section.requiredQuestionsCount} of ${section.questions.length}` : `All ${section.questions.length}`}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-[#1e293b]">{sectionMarks}</span>
                        <span className="text-[11px] text-muted-foreground ml-1">({pct}%)</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-border bg-[#f3f2f1]">
                <tr>
                  <td colSpan={4} className="px-5 py-2.5 text-[11px] text-muted-foreground">
                    {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} across {assessment.sections.length} section{assessment.sections.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[13px] font-semibold text-primary">{assessment.totalMarks} pts</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ─── Results tab ──────────────────────────────────────────────────────────

  function ResultsTab() {
    if (!resultsData) return (
      <div className="rounded-sm border border-border bg-[#f3f2f1] p-12 text-center">
        <p className="text-[13px] text-muted-foreground">Results are not available for draft assessments.</p>
      </div>
    )

    const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
      <button type="button" onClick={() => toggleSort(col)}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em] hover:text-[#1e293b] transition-colors">
        {label}
        <ArrowUpDown size={10} className={sortKey === col ? "text-primary" : "text-muted-foreground/40"} />
      </button>
    )

    return (
      <div className="space-y-4">
        {/* Hint when still open */}
        {gradingStatus === "NOT_GRADED" && submittedCount > 0 && resultsData.status === "PUBLISHED" && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-sm border border-amber-200 bg-amber-50 text-[12px] font-semibold text-amber-700">
            <AlertTriangle size={13} /> Close the assessment first to enable grading.
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
          <div className="rounded-sm border border-border bg-white p-5">
            <SectionLabel>Score Distribution</SectionLabel>
            {scoredSubmissions.length === 0 ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-[13px] text-muted-foreground">No scores yet</p>
              </div>
            ) : (
              <div className="h-44"><Bar data={barData} options={barOptions} /></div>
            )}
          </div>
          <div className="rounded-sm border border-border bg-white p-5 flex flex-col items-center justify-center gap-3">
            <SectionLabel><span className="self-start w-full block">Submission Rate</span></SectionLabel>
            <div className="relative h-28 w-28">
              <Doughnut data={doughnutData} options={doughnutOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[22px] font-semibold text-[#1e293b]">{submissionRate}%</span>
                <span className="text-[10px] text-muted-foreground">submitted</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />{submittedCount} submitted</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#e2e8f0]" />{notSubmittedCount} pending</span>
            </div>
          </div>
        </div>

        {/* Students table */}
        <div className="rounded-sm border border-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border gap-3">
            <SectionLabel><span className="mb-0">Student Results</span></SectionLabel>
            <div className="flex items-center gap-3 ml-auto">
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="h-8 w-48 rounded-sm border border-border bg-white px-3 text-[12px] placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              />
              <span className="text-[11px] text-muted-foreground shrink-0">{tableRows.length} students</span>
            </div>
          </div>

          {resultsData.enrolledStudents.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ClipboardList size={28} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-[13px] text-muted-foreground">No students enrolled in the assigned classes.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#f3f2f1] border-b border-border">
                <tr>
                  <th className="px-5 py-2.5 text-left"><SortBtn col="name" label="Student" /></th>
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Flagged</th>
                  <th className="px-5 py-2.5 text-left"><SortBtn col="class" label="Class" /></th>
                  <th className="px-5 py-2.5 text-left"><SortBtn col="status" label="Status" /></th>
                  <th className="px-5 py-2.5 text-left"><SortBtn col="submittedAt" label="Submitted" /></th>
                  <th className="px-5 py-2.5 text-right"><SortBtn col="score" label="Score" /></th>
                  <th className="px-5 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {tableRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-[13px] text-muted-foreground">No students match your search.</td></tr>
                ) : tableRows.map((student) => {
                  const sub = submissionByStudent.get(student.id)
                  return (
                    <tr key={student.id}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => { if (sub) router.push(`/lecturer/assessments/${resultsData.id}/results/attempts/${sub.attemptId}`) }}>
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-semibold text-[#1e293b]">{student.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{student.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {sub?.plagiarismFlagged && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold border bg-red-50 text-red-600 border-red-200">
                            <ShieldAlert size={10} /> Flagged
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[11px] text-muted-foreground">{student.className}</td>
                      <td className="px-5 py-3.5">
                        {!sub ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]" style={{ background: "#f1f5f9", color: "#64748b" }}>Not submitted</span>
                        ) : sub.status === "GRADED" ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]" style={{ background: "#dcfce7", color: "#166534" }}>Graded</span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]" style={{ background: "#fef9c3", color: "#854d0e" }}>Submitted</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[11px] text-muted-foreground">
                        {sub?.submittedAt ? format(new Date(sub.submittedAt), "MMM d, HH:mm") : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {sub?.score != null ? (() => {
                          const pct = Math.round((sub.score / resultsData.totalMarks) * 100)
                          const color = pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : pct >= 20 ? "#f97316" : "#ef4444"
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[13px] font-semibold" style={{ color }}>
                                {sub.score}<span className="text-[11px] text-muted-foreground ml-1">/ {resultsData.totalMarks}</span>
                              </span>
                              <div className="w-16 h-1 rounded-full bg-[#f1f5f9] overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                              </div>
                            </div>
                          )
                        })() : !sub ? (
                          <span className="text-[13px] font-semibold text-red-400">0<span className="text-[11px] text-muted-foreground ml-1">/ {resultsData.totalMarks}</span></span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {sub ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRegrade(sub.attemptId)}
                              disabled={regradingAttemptId === sub.attemptId}
                              className="text-[11px] font-semibold text-muted-foreground hover:text-[#1e293b] disabled:opacity-50 transition-colors"
                            >
                              {regradingAttemptId === sub.attemptId ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
                              ) : "Re-grade"}
                            </button>
                            <button
                              onClick={() => router.push(`/lecturer/assessments/${resultsData.id}/results/attempts/${sub.attemptId}`)}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm bg-primary text-white text-[11px] font-semibold hover:bg-[#001570] transition-colors"
                            >
                              Review <ChevronRight size={12} />
                            </button>
                          </div>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full flex flex-col">
      {/* Sticky command bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-shrink-0">
        <ClipboardList size={11} />
        <Link href="/lecturer" className="hover:text-[#1e293b] transition-colors">Lecturer</Link>
        <ChevronRight size={11} />
        <Link href="/lecturer/assessments" className="hover:text-[#1e293b] transition-colors">Assessments</Link>
        <ChevronRight size={11} />
        <span className="text-[#002388] font-medium truncate max-w-[200px]">{assessment.title}</span>
      </div>

      <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] pb-16 space-y-5">

        {/* Modals */}
        <EditSettingsSheet assessment={assessment} open={showSettings} onClose={() => setShowSettings(false)} />

        <ConfirmModal
          open={showClose}
          title="Close Assessment?"
          description={`"${assessment.title}" is currently live. Closing it will end the assessment for all students immediately. This cannot be undone.`}
          confirmText="Close Assessment"
          isLoading={isClosing}
          onConfirm={handleClose}
          onCancel={() => setShowClose(false)}
        />

        <ConfirmModal
          open={showDelete}
          title="Delete Assessment?"
          description={
            assessment.status === "PUBLISHED"
              ? `"${assessment.title}" is currently published. Deleting it may affect students who have already started. This cannot be undone.`
              : `Are you sure you want to delete "${assessment.title}"? This cannot be undone.`
          }
          confirmText="Delete"
          isDestructive
          isLoading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />

        {/* Export sheet */}
        <Sheet open={showExportDialog} onOpenChange={setShowExportDialog}>
          <SheetContent side="right" className="flex flex-col w-full sm:max-w-sm p-0">
            <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
              <SheetTitle className="text-[14px]">Export Marks</SheetTitle>
              <SheetDescription className="text-[12px]">Select columns to include in the export.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {ALL_EXPORT_FIELDS.map((field) => (
                <label key={field} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={selectedFields.includes(field)}
                    onChange={(e) => setSelectedFields((prev) => e.target.checked ? [...prev, field] : prev.filter((f) => f !== field))}
                    className="h-4 w-4 rounded-sm border-border accent-primary" />
                  <span className="text-[13px] text-[#1e293b]">{EXPORT_FIELD_LABELS[field]}</span>
                </label>
              ))}
            </div>
            <SheetFooter className="px-6 py-4 border-t border-border shrink-0 flex-row justify-end gap-2">
              <button onClick={() => setShowExportDialog(false)}
                className="h-8 px-4 rounded-sm border border-border text-[12px] text-muted-foreground hover:bg-[#f3f2f1] transition-colors">
                Cancel
              </button>
              <button onClick={handleExport} disabled={isExporting || selectedFields.length === 0}
                className="inline-flex items-center gap-2 h-8 px-4 rounded-sm bg-primary text-white text-[12px] font-semibold hover:bg-[#001570] disabled:opacity-50 transition-colors">
                {isExporting ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Download size={12} />}
                {isExporting ? "Exporting…" : "Export"}
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#1e293b]">{assessment.title}</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <BookOpen size={12} className="text-primary shrink-0" />
              {assessment.courseCode} — {assessment.courseTitle}
            </p>
          </div>
          <ActionBar />
        </div>

        {/* Hero stats */}
        <div className="rounded-sm border border-border bg-white overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
          {/* Status accent bar */}
          <div className={`h-[3px] w-full ${assessment.status === "PUBLISHED" ? "bg-[#22c55e]" :
              assessment.status === "CLOSED" ? "bg-[#94a3b8]" :
                "bg-primary"
            }`} />
          {/* Chips row */}
          <div className="px-5 py-3.5 flex flex-wrap items-center gap-2.5 border-b border-[#f1f5f9] bg-[#fafaf9]">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-bold border tracking-[0.04em] ${typeBadge[assessment.type]}`}>
              <BookOpen size={10} />
              {assessment.type}
            </span>
            <span className="text-[#d1d5db]">·</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-semibold border ${status.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {assessment.status}
            </span>
            {assessment.passwordProtected && (
              <>
                <span className="text-[#d1d5db]">·</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-semibold text-[#64748b] uppercase tracking-[0.04em]">
                  <Lock size={9} /> Password
                </span>
              </>
            )}
            {assessment.proctoringEnabled && (
              <>
                <span className="text-[#d1d5db]">·</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-semibold text-[#64748b] uppercase tracking-[0.04em]">
                  <ShieldAlert size={9} /> Proctored
                </span>
              </>
            )}
          </div>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#f1f5f9]">
            <StatTile value={assessment.totalMarks} label="Total Marks" icon={<ClipboardList size={13} />} />
            <StatTile value={totalQuestions} label="Questions" icon={<BookOpen size={13} />} />
            <StatTile value={assessment.sections.length} label="Sections" icon={<ArrowUpDown size={13} />} />
            <StatTile value={assessment.durationMinutes ? `${assessment.durationMinutes}m` : "—"} label="Duration" icon={<Clock size={13} />} />
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex items-center border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-[#1e293b]"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "results" && <ResultsTab />}
        {activeTab === "proctoring" && assessment.proctoringEnabled && proctoringContent}
      </div>
    </div>
  )
}
