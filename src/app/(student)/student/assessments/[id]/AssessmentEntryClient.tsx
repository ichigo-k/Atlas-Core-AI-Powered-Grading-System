"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Lock, PlayCircle, RotateCcw, AlertTriangle } from "lucide-react"
import { createOrResumeAttempt } from "@/lib/assessment-actions"

interface AssessmentEntryClientProps {
  assessmentId: number
  passwordProtected: boolean
  proctoringEnabled: boolean
  isLocked: boolean
  activeAttemptId: number | null
  assessmentType: string
  durationMinutes: number | null
  startsAt: string
  endsAt: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssessmentEntryClient({
  assessmentId,
  passwordProtected,
  proctoringEnabled,
  isLocked,
  activeAttemptId,
}: AssessmentEntryClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Locked: max attempts exhausted
  if (isLocked) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-4 py-3.5 text-[#202124]">
        <Lock size={16} className="shrink-0 text-[#5f6368]" />
        <div>
          <p className="text-[13px] font-medium text-[#202124]">Maximum attempts reached</p>
          <p className="text-xs text-[#5f6368] mt-0.5">You have used all available attempts for this assessment.</p>
        </div>
      </div>
    )
  }

  // Active in-progress attempt — show resume button
  if (activeAttemptId !== null) {
    return (
      <a
        href={`/student/assessments/${assessmentId}/attempt?attemptId=${activeAttemptId}`}
        className="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-[#174ea6] transition-colors"
      >
        <RotateCcw size={14} />
        Resume Attempt
      </a>
    )
  }

  function handleStartClick() {
    setError(null)

    // If password-protected, redirect to password page
    if (passwordProtected) {
      router.push(`/student/assessments/${assessmentId}/assessment-onboarding`)
      return
    }

    // Non-password-protected: create attempt first, then enter the shared onboarding flow
    startTransition(async () => {
      const result = await createOrResumeAttempt(assessmentId)
      if ("error" in result) {
        const messages: Record<string, string> = {
          MAX_ATTEMPTS_REACHED: "You have used all available attempts.",
          NOT_STARTED: "This assessment has not started yet.",
          ENDED: "This assessment has already closed.",
          NOT_AVAILABLE: "This assessment is not currently available.",
          UNAUTHORIZED: "You are not authorised to take this assessment.",
          NOT_FOUND: "Assessment not found.",
          SERVER_ERROR: "A server error occurred. Please try again.",
        }
        setError(messages[result.error] ?? "Failed to start assessment. Please try again.")
        return
      }

      router.push(`/student/assessments/${assessmentId}/assessment-onboarding?attemptId=${result.attemptId}`)
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={handleStartClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full bg-[#1a73e8] px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-[#174ea6] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <PlayCircle size={15} />
        {isPending ? "Starting…" : "Start Assessment"}
      </button>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3.5 py-2.5">
          <AlertTriangle size={13} className="shrink-0 text-[#d93025]" />
          <p className="text-[13px] text-[#b31412]">{error}</p>
        </div>
      )}
    </div>
  )
}
