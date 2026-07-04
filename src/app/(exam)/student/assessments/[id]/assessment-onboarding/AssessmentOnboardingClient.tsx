"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  LockKeyhole,
  Mic,
  MicOff,
  Monitor,
  PlayCircle,
  ScanFace,
  ShieldCheck,
  Sun,
  SunDim,
  User,
  Volume2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createOrResumeAttempt } from "@/lib/assessment-actions";
import { createProctorSession } from "@/lib/proctor-session-actions";
import { MAX_VIOLATIONS } from "@/lib/violation-tracker";
import { findVirtualDevice } from "@/lib/device-integrity";
import { getBlazeFace } from "@/lib/model-cache";
import LivenessCheck from "@/components/student/LivenessCheck";

type CameraState = "idle" | "requesting" | "granted" | "denied" | "virtual";
type MicState = "idle" | "requesting" | "granted" | "denied" | "virtual";
type LightingStatus = "checking" | "ok" | "poor" | "unknown";
type FaceStatus = "checking" | "ok" | "absent" | "unknown";

interface Props {
  assessmentId: number;
  attemptId?: number | null;
  assessmentType: string;
  durationMinutes: number | null;
  passwordProtected: boolean;
  proctoringEnabled: boolean;
  instructions: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps definition — password step only included when needed
// ─────────────────────────────────────────────────────────────────────────────

function buildSteps(passwordProtected: boolean, proctoringEnabled: boolean, hasInstructions: boolean) {
  return [
    { label: "Important rules", icon: AlertTriangle },
    ...(hasInstructions ? [{ label: "Instructions", icon: BookOpen }] : []),
    { label: "General rules", icon: BookOpen },
    ...(passwordProtected ? [{ label: "Password", icon: LockKeyhole }] : []),
    { label: "Microphone", icon: Mic },
    ...(proctoringEnabled ? [{ label: "Camera check", icon: Camera }] : []),
    ...(proctoringEnabled ? [{ label: "Liveness check", icon: ScanFace }] : []),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile top progress bar
// ─────────────────────────────────────────────────────────────────────────────

function MobileProgress({
  current,
  steps,
}: {
  current: number;
  steps: { label: string; icon: React.ElementType }[];
}) {
  return (
    <div className="md:hidden px-4 pt-4 pb-3 border-b border-border bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
          Step {current + 1} of {steps.length}
        </span>
        <span className="text-[11px] font-semibold text-primary">{steps[current]?.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${((current + 1) / steps.length) * 100}%` }}
        />
      </div>
      {/* Step dots */}
      <div className="flex items-center gap-1.5 mt-2.5">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div
              key={s.label}
              className={`h-1.5 rounded-full transition-all duration-300 ${done ? "bg-primary flex-1" : active ? "bg-primary w-6" : "bg-slate-200 flex-1"
                }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Desktop Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({
  current,
  steps,
}: {
  current: number;
  steps: { label: string; icon: React.ElementType }[];
}) {
  return (
    <aside className="hidden md:flex w-48 shrink-0 flex-col gap-1 pt-1">
      <div className="flex items-center gap-2 mb-5 px-1">
        <ShieldCheck size={16} className="text-primary" strokeWidth={2} />
        <span className="text-[13px] font-semibold text-[#1e293b]">Assessment Setup</span>
      </div>

      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = s.icon;

        return (
          <div
            key={s.label}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-sm transition-all border ${active
              ? "bg-primary/10 text-primary border-primary/20"
              : "border-transparent text-slate-500"
              }`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold transition-all ${done
                ? "bg-primary text-white"
                : active
                  ? "bg-primary/20 text-primary"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}
            >
              {done ? <Check size={11} strokeWidth={3} /> : <Icon size={11} />}
            </div>

            <span
              className={`text-sm transition-colors ${active ? "font-medium text-[#1a73e8]" : done ? "font-medium text-[#5f6368]" : "text-[#5f6368]"
                }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Important rules
// ─────────────────────────────────────────────────────────────────────────────

function StepImportantRules({
  assessmentType,
  durationMinutes,
  onNext,
  onBack,
}: {
  assessmentType: string;
  durationMinutes: number | null;
  onNext: () => void;
  onBack?: () => void;
}) {
  const isSecured = assessmentType === "EXAM" || assessmentType === "QUIZ";

  const rules = [
    ...(isSecured
      ? [
        {
          icon: Monitor,
          title: "Fullscreen required",
          desc: `Exiting fullscreen is logged. ${MAX_VIOLATIONS} violations will auto-submit your attempt.`,
        },
        {
          icon: Eye,
          title: "No tab switching",
          desc: `Switching tabs or windows is logged. ${MAX_VIOLATIONS} total violations will auto-submit your attempt.`,
        },
      ]
      : []),
    ...(durationMinutes
      ? [
        {
          icon: Clock,
          title: `${durationMinutes}-minute time limit`,
          desc: "The assessment auto-submits when the timer reaches zero.",
        },
      ]
      : []),
    {
      icon: AlertTriangle,
      title: "No going back",
      desc: "Once submitted, you cannot change your answers.",
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">
        Before you begin
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Read these rules carefully — they are strictly enforced.
      </p>

      <div className="flex-1 space-y-4">
        {rules.map((rule, _i) => (
          <div key={rule.title} className="flex items-start gap-3">
            <rule.icon size={15} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="text-[12px] font-semibold text-red-700">{rule.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {rule.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-border flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors"
        >
          I understand
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Lecturer Instructions
// ─────────────────────────────────────────────────────────────────────────────

function StepInstructions({
  instructions,
  onNext,
  onBack,
}: {
  instructions: string;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">
        Lecturer Instructions
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Your lecturer has provided the following instructions for this assessment. Read them carefully.
      </p>

      <div className="flex-1">
        <div className="rounded-sm border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <BookOpen size={13} className="text-blue-700" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 pt-1.5">
              Assessment Instructions
            </p>
          </div>
          <div className="pl-10">
            <p className="text-[13px] text-[#1e293b] leading-relaxed whitespace-pre-wrap">
              {instructions}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors"
        >
          I&apos;ve read the instructions
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — General rules
// ─────────────────────────────────────────────────────────────────────────────

function StepGeneralRules({
  assessmentType,
  proctoringEnabled,
  onNext,
  onBack,
  isPending,
  error,
}: {
  assessmentType: string;
  proctoringEnabled: boolean;
  onNext: () => void;
  onBack: () => void;
  isPending?: boolean;
  error?: string | null;
}) {
  const isSecured = assessmentType === "EXAM" || assessmentType === "QUIZ";

  const rules = [
    ...(isSecured
      ? [
        {
          icon: ShieldCheck,
          title: "Copy & paste disabled",
          desc: "Copying, pasting, and right-clicking are disabled during the assessment.",
        },
      ]
      : []),
    {
      icon: CheckCircle2,
      title: "Auto-save enabled",
      desc: "Your answers are saved automatically as you type.",
    },
    {
      icon: Volume2,
      title: "Be in a quiet place",
      desc: "Your microphone will be monitored throughout the exam. Any talking or sustained noise will be flagged as a violation.",
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">
        General rules
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Additional guidelines for a fair assessment environment.
      </p>

      <div className="flex-1 space-y-4">
        {rules.map((rule, _i) => (
          <div key={rule.title} className="flex items-start gap-3">
            <rule.icon size={15} className="mt-0.5 shrink-0 text-slate-400" strokeWidth={2} />
            <div>
              <p className="text-[12px] font-semibold text-[#1e293b]">
                {rule.title}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {rule.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-border flex flex-col gap-3">
        {error && (
          <div className="flex items-start gap-2 rounded-sm border border-red-100 bg-red-50 p-2.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-[11px] font-semibold text-red-700">{error}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors disabled:opacity-60"
          >
            {isPending ? <><Loader2 size={13} className="animate-spin" />Starting…</> : <>Continue <ArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mic check step — shown for ALL exams
// ─────────────────────────────────────────────────────────────────────────────

function StepMicCheck({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const [micState, setMicState] = useState<MicState>("idle");
  const streamRef = useRef<MediaStream | null>(null);

  const [virtualLabel, setVirtualLabel] = useState<string | null>(null);

  const requestMic = useCallback(async () => {
    setMicState("requesting");
    setVirtualLabel(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const virtual = findVirtualDevice(stream);
      if (virtual) {
        stream.getTracks().forEach((t) => t.stop());
        setVirtualLabel(virtual);
        setMicState("virtual");
        return;
      }
      streamRef.current = stream;
      setMicState("granted");
    } catch {
      setMicState("denied");
    }
  }, []);

  useEffect(() => {
    requestMic();
    return () => {
      streamRef.current?.getTracks().forEach((t: any) => t.stop());
    };
  }, [requestMic]);

  const canContinue = micState === "granted";

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">Microphone check</h2>
      <p className="text-[12px] text-muted-foreground mb-6">
        Your microphone is required for all exams. Audio is monitored to enforce silence during the assessment.
      </p>

      <div className="flex-1 space-y-4">
        {/* Notice */}
        <div className="flex items-start gap-3 rounded-sm border border-amber-100 bg-amber-50 p-4">
          <Volume2 size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-[12px] font-bold text-amber-800 mb-1">Audio monitoring is active on all exams</p>
            <p className="text-[11px] text-amber-700/90 leading-relaxed">
              Your microphone will be recorded throughout the exam. Any talking, whispering, or sustained noise will be logged as a violation. Make sure you are in a quiet room before proceeding.
            </p>
          </div>
        </div>

        {/* Mic status */}
        <div className={`flex items-center gap-3 rounded-sm border p-4 transition-colors ${micState === "granted"
          ? "border-emerald-200 bg-emerald-50"
          : micState === "denied" || micState === "virtual"
            ? "border-red-200 bg-red-50"
            : "border-slate-200 bg-slate-50"
          }`}>
          {micState === "granted" ? (
            <Mic size={18} className="shrink-0 text-emerald-600" />
          ) : micState === "denied" || micState === "virtual" ? (
            <MicOff size={18} className="shrink-0 text-red-600" />
          ) : (
            <Loader2 size={18} className="shrink-0 text-slate-400 animate-spin" />
          )}
          <div>
            <p className={`text-[12px] font-bold ${micState === "granted" ? "text-emerald-700"
              : micState === "denied" || micState === "virtual" ? "text-red-700"
                : "text-slate-500"
              }`}>
              {micState === "granted" ? "Microphone access granted"
                : micState === "virtual" ? "Virtual microphone detected"
                  : micState === "denied" ? "Microphone access denied"
                    : micState === "requesting" ? "Requesting microphone access…"
                      : "Waiting for microphone…"}
            </p>
            {micState === "virtual" && (
              <p className="text-[11px] text-red-700/80 mt-0.5 leading-relaxed">
                “{virtualLabel}” is a virtual audio device and can't be used for a
                proctored exam. Disable it in your system's sound settings and use
                your computer's built-in or a physical microphone, then{" "}
                <button type="button" onClick={requestMic} className="underline font-semibold">try again</button>.
              </p>
            )}
            {micState === "denied" && (
              <p className="text-[11px] text-red-700/80 mt-0.5 leading-relaxed">
                Allow microphone access in your browser settings then{" "}
                <button type="button" onClick={requestMic} className="underline font-semibold">try again</button>.
              </p>
            )}
            {micState === "granted" && (
              <p className="text-[11px] text-emerald-700/80 mt-0.5">Ready. You may proceed.</p>
            )}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border flex items-center gap-2 mt-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue <ArrowRight size={13} />
        </button>
        {!canContinue && micState !== "requesting" && (
          <p className="text-[11px] text-muted-foreground ml-1">
            {micState === "virtual" ? "A physical microphone is required to proceed."
              : micState === "denied" ? "Microphone access is required to proceed."
                : "Waiting for microphone…"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Camera check
// ─────────────────────────────────────────────────────────────────────────────

function StepCameraCheck({
  onBack,
  onCancel,
  onProceed,
}: {
  onBack?: () => void;
  onCancel?: () => void;
  /** Advances to the liveness-check step. The exam itself is not started here —
   * the proctor session, fullscreen request, and navigation all happen at the
   * liveness step, so a spoofed camera can't skip straight into the exam. */
  onProceed: () => void;
}) {
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [lightingStatus, setLightingStatus] = useState<LightingStatus>("unknown");
  const [faceStatus, setFaceStatus] = useState<FaceStatus>("unknown");
  const [agreed, setAgreed] = useState(false);
  const [virtualLabel, setVirtualLabel] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestCamera = useCallback(async () => {
    setCameraState("requesting");
    setVirtualLabel(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const virtual = findVirtualDevice(stream);
      if (virtual) {
        stream.getTracks().forEach((t) => t.stop());
        setVirtualLabel(virtual);
        setCameraState("virtual");
        return;
      }
      streamRef.current = stream;
      setCameraState("granted");
    } catch {
      setCameraState("denied");
    }
  }, []);

  useEffect(() => {
    requestCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t: any) => t.stop());
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [requestCamera]);

  useEffect(() => {
    if (cameraState === "granted" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => { });
    }
  }, [cameraState]);

  // Local brightness check via canvas — no external service needed
  const checkLighting = useCallback((): "ok" | "poor" | "unknown" => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return "unknown";
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 48;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "unknown";
      ctx.drawImage(video, 0, 0, 64, 48);
      const data = ctx.getImageData(0, 0, 64, 48).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Perceived luminance
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avg = sum / (data.length / 4);
      return avg > 80 ? "ok" : "poor";
    } catch {
      return "unknown";
    }
  }, []);

  // BlazeFace face-presence check. Uses the shared model cache (see
  // src/lib/model-cache.ts) — the model is loaded once for the whole
  // session (often already warmed by ModelPrefetcher right after login) and
  // reused here, rather than reloaded per-component.
  const checkFace = useCallback(async (): Promise<"ok" | "absent" | "unknown"> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return "unknown";
    try {
      const model = await getBlazeFace();
      const predictions = await model.estimateFaces(video, false);
      return predictions.length > 0 ? "ok" : "absent";
    } catch {
      return "unknown";
    }
  }, []);

  useEffect(() => {
    if (cameraState !== "granted") return;

    let firstRun = true;

    const run = async () => {
      if (firstRun) {
        setLightingStatus("checking");
        setFaceStatus("checking");
        firstRun = false;
      }
      const lighting = checkLighting();
      setLightingStatus(lighting === "unknown" ? "checking" : lighting);

      const face = await checkFace();
      if (face !== "unknown") setFaceStatus(face);
    };

    run();
    pollingRef.current = setInterval(run, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [cameraState, checkLighting, checkFace]);

  const lightingOk = lightingStatus === "ok";
  const faceOk = faceStatus === "ok";
  const checksComplete = lightingOk && faceOk;
  const canProceed = agreed && cameraState === "granted" && checksComplete;

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">Camera check</h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Make sure your camera is clear, lighting is good, and your face is visible.
      </p>

      <div className="relative mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-sm bg-[#1e293b]">
        {cameraState === "granted" ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />

            {/* Live dot */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              <span className="rounded-sm bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm">
                Live
              </span>
            </div>

            {/* Status badges */}
            <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
              <div className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors ${lightingStatus === "checking" ? "border-slate-500/40 bg-slate-900/80 text-slate-200"
                : lightingOk ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-300"
                  : "border-amber-500/40 bg-amber-950/80 text-amber-300"
                }`}>
                {lightingStatus === "checking" ? <><Loader2 size={11} className="animate-spin" /> Checking…</>
                  : lightingOk ? <><Sun size={11} /> Good lighting</>
                    : <><SunDim size={11} /> Too dark</>}
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors ${faceStatus === "checking" ? "border-slate-500/40 bg-slate-900/80 text-slate-200"
                : faceOk ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-300"
                  : faceStatus === "absent" ? "border-red-500/40 bg-red-950/80 text-red-300"
                    : "border-slate-500/40 bg-slate-900/80 text-slate-200"
                }`}>
                {faceStatus === "checking" ? <><Loader2 size={11} className="animate-spin" /> Detecting face…</>
                  : faceOk ? <><User size={11} /> Face detected</>
                    : faceStatus === "absent" ? <><User size={11} /> No face detected</>
                      : <><Loader2 size={11} className="animate-spin" /> Detecting face…</>}
              </div>
            </div>
          </>
        ) : cameraState === "virtual" ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <CameraOff size={28} />
            <span className="text-[12px] font-semibold">Virtual camera detected</span>
          </div>
        ) : cameraState === "denied" ? (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <CameraOff size={28} />
            <span className="text-[12px] font-semibold">Camera unavailable</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-[12px] font-semibold">Requesting camera access…</span>
          </div>
        )}
      </div>

      <div className="mb-4 space-y-2.5">
        {cameraState === "virtual" && (
          <div className="flex items-start gap-2.5 rounded-sm border border-red-100 bg-red-50 p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="text-[12px] font-bold text-red-700 uppercase tracking-wider">Virtual camera not allowed</p>
              <p className="mt-0.5 text-[11px] text-red-700/80 font-semibold leading-relaxed">
                “{virtualLabel}” is a virtual camera and can't be used for a proctored
                exam. Close it and use your device's built-in or a physical webcam,
                then{" "}
                <button type="button" onClick={requestCamera} className="underline">try again</button>.
              </p>
            </div>
          </div>
        )}
        {cameraState === "denied" && (
          <div className="flex items-start gap-2.5 rounded-sm border border-red-100 bg-red-50 p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="text-[12px] font-bold text-red-700 uppercase tracking-wider">Camera access required</p>
              <p className="mt-0.5 text-[11px] text-red-700/80 font-semibold leading-relaxed">
                Allow camera access in your browser settings and refresh the page.
              </p>
            </div>
          </div>
        )}
        {lightingStatus === "poor" && (
          <div className="flex items-start gap-2.5 rounded-sm border border-amber-100 bg-amber-50 p-3">
            <SunDim size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[12px] font-bold text-amber-700 uppercase tracking-wider">Poor lighting</p>
              <p className="mt-0.5 text-[11px] text-amber-700/80 font-semibold leading-relaxed">
                Move to a brighter area or turn on more lights before starting.
              </p>
            </div>
          </div>
        )}
        {faceStatus === "absent" && (
          <div className="flex items-start gap-2.5 rounded-sm border border-red-100 bg-red-50 p-3">
            <User size={14} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <p className="text-[12px] font-bold text-red-700 uppercase tracking-wider">Face not detected</p>
              <p className="mt-0.5 text-[11px] text-red-700/80 font-semibold leading-relaxed">
                Position your face clearly in front of the camera before starting.
              </p>
            </div>
          </div>
        )}
        {cameraState === "granted" && checksComplete && (
          <div className="flex items-center gap-2 px-1">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
            <p className="text-[12px] font-semibold text-emerald-700">
              Camera, lighting, and face verified.
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <button type="button" onClick={onBack}
              className="flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors">
              Back
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          )}
        </div>

        <label className="group flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="sr-only" />
          <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${agreed ? "border-primary bg-primary" : "border-border bg-white group-hover:border-primary"
            }`}>
            {agreed && <Check size={9} className="text-white" strokeWidth={3} />}
          </div>
          <span className="select-none text-[11px] leading-relaxed text-slate-500">
            I understand that my camera and microphone will be monitored for the duration of this exam and any violations will be logged.
          </span>
        </label>

        <button type="button" onClick={onProceed} disabled={!canProceed}
          className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#001570] disabled:cursor-not-allowed disabled:opacity-30 animate-in fade-in">
          Continue<ArrowRight size={13} />
        </button>

        {!canProceed && (
          <p className="text-[11px] text-muted-foreground">
            {cameraState === "virtual" ? "A physical camera is required to proceed."
              : cameraState === "denied" ? "Camera access is required to proceed."
              : lightingStatus === "poor" ? "Improve your lighting to continue."
                : faceStatus === "absent" ? "Position your face in front of the camera."
                  : lightingStatus === "checking" || faceStatus === "checking" ? "Running checks…"
                    : !agreed ? "Check the agreement box above to continue."
                      : "Waiting for camera…"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Liveness check step — shown after Camera check, right before entering the
// exam. Gates the actual exam-page navigation (see root's handleLivenessDone).
// ─────────────────────────────────────────────────────────────────────────────

function StepLivenessCheck({
  assessmentId,
  attemptId,
}: {
  assessmentId: number;
  attemptId: number;
}) {
  const router = useRouter();
  const [passed, setPassed] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The exam is only started once liveness is confirmed and the student
  // clicks "Start Exam" — this is where the proctor session is created,
  // fullscreen is requested (needs a fresh user gesture), and we navigate.
  async function handleStart() {
    setIsStarting(true);
    setError(null);

    const result = await createProctorSession(attemptId);
    if ("error" in result) {
      const messages: Record<string, string> = {
        UNAUTHORIZED: "You are not authorised to start this exam.",
        ATTEMPT_NOT_FOUND: "Your exam attempt could not be found.",
        ATTEMPT_NOT_IN_PROGRESS: "This attempt is no longer active.",
        DB_ERROR: "A server error occurred. Please try again.",
      };
      setError(messages[result.error] ?? "An unexpected error occurred.");
      setIsStarting(false);
      return;
    }

    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("[AssessmentOnboarding] Fullscreen request failed:", err);
    }

    router.push(`/student/assessments/${assessmentId}/attempt?attemptId=${attemptId}`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <LivenessCheck
        onPass={() => setPassed(true)}
        onInconclusive={() => {
          console.warn("[AssessmentOnboarding] Liveness check inconclusive", { assessmentId, attemptId });
        }}
      />

      {passed && (
        <div className="mt-auto space-y-3 pt-4 border-t border-border">
          {error && (
            <div className="flex items-start gap-2.5 rounded-sm border border-red-100 bg-red-50 p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
              <p className="text-[11px] font-semibold text-red-700">{error}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleStart}
            disabled={isStarting}
            className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#001570] disabled:cursor-not-allowed disabled:opacity-40 animate-in fade-in"
          >
            {isStarting ? (
              <><Loader2 size={13} className="animate-spin" />Starting…</>
            ) : (
              <><PlayCircle size={13} />Start Exam<ArrowRight size={13} /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Password (only when passwordProtected)
// ─────────────────────────────────────────────────────────────────────────────

function StepPassword({
  assessmentId,
  onBack,
  onSuccess,
}: {
  assessmentId: number;
  onBack: () => void;
  onSuccess: (attemptId: number) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOrResumeAttempt(assessmentId, password);

      if ("error" in result) {
        if (result.error === "INVALID_PASSWORD") {
          setError("Incorrect password. Please try again.");
        } else if (result.error === "SERVER_ERROR") {
          setError("A server error occurred. Please try again.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }
      onSuccess(result.attemptId);
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">
        Assessment password
      </h2>
      <p className="text-[12px] text-muted-foreground mb-6">
        This assessment is password-protected. Enter the password provided by
        your lecturer to begin.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            htmlFor="assessment-password"
          >
            Password
          </label>
          <input
            id="assessment-password"
            type="password"
            placeholder="Enter password…"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            disabled={isPending}
            className="w-full rounded-sm border border-border bg-white px-3 py-2 text-[12px] text-[#1e293b] placeholder-slate-400 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
          />
          {error && (
            <p className="text-[11px] text-red-700 flex items-center gap-1.5 mt-0.5">
              <AlertTriangle size={11} className="shrink-0" />
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={isPending || !password}
            className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <PlayCircle size={13} />
                Start Assessment
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function AssessmentOnboardingClient({
  assessmentId,
  attemptId,
  assessmentType,
  durationMinutes,
  passwordProtected,
  proctoringEnabled,
  instructions,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [createdAttemptId, setCreatedAttemptId] = useState<number | null>(
    attemptId ?? null,
  );
  const [generalNextPending, setGeneralNextPending] = useState(false);
  const [generalNextError, setGeneralNextError] = useState<string | null>(null);

  const hasInstructions = instructions.trim().length > 0;
  const steps = buildSteps(passwordProtected, proctoringEnabled, hasInstructions);
  const instructionsStepIndex = hasInstructions ? 1 : -1;
  const generalRulesStepIndex = hasInstructions ? 2 : 1;
  const passwordStepIndex = passwordProtected ? generalRulesStepIndex + 1 : -1;
  const micStepIndex = passwordProtected ? passwordStepIndex + 1 : generalRulesStepIndex + 1;
  const proctorStepIndex = proctoringEnabled ? micStepIndex + 1 : -1;
  const livenessStepIndex = proctoringEnabled ? proctorStepIndex + 1 : -1;
  const resolvedAttemptId = createdAttemptId;

  async function handleGeneralRulesNext() {
    if (passwordProtected) {
      setStep(passwordStepIndex);
      return;
    }

    // For non-password assessments, create the attempt now if not already created.
    // This covers both proctored and non-proctored paths.
    let currentAttemptId = resolvedAttemptId;
    if (currentAttemptId == null) {
      setGeneralNextPending(true);
      setGeneralNextError(null);
      const result = await createOrResumeAttempt(assessmentId);
      setGeneralNextPending(false);
      if ("error" in result) {
        setGeneralNextError("Could not start attempt. Please try again.");
        return;
      }
      currentAttemptId = result.attemptId;
      setCreatedAttemptId(currentAttemptId);
    }

    setStep(micStepIndex);
  }

  function handlePasswordSuccess(newAttemptId: number) {
    setCreatedAttemptId(newAttemptId);
    setStep(micStepIndex);
  }

  return (
    <div className="min-h-dvh bg-[#F8F9FA] flex flex-col">
      {/* Navbar */}
      <header className="h-12 bg-primary dark:bg-[#002388] flex items-center justify-between px-4 sm:px-6 w-full shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logos/gctu-logo.png"
            alt="GCTU Logo"
            width={32}
            height={32}
            className="rounded-full object-cover flex-shrink-0"
            priority
          />
          <div className="leading-tight text-left">
            <div className="text-white font-semibold text-[13px]">GCTU Exam Portal</div>
            <div className="text-white/55 text-[9.5px] hidden sm:block">
              Ghana Communication Technology University
            </div>
          </div>
        </div>
        <Link
          href="/student/assessments"
          className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-sm text-[12px] font-semibold text-white transition-colors border border-white/10"
        >
          Exit Setup
        </Link>
      </header>

      {/* Mobile progress bar */}
      <MobileProgress current={step} steps={steps} />

      {/* Main setup area */}
      <div className="flex-grow flex items-start md:items-center justify-center px-4 py-6 md:py-10">
        <div className="w-full max-w-4xl bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Desktop sidebar */}
            <div className="md:w-56 md:border-r border-border md:p-6 hidden md:block shrink-0">
              <Sidebar current={step} steps={steps} />
            </div>

            {/* Content */}
            <div className="flex-1 p-5 sm:p-8 min-h-[420px] flex flex-col min-w-0">
              {step === 0 && (
                <StepImportantRules
                  assessmentType={assessmentType}
                  durationMinutes={durationMinutes}
                  onNext={() => setStep(hasInstructions ? instructionsStepIndex : generalRulesStepIndex)}
                  onBack={() => router.push(`/student/assessments`)}
                />
              )}
              {step === instructionsStepIndex && hasInstructions && (
                <StepInstructions
                  instructions={instructions}
                  onNext={() => setStep(generalRulesStepIndex)}
                  onBack={() => setStep(0)}
                />
              )}
              {step === generalRulesStepIndex && (
                <StepGeneralRules
                  assessmentType={assessmentType}
                  proctoringEnabled={proctoringEnabled}
                  onNext={handleGeneralRulesNext}
                  onBack={() => setStep(hasInstructions ? instructionsStepIndex : 0)}
                  isPending={generalNextPending}
                  error={generalNextError}
                />
              )}
              {step === passwordStepIndex && passwordProtected && (
                <StepPassword
                  assessmentId={assessmentId}
                  onBack={() => setStep(generalRulesStepIndex)}
                  onSuccess={handlePasswordSuccess}
                />
              )}
              {step === micStepIndex && resolvedAttemptId != null && (
                <StepMicCheck
                  onNext={() => {
                    if (proctoringEnabled) {
                      setStep(proctorStepIndex);
                    } else {
                      router.push(`/student/assessments/${assessmentId}/attempt?attemptId=${resolvedAttemptId}`);
                    }
                  }}
                  onBack={() => setStep(passwordProtected ? passwordStepIndex : generalRulesStepIndex)}
                />
              )}
              {step === proctorStepIndex &&
                proctoringEnabled &&
                resolvedAttemptId != null && (
                  <StepCameraCheck
                    onBack={() => setStep(micStepIndex)}
                    onCancel={() => router.push(`/student/assessments`)}
                    onProceed={() => setStep(livenessStepIndex)}
                  />
                )}
              {step === livenessStepIndex &&
                proctoringEnabled &&
                resolvedAttemptId != null && (
                  <StepLivenessCheck
                    assessmentId={assessmentId}
                    attemptId={resolvedAttemptId}
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
