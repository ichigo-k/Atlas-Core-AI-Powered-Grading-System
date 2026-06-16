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
      <div className="pointer-events-auto rounded-xl shadow-[0_15px_40px_-10px_rgba(16,185,129,0.12)] border border-emerald-300 overflow-hidden bg-emerald-50/95 backdrop-blur-md transition-all duration-300">
        <div className="px-5 py-4 flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-4 ${i < items.length - 1 ? "pb-3 border-b border-emerald-100" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200/60 shadow-sm">
                      Live
                    </span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-100/50 font-mono font-semibold uppercase px-1.5 py-0.5 rounded border border-emerald-200/30">
                      {item.courseCode}
                    </span>
                    <span className="text-[14px] font-semibold text-emerald-950 tracking-tight truncate">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-emerald-800/80 font-medium">
                    {item.location && (
                      <span className="flex items-center gap-1 bg-emerald-100/40 border border-emerald-200/30 px-1.5 py-0.5 rounded-md">
                        <MapPin size={11} className="text-emerald-600" />
                        {item.location}
                      </span>
                    )}
                    {item.durationMinutes != null && (
                      <span className="flex items-center gap-1 bg-emerald-100/40 border border-emerald-200/30 px-1.5 py-0.5 rounded-md">
                        <Clock size={11} className="text-emerald-600" />
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
                  className="group relative flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[12px] font-semibold rounded-lg shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none flex-shrink-0"
                >
                  {isPending && startingId === item.id ? "Loading…" : "Enter Exam"}
                  <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
                </button>
              </div>
            ))}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="flex-shrink-0 p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200 rounded-full transition-colors self-start mt-0.5"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
