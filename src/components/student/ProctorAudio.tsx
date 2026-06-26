"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { useViolationStore } from "@/lib/violation-store"
import { addViolation } from "@/lib/violation-tracker"
import { proctorSignals } from "@/lib/proctor-signals"

// ── Audio tiers (RMS, 0–1) ─────────────────────────────────────────────────
const VOICE_WARN_RMS = 0.012  // faint murmur — soft toast only (sharp Tier 1)
const VOICE_FLAG_RMS = 0.03   // clear talking level — can flag
const SPIKE_RMS      = 0.20   // sudden loud burst — flags immediately
const ANALYSIS_INTERVAL_MS = 400

// Sustained-sample requirements (× ANALYSIS_INTERVAL_MS).
const WARN_SAMPLES = 2   // ~0.8s in the warn band → toast (snappy)
const FLAG_SAMPLES = 6   // ~2.4s of clear talking → flag
const WARN_COOLDOWN_MS = 6000  // don't repeat the toast within this window

interface Props {
  attemptId: number
}

export default function ProctorAudio({ attemptId }: Props) {
  const { recordViolation, syncCount, showFinalWarning, activeEvent } = useViolationStore()

  const flaggedRef = useRef(false)   // an overlay is up — don't re-flag until dismissed
  const warnSamplesRef = useRef(0)
  const flagSamplesRef = useRef(0)
  const lastWarnAtRef = useRef(-Infinity)

  // Reset when the student dismisses the overlay (acts as the re-flag cooldown).
  useEffect(() => {
    if (activeEvent === null) {
      flaggedRef.current = false
      warnSamplesRef.current = 0
      flagSamplesRef.current = 0
    }
  }, [activeEvent])

  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t: any) => t.stop()); return }
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

        async function flag() {
          flaggedRef.current = true
          warnSamplesRef.current = 0
          flagSamplesRef.current = 0
          // Flag FIRST (count + overlay); flaggedRef now gates re-flagging.
          const optimistic = useViolationStore.getState().count + 1
          const { count: serverCount, willAutoSubmit } = await addViolation(attemptId, "TALKING_DETECTED")
          recordViolation({ type: "TALKING_DETECTED", flagCountAfter: Math.max(optimistic, serverCount), source: "CLIENT" })
          syncCount(serverCount)
          if (willAutoSubmit) showFinalWarning()
        }

        intervalId = setInterval(() => {
          if (cancelled) return
          const rms = getRMS()
          // Always publish the level so the camera can do "mouth moving but silent".
          proctorSignals.audioRms = rms

          const vs = useViolationStore.getState()
          // Ignore while our own overlay is up (flaggedRef), while submitting, or
          // while ANY other violation overlay is showing.
          if (flaggedRef.current || vs.submitting || vs.activeEvent) return

          // Sudden loud burst — flag right away.
          if (rms >= SPIKE_RMS) { void flag(); return }

          if (rms >= VOICE_FLAG_RMS) {
            flagSamplesRef.current += 1
            warnSamplesRef.current += 1
          } else if (rms >= VOICE_WARN_RMS) {
            warnSamplesRef.current += 1
            flagSamplesRef.current = 0
          } else {
            warnSamplesRef.current = 0
            flagSamplesRef.current = 0
            return
          }

          // Tier 2: sustained clear talking → flag.
          if (flagSamplesRef.current >= FLAG_SAMPLES) { void flag(); return }

          // Tier 1: sustained murmur → soft toast (no flag).
          const now = performance.now()
          if (warnSamplesRef.current >= WARN_SAMPLES && now - lastWarnAtRef.current >= WARN_COOLDOWN_MS) {
            lastWarnAtRef.current = now
            toast.warning("Please keep quiet — talking may be flagged.", {
              id: "proctor-warn-talking",
              duration: 4000,
            })
          }
        }, ANALYSIS_INTERVAL_MS)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      proctorSignals.audioRms = 0
      if (intervalId) clearInterval(intervalId)
      stream?.getTracks().forEach((t: any) => t.stop())
      audioCtx?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  return null
}
