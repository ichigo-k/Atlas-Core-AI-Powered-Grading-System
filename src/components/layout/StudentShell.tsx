"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, HelpCircle, Menu, X } from "lucide-react";
import StudentNavbar from "./StudentNavbar";
import NotificationsPanel from "./NotificationsPanel";
import ModelPrefetcher from "@/components/student/ModelPrefetcher";

interface StudentShellProps {
  children: React.ReactNode;
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  ongoingCount: number;
  unreadNotifCount?: number;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "S";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p: any) => p[0]).join("").toUpperCase();
}

export default function StudentShell({
  children,
  userName,
  userEmail,
  ongoingCount,
  unreadNotifCount = 0,
}: StudentShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const initials = getInitials(userName);
  const studentId = userEmail?.split("@")[0] ?? "";

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f9fa] dark:bg-[#0f1b2d]">
      {/* Quietly warm the shared ML model cache (proctoring models) so the
          exam onboarding camera-check doesn't pay the load cost cold. */}
      <ModelPrefetcher />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Notification panel overlay */}
      {notifOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setNotifOpen(false)}
        />
      )}

      {/* ── TOP BAR ── */}
      <header className="sticky top-0 z-50 h-[48px] bg-[#002388] flex items-center overflow-hidden">
        {/* Kente-inspired pattern overlay (matches lecturer / admin shells) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          <defs>
            <pattern id="kp-s" width="24" height="12" patternUnits="userSpaceOnUse">
              <polyline points="0,6 6,0 12,6 18,0 24,6" fill="none" stroke="white" strokeWidth="0.7" />
              <polyline points="0,12 6,6 12,12 18,6 24,12" fill="none" stroke="white" strokeWidth="0.7" />
              <polygon points="6,-1.5 7.5,0 6,1.5 4.5,0" fill="white" />
              <polygon points="18,-1.5 19.5,0 18,1.5 16.5,0" fill="white" />
              <polygon points="6,4.5 7.5,6 6,7.5 4.5,6" fill="white" />
              <polygon points="18,4.5 19.5,6 18,7.5 16.5,6" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#kp-s)" opacity="0.09" />
        </svg>

        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="lg:hidden relative z-10 p-1.5 ml-2 rounded text-white/80 hover:text-white hover:bg-white/12 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        {/* Logo + name */}
        <Link
          href="/student"
          className="relative z-10 flex items-center gap-2.5 px-3 h-full border-r border-white/15 flex-shrink-0"
        >
          <Image
            src="/logos/gctu-logo.png"
            alt="GCTU"
            width={30}
            height={30}
            className="rounded-full object-cover flex-shrink-0"
            priority
          />
          <div className="hidden sm:block leading-tight">
            <div className="text-white font-semibold text-[13px] leading-none">GCTU Exam Portal</div>
            <div className="text-white/55 text-[9.5px] mt-0.5 leading-none">Ghana Communication Technology University</div>
          </div>
        </Link>

        {/* Search bar */}
        <Link
          href="/student/assessments"
          className="relative z-10 hidden md:flex flex-1 max-w-sm items-center gap-2 mx-3 bg-white/12 hover:bg-white/18 rounded px-3 h-[28px] text-white/60 text-[12px] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          Search assessments…
        </Link>

        {/* Right actions */}
        <div className="relative z-10 ml-auto flex items-center pr-1">
          {/* Help */}
          <Link
            href="/student/profile"
            className="w-9 h-9 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/12 transition-colors"
            title="Help"
          >
            <HelpCircle size={17} />
          </Link>

          {/* Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="w-9 h-9 flex items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/12 transition-colors"
              title="Notifications"
            >
              <Bell size={17} />
            </button>
            {(unreadNotifCount > 0 || ongoingCount > 0) && (
              <span className="pointer-events-none absolute top-[9px] right-[8px] w-2 h-2 rounded-full bg-red-500 border-[1.5px] border-[#002388]" />
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/20 mx-1" />

          {/* Avatar chip */}
          <Link
            href="/student/profile"
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/12 transition-colors ml-0.5"
          >
            <div className="w-7 h-7 rounded-full bg-white text-[#002388] flex items-center justify-center font-bold text-[11px] flex-shrink-0 select-none">
              {initials}
            </div>
            <div className="hidden sm:block leading-tight max-w-[120px]">
              <div className="text-white text-[12px] font-semibold leading-none truncate">{userName ?? "Student"}</div>
              <div className="text-white/55 text-[10px] mt-0.5 leading-none truncate">{studentId}</div>
            </div>
          </Link>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1">
        {/* Left sidebar */}
        <div
          className={`
            fixed top-[48px] bottom-0 left-0 z-50
            transition-transform duration-200 ease-in-out
            lg:sticky lg:top-[48px] lg:bottom-auto lg:z-30 lg:h-[calc(100dvh-48px)] lg:flex-shrink-0 lg:translate-x-0
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <StudentNavbar
            ongoingCount={ongoingCount}
            onClose={() => setMobileOpen(false)}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* Notifications slide panel */}
      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        ongoingCount={ongoingCount}
      />
    </div>
  );
}
