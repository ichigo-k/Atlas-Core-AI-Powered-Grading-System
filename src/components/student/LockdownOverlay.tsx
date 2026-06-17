"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { MAX_VIOLATIONS, ViolationReason, addViolation, readViolationCount } from "@/lib/violation-tracker"
import { useViolationStore } from "@/lib/violation-store"

interface LockdownOverlayProps {
  isSecured: boolean
  onSubmit: (reason: ViolationReason) => void
  attemptId: number
}

export interface LockdownOverlayHandle {
  submit: () => void
  allowUnload: () => void
}

const LockdownOverlay = forwardRef<LockdownOverlayHandle, LockdownOverlayProps>(
  function LockdownOverlay({ isSecured, onSubmit, attemptId }, ref) {
    const { count, activeEvent, terminated, recordViolation, syncCount, dismissEvent, terminate, showFinalWarning } = useViolationStore()

    const intentionalExitRef = useRef(false)
    const allowUnloadRef = useRef(false)
    const onSubmitRef = useRef(onSubmit)
    onSubmitRef.current = onSubmit

    const enforcementActive = useRef(false)

    useImperativeHandle(ref, () => ({
      allowUnload() { allowUnloadRef.current = true },
      submit() {
        intentionalExitRef.current = true
        allowUnloadRef.current = true
        const exit = document.fullscreenElement ? document.exitFullscreen() : Promise.resolve()
        exit.catch(() => {}).finally(() => onSubmitRef.current("FULLSCREEN_EXIT"))
      },
    }), [])

    useEffect(() => {
      if (!isSecured) return
      intentionalExitRef.current = false
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
          onSubmitRef.current("FULLSCREEN_EXIT")
        }
      })

      function flagFullscreenExit() {
        const active = enforcementActive.current
        const currentCount = useViolationStore.getState().count
        
        // Always record the violation locally to trigger the dark overlay/button (Req 10.6)
        recordViolation({ 
          type: "FULLSCREEN_EXIT", 
          flagCountAfter: active ? currentCount + 1 : currentCount, 
          source: "CLIENT" 
        })

        // Only persist to server if grace period has passed
        if (active) {
          addViolation(attemptId, "FULLSCREEN_EXIT").then(({ count: serverCount, willAutoSubmit }) => {
            if (!cleanedUp) {
              syncCount(serverCount)
              if (willAutoSubmit) showFinalWarning()
            }
          })
        }
      }

      function enterFullscreen() {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {
            // Browser blocked fullscreen — trigger the overlay so student can click the button
            flagFullscreenExit()
          })
        }
      }

      function handleFullscreenChange() {
        if (intentionalExitRef.current) return
        if (!document.fullscreenElement) {
          flagFullscreenExit()
        }
      }

      function handleBeforeUnload(e: BeforeUnloadEvent) {
        if (allowUnloadRef.current) return
        e.preventDefault()
      }

      enterFullscreen()
      document.addEventListener("fullscreenchange", handleFullscreenChange)
      window.addEventListener("beforeunload", handleBeforeUnload)

      return () => {
        cleanedUp = true
        clearTimeout(timer)
        document.removeEventListener("fullscreenchange", handleFullscreenChange)
        window.removeEventListener("beforeunload", handleBeforeUnload)
      }
    }, [isSecured, attemptId, recordViolation, syncCount, terminate, showFinalWarning])

    // ── Termination check ────────────────────────────────────────────────────
    useEffect(() => {
      if (count >= MAX_VIOLATIONS && !terminated) {
        terminate()
        intentionalExitRef.current = true
        allowUnloadRef.current = true
        const lastReason = (activeEvent?.type ?? "FULLSCREEN_EXIT") as ViolationReason
        const exit = document.fullscreenElement ? document.exitFullscreen() : Promise.resolve()
        exit.catch(() => {}).finally(() => onSubmitRef.current(lastReason))
      }
    }, [count, terminated, terminate, activeEvent])

    return null
  }
)

export default LockdownOverlay
