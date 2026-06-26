import Link from "next/link"
import {
  ArrowLeft,
  MapPin,
  Lock,
  Shuffle,
  RotateCcw,
  Clock,
  Users,
  BookOpen,
  Calendar,
  Edit2,
  BarChart2,
} from "lucide-react"
import { format } from "date-fns"
import type { AssessmentWithDetails } from "@/lib/assessment-types"
import EditSettingsModal from "./EditSettingsModal"
import ReopenAssessmentButton from "./ReopenAssessmentButton"
import ProctoringTab from "./ProctoringTab"

const typeBadge: Record<string, string> = {
  EXAM: "bg-red-50 text-red-700 border-red-200",
  QUIZ: "bg-amber-50 text-amber-700 border-amber-200",
  ASSIGNMENT: "bg-blue-50 text-blue-700 border-blue-200",
}

const statusBadge: Record<string, { cls: string; dot: string }> = {
  DRAFT: { cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
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

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="w-4 shrink-0 text-muted-foreground flex items-center justify-center">{icon}</div>
      <span className="w-32 shrink-0 text-[11px] font-medium text-muted-foreground">{label}</span>
      <span className="text-[13px] text-[#1e293b]">{value}</span>
    </div>
  )
}

interface Props {
  assessment: AssessmentWithDetails
  userId: number
}

export default function AssessmentDetailView({ assessment, userId }: Props) {
  const totalQuestions = assessment.sections.reduce((acc, s) => acc + s.questions.length, 0)
  const status = statusBadge[assessment.status] ?? statusBadge.DRAFT

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">

      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/lecturer/assessments"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#002388] transition-colors"
        >
          <ArrowLeft size={13} />
          Assessments
        </Link>
        {assessment.status === "DRAFT" ? (
          <Link
            href={`/lecturer/assessments/${assessment.id}/edit`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Edit2 size={12} />
            Edit
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            {assessment.status === "CLOSED" && (
              <ReopenAssessmentButton assessmentId={assessment.id} />
            )}
            <EditSettingsModal assessment={assessment} />
            <Link
              href={`/lecturer/assessments/${assessment.id}/results`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <BarChart2 size={12} />
              Results
            </Link>
          </div>
        )}
      </div>

      {/* Hero card */}
      <div className="rounded-sm border border-slate-200 bg-white overflow-hidden">
        <div className={`h-1 w-full ${assessment.status === "PUBLISHED" ? "bg-green-500" : assessment.status === "CLOSED" ? "bg-slate-400" : "bg-[#002388]"}`} />
        <div className="p-6 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={typeBadge[assessment.type]}>{assessment.type}</Chip>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${status.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {assessment.status}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-[#1e293b]">{assessment.title}</h1>
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <BookOpen size={13} className="text-[#002388] shrink-0" />
            {assessment.courseCode} — {assessment.courseTitle}
          </p>
        </div>
        <div className="border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100">
          <StatTile value={assessment.totalMarks} label="Total Marks" />
          <StatTile value={totalQuestions} label="Questions" />
          <StatTile value={assessment.sections.length} label="Sections" />
          <StatTile value={assessment.durationMinutes ? `${assessment.durationMinutes}m` : "—"} label="Duration" />
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-3">Schedule</p>
          <MetaRow icon={<Calendar size={13} />} label="Opens" value={format(new Date(assessment.startsAt), "MMM d, yyyy · HH:mm")} />
          <MetaRow icon={<Calendar size={13} />} label="Closes" value={format(new Date(assessment.endsAt), "MMM d, yyyy · HH:mm")} />
          <MetaRow icon={<Clock size={13} />} label="Duration" value={assessment.durationMinutes ? `${assessment.durationMinutes} minutes` : "Unlimited"} />
          <MetaRow icon={<RotateCcw size={13} />} label="Max Attempts" value={assessment.maxAttempts} />
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-3">Configuration</p>
          <MetaRow icon={<MapPin size={13} />} label="Location" value={assessment.isLocationBound ? (assessment.location || "Location-Bound") : "Anywhere"} />
          <MetaRow icon={<Lock size={13} />} label="Password" value={assessment.passwordProtected ? "Protected" : "None"} />
          <MetaRow icon={<Shuffle size={13} />} label="Shuffle Questions" value={<span className={assessment.shuffleQuestions ? "text-[#002388]" : "text-slate-400"}>{assessment.shuffleQuestions ? "Yes" : "No"}</span>} />
          <MetaRow icon={<Shuffle size={13} />} label="Shuffle Options" value={<span className={assessment.shuffleOptions ? "text-[#002388]" : "text-slate-400"}>{assessment.shuffleOptions ? "Yes" : "No"}</span>} />
        </div>

        <div className="rounded-sm border border-slate-200 bg-white p-5 md:col-span-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-3 flex items-center gap-1.5">
            <Users size={12} />
            Assigned Classes
          </p>
          {assessment.classes.length === 0 ? (
            <p className="text-sm text-slate-400">No classes assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assessment.classes.map((c: any) => (
                <span key={c.id} className="inline-flex items-center px-3 py-1.5 rounded-sm border border-slate-200 bg-slate-50 text-xs text-slate-700">
                  {c.className}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sections table */}
      {assessment.sections.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-sm text-slate-400">No sections have been added yet.</p>
        </div>
      ) : (
        <div className="rounded-sm border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]">Sections</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Section</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Questions</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assessment.sections.map((section, secIdx) => {
                const isObjective = section.type === "OBJECTIVE"
                const required = section.requiredQuestionsCount ?? section.questions.length
                const sectionMarks = section.questions
                  .map((q: any) => q.marks)
                  .sort((a, b) => b - a)
                  .slice(0, required)
                  .reduce((acc, m) => acc + m, 0)
                const pct = assessment.totalMarks > 0 ? Math.round((sectionMarks / assessment.totalMarks) * 100) : 0
                return (
                  <tr key={section.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-[#002388] text-white text-[10px] font-medium">
                        {secIdx + 1}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-[#1e293b]">
                      {section.name || <span className="italic text-muted-foreground">Untitled</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em]"
                        style={isObjective ? { background: "#dbeafe", color: "#1e40af" } : { background: "#f3e8ff", color: "#6b21a8" }}
                      >
                        {isObjective ? "Objective" : "Subjective"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-muted-foreground">
                      {section.requiredQuestionsCount
                        ? `Answer ${section.requiredQuestionsCount} of ${section.questions.length}`
                        : `All ${section.questions.length}`}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-[13px] font-semibold text-[#1e293b]">{sectionMarks}</span>
                      <span className="text-[11px] text-muted-foreground ml-1">({pct}%)</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={4} className="px-5 py-2.5 text-[11px] text-muted-foreground">
                  {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} across {assessment.sections.length} section{assessment.sections.length !== 1 ? "s" : ""}
                </td>
                <td className="px-5 py-2.5 text-right text-[13px] font-semibold text-primary">
                  {assessment.totalMarks} pts
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Proctoring */}
      {assessment.proctoringEnabled && (
        <ProctoringTab assessmentId={assessment.id} userId={userId} />
      )}
    </div>
  )
}
