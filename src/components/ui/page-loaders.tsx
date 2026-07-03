import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Search,
  SlidersHorizontal,
  Upload,
  UserPlus,
  ArrowUpCircle,
  FolderPlus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LoaderTone = "admin" | "lecturer" | "student";

const toneClasses: Record<LoaderTone, { accent: string; faint: string }> = {
  admin: { accent: "bg-[#002388]", faint: "bg-[#dde5f5]" },
  lecturer: { accent: "bg-[#ffb900]", faint: "bg-amber-100" },
  student: { accent: "bg-emerald-500", faint: "bg-emerald-100" },
};

function PulseRail({ tone = "admin" }: { tone?: LoaderTone }) {
  const classes = toneClasses[tone];

  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className={`h-1.5 w-8 rounded-full ${classes.accent} animate-pulse`} />
      <span className={`h-1.5 w-4 rounded-full ${classes.faint} animate-pulse [animation-delay:150ms]`} />
      <span className={`h-1.5 w-2 rounded-full ${classes.faint} animate-pulse [animation-delay:300ms]`} />
    </div>
  );
}

// ─── Real (non-skeleton) chrome ─────────────────────────────────────────────
// The controls below render exactly like the finished page — same labels,
// icons, and layout. Only the rows underneath (the actual data) animate.
// They're inert (no handlers) since the data they'd act on isn't loaded yet.

/** The real search input + "Columns" button that DataTable renders. */
function TableToolbarChrome({
  placeholder,
  extra,
}: {
  placeholder: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder={placeholder}
          disabled
          className="pl-9 h-10 rounded-sm border-border text-[12px] disabled:opacity-100 disabled:cursor-default"
        />
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <Button
          variant="outline"
          size="sm"
          disabled
          className="h-10 gap-2 rounded-sm border-border text-[#323130] font-semibold text-[11px] uppercase tracking-wider disabled:opacity-100"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Columns
        </Button>
      </div>
    </div>
  );
}

/** The real table header row with actual column labels — no shimmer. */
function TableHeaderChrome({ labels }: { labels: string[] }) {
  return (
    <div className="h-11 bg-slate-50/80 border-b border-border flex items-center px-5">
      {labels.map((label, i) => (
        <span
          key={i}
          className="flex-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** The real pagination footer controls — static, since there's no data to paginate yet. */
function TableFooterChrome() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border bg-slate-50/50 px-5 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        &nbsp;
      </span>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rows</span>
          <div className="flex h-8 w-16 items-center justify-center rounded-sm border border-border text-[11px] font-semibold text-slate-400">
            10
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight].map((Icon, i) => (
            <Button key={i} variant="outline" disabled className="h-8 w-8 p-0 rounded-sm border-border disabled:opacity-100">
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The data area — following the AWS console / Cloudscape pattern: the table
 * chrome (header, toolbar, pagination controls) is real and stays put, and
 * only the body shows a plain spinner + status text while data streams in.
 * A thin indeterminate bar under the header signals activity without the
 * "fake content" look of shimmering placeholder rows.
 */
function TableLoadingBody({ label }: { label: string }) {
  return (
    <div>
      <div className="relative h-0.5 w-full overflow-hidden bg-[#dde5f5]">
        <div className="absolute inset-y-0 w-1/3 animate-loading-sweep bg-[#002388]" />
      </div>
      <div className="flex flex-col items-center justify-center gap-2.5 py-16">
        <Loader2 className="h-4 w-4 animate-spin text-[#002388]" />
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function TableShell({
  headers,
  loadingLabel,
}: {
  headers: string[];
  loadingLabel: string;
}) {
  return (
    <div className="rounded-sm border border-border bg-white overflow-hidden">
      <TableHeaderChrome labels={headers} />
      <TableLoadingBody label={loadingLabel} />
      <TableFooterChrome />
    </div>
  );
}

// ─── Route-level (first paint) ──────────────────────────────────────────────

export function AdminRouteSkeleton() {
  return (
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full flex flex-col">
      <div className="sticky top-12 z-40 bg-white dark:bg-[#192534] border-b border-border px-5 py-2.5 flex items-center gap-1.5">
        <Skeleton className="h-2.5 w-2.5 rounded-sm" />
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-2 rounded-full" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12 w-full">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <PulseRail tone="admin" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32 rounded-sm" />
        </div>
        <AdminTableSkeleton />
      </div>
    </div>
  );
}

// ─── Page-specific skeletons ─────────────────────────────────────────────────

/** Generic fallback — used where no dedicated skeleton exists yet. */
export function AdminTableSkeleton() {
  return (
    <div className="space-y-4">
      <TableToolbarChrome placeholder="Search..." />
      <TableShell headers={["Name", "Details", "Status", ""]} loadingLabel="Loading…" />
    </div>
  );
}

/** /admin/users — tabs, status filter, real toolbar, only rows animate. */
export function AdminUsersSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3">
        <Button
          disabled
          className="flex items-center gap-2 rounded-sm border border-border bg-white px-4 py-2 h-auto text-[12px] font-semibold text-slate-700 disabled:opacity-100"
        >
          <Upload size={18} className="text-slate-400" />
          Bulk Import
        </Button>
        <Button
          disabled
          className="flex items-center gap-2 rounded-sm bg-[#002388] px-4 py-2 h-auto text-[12px] font-semibold text-white disabled:opacity-100 disabled:bg-[#002388]"
        >
          <UserPlus size={18} />
          Add User
        </Button>
      </div>

      <div className="flex items-center gap-8 border-b border-border">
        {["Students", "Lecturers", "Admins"].map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2.5 pb-4 text-sm font-medium ${
              i === 0 ? "text-[#002388] font-semibold" : "text-slate-500"
            }`}
          >
            {label}
            <Skeleton className="h-4 w-7 rounded-full" />
            {i === 0 && <span className="absolute bottom-0 left-0 right-0 h-[2px]" />}
          </div>
        ))}
      </div>

      <TableToolbarChrome
        placeholder="Search users by name, email, or index number..."
        extra={
          <Button
            variant="outline"
            size="sm"
            disabled
            className="h-10 gap-2 rounded-sm border-border text-[#323130] text-[11px] font-semibold uppercase tracking-wider disabled:opacity-100"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Status: All
          </Button>
        }
      />

      <TableShell headers={["User Name", "Details", "Status", ""]} loadingLabel="Loading users…" />
    </div>
  );
}

/** /admin/courses — real toolbar, only rows animate. */
export function AdminCoursesSkeleton() {
  return (
    <div className="space-y-8">
      <TableToolbarChrome placeholder="Search courses by title or code..." />
      <TableShell
        headers={["Course Title", "Lecturers", "Classes", ""]}
        loadingLabel="Loading courses…"
      />
    </div>
  );
}

/** /admin/classes — real action buttons + toolbar, only rows animate. */
export function AdminClassesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button
          disabled
          className="flex items-center gap-2 rounded-sm border border-border bg-white px-4 py-2 h-auto text-[12px] font-semibold text-slate-700 disabled:opacity-100"
        >
          <ArrowUpCircle size={18} className="text-slate-400" />
          Bulk Upgrade Levels
        </Button>
        <Button
          disabled
          className="flex items-center gap-2 rounded-sm bg-[#002388] px-4 py-2 h-auto text-[12px] font-semibold text-white disabled:opacity-100 disabled:bg-[#002388]"
        >
          <FolderPlus size={18} />
          Create Class
        </Button>
      </div>
      <TableToolbarChrome placeholder="Search..." />
      <TableShell
        headers={["Class Name", "Students", "Courses", "Status", ""]}
        loadingLabel="Loading classes…"
      />
    </div>
  );
}

/** /admin/faculties — real "Add Faculty" button + toolbar, only rows animate. */
export function AdminFacultiesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button disabled className="bg-[#002388] disabled:opacity-100 disabled:bg-[#002388]">
          Add Faculty
        </Button>
      </div>
      <TableToolbarChrome placeholder="Search faculties..." />
      <TableShell headers={["Name", "Code", ""]} loadingLabel="Loading faculties…" />
    </div>
  );
}

/** /admin/programs — real "Add Program" button + toolbar, only rows animate. */
export function AdminProgramsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-3">
        <Button disabled className="bg-[#002388] disabled:opacity-100 disabled:bg-[#002388]">
          Add Program
        </Button>
      </div>
      <TableToolbarChrome placeholder="Search programs..." />
      <TableShell headers={["Name", "Code", "Faculty", ""]} loadingLabel="Loading programs…" />
    </div>
  );
}

// ─── Lecturer / Student loaders (unchanged) ─────────────────────────────────

export function LecturerTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-sm border border-border bg-white p-4">
            <PulseRail tone="lecturer" />
            <Skeleton className="mt-4 h-7 w-14" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-sm border border-border bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-9 w-64 rounded-sm" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-sm" />
            <Skeleton className="h-9 w-28 rounded-sm" />
          </div>
        </div>
        <SkeletonRows columns={6} rows={7} />
      </div>
    </div>
  );
}

export function LecturerDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-white p-5">
        <PulseRail tone="lecturer" />
        <Skeleton className="mt-4 h-7 w-72 max-w-full" />
        <Skeleton className="mt-2 h-3 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-sm border border-border bg-white p-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="mt-4 h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-52" />
          <Skeleton className="mt-6 h-9 w-full rounded-sm" />
        </div>
        <div className="rounded-sm border border-border bg-white p-4">
          <SkeletonRows columns={4} rows={6} />
        </div>
      </div>
    </div>
  );
}

export function StudentAssessmentSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="rounded-sm border border-border bg-white p-5">
        <PulseRail tone="student" />
        <Skeleton className="mt-4 h-7 w-64 max-w-full" />
        <Skeleton className="mt-3 h-3 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-3 rounded-sm border border-border bg-white p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-sm border border-slate-100 p-4">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
            </div>
          ))}
        </div>
        <div className="rounded-sm border border-border bg-white p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-24 w-full rounded-sm" />
          <Skeleton className="mt-4 h-9 w-full rounded-sm" />
        </div>
      </div>
    </div>
  );
}

function SkeletonRows({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="grid items-center gap-3 border-t border-slate-100 pt-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton
              key={col}
              className={col === 0 ? "h-5 w-full" : "h-4 w-4/5"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
