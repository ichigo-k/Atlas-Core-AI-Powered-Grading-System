"use client"

import { useEffect, useRef } from "react"
import { logTabSwitch } from "@/lib/assessment-actions"
import { MAX_VIOLATIONS, ViolationReason, addViolation, readViolationCount, tryAcquireFlagSlot } from "@/lib/violation-tracker"
import { useViolationStore } from "@/lib/violation-store"

const AWAY_GRACE_SECONDS = 15

interface AntiCheatGuardProps {
  isSecured: boolean
  attemptId: number
  onSubmit: (reason: ViolationReason) => void
}

export default function AntiCheatGuard({ isSecured, attemptId, onSubmit }: AntiCheatGuardProps) {
  const { count, terminated, activeEvent, recordViolation, syncCount, dismissEvent, terminate, showFinalWarning, setAwayCountdown } = useViolationStore()
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit

  // Ref so the dismiss-watcher effect can call clearAwayTimers() without re-running the main effect
  const clearAwayTimersRef = useRef<(() => void) | null>(null)

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
      isAwayRef.current = false
    }

    // Expose so the dismiss-watcher effect can stop timers when the overlay is dismissed
    clearAwayTimersRef.current = clearAwayTimers

    function startAwayTimers(violationType: "TAB_SWITCH" | "FULLSCREEN_EXIT" = "TAB_SWITCH") {
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
        if (useViolationStore.getState().submitting) return // attempt is being submitted
        // Defensive: skip if another source just flagged within the cooldown window.
        if (!tryAcquireFlagSlot(attemptId)) return
        if (violationType === "TAB_SWITCH") logTabSwitch(attemptId, new Date().toISOString())
        const currentCount = useViolationStore.getState().count
        const optimistic = currentCount + 1
        recordViolation({ type: violationType, flagCountAfter: optimistic, source: "CLIENT" })
        addViolation(attemptId, violationType).then(({ count: serverCount, willAutoSubmit }) => {
          if (cleanedUp) return
          syncCount(serverCount)
          if (willAutoSubmit) showFinalWarning()
        })
      }, AWAY_GRACE_SECONDS * 1000)
    }

    let leaveDebounce: ReturnType<typeof setTimeout> | null = null

    const recordLeave = () => {
      if (!enforcementActive.current) return
      if (useViolationStore.getState().submitting) return // submitting/navigating away — not a violation
      if (leaveDebounce) return
      leaveDebounce = setTimeout(() => { leaveDebounce = null }, 500)

      if (isAwayRef.current) return // already tracking
      isAwayRef.current = true

      logTabSwitch(attemptId, new Date().toISOString())

      // This flag only COUNTS if we win the shared cooldown slot — a fullscreen
      // exit or a second focus event from the same gesture may have already
      // flagged. Either way we still show the overlay and start the away timers.
      const counts = tryAcquireFlagSlot(attemptId)
      const currentCount = useViolationStore.getState().count

      recordViolation({ type: "TAB_SWITCH", flagCountAfter: counts ? currentCount + 1 : currentCount, source: "CLIENT" })

      if (counts) {
        addViolation(attemptId, "TAB_SWITCH").then(({ count: serverCount, willAutoSubmit }) => {
          if (cleanedUp) return
          syncCount(serverCount)
          if (willAutoSubmit) showFinalWarning()
        })
      }

      startAwayTimers("TAB_SWITCH")
    }

    // Track fullscreen exits — start repeat timer, and debounce the blur that follows
    let fullscreenExitDebounce = false
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        fullscreenExitDebounce = true
        setTimeout(() => { fullscreenExitDebounce = false }, 300)

        // Start repeat-violation timer for fullscreen exit.
        // The initial FULLSCREEN_EXIT flag is fired by LockdownOverlay; we only add the repeats.
        if (!enforcementActive.current) return
        if (useViolationStore.getState().submitting) return // exiting fullscreen to submit/navigate
        if (isAwayRef.current) return // already tracking (e.g. tab switched while out of fullscreen)
        isAwayRef.current = true
        startAwayTimers("FULLSCREEN_EXIT")
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") recordLeave()
      // return: timers keep running until student clicks "Return to exam" (dismissEvent clears them)
    }
    const handleBlur = () => {
      if (fullscreenExitDebounce) return // blur caused by fullscreen exit — LockdownOverlay handles it
      if (document.visibilityState === "visible") recordLeave()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    window.addEventListener("blur", handleBlur)

    return () => {
      cleanedUp = true
      clearTimeout(timer)
      clearAwayTimers()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      window.removeEventListener("blur", handleBlur)
      if (leaveDebounce) clearTimeout(leaveDebounce)
    }
  }, [isSecured, attemptId, recordViolation, syncCount, terminate, setAwayCountdown, showFinalWarning])

  // ── Stop away timers when student clicks "Return to exam" (overlay dismissed) ──
  // activeEvent goes null when dismissEvent() is called — that's our signal.
  useEffect(() => {
    if (activeEvent === null) {
      clearAwayTimersRef.current?.()
    }
  }, [activeEvent])

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
  // The old check was `outerWidth - innerWidth > 160`, which only ever catches
  // devtools docked to the SIDE. Docked to the bottom (the default in Chrome)
  // it shrinks innerHeight instead and went completely undetected.
  //
  // An absolute height threshold doesn't work either — normal browser chrome
  // (tabs, address bar, bookmarks) already accounts for 100-200px and varies
  // per browser and per user. So we baseline the viewport once at exam start
  // and watch for a sustained SHRINK from it in either axis, which is what
  // opening a docked devtools panel actually looks like.
  useEffect(() => {
    if (!isSecured) return

    // Ignore the reflow that follows entering fullscreen — take the baseline
    // once the layout has settled.
    let baseline: { w: number; h: number } | null = null
    const baselineTimer = setTimeout(() => {
      baseline = { w: window.innerWidth, h: window.innerHeight }
    }, 2000)

    const DOCK_SHRINK_PX = 120
    // Devtools must stay open this long before it counts as a violation, so a
    // transient resize (rotating a tablet, the OS keyboard appearing) doesn't
    // punish anyone.
    const SUSTAIN_TICKS = 10
    let openTicks = 0

    const id = setInterval(() => {
      let detected = false
      if (baseline) {
        // Genuine window resizes move the baseline with them; devtools opening
        // shrinks the viewport while the window itself stays put, so only treat
        // a shrink as suspicious and re-baseline on growth.
        const shrankW = baseline.w - window.innerWidth
        const shrankH = baseline.h - window.innerHeight
        detected = shrankW > DOCK_SHRINK_PX || shrankH > DOCK_SHRINK_PX
        if (!detected) baseline = { w: window.innerWidth, h: window.innerHeight }
      }

      const el = document.getElementById("anti-cheat-devtools-overlay")
      if (el) el.style.display = detected ? "flex" : "none"

      if (!detected) { openTicks = 0; return }

      openTicks += 1
      if (openTicks !== SUSTAIN_TICKS) return  // flag once per continuous run

      if (useViolationStore.getState().submitting) return
      if (!tryAcquireFlagSlot(attemptId)) return
      const optimistic = useViolationStore.getState().count + 1
      recordViolation({ type: "TAB_SWITCH", flagCountAfter: optimistic, source: "CLIENT" })
      addViolation(attemptId, "TAB_SWITCH").then(({ count: serverCount, willAutoSubmit }) => {
        syncCount(serverCount)
        if (willAutoSubmit) showFinalWarning()
      })
    }, 1000)

    return () => { clearTimeout(baselineTimer); clearInterval(id) }
  }, [isSecured, attemptId, recordViolation, syncCount, showFinalWarning])

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
