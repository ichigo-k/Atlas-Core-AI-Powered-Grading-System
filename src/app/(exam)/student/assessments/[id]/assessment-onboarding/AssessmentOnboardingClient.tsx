"use client";

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
    <aside className="w-56 shrink-0 flex flex-col gap-1 pt-1">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck size={18} className="text-[#1a73e8]" />
        <span className="text-sm font-medium text-[#202124]">Exam Setup</span>
      </div>

      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = s.icon;

        return (
          <div
            key={s.label}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
            style={{ background: active ? "#e8f0fe" : "transparent" }}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${done
                  ? "bg-[#1a73e8] text-white"
                  : active
                    ? "bg-[#e8f0fe] text-[#1a73e8]"
                    : "bg-[#f8f9fa] text-[#5f6368]"
                }`}
            >
              {done ? <Check size={13} /> : <Icon size={13} />}
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
}: {
  assessmentType: string;
  durationMinutes: number | null;
  onNext: () => void;
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
      <h2 className="text-xl font-normal text-[#202124] mb-1">
        Before you begin
      </h2>
      <p className="text-sm text-[#5f6368] mb-6">
        Read these rules carefully — they are strictly enforced.
      </p>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {rules.map((rule, _i) => (
          <div key={rule.title} className="flex items-start gap-3">
            <rule.icon size={15} className="mt-0.5 shrink-0 text-[#ea4335]" />
            <div>
              <p className="text-sm font-medium text-[#ea4335]">{rule.title}</p>
              <p className="text-xs text-[#5f6368] mt-0.5 leading-relaxed">
                {rule.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-8">
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#174ea6] transition-colors"
        >
          I understand
          <ArrowRight size={14} />
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
}: {
  assessmentType: string;
  onNext: () => void;
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
      <h2 className="text-xl font-normal text-[#202124] mb-1">
        General rules
      </h2>
      <p className="text-sm text-[#5f6368] mb-6">
        Additional guidelines for a fair assessment environment.
      </p>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {rules.map((rule, _i) => (
          <div key={rule.title} className="flex items-start gap-3">
            <rule.icon size={15} className="mt-0.5 shrink-0 text-[#5f6368]" />
            <div>
              <p className="text-sm font-medium text-[#202124]">
                {rule.title}
              </p>
              <p className="text-xs text-[#5f6368] mt-0.5 leading-relaxed">
                {rule.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-8">
        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#174ea6] transition-colors"
        >
          Continue
          <ArrowRight size={14} />
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
      <h2 className="text-xl font-normal text-[#202124] mb-1">
        Camera check
      </h2>
      <p className="text-sm text-[#5f6368] mb-5">
        Make sure your camera is clear and your lighting is good.
      </p>

      <div className="relative mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[#202124]">
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
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34a853] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34a853]" />
              </span>
              <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
                Live
              </span>
            </div>

            <div
              className={`absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm transition-colors ${lightingStatus === "checking"
                  ? "border-[#5f6368]/40 bg-[#202124]/70 text-[#dadce0]"
                  : lightingOk
                    ? "border-[#34a853]/40 bg-[#0d652d]/70 text-[#81c995]"
                    : "border-[#fbbc04]/40 bg-[#b06000]/70 text-[#fde293]"
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
          <div className="flex flex-col items-center gap-2 text-[#5f6368]">
            <CameraOff size={28} />
            <span className="text-sm">Camera unavailable</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#5f6368]">
            <Loader2 size={28} className="animate-spin" />
            <span className="text-sm">Requesting camera access…</span>
          </div>
        )}
      </div>

      <div className="mb-4 space-y-2 text-sm">
        {cameraState === "denied" && (
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#ea4335]" />
            <div>
              <p className="font-medium text-[#d93025]">Camera access required</p>
              <p className="mt-0.5 text-xs text-[#5f6368]">
                Allow camera access in your browser settings and refresh the
                page.
              </p>
            </div>
          </div>
        )}

        {lightingDegraded && lightingStatus === "poor" && (
          <div className="flex items-start gap-2">
            <SunDim size={14} className="mt-0.5 shrink-0 text-[#fbbc04]" />
            <div>
              <p className="font-medium text-[#e37400]">
                Lighting has changed
              </p>
              <p className="mt-0.5 text-xs text-[#5f6368]">
                Your lighting was good but has now dropped. Please turn your
                lights back on before starting.
              </p>
            </div>
          </div>
        )}

        {!lightingDegraded && lightingStatus === "poor" && (
          <div className="flex items-start gap-2">
            <SunDim size={14} className="mt-0.5 shrink-0 text-[#fbbc04]" />
            <div>
              <p className="font-medium text-[#e37400]">
                Poor lighting detected
              </p>
              <p className="mt-0.5 text-xs text-[#5f6368]">
                Move to a brighter area or turn on more lights. Checking
                automatically every few seconds.
                {brightness !== null && (
                  <span className="ml-1 text-[#9aa0a6]">
                    ({brightness.toFixed(0)}/255)
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {cameraState === "granted" && lightingOk && (
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-[#34a853]" />
            <p className="font-medium text-[#1e8e3e]">
              Camera verified and lighting is good.
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto space-y-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isProceeding}
              className="flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-5 py-2 text-sm font-medium text-[#5f6368] transition-colors hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isProceeding}
              className="flex items-center gap-2 rounded-full border border-[#dadce0] bg-white px-5 py-2 text-sm font-medium text-[#5f6368] transition-colors hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-40"
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
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${agreed
                ? "border-[#1a73e8] bg-[#1a73e8]"
                : "border-[#dadce0] bg-white group-hover:border-[#1a73e8]"
              }`}
          >
            {agreed && <Check size={9} className="text-white" />}
          </div>
          <span className="select-none text-xs leading-relaxed text-[#5f6368]">
            I agree to the exam rules and understand that violations will be
            logged and may result in automatic submission.
          </span>
        </label>

        {error && (
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#ea4335]" />
            <p className="text-xs text-[#d93025]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleProceed}
          disabled={!canProceed}
          className="flex items-center gap-2 rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#174ea6] disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isProceeding ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <PlayCircle size={14} />
              Start Exam
              <ArrowRight size={13} />
            </>
          )}
        </button>

        {!canProceed && !isProceeding && (
          <p className="text-xs text-[#5f6368]">
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
      <h2 className="text-xl font-normal text-[#202124] mb-1">
        Assessment password
      </h2>
      <p className="text-sm text-[#5f6368] mb-8">
        This assessment is password-protected. Enter the password provided by
        your lecturer to begin.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-sm">
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium text-[#5f6368]"
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
            className="w-full rounded border border-[#dadce0] bg-white px-3.5 py-2.5 text-sm text-[#202124] placeholder-[#5f6368] outline-none transition-all focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] disabled:opacity-60"
          />
          {error && (
            <p className="text-xs text-[#ea4335] flex items-center gap-1.5 mt-0.5">
              <AlertTriangle size={11} className="shrink-0" />
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending || !password}
          className="flex items-center gap-2 self-start rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#174ea6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <PlayCircle size={14} />
              Start Assessment
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="flex items-center gap-2 self-start rounded-full border border-[#dadce0] bg-white px-6 py-2.5 text-sm font-medium text-[#5f6368] hover:bg-[#f8f9fa] transition-colors disabled:opacity-40"
        >
          Back
        </button>
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
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl flex gap-16">
        {/* Sidebar */}
        <Sidebar current={step} steps={steps} />

        {/* Divider */}
        <div className="w-px bg-[#dadce0] self-stretch" />

        {/* Content */}
        <div className="flex-1 min-h-105 flex flex-col">
          {step === 0 && (
            <StepImportantRules
              assessmentType={assessmentType}
              durationMinutes={durationMinutes}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <StepGeneralRules
              assessmentType={assessmentType}
              onNext={handleGeneralRulesNext}
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
                  router.push(`/student/assessments/${assessmentId}`)
                }
              />
            )}
        </div>
      </div>
    </div>
  );
}
