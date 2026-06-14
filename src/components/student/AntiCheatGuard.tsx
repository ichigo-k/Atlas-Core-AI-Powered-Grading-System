"use client"

import { useEffect, useRef } from "react"
import { logTabSwitch } from "@/lib/assessment-actions"
import { MAX_VIOLATIONS, ViolationReason, addViolation, readViolationCount } from "@/lib/violation-tracker"
import { useViolationStore } from "@/lib/violation-store"

interface AntiCheatGuardProps {
  isSecured: boolean
  attemptId: number
  onSubmit: (reason: ViolationReason) => void
}

export default function AntiCheatGuard({ isSecured, attemptId, onSubmit }: AntiCheatGuardProps) {
  const { count, activeEvent, terminated, recordViolation, syncCount, dismissEvent, terminate, showFinalWarning } = useViolationStore()
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit

  // ── Block copy/paste/devtools shortcuts ────────────────────────────────────
  useEffect(() => {
    if (!isSecured) return
    const preventDefault = (e: Event) => e.preventDefault()
    document.addEventListener("copy", preventDefault)
    document.addEventListener("cut", preventDefault)
    document.addEventListener("paste", preventDefault)
    document.addEventListener("contextmenu", preventDefault)

    const handleKeyDown = (e: KeyboardEvent) => {
      const { key, ctrlKey, shiftKey, metaKey, altKey } = e
      if ((ctrlKey && shiftKey) || (metaKey && shiftKey)) { e.preventDefault(); return }
      if (
        key === "F12" || key === "PrintScreen" || key === "F5" ||
        (ctrlKey && key === "u") || (ctrlKey && key === "p") || (ctrlKey && key === "s") ||
        (altKey && key === "PrintScreen") ||
        (metaKey && key === "3") || (metaKey && key === "4") ||
        (metaKey && key === "5") || (metaKey && key === "6")
      ) e.preventDefault()
    }
    document.addEventListener("keydown", handleKeyDown)

    const printStyle = document.createElement("style")
    printStyle.id = "anti-cheat-print-style"
    printStyle.textContent = `@media print { body { visibility: hidden !important; } }`
    document.head.appendChild(printStyle)

    const noSelectStyle = document.createElement("style")
    noSelectStyle.id = "anti-cheat-noselect-style"
    noSelectStyle.textContent = `
      body { -webkit-user-select: none !important; user-select: none !important; }
      textarea, input { -webkit-user-select: text !important; user-select: text !important; }
    `
    document.head.appendChild(noSelectStyle)

    return () => {
      document.removeEventListener("copy", preventDefault)
      document.removeEventListener("cut", preventDefault)
      document.removeEventListener("paste", preventDefault)
      document.removeEventListener("contextmenu", preventDefault)
      document.removeEventListener("keydown", handleKeyDown)
      document.getElementById("anti-cheat-print-style")?.remove()
      document.getElementById("anti-cheat-noselect-style")?.remove()
    }
  }, [isSecured])

    const enforcementActive = useRef(false)

    useEffect(() => {
      if (!isSecured) return
      let cleanedUp = false

      // Delay enforcement by 3 seconds to allow the browser to settle
      const timer = setTimeout(() => {
        enforcementActive.current = true
      }, 3000)

      // Sync on mount — resume after reload
      readViolationCount(attemptId).then((existing) => {
        if (cleanedUp) return
        if (existing > 0) syncCount(existing)
        if (existing >= MAX_VIOLATIONS) {
          terminate()
          onSubmitRef.current("TAB_SWITCH")
        }
      })

      let leaveDebounce: ReturnType<typeof setTimeout> | null = null

      const recordLeave = () => {
        if (!enforcementActive.current) return
        if (leaveDebounce) return
        leaveDebounce = setTimeout(() => { leaveDebounce = null }, 500)

        logTabSwitch(attemptId, new Date().toISOString())

        // Read current count directly from the store (no stale closure)
        const currentCount = useViolationStore.getState().count
        const optimistic = currentCount + 1

        recordViolation({ type: "TAB_SWITCH", flagCountAfter: optimistic, source: "CLIENT" })

        addViolation(attemptId, "TAB_SWITCH").then(({ count: serverCount, willAutoSubmit }) => {
          if (cleanedUp) return
          syncCount(serverCount)
          if (willAutoSubmit) showFinalWarning()
        })
      }

      const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") recordLeave()
      }
      const handleBlur = () => {
        if (document.visibilityState === "visible") recordLeave()
      }

      document.addEventListener("visibilitychange", handleVisibilityChange)
      window.addEventListener("blur", handleBlur)

      return () => {
        cleanedUp = true
        clearTimeout(timer)
        document.removeEventListener("visibilitychange", handleVisibilityChange)
        window.removeEventListener("blur", handleBlur)
        if (leaveDebounce) clearTimeout(leaveDebounce)
      }
    }, [isSecured, attemptId, recordViolation, syncCount, terminate])

  // ── Termination check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (count >= MAX_VIOLATIONS && !terminated) {
      terminate()
      onSubmitRef.current("TAB_SWITCH")
    }
  }, [count, terminated, terminate])

  // ── Devtools detection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSecured) return
    const id = setInterval(() => {
      const detected = window.outerWidth - window.innerWidth > 160
      const el = document.getElementById("anti-cheat-devtools-overlay")
      if (el) el.style.display = detected ? "flex" : "none"
    }, 1000)
    return () => clearInterval(id)
  }, [isSecured])

  if (!isSecured) return null

  return (
    <>
      {/* Devtools overlay */}
      <div
        id="anti-cheat-devtools-overlay"
        style={{
          display: "none", position: "fixed", inset: 0, zIndex: 9999,
          backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center",
        }}
      >
        <div style={{ background: "#fff", borderRadius: 8, padding: "2rem 3rem", textAlign: "center", maxWidth: 480 }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 600, color: "#b91c1c" }}>
            Developer tools detected. Please close them to continue.
          </p>
        </div>
      </div>
      {/* FlagOverlay is rendered by ViolationOverlay in AttemptShell */}
    </>
  )
}
