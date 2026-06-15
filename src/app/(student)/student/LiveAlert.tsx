"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Clock, X } from "lucide-react";
import { createOrResumeAttempt } from "@/lib/assessment-actions";

export type LiveAlertItem = {
  id: number;
  title: string;
  courseTitle: string;
  courseCode: string;
  durationMinutes: number | null;
  location: string | null;
  passwordProtected: boolean;
  proctoringEnabled: boolean;
};

export default function LiveAlert({ items }: { items: LiveAlertItem[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (dismissed || items.length === 0) return null;

  function handleEnter(item: LiveAlertItem) {
    if (item.passwordProtected) {
      router.push(`/student/assessments/${item.id}/assessment-onboarding`);
      return;
    }
    setStartingId(item.id);
    startTransition(async () => {
      const result = await createOrResumeAttempt(item.id);
      if ("error" in result) {
        router.push(`/student/assessments/${item.id}`);
        setStartingId(null);
        return;
      }
      router.push(
        `/student/assessments/${item.id}/assessment-onboarding?attemptId=${result.attemptId}`
      );
    });
  }

  return (
    <div className="relative bg-white border border-border rounded-sm overflow-hidden">
      {/* Red top bar */}
      <div className="h-[3px] bg-[#d13438] w-full" />

      {items.map((item, i) => (
        <div
          key={item.id}
          className={`flex items-center gap-4 px-4 py-3 ${
            i < items.length - 1 ? "border-b border-[#f1f5f9]" : ""
          }`}
        >
          {/* Live badge */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d13438] opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d13438]" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#d13438]">
              Live
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-7 bg-border flex-shrink-0" />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {item.courseCode}
              </span>
              <span className="text-[13px] font-semibold text-[#1e293b] truncate">
                {item.title}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
              {item.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />
                  {item.location}
                </span>
              )}
              {item.durationMinutes != null && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {item.durationMinutes >= 60
                    ? `${Math.floor(item.durationMinutes / 60)}h${item.durationMinutes % 60 > 0 ? ` ${item.durationMinutes % 60}m` : ""}`
                    : `${item.durationMinutes}m`}
                </span>
              )}
            </div>
          </div>

          {/* Enter exam button */}
          <button
            type="button"
            disabled={isPending && startingId === item.id}
            onClick={() => handleEnter(item)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[12px] font-semibold rounded-sm hover:bg-[#001570] transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {isPending && startingId === item.id ? "Loading…" : "Enter Exam"}
            <ArrowRight size={12} />
          </button>
        </div>
      ))}

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 p-1 text-muted-foreground hover:text-[#1e293b] rounded transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
}
