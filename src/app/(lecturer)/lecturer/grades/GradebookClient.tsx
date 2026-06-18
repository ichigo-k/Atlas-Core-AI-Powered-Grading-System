"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn,
} from "@tanstack/react-table"
import {
  Search,
  Users,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  ArrowRight,
} from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { Button } from "@/components/ui/button"
import LoadingLogo from "@/components/ui/LoadingLogo"
import { TableSkeleton } from "@/components/ui/table-skeleton"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: number
  name: string
  email: string
  classId: number
  className: string
  classLevel: number
  assessmentCount: number
  courseIds: number[]
}

interface Course {
  id: number
  code: string
  title: string
}

interface ClassOption {
  id: number
  name: string
  level: number
}

interface GradebookData {
  students: Student[]
  courses: Course[]
  classes: ClassOption[]
  levels: number[]
}

// ─── Sort button ──────────────────────────────────────────────────────────────

function SortHeader({ label, column }: { label: string; column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-800 transition-colors"
    >
      {label}
      <ArrowUpDown size={11} className={column.getIsSorted() ? "text-[#002388]" : "text-slate-300"} />
    </button>
  )
}

// ─── Custom filter fn for courseIds array ─────────────────────────────────────

const courseArrayFilter: FilterFn<Student> = (row, columnId, filterValue) => {
  if (!filterValue || filterValue === "all") return true
  const courseIds: number[] = row.getValue(columnId)
  return courseIds.includes(Number(filterValue))
}

// ─── Column definitions ───────────────────────────────────────────────────────

function buildColumns(router: ReturnType<typeof useRouter>): ColumnDef<Student>[] {
  return [
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => <SortHeader label="Student" column={column} />,
      cell: ({ row }) => (
        <div>
          <p className="text-[13px] font-semibold text-[#1e293b]">{row.original.name}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.email}</p>
        </div>
      ),
      filterFn: (row, _id, value) => {
        const q = value.toLowerCase()
        return (
          row.original.name.toLowerCase().includes(q) ||
          row.original.email.toLowerCase().includes(q)
        )
      },
    },
    {
      id: "className",
      accessorKey: "className",
      header: ({ column }) => <SortHeader label="Class" column={column} />,
      cell: ({ row }) => (
        <div>
          <p className="text-[13px] font-medium text-[#1e293b]">{row.original.className}</p>
          <p className="text-[11px] text-slate-400">Level {row.original.classLevel}</p>
        </div>
      ),
    },
    {
      id: "classLevel",
      accessorKey: "classLevel",
      header: () => null,
      cell: () => null,
      enableHiding: false,
      filterFn: (row, _id, value) => {
        if (!value || value === "all") return true
        return row.original.classLevel === Number(value)
      },
    },
    {
      id: "courseIds",
      accessorKey: "courseIds",
      header: () => null,
      cell: () => null,
      enableHiding: false,
      filterFn: courseArrayFilter,
    },
    {
      id: "classId",
      accessorKey: "classId",
      header: () => null,
      cell: () => null,
      enableHiding: false,
      filterFn: (row, _id, value) => {
        if (!value || value === "all") return true
        return row.original.classId === Number(value)
      },
    },
    {
      id: "assessmentCount",
      accessorKey: "assessmentCount",
      header: ({ column }) => <SortHeader label="Assessments" column={column} />,
      cell: ({ row }) => {
        const n = row.original.assessmentCount
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#002388]"
                style={{ width: `${Math.min((n / 10) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[12px] font-semibold text-[#1e293b] tabular-nums">{n}</span>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end pr-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/lecturer/grades/${row.original.id}`)
            }}
            className="inline-flex items-center gap-1.5 rounded-sm bg-[#ffb900] hover:bg-[#e6a700] text-[#1e293b] px-3 py-1.5 text-[11px] font-semibold transition-colors"
          >
            View Results <ArrowRight size={12} />
          </button>
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GradebookClient() {
  const router = useRouter()
  const [data, setData] = useState<GradebookData | null>(null)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [courseFilter, setCourseFilter] = useState("all")
  const [classFilter, setClassFilter] = useState("all")
  const [levelFilter, setLevelFilter] = useState("all")

  useEffect(() => {
    fetch("/api/lecturer/gradebook")
      .then((r) => r.json())
      .then((d: GradebookData) => setData(d))
      .catch(() => toast.error("Failed to load gradebook"))
      .finally(() => setLoading(false))
  }, [])

  const columns = useMemo(() => buildColumns(router), [router])

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility] = useState({ courseIds: false, classId: false, classLevel: false })

  useEffect(() => {
    const filters: ColumnFiltersState = []
    if (search) filters.push({ id: "name", value: search })
    if (courseFilter !== "all") filters.push({ id: "courseIds", value: courseFilter })
    if (classFilter !== "all") filters.push({ id: "classId", value: classFilter })
    if (levelFilter !== "all") filters.push({ id: "classLevel", value: levelFilter })
    setColumnFilters(filters)
  }, [search, courseFilter, classFilter, levelFilter])

  const table = useReactTable({
    data: data?.students ?? [],
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  const hasFilters = search || courseFilter !== "all" || classFilter !== "all" || levelFilter !== "all"

  const clearFilters = () => {
    setSearch("")
    setCourseFilter("all")
    setClassFilter("all")
    setLevelFilter("all")
  }

  if (loading) {
    return (
      <div className="relative">
        <TableSkeleton />
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
          <div className="scale-75 opacity-80"><LoadingLogo /></div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const totalStudents = data.students.length
  const filteredCount = table.getFilteredRowModel().rows.length

  return (
    <div className="space-y-5">

      {/* Filter bar */}
      <div className="rounded-sm border border-border bg-white p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px] group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 transition-colors group-focus-within:text-[#002388]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9 h-9 rounded-sm border-slate-200 text-[13px] focus-visible:ring-[#002388] focus-visible:border-[#002388]"
          />
        </div>

        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="h-9 w-full sm:w-52 rounded-sm border-slate-200 text-[13px]">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {data.courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.code} — {c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="h-9 w-full sm:w-44 rounded-sm border-slate-200 text-[13px]">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {data.classes.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-9 w-full sm:w-32 rounded-sm border-slate-200 text-[13px]">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {data.levels.map((l) => (
              <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 rounded-sm text-slate-500 gap-1.5 shrink-0 hover:text-slate-800"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Result count */}
      <p className="text-[11px] text-muted-foreground">
        Showing <span className="text-[#1e293b] font-semibold">{filteredCount}</span> of{" "}
        <span className="text-[#1e293b] font-semibold">{totalStudents}</span> students
        {hasFilters && " matching filters"}
      </p>

      {/* Table */}
      {filteredCount === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-white px-6 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Users className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-[14px] font-semibold text-[#1e293b]">
            {hasFilters ? "No students match your filters" : "No students enrolled yet"}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-xs">
            {hasFilters
              ? "Try adjusting your search or filters."
              : "Students will appear here once they are enrolled in your assessment classes."}
          </p>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="mt-4 rounded-sm border border-border px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-sm border border-border overflow-hidden bg-white">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-slate-50 hover:bg-slate-50 border-b border-border">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id} className="h-10 px-5">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0"
                  onClick={() => router.push(`/lecturer/grades/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-5 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {filteredCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
          <p className="text-[11px] text-slate-500">
            Page{" "}
            <span className="font-semibold text-slate-700">{table.getState().pagination.pageIndex + 1}</span>
            {" "}of{" "}
            <span className="font-semibold text-slate-700">{table.getPageCount()}</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium">Rows</span>
              <Select value={String(table.getState().pagination.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-16 rounded-sm border-slate-200 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top" className="rounded-sm">
                  {[10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs font-medium">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-slate-200" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-slate-200" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-slate-200" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-slate-200" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
