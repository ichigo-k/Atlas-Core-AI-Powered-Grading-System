"use client"

import { useEffect, useRef, useState } from "react"
import { Clock } from "lucide-react"
import { computeRemaining } from "@/lib/student-utils"

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

interface CountdownTimerProps {
  startedAt: string
  durationMinutes: number
  onExpire: () => void
  compact?: boolean
}

export default function CountdownTimer({ startedAt, durationMinutes, onExpire, compact }: CountdownTimerProps) {
  const expiredRef = useRef(false)
  // null on first render so server and client produce identical HTML
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    // Set the real value immediately after mount (client-only)
    const compute = () => computeRemaining(new Date(startedAt), durationMinutes, new Date())

    setRemaining(compute())

    const id = setInterval(() => {
      const r = compute()
      setRemaining(r)
      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire()
      }
    }, 1000)

    return () => clearInterval(id)
  }, [startedAt, durationMinutes, onExpire])

  if (!durationMinutes) return null

  // Render a stable placeholder until client hydrates
  if (remaining === null) {
    return <span className="font-mono text-[15px] font-semibold text-[#374151]">--:--:--</span>
  }

  const isWarning = remaining < 5 * 60 * 1000

  if (compact) {
    return (
      <span className={`font-mono text-[12px] font-bold ${isWarning ? "text-[#dc2626]" : "text-[#374151]"}`}>
        {formatTime(remaining)}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 font-mono text-[15px] font-semibold ${isWarning ? "text-[#dc2626]" : "text-[#111827]"}`}>
      {isWarning && <Clock className="h-3.5 w-3.5 animate-pulse" />}
      <span>{formatTime(remaining)}</span>
    </div>
  )
}
