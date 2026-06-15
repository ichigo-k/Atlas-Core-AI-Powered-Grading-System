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
    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-4">
      {label}
    </p>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-[11px] text-rose-500 mt-1">{message}</p>
}

export default function Step1Basics({ state, onChange, lecturerCourses, errors }: Step1BasicsProps) {
  return (
    <div className="space-y-5">
      {/* General Information */}
      <div className="rounded-sm border border-border bg-white p-5 space-y-5">
        <SectionHeader label="General Information" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-[12px] text-muted-foreground">
              Assessment Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              value={state.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g. Midterm Examination"
              className="h-9 rounded-sm border-border bg-white focus-visible:ring-primary/30 text-[13px]"
            />
            <FieldError message={errors.title} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] text-muted-foreground">
              Assigned Course <span className="text-rose-500">*</span>
            </Label>
            {lecturerCourses.length === 0 ? (
              <p className="text-[12px] text-muted-foreground bg-[#f3f2f1] rounded-sm px-3 h-9 flex items-center border border-border">
                No courses assigned
              </p>
            ) : (
              <Select
                value={state.courseId ? String(state.courseId) : ""}
                onValueChange={(v) => onChange({ courseId: parseInt(v) })}
              >
                <SelectTrigger className="h-9 rounded-sm border-border bg-white focus:ring-primary/30 text-[13px]">
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
          <Label className="text-[12px] text-muted-foreground">
            Assessment Type <span className="text-rose-500">*</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                  className={`flex items-start gap-3 p-3.5 rounded-sm border text-left transition-all ${
                    isSelected
                      ? "border-primary bg-[#dce6f7]"
                      : "border-border bg-white hover:bg-[#f3f2f1]"
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? "border-primary" : "border-border"
                  }`}>
                    {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1e293b]">{labels[type].title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{labels[type].desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <FieldError message={errors.type} />
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-sm border border-border bg-white p-5 space-y-4">
        <SectionHeader label="Schedule & Duration" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startsAt" className="text-[12px] text-muted-foreground">
              Start Date & Time <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                id="startsAt"
                type="datetime-local"
                value={state.startsAt}
                onChange={(e) => onChange({ startsAt: e.target.value })}
                className="h-9 pl-9 rounded-sm border-border bg-white focus-visible:ring-primary/30 text-[13px]"
              />
            </div>
            <FieldError message={errors.startsAt} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="endsAt" className="text-[12px] text-muted-foreground">
              End Date & Time <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                id="endsAt"
                type="datetime-local"
                value={state.endsAt}
                onChange={(e) => onChange({ endsAt: e.target.value })}
                className="h-9 pl-9 rounded-sm border-border bg-white focus-visible:ring-primary/30 text-[13px]"
              />
            </div>
            <FieldError message={errors.endsAt} />
          </div>

          {getWindowSummary(state.startsAt, state.endsAt) && (
            <div className="col-span-full flex items-center gap-2 px-3 py-2 rounded-sm bg-[#dce6f7] border border-primary/20">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-[12px] text-primary font-medium">
                {getWindowSummary(state.startsAt, state.endsAt)}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="durationMinutes" className="text-[12px] text-muted-foreground">
              Duration (minutes) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="durationMinutes"
              type="number"
              min={1}
              value={state.durationMinutes}
              onChange={(e) => onChange({ durationMinutes: e.target.value })}
              placeholder="e.g. 90"
              className="h-9 rounded-sm border-border bg-white focus-visible:ring-primary/30 text-[13px]"
            />
            <FieldError message={errors.durationMinutes} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxAttempts" className="text-[12px] text-muted-foreground">
              Max Attempts
            </Label>
            <Input
              id="maxAttempts"
              type="number"
              min={1}
              value={state.maxAttempts}
              onChange={(e) => onChange({ maxAttempts: e.target.value })}
              className="h-9 rounded-sm border-border bg-white focus-visible:ring-primary/30 text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Access & Security */}
      <div className="rounded-sm border border-border bg-white p-5 space-y-3">
        <SectionHeader label="Access & Security" />

        <div className="space-y-2">
          {/* Password Protection */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-sm border transition-all ${
            state.passwordProtected ? "border-primary/30 bg-[#dce6f7]" : "border-border bg-[#f3f2f1]"
          }`}>
            <div>
              <p className="text-[13px] font-semibold text-[#1e293b]">Password Protection</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Restrict access with a password</p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ passwordProtected: !state.passwordProtected, accessPassword: "" })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                state.passwordProtected ? "bg-primary" : "bg-border"
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                state.passwordProtected ? "translate-x-4" : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {state.passwordProtected && (
            <div className="space-y-1.5 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label htmlFor="accessPassword" className="text-[12px] text-muted-foreground">
                Access Password <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="accessPassword"
                value={state.accessPassword}
                onChange={(e) => onChange({ accessPassword: e.target.value })}
                placeholder="Enter access password"
                className="h-9 rounded-sm border-border bg-white focus-visible:ring-primary/30 text-[13px]"
              />
              <FieldError message={errors.accessPassword} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Shuffle Questions */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-sm border transition-all ${
              state.shuffleQuestions ? "border-primary/30 bg-[#dce6f7]" : "border-border bg-[#f3f2f1]"
            }`}>
              <div>
                <p className="text-[13px] font-semibold text-[#1e293b]">Shuffle Questions</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Randomize question order</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ shuffleQuestions: !state.shuffleQuestions })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  state.shuffleQuestions ? "bg-primary" : "bg-border"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  state.shuffleQuestions ? "translate-x-4" : "translate-x-0.5"
                }`} />
              </button>
            </div>

            {/* Shuffle Options */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-sm border transition-all ${
              state.shuffleOptions ? "border-primary/30 bg-[#dce6f7]" : "border-border bg-[#f3f2f1]"
            }`}>
              <div>
                <p className="text-[13px] font-semibold text-[#1e293b]">Shuffle Options</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Randomize MCQ answer options</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ shuffleOptions: !state.shuffleOptions })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  state.shuffleOptions ? "bg-primary" : "bg-border"
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  state.shuffleOptions ? "translate-x-4" : "translate-x-0.5"
                }`} />
              </button>
            </div>
          </div>

          {/* AI Proctoring */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-sm border transition-all ${
            state.proctoringEnabled ? "border-primary/30 bg-[#dce6f7]" : "border-border bg-[#f3f2f1]"
          }`}>
            <div>
              <p className="text-[13px] font-semibold text-[#1e293b]">Enable AI Proctoring</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
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
