/**
 * Zustand store for the unified violation/flag counter.
 *
 * Lives outside React's render cycle — no stale closures, no prop drilling.
 * Both LockdownOverlay and AntiCheatGuard read and write to this store directly.
 * AttemptShell subscribes to drive the shared violationCount prop and the
 * Oracle polling overlay.
 */

import { create } from 'zustand'
import type { FlagEvent } from '@/components/student/FlagOverlay'

interface ViolationState {
  /** Current unified flag count (optimistic — may be ahead of server). */
  count: number
  /** The active flag event to display in the overlay. null = no overlay. */
  activeEvent: FlagEvent | null
  /** Whether the exam has been terminated (flag limit reached). */
  terminated: boolean
  /**
   * When true the FlagOverlay shows the "final warning" screen — the reason
   * for the last flag plus a countdown before the page redirects.
   * The submission has already happened server-side at this point.
   */
  finalWarning: boolean

  /** Optimistically increment the counter and set the active event. */
  recordViolation: (event: FlagEvent) => void
  /** Sync the counter with the authoritative server value. */
  syncCount: (serverCount: number) => void
  /** Dismiss the current overlay without changing the count. */
  dismissEvent: () => void
  /** Mark the exam as terminated. */
  terminate: () => void
  /** Show the final-warning overlay (submission already done server-side). */
  showFinalWarning: () => void
  /** Reset the store (called when the attempt page unmounts). */
  reset: () => void
}

export const useViolationStore = create<ViolationState>((set, get) => ({
  count: 0,
  activeEvent: null,
  terminated: false,
  finalWarning: false,

  recordViolation(event) {
    set({ count: event.flagCountAfter, activeEvent: event })
  },

  syncCount(serverCount) {
    set((s) => ({ count: Math.max(s.count, serverCount) }))
  },

  dismissEvent() {
    set({ activeEvent: null })
  },

  terminate() {
    set({ terminated: true, activeEvent: null, finalWarning: false })
  },

  showFinalWarning() {
    set({ finalWarning: true })
  },

  reset() {
    set({ count: 0, activeEvent: null, terminated: false, finalWarning: false })
  },
}))
