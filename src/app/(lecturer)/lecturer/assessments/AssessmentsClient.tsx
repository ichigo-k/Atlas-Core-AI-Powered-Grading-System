"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowUpDown,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
  BarChart2,
} from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ConfirmModal } from "@/components/ui/confirm-modal"
import { toast } from "sonner"
import { format } from "date-fns"
import type { AssessmentListItem, AssessmentTypeEnum, AssessmentStatusEnum } from "@/lib/assessment-types"

interface AssessmentsClientProps {
  assessments: AssessmentListItem[]
}

const typeStyle: Record<AssessmentTypeEnum, { bg: string; text: string }> = {
  EXAM:       { bg: "#fee2e2", text: "#991b1b" },
  QUIZ:       { bg: "#fef9c3", text: "#854d0e" },
  ASSIGNMENT: { bg: "#dcfce7", text: "#166534" },
}

const statusStyle: Record<AssessmentStatusEnum, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" },
  PUBLISHED: { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  CLOSED:    { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
}

export default function AssessmentsClient({ assessments }: AssessmentsClientProps) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<AssessmentListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [closeTarget, setCloseTarget] = useState<AssessmentListItem | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState<number | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/lecturer/assessments/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Assessment deleted")
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error("Failed to delete assessment")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = async () => {
    if (!closeTarget) return
    setIsClosing(true)
    try {
      const res = await fetch(`/api/lecturer/assessments/${closeTarget.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed")
      }
      toast.success("Assessment closed")
      setCloseTarget(null)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to close assessment")
    } finally {
      setIsClosing(false)
    }
  }

  const handleStatusTransition = async (id: number, status: "PUBLISHED" | "CLOSED") => {
    setIsTransitioning(id)
    try {
      const res = await fetch(`/api/lecturer/assessments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed")
      }
      toast.success(status === "PUBLISHED" ? "Assessment published" : "Assessment closed")
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setIsTransitioning(null)
    }
  }

  const columns: ColumnDef<AssessmentListItem>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 h-8 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-transparent"
        >
          Title
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#1e293b] truncate">{row.getValue("title")}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{row.original.courseCode}</p>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const s = typeStyle[row.original.type]
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]" style={{ background: s.bg, color: s.text }}>
            {row.original.type}
          </span>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const a = row.original
        const effectiveStatus =
          a.status === "PUBLISHED" && new Date() > new Date(a.endsAt) ? "CLOSED" : a.status
        const s = statusStyle[effectiveStatus]
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]" style={{ background: s.bg, color: s.text }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
            {effectiveStatus}
          </span>
        )
      },
    },
    {
      accessorKey: "classCount",
      header: "Classes",
      cell: ({ row }) => (
        <span className="text-[13px] text-[#1e293b]">{row.original.classCount}</span>
      ),
    },
    {
      accessorKey: "startsAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 h-8 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-transparent"
        >
          Starts
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-[11px] text-muted-foreground">{format(new Date(row.original.startsAt), "MMM d, yyyy HH:mm")}</span>
      ),
    },
    {
      accessorKey: "endsAt",
      header: "Ends",
      cell: ({ row }) => (
        <span className="text-[11px] text-muted-foreground">{format(new Date(row.original.endsAt), "MMM d, yyyy HH:mm")}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const a = row.original
        const isLoading = isTransitioning === a.id
        const effectiveStatus =
          a.status === "PUBLISHED" && new Date() > new Date(a.endsAt) ? "CLOSED" : a.status
        return (
          <div className="flex items-center justify-end gap-1">
            {effectiveStatus === "DRAFT" && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleStatusTransition(a.id, "PUBLISHED")}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="h-3 w-3" />
                Publish
              </button>
            )}
            {effectiveStatus === "PUBLISHED" && (
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setCloseTarget(a)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm text-[11px] font-semibold border border-border text-[#323130] hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <XCircle className="h-3 w-3" />
                Close
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-all">
                  <MoreVertical size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => router.push(`/lecturer/assessments/${a.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {(effectiveStatus === "PUBLISHED" || effectiveStatus === "CLOSED") && (
                  <DropdownMenuItem onClick={() => router.push(`/lecturer/assessments/${a.id}/results`)}>
                    <BarChart2 className="mr-2 h-4 w-4" />
                    View Results
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => router.push(`/lecturer/assessments/${a.id}/edit`)}
                  disabled={effectiveStatus !== "DRAFT"}
                  className={effectiveStatus !== "DRAFT" ? "opacity-40 cursor-not-allowed" : ""}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit {effectiveStatus !== "DRAFT" && <span className="ml-auto text-[10px] text-slate-400">Draft only</span>}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                  onClick={() => setDeleteTarget(a)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => router.push("/lecturer/assessments/new")}
          className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors"
        >
          <Plus size={14} />
          New Assessment
        </button>
      </div>

      <ConfirmModal
        open={!!closeTarget}
        title="Close Assessment?"
        description={`"${closeTarget?.title}" is currently live. Closing it will end the assessment for all students immediately. This cannot be undone.`}
        confirmText="Close Assessment"
        isLoading={isClosing}
        onConfirm={handleClose}
        onCancel={() => setCloseTarget(null)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Assessment?"
        description={
          deleteTarget?.status === "PUBLISHED"
            ? `"${deleteTarget.title}" is currently published. Deleting it may affect students who have already started. This cannot be undone.`
            : `Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`
        }
        confirmText="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <DataTable
        columns={columns}
        data={assessments}
        searchKey="title"
        placeholder="Search assessments..."
      />
    </div>
  )
}
