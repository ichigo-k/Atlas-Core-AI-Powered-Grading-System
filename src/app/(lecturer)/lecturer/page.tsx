import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, ArrowRight, Clock, BookOpen, Users, ClipboardList, FileText, Zap } from "lucide-react"
import { format, isAfter, isBefore } from "date-fns"
import DashboardCharts from "./DashboardCharts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  name: string
  stats: {
    total: number
    published: number
    draft: number
    closed: number
    totalStudents: number
    totalCourses: number
  }
  upcomingAndLive: Array<{
    id: number
    title: string
    type: string
    status: string
    courseCode: string
    startsAt: Date
    endsAt: Date
    classCount: number
  }>
  courses: Array<{
    id: number
    code: string
    title: string
    classCount: number
    studentCount: number
  }>
  typeCounts: { EXAM: number; QUIZ: number; ASSIGNMENT: number }
  recentDrafts: Array<{
    id: number
    title: string
    courseCode: string
    updatedAt: Date
  }>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-4 w-36 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-100 animate-pulse" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
            <div className="h-8 w-14 rounded-lg bg-slate-100 animate-pulse" />
            <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Chart + Live panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Chart card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div className="h-3 w-36 rounded bg-slate-100 animate-pulse" />
          <div className="flex items-center gap-8">
            {/* doughnut placeholder */}
            <div className="h-36 w-36 shrink-0 rounded-full border-slate-100 animate-pulse" style={{ borderWidth: 14 }} />
            {/* legend rows */}
            <div className="flex-1 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-100 animate-pulse shrink-0" />
                  <div className="h-3 flex-1 rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-6 rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-8 rounded bg-slate-100 animate-pulse" />
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3 flex items-center gap-3">
                <div className="h-2.5 w-2.5 shrink-0" />
                <div className="h-3 flex-1 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-6 rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-8 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Live & Upcoming card */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-8 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="divide-y divide-slate-100">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Courses + Drafts */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Courses table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="divide-y divide-slate-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-20 rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="h-4 w-6 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-12 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Drafts */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-8 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="divide-y divide-slate-100">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 rounded bg-slate-100 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="h-3 w-3 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

async function DashboardData() {
  const session = await auth()
  if (!session || session.user.role !== "LECTURER") redirect("/")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, name: true },
  })
  if (!user) redirect("/")

  const now = new Date()

  const [assessments, profile] = await Promise.all([
    prisma.assessment.findMany({
      where: { lecturerId: user.id },
      include: {
        course: { select: { code: true } },
        _count: { select: { classes: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.lecturerProfile.findUnique({
      where: { id: user.id },
      include: {
        courses: {
          include: {
            classes: {
              include: {
                _count: { select: { students: true } },
              },
            },
          },
        },
      },
    }),
  ])

  // Stats
  const total = assessments.length
  const published = assessments.filter((a) => a.status === "PUBLISHED").length
  const draft = assessments.filter((a) => a.status === "DRAFT").length
  const closed = assessments.filter((a) => a.status === "CLOSED").length

  const courses = (profile?.courses ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    classCount: c.classes.length,
    studentCount: c.classes.reduce((acc, cl) => acc + cl._count.students, 0),
  }))

  const totalStudents = courses.reduce((acc, c) => acc + c.studentCount, 0)

  // Type breakdown
  const typeCounts = { EXAM: 0, QUIZ: 0, ASSIGNMENT: 0 }
  for (const a of assessments) {
    typeCounts[a.type as keyof typeof typeCounts]++
  }

  // Live + upcoming (published, ends in future)
  const upcomingAndLive = assessments
    .filter((a) => a.status === "PUBLISHED" && isAfter(new Date(a.endsAt), now))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      status: isAfter(now, new Date(a.startsAt)) ? "LIVE" : "UPCOMING",
      courseCode: a.course.code,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      classCount: a._count.classes,
    }))

  // Recent drafts
  const recentDrafts = assessments
    .filter((a) => a.status === "DRAFT")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 4)
    .map((a) => ({
      id: a.id,
      title: a.title,
      courseCode: a.course.code,
      updatedAt: a.updatedAt,
    }))

  const data: DashboardData = {
    name: user.name ?? "Lecturer",
    stats: { total, published, draft, closed, totalStudents, totalCourses: courses.length },
    upcomingAndLive,
    courses,
    typeCounts,
    recentDrafts,
  }

  return <DashboardContent data={data} />
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 ${accent ? "border-[#002388]/20" : "border-slate-200"}`}>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]">{label}</p>
      <p className={`text-3xl font-semibold mt-1.5 ${accent ? "text-[#002388]" : "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  if (status === "LIVE") return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border bg-red-50 text-red-600 border-red-200">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      Live
    </span>
  )
  if (status === "UPCOMING") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-blue-50 text-blue-700 border-blue-200">
      Upcoming
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-slate-100 text-slate-500 border-slate-200">
      {status}
    </span>
  )
}

// ─── Dashboard content ────────────────────────────────────────────────────────

function DashboardContent({ data }: { data: DashboardData }) {
  const firstName = data.name.split(" ")[0]

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Good day, {firstName}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">Here's your teaching overview.</p>
        </div>
        <Link
          href="/lecturer/assessments/new"
          className="inline-flex items-center gap-2 h-9 px-4 bg-[#002388] text-white rounded-lg text-sm hover:bg-[#0B4DBB] transition-colors"
        >
          <Plus size={15} />
          New Assessment
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total Assessments" value={data.stats.total} accent />
        <StatTile label="Published" value={data.stats.published} sub="currently active" />
        <StatTile label="Drafts" value={data.stats.draft} sub="in progress" />
        <StatTile label="Students" value={data.stats.totalStudents} sub={`across ${data.stats.totalCourses} course${data.stats.totalCourses !== 1 ? "s" : ""}`} />
      </div>

      {/* Chart + Live assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

        {/* Bar chart — client component */}
        <DashboardCharts typeCounts={data.typeCounts} />

        {/* Live / Upcoming */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#EAF1FF]/60">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
              <Zap size={12} className="text-[#002388]" />
              Live & Upcoming
            </p>
            <Link href="/lecturer/assessments" className="text-xs text-slate-400 hover:text-[#002388] transition-colors flex items-center gap-1">
              All <ArrowRight size={11} />
            </Link>
          </div>
          {data.upcomingAndLive.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <ClipboardList size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No live or upcoming assessments.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.upcomingAndLive.map((a) => (
                <Link
                  key={a.id}
                  href={`/lecturer/assessments/${a.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{a.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} />
                      {a.status === "LIVE"
                        ? `Ends ${format(new Date(a.endsAt), "MMM d, HH:mm")}`
                        : `Starts ${format(new Date(a.startsAt), "MMM d, HH:mm")}`}
                    </p>
                  </div>
                  <StatusChip status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Courses + Recent Drafts */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

        {/* Courses */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-[#EAF1FF]/60">
            <p className="text-[11px] font-semibold text-[#002388] uppercase tracking-[0.12em] flex items-center gap-1.5">
              <BookOpen size={12} className="text-[#002388]" />
              My Courses
            </p>
          </div>
          {data.courses.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">No courses assigned yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#EAF1FF] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#002388] uppercase tracking-wider">Course</th>
                  <th className="px-5 py-2.5 text-center text-[11px] font-semibold text-[#002388] uppercase tracking-wider">Classes</th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-[#002388] uppercase tracking-wider">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.courses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-slate-900">{c.code}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.title}</p>
                    </td>
                    <td className="px-5 py-3 text-center text-sm text-slate-600">{c.classCount}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <Users size={11} className="text-slate-400" />
                        {c.studentCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Drafts */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#EAF1FF]/60">
            <p className="text-[11px] font-semibold text-[#002388] uppercase tracking-[0.12em] flex items-center gap-1.5">
              <FileText size={12} className="text-[#002388]" />
              Recent Drafts
            </p>
            <Link href="/lecturer/assessments" className="text-xs text-slate-400 hover:text-[#002388] transition-colors flex items-center gap-1">
              All <ArrowRight size={11} />
            </Link>
          </div>
          {data.recentDrafts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-400">No drafts.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentDrafts.map((d) => (
                <Link
                  key={d.id}
                  href={`/lecturer/assessments/${d.id}/edit`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate group-hover:text-[#002388] transition-colors">{d.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{d.courseCode} · edited {format(new Date(d.updatedAt), "MMM d")}</p>
                  </div>
                  <ArrowRight size={12} className="text-slate-300 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LecturerDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  )
}
