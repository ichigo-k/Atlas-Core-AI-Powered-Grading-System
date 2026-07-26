"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useViolationStore } from "@/lib/violation-store"
import { addViolation, tryAcquireFlagSlot } from "@/lib/violation-tracker"
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
const NOISE_WARN_RMS = 0.06   // sustained non-voice noise — "noisy surroundings" toast
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
const WARN_COOLDOWN_MS = 6000       // don't repeat the talking toast within this window
const NOISE_COOLDOWN_MS = 8000      // don't repeat the loud-noise toast within this window
const NOISE_WARN_SAMPLES = 5        // ~2s of sustained non-voice noise → "noisy surroundings" toast
const NOISE_WARN_COOLDOWN_MS = 15000 // don't nag about a noisy room too often

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

// ── Speech-recognition dead-man's switch ───────────────────────────────────
// SpeechRecognition existing is NOT the same as it working. In Chrome it needs
// a live connection to Google's speech service, so it goes silent on a flaky
// network, when the OS denies it audio, or when the student simply isn't
// speaking English (lang is fixed below). Previously any of those meant
// lastWordsAtRef never updated, wordsRecent was permanently false, and audio
// could never flag at all — the detector looked alive but was inert.
//
// So we prove it works before trusting it: if we observe this many consecutive
// ticks of clear, flag-level voice without the recognizer ever having produced
// a single word, we conclude it is not functioning and permanently fall back to
// the RMS gate. Once it HAS produced a word we know it works and never demote
// it — silent-but-voice-like audio is then genuine whispering, which is meant
// to stay in the toast-only tier.
const SPEECH_DEADMAN_SAMPLES = 15  // ~6s of clear talking with zero transcription
const RECOGNITION_RESTART_DELAY_MS = 400  // backoff so onend can't hot-loop start()

// ── Ambient noise calibration ───────────────────────────────────────────────
// Absolute RMS thresholds can't work across devices: a laptop's built-in mic in
// a quiet room and a hot USB mic in a lab differ by more than the entire gap
// between our warn and flag levels. We sample the room before enforcing
// anything and scale the thresholds off the measured floor, keeping the
// constants above as a lower bound so a deliberately noisy calibration can't
// raise the bar indefinitely.
const CALIBRATION_MS = 2500
const CALIBRATION_CEILING = 2   // floor can lift thresholds by at most this factor

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
  const noiseSamplesRef = useRef(0)          // consecutive sustained-noise ticks
  const lastBgNoiseAtRef = useRef(-Infinity)
  const lastWordsAtRef = useRef(-Infinity)  // performance.now() of the last recognized word(s)

  // "unknown" → recognizer started but has never returned a word yet.
  // "working" → it has returned at least one word, so we trust its silence.
  // "unusable" → it errored fatally, or failed the dead-man's switch below.
  const recognitionStateRef = useRef<"unknown" | "working" | "unusable">("unknown")
  const noWordsStreakRef = useRef(0)

  // Measured ambient noise floor and the thresholds derived from it.
  const noiseFloorRef = useRef<number | null>(null)

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
    let restartTimer: ReturnType<typeof setTimeout> | null = null

    // Per-session detector state — recalibrate and re-prove the recognizer on
    // every (re)mount rather than inheriting stale values from a previous run.
    noiseFloorRef.current = null
    recognitionStateRef.current = "unknown"
    noWordsStreakRef.current = 0

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
        // Follow the page/browser language rather than pinning to en-US. A
        // student speaking anything else would otherwise produce no transcript,
        // which used to mean their talking could never be flagged — and now
        // (with the dead-man's switch) would drop them to the blunter RMS gate.
        // Matching their actual language keeps the accurate detector in play.
        recognition.lang =
          document.documentElement.lang || navigator.language || "en-US"
        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript?.trim() ?? ""
            if (transcript.length >= MIN_TRANSCRIPT_CHARS) {
              lastWordsAtRef.current = performance.now()
              // Proof of life — from here on, silence really does mean silence.
              recognitionStateRef.current = "working"
              noWordsStreakRef.current = 0
            }
          }
        }
        recognition.onerror = (event: any) => {
          // These are terminal for the session: the service will not start
          // producing results later, so stop pretending it might and hand the
          // flag decision back to the RMS gate immediately.
          if (
            event?.error === "not-allowed" ||
            event?.error === "service-not-allowed" ||
            event?.error === "audio-capture"
          ) {
            recognitionStateRef.current = "unusable"
          }
        }
        recognition.onend = () => {
          // The browser ends recognition after each silence gap, so restarting
          // is normal — but restart on a timer, never synchronously. A failing
          // recognizer fires end immediately after start, and an unbounded
          // start-in-onend loop spins the main thread for the whole exam.
          if (cancelled) return
          restartTimer = setTimeout(() => {
            if (cancelled) return
            try { recognition.start() } catch { /* already running */ }
          }, RECOGNITION_RESTART_DELAY_MS)
        }
        recognition.start()
      } catch {
        recognition = null
      }
    }

    // Capture RAW audio. The browser defaults (autoGainControl,
    // noiseSuppression, echoCancellation all ON) are tuned to make a voice call
    // sound good, which is precisely wrong for measurement:
    //  - autoGainControl continuously renormalises level, so the same speech
    //    reads at wildly different RMS depending on what came before it — fixed
    //    thresholds stop meaning anything.
    //  - noiseSuppression is designed to strip everything that isn't the
    //    nearest speaker, which is exactly the second voice we want to catch.
    //  - echoCancellation subtracts the output signal and can take part of a
    //    room voice with it.
    // These are best-effort hints; a browser that ignores them still works,
    // just with the noisier behaviour calibration below is there to absorb.
    navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: false,
        noiseSuppression: false,
        echoCancellation: false,
      },
      video: false,
    })
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
          // Respect the cross-source cooldown — a student who turns away while
          // talking should not be charged for both GAZE_AWAY and
          // TALKING_DETECTED from the same moment. Leaving the sample counters
          // intact means the next tick retries rather than losing the streak.
          if (!tryAcquireFlagSlot(attemptId)) return
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

        // Ambient samples collected during the calibration window.
        const calibrationSamples: number[] = []
        const startedAt = performance.now()

        intervalId = setInterval(() => {
          if (cancelled) return
          const rms = getRMS()
          // Always publish the level so the camera can do "mouth moving but silent".
          proctorSignals.audioRms = rms

          const now = performance.now()

          // ── Calibration window: listen, don't judge ────────────────────────
          if (noiseFloorRef.current === null) {
            // Only sample the ROOM. Without this, a student could simply talk
            // through the calibration window to raise their own noise floor and
            // walk the thresholds up for the rest of the exam.
            if (!isVoiceLike()) calibrationSamples.push(rms)
            if (now - startedAt < CALIBRATION_MS) return
            // Median rather than mean so one cough or door slam during setup
            // can't inflate the floor for the whole exam. If every sample was
            // voice-shaped we have no clean reading at all — fall back to the
            // tuned constants rather than trusting a polluted measurement.
            const sorted = [...calibrationSamples].sort((a, b) => a - b)
            noiseFloorRef.current = sorted.length
              ? sorted[Math.floor(sorted.length / 2)]
              : 0
            return
          }

          // Thresholds scale with the room, but only upward and only up to
          // CALIBRATION_CEILING — a student can't whisper their way under the
          // limit by running a fan, and a quiet room never gets a lower bar
          // than the tuned constants.
          const scale = Math.min(
            CALIBRATION_CEILING,
            Math.max(1, noiseFloorRef.current / VOICE_WARN_RMS),
          )
          const voiceWarnRms = VOICE_WARN_RMS * scale
          const voiceFlagRms = VOICE_FLAG_RMS * scale
          const noiseWarnRms = NOISE_WARN_RMS * scale
          const noiseToastRms = NOISE_TOAST_RMS * scale

          const vs = useViolationStore.getState()
          // Ignore while our own overlay is up (flaggedRef), while submitting, or
          // while ANY other violation overlay is showing.
          if (flaggedRef.current || vs.submitting || vs.activeEvent) return

          const voice = rms >= voiceWarnRms && isVoiceLike()

          // Not voice-shaped (bang, dropped object, fan, chatter across the room)
          // — toast tiers only, never flags.
          if (!voice) {
            warnSamplesRef.current = 0
            flagSamplesRef.current = 0

            // Sudden loud burst — instant toast.
            if (rms >= noiseToastRms && now - lastNoiseAtRef.current >= NOISE_COOLDOWN_MS) {
              lastNoiseAtRef.current = now
              noiseSamplesRef.current = 0
              toast.warning("Loud noise detected.", {
                id: "proctor-warn-noise",
                duration: 4000,
              })
              return
            }

            // Sustained moderate background noise — nudge them to a quieter place.
            if (rms >= noiseWarnRms) {
              noiseSamplesRef.current += 1
            } else {
              noiseSamplesRef.current = 0
            }
            if (
              noiseSamplesRef.current >= NOISE_WARN_SAMPLES &&
              now - lastBgNoiseAtRef.current >= NOISE_WARN_COOLDOWN_MS
            ) {
              lastBgNoiseAtRef.current = now
              toast.warning("Your surroundings are noisy — please move somewhere quieter.", {
                id: "proctor-warn-bg-noise",
                duration: 4000,
              })
            }
            return
          }

          // Voice-shaped from here on — reset the background-noise streak.
          noiseSamplesRef.current = 0
          warnSamplesRef.current += 1

          // Only recognized words (from SpeechRecognition) count toward a flag.
          // Voice-like sound with no recognized words — whispering, humming,
          // murmuring to yourself — stays in the toast-only tier forever.
          //
          // But that leniency is only safe while the recognizer is actually
          // transcribing. If it is absent, errored, or has failed the dead-man's
          // switch, we fall back to the RMS gate so talking still flags.
          const speechUsable = recognition !== null && recognitionStateRef.current !== "unusable"

          // Dead-man's switch: clear, flag-level, voice-shaped audio that the
          // recognizer has never once transcribed means it isn't working.
          if (speechUsable && recognitionStateRef.current === "unknown") {
            if (rms >= voiceFlagRms) {
              noWordsStreakRef.current += 1
              if (noWordsStreakRef.current >= SPEECH_DEADMAN_SAMPLES) {
                recognitionStateRef.current = "unusable"
              }
            }
          }

          const wordsRecent = speechUsable && recognitionStateRef.current !== "unusable"
            ? now - lastWordsAtRef.current <= RECOGNIZED_WORDS_WINDOW_MS
            : rms >= voiceFlagRms

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
      if (restartTimer) clearTimeout(restartTimer)
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
