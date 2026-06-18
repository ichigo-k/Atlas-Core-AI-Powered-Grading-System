"use client"

import { useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { LockKeyhole, Loader2, X } from "lucide-react"
import { createOrResumeAttempt } from "@/lib/assessment-actions"

interface PasswordGateModalProps {
  assessmentId: number
  passwordProtected: boolean
  onSuccess: (attemptId: number) => void
  onClose?: () => void
}

export default function PasswordGateModal({
  assessmentId,
  passwordProtected,
  onSuccess,
  onClose,
}: PasswordGateModalProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!passwordProtected) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createOrResumeAttempt(assessmentId, password)

      if ("error" in result) {
        if (result.error === "INVALID_PASSWORD") {
          setError("Incorrect password. Please try again.")
        } else {
          setError("Something went wrong. Please try again.")
        }
      } else {
        onSuccess(result.attemptId)
      }
    })
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-sm rounded-xl bg-white border border-[#e5e7eb] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e5e7eb]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f4f6]">
                <LockKeyhole size={17} className="text-[#374151]" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#111827]">Assessment password</h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Enter the password to begin</p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors disabled:opacity-40"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#374151]" htmlFor="assessment-password">
              Password
            </label>
            <input
              id="assessment-password"
              type="password"
              placeholder="Enter password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              disabled={isPending}
              autoFocus
              className="w-full rounded-lg border border-[#d1d5db] bg-white px-3.5 py-2.5 text-[14px] text-[#111827] placeholder-[#9ca3af] outline-none transition-all focus:border-[#002388] focus:ring-2 focus:ring-[#002388]/20 disabled:opacity-60"
            />
            {error && (
              <p className="text-xs text-[#dc2626] flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-1 w-1 rounded-full bg-[#dc2626]" />
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#002388] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0B4DBB] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <><Loader2 size={14} className="animate-spin" />Verifying…</>
            ) : (
              "Start Assessment"
            )}
          </button>
        </form>
      </div>
    </div>
  )

  return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null
}
