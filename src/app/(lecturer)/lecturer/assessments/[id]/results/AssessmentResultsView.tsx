"use client"

import Link from "next/link"
import { useState, useMemo, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ClipboardList, ArrowUpDown, Send, Eye, EyeOff, Download, ShieldAlert, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js"
import { Bar, Doughnut } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssessmentResultsData {
  id: number
  title: string
  type: "EXAM" | "QUIZ" | "ASSIGNMENT"
  status: "PUBLISHED" | "CLOSED"
  courseCode: string
  courseTitle: string
  totalMarks: number
  totalQuestions: number
  startsAt: Date
  endsAt: Date
  gradingStatus: "NOT_GRADED" | "GRADING" | "GRADED"
  resultsReleased: boolean
  enrolledStudents: Array<{
    id: number
    name: string
    email: string
    className: string
  }>
  submissions: Array<{
    studentId: number
    attemptId: number
    score: number | null
    submittedAt: Date | null
    status: "SUBMITTED" | "GRADED" | "PENDING"
    plagiarismFlagged?: boolean
  }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeBadge: Record<string, string> = {
  EXAM: "bg-red-50 text-red-700 border-red-200",
  QUIZ: "bg-amber-50 text-amber-700 border-amber-200",
  ASSIGNMENT: "bg-blue-50 text-blue-700 border-blue-200",
}

const statusBadge: Record<string, { cls: string; dot: string }> = {
  PUBLISHED: { cls: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  CLOSED: { cls: "bg-slate-200 text-slate-500 border-slate-300", dot: "bg-slate-400" },
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${className}`}>
      {children}
    </span>
  )
}

function StatTile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-4 border-r border-slate-100 last:border-r-0">
      <span className="text-xl font-semibold text-slate-900">{value}</span>
      <span className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">{label}</span>
    </div>
  )
}

type SortKey = "name" | "class" | "status" | "score" | "submittedAt"
type SortDir = "asc" | "desc"

// ─── Export constants ─────────────────────────────────────────────────────────

const ALL_EXPORT_FIELDS = [
  'studentId', 'studentName', 'email', 'score', 'totalMarks',
  'percentage', 'grade', 'attemptNumber', 'submittedAt', 'plagiarismFlagged',
] as const

const EXPORT_FIELD_LABELS: Record<string, string> = {
  studentId: 'Student ID',
  studentName: 'Student Name',
  email: 'Email',
  score: 'Score',
  totalMarks: 'Total Marks',
  percentage: 'Percentage (%)',
  grade: 'Grade',
  attemptNumber: 'Attempt #',
  submittedAt: 'Submitted At',
  plagiarismFlagged: 'Plagiarism Flagged',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssessmentResultsView({ data }: { data: AssessmentResultsData }) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [search, setSearch] = useState("")
  const [isGrading, startGrading] = useTransition()
  const [isReleasing, startReleasing] = useTransition()
  const [isUnreleasing, startUnreleasing] = useTransition()
  const [gradingStatus, setGradingStatus] = useState(data.gradingStatus)
  const [resultsReleased, setResultsReleased] = useState(data.resultsReleased)
  const [pollingError, setPollingError] = useState<string | null>(null)
  const [regradingAttemptId, setRegradingAttemptId] = useState<number | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [selectedFields, setSelectedFields] = useState<string[]>([...ALL_EXPORT_FIELDS])
  const [isExporting, setIsExporting] = useState(false)

  // ─── Sub-task 10.1: Grading status polling with Page Visibility API ──────────
  useEffect(() => {
    if (gradingStatus !== "GRADING") return

    let consecutiveFailures = 0
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function poll() {
      if (document.visibilityState === "hidden") return
      try {
        const res = await fetch(`/api/lecturer/assessments/${data.id}/status`)
        if (!res.ok) throw new Error(`Status ${res.status}`)
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
          setPollingError("Unable to check grading status. Please refresh the page manually.")
        }
      }
    }

    intervalId = setInterval(poll, 15_000)

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        poll() // immediate poll on tab focus
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [gradingStatus, data.id, router])

  const submittedCount = data.submissions.length
  const gradedCount = data.submissions.filter((s: any) => s.status === "GRADED").length
  const notSubmittedCount = data.enrolledStudents.length - submittedCount
  const submissionRate = data.enrolledStudents.length > 0
    ? Math.round((submittedCount / data.enrolledStudents.length) * 100)
    : 0

  const status = statusBadge[data.status] ?? statusBadge.PUBLISHED
  const submissionByStudent = new Map(data.submissions.map((s: any) => [s.studentId, s]))

  // Score distribution buckets for bar chart
  const scoredSubmissions = data.submissions.filter((s: any) => s.score != null)
  const buckets = ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"]
  const bucketCounts = [0, 0, 0, 0, 0]
  for (const sub of scoredSubmissions) {
    const pct = ((sub.score ?? 0) / data.totalMarks) * 100
    const idx = Math.min(Math.floor(pct / 20), 4)
    bucketCounts[idx]++
  }

  const barData = {
    labels: buckets,
    datasets: [{
      label: "Students",
      data: bucketCounts,
      backgroundColor: "#002388",
      borderRadius: 6,
      borderSkipped: false,
    }],
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 }, color: "#94a3b8" } },
      y: { grid: { color: "#f1f5f9" }, border: { display: false }, ticks: { font: { size: 11 }, color: "#94a3b8", stepSize: 1 } },
    },
  }

  const doughnutData = {
    labels: ["Submitted", "Not Submitted"],
    datasets: [{
      data: [submittedCount, notSubmittedCount],
      backgroundColor: ["#002388", "#e2e8f0"],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: { parsed: number }) => ` ${ctx.parsed} students` } },
    },
  }

  // Sortable table rows
  const rows = useMemo(() => {
    const filtered = data.enrolledStudents.filter(
      (s) =>
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
        const statusOrder = { GRADED: 0, SUBMITTED: 1, undefined: 2 }
        cmp = (statusOrder[subA?.status as keyof typeof statusOrder] ?? 2) -
          (statusOrder[subB?.status as keyof typeof statusOrder] ?? 2)
      }
      else if (sortKey === "score") cmp = (subA?.score ?? -1) - (subB?.score ?? -1)
      else if (sortKey === "submittedAt") {
        cmp = (subA?.submittedAt ? new Date(subA.submittedAt).getTime() : 0) -
          (subB?.submittedAt ? new Date(subB.submittedAt).getTime() : 0)
      }

      return sortDir === "asc" ? cmp : -cmp
    })
  }, [data.enrolledStudents, search, sortKey, sortDir, submissionByStudent])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors"
    >
      {label}
      <ArrowUpDown size={11} className={sortKey === col ? "text-[#002388]" : "text-slate-300"} />
    </button>
  )

  // Trigger grading — sets status to GRADING, external grader picks it up
  function handleStartGrading() {
    startGrading(async () => {
      const res = await fetch(`/api/lecturer/assessments/${data.id}/start-grading`, {
        method: "POST",
      })
      if (!res.ok) {
        toast.error("Failed to start grading. Please try again.")
        return
      }
      setGradingStatus("GRADING")
      toast.success("Assessment sent to grader. Results will appear as they come in.")
    })
  }

  // Release results to students
  function handleReleaseResults() {
    startReleasing(async () => {
      const res = await fetch(`/api/lecturer/assessments/${data.id}/release-results`, {
        method: "POST",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error === "Cannot release results before grading is complete"
          ? "Grading is not complete yet."
          : "Failed to release results.")
        return
      }
      setResultsReleased(true)
      toast.success("Results released — students can now see their scores.")
    })
  }

  // ─── Sub-task 10.3: Un-release results ──────────────────────────────────────
  function handleUnreleaseResults() {
    startUnreleasing(async () => {
      const res = await fetch(`/api/lecturer/assessments/${data.id}/unrelease-results`, {
        method: "POST",
      })
      if (!res.ok) {
        toast.error("Failed to un-release results.")
        return
      }
      setResultsReleased(false)
      toast.success("Results hidden — students can no longer see their scores.")
    })
  }

  // ─── Sub-task 10.3: Per-attempt re-grade ────────────────────────────────────
  async function handleRegrade(attemptId: number) {
    setRegradingAttemptId(attemptId)
    try {
      const res = await fetch(
        `/api/lecturer/assessments/${data.id}/attempts/${attemptId}/regrade`,
        { method: "POST" }
      )
      if (res.status === 429) {
        const body = await res.json()
        const mins = Math.ceil(body.retryAfterSeconds / 60)
        toast.error(`Re-grading is rate limited. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`)
        return
      }
      if (!res.ok) {
        toast.error("Re-grading failed. Please try again.")
        return
      }
      toast.success("Re-grading complete.")
      router.refresh()
    } finally {
      setRegradingAttemptId(null)
    }
  }

  // ─── Export marks ────────────────────────────────────────────────────────────
  async function handleExport() {
    setIsExporting(true)
    try {
      // Omit the fields param entirely when all fields are selected (or none chosen),
      // so the API defaults to all fields in canonical order.
      const allSelected =
        selectedFields.length === 0 ||
        selectedFields.length === ALL_EXPORT_FIELDS.length
      let url = `/api/lecturer/assessments/${data.id}/export/marks`
      if (!allSelected) {
        const params = new URLSearchParams()
        for (const f of selectedFields) params.append('fields', f)
        url += `?${params.toString()}`
      }
      const res = await fetch(url)
      if (!res.ok) {
        toast.error('Failed to export marks. Please try again.')
        return
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `marks-${data.id}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
      setShowExportDialog(false)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">

      {/* Export Marks sheet */}
      <Sheet open={showExportDialog} onOpenChange={setShowExportDialog}>
        <SheetContent side="right" className="flex flex-col w-full sm:max-w-sm p-0">
          <SheetHeader className="px-6 py-5 border-b border-slate-100 shrink-0">
            <SheetTitle>Export Marks</SheetTitle>
            <SheetDescription>Select columns to include in the export.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-3">
              {ALL_EXPORT_FIELDS.map((field: any) => (
                <label key={field} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFields((prev) => [...prev, field])
                      } else {
                        setSelectedFields((prev) => prev.filter((f: any) => f !== field))
                      }
                    }}
                    className="h-4 w-4 rounded border-slate-300 accent-[#002388]"
                  />
                  <span className="text-sm text-slate-700">{EXPORT_FIELD_LABELS[field]}</span>
                </label>
              ))}
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t border-slate-100 shrink-0 flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowExportDialog(false)}
              className="rounded-sm border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedFields.length === 0}
              className="inline-flex items-center gap-2 rounded-sm bg-[#002388] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B4DBB] transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download size={14} />
                  Export
                </>
              )}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Top nav */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href={`/lecturer/assessments/${data.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#002388] transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Assessment
        </Link>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Grading progress pill */}
          {gradingStatus !== "NOT_GRADED" && (
            <div className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-semibold ${gradingStatus === "GRADED"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
              }`}>
              {gradingStatus === "GRADING" && (
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
              {gradingStatus === "GRADED" && (
                <span className="h-2 w-2 rounded-full bg-green-500" />
              )}
              {gradingStatus === "GRADING" ? "Grading" : "Graded"}
              <span className="font-medium opacity-70 ml-1">
                {gradedCount}/{submittedCount}
              </span>
            </div>
          )}

          {/* Sub-task 10.1: Polling error display */}
          {pollingError && (
            <div className="rounded-sm border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              {pollingError}
            </div>
          )}

          {/* Grade Assessment button — when GRADING (retrigger if stuck) or when NOT_GRADED and CLOSED */}
          {gradingStatus === "GRADING" && (
            <button
              type="button"
              onClick={handleStartGrading}
              disabled={isGrading}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGrading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Starting…
                </>
              ) : (
                <>
                  <Send size={14} />
                  Grade
                </>
              )}
            </button>
          )}

          {/* Grade Assessment button — only when assessment is CLOSED and not yet graded */}
          {gradingStatus === "NOT_GRADED" && submittedCount > 0 && data.status === "CLOSED" && (
            <button
              type="button"
              onClick={handleStartGrading}
              disabled={isGrading}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGrading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Starting…
                </>
              ) : (
                <>
                  <Send size={14} />
                  Grade
                </>
              )}
            </button>
          )}

          {/* Hint when assessment is still open — grading not available yet */}
          {gradingStatus === "NOT_GRADED" && submittedCount > 0 && data.status === "PUBLISHED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              Close the assessment to enable grading
            </span>
          )}

          {/* Release Results button — only when grading done and not yet released */}
          {gradingStatus === "GRADED" && !resultsReleased && (
            <button
              type="button"
              onClick={handleReleaseResults}
              disabled={isReleasing}
              className="inline-flex items-center gap-2 rounded-sm bg-green-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {isReleasing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Releasing…
                </>
              ) : (
                <>
                  <Eye size={14} />
                  Release
                </>
              )}
            </button>
          )}

          {/* Sub-task 10.3: Un-release Results button — only when results are released */}
          {resultsReleased && (
            <button
              type="button"
              onClick={handleUnreleaseResults}
              disabled={isUnreleasing}
              className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {isUnreleasing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                  Hiding…
                </>
              ) : (
                <>
                  <EyeOff size={14} />
                  Hide
                </>
              )}
            </button>
          )}

          {/* Released badge */}
          {resultsReleased && (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Released
            </span>
          )}

          {/* Export Marks button — only when grading is complete */}
          {gradingStatus === 'GRADED' && (
            <button
              type="button"
              onClick={() => setShowExportDialog(true)}
              className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
            >
              <Download size={14} />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Hero card */}
      <div className="rounded-sm border border-slate-200 bg-white overflow-hidden">
        <div className="p-6 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={typeBadge[data.type]}>{data.type}</Chip>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${status.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {data.status}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-[#1e293b]">{data.title}</h1>
          <p className="text-[13px] text-muted-foreground">{data.courseCode} — {data.courseTitle}</p>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(data.startsAt), "MMM d, yyyy HH:mm")} — {format(new Date(data.endsAt), "MMM d, yyyy HH:mm")}
          </p>
        </div>
        <div className="border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
          <StatTile value={data.enrolledStudents.length} label="Enrolled" />
          <StatTile value={submittedCount} label="Submitted" />
          <StatTile value={gradedCount} label="Graded" />
          <StatTile value={`${submissionRate}%`} label="Submission Rate" />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">

        {/* Score distribution bar chart */}
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-4">Score Distribution</p>
          {scoredSubmissions.length === 0 ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-slate-400">No scores yet</p>
            </div>
          ) : (
            <div className="h-44">
              <Bar data={barData} options={barOptions} />
            </div>
          )}
        </div>

        {/* Submission doughnut */}
        <div className="rounded-sm border border-slate-200 bg-white p-5 flex flex-col items-center justify-center gap-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] self-start">Submissions</p>
          <div className="relative h-32 w-32">
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-semibold text-slate-900">{submissionRate}%</span>
              <span className="text-[10px] text-slate-400">submitted</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#002388]" />{submittedCount} submitted</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />{notSubmittedCount} pending</span>
          </div>
        </div>
      </div>

      {/* Students data table */}
      <div className="rounded-sm border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 gap-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] shrink-0">Student Results</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="ml-auto h-8 w-48 rounded-sm border border-border bg-white px-3 text-[12px] text-[#1e293b] placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
          />
          <span className="text-xs text-slate-400 shrink-0">{rows.length} students</span>
        </div>

        {data.enrolledStudents.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ClipboardList size={28} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">No students enrolled in the assigned classes.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-2.5 text-left"><SortBtn col="name" label="Student" /></th>
                <th className="px-5 py-2.5 text-left">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Flagged</span>
                </th>
                <th className="px-5 py-2.5 text-left"><SortBtn col="class" label="Class" /></th>
                <th className="px-5 py-2.5 text-left"><SortBtn col="status" label="Status" /></th>
                <th className="px-5 py-2.5 text-left"><SortBtn col="submittedAt" label="Submitted" /></th>
                <th className="px-5 py-2.5 text-right"><SortBtn col="score" label="Score" /></th>
                <th className="px-5 py-2.5 text-right">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-400">No students match your search.</td>
                </tr>
              ) : rows.map((student: any) => {
                const sub = submissionByStudent.get(student.id)
                const scorePct = sub?.score != null
                  ? Math.round((sub.score / data.totalMarks) * 100)
                  : null

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (!sub) return
                      router.push(`/lecturer/assessments/${data.id}/results/attempts/${sub.attemptId}`)
                    }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-semibold text-[#1e293b]">{student.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{student.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {sub?.plagiarismFlagged === true && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-600 border-red-200">
                          <ShieldAlert size={11} />
                          Flagged
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
                    {/* Sub-task 10.2: Hide scores when grading is not complete */}
                    <td className="px-5 py-3.5 text-right">
                      {gradingStatus === "GRADED" ? (
                        <div className="flex flex-col items-end gap-1">
                          {(() => {
                            const displayScore = sub?.score ?? 0
                            const pct = Math.round((displayScore / data.totalMarks) * 100)
                            const color = pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : pct >= 20 ? "#f97316" : "#ef4444"
                            return (
                              <>
                                <span className="font-medium" style={{ color }}>
                                  {displayScore}
                                  <span className="text-xs text-slate-400 ml-1">/ {data.totalMarks}</span>
                                </span>
                                <div className="w-20 h-1 rounded-full bg-slate-100 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      ) : sub?.score != null ? (
                        <div className="flex flex-col items-end gap-1">
                          {(() => {
                            const pct = Math.round((sub.score / data.totalMarks) * 100)
                            const color = pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : pct >= 20 ? "#f97316" : "#ef4444"
                            return (
                              <>
                                <span className="font-medium" style={{ color }}>
                                  {sub.score}
                                  <span className="text-xs text-slate-400 ml-1">/ {data.totalMarks}</span>
                                </span>
                                <div className="w-20 h-1 rounded-full bg-slate-100 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      ) : !sub ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-medium" style={{ color: "#ef4444" }}>
                            0
                            <span className="text-xs text-slate-400 ml-1">/ {data.totalMarks}</span>
                          </span>
                          <div className="w-20 h-1 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-red-400" style={{ width: "0%" }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pending</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {sub ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleRegrade(sub.attemptId)}
                            disabled={regradingAttemptId === sub.attemptId}
                            className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {regradingAttemptId === sub.attemptId ? (
                              <>
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                Grading…
                              </>
                            ) : (
                              "Re-grade"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/lecturer/assessments/${data.id}/results/attempts/${sub.attemptId}`)}
                            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95"
                          >
                            Review <ChevronRight size={14} className="opacity-70" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
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
