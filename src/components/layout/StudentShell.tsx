"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, HelpCircle, Menu } from "lucide-react";
import StudentNavbar from "./StudentNavbar";

interface StudentShellProps {
  children: React.ReactNode;
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  ongoingCount: number;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "S";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function StudentShell({
  children,
  userName,
  userEmail,
  ongoingCount,
}: StudentShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = getInitials(userName);
  const studentId = userEmail?.split("@")[0] ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── TOP BAR (full-width, fixed) ── */}
      <header className="fixed inset-x-0 top-0 z-50 h-12 bg-primary flex items-center gap-2 px-3 sm:px-4 overflow-hidden">
        {/* Kente-inspired pattern overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          <defs>
            <pattern id="kp-s" width="24" height="12" patternUnits="userSpaceOnUse">
              <polyline points="0,6 6,0 12,6 18,0 24,6" fill="none" stroke="white" strokeWidth="0.7"/>
              <polyline points="0,12 6,6 12,12 18,6 24,12" fill="none" stroke="white" strokeWidth="0.7"/>
              <polygon points="6,-1.5 7.5,0 6,1.5 4.5,0" fill="white"/>
              <polygon points="18,-1.5 19.5,0 18,1.5 16.5,0" fill="white"/>
              <polygon points="6,4.5 7.5,6 6,7.5 4.5,6" fill="white"/>
              <polygon points="18,4.5 19.5,6 18,7.5 16.5,6" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#kp-s)" opacity="0.09"/>
        </svg>
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        {/* Logo + name */}
        <Link
          href="/student"
          className="flex items-center gap-2.5 pr-4 border-r border-white/15 h-full"
        >
          {/* Circle logo — dropped raw, no bg wrapper or padding */}
          <Image
            src="/logos/gctu-logo.png"
            alt="GCTU"
            width={34}
            height={34}
            className="rounded-full object-cover flex-shrink-0"
            priority
          />
          <div className="hidden sm:block leading-tight">
            <div className="text-white font-semibold text-[13px]">
              GCTU Exam Portal
            </div>
            <div className="text-white/55 text-[9.5px]">
              Ghana Communication Technology University
            </div>
          </div>
        </Link>

        {/* Global search — hidden on small screens */}
        <Link
          href="/student/assessments"
          className="hidden md:flex flex-1 max-w-md items-center gap-2 bg-white/10 hover:bg-white/[0.16] rounded px-3 h-[28px] text-white/60 text-[12px] transition-colors ml-1"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search assessments…
        </Link>

        {/* Right-side icons */}
        <div className="ml-auto flex items-center gap-0.5">
          {/* Notification bell — badge when live exams exist */}
          <div className="relative">
            <Link
              href="/student"
              className="w-9 h-9 flex items-center justify-center rounded text-white/75 hover:text-white hover:bg-white/12 transition-colors"
              title="Notifications"
            >
              <Bell size={17} />
            </Link>
            {ongoingCount > 0 && (
              <span className="pointer-events-none absolute top-[9px] right-[9px] w-2 h-2 rounded-full bg-accent border-[1.5px] border-primary" />
            )}
          </div>

          <Link
            href="/student/profile"
            className="w-9 h-9 flex items-center justify-center rounded text-white/75 hover:text-white hover:bg-white/12 transition-colors"
            title="Help / Profile"
          >
            <HelpCircle size={17} />
          </Link>

          {/* Avatar chip */}
          <Link
            href="/student/profile"
            className="flex items-center gap-2 ml-2 pl-3 border-l border-white/15 hover:bg-white/10 rounded px-2 py-1 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-accent text-primary flex items-center justify-center font-bold text-[11px] flex-shrink-0 select-none">
              {initials}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-white text-[12px] font-semibold">
                {userName ?? "Student"}
              </div>
              <div className="text-white/55 text-[10px]">{studentId}</div>
            </div>
          </Link>
        </div>
      </header>

      {/* ── BELOW TOP BAR ── */}
      <div className="flex flex-1 overflow-hidden pt-12">
        {/* Left blade — slide-in on mobile, static on desktop */}
        <div
          className={`
            fixed top-12 bottom-0 left-0 z-50 w-56
            transition-transform duration-200 ease-in-out
            lg:relative lg:top-0 lg:bottom-auto lg:z-auto lg:flex-shrink-0 lg:translate-x-0
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <StudentNavbar
            ongoingCount={ongoingCount}
            onClose={() => setMobileOpen(false)}
          />
        </div>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
