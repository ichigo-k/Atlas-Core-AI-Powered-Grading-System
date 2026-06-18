"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Bell, CheckCheck, AlertCircle, Award, Calendar, Loader2 } from "lucide-react";

export type Notification = {
  id: number;
  type: "ASSESSMENT_LIVE" | "RESULTS_RELEASED" | "REMINDER" | "SYSTEM";
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  ongoingCount: number;
}

const TYPE_META = {
  ASSESSMENT_LIVE:   { Icon: AlertCircle, color: "text-[#d83b01]", bg: "bg-red-50" },
  RESULTS_RELEASED:  { Icon: Award,       color: "text-[#107c10]", bg: "bg-green-50" },
  REMINDER:          { Icon: Calendar,    color: "text-[#002388]", bg: "bg-blue-50" },
  SYSTEM:            { Icon: Bell,        color: "text-[#8a8886]", bg: "bg-slate-50" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPanel({ open, onClose, ongoingCount }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/student/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, [open]);

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/student/notifications/read-all", { method: "PATCH" }).catch(() => {});
    setNotifications((n) => n.map((x) => ({ ...x, readAt: new Date().toISOString() })));
    setMarkingAll(false);
  }

  async function markOneRead(id: number) {
    await fetch(`/api/student/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
    setNotifications((n) => n.map((x) => x.id === id ? { ...x, readAt: new Date().toISOString() } : x));
  }

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      {/* Slide panel */}
      <aside
        className={`
          fixed top-[48px] right-0 bottom-0 z-50 w-[340px] bg-white border-l border-[#edebe9]
          flex flex-col shadow-xl
          transition-transform duration-250 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#edebe9] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={15} className="text-[#002388]" />
            <span className="text-[14px] font-semibold text-[#323130]">Notifications</span>
            {unread > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#002388] text-white text-[10px] font-bold">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#002388] hover:bg-[#dde5f5] rounded transition-colors disabled:opacity-50"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-[#8a8886] hover:bg-[#f8f9fa] hover:text-[#323130] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Live exam banner */}
        {ongoingCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#d83b01] flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-[12px] font-semibold">
                {ongoingCount} exam{ongoingCount > 1 ? "s" : ""} live right now
              </p>
            </div>
            <Link
              href="/student/assessments"
              onClick={onClose}
              className="text-white/90 hover:text-white text-[11px] font-semibold underline flex-shrink-0"
            >
              Go →
            </Link>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#8a8886]">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-full bg-[#f8f9fa] flex items-center justify-center">
                <Bell size={22} className="text-[#c8c6c4]" />
              </div>
              <p className="text-[13px] font-semibold text-[#323130]">You&apos;re all caught up</p>
              <p className="text-[12px] text-[#8a8886]">Notifications about live exams and results will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#f8f9fa]">
              {notifications.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM;
                const isUnread = !n.readAt;
                const content = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      isUnread ? "bg-[#f0f6ff] hover:bg-[#e8f0fd]" : "hover:bg-[#f8f9fa]"
                    }`}
                    onClick={() => isUnread && markOneRead(n.id)}
                  >
                    <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <meta.Icon size={14} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[12px] leading-snug ${isUnread ? "font-semibold text-[#323130]" : "font-medium text-[#605e5c]"}`}>
                          {n.title}
                        </p>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-[#002388] flex-shrink-0 mt-1" />}
                      </div>
                      {n.body && (
                        <p className="text-[11px] text-[#8a8886] mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-[#a19f9d] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );

                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => { markOneRead(n.id); onClose(); }}>
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
