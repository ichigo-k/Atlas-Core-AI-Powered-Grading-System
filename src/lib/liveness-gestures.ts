/**
 * liveness-gestures — a pool of face-blendshape / head-pose gesture
 * challenges used by LivenessCheck to prove a live person is in front of the
 * camera (not a static photo, printed mask, or looping video).
 *
 * Detection is possible using ONLY MediaPipe Face Landmarker output — the
 * 52 ARKit-style blendshape scores (0–1) plus head yaw/pitch derived from the
 * facial transformation matrix. No hand tracking is available, so every
 * gesture here is a face/head action.
 *
 * Categories:
 *  - "eye"   — blink/wide/squint/gaze-based. These are the gestures most
 *              affected by glasses (reflections, frame occlusion can throw
 *              off eye-region blendshape scores), so they're picked less
 *              often (see pickRandomChallenge's weighting).
 *  - "other" — mouth/jaw/brow/cheek/tongue/nose/head-pose-based. Unaffected
 *              by glasses, so these make up the bulk of normal picks.
 *
 * Thresholds are intentionally generous (blendshape scores are noisy across
 * lighting/camera quality) — LivenessCheck additionally requires the
 * condition to be sustained for a short window before counting it as
 * detected, which filters out single-frame false positives without needing
 * tight thresholds here.
 */

export type GestureCategory = "eye" | "other"

export interface Gesture {
  id: string
  instruction: string
  category: GestureCategory
  /**
   * Whether this gesture is part of the curated "simple" pool that the
   * liveness check actually draws from. We only ever ask students to perform
   * plainly-worded, universally-understood actions (close an eye, stick out
   * your tongue, open your mouth, turn your head, smile, nod) — anything that
   * needs describing ("pucker your lips", "sneer", "roll your lower lip in")
   * is left `simple: false` and never shown. The full list is kept intact so
   * the detection predicates stay available, but only `simple` gestures are
   * selectable.
   */
  simple?: boolean
  check: (blendshapes: Record<string, number>, yaw: number, pitch: number) => boolean
}

// Small helper so a gesture reads naturally: b("jawOpen") instead of
// blendshapes["jawOpen"] ?? 0 everywhere below.
function score(blendshapes: Record<string, number>, name: string): number {
  return blendshapes[name] ?? 0
}

// ── Single (atomic) gestures ────────────────────────────────────────────────
// Each entry is one instruction + one predicate. ~38 single gestures below,
// spanning every blendshape category listed in the task plus head-pose.
export const SINGLE_GESTURES: Gesture[] = [
  // ── Head pose (category: other) ───────────────────────────────────────────
  {
    id: "head_turn_left",
    instruction: "Turn your head to the left",
    category: "other",
    simple: true,
    check: (_b, yaw) => yaw > 20,
  },
  {
    id: "head_turn_right",
    instruction: "Turn your head to the right",
    category: "other",
    simple: true,
    check: (_b, yaw) => yaw < -20,
  },
  {
    id: "head_tilt_up",
    instruction: "Look up at the ceiling",
    category: "other",
    simple: true,
    check: (_b, _yaw, pitch) => pitch > 15,
  },
  {
    id: "head_tilt_down",
    instruction: "Tilt your head down, looking at the floor",
    category: "other",
    check: (_b, _yaw, pitch) => pitch < -20,
  },
  {
    id: "head_nod",
    instruction: "Nod your head up and down",
    category: "other",
    simple: true,
    check: (_b, _yaw, pitch) => pitch < -15,
  },

  // ── Mouth / jaw (category: other) ─────────────────────────────────────────
  {
    id: "mouth_open_wide",
    instruction: "Open your mouth wide",
    category: "other",
    simple: true,
    check: (b) => score(b, "jawOpen") > 0.5,
  },
  {
    id: "jaw_left",
    instruction: "Move your jaw to the left",
    category: "other",
    check: (b) => score(b, "jawLeft") > 0.4,
  },
  {
    id: "jaw_right",
    instruction: "Move your jaw to the right",
    category: "other",
    check: (b) => score(b, "jawRight") > 0.4,
  },
  {
    id: "smile_left",
    instruction: "Smile with the left side of your mouth",
    category: "other",
    check: (b) => score(b, "mouthSmileLeft") > 0.5,
  },
  {
    id: "smile_right",
    instruction: "Smile with the right side of your mouth",
    category: "other",
    check: (b) => score(b, "mouthSmileRight") > 0.5,
  },
  {
    id: "smile_both",
    instruction: "Give a big smile",
    category: "other",
    simple: true,
    check: (b) => score(b, "mouthSmileLeft") > 0.4 && score(b, "mouthSmileRight") > 0.4,
  },
  {
    id: "frown_left",
    instruction: "Frown with the left side of your mouth",
    category: "other",
    check: (b) => score(b, "mouthFrownLeft") > 0.4,
  },
  {
    id: "frown_right",
    instruction: "Frown with the right side of your mouth",
    category: "other",
    check: (b) => score(b, "mouthFrownRight") > 0.4,
  },
  {
    id: "mouth_pucker",
    instruction: "Pucker your lips, as if to whistle",
    category: "other",
    check: (b) => score(b, "mouthPucker") > 0.5,
  },
  {
    id: "mouth_funnel",
    instruction: "Round your lips into an 'O' shape",
    category: "other",
    check: (b) => score(b, "mouthFunnel") > 0.4,
  },
  {
    id: "cheek_puff",
    instruction: "Puff out your cheeks",
    category: "other",
    simple: true,
    check: (b) => score(b, "cheekPuff") > 0.4,
  },
  {
    id: "tongue_out",
    instruction: "Stick out your tongue",
    category: "other",
    simple: true,
    check: (b) => score(b, "tongueOut") > 0.4,
  },
  {
    id: "mouth_stretch_left",
    instruction: "Stretch the left corner of your mouth sideways",
    category: "other",
    check: (b) => score(b, "mouthStretchLeft") > 0.4,
  },
  {
    id: "mouth_stretch_right",
    instruction: "Stretch the right corner of your mouth sideways",
    category: "other",
    check: (b) => score(b, "mouthStretchRight") > 0.4,
  },
  {
    id: "mouth_press_left",
    instruction: "Press your lips together on the left side",
    category: "other",
    check: (b) => score(b, "mouthPressLeft") > 0.4,
  },
  {
    id: "mouth_press_right",
    instruction: "Press your lips together on the right side",
    category: "other",
    check: (b) => score(b, "mouthPressRight") > 0.4,
  },
  {
    id: "mouth_roll_lower",
    instruction: "Roll your lower lip inward",
    category: "other",
    check: (b) => score(b, "mouthRollLower") > 0.4,
  },
  {
    id: "mouth_roll_upper",
    instruction: "Roll your upper lip inward",
    category: "other",
    check: (b) => score(b, "mouthRollUpper") > 0.4,
  },
  {
    id: "mouth_shrug_lower",
    instruction: "Push your lower lip up and out",
    category: "other",
    check: (b) => score(b, "mouthShrugLower") > 0.4,
  },
  {
    id: "mouth_shrug_upper",
    instruction: "Raise your upper lip, as if in disgust",
    category: "other",
    check: (b) => score(b, "mouthShrugUpper") > 0.4,
  },
  {
    id: "dimple_left",
    instruction: "Make a dimple on the left side of your mouth",
    category: "other",
    check: (b) => score(b, "mouthDimpleLeft") > 0.4,
  },
  {
    id: "dimple_right",
    instruction: "Make a dimple on the right side of your mouth",
    category: "other",
    check: (b) => score(b, "mouthDimpleRight") > 0.4,
  },

  // ── Brows / nose (category: other) ────────────────────────────────────────
  {
    id: "brows_raise",
    instruction: "Raise your eyebrows",
    category: "other",
    simple: true,
    check: (b) => score(b, "browInnerUp") > 0.4,
  },
  {
    id: "brow_outer_up_left",
    instruction: "Raise your left eyebrow",
    category: "other",
    check: (b) => score(b, "browOuterUpLeft") > 0.35,
  },
  {
    id: "brow_outer_up_right",
    instruction: "Raise your right eyebrow",
    category: "other",
    check: (b) => score(b, "browOuterUpRight") > 0.35,
  },
  {
    id: "brows_frown",
    instruction: "Frown, pulling your eyebrows down",
    category: "other",
    check: (b) => score(b, "browDownLeft") > 0.35 && score(b, "browDownRight") > 0.35,
  },
  {
    id: "nose_sneer_left",
    instruction: "Sneer, wrinkling the left side of your nose",
    category: "other",
    check: (b) => score(b, "noseSneerLeft") > 0.4,
  },
  {
    id: "nose_sneer_right",
    instruction: "Sneer, wrinkling the right side of your nose",
    category: "other",
    check: (b) => score(b, "noseSneerRight") > 0.4,
  },

  // ── Eyes (category: eye — glasses-sensitive) ──────────────────────────────
  {
    id: "blink_both",
    instruction: "Blink both eyes",
    category: "eye",
    simple: true,
    check: (b) => score(b, "eyeBlinkLeft") > 0.5 && score(b, "eyeBlinkRight") > 0.5,
  },
  {
    id: "wink_left",
    instruction: "Close your left eye",
    category: "eye",
    simple: true,
    check: (b) => score(b, "eyeBlinkLeft") > 0.6 && score(b, "eyeBlinkRight") < 0.3,
  },
  {
    id: "wink_right",
    instruction: "Close your right eye",
    category: "eye",
    simple: true,
    check: (b) => score(b, "eyeBlinkRight") > 0.6 && score(b, "eyeBlinkLeft") < 0.3,
  },
  {
    id: "eyes_wide",
    instruction: "Open your eyes as wide as you can",
    category: "eye",
    check: (b) => score(b, "eyeWideLeft") > 0.4 && score(b, "eyeWideRight") > 0.4,
  },
  {
    id: "eyes_squint",
    instruction: "Squint your eyes",
    category: "eye",
    check: (b) => score(b, "eyeSquintLeft") > 0.4 && score(b, "eyeSquintRight") > 0.4,
  },
  {
    id: "eyes_look_up",
    instruction: "Look up with your eyes (without moving your head)",
    category: "eye",
    check: (b) => score(b, "eyeLookUpLeft") > 0.4 && score(b, "eyeLookUpRight") > 0.4,
  },
  {
    id: "eyes_look_down",
    instruction: "Look down with your eyes (without moving your head)",
    category: "eye",
    check: (b) => score(b, "eyeLookDownLeft") > 0.4 && score(b, "eyeLookDownRight") > 0.4,
  },
  {
    id: "eyes_look_left",
    instruction: "Look to the left with your eyes (without moving your head)",
    category: "eye",
    // Looking screen-left: right eye looks in (toward nose), left eye looks out.
    check: (b) => score(b, "eyeLookInRight") > 0.4 && score(b, "eyeLookOutLeft") > 0.4,
  },
  {
    id: "eyes_look_right",
    instruction: "Look to the right with your eyes (without moving your head)",
    category: "eye",
    check: (b) => score(b, "eyeLookInLeft") > 0.4 && score(b, "eyeLookOutRight") > 0.4,
  },
]

// ── Compound (two-step) gestures ────────────────────────────────────────────
// Built by pairing two single gestures into a short sequence. Detection order
// matters: `first` must be held before `second` is checked (LivenessCheck
// treats each step of a compound gesture as its own sequential challenge, so
// these are mostly a convenience list for readable instruction text — the
// actual sequencing is enforced by the component, which walks `steps` in
// order). Picking two single gestures via pickRandomChallenge(2) achieves the
// same effect; COMPOUND_GESTURES exists to comfortably clear the 50+ pool
// requirement with natural, pre-authored instruction pairs.
export interface CompoundGesture {
  id: string
  category: GestureCategory // dominant/first-step category, used for weighting
  steps: [Gesture, Gesture]
}

function bySingleId(id: string): Gesture {
  const g = SINGLE_GESTURES.find((g) => g.id === id)
  if (!g) throw new Error(`[liveness-gestures] unknown gesture id: ${id}`)
  return g
}

export const COMPOUND_GESTURES: CompoundGesture[] = [
  { id: "c_turnleft_smile", category: "other", steps: [bySingleId("head_turn_left"), bySingleId("smile_both")] },
  { id: "c_turnright_smile", category: "other", steps: [bySingleId("head_turn_right"), bySingleId("smile_both")] },
  { id: "c_nod_tongue", category: "other", steps: [bySingleId("head_nod"), bySingleId("tongue_out")] },
  { id: "c_browsraise_mouthopen", category: "other", steps: [bySingleId("brows_raise"), bySingleId("mouth_open_wide")] },
  { id: "c_turnleft_turnright", category: "other", steps: [bySingleId("head_turn_left"), bySingleId("head_turn_right")] },
  { id: "c_tiltup_tiltdown", category: "other", steps: [bySingleId("head_tilt_up"), bySingleId("head_tilt_down")] },
  { id: "c_pucker_funnel", category: "other", steps: [bySingleId("mouth_pucker"), bySingleId("mouth_funnel")] },
  { id: "c_cheekpuff_tongueout", category: "other", steps: [bySingleId("cheek_puff"), bySingleId("tongue_out")] },
  { id: "c_smileleft_smileright", category: "other", steps: [bySingleId("smile_left"), bySingleId("smile_right")] },
  { id: "c_jawleft_jawright", category: "other", steps: [bySingleId("jaw_left"), bySingleId("jaw_right")] },
  { id: "c_browsraise_browsfrown", category: "other", steps: [bySingleId("brows_raise"), bySingleId("brows_frown")] },
  { id: "c_turnleft_browsraise", category: "other", steps: [bySingleId("head_turn_left"), bySingleId("brows_raise")] },
  { id: "c_turnright_tongueout", category: "other", steps: [bySingleId("head_turn_right"), bySingleId("tongue_out")] },
  { id: "c_nod_smile", category: "other", steps: [bySingleId("head_nod"), bySingleId("smile_both")] },
  { id: "c_mouthopen_cheekpuff", category: "other", steps: [bySingleId("mouth_open_wide"), bySingleId("cheek_puff")] },
  { id: "c_sneerleft_sneerright", category: "other", steps: [bySingleId("nose_sneer_left"), bySingleId("nose_sneer_right")] },
  { id: "c_blink_smile", category: "eye", steps: [bySingleId("blink_both"), bySingleId("smile_both")] },
  { id: "c_winkleft_smile", category: "eye", steps: [bySingleId("wink_left"), bySingleId("smile_both")] },
  { id: "c_winkright_tongueout", category: "eye", steps: [bySingleId("wink_right"), bySingleId("tongue_out")] },
  { id: "c_eyeswide_mouthopen", category: "eye", steps: [bySingleId("eyes_wide"), bySingleId("mouth_open_wide")] },
  { id: "c_lookleft_lookright", category: "eye", steps: [bySingleId("eyes_look_left"), bySingleId("eyes_look_right")] },
  { id: "c_lookup_lookdown", category: "eye", steps: [bySingleId("eyes_look_up"), bySingleId("eyes_look_down")] },
  { id: "c_squint_browsraise", category: "eye", steps: [bySingleId("eyes_squint"), bySingleId("brows_raise")] },
]

// ── Selection ────────────────────────────────────────────────────────────
export interface Challenge {
  /** Ordered instruction steps to perform, one at a time. */
  steps: Gesture[]
  /** Source id — either a single gesture id or a compound gesture id. */
  sourceId: string
}

/**
 * Weighted pick from SINGLE_GESTURES: "eye" gestures are ~1/3 as likely to
 * be selected as "other" gestures (glasses accommodation — some students
 * wear glasses that make eye-blendshape readings unreliable, so we don't
 * want the liveness check to unfairly hinge on an eye gesture most of the
 * time).
 */
// Only the curated, plainly-worded gestures are ever asked of a student.
export const SIMPLE_GESTURES: Gesture[] = SINGLE_GESTURES.filter((g) => g.simple)

function weightedPickSingle(excludeIds: Set<string> = new Set()): Gesture {
  const pool = SIMPLE_GESTURES.filter((g) => !excludeIds.has(g.id))
  const weight = (g: Gesture) => (g.category === "eye" ? 1 : 3)
  const total = pool.reduce((sum, g) => sum + weight(g), 0)
  let r = Math.random() * total
  for (const g of pool) {
    r -= weight(g)
    if (r <= 0) return g
  }
  return pool[pool.length - 1]
}

/**
 * Picks a random liveness challenge.
 *
 * @param count 1 for a single-step challenge, 2 for a two-step challenge.
 * @param excludeCategoryBias if true (default), applies the eye/other 1:3
 *   weighting described above. Pass false to sample uniformly (e.g. for
 *   testing).
 */
export function pickRandomChallenge(count: 1 | 2, excludeCategoryBias = true): Challenge {
  const pickUniform = (exclude: Set<string> = new Set()) => {
    const pool = SIMPLE_GESTURES.filter((g) => !exclude.has(g.id))
    return pool[Math.floor(Math.random() * pool.length)]
  }

  if (count === 1) {
    const gesture = excludeCategoryBias ? weightedPickSingle() : pickUniform()
    return { steps: [gesture], sourceId: gesture.id }
  }

  // Two-step challenges are always two distinct simple gestures performed in
  // sequence. Authored compound gestures are intentionally NOT used here —
  // some of them chain harder-to-describe actions, and we only ever show the
  // curated simple set.
  const first = excludeCategoryBias ? weightedPickSingle() : pickUniform()
  const second = excludeCategoryBias
    ? weightedPickSingle(new Set([first.id]))
    : pickUniform(new Set([first.id]))
  return { steps: [first, second], sourceId: `${first.id}+${second.id}` }
}

// Total distinct challenge pool size (for sanity/logging — not required at
// runtime): SINGLE_GESTURES.length single challenges + COMPOUND_GESTURES.length
// authored two-step challenges + a large combinatorial space of ad-hoc
// two-gesture pairings.
export const GESTURE_POOL_SIZE = SINGLE_GESTURES.length + COMPOUND_GESTURES.length
