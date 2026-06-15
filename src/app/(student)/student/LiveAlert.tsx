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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-full max-w-2xl px-4 pointer-events-none">
      <div
        className="pointer-events-auto rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-[#fca5a5] overflow-hidden"
        style={{ background: "#fff1f2" }}
      >
        {/* Red accent bar */}
        <div className="h-[3px] bg-[#dc2626] w-full" />

        <div className="px-4 py-3 flex items-start gap-3">
          {/* Pulsing dot */}
          <div className="flex-shrink-0 mt-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#dc2626] opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 ${i < items.length - 1 ? "pb-2 border-b border-[#fca5a5]" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#dc2626]">
                      Live
                    </span>
                    <span className="text-[10px] text-[#7f1d1d] font-semibold uppercase">{item.courseCode}</span>
                    <span className="text-[13px] font-semibold text-[#1e293b] truncate">{item.title}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[11px] text-[#991b1b]">
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

                <button
                  type="button"
                  disabled={isPending && startingId === item.id}
                  onClick={() => handleEnter(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#dc2626] text-white text-[12px] font-semibold rounded hover:bg-[#b91c1c] transition-colors disabled:opacity-60 flex-shrink-0"
                >
                  {isPending && startingId === item.id ? "Loading…" : "Enter Exam"}
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="flex-shrink-0 p-1 text-[#991b1b] hover:text-[#7f1d1d] hover:bg-[#fecaca] rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
