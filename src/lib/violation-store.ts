import { create } from 'zustand'
import type { FlagEvent } from '@/components/student/FlagOverlay'

interface ViolationState {
  count: number
  activeEvent: FlagEvent | null
  terminated: boolean
  finalWarning: boolean
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
  showFinalWarning: () => void
  setAwayCountdown: (seconds: number | null) => void
  reset: () => void
}

export const useViolationStore = create<ViolationState>((set, get) => ({
  count: 0,
  activeEvent: null,
  terminated: false,
  finalWarning: false,
  awayCountdown: null,

  recordViolation(event) {
    set({ count: event.flagCountAfter, activeEvent: event })
  },

  syncCount(serverCount) {
    set((s) => ({ count: Math.max(s.count, serverCount) }))
  },

  dismissEvent() {
    set({ activeEvent: null, awayCountdown: null })
  },

  terminate() {
    set({ terminated: true, activeEvent: null, finalWarning: false, awayCountdown: null })
  },

  showFinalWarning() {
    set({ finalWarning: true })
  },

  setAwayCountdown(seconds) {
    set({ awayCountdown: seconds })
  },

  reset() {
    set({ count: 0, activeEvent: null, terminated: false, finalWarning: false, awayCountdown: null })
  },
}))
