"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Lock, PlayCircle, RotateCcw, AlertTriangle, ArrowRight } from "lucide-react"
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

  if (isLocked) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border-2 border-[#F23F42]/10 bg-[#FEE7E9]/30 p-5">
        <Lock size={20} className="shrink-0 text-[#F23F42]" strokeWidth={3} />
        <div>
          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Access Locked</p>
          <p className="text-[11px] font-bold text-[#F23F42] mt-0.5 uppercase tracking-widest">Maximum attempts reached</p>
        </div>
      </div>
    )
  }

  if (activeAttemptId !== null) {
    return (
      <button
        onClick={() => router.push(`/student/assessments/${assessmentId}/attempt?attemptId=${activeAttemptId}`)}
        className="w-full flex items-center justify-center gap-3 rounded-2xl bg-discord-blurple px-8 py-4 text-sm font-black text-white shadow-xl shadow-discord-blurple/20 hover:bg-[#4752c4] transition-all active:scale-95"
      >
        <RotateCcw size={18} strokeWidth={3} />
        RESUME ACTIVE ATTEMPT
        <ArrowRight size={18} strokeWidth={3} />
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
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleStartClick}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-3 rounded-2xl bg-discord-blurple px-8 py-4 text-sm font-black text-white shadow-xl shadow-discord-blurple/20 hover:bg-[#4752c4] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed group"
      >
        <PlayCircle size={20} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
        {isPending ? "INITIALIZING SESSION..." : "START NEW ATTEMPT"}
        <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
      </button>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-[#F23F42]/20 bg-[#FEE7E9] p-4 animate-in shake-1">
          <AlertTriangle size={18} className="shrink-0 text-[#F23F42]" strokeWidth={3} />
          <p className="text-[10px] font-black text-[#F23F42] uppercase tracking-[0.1em]">{error}</p>
        </div>
      )}
    </div>
  )
}
