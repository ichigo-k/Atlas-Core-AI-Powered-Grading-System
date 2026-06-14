"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Step1State, LecturerCourse } from "@/lib/assessment-types"
import { CalendarClock, Clock } from "lucide-react"

function getWindowSummary(start: string, end: string): string | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null

  const diffMs = e.getTime() - s.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const diffHours = diffMins / 60
  const diffDays = diffHours / 24
  const diffWeeks = diffDays / 7

  let duration: string
  if (diffMins < 60) {
    duration = `${diffMins} minute${diffMins !== 1 ? "s" : ""}`
  } else if (diffHours < 24) {
    const h = Math.floor(diffHours)
    const m = diffMins % 60
    duration = m > 0 ? `${h}h ${m}m` : `${h} hour${h !== 1 ? "s" : ""}`
  } else if (diffDays < 14) {
    const d = Math.round(diffDays)
    duration = `${d} day${d !== 1 ? "s" : ""}`
  } else {
    const w = Math.round(diffWeeks)
    duration = `${w} week${w !== 1 ? "s" : ""}`
  }

  return `Students will have ${duration} to complete this assessment`
}

interface Step1BasicsProps {
  state: Step1State
  onChange: (updates: Partial<Step1State>) => void
  lecturerCourses: LecturerCourse[]
  errors: Partial<Record<keyof Step1State, string>>
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-4">
      {label}
    </p>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-rose-500 mt-1">{message}</p>
}

export default function Step1Basics({ state, onChange, lecturerCourses, errors }: Step1BasicsProps) {
  return (
    <div className="space-y-8">
      {/* General Information */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <SectionHeader label="General Information" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs text-slate-600">
              Assessment Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              value={state.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g. Midterm Examination"
              className="h-10 border-slate-200 bg-white focus-visible:ring-[#002388]/30"
            />
            <FieldError message={errors.title} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">
              Assigned Course <span className="text-rose-500">*</span>
            </Label>
            {lecturerCourses.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 h-10 flex items-center border border-slate-200">
                No courses assigned
              </p>
            ) : (
              <Select
                value={state.courseId ? String(state.courseId) : ""}
                onValueChange={(v) => onChange({ courseId: parseInt(v) })}
              >
                <SelectTrigger className="h-10 border-slate-200 bg-white focus:ring-[#002388]/30">
                  <SelectValue placeholder="Select course..." />
                </SelectTrigger>
                <SelectContent>
                  {lecturerCourses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.code} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError message={errors.courseId} />
          </div>
        </div>

        {/* Assessment Type */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-600">
            Assessment Type <span className="text-rose-500">*</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["EXAM", "QUIZ", "ASSIGNMENT"] as const).map((type) => {
              const labels: Record<string, { title: string; desc: string }> = {
                EXAM: { title: "Exam", desc: "Formal evaluation with structured sections." },
                QUIZ: { title: "Quiz", desc: "Short assessment for quick knowledge checks." },
                ASSIGNMENT: { title: "Assignment", desc: "Task-based evaluation requiring detailed review." },
              }
              const isSelected = state.type === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onChange({ type })}
                  className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-[#002388] bg-[#002388]/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? "border-[#002388]" : "border-slate-300"
                  }`}>
                    {isSelected && <div className="h-2 w-2 rounded-full bg-[#002388]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{labels[type].title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{labels[type].desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <FieldError message={errors.type} />
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <SectionHeader label="Schedule & Duration" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <Label htmlFor="startsAt" className="text-xs text-slate-600">
              Start Date & Time <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="startsAt"
                type="datetime-local"
                value={state.startsAt}
                onChange={(e) => onChange({ startsAt: e.target.value })}
                className="h-10 pl-9 border-slate-200 bg-white focus-visible:ring-[#002388]/30"
              />
            </div>
            <FieldError message={errors.startsAt} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endsAt" className="text-xs text-slate-600">
              End Date & Time <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                id="endsAt"
                type="datetime-local"
                value={state.endsAt}
                onChange={(e) => onChange({ endsAt: e.target.value })}
                className="h-10 pl-9 border-slate-200 bg-white focus-visible:ring-[#002388]/30"
              />
            </div>
            <FieldError message={errors.endsAt} />
          </div>

          {getWindowSummary(state.startsAt, state.endsAt) && (
            <div className="col-span-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#002388]/5 border border-[#002388]/10">
              <Clock className="h-3.5 w-3.5 text-[#002388] shrink-0" />
              <p className="text-xs text-[#002388]">
                {getWindowSummary(state.startsAt, state.endsAt)}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="durationMinutes" className="text-xs text-slate-600">
              Duration (minutes) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="durationMinutes"
              type="number"
              min={1}
              value={state.durationMinutes}
              onChange={(e) => onChange({ durationMinutes: e.target.value })}
              placeholder="e.g. 90"
              className="h-10 border-slate-200 bg-white focus-visible:ring-[#002388]/30"
            />
            <FieldError message={errors.durationMinutes} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxAttempts" className="text-xs text-slate-600">
              Max Attempts
            </Label>
            <Input
              id="maxAttempts"
              type="number"
              min={1}
              value={state.maxAttempts}
              onChange={(e) => onChange({ maxAttempts: e.target.value })}
              className="h-10 border-slate-200 bg-white focus-visible:ring-[#002388]/30"
            />
          </div>
        </div>
      </div>

      {/* Access & Security */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <SectionHeader label="Access & Security" />

        <div className="space-y-3">
          {/* Password Protection */}
          <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
            state.passwordProtected ? "border-[#002388]/20 bg-[#002388]/5" : "border-slate-100 bg-slate-50/50"
          }`}>
            <div>
              <p className="text-sm text-slate-800">Password Protection</p>
              <p className="text-xs text-slate-500 mt-0.5">Restrict access with a password</p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ passwordProtected: !state.passwordProtected, accessPassword: "" })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                state.passwordProtected ? "bg-[#002388]" : "bg-slate-200"
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                state.passwordProtected ? "translate-x-4" : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {state.passwordProtected && (
            <div className="space-y-1.5 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label htmlFor="accessPassword" className="text-xs text-slate-600">
                Access Password <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="accessPassword"
                value={state.accessPassword}
                onChange={(e) => onChange({ accessPassword: e.target.value })}
                placeholder="Enter access password"
                className="h-10 border-slate-200 bg-white focus-visible:ring-[#002388]/30"
              />
              <FieldError message={errors.accessPassword} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Shuffle Questions */}
            <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
              state.shuffleQuestions ? "border-[#002388]/20 bg-[#002388]/5" : "border-slate-100 bg-slate-50/50"
            }`}>
              <div>
                <p className="text-sm text-slate-800">Shuffle Questions</p>
                <p className="text-xs text-slate-500 mt-0.5">Randomize question order</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ shuffleQuestions: !state.shuffleQuestions })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  state.shuffleQuestions ? "bg-[#002388]" : "bg-slate-200"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  state.shuffleQuestions ? "translate-x-4" : "translate-x-0.5"
                }`} />
              </button>
            </div>

            {/* Shuffle Options */}
            <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
              state.shuffleOptions ? "border-[#002388]/20 bg-[#002388]/5" : "border-slate-100 bg-slate-50/50"
            }`}>
              <div>
                <p className="text-sm text-slate-800">Shuffle Options</p>
                <p className="text-xs text-slate-500 mt-0.5">Randomize MCQ answer options</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ shuffleOptions: !state.shuffleOptions })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  state.shuffleOptions ? "bg-[#002388]" : "bg-slate-200"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  state.shuffleOptions ? "translate-x-4" : "translate-x-0.5"
                }`} />
              </button>
            </div>
          </div>

          {/* AI Proctoring */}
          <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
            state.proctoringEnabled ? "border-[#002388]/20 bg-[#002388]/5" : "border-slate-100 bg-slate-50/50"
          }`}>
            <div>
              <p className="text-sm text-slate-800">Enable AI Proctoring</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Students will be monitored via webcam during this assessment
              </p>
            </div>
            <Switch
              checked={state.proctoringEnabled}
              onCheckedChange={(checked) => onChange({ proctoringEnabled: checked })}
              aria-label="Enable AI Proctoring"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
