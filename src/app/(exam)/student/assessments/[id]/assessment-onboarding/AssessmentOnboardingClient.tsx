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
  Monitor,
  PlayCircle,
  ShieldCheck,
  Sun,
  SunDim,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createOrResumeAttempt } from "@/lib/assessment-actions";
import { createProctorSession } from "@/lib/proctor-session-actions";
import { MAX_VIOLATIONS } from "@/lib/violation-tracker";

type CameraState = "idle" | "requesting" | "granted" | "denied";
type LightingStatus = "checking" | "ok" | "poor" | "unknown";

interface Props {
  assessmentId: number;
  attemptId?: number | null;
  assessmentType: string;
  durationMinutes: number | null;
  passwordProtected: boolean;
  proctoringEnabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps definition — password step only included when needed
// ─────────────────────────────────────────────────────────────────────────────

function buildSteps(passwordProtected: boolean, proctoringEnabled: boolean) {
  return [
    { label: "Important rules", icon: AlertTriangle },
    { label: "General rules", icon: BookOpen },
    ...(passwordProtected ? [{ label: "Password", icon: LockKeyhole }] : []),
    ...(proctoringEnabled ? [{ label: "Camera check", icon: Camera }] : []),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────────────────

function Sidebar({
  current,
  steps,
}: {
  current: number;
  steps: { label: string; icon: React.ElementType }[];
}) {
  return (
    <aside className="w-52 shrink-0 flex flex-col gap-1 pt-1">
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
            className={`flex items-center gap-3 px-2.5 py-2 rounded-sm transition-all border ${
              active
                ? "bg-primary/10 text-primary border-primary/20"
                : "border-transparent text-slate-500"
            }`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold transition-all ${
                done
                  ? "bg-primary text-white"
                  : active
                  ? "bg-primary/20 text-primary"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {done ? <Check size={11} strokeWidth={3} /> : <Icon size={11} />}
            </div>

            <span
              className={`text-sm transition-colors ${active
                  ? "font-medium text-[#1a73e8]"
                  : done
                    ? "font-medium text-[#5f6368]"
                    : "text-[#5f6368]"
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
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">
        Before you begin
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Read these rules carefully — they are strictly enforced.
      </p>

      <div className="flex-1 space-y-4 overflow-y-auto">
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
// Step 2 — General rules
// ─────────────────────────────────────────────────────────────────────────────

function StepGeneralRules({
  assessmentType,
  onNext,
  onBack,
}: {
  assessmentType: string;
  onNext: () => void;
  onBack: () => void;
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
  ];

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">
        General rules
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Additional guidelines for a fair assessment environment.
      </p>

      <div className="flex-1 space-y-4 overflow-y-auto">
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
          Continue
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Camera check
// ─────────────────────────────────────────────────────────────────────────────

function StepCameraCheck({
  attemptId,
  assessmentId,
  onBack,
  onCancel,
}: {
  attemptId: number;
  assessmentId: number;
  onBack?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [lightingStatus, setLightingStatus] =
    useState<LightingStatus>("unknown");
  const [brightness, setBrightness] = useState<number | null>(null);
  const [lightingDegraded, setLightingDegraded] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isProceeding, setIsProceeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasOkRef = useRef(false);

  const requestCamera = useCallback(async () => {
    setCameraState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
      setCameraState("granted");
    } catch {
      setCameraState("denied");
    }
  }, []);

  useEffect(() => {
    requestCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [requestCamera]);

  useEffect(() => {
    if (cameraState === "granted" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => { });
    }
  }, [cameraState]);

  const checkLighting = useCallback(async (): Promise<
    "ok" | "poor" | "unknown"
  > => {
    const oracleBaseUrl = process.env.NEXT_PUBLIC_ORACLE_BASE_URL;
    if (!oracleBaseUrl) return "ok";

    const video = videoRef.current;
    if (!video || video.readyState < 2) return "unknown";

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const context = canvas.getContext("2d");
      if (!context) return "unknown";

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameB64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      const response = await fetch(
        `${oracleBaseUrl}/api/sessions/lighting-check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frameB64 }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) return "unknown";

      const data = (await response.json()) as {
        result: "OK" | "POOR_LIGHTING";
        brightness: number;
      };
      setBrightness(data.brightness);
      return data.result === "OK" ? "ok" : "poor";
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
        firstRun = false;
      }

      const result = await checkLighting();
      if (result === "ok") {
        wasOkRef.current = true;
        setLightingDegraded(false);
        setLightingStatus("ok");
      } else if (result === "poor") {
        if (wasOkRef.current) setLightingDegraded(true);
        setLightingStatus("poor");
      }
    };

    run();
    pollingRef.current = setInterval(run, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [cameraState, checkLighting]);

  async function handleProceed() {
    setIsProceeding(true);
    setError(null);

    const result = await createProctorSession(attemptId);
    if ("error" in result) {
      const messages: Record<string, string> = {
        UNAUTHORIZED: "You are not authorised to start this exam.",
        ATTEMPT_NOT_FOUND: "Your exam attempt could not be found.",
        ATTEMPT_NOT_IN_PROGRESS: "This attempt is no longer active.",
        ORACLE_SESSION_CREATION_FAILED:
          "The proctoring service could not be started. Please try again.",
        ORACLE_UNREACHABLE:
          "The proctoring service is unavailable. Please try again.",
        DB_ERROR: "A server error occurred. Please try again.",
      };
      setError(messages[result.error] ?? "An unexpected error occurred.");
      setIsProceeding(false);
      return;
    }

    try {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("[AssessmentOnboarding] Fullscreen request failed:", err);
    }

    router.push(
      `/student/assessments/${assessmentId}/attempt?attemptId=${attemptId}`,
    );
  }

  const lightingOk = lightingStatus === "ok";
  const canProceed =
    agreed && cameraState === "granted" && lightingOk && !isProceeding;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-bold text-[#1e293b] mb-0.5">
        Camera check
      </h2>
      <p className="text-[12px] text-muted-foreground mb-5">
        Make sure your camera is clear and your lighting is good.
      </p>

      <div className="relative mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-sm bg-[#1e293b]">
        {cameraState === "granted" ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />

            <div className="absolute left-3 top-3 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              <span className="rounded-sm bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm">
                Live
              </span>
            </div>

            <div
              className={`absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
                lightingStatus === "checking"
                  ? "border-slate-500/40 bg-slate-900/80 text-slate-200"
                  : lightingOk
                  ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-300"
                  : "border-amber-500/40 bg-amber-950/80 text-amber-300"
              }`}
            >
              {lightingStatus === "checking" ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  Checking…
                </>
              ) : lightingOk ? (
                <>
                  <Sun size={11} />
                  Good lighting
                </>
              ) : (
                <>
                  <SunDim size={11} />
                  Too dark
                </>
              )}
            </div>
          </>
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

        {lightingDegraded && lightingStatus === "poor" && (
          <div className="flex items-start gap-2.5 rounded-sm border border-amber-100 bg-amber-50 p-3">
            <SunDim size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[12px] font-bold text-amber-700 uppercase tracking-wider">
                Lighting has changed
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700/80 font-semibold leading-relaxed">
                Your lighting was good but has now dropped. Please turn your lights back on before starting.
              </p>
            </div>
          </div>
        )}

        {!lightingDegraded && lightingStatus === "poor" && (
          <div className="flex items-start gap-2.5 rounded-sm border border-amber-100 bg-amber-50 p-3">
            <SunDim size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[12px] font-bold text-amber-700 uppercase tracking-wider">
                Poor lighting detected
              </p>
              <p className="mt-0.5 text-[11px] text-amber-700/80 font-semibold leading-relaxed">
                Move to a brighter area or turn on more lights. Checking automatically every few seconds.
                {brightness !== null && (
                  <span className="ml-1 text-slate-400 font-bold">
                    ({brightness.toFixed(0)}/255)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {cameraState === "granted" && lightingOk && (
          <div className="flex items-center gap-2 px-1">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
            <p className="text-[12px] font-semibold text-emerald-700">
              Camera verified and lighting is good.
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto space-y-4 pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isProceeding}
              className="flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isProceeding}
              className="flex items-center gap-1.5 rounded-sm border border-border bg-white px-4 py-2 text-[12px] font-semibold text-[#323130] hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>

        <label className="group flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="sr-only"
          />
          <div
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 transition-colors ${
              agreed
                ? "border-primary bg-primary"
                : "border-border bg-white group-hover:border-primary"
            }`}
          >
            {agreed && <Check size={9} className="text-white" strokeWidth={3} />}
          </div>
          <span className="select-none text-[11px] leading-relaxed text-slate-500">
            I agree to the exam rules and understand that violations will be logged and may result in automatic submission.
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2.5 rounded-sm border border-red-100 bg-red-50 p-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-[11px] font-semibold text-red-700">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleProceed}
          disabled={!canProceed}
          className="flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#001570] disabled:cursor-not-allowed disabled:opacity-30 animate-in fade-in"
        >
          {isProceeding ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <PlayCircle size={13} />
              Start Exam
              <ArrowRight size={13} />
            </>
          )}
        </button>

        {!canProceed && !isProceeding && (
          <p className="text-[11px] text-muted-foreground">
            {cameraState === "denied"
              ? "Camera access is required to proceed."
              : lightingStatus === "poor"
              ? "Improve your lighting to continue."
              : lightingStatus === "checking"
              ? "Checking lighting…"
              : !agreed
              ? "Check the agreement box above to continue."
              : "Waiting for camera…"}
          </p>
        )}
      </div>
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
    <div className="flex flex-col h-full">
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
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [createdAttemptId, setCreatedAttemptId] = useState<number | null>(
    attemptId ?? null,
  );

  const steps = buildSteps(passwordProtected, proctoringEnabled);
  const passwordStepIndex = passwordProtected ? 2 : -1;
  const proctorStepIndex = proctoringEnabled ? (passwordProtected ? 3 : 2) : -1;
  const resolvedAttemptId = createdAttemptId;

  function handleGeneralRulesNext() {
    if (passwordProtected) {
      setStep(passwordStepIndex);
    } else if (proctoringEnabled) {
      setStep(proctorStepIndex);
    } else {
      if (resolvedAttemptId == null) {
        router.push(`/student/assessments/${assessmentId}`);
        return;
      }
      router.push(
        `/student/assessments/${assessmentId}/attempt?attemptId=${resolvedAttemptId}`,
      );
    }
  }

  function handlePasswordSuccess(newAttemptId: number) {
    setCreatedAttemptId(newAttemptId);
    if (proctoringEnabled) {
      setStep(proctorStepIndex);
      return;
    }
    router.push(
      `/student/assessments/${assessmentId}/attempt?attemptId=${newAttemptId}`,
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Minimalist Navbar */}
      <header className="h-12 bg-primary flex items-center justify-between px-4 sm:px-6 w-full shrink-0">
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
            <div className="text-white font-semibold text-[13px]">
              GCTU Exam Portal
            </div>
            <div className="text-white/55 text-[9.5px]">
              Ghana Communication Technology University
            </div>
          </div>
        </div>

        <Link
          href="/student/assessments"
          className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/15 rounded-sm text-[12px] font-semibold text-white transition-colors border border-white/10"
        >
          Exit Setup
        </Link>
      </header>

      {/* Main setup area */}
      <div className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl flex flex-col md:flex-row gap-8 md:gap-12">
          {/* Sidebar */}
          <Sidebar current={step} steps={steps} />

          {/* Divider */}
          <div className="hidden md:block w-px bg-border self-stretch" />

          {/* Content */}
          <div className="flex-1 min-h-[360px] flex flex-col">
            {step === 0 && (
              <StepImportantRules
                assessmentType={assessmentType}
                durationMinutes={durationMinutes}
                onNext={() => setStep(1)}
                onBack={() => router.push(`/student/assessments`)}
              />
            )}
            {step === 1 && (
              <StepGeneralRules
                assessmentType={assessmentType}
                onNext={handleGeneralRulesNext}
                onBack={() => setStep(0)}
              />
            )}
            {step === passwordStepIndex && passwordProtected && (
              <StepPassword
                assessmentId={assessmentId}
                onBack={() => setStep(1)}
                onSuccess={handlePasswordSuccess}
              />
            )}
            {step === proctorStepIndex &&
              proctoringEnabled &&
              resolvedAttemptId != null && (
                <StepCameraCheck
                  attemptId={resolvedAttemptId}
                  assessmentId={assessmentId}
                  onBack={() =>
                    setStep(passwordProtected ? passwordStepIndex : 1)
                  }
                  onCancel={() =>
                    router.push(`/student/assessments`)
                  }
                />
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
