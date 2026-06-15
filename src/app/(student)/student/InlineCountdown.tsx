"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function compute(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
  };
}

export default function InlineCountdown({ targetDate }: { targetDate: string }) {
  const [t, setT] = useState(() => compute(targetDate));

  useEffect(() => {
    const id = setInterval(() => setT(compute(targetDate)), 30_000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!t) {
    return (
      <span className="text-[11px] font-semibold text-[#d13438]">
        Starting now
      </span>
    );
  }

  const parts: string[] = [];
  if (t.days > 0) parts.push(`${t.days}d`);
  parts.push(`${t.hours}h`);
  parts.push(`${t.minutes}m`);

  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
      <Clock size={10} strokeWidth={2} />
      {parts.join(" ")} remaining
    </span>
  );
}
