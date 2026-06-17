"use client"

import { useEffect, useRef } from "react"
import { useViolationStore } from "@/lib/violation-store"
import { addViolation } from "@/lib/violation-tracker"

const VOICE_RMS_THRESHOLD = 0.06
const SPIKE_RMS_THRESHOLD = 0.45
const ANALYSIS_INTERVAL_MS = 300

interface Props {
  attemptId: number
}

export default function ProctorAudio({ attemptId }: Props) {
  const { recordViolation, syncCount, showFinalWarning, activeEvent } = useViolationStore()

  const flaggedRef = useRef(false)

  // Reset flagged state when student dismisses the overlay
  useEffect(() => {
    if (activeEvent === null) flaggedRef.current = false
  }, [activeEvent])

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

        intervalId = setInterval(async () => {
          if (cancelled || flaggedRef.current) return
          const rms = getRMS()
          if (rms < VOICE_RMS_THRESHOLD && rms < SPIKE_RMS_THRESHOLD) return

          flaggedRef.current = true
          const { count: serverCount, willAutoSubmit } = await addViolation(attemptId, "TALKING_DETECTED")
          const currentCount = useViolationStore.getState().count
          recordViolation({ type: "TALKING_DETECTED", flagCountAfter: Math.max(currentCount, serverCount), source: "CLIENT" })
          syncCount(serverCount)
          if (willAutoSubmit) showFinalWarning()
        }, ANALYSIS_INTERVAL_MS)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
      stream?.getTracks().forEach((t) => t.stop())
      audioCtx?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  return null
}
