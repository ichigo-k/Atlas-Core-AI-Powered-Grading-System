/**
 * liveness-gestures — the pool of HAND gesture challenges used by
 * LivenessCheck to prove a live person is in front of the camera (not a static
 * photo, printed mask, or looping video).
 *
 * Detection uses MediaPipe's Gesture Recognizer (see getGestureRecognizer in
 * src/lib/model-cache.ts), which classifies a hand into one of a small set of
 * canned gestures. Hand gestures are far more reliable to detect than the
 * subtle facial-blendshape actions we used before (cheek puff, lip pucker,
 * etc.) — they're large, distinctive, and unambiguous — and the instructions
 * ("make a fist", "hold up two fingers") are universally understood.
 *
 * Each gesture maps to the MediaPipe category name it must produce. The
 * recognizer's canned categories are:
 *   None, Closed_Fist, Open_Palm, Pointing_Up, Thumb_Down, Thumb_Up, Victory,
 *   ILoveYou
 * We only use the six that are simple and unambiguous to instruct.
 */

export interface Gesture {
  id: string
  /** Plain-language instruction shown to the student. */
  instruction: string
  /** MediaPipe GestureRecognizer category name that satisfies this gesture. */
  category: string
  /** Minimum recognizer confidence (0–1) to count as a match. */
  minConfidence?: number
}

const DEFAULT_MIN_CONFIDENCE = 0.6

export const HAND_GESTURES: Gesture[] = [
  {
    id: "open_palm",
    instruction: "Raise your open hand, palm facing the camera",
    category: "Open_Palm",
  },
  {
    id: "fist",
    instruction: "Make a fist and hold it up",
    category: "Closed_Fist",
  },
  {
    id: "victory",
    instruction: "Hold up two fingers (peace sign)",
    category: "Victory",
  },
  {
    id: "thumb_up",
    instruction: "Give a thumbs up",
    category: "Thumb_Up",
  },
  {
    id: "thumb_down",
    instruction: "Give a thumbs down",
    category: "Thumb_Down",
  },
  {
    id: "point_up",
    instruction: "Point one finger up",
    category: "Pointing_Up",
  },
]

/** True when a recognized category + score satisfies the given gesture. */
export function gestureMatches(
  gesture: Gesture,
  categoryName: string | undefined,
  score: number | undefined,
): boolean {
  if (!categoryName || score == null) return false
  return categoryName === gesture.category && score >= (gesture.minConfidence ?? DEFAULT_MIN_CONFIDENCE)
}

export interface Challenge {
  /** Ordered gestures to perform, one at a time. */
  steps: Gesture[]
  /** Source id — the gesture ids joined, for logging. */
  sourceId: string
}

/**
 * Picks a random liveness challenge of `count` distinct hand gestures.
 *
 * @param count 1 for a single-step challenge, 2 for a two-step challenge.
 */
export function pickRandomChallenge(count: 1 | 2): Challenge {
  const pool = [...HAND_GESTURES]
  // Fisher–Yates shuffle, then take the first `count`.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const steps = pool.slice(0, count)
  return { steps, sourceId: steps.map((g) => g.id).join("+") }
}

/** Total distinct single-gesture pool size (for sanity/logging). */
export const GESTURE_POOL_SIZE = HAND_GESTURES.length
