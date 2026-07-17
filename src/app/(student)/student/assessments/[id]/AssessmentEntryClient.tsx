"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Lock, PlayCircle, RotateCcw, AlertTriangle, ArrowRight, Loader2 } from "lucide-react"
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

export default function AssessmentEntryClient({
  assessmentId,
  passwordProtected,
  isLocked,
  activeAttemptId,
}: AssessmentEntryClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
	const [isNavigating, setIsNavigating] = useState(false)

  if (isLocked) {
    return (
      <div className="flex items-center gap-3 rounded-sm border border-red-100 bg-red-50 p-4">
        <Lock size={16} className="shrink-0 text-red-600" strokeWidth={2} />
        <div>
          <p className="text-[12px] font-semibold text-[#1e293b]">Access Locked</p>
          <p className="text-[10px] font-bold text-red-600 mt-0.5 uppercase tracking-wider">Maximum attempts reached</p>
        </div>
      </div>
    )
  }

  if (activeAttemptId !== null) {
    return (
      <button
        type="button"
		disabled={isNavigating}
		onClick={() => {
			setIsNavigating(true)
			router.push(`/student/assessments/${assessmentId}/assessment-onboarding?attemptId=${activeAttemptId}`)
		}}
		className="w-full flex items-center justify-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors disabled:cursor-wait disabled:opacity-70"
      >
		{isNavigating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} strokeWidth={2} />}
		{isNavigating ? "Opening your attempt…" : "Continue Attempt"}
		{!isNavigating && <ArrowRight size={14} strokeWidth={2} />}
      </button>
    )
  }

  function handleStartClick() {
    setError(null)

    if (passwordProtected) {
      router.push(`/student/assessments/${assessmentId}/assessment-onboarding`)
      return
    }

    startTransition(async () => {
      const result = await createOrResumeAttempt(assessmentId)
      if ("error" in result) {
        const messages: Record<string, string> = {
          MAX_ATTEMPTS_REACHED: "YOU HAVE USED ALL AVAILABLE ATTEMPTS.",
          NOT_STARTED: "THIS ASSESSMENT HAS NOT STARTED YET.",
          ENDED: "THIS ASSESSMENT HAS ALREADY CLOSED.",
          NOT_AVAILABLE: "THIS ASSESSMENT IS NOT CURRENTLY AVAILABLE.",
          UNAUTHORIZED: "YOU ARE NOT AUTHORISED TO TAKE THIS ASSESSMENT.",
          NOT_FOUND: "ASSESSMENT NOT FOUND.",
          SERVER_ERROR: "A SERVER ERROR OCCURRED. PLEASE TRY AGAIN.",
        }
        setError(messages[result.error] ?? "FAILED TO START ASSESSMENT. PLEASE TRY AGAIN.")
        return
      }

      router.push(`/student/assessments/${assessmentId}/assessment-onboarding?attemptId=${result.attemptId}`)
    })
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleStartClick}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
      >
		{isPending ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} strokeWidth={2} className="group-hover:scale-105 transition-transform" />}
		{isPending ? "Creating secure session…" : "Start New Attempt"}
		{!isPending && <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-0.5 transition-transform" />}
      </button>

      {error && (
        <div className="flex items-center gap-2.5 rounded-sm border border-red-100 bg-red-50 p-3 animate-in fade-in">
          <AlertTriangle size={14} className="shrink-0 text-red-600" strokeWidth={2} />
          <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">{error}</p>
        </div>
      )}
    </div>
  )
}
