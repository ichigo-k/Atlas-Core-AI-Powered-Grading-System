"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, ClipboardList, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import Step1Basics from "./Step1Basics"
import Step2Classes from "./Step2Classes"
import Step3Questions from "./Step3Questions"
import Step4Grading from "./Step4Grading"
import type {
  LecturerCourse,
  Step1State,
  Step2State,
  Step3State,
  Step4State,
  CreateAssessmentPayload,
  AnswerTypeEnum,
} from "@/lib/assessment-types"
import { validatePublishConditions } from "@/lib/assessment-validation"

function initStep1(): Step1State {
  return {
    title: "",
    type: "",
    courseId: null,
    startsAt: "",
    endsAt: "",
    durationMinutes: "",
    maxAttempts: "1",
    passwordProtected: false,
    accessPassword: "",
    shuffleQuestions: false,
    shuffleOptions: false,
    proctoringEnabled: false,
  }
}

function initStep2(): Step2State {
  return { selectedClasses: [], isLocationBound: false, location: "" }
}

function initStep3(): Step3State {
  return { sections: [] }
}

function initStep4(): Step4State {
  return { totalMarks: "" }
}

const STEPS = [
  { label: "Basics" },
  { label: "Classes" },
  { label: "Questions" },
  { label: "Grading" },
]

function validateStep1(s: Step1State): Partial<Record<keyof Step1State, string>> {
  const errors: Partial<Record<keyof Step1State, string>> = {}
  if (!s.title.trim()) errors.title = "Title is required"
  if (!s.type) errors.type = "Assessment type is required"
  if (!s.courseId) errors.courseId = "Course is required"
  if (!s.startsAt) errors.startsAt = "Start date & time is required"
  if (!s.endsAt) errors.endsAt = "End date & time is required"
  if (s.startsAt && s.endsAt && new Date(s.endsAt) <= new Date(s.startsAt)) {
    errors.endsAt = "End date & time must be after start date & time"
  }
  if (s.passwordProtected && !s.accessPassword.trim()) {
    errors.accessPassword = "Access password is required"
  }
  if (!s.durationMinutes) {
    errors.durationMinutes = "Duration is required"
  } else if (parseInt(s.durationMinutes) <= 0) {
    errors.durationMinutes = "Duration must be > 0"
  }
  return errors
}

function validateStep2(s: Step2State): { classes?: string; location?: string } {
  const errors: { classes?: string; location?: string } = {}
  if (s.selectedClasses.length === 0) errors.classes = "At least one class must be selected"
  if (s.isLocationBound && !s.location.trim()) errors.location = "Location is required"
  return errors
}

function validateStep4(s: Step4State): Partial<Record<keyof Step4State, string>> {
  const errors: Partial<Record<keyof Step4State, string>> = {}
  if (!s.totalMarks || Number(s.totalMarks) <= 0) errors.totalMarks = "Total marks is required"
  return errors
}

function buildPayload(
  s1: Step1State,
  s2: Step2State,
  s3: Step3State,
  s4: Step4State,
  status: "DRAFT" | "PUBLISHED"
): CreateAssessmentPayload {
  return {
    title: s1.title.trim(),
    type: s1.type as CreateAssessmentPayload["type"],
    courseId: s1.courseId!,
    startsAt: s1.startsAt,
    endsAt: s1.endsAt,
    durationMinutes: s1.durationMinutes ? parseInt(s1.durationMinutes) : null,
    maxAttempts: parseInt(s1.maxAttempts) || 1,
    passwordProtected: s1.passwordProtected,
    accessPassword: s1.passwordProtected ? s1.accessPassword : null,
    shuffleQuestions: s1.shuffleQuestions,
    shuffleOptions: s1.shuffleOptions,
    proctoringEnabled: s1.proctoringEnabled,
    isLocationBound: s2.isLocationBound,
    location: s2.isLocationBound ? s2.location : null,
    totalMarks: Number(s4.totalMarks),
    status,
    classes: s2.selectedClasses.map((c) => ({ classId: c.classId })),
    sections: s3.sections.map((sec) => ({
      name: sec.name,
      type: sec.type as any,
      requiredQuestionsCount: sec.requiredQuestionsCount ? parseInt(sec.requiredQuestionsCount) : null,
      questions: sec.questions.map((q) => ({
        order: q.order,
        body: q.body,
        marks: Number(q.marks),
        answerType: (q.answerType as AnswerTypeEnum) || null,
        options: sec.type === "OBJECTIVE" ? q.options : null,
        correctOption: sec.type === "OBJECTIVE" ? q.correctOption : null,
        rubricCriteria:
          sec.type === "SUBJECTIVE"
            ? q.rubricCriteria.map((r) => ({
              description: r.description,
              maxMarks: Number(r.maxMarks),
              order: r.order,
            }))
            : [],
      })),
    })),
  }
}

export interface AssessmentFormProps {
  lecturerCourses: LecturerCourse[]
  assessmentId?: number | null
  initialStep1?: Step1State
  initialStep2?: Step2State
  initialStep3?: Step3State
  initialStep4?: Step4State
}

export default function AssessmentForm({
  lecturerCourses,
  assessmentId,
  initialStep1,
  initialStep2,
  initialStep3,
  initialStep4,
}: AssessmentFormProps) {
  const router = useRouter()
  const isEditing = !!assessmentId

  const [step, setStep] = useState(0)
  const [step1, setStep1] = useState<Step1State>(initialStep1 ?? initStep1())
  const [step2, setStep2] = useState<Step2State>(initialStep2 ?? initStep2())
  const [step3, setStep3] = useState<Step3State>(initialStep3 ?? initStep3())
  const [step4, setStep4] = useState<Step4State>(initialStep4 ?? initStep4())

  const [step1Errors, setStep1Errors] = useState<Partial<Record<keyof Step1State, string>>>({})
  const [step2Errors, setStep2Errors] = useState<{ classes?: string; location?: string }>({})
  const [step3Errors] = useState<Record<string, string>>({})
  const [step4Errors, setStep4Errors] = useState<Partial<Record<keyof Step4State, string>>>({})

  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedCourse = lecturerCourses.find((c) => c.id === step1.courseId) ?? null

  const handleContinue = () => {
    if (step === 0) {
      const errors = validateStep1(step1)
      setStep1Errors(errors)
      if (Object.keys(errors).length > 0) return
    }
    if (step === 1) {
      const errors = validateStep2(step2)
      setStep2Errors(errors)
      if (Object.keys(errors).length > 0) return
    }
    if (step === 2) {
      const calculated = step3.sections.reduce((total, sec) => {
        const required = Number(sec.requiredQuestionsCount) || sec.questions.length
        const sortedMarks = sec.questions
          .map((q) => Number(q.marks) || 0)
          .sort((a, b) => b - a)
        return total + sortedMarks.slice(0, required).reduce((sum, m) => sum + m, 0)
      }, 0)
      setStep4({ totalMarks: String(calculated) })
    }
    setStep((s) => Math.min(s + 1, 3))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSubmit = async (status: "DRAFT" | "PUBLISHED") => {
    const errors4 = validateStep4(step4)
    setStep4Errors(errors4)
    if (Object.keys(errors4).length > 0) return

    if (status === "PUBLISHED") {
      const publishErr = validatePublishConditions({
        questionCount: step3.sections.reduce((acc, sec) => acc + sec.questions.length, 0),
        startsAt: step1.startsAt,
        endsAt: step1.endsAt,
        classCount: step2.selectedClasses.length,
      })
      if (publishErr) {
        toast.error(publishErr)
        return
      }
    }

    const payload = buildPayload(step1, step2, step3, step4, status)
    setIsSubmitting(true)

    try {
      const url = isEditing
        ? `/api/lecturer/assessments/${assessmentId}`
        : "/api/lecturer/assessments"
      const method = isEditing ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Something went wrong")
      }

      toast.success(
        isEditing
          ? "Assessment updated"
          : status === "PUBLISHED"
            ? "Assessment created and published"
            : "Assessment saved as draft"
      )
      router.push("/lecturer/assessments")
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save assessment")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-[#f8f9fa] dark:bg-[#1b1b1f] min-h-full flex flex-col">
      {/* Sticky command bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-shrink-0">
        <ClipboardList size={11} />
        <Link href="/lecturer" className="hover:text-[#1e293b] transition-colors">Lecturer</Link>
        <ChevronRight size={11} />
        <Link href="/lecturer/assessments" className="hover:text-[#1e293b] transition-colors">Assessments</Link>
        <ChevronRight size={11} />
        <span className="text-[#002388] font-medium">{isEditing ? "Edit Assessment" : "New Assessment"}</span>
      </div>

      <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] pb-16">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="text-xl font-semibold text-[#1e293b]">
              {isEditing ? "Edit Assessment" : "New Assessment"}
            </h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {isEditing
                ? "Update your assessment configuration and content."
                : "Set up a new assessment for your courses."}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="mb-8 rounded-sm border border-border bg-white px-5 py-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const isActive = i === step
              const isDone = i < step
              return (
                <div key={s.label} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => isDone && setStep(i)}
                    disabled={!isDone}
                    className="flex items-center gap-2.5 outline-none"
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-all ${isDone
                          ? "border-primary bg-primary text-white"
                          : isActive
                            ? "border-primary bg-white text-primary"
                            : "border-border bg-white text-muted-foreground"
                        }`}
                    >
                      {isDone ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    <span
                      className={`text-[13px] transition-colors ${isActive ? "text-primary font-semibold" : isDone ? "text-[#1e293b] font-medium" : "text-muted-foreground"
                        }`}
                    >
                      {s.label}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`mx-3 h-px flex-1 transition-colors ${isDone ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="space-y-5">
          {step === 0 && (
            <Step1Basics
              state={step1}
              onChange={(u) => setStep1((prev) => ({ ...prev, ...u }))}
              lecturerCourses={lecturerCourses}
              errors={step1Errors}
            />
          )}
          {step === 1 && (
            <Step2Classes
              state={step2}
              onChange={(u) => setStep2((prev) => ({ ...prev, ...u }))}
              selectedCourse={selectedCourse}
              errors={step2Errors}
            />
          )}
          {step === 2 && (
            <Step3Questions
              state={step3}
              onChange={setStep3}
              errors={step3Errors}
              courseId={step1.courseId}
              assessmentType={step1.type}
            />
          )}
          {step === 3 && (
            <Step4Grading
              state={step4}
              sections={step3.sections}
              onChange={(u) => setStep4((prev) => ({ ...prev, ...u }))}
              errors={step4Errors}
              onSaveAsDraft={() => handleSubmit("DRAFT")}
              onPublish={() => handleSubmit("PUBLISHED")}
              onBack={() => setStep(step - 1)}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Navigation footer */}
          {step < 3 && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={step === 0}
                className="h-8 px-4 text-[13px] text-muted-foreground hover:text-[#1e293b] disabled:opacity-0"
              >
                Previous
              </Button>
              <Button
                type="button"
                onClick={handleContinue}
                className="h-8 px-4 bg-primary hover:bg-[#001570] text-white text-[13px] font-semibold rounded-sm"
              >
                Continue to {STEPS[step + 1].label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
