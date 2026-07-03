"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useViolationStore } from "@/lib/violation-store"
import { addViolation } from "@/lib/violation-tracker"
import { proctorSignals } from "@/lib/proctor-signals"
import { findVirtualDevice } from "@/lib/device-integrity"

// Re-flag a detected virtual mic on this cadence for as long as it stays in
// use — mirrors ProctorCamera's virtual-device handling (see that file for
// why: onboarding only catches a swap at setup time, not mid-exam).
const VIRTUAL_DEVICE_REFLAG_MS = 15000

// ── Audio tiers (RMS, 0–1) ─────────────────────────────────────────────────
// RMS alone can't tell talking from a door slam or a dropped pen, so loudness
// only *gates* analysis — a tick counts toward warnings/flags only when the
// spectrum also looks like human voice (see isVoiceLike below).
const VOICE_WARN_RMS = 0.012  // faint murmur — soft toast only (sharp Tier 1)
const VOICE_FLAG_RMS = 0.03   // clear talking level — can flag
const NOISE_TOAST_RMS = 0.20  // sudden loud non-voice burst — toast only, never flags
const ANALYSIS_INTERVAL_MS = 400

// ── Voice classification (spectral shape) ──────────────────────────────────
// Human speech energy is concentrated in ~85–3000 Hz (fundamentals + formants
// dominate 100–1000 Hz), and voiced sound is harmonic — low spectral flatness.
// Broadband bangs and fan hiss are spectrally flat and/or spread outside the
// speech band, so they fail one of these tests.
const SPEECH_BAND_LO_HZ = 85
const SPEECH_BAND_HI_HZ = 3000
const SPEECH_RATIO_MIN = 0.55   // fraction of total energy inside the speech band
const FLATNESS_MAX = 0.35       // geometric/arithmetic mean of band magnitudes — voice is tonal

// Sustained-sample requirements (× ANALYSIS_INTERVAL_MS).
const WARN_SAMPLES = 2   // ~0.8s of voice in the warn band → toast (snappy)
const FLAG_SAMPLES = 8   // ~3.2s of sustained clear talking → flag (lenient)
const WARN_COOLDOWN_MS = 6000   // don't repeat the talking toast within this window
const NOISE_COOLDOWN_MS = 8000  // don't repeat the loud-noise toast within this window

// ── Speech recognition (actual words) ───────────────────────────────────────
// The spectral test only tells us "this sounds like a voice" — it can't tell
// whispering from clearly-spoken talking. The Web Speech API transcribes real
// words, so we use it as the deciding vote: recognized words → the flag path;
// voice-like sound with no recognized words (whispering, humming, murmuring)
// is capped at the soft toast and can never accumulate into a flag. Browsers
// without SpeechRecognition (e.g. Firefox) fall back to spectral-only voice
// detection so flagging still works, just without the whisper leniency.
const RECOGNIZED_WORDS_WINDOW_MS = 2500  // how long a heard word "counts" for the current tick
const MIN_TRANSCRIPT_CHARS = 3           // ignore 1–2 char hallucinated fragments

interface Props {
  attemptId: number
}

export default function ProctorAudio({ attemptId }: Props) {
  const { recordViolation, syncCount, showFinalWarning, activeEvent } = useViolationStore()
  const [virtualDevice, setVirtualDevice] = useState<string | null>(null)

  const flaggedRef = useRef(false)   // an overlay is up — don't re-flag until dismissed
  const warnSamplesRef = useRef(0)
  const flagSamplesRef = useRef(0)
  const lastWarnAtRef = useRef(-Infinity)
  const lastNoiseAtRef = useRef(-Infinity)
  const lastWordsAtRef = useRef(-Infinity)  // performance.now() of the last recognized word(s)

  // Reset when the student dismisses the overlay (acts as the re-flag cooldown).
  useEffect(() => {
    if (activeEvent === null) {
      flaggedRef.current = false
      warnSamplesRef.current = 0
      flagSamplesRef.current = 0
    }
  }, [activeEvent])

  // ── Virtual mic re-flagging ────────────────────────────────────────────────
  // Hard, unambiguous signal — flag immediately, then keep re-flagging on a
  // cadence for as long as the virtual mic stays in use.
  useEffect(() => {
    if (!virtualDevice) return
    let cancelled = false
    async function flagVirtual() {
      const s = useViolationStore.getState()
      if (s.submitting || s.activeEvent) return
      const optimistic = useViolationStore.getState().count + 1
      recordViolation({ type: "VIRTUAL_DEVICE_DETECTED", flagCountAfter: optimistic, source: "CLIENT" })
      const { count: serverCount, willAutoSubmit } = await addViolation(attemptId, "VIRTUAL_DEVICE_DETECTED")
      if (cancelled) return
      syncCount(serverCount)
      if (willAutoSubmit) showFinalWarning()
    }
    void flagVirtual()
    const id = setInterval(() => { void flagVirtual() }, VIRTUAL_DEVICE_REFLAG_MS)
    return () => { cancelled = true; clearInterval(id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualDevice, attemptId])

  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null
    let recognition: any = null

    // Speech-to-text runs independently of the analyser loop — it just stamps
    // lastWordsAtRef whenever it hears actual words. Restarts itself on "end"
    // (the browser stops it after a silence gap) until the effect is cleaned up.
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognitionCtor) {
      try {
        recognition = new SpeechRecognitionCtor()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"
        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript?.trim() ?? ""
            if (transcript.length >= MIN_TRANSCRIPT_CHARS) {
              lastWordsAtRef.current = performance.now()
            }
          }
        }
        recognition.onerror = () => {}
        recognition.onend = () => {
          if (!cancelled) { try { recognition.start() } catch { /* already running */ } }
        }
        recognition.start()
      } catch {
        recognition = null
      }
    }

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t: any) => t.stop()); return }
        const virtual = findVirtualDevice(s)
        if (virtual) {
          // Onboarding already screens for this, but the student can swap
          // their OS default mic after passing it and before this stream is
          // acquired — check again here.
          s.getTracks().forEach((t: any) => t.stop())
          setVirtualDevice(virtual)
          toast.error("Virtual microphone detected — this will keep being flagged until you switch to a physical device.", {
            id: "proctor-virtual-mic",
            duration: 8000,
          })
          return
        }
        stream = s
        proctorSignals.micStream = s

        audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048  // fine enough bins to resolve the speech band
        audioCtx.createMediaStreamSource(stream).connect(analyser)

        const timeDomain = new Float32Array(analyser.fftSize)
        const freqDomain = new Float32Array(analyser.frequencyBinCount)

        // Bin index for a frequency: bin = freq / (sampleRate / fftSize).
        const binHz = audioCtx.sampleRate / analyser.fftSize
        const bandLo = Math.max(1, Math.round(SPEECH_BAND_LO_HZ / binHz))
        const bandHi = Math.min(analyser.frequencyBinCount - 1, Math.round(SPEECH_BAND_HI_HZ / binHz))

        function getRMS(): number {
          analyser.getFloatTimeDomainData(timeDomain)
          let sumSq = 0
          for (let i = 0; i < timeDomain.length; i++) sumSq += timeDomain[i] * timeDomain[i]
          return Math.sqrt(sumSq / timeDomain.length)
        }

        // Spectral test: enough of the energy in the speech band, and the band
        // itself harmonic (low flatness) rather than noise-flat.
        function isVoiceLike(): boolean {
          analyser.getFloatFrequencyData(freqDomain)  // dB values
          let totalEnergy = 0
          let bandEnergy = 0
          let logSum = 0
          let linSum = 0
          for (let i = 1; i < freqDomain.length; i++) {
            const mag = Math.pow(10, freqDomain[i] / 20)  // dB → linear magnitude
            const energy = mag * mag
            totalEnergy += energy
            if (i >= bandLo && i <= bandHi) {
              bandEnergy += energy
              logSum += Math.log(mag + 1e-12)
              linSum += mag
            }
          }
          if (totalEnergy <= 0) return false
          const bandCount = bandHi - bandLo + 1
          const speechRatio = bandEnergy / totalEnergy
          // Spectral flatness = geometric mean / arithmetic mean of band magnitudes.
          const geoMean = Math.exp(logSum / bandCount)
          const ariMean = linSum / bandCount
          const flatness = ariMean > 0 ? geoMean / ariMean : 1
          return speechRatio >= SPEECH_RATIO_MIN && flatness <= FLATNESS_MAX
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

          const now = performance.now()
          const voice = rms >= VOICE_WARN_RMS && isVoiceLike()

          // Loud but not voice-shaped (bang, dropped object) — soft toast only.
          if (!voice) {
            warnSamplesRef.current = 0
            flagSamplesRef.current = 0
            if (rms >= NOISE_TOAST_RMS && now - lastNoiseAtRef.current >= NOISE_COOLDOWN_MS) {
              lastNoiseAtRef.current = now
              toast.warning("Loud noise detected.", {
                id: "proctor-warn-noise",
                duration: 4000,
              })
            }
            return
          }

          warnSamplesRef.current += 1

          // Only recognized words (from SpeechRecognition) count toward a flag.
          // Voice-like sound with no recognized words — whispering, humming,
          // murmuring to yourself — stays in the toast-only tier forever. When
          // SpeechRecognition isn't supported, recognition is null and we fall
          // back to the old RMS-only gate so flagging still works.
          const wordsRecent = recognition
            ? now - lastWordsAtRef.current <= RECOGNIZED_WORDS_WINDOW_MS
            : rms >= VOICE_FLAG_RMS

          if (wordsRecent) {
            flagSamplesRef.current += 1
          } else {
            flagSamplesRef.current = 0
          }

          // Tier 2: sustained clear talking → flag.
          if (flagSamplesRef.current >= FLAG_SAMPLES) { void flag(); return }

          // Tier 1: sustained murmur → soft toast (no flag).
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
      proctorSignals.micStream = null
      if (intervalId) clearInterval(intervalId)
      stream?.getTracks().forEach((t: any) => t.stop())
      audioCtx?.close()
      if (recognition) {
        recognition.onend = null  // don't let the cleared cancelled flag race a restart
        try { recognition.stop() } catch { /* already stopped */ }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  return null
}
