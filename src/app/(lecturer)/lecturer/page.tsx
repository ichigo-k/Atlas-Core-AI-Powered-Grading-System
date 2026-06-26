import { Suspense } from "react"
import type React from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Plus, ArrowRight, Clock, BookOpen, Users, ClipboardList, FileText, Zap, LayoutDashboard, ChevronRight } from "lucide-react"
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
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-48 rounded-sm bg-[#edebe9] animate-pulse" />
          <div className="h-3 w-36 rounded-sm bg-[#edebe9] animate-pulse" />
        </div>
        <div className="h-8 w-36 rounded-sm bg-[#edebe9] animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-sm border border-border bg-white p-4 space-y-3">
            <div className="h-2.5 w-20 rounded-sm bg-[#edebe9] animate-pulse" />
            <div className="h-7 w-12 rounded-sm bg-[#edebe9] animate-pulse" />
            <div className="h-2.5 w-16 rounded-sm bg-[#edebe9] animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-sm border border-border bg-white p-5 h-40 animate-pulse" />
        <div className="rounded-sm border border-border bg-white h-40 animate-pulse" />
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
  const published = assessments.filter((a: any) => a.status === "PUBLISHED").length
  const draft = assessments.filter((a: any) => a.status === "DRAFT").length
  const closed = assessments.filter((a: any) => a.status === "CLOSED").length

  const courses = (profile?.courses ?? []).map((c: any) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    classCount: c.classes.length,
    studentCount: c.classes.reduce((acc: number, cl: { _count: { students: number } }) => acc + cl._count.students, 0),
  }))

  const totalStudents = courses.reduce((acc, c) => acc + c.studentCount, 0)

  // Type breakdown
  const typeCounts = { EXAM: 0, QUIZ: 0, ASSIGNMENT: 0 }
  for (const a of assessments) {
    typeCounts[a.type as keyof typeof typeCounts]++
  }

  // Live + upcoming (published, ends in future)
  const upcomingAndLive = assessments
    .filter((a: any) => a.status === "PUBLISHED" && isAfter(new Date(a.endsAt), now))
    .slice(0, 5)
    .map((a: any) => ({
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
    .filter((a: any) => a.status === "DRAFT")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 4)
    .map((a: any) => ({
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
  icon,
}: {
  label: string
  value: number
  sub?: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-sm border border-border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
          <p className="text-[26px] font-semibold text-[#1e293b] mt-1.5 leading-none">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
        </div>
        <div className="p-1.5 rounded bg-[#f3f2f1] flex-shrink-0">{icon}</div>
      </div>
    </div>
  )
}

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  if (status === "LIVE") return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#fde7e9] text-[#d13438]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#d13438] animate-pulse" />
      Live
    </span>
  )
  if (status === "UPCOMING") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#dce6f7] text-[#002388]">
      Upcoming
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#f3f2f1] text-[#605e5c]">
      {status}
    </span>
  )
}

// ─── Dashboard content ────────────────────────────────────────────────────────

function DashboardContent({ data }: { data: DashboardData }) {
  const firstName = data.name.split(" ")[0]
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  return (
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full flex flex-col">
      {/* Sticky command bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-shrink-0">
        <LayoutDashboard size={11} />
        <span>Lecturer</span>
        <ChevronRight size={11} />
        <span className="text-[#002388] font-medium">Dashboard</span>
      </div>

      <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#1e293b]">Welcome back, {firstName}</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">{dateStr}</p>
          </div>
          <Link
            href="/lecturer/assessments/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-sm text-[12px] font-semibold hover:bg-[#001570] transition-colors"
          >
            <Plus size={13} />
            New Assessment
          </Link>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Total" value={data.stats.total} sub="All assessments" icon={<ClipboardList size={16} className="text-[#605e5c]" strokeWidth={1.6} />} />
          <StatTile label="Published" value={data.stats.published} sub="Currently active" icon={<Zap size={16} className="text-[#605e5c]" strokeWidth={1.6} />} />
          <StatTile label="Drafts" value={data.stats.draft} sub="In progress" icon={<FileText size={16} className="text-[#605e5c]" strokeWidth={1.6} />} />
          <StatTile label="Students" value={data.stats.totalStudents} sub={`${data.stats.totalCourses} course${data.stats.totalCourses !== 1 ? "s" : ""}`} icon={<Users size={16} className="text-[#605e5c]" strokeWidth={1.6} />} />
        </div>

        {/* Chart + Live assessments */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <DashboardCharts typeCounts={data.typeCounts} />

          <div className="rounded-sm border border-border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-primary" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-[#1e293b]">Live & Upcoming</span>
              </div>
              <Link href="/lecturer/assessments" className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                All <ArrowRight size={12} />
              </Link>
            </div>
            {data.upcomingAndLive.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                No live or upcoming assessments.
              </div>
            ) : (
              <div className="divide-y divide-[#f1f5f9]">
                {data.upcomingAndLive.map((a: any) => (
                  <Link
                    key={a.id}
                    href={`/lecturer/assessments/${a.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1e293b] truncate">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
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

          <div className="rounded-sm border border-border bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <BookOpen size={14} className="text-primary" strokeWidth={2} />
              <span className="text-[13px] font-semibold text-[#1e293b]">My Courses</span>
            </div>
            {data.courses.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">No courses assigned yet.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f3f2f1] border-b border-border">
                    <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Course</th>
                    <th className="px-5 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Classes</th>
                    <th className="px-5 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Students</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {data.courses.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-[13px] font-semibold text-[#1e293b]">{c.code}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{c.title}</p>
                      </td>
                      <td className="px-5 py-3 text-center text-[13px] text-[#1e293b]">{c.classCount}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-[12px] text-[#1e293b]">
                          <Users size={11} className="text-muted-foreground" />
                          {c.studentCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-sm border border-border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-primary" strokeWidth={2} />
                <span className="text-[13px] font-semibold text-[#1e293b]">Recent Drafts</span>
              </div>
              <Link href="/lecturer/assessments" className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                All <ArrowRight size={12} />
              </Link>
            </div>
            {data.recentDrafts.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">No drafts.</div>
            ) : (
              <div className="divide-y divide-[#f1f5f9]">
                {data.recentDrafts.map((d: any) => (
                  <Link
                    key={d.id}
                    href={`/lecturer/assessments/${d.id}/edit`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1e293b] truncate">{d.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{d.courseCode} · edited {format(new Date(d.updatedAt), "MMM d")}</p>
                    </div>
                    <ArrowRight size={12} className="text-muted-foreground flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
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
