"use client"

import { useEffect, useRef } from "react"
import { logTabSwitch } from "@/lib/assessment-actions"
import { MAX_VIOLATIONS, ViolationReason, addViolation, readViolationCount } from "@/lib/violation-tracker"
import { useViolationStore } from "@/lib/violation-store"

const AWAY_GRACE_SECONDS = 15

interface AntiCheatGuardProps {
  isSecured: boolean
  attemptId: number
  onSubmit: (reason: ViolationReason) => void
}

export default function AntiCheatGuard({ isSecured, attemptId, onSubmit }: AntiCheatGuardProps) {
  const { count, terminated, recordViolation, syncCount, dismissEvent, terminate, showFinalWarning, setAwayCountdown } = useViolationStore()
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

    const timer = setTimeout(() => {
      enforcementActive.current = true
    }, 3000)

    readViolationCount(attemptId).then((existing) => {
      if (cleanedUp) return
      if (existing > 0) syncCount(existing)
      if (existing >= MAX_VIOLATIONS) {
        terminate()
        onSubmitRef.current("TAB_SWITCH")
      }
    })

    // ── Away-timer state ───────────────────────────────────────────────────
    // When the student leaves, we flag them immediately and then add another
    // flag every AWAY_GRACE_SECONDS they remain away.
    const awayIntervalRef = { current: null as ReturnType<typeof setInterval> | null }
    const countdownIntervalRef = { current: null as ReturnType<typeof setInterval> | null }
    const isAwayRef = { current: false }

    function clearAwayTimers() {
      if (awayIntervalRef.current) { clearInterval(awayIntervalRef.current); awayIntervalRef.current = null }
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
      // Do NOT clear awayCountdown here — let the ring freeze at its last value.
      // dismissEvent() clears it when the student clicks "Return to exam".
      isAwayRef.current = false
    }

    function startAwayTimers() {
      // Countdown display tick (every second)
      let remaining = AWAY_GRACE_SECONDS
      setAwayCountdown(remaining)
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) remaining = AWAY_GRACE_SECONDS // reset after each flag cycle
        setAwayCountdown(remaining)
      }, 1000)

      // Actual violation tick (every AWAY_GRACE_SECONDS)
      awayIntervalRef.current = setInterval(() => {
        if (cleanedUp || !isAwayRef.current) return
        logTabSwitch(attemptId, new Date().toISOString())
        const currentCount = useViolationStore.getState().count
        const optimistic = currentCount + 1
        recordViolation({ type: "TAB_SWITCH", flagCountAfter: optimistic, source: "CLIENT" })
        addViolation(attemptId, "TAB_SWITCH").then(({ count: serverCount, willAutoSubmit }) => {
          if (cleanedUp) return
          syncCount(serverCount)
          if (willAutoSubmit) showFinalWarning()
        })
      }, AWAY_GRACE_SECONDS * 1000)
    }

    let leaveDebounce: ReturnType<typeof setTimeout> | null = null

    const recordLeave = () => {
      if (!enforcementActive.current) return
      if (leaveDebounce) return
      leaveDebounce = setTimeout(() => { leaveDebounce = null }, 500)

      if (isAwayRef.current) return // already tracking
      isAwayRef.current = true

      logTabSwitch(attemptId, new Date().toISOString())

      const currentCount = useViolationStore.getState().count
      const optimistic = currentCount + 1

      recordViolation({ type: "TAB_SWITCH", flagCountAfter: optimistic, source: "CLIENT" })

      addViolation(attemptId, "TAB_SWITCH").then(({ count: serverCount, willAutoSubmit }) => {
        if (cleanedUp) return
        syncCount(serverCount)
        if (willAutoSubmit) showFinalWarning()
      })

      startAwayTimers()
    }

    const recordReturn = () => {
      // Intentionally do nothing — timers keep running until the student clicks "Return to exam".
      // This keeps the countdown visible and flags continue to accumulate until they dismiss.
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordLeave()
      } else {
        recordReturn()
      }
    }
    const handleBlur = () => {
      if (document.visibilityState === "visible") recordLeave()
    }
    const handleFocus = () => {
      recordReturn()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)

    return () => {
      cleanedUp = true
      clearTimeout(timer)
      clearAwayTimers()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      if (leaveDebounce) clearTimeout(leaveDebounce)
    }
  }, [isSecured, attemptId, recordViolation, syncCount, terminate, dismissEvent, setAwayCountdown, showFinalWarning])

  // ── Termination check ──────────────────────────────────────────────────────
  // When the flag limit is hit, show the final-warning overlay first so the
  // student sees what happened. The server already submitted via the flag API;
  // onSubmit is called here as a safety net for non-proctored exams.
  useEffect(() => {
    if (count >= MAX_VIOLATIONS && !terminated) {
      onSubmitRef.current("TAB_SWITCH")
      showFinalWarning()
    }
  }, [count, terminated, showFinalWarning])

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
    </>
  )
}
