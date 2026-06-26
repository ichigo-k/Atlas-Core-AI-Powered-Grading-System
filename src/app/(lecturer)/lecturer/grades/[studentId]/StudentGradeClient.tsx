"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  User,
  GraduationCap,
  BookOpen,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import LoadingLogo from "@/components/ui/LoadingLogo"
import { TableSkeleton } from "@/components/ui/table-skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentInfo {
  id: number
  name: string
  email: string
  program: string
  className: string | null
  classLevel: number | null
}

interface AssessmentRow {
  id: number
  title: string
  type: "EXAM" | "QUIZ" | "ASSIGNMENT"
  status: "DRAFT" | "PUBLISHED" | "CLOSED"
  totalMarks: number
  startsAt: string
  endsAt: string
  courseCode: string
  courseTitle: string
  score: number | null
  submissionStatus: "NOT_SUBMITTED" | "SUBMITTED" | "GRADED"
}

interface StudentGradeData {
  student: StudentInfo
  assessments: AssessmentRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeBadge: Record<string, string> = {
  EXAM: "bg-red-50 text-red-700 border-red-200",
  QUIZ: "bg-amber-50 text-amber-700 border-amber-200",
  ASSIGNMENT: "bg-blue-50 text-blue-700 border-blue-200",
}

const typeLabel: Record<string, string> = {
  EXAM: "Exam",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function ScoreBadge({ score, total }: { score: number | null; total: number }) {
  const displayScore = score ?? 0
  const pct = total > 0 ? Math.round((displayScore / total) * 100) : 0
  const color =
    pct >= 70 ? "#22c55e" :
    pct >= 50 ? "#f59e0b" :
    pct >= 20 ? "#f97316" :
    "#ef4444"
  return (
    <div className="text-right">
      <span className="text-sm font-bold" style={{ color }}>
        {displayScore}/{total}
      </span>
      <span className="text-xs ml-1" style={{ color }}>({pct}%)</span>
    </div>
  )
}

function StatusBadge({ status }: { status: AssessmentRow["submissionStatus"] }) {
  if (status === "GRADED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
        <CheckCircle2 className="h-3 w-3" />
        Graded
      </span>
    )
  }
  if (status === "SUBMITTED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <Clock className="h-3 w-3" />
        Submitted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
      <XCircle className="h-3 w-3" />
      Not submitted
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentGradeClient({ studentId }: { studentId: number }) {
  const router = useRouter()
  const [data, setData] = useState<StudentGradeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/lecturer/gradebook/${studentId}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d: StudentGradeData) => setData(d))
      .catch(() => {
        toast.error("Failed to load student grades")
        router.push("/lecturer/grades")
      })
      .finally(() => setLoading(false))
  }, [studentId, router])

  if (loading) {
    return (
      <div className="relative">
        <TableSkeleton />
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
          <div className="scale-75 opacity-80">
            <LoadingLogo />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { student, assessments } = data
  const graded = assessments.filter((a: any) => a.submissionStatus === "GRADED")
  const submitted = assessments.filter((a: any) => a.submissionStatus === "SUBMITTED")
  const notSubmitted = assessments.filter((a: any) => a.submissionStatus === "NOT_SUBMITTED")

  const totalEarned = graded.reduce((s, a) => s + (a.score ?? 0), 0)
  const totalPossible = assessments.reduce((s, a) => s + a.totalMarks, 0)  // all assessments, not just graded
  const overallPct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null

  return (
    <div className="space-y-8">
      {/* Back */}
      <button
        onClick={() => router.push("/lecturer/grades")}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Gradebook
      </button>

      {/* Student card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#002388]/8 border border-[#002388]/10">
            <User className="h-7 w-7 text-[#002388]/50" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1">
            <h1 className="text-xl font-semibold text-slate-900">{student.name}</h1>
            <p className="text-sm text-slate-500">{student.email}</p>
            <div className="flex items-center gap-3 flex-wrap mt-1">
              {student.className && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {student.className}
                  {student.classLevel && ` · Level ${student.classLevel}`}
                </span>
              )}
              {student.program && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <BookOpen className="h-3.5 w-3.5" />
                  {student.program}
                </span>
              )}
            </div>
          </div>

          {/* Overall score */}
          {overallPct !== null && (
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-slate-900">{overallPct}%</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {totalEarned}/{totalPossible} marks across {assessments.length} assessments
              </p>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="mt-5 grid grid-cols-3 gap-3 pt-5 border-t border-slate-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900">{assessments.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Total assessments</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{graded.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Graded</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-400">{notSubmitted.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Not submitted</p>
          </div>
        </div>
      </div>

      {/* Assessments table */}
      {assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <FileText className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">No assessments found for this student.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Assessment Results
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/40 hover:bg-slate-50/40">
                <TableHead className="pl-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Assessment
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Course
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Date
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-right pr-5">
                  Score
                </TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((a: any) => (
                <TableRow key={a.id} className="group hover:bg-slate-50/60">
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border shrink-0",
                        typeBadge[a.type]
                      )}>
                        {typeLabel[a.type]}
                      </span>
                      <span className="text-sm font-medium text-slate-800 line-clamp-1">
                        {a.title}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border bg-blue-50 text-blue-700 border-blue-200">
                      {a.courseCode}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {formatDate(a.startsAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={a.submissionStatus} />
                  </TableCell>
                  <TableCell className="pr-5">
                    <ScoreBadge score={a.score} total={a.totalMarks} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => router.push(`/lecturer/assessments/${a.id}/results`)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#002388]"
                      title="View assessment results"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
