"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin } from "lucide-react";

interface CountdownTimerProps {
  targetDate: string; // ISO string
  assessmentTitle: string;
  courseCode: string;
  location: string | null;
  durationMinutes: number | null;
}

interface TimeLeft {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeTimeLeft(target: string): TimeLeft {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    total: diff,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

const BLOCKS = [
  { key: "days" as const, label: "Days" },
  { key: "hours" as const, label: "Hrs" },
  { key: "minutes" as const, label: "Min" },
  { key: "seconds" as const, label: "Sec" },
];

export default function CountdownTimer({
  targetDate,
  assessmentTitle,
  courseCode,
  location,
  durationMinutes,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    computeTimeLeft(targetDate)
  );

  useEffect(() => {
    const id = setInterval(
      () => setTimeLeft(computeTimeLeft(targetDate)),
      1000
    );
    return () => clearInterval(id);
  }, [targetDate]);

  if (timeLeft.total <= 0) {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-red-600 py-3">
        <Clock size={14} />
        This exam is starting now
      </div>
    );
  }

  return (
    <div>
      {/* Exam name */}
      <div className="text-[12px] text-muted-foreground mb-3">
        <span className="font-semibold text-[#1e293b] uppercase tracking-wide text-[11px]">
          {courseCode}
        </span>
        {"  ·  "}
        <span>{assessmentTitle}</span>
      </div>

      {/* Countdown blocks */}
      <div className="flex gap-2">
        {BLOCKS.map(({ key, label }) => (
          <div
            key={key}
            className="flex flex-col items-center justify-center bg-[#f8f9fa] rounded-sm px-3 py-2 min-w-[52px]"
          >
            <span className="text-xl font-semibold leading-none tabular-nums text-[#1e293b]">
              {String(timeLeft[key]).padStart(2, "0")}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 font-medium">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Location / duration */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-muted-foreground">
        {location && (
          <span className="flex items-center gap-1">
            <MapPin size={10} />
            {location}
          </span>
        )}
        {durationMinutes != null && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {durationMinutes >= 60
              ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}m` : ""}`
              : `${durationMinutes}m`}
          </span>
        )}
      </div>
    </div>
  );
}
