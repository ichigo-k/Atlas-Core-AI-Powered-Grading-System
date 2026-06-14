// Shared violation tracker — all anti-cheat events (fullscreen exits, tab switches)
// count toward the same limit. Counter is stored server-side in ProctorRecord.flagCount
// so reloads don't reset it and all violation sources (client + Oracle) are unified.

import { getProctorFlagCount } from '@/lib/proctor-actions'

export const MAX_VIOLATIONS = 5

export type ViolationReason = 'FULLSCREEN_EXIT' | 'TAB_SWITCH'

// Local in-memory fallback counter for non-proctored exams (no ProctorRecord).
// Lives in the browser's module cache — persists across re-renders within the
// same page session, resets on full page reload (which is fine).
const _localCounts = new Map<number, number>()

/**
 * Reads the current violation count for the attempt.
 *
 * For proctored exams: reads from the server-side ProctorRecord.flagCount.
 * For non-proctored exams (no ProctorRecord): reads from the local in-memory
 * counter so the UI stays consistent within the same page session.
 */
export async function readViolationCount(attemptId: number): Promise<number> {
  try {
    const serverCount = await getProctorFlagCount(attemptId)
    if (serverCount > 0) return serverCount
    // No server record — return local count (may be 0 on first load, which is correct)
    return _localCounts.get(attemptId) ?? 0
  } catch {
    return _localCounts.get(attemptId) ?? 0
  }
}

/**
 * Reports a client-side violation event to the server by calling
 * POST /api/internal/proctor/flag. Returns the new flag count and
 * whether the server has already submitted the attempt (willAutoSubmit).
 *
 * When a ProctorRecord exists (proctored exam), the server-side count is
 * authoritative and is returned directly.
 *
 * When no ProctorRecord exists (non-proctored exam), the server returns
 * flagCount: 0. In that case we fall back to a local in-memory counter so
 * the UI violation dots and auto-submit still work correctly.
 */
export async function addViolation(
  attemptId: number,
  reason: ViolationReason,
): Promise<{ count: number; willAutoSubmit: boolean }> {
  try {
    const response = await fetch('/api/internal/proctor/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        violationType: reason,
        detectedAt: new Date().toISOString(),
      }),
    })
    if (!response.ok) {
      const local = (_localCounts.get(attemptId) ?? 0) + 1
      _localCounts.set(attemptId, local)
      return { count: local, willAutoSubmit: local >= MAX_VIOLATIONS }
    }
    const data = await response.json()
    const serverCount = typeof data?.flagCount === 'number' ? data.flagCount : 0
    const willAutoSubmit = data?.willAutoSubmit === true

    if (serverCount === 0) {
      const local = (_localCounts.get(attemptId) ?? 0) + 1
      _localCounts.set(attemptId, local)
      return { count: local, willAutoSubmit: local >= MAX_VIOLATIONS }
    }

    _localCounts.set(attemptId, serverCount)
    return { count: serverCount, willAutoSubmit }
  } catch {
    const local = (_localCounts.get(attemptId) ?? 0) + 1
    _localCounts.set(attemptId, local)
    return { count: local, willAutoSubmit: local >= MAX_VIOLATIONS }
  }
}

/**
 * The server-side log is now the source of truth for violation reasons.
 * This function is retained for backward compatibility but always returns null.
 */
export function readLastReason(attemptId: number): ViolationReason | null {
  return null
}
