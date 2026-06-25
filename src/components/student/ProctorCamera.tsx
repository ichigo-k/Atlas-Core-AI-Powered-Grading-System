"use client"

/**
 * ProctorCamera — MediaPipe Face Landmarker (GPU + VIDEO mode) + COCO-SSD.
 *
 * Runs a requestAnimationFrame loop feeding frames into detectForVideo.
 * Uses video.currentTime change-gating so detectForVideo only fires on
 * NEW video frames — guarantees strictly-increasing timestamps with no
 * extra timestamp tracking needed.
 *
 * Draws the full face mesh overlay on a canvas on top of the live thumbnail.
 *
 * Face violations (per frame):
 *  PERSON_ABSENT    — no face detected
 *  MULTIPLE_PERSONS — > 1 face
 *  GAZE_AWAY        — head yaw/pitch outside thresholds (not eye movements)
 *
 * Object violations (every 800ms, COCO-SSD):
 *  PHONE_DETECTED / SUSPICIOUS_OBJECT
 *
 * Grace period: warning overlay fires immediately, flag +1 only after 15s.
 */

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { useViolationStore } from "@/lib/violation-store"
import { addViolation, type ViolationReason } from "@/lib/violation-tracker"
import { proctorSignals } from "@/lib/proctor-signals"
import type { FlagType } from "@/components/student/FlagOverlay"
import { Video, VideoOff } from "lucide-react"

const OBJECT_INTERVAL_MS = 800

// ── Head-pose tiers (degrees) ──────────────────────────────────────────────
// FLAG = clearly turned away → hard flag (reachable, not "staring into lap").
// WARN = sharp — catches even slight glances → soft toast only (no flag).
const YAW_FLAG = 18,  PITCH_DOWN_FLAG = -20, PITCH_UP_FLAG = 16
const YAW_WARN = 9,   PITCH_DOWN_WARN = -10, PITCH_UP_WARN = 9

// ── Escalation timing ──────────────────────────────────────────────────────
const WARN_SUSTAIN_MS = 600       // continuous before a soft toast — snappy
const REFLAG_COOLDOWN_MS = 15000  // after flagging, wait before re-flagging same type
const WARN_COOLDOWN_MS = 6000     // don't repeat the same toast within this window

// ── Mouth-movement (silent mouthing) — toast only, never flags ─────────────
const JAW_OPEN_HI = 0.32          // blendshape jawOpen score considered "open"
const JAW_OPEN_LO = 0.12          // … considered "closed"
const MOUTH_WINDOW_MS = 3000
const MOUTH_CYCLES_FOR_WARN = 3   // open→close cycles within the window

type CameraViolationType = Extract<FlagType,
  "PERSON_ABSENT" | "MULTIPLE_PERSONS" | "GAZE_AWAY" | "PHONE_DETECTED" | "SUSPICIOUS_OBJECT">

// Keys that can raise a soft toast (superset — includes toast-only signals).
type WarnKey = CameraViolationType | "MOUTH_MOVING"

// Severity per tick: 0 = clear, 1 = warn (toast), 2 = flag (overlay + count).
type Severity = 0 | 1 | 2

// Types that may hard-flag. SUSPICIOUS_OBJECT and MOUTH_MOVING are toast-only.
const HARD_FLAG_TYPES = new Set<WarnKey>([
  "PERSON_ABSENT", "MULTIPLE_PERSONS", "PHONE_DETECTED", "GAZE_AWAY",
])

// Per-signal behaviour:
//   warns  — clear-cut violations (caught red-handed) flag with NO toast tier.
//            ambiguous ones (gaze, objects) toast first.
//   flagMs — how long it must persist before a hard flag (just long enough to
//            ignore single-frame detector hiccups, not a grace period).
const SIGNAL: Record<WarnKey, { warns: boolean; flagMs: number }> = {
  PERSON_ABSENT:    { warns: false, flagMs: 700 },   // left frame → flag, no warning
  MULTIPLE_PERSONS: { warns: false, flagMs: 800 },   // 2nd person → flag
  PHONE_DETECTED:   { warns: false, flagMs: 900 },   // phone in view → flag
  GAZE_AWAY:        { warns: true,  flagMs: 2500 },   // ambiguous (typing/thinking) → toast then flag
  SUSPICIOUS_OBJECT:{ warns: true,  flagMs: Infinity }, // toast only
  MOUTH_MOVING:     { warns: true,  flagMs: Infinity }, // toast only
}

const WARN_MESSAGES: Record<WarnKey, string> = {
  GAZE_AWAY:         "Please keep your eyes on the screen.",
  PERSON_ABSENT:     "Stay in view of the camera.",
  MULTIPLE_PERSONS:  "Another person was detected nearby.",
  PHONE_DETECTED:    "Phones are not allowed during the exam.",
  SUSPICIOUS_OBJECT: "Keep only exam materials in view.",
  MOUTH_MOVING:      "You appear to be talking — this may be flagged.",
}

const PHONE_CLASSES = ["cell phone"]
// keyboard/mouse/laptop are normal for an online exam, so SUSPICIOUS_OBJECT is
// toast-only (see HARD_FLAG_TYPES) — it never adds a flag on its own.
const SUSPICIOUS_CLASSES = ["book", "laptop", "remote"]

interface Props { attemptId: number }

export default function ProctorCamera({ attemptId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  // Per-signal escalation state: how long it's been continuously present, and
  // when we last warned / flagged it (for cooldowns).
  const escalation = useRef<Map<WarnKey, {
    presentSince: number | null
    lastWarnAt: number
    lastFlagAt: number
  }>>(new Map())

  // Mouth-movement tracking (jawOpen oscillation over a rolling window).
  const mouth = useRef<{ phase: "open" | "closed"; cycles: number[] }>({ phase: "closed", cycles: [] })

  const { recordViolation, syncCount, showFinalWarning } = useViolationStore()

  // ── Soft warning (Sonner toast — no flag, no overlay) ─────────────────────
  function softWarn(type: WarnKey) {
    const s = useViolationStore.getState()
    if (s.submitting || s.activeEvent) return // an overlay is already up — don't pile on
    toast.warning(WARN_MESSAGES[type], {
      id: `proctor-warn-${type}`,   // dedupes — same type won't stack
      duration: 4000,
    })
  }

  // ── Hard flag (overlay + count) ───────────────────────────────────────────
  async function hardFlag(type: CameraViolationType) {
    const s = useViolationStore.getState()
    // Ignore incoming flags while a violation overlay is already showing — the
    // student is dealing with one violation at a time (avoids stacking the count
    // behind the overlay). Detection keeps running; the feed is never paused.
    if (s.submitting || s.activeEvent) return
    const optimistic = useViolationStore.getState().count + 1
    recordViolation({ type, flagCountAfter: optimistic, source: "CAMERA" })
    const { count: serverCount, willAutoSubmit } = await addViolation(attemptId, type as ViolationReason)
    syncCount(serverCount)
    if (willAutoSubmit) showFinalWarning()
  }

  // ── Escalation state machine ──────────────────────────────────────────────
  // Clear-cut signals (warns:false) flag straight away once confirmed — no toast.
  // Ambiguous signals (warns:true) toast first, then flag if they persist.
  function escalate(type: WarnKey, severity: Severity) {
    const cfg = SIGNAL[type]
    const st = escalation.current.get(type) ?? { presentSince: null, lastWarnAt: -Infinity, lastFlagAt: -Infinity }
    const now = performance.now()

    if (severity === 0) {
      st.presentSince = null
      escalation.current.set(type, st)
      return
    }

    if (st.presentSince === null) st.presentSince = now
    const elapsed = now - st.presentSince

    // Hard flag — for flag-capable types once confirmed for cfg.flagMs.
    if (
      severity >= 2 &&
      HARD_FLAG_TYPES.has(type) &&
      elapsed >= cfg.flagMs &&
      now - st.lastFlagAt >= REFLAG_COOLDOWN_MS
    ) {
      st.lastFlagAt = now
      escalation.current.set(type, st)
      void hardFlag(type as CameraViolationType)
      return
    }

    // Soft warn — only for ambiguous signals, and only before they'd flag.
    if (cfg.warns && elapsed >= WARN_SUSTAIN_MS && now - st.lastWarnAt >= WARN_COOLDOWN_MS) {
      st.lastWarnAt = now
      softWarn(type)
    }
    escalation.current.set(type, st)
  }

  // ── Suppress MediaPipe INFO logs that go to console.error ─────────────────
  useEffect(() => {
    const orig = console.error
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].startsWith("INFO:")) return
      orig.apply(console, args)
    }
    return () => { console.error = orig }
  }, [])

  // ── Start camera ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        setCameraReady(true)
      })
      .catch(() => { if (!cancelled) setCameraError(true) })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // ── Attach stream after video element renders ─────────────────────────────
  useEffect(() => {
    if (cameraReady && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => { })
    }
  }, [cameraReady])

  // ── Head pose from 4×4 transformation matrix ─────────────────────────────
  function getHeadAngles(matrix: Float32Array | number[]) {
    const pitch = Math.asin(-matrix[9]) * (180 / Math.PI)
    const yaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI)
    return { yaw, pitch }
  }

  // ── MediaPipe Face Landmarker (GPU + VIDEO mode + rAF loop) ───────────────
  useEffect(() => {
    if (!cameraReady) return
    let cancelled = false
    let animFrame: number
    let lastVideoTime = -1

    async function loadAndRun() {
      try {
        const vision = await import("@mediapipe/tasks-vision")
        const { FaceLandmarker, FilesetResolver } = vision

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )

        let faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 2,
        }).catch(async () => {
          // GPU unavailable — fall back to CPU silently
          return FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: "VIDEO",
            numFaces: 2,
          })
        })

        if (cancelled) { faceLandmarker.close(); return }

        function run(timestamp: DOMHighResTimeStamp) {
          if (cancelled) { faceLandmarker.close(); return }

          const video = videoRef.current
          if (!video || video.readyState < 2 || !video.videoWidth) {
            animFrame = requestAnimationFrame(run)
            return
          }

          // Only call detectForVideo when a new video frame is available.
          // This gates the call so the timestamp is always strictly increasing.
          if (video.currentTime === lastVideoTime) {
            animFrame = requestAnimationFrame(run)
            return
          }
          lastVideoTime = video.currentTime

          try {
            const result = faceLandmarker.detectForVideo(video, timestamp)
            const faceCount = result.faceLandmarks.length

            // Presence
            escalate("PERSON_ABSENT", faceCount === 0 ? 2 : 0)
            escalate("MULTIPLE_PERSONS", faceCount > 1 ? 2 : 0)

            // Gaze — two-tier: sharp WARN angles → toast, loose FLAG angles → flag
            if (faceCount === 1 && result.facialTransformationMatrixes?.[0]) {
              const { yaw, pitch } = getHeadAngles(
                result.facialTransformationMatrixes[0].data as Float32Array
              )
              const beyondFlag =
                Math.abs(yaw) > YAW_FLAG || pitch < PITCH_DOWN_FLAG || pitch > PITCH_UP_FLAG
              const beyondWarn =
                Math.abs(yaw) > YAW_WARN || pitch < PITCH_DOWN_WARN || pitch > PITCH_UP_WARN
              escalate("GAZE_AWAY", beyondFlag ? 2 : beyondWarn ? 1 : 0)
            } else {
              escalate("GAZE_AWAY", 0)
            }

            // Mouth movement — track jawOpen oscillation; only a concern when the
            // mic is silent (i.e. mouthing without audible sound). Toast only.
            if (faceCount === 1 && result.faceBlendshapes?.[0]) {
              const jawOpen = result.faceBlendshapes[0].categories
                .find((c) => c.categoryName === "jawOpen")?.score ?? 0
              const m = mouth.current
              const now = performance.now()
              if (jawOpen > JAW_OPEN_HI && m.phase === "closed") m.phase = "open"
              else if (jawOpen < JAW_OPEN_LO && m.phase === "open") { m.phase = "closed"; m.cycles.push(now) }
              m.cycles = m.cycles.filter((t) => now - t < MOUTH_WINDOW_MS)
              const moving = m.cycles.length >= MOUTH_CYCLES_FOR_WARN
              escalate("MOUTH_MOVING", moving && proctorSignals.audioSilent ? 1 : 0)
            } else {
              escalate("MOUTH_MOVING", 0)
            }
          } catch {
            // ignore frame errors
          }

          animFrame = requestAnimationFrame(run)
        }

        animFrame = requestAnimationFrame(run)
      } catch (err) {
        console.error("[ProctorCamera] MediaPipe load error:", err)
      }
    }

    loadAndRun()
    return () => {
      cancelled = true
      if (animFrame) cancelAnimationFrame(animFrame)
      escalation.current.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady])

  // ── COCO-SSD object detection ─────────────────────────────────────────────
  useEffect(() => {
    if (!cameraReady) return
    let cancelled = false
    let cocoSsd: import("@tensorflow-models/coco-ssd").ObjectDetection | null = null

    async function loadAndRun() {
      try {
        const tf = await import("@tensorflow/tfjs")
        await tf.ready()
        const ssd = await import("@tensorflow-models/coco-ssd")
        cocoSsd = await ssd.load()
      } catch (err) {
        console.error("[ProctorCamera] COCO-SSD load error:", err)
        return
      }
      const run = async () => {
        if (cancelled || !cocoSsd || !videoRef.current) return
        const video = videoRef.current
        if (video.readyState < 2) return
        try {
          const predictions = await cocoSsd.detect(video)
          const classes = predictions.map((p) => p.class.toLowerCase())
          // Phone → hard flag (severity 2). Other objects → toast only (severity 1).
          escalate("PHONE_DETECTED", classes.some((c) => PHONE_CLASSES.includes(c)) ? 2 : 0)
          escalate("SUSPICIOUS_OBJECT", classes.some((c) => SUSPICIOUS_CLASSES.includes(c)) ? 1 : 0)
        } catch { /* ignore */ }
      }
      const id = setInterval(run, OBJECT_INTERVAL_MS)
      return () => clearInterval(id)
    }

    let cleanup: (() => void) | undefined
    loadAndRun().then((fn) => { cleanup = fn })
    return () => { cancelled = true; cleanup?.() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady])

  // ── Placement: dock in the exam sidebar on desktop; hidden on mobile ──────
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const update = () => {
      setIsDesktop(mq.matches)
      setSlot(document.getElementById("proctor-cam-slot"))
    }
    update()
    mq.addEventListener("change", update)
    const t = setTimeout(update, 300) // slot may mount just after us
    return () => { mq.removeEventListener("change", update); clearTimeout(t) }
  }, [])

  // Re-attach the stream whenever placement changes (portal remounts the <video>).
  useEffect(() => {
    if (cameraReady && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => { })
    }
  }, [cameraReady, isDesktop, slot])

  // Keep-alive watchdog. A full-screen overlay covers the feed and the browser
  // can pause the occluded <video>, leaving it stuck black on return. Rather than
  // pause/resume around overlays, we just never let it stay paused: every second
  // re-attach the stream and replay if it has paused. Cheap and bulletproof.
  useEffect(() => {
    if (!cameraReady) return
    const id = setInterval(() => {
      const v = videoRef.current
      if (!v || !streamRef.current) return
      if (v.srcObject !== streamRef.current) v.srcObject = streamRef.current
      if (v.paused) v.play().catch(() => { })
    }, 1000)
    return () => clearInterval(id)
  }, [cameraReady])

  // The preview card (same <video> node feeds MediaPipe regardless of placement).
  // Fixed height so it can never collapse to a line in the flex sidebar.
  const preview = (
    <div className="overflow-hidden rounded-lg border border-[#2f2f33] bg-[#0c0c0e] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/70">
            Live · Proctored
          </span>
        </div>
        <Video size={11} className="text-white/25" />
      </div>

      {/* Feed (fixed height, mirrored like a selfie view) */}
      <div className="relative w-full bg-black" style={{ height: 138 }}>
        {cameraReady ? (
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        ) : cameraError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/40">
            <VideoOff size={18} />
            <span className="text-[10px]">No camera</span>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/40">
            <Video size={18} className="animate-pulse" />
            <span className="text-[10px]">Starting camera…</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
      </div>
    </div>
  )

  // Desktop with a sidebar slot → render there. Otherwise keep the <video>
  // mounted but off-screen so detection keeps running with no visible preview.
  if (isDesktop && slot) return createPortal(preview, slot)
  return (
    <div aria-hidden className="fixed -left-[9999px] top-0 w-40 opacity-0 pointer-events-none">
      {preview}
    </div>
  )
}
