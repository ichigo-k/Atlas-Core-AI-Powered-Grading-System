"use client"

import { useEffect, useRef } from "react"
import { useViolationStore } from "@/lib/violation-store"
import { addViolation } from "@/lib/violation-tracker"

// Thresholds (RMS 0–1 scale)
const VOICE_RMS_THRESHOLD = 0.06   // sustained speech
const SPIKE_RMS_THRESHOLD = 0.45   // sudden loud sound (notification ping)
// Require N consecutive detections before showing overlay (avoids flashing on brief sounds)
const SUSTAINED_FRAMES_REQUIRED = 3
const ANALYSIS_INTERVAL_MS = 500
const GRACE_SECONDS = 15

interface Props {
  attemptId: number
}

export default function ProctorAudio({ attemptId }: Props) {
  const { recordViolation, syncCount, showFinalWarning, activeEvent } = useViolationStore()

  // When the student dismisses the overlay, allow new audio detections
  useEffect(() => {
    if (activeEvent === null) {
      overlayShownRef.current = false
      sustainedCountRef.current = 0
    }
  }, [activeEvent])

  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flagFiredRef = useRef(false)
  const overlayShownRef = useRef(false)
  const sustainedCountRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s

        audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        audioCtx.createMediaStreamSource(stream).connect(analyser)

        const timeDomain = new Float32Array(analyser.frequencyBinCount)

        function getRMS(): number {
          analyser.getFloatTimeDomainData(timeDomain)
          let sumSq = 0
          for (let i = 0; i < timeDomain.length; i++) sumSq += timeDomain[i] * timeDomain[i]
          return Math.sqrt(sumSq / timeDomain.length)
        }

        intervalId = setInterval(() => {
          if (cancelled) return
          const rms = getRMS()
          const isSpike = rms > SPIKE_RMS_THRESHOLD
          const isVoice = rms > VOICE_RMS_THRESHOLD

          if (isSpike || isVoice) {
            sustainedCountRef.current += 1
            if (sustainedCountRef.current >= SUSTAINED_FRAMES_REQUIRED) {
              handleAudioDetected()
            }
          } else {
            sustainedCountRef.current = 0
            clearGrace()
          }
        }, ANALYSIS_INTERVAL_MS)
      })
      .catch(() => {}) // mic denied — silently skip, don't block exam

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      clearGrace()
      stream?.getTracks().forEach((t) => t.stop())
      audioCtx?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  function handleAudioDetected() {
    if (overlayShownRef.current) return // overlay already up

    overlayShownRef.current = true
    flagFiredRef.current = false

    const currentCount = useViolationStore.getState().count
    recordViolation({ type: "TALKING_DETECTED", flagCountAfter: currentCount, source: "CLIENT" })

    graceTimerRef.current = setTimeout(async () => {
      if (flagFiredRef.current) return
      flagFiredRef.current = true

      const count2 = useViolationStore.getState().count
      recordViolation({ type: "TALKING_DETECTED", flagCountAfter: count2 + 1, source: "CLIENT" })
      const { count: serverCount, willAutoSubmit } = await addViolation(attemptId, "TALKING_DETECTED")
      syncCount(serverCount)
      if (willAutoSubmit) showFinalWarning()
      graceTimerRef.current = null
      overlayShownRef.current = false
    }, GRACE_SECONDS * 1000)
  }

  function clearGrace() {
    if (graceTimerRef.current && !flagFiredRef.current) {
      clearTimeout(graceTimerRef.current)
      graceTimerRef.current = null
      overlayShownRef.current = false
    }
  }

  return null
}
