"use client"

import { useEffect, useRef, useState } from "react"
import { useViolationStore } from "@/lib/violation-store"
import { addViolation, type ViolationReason } from "@/lib/violation-tracker"
import type { FlagType } from "@/components/student/FlagOverlay"
import { Video, VideoOff } from "lucide-react"

const FACE_INTERVAL_MS = 1500
const OBJECT_INTERVAL_MS = 3000
const GRACE_SECONDS = 15

type CameraViolationType = Extract<FlagType,
  "PERSON_ABSENT" | "MULTIPLE_PERSONS" | "PHONE_DETECTED" | "SUSPICIOUS_OBJECT">

const PHONE_CLASSES = ["cell phone"]
const SUSPICIOUS_CLASSES = ["book", "laptop", "keyboard", "remote", "mouse"]

interface Props {
  attemptId: number
}

export default function ProctorCamera({ attemptId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  const graceTimers = useRef<Map<CameraViolationType, {
    graceTimeout: ReturnType<typeof setTimeout>
    flagFired: boolean
  }>>(new Map())

  const { recordViolation, syncCount, showFinalWarning } = useViolationStore()

  // ── Draggable position ────────────────────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 }) // offset from bottom-right
  const dragging = useRef(false)
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragging.current = true
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: pos.x, posY: pos.y }

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return
      const dx = ev.clientX - dragStart.current.mouseX
      const dy = ev.clientY - dragStart.current.mouseY
      setPos({ x: dragStart.current.posX - dx, y: dragStart.current.posY - dy })
    }
    function onUp() {
      dragging.current = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  // ── Start camera ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        setCameraReady(true)
      })
      .catch(() => {
        if (!cancelled) setCameraError(true)
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // ── Wire stream to video element once it mounts (after cameraReady = true) ─
  useEffect(() => {
    if (!cameraReady || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => {})
  }, [cameraReady])

  // ── Grace-period violation handler ────────────────────────────────────────
  function handleDetection(type: CameraViolationType, detected: boolean) {
    const existing = graceTimers.current.get(type)

    if (detected) {
      if (existing) return // already tracking

      const currentCount = useViolationStore.getState().count
      recordViolation({ type, flagCountAfter: currentCount, source: "CAMERA" })

      const graceTimeout = setTimeout(async () => {
        const entry = graceTimers.current.get(type)
        if (!entry || entry.flagFired) return

        entry.flagFired = true
        const currentCount2 = useViolationStore.getState().count
        recordViolation({ type, flagCountAfter: currentCount2 + 1, source: "CAMERA" })

        const { count: serverCount, willAutoSubmit } = await addViolation(attemptId, type as ViolationReason)
        syncCount(serverCount)
        if (willAutoSubmit) showFinalWarning()
      }, GRACE_SECONDS * 1000)

      graceTimers.current.set(type, { graceTimeout, flagFired: false })
    } else {
      if (!existing) return
      if (!existing.flagFired) {
        clearTimeout(existing.graceTimeout)
      }
      graceTimers.current.delete(type)
    }
  }

  // ── BlazeFace detection loop ──────────────────────────────────────────────
  useEffect(() => {
    if (!cameraReady) return
    let cancelled = false
    let blazeface: import("@tensorflow-models/blazeface").BlazeFaceModel | null = null

    async function loadAndRun() {
      try {
        const tf = await import("@tensorflow/tfjs")
        await tf.ready()
        const bf = await import("@tensorflow-models/blazeface")
        blazeface = await bf.load()
      } catch (err) {
        console.error("[ProctorCamera] BlazeFace load error:", err)
        return
      }

      const run = async () => {
        if (cancelled || !blazeface || !videoRef.current) return
        const video = videoRef.current
        if (video.readyState < 2) return

        try {
          const predictions = await blazeface.estimateFaces(video, false)
          const count = predictions.length
          handleDetection("PERSON_ABSENT", count === 0)
          handleDetection("MULTIPLE_PERSONS", count > 1)
        } catch {
          // ignore frame errors
        }
      }

      const id = setInterval(run, FACE_INTERVAL_MS)
      return () => clearInterval(id)
    }

    let cleanup: (() => void) | undefined
    loadAndRun().then((fn) => { cleanup = fn })
    return () => {
      cancelled = true
      cleanup?.()
      graceTimers.current.forEach(({ graceTimeout }) => clearTimeout(graceTimeout))
      graceTimers.current.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady])

  // ── COCO-SSD detection loop ───────────────────────────────────────────────
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
          handleDetection("PHONE_DETECTED", classes.some((c) => PHONE_CLASSES.includes(c)))
          handleDetection("SUSPICIOUS_OBJECT", classes.some((c) => SUSPICIOUS_CLASSES.includes(c)))
        } catch {
          // ignore frame errors
        }
      }

      const id = setInterval(run, OBJECT_INTERVAL_MS)
      return () => clearInterval(id)
    }

    let cleanup: (() => void) | undefined
    loadAndRun().then((fn) => { cleanup = fn })
    return () => {
      cancelled = true
      cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady])

  // ── Thumbnail UI ──────────────────────────────────────────────────────────
  return (
    <div
      className="fixed z-[9000] flex flex-col items-end gap-1 select-none"
      style={{ bottom: 16 + pos.y, right: 16 + pos.x }}
    >
      <div
        className="relative overflow-hidden rounded-lg border-2 border-white/20 bg-black shadow-xl cursor-grab active:cursor-grabbing"
        style={{ width: 96, height: 72 }}
        onMouseDown={onMouseDown}
        title="Drag to move"
      >
        {cameraReady ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
              </span>
            </div>
          </>
        ) : cameraError ? (
          <div className="flex h-full w-full items-center justify-center">
            <VideoOff size={18} className="text-white/40" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video size={18} className="text-white/40 animate-pulse" />
          </div>
        )}
      </div>
      <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider">
        {cameraError ? "No camera" : "Proctored"}
      </p>
    </div>
  )
}
