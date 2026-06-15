"use client"

import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ChevronRight } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
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

const columns: ColumnDef<AssessmentListItem>[] = [
  {
    accessorKey: "title",
    header: "Assessment",
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
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]"
          style={{ background: s.bg, color: s.text }}
        >
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
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]"
          style={{ background: s.bg, color: s.text }}
        >
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
    header: "Starts",
    cell: ({ row }) => (
      <span className="text-[11px] text-muted-foreground">
        {format(new Date(row.original.startsAt), "MMM d, yyyy HH:mm")}
      </span>
    ),
  },
  {
    accessorKey: "endsAt",
    header: "Ends",
    cell: ({ row }) => (
      <span className="text-[11px] text-muted-foreground">
        {format(new Date(row.original.endsAt), "MMM d, yyyy HH:mm")}
      </span>
    ),
  },
  {
    id: "chevron",
    cell: () => (
      <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors" />
    ),
  },
]

export default function AssessmentsClient({ assessments }: AssessmentsClientProps) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={assessments}
      searchKey="title"
      placeholder="Search assessments..."
      onRowClick={(row) => router.push(`/lecturer/assessments/${row.id}`)}
    />
  )
}
