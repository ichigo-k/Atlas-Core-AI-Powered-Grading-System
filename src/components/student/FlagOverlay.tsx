"use client"

import { useEffect, useRef, useState } from "react"
import {
  EyeOff,
  Maximize2,
  ShieldAlert,
  Camera,
  UserX,
  Users,
  Smartphone,
  ScanEye,
  WifiOff,
  AlertTriangle,
} from "lucide-react"
import { MAX_VIOLATIONS } from "@/lib/violation-tracker"
import { useViolationStore } from "@/lib/violation-store"

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlagType =
  | "FULLSCREEN_EXIT"
  | "TAB_SWITCH"
  | "PHONE_DETECTED"
  | "GAZE_AWAY"
  | "PERSON_ABSENT"
  | "MULTIPLE_PERSONS"
  | "SUSPICIOUS_OBJECT"
  | "CONNECTION_LOST"
  | "POOR_LIGHTING"
  | "TALKING_DETECTED"
  | "BLURRY_CAMERA"

export interface FlagEvent {
  type: FlagType
  flagCountAfter: number
  source: "CLIENT" | "CAMERA"
}

interface FlagOverlayProps {
  event: FlagEvent | null
  terminated: boolean
  finalWarning: boolean
  onDismiss: () => void
  onReturnFullscreen?: () => void
  onFinalRedirect: () => void
}

// ─── Config per flag type ─────────────────────────────────────────────────────

const FLAG_CONFIG: Record<FlagType, {
  icon: React.ElementType
  title: string
  description: string
  accentColor: string
  bgColor: string
}> = {
  FULLSCREEN_EXIT: {
    icon: Maximize2,
    title: "Fullscreen exited",
    description: "You exited fullscreen mode. This has been logged as a violation.",
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  TAB_SWITCH: {
    icon: EyeOff,
    title: "Focus lost",
    description: "You left the exam page. Return immediately — another violation is added every 15 seconds while you're away.",
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  PHONE_DETECTED: {
    icon: Smartphone,
    title: "Phone detected",
    description: "A phone was detected in your camera feed. Please remove it from view.",
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  GAZE_AWAY: {
    icon: ScanEye,
    title: "Gaze away detected",
    description: "You are not looking at the screen. Please face forward.",
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  PERSON_ABSENT: {
    icon: UserX,
    title: "Person absent",
    description: "You are not visible in the camera feed. Please ensure your face is clearly visible.",
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  MULTIPLE_PERSONS: {
    icon: Users,
    title: "Multiple persons detected",
    description: "More than one person is visible in your camera feed. Only you should be present.",
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  SUSPICIOUS_OBJECT: {
    icon: ShieldAlert,
    title: "Suspicious object detected",
    description: "A suspicious object was detected in your camera feed. Please remove it.",
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  CONNECTION_LOST: {
    icon: WifiOff,
    title: "Proctoring connection lost",
    description: "The proctoring connection was lost. This has been logged as a violation.",
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  POOR_LIGHTING: {
    icon: Camera,
    title: "Poor lighting / Camera covered",
    description: "Poor lighting or the camera is covered. Please ensure your face is clearly visible.",
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  TALKING_DETECTED: {
    icon: AlertTriangle,
    title: "Talking detected",
    description: "Please remain silent during the assessment.",
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  BLURRY_CAMERA: {
    icon: Camera,
    title: "Blurry camera feed",
    description: "Your camera feed is too blurry. Please clean the lens or adjust focus.",
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
}

// ─── Dot indicator ────────────────────────────────────────────────────────────

function FlagDots({ count, max }: { count: number; max: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
            i < count ? "bg-red-400 scale-110" : "bg-white/20"
          }`}
        />
      ))}
    </div>
  )
}

// ─── Countdown ring ───────────────────────────────────────────────────────────

function CountdownRing({
  seconds,
  total,
  size = "sm",
  color = "rgba(255,255,255,0.8)",
}: {
  seconds: number
  total: number
  size?: "sm" | "lg"
  color?: string
}) {
  const dim = size === "lg" ? 96 : 52
  const cx = dim / 2
  const r = size === "lg" ? 40 : 20
  const strokeW = size === "lg" ? 5 : 3
  const fontSize = size === "lg" ? 22 : 11
  const circ = 2 * Math.PI * r
  const progress = Math.max(0, seconds) / total
  return (
    <svg width={dim} height={dim} className="rotate-[-90deg]">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={strokeW} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
      <text
        x={cx} y={cx}
        textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={fontSize} fontWeight="700"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cx}px` }}
      >
        {Math.max(0, seconds)}
      </text>
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FlagOverlay({
  event,
  terminated,
  finalWarning,
  onDismiss,
  onReturnFullscreen,
  onFinalRedirect,
}: FlagOverlayProps) {
  // Final-warning countdown
  const [finalCountdown, setFinalCountdown] = useState(10)
  const finalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!finalWarning) {
      setFinalCountdown(10)
      if (finalTimerRef.current) clearInterval(finalTimerRef.current)
      return
    }
    setFinalCountdown(10)
    finalTimerRef.current = setInterval(() => {
      setFinalCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(finalTimerRef.current!)
          onFinalRedirect()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (finalTimerRef.current) clearInterval(finalTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalWarning])

  // Away countdown from store (drives the "next flag in Xs" ring for TAB_SWITCH)
  const awayCountdown = useViolationStore((s) => s.awayCountdown)

  // Camera violation grace countdown (driven locally — counts 15s before flagging)
  const [cameraGraceCountdown, setCameraGraceCountdown] = useState<number | null>(null)
  const cameraGraceRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Camera violations (PERSON_ABSENT, MULTIPLE_PERSONS, PHONE_DETECTED, SUSPICIOUS_OBJECT)
  // show a local 15s grace countdown. If the event goes away (dismissed), stop the timer.
  const isCameraViolation = event
    ? ["PERSON_ABSENT", "MULTIPLE_PERSONS", "PHONE_DETECTED", "SUSPICIOUS_OBJECT", "BLURRY_CAMERA", "POOR_LIGHTING"].includes(event.type)
    : false

  useEffect(() => {
    if (!event || !isCameraViolation) {
      if (cameraGraceRef.current) clearInterval(cameraGraceRef.current)
      setCameraGraceCountdown(null)
      return
    }
    // Start grace countdown for camera violations
    setCameraGraceCountdown(15)
    let remaining = 15
    cameraGraceRef.current = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(cameraGraceRef.current!)
        setCameraGraceCountdown(0)
      } else {
        setCameraGraceCountdown(remaining)
      }
    }, 1000)
    return () => {
      if (cameraGraceRef.current) clearInterval(cameraGraceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.type, isCameraViolation])

  // ── Final warning screen ──────────────────────────────────────────────────
  if (finalWarning && event) {
    const cfg = FLAG_CONFIG[event.type]
    const Icon = cfg.icon
    return (
      <div
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.97)", backdropFilter: "blur(12px)" }}
      >
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-28 w-28 rounded-full bg-red-500/10 animate-ping" />
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20 ring-4 ring-red-500/40">
              <Icon size={38} className="text-red-400" />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-400 mb-2">
              Assessment auto-submitted
            </p>
            <p className="text-white text-[22px] font-bold mb-2 tracking-tight leading-tight">
              {cfg.title}
            </p>
            <p className="text-white/60 text-[14px] leading-relaxed">
              {cfg.description}
            </p>
          </div>
          <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-red-400 mb-1">
              Reason for submission
            </p>
            <p className="text-white/80 text-[13px] leading-relaxed">
              You reached the maximum of{" "}
              <span className="text-white font-bold">{MAX_VIOLATIONS} integrity flags</span>.
              This flag ({cfg.title.toLowerCase()}) was the final violation.
              Your answers have been saved and submitted.
            </p>
          </div>
          <FlagDots count={MAX_VIOLATIONS} max={MAX_VIOLATIONS} />
          <div className="flex flex-col items-center gap-2">
            <CountdownRing seconds={finalCountdown} total={10} size="lg" color="#ef4444" />
            <p className="text-white/40 text-[12px]">
              Redirecting in {finalCountdown}s…
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Terminated fallback ───────────────────────────────────────────────────
  if (terminated) {
    return (
      <div
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
        style={{ background: "rgba(0,0,0,0.97)", backdropFilter: "blur(10px)" }}
      >
        <div className="flex flex-col items-center gap-6 text-center px-8 max-w-md">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20 ring-4 ring-red-500/30">
            <AlertTriangle size={36} className="text-red-400" />
          </div>
          <div>
            <p className="text-white text-[22px] font-bold mb-2 tracking-tight">
              Assessment terminated
            </p>
            <p className="text-white/60 text-[14px] leading-relaxed">
              You reached the maximum of{" "}
              <span className="text-white font-semibold">{MAX_VIOLATIONS} integrity flags</span>.
              Your assessment has been automatically submitted.
            </p>
          </div>
          <FlagDots count={MAX_VIOLATIONS} max={MAX_VIOLATIONS} />
          <div className="flex items-center gap-2 mt-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            <p className="text-white/40 text-[12px]">Submitting your answers…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!event) return null

  const cfg = FLAG_CONFIG[event.type]
  const Icon = cfg.icon
  const remaining = MAX_VIOLATIONS - event.flagCountAfter
  const isTabSwitch = event.type === "TAB_SWITCH"
  const isFullscreen = event.type === "FULLSCREEN_EXIT"

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(10px)" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">

        {/* Icon */}
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: cfg.bgColor, boxShadow: `0 0 0 4px ${cfg.accentColor}22` }}
        >
          <Icon size={34} style={{ color: cfg.accentColor }} />
        </div>

        {/* Title + description */}
        <div>
          <p className="text-white text-[20px] font-bold mb-1.5 tracking-tight">{cfg.title}</p>
          <p className="text-white/60 text-[13px] leading-relaxed">{cfg.description}</p>
        </div>

        {/* Flag count */}
        <div className="w-full rounded-xl px-5 py-3.5">
          <FlagDots count={event.flagCountAfter} max={MAX_VIOLATIONS} />
          <p className={`mt-2.5 text-[12px] font-semibold ${remaining <= 1 ? "text-red-400" : "text-white/50"}`}>
            {remaining <= 0
              ? "Submitting…"
              : remaining === 1
              ? "1 flag remaining — next violation will auto-submit"
              : `${remaining} flags remaining before auto-submit`}
          </p>
        </div>

        {/* TAB_SWITCH: big countdown + return button */}
        {isTabSwitch && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex flex-col items-center gap-2">
              <CountdownRing
                seconds={awayCountdown ?? 15}
                total={15}
                size="lg"
                color="#f97316"
              />
              <p className="text-white/70 text-[13px] font-semibold">
                {awayCountdown !== null && awayCountdown > 0
                  ? `+1 violation in ${awayCountdown}s if you stay away`
                  : "Violation recorded — return now"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                document.documentElement.requestFullscreen().catch(() => {})
                onDismiss()
              }}
              className="flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-[15px] font-bold text-[#111827] hover:bg-white/90 active:scale-95 transition-all"
            >
              <EyeOff size={16} />
              Return to exam
            </button>
          </div>
        )}

        {/* FULLSCREEN_EXIT: countdown + return button */}
        {isFullscreen && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex flex-col items-center gap-2">
              <CountdownRing
                seconds={awayCountdown ?? 15}
                total={15}
                size="lg"
                color="#f97316"
              />
              <p className="text-white/70 text-[13px] font-semibold">
                {awayCountdown !== null && awayCountdown > 0
                  ? `+1 violation in ${awayCountdown}s if you don't return`
                  : "Violation recorded — return to fullscreen now"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                document.documentElement.requestFullscreen()
                  .then(() => onDismiss())
                  .catch(() => onDismiss())
              }}
              className="flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-[15px] font-bold text-[#111827] hover:bg-white/90 active:scale-95 transition-all"
            >
              <Maximize2 size={16} />
              Return to fullscreen
            </button>
          </div>
        )}

        {/* Camera violations: grace countdown then dismiss */}
        {isCameraViolation && (
          <div className="flex flex-col items-center gap-3 w-full">
            {cameraGraceCountdown !== null && cameraGraceCountdown > 0 ? (
              <div className="flex flex-col items-center gap-1">
                <CountdownRing seconds={cameraGraceCountdown} total={15} />
                <p className="text-white/40 text-[11px]">
                  Correct the issue within {cameraGraceCountdown}s to avoid a flag
                </p>
              </div>
            ) : (
              <p className="text-red-400 text-[12px] font-semibold">Flag recorded</p>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-[14px] font-bold text-[#111827] hover:bg-white/90 transition-colors"
            >
              <Icon size={15} />
              I've fixed it
            </button>
          </div>
        )}

        {/* Other violations (CONNECTION_LOST, etc.) */}
        {!isTabSwitch && !isFullscreen && !isCameraViolation && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-[14px] font-bold text-[#111827] hover:bg-white/90 transition-colors"
          >
            <Icon size={15} />
            Return to exam
          </button>
        )}
      </div>
    </div>
  )
}
