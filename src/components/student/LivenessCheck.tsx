"use client";

/**
 * LivenessCheck — a short random-gesture challenge shown once during
 * onboarding, right before a student can start a proctored exam. Defeats
 * static-photo / pre-recorded-video / mask spoofing of the camera check by
 * asking the student to perform 1–2 randomly chosen hand gestures
 * (e.g. "make a fist", "hold up two fingers") that a static image cannot
 * satisfy. Hand gestures are large and unambiguous, so they detect far more
 * reliably than subtle facial expressions.
 *
 * Runs entirely client-side via the shared MediaPipe Gesture Recognizer
 * (src/lib/model-cache.ts) — no server round-trip, no cost. Reuses the
 * camera stream already opened by the onboarding camera-check step
 * (proctorSignals.cameraStream) when available, falling back to its own
 * getUserMedia call (the browser silently reuses the already-granted
 * permission, so this is not a second prompt).
 *
 * Design choice — never hard-blocks a legitimate student:
 * Face-blendshape detection can produce false negatives from poor lighting,
 * low camera quality, or glasses interfering with eye-region scores. Wrongly
 * locking a real student out of their exam is a much worse outcome than an
 * occasional missed liveness check, so an inconclusive/failed result still
 * calls onPass() (never a hard stop) — but flags `inconclusive: true` so the
 * caller can log a soft note (e.g. an audit trail entry) without blocking
 * the flow. `onInconclusive` is an optional extra hook for callers that want
 * to react to that case beyond just receiving the flag.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { getGestureRecognizer } from "@/lib/model-cache";
import { proctorSignals } from "@/lib/proctor-signals";
import { pickRandomChallenge, gestureMatches, type Gesture } from "@/lib/liveness-gestures";

const CHALLENGE_COUNT: 1 | 2 = Math.random() < 0.5 ? 1 : 2;
const STEP_TIMEOUT_MS = 5500;
const SUSTAIN_MS = 500; // gesture must hold true for this long before counting as detected
const MAX_RETRIES_PER_STEP = 2;

type StepPhase = "pending" | "active" | "done";
type OverallPhase = "loading" | "running" | "passed" | "inconclusive" | "error";

interface Props {
  onPass: (result?: { inconclusive: boolean }) => void;
  onInconclusive?: () => void;
  onSkip?: () => void;
}

export default function LivenessCheck({ onPass, onInconclusive, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(false);

  const [phase, setPhase] = useState<OverallPhase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Challenge state
  const challengeRef = useRef(pickRandomChallenge(CHALLENGE_COUNT));
  const [stepIndex, setStepIndex] = useState(0);
  const [stepPhase, setStepPhase] = useState<StepPhase>("pending");
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(STEP_TIMEOUT_MS / 1000));
  const retriesRef = useRef(0);

  const currentGesture: Gesture | undefined = challengeRef.current.steps[stepIndex];

  // ── Acquire a camera stream — reuse the shared one if a sibling step
  // already has the camera open, otherwise request our own. ──────────────────
  useEffect(() => {
    let cancelled = false;

    async function acquire() {
      if (proctorSignals.cameraStream) {
        streamRef.current = proctorSignals.cameraStream;
        ownsStreamRef.current = false;
        return true;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return false;
        }
        streamRef.current = stream;
        ownsStreamRef.current = true;
        return true;
      } catch {
        return false;
      }
    }

    acquire().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setErrorMsg("Camera access is required for the liveness check.");
        setPhase("error");
        return;
      }
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      // Only stop tracks we opened ourselves — never tear down a stream a
      // sibling proctoring component (e.g. ProctorCamera) still owns.
      if (ownsStreamRef.current) streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Advance to the next step, or finish if this was the last one ──────────
  const advanceStep = useCallback(() => {
    retriesRef.current = 0;
    setStepIndex((i) => {
      const next = i + 1;
      if (next >= challengeRef.current.steps.length) {
        setPhase("passed");
        return i;
      }
      setStepPhase("pending");
      setSecondsLeft(Math.ceil(STEP_TIMEOUT_MS / 1000));
      return next;
    });
  }, []);

  // Once fully passed, notify the caller.
  useEffect(() => {
    if (phase === "passed") onPass({ inconclusive: false });
  }, [phase, onPass]);

  useEffect(() => {
    if (phase === "inconclusive") {
      onInconclusive?.();
      onPass({ inconclusive: true });
    }
  }, [phase, onInconclusive, onPass]);

  // ── Per-step countdown + timeout/retry handling ────────────────────────────
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase !== "running" || !currentGesture) return;
    setStepPhase("active");
    setSecondsLeft(Math.ceil(STEP_TIMEOUT_MS / 1000));

    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      if (retriesRef.current < MAX_RETRIES_PER_STEP) {
        retriesRef.current += 1;
        setSecondsLeft(Math.ceil(STEP_TIMEOUT_MS / 1000)); // fresh countdown, same gesture
      } else {
        setPhase("inconclusive");
      }
    }, STEP_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, retriesRef.current]);

  // ── MediaPipe hand-gesture detection loop ───────────────────────────────────
  useEffect(() => {
    if (phase !== "loading" && phase !== "running") return;
    let cancelled = false;
    let animFrame: number;
    let lastVideoTime = -1;
    let sustainSince: number | null = null;

    async function loadAndRun() {
      try {
        const recognizer = await getGestureRecognizer();
        if (cancelled) return;
        setPhase((p) => (p === "loading" ? "running" : p));

        function run(timestamp: DOMHighResTimeStamp) {
          if (cancelled) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2 || !video.videoWidth) {
            animFrame = requestAnimationFrame(run);
            return;
          }
          if (video.currentTime === lastVideoTime) {
            animFrame = requestAnimationFrame(run);
            return;
          }
          lastVideoTime = video.currentTime;

          try {
            const result = recognizer.recognizeForVideo(video, timestamp);
            const gesture = challengeRef.current.steps[stepIndexRef.current];
            // result.gestures is one entry per detected hand; each is a ranked
            // list of category candidates. We use the single top candidate of
            // the first (and only — numHands: 1) hand.
            const top = result.gestures?.[0]?.[0];
            const matches = gesture && gestureMatches(gesture, top?.categoryName, top?.score);
            const now = performance.now();
            if (matches) {
              if (sustainSince === null) sustainSince = now;
              if (now - sustainSince >= SUSTAIN_MS) {
                sustainSince = null;
                onGestureDetectedRef.current();
              }
            } else {
              sustainSince = null;
            }
          } catch {
            // ignore single-frame detection errors
          }

          animFrame = requestAnimationFrame(run);
        }

        animFrame = requestAnimationFrame(run);
      } catch (err) {
        console.error("[LivenessCheck] MediaPipe load error:", err);
        if (!cancelled) {
          setErrorMsg("Could not load the liveness check. You may proceed.");
          setPhase("inconclusive");
        }
      }
    }

    loadAndRun();
    return () => {
      cancelled = true;
      if (animFrame) cancelAnimationFrame(animFrame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "loading"]);

  // Refs so the long-lived rAF loop (mounted once) always sees the latest
  // step index / callback without needing to restart the loop each step.
  const stepIndexRef = useRef(stepIndex);
  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  const onGestureDetectedRef = useRef(() => {});
  useEffect(() => {
    onGestureDetectedRef.current = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      setStepPhase("done");
      // Brief pause so the student sees the "done" confirmation before the
      // next instruction replaces it.
      setTimeout(() => advanceStep(), 500);
    };
  }, [advanceStep]);

  const totalSteps = challengeRef.current.steps.length;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">Liveness check</h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Show the hand gesture below to the camera to confirm you're a real person.
        Keep your hand clearly in view.
      </p>

      <div className="relative mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-sm bg-[#1e293b]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {phase === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1e293b]/90 text-slate-300">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-[12px] font-semibold">Loading liveness check…</span>
          </div>
        )}

        {phase === "running" && currentGesture && (
          <>
            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              <span className="rounded-sm bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm">
                Step {stepIndex + 1} of {totalSteps}
              </span>
            </div>

            <div className="absolute top-3 right-3">
              <div
                className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
                  stepPhase === "done"
                    ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-300"
                    : "border-slate-500/40 bg-slate-900/80 text-slate-200"
                }`}
              >
                {stepPhase === "done" ? (
                  <>
                    <Check size={11} /> Detected!
                  </>
                ) : (
                  <>
                    <ScanFace size={11} /> {secondsLeft}s
                  </>
                )}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10">
              <p className="text-center text-[14px] font-bold text-white">
                {currentGesture.instruction}
              </p>
            </div>
          </>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1e293b]/90 text-red-300">
            <AlertTriangle size={24} />
            <span className="text-[12px] font-semibold">{errorMsg}</span>
          </div>
        )}
      </div>

      {phase === "inconclusive" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-sm border border-amber-100 bg-amber-50 p-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-[12px] font-bold text-amber-700 uppercase tracking-wider">
              Liveness check inconclusive
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700/80 font-semibold leading-relaxed">
              We couldn't confirm the gesture — this can happen with lighting, camera quality, or
              glasses. You may still proceed; this has been noted.
            </p>
          </div>
        </div>
      )}

      {phase === "passed" && (
        <div className="mb-4 flex items-center gap-2 px-1">
          <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
          <p className="text-[12px] font-semibold text-emerald-700">Liveness confirmed.</p>
        </div>
      )}

      {onSkip && (phase === "loading" || phase === "running") && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-auto self-start text-[11px] text-muted-foreground underline"
        >
          Skip (not recommended)
        </button>
      )}
    </div>
  );
}
