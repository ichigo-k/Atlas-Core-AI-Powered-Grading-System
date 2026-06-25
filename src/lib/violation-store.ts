import { create } from 'zustand'
import type { FlagEvent } from '@/components/student/FlagOverlay'

interface ViolationState {
  count: number
  activeEvent: FlagEvent | null
  terminated: boolean
  finalWarning: boolean
  /**
   * True once the attempt is being submitted (manual submit, timeout, or
   * termination). Flag sources must check this and bail — otherwise the
   * fullscreen-exit / blur that happens as we navigate away records a spurious
   * "violation" on the way out.
   */
  submitting: boolean
  /**
   * Counts down from 15 → 0 while the student is away (focus loss / tab switch).
   * Driven by AntiCheatGuard. FlagOverlay reads this to show "next flag in Xs".
   * null = not currently away.
   */
  awayCountdown: number | null

  recordViolation: (event: FlagEvent) => void
  syncCount: (serverCount: number) => void
  dismissEvent: () => void
  terminate: () => void
  beginSubmit: () => void
  showFinalWarning: () => void
  setAwayCountdown: (seconds: number | null) => void
  reset: () => void
}

export const useViolationStore = create<ViolationState>((set, get) => ({
  count: 0,
  activeEvent: null,
  terminated: false,
  finalWarning: false,
  submitting: false,
  awayCountdown: null,

  recordViolation(event) {
    set((s) => {
      // Always keep the count in sync (never let it go backwards).
      const count = Math.max(s.count, event.flagCountAfter)
      // Overlay lock: if an overlay is already showing for a DIFFERENT violation
      // type, keep the original on screen — don't let a second violation hijack
      // and "switch" the overlay mid-display (that caused the flicker/glitch when
      // e.g. a fullscreen-exit overlay was replaced by a gaze-away overlay).
      if (s.activeEvent && s.activeEvent.type !== event.type) {
        return { count }
      }
      return { count, activeEvent: event }
    })
  },

  syncCount(serverCount) {
    set((s) => ({ count: Math.max(s.count, serverCount) }))
  },

  dismissEvent() {
    set({ activeEvent: null, awayCountdown: null })
  },

  terminate() {
    set({ terminated: true, submitting: true, activeEvent: null, finalWarning: false, awayCountdown: null })
  },

  beginSubmit() {
    set({ submitting: true })
  },

  showFinalWarning() {
    set({ finalWarning: true })
  },

  setAwayCountdown(seconds) {
    set({ awayCountdown: seconds })
  },

  reset() {
    set({ count: 0, activeEvent: null, terminated: false, finalWarning: false, submitting: false, awayCountdown: null })
  },
}))
