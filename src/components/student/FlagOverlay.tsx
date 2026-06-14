"use client"

/**
 * FlagOverlay — unified violation/flag overlay for the exam UI.
 *
 * Handles three distinct states:
 *  - 'fullscreen'  : student exited fullscreen (client-detected)
 *  - 'tab'         : student switched tabs / lost focus (client-detected)
 *  - 'oracle'      : Oracle AI detected an anomaly (server-pushed)
 *  - 'terminated'  : flag limit reached, exam auto-submitted
 *
 * Oracle flags show a 40-second countdown. The student cannot dismiss the
 * overlay until the countdown expires — this gives them time to correct the
 * behaviour before the next flag window opens.
 *
 * All other flags are dismissible immediately.
 */

import { useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  EyeOff,
  Maximize2,
  ShieldAlert,
  Camera,
  UserX,
  Users,
  Smartphone,
  ScanEye,
  WifiOff,
} from "lucide-react"
import { MAX_VIOLATIONS } from "@/lib/violation-tracker"

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
  flagCountAfter: number   // the new total after this flag
  source: "CLIENT" | "ORACLE"
}

interface FlagOverlayProps {
  /** Current flag event to display. null = no overlay. */
  event: FlagEvent | null
  /** Whether the exam has been terminated (flag limit reached). */
  terminated: boolean
  /**
   * When true, show the "final warning" screen — submission already happened
   * server-side. Displays the reason and a 10-second countdown before onFinalRedirect.
   */
  finalWarning: boolean
  /** Called when the student dismisses the overlay (non-terminated). */
  onDismiss: () => void
  /** Called when the student clicks "Return to fullscreen". */
  onReturnFullscreen?: () => void
  /** Called when the final-warning countdown expires — should redirect away. */
  onFinalRedirect: () => void
}

// ─── Config per flag type ─────────────────────────────────────────────────────

const FLAG_CONFIG: Record<FlagType, {
  icon: React.ElementType
  title: string
  description: string
  /** Seconds to wait before the dismiss button appears. 0 = immediate. */
  cooldown: number
  accentColor: string
  bgColor: string
}> = {
  FULLSCREEN_EXIT: {
    icon: Maximize2,
    title: "Fullscreen exited",
    description: "You exited fullscreen mode. This has been logged as a violation.",
    cooldown: 0,
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  TAB_SWITCH: {
    icon: EyeOff,
    title: "Focus lost",
    description: "You left the exam page or switched applications. This has been logged.",
    cooldown: 0,
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  PHONE_DETECTED: {
    icon: Smartphone,
    title: "Phone detected",
    description: "Oracle detected a phone in your camera feed. Please remove it from view.",
    cooldown: 0,
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  GAZE_AWAY: {
    icon: ScanEye,
    title: "Gaze away detected",
    description: "Oracle detected that you are not looking at the screen. Please face forward.",
    cooldown: 0,
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  PERSON_ABSENT: {
    icon: UserX,
    title: "Person absent",
    description: "Oracle could not detect you in the camera feed. Please ensure you are visible.",
    cooldown: 0,
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  MULTIPLE_PERSONS: {
    icon: Users,
    title: "Multiple persons detected",
    description: "Oracle detected more than one person in your camera feed. Only you should be visible.",
    cooldown: 0,
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  SUSPICIOUS_OBJECT: {
    icon: ShieldAlert,
    title: "Suspicious object detected",
    description: "Oracle detected a suspicious object in your camera feed. Please remove it from view.",
    cooldown: 0,
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  CONNECTION_LOST: {
    icon: WifiOff,
    title: "Proctoring connection lost",
    description: "The proctoring connection was lost. This has been logged as a violation.",
    cooldown: 0,
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  POOR_LIGHTING: {
    icon: Camera,
    title: "Poor lighting / Camera covered",
    description: "Oracle detected poor lighting or the camera is covered. Please ensure your face is clearly visible.",
    cooldown: 0,
    accentColor: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  TALKING_DETECTED: {
    icon: AlertTriangle,
    title: "Talking detected",
    description: "Oracle detected that you are talking. Please remain silent during the assessment.",
    cooldown: 0,
    accentColor: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  BLURRY_CAMERA: {
    icon: Camera,
    title: "Blurry camera feed",
    description: "Your camera feed is too blurry for reliable proctoring. Please clean the lens or adjust focus.",
    cooldown: 0,
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

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const progress = seconds / total
  return (
    <svg width="52" height="52" className="rotate-[-90deg]">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke="rgba(255,255,255,0.7)" strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - progress)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
      <text
        x="26" y="26"
        textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize="11" fontWeight="600"
        style={{ transform: "rotate(90deg)", transformOrigin: "26px 26px" }}
      >
        {seconds}
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
  const [countdown, setCountdown] = useState(0)
  const [canDismiss, setCanDismiss] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Final-warning countdown — 10 seconds then redirect
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

  // Reset cooldown countdown whenever a new event arrives
  useEffect(() => {
    if (!event || terminated) {
      setCountdown(0)
      setCanDismiss(true)
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const cfg = FLAG_CONFIG[event.type]
    if (cfg.cooldown === 0) {
      setCountdown(0)
      setCanDismiss(true)
      return
    }

    setCountdown(cfg.cooldown)
    setCanDismiss(false)

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setCanDismiss(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [event, terminated])

  // ── Final warning screen ──────────────────────────────────────────────────
  // Shown when the 5th flag is hit. Submission already happened server-side.
  // We show the reason and count down before redirecting.
  if (finalWarning && event) {
    const cfg = FLAG_CONFIG[event.type]
    const Icon = cfg.icon
    return (
      <div
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.97)", backdropFilter: "blur(12px)" }}
      >
        <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">

          {/* Pulsing red ring */}
          <div className="relative flex items-center justify-center">
            <div className="absolute h-28 w-28 rounded-full bg-red-500/10 animate-ping" />
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-500/20 ring-4 ring-red-500/40">
              <Icon size={38} className="text-red-400" />
            </div>
          </div>

          {/* Heading */}
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

          {/* Reason box */}
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

          {/* Dots */}
          <FlagDots count={MAX_VIOLATIONS} max={MAX_VIOLATIONS} />

          {/* Countdown */}
          <div className="flex flex-col items-center gap-2">
            <CountdownRing seconds={finalCountdown} total={10} />
            <p className="text-white/40 text-[12px]">
              Redirecting in {finalCountdown}s…
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Terminated state (fallback — shown if finalWarning was skipped) ───────
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

  // ── No active event ───────────────────────────────────────────────────────
  if (!event) return null

  const cfg = FLAG_CONFIG[event.type]
  const Icon = cfg.icon
  const remaining = MAX_VIOLATIONS - event.flagCountAfter
  const isOracle = event.source === "ORACLE"
  const isFullscreen = event.type === "FULLSCREEN_EXIT"

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(10px)" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">

        {/* Icon + optional Oracle badge */}
        <div className="relative">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: cfg.bgColor, boxShadow: `0 0 0 4px ${cfg.accentColor}22` }}
          >
            <Icon size={34} style={{ color: cfg.accentColor }} />
          </div>
          {isOracle && (
            <div className="absolute -top-1 -right-1 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5">
              <Camera size={9} className="text-white" />
              <span className="text-[9px] font-bold text-white uppercase tracking-wider">Oracle</span>
            </div>
          )}
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

        {/* Oracle cooldown or dismiss */}
        {isOracle && !canDismiss ? (
          <div className="flex flex-col items-center gap-2">
            <CountdownRing seconds={countdown} total={cfg.cooldown} />
            <p className="text-white/40 text-[11px]">
              Please correct the behaviour. You may dismiss in {countdown}s.
            </p>
          </div>
        ) : isFullscreen ? (
          <button
            type="button"
            onClick={() => {
              document.documentElement.requestFullscreen()
                .then(() => onDismiss())
                .catch(() => onDismiss())
            }}
            className="flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-[14px] font-bold text-[#111827] hover:bg-white/90 transition-colors"
          >
            <Maximize2 size={15} />
            Return to fullscreen
          </button>
        ) : (
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
