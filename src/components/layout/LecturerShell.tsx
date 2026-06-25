"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, HelpCircle, Menu } from "lucide-react";
import LecturerNavSidebar from "./LecturerNavSidebar";
import ThemeToggle from "./ThemeToggle";

interface LecturerShellProps {
  children: React.ReactNode;
  userName: string | null | undefined;
  userEmail: string | null | undefined;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "L";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function LecturerShell({
  children,
  userName,
  userEmail,
}: LecturerShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = getInitials(userName);
  const lecturerId = userEmail?.split("@")[0] ?? "";

  return (
    <div className="h-screen overflow-hidden bg-[#f8f9fa] dark:bg-[#1b1b1f] flex flex-col">

      {/* ── TOP BAR (flex row child, not fixed) ── */}
      <header className="h-12 flex-shrink-0 bg-primary dark:bg-[#002388] flex items-center gap-2 px-3 sm:px-4 z-50 relative overflow-hidden">
        {/* Kente-inspired pattern overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          <defs>
            <pattern id="kp-l" width="24" height="12" patternUnits="userSpaceOnUse">
              <polyline points="0,6 6,0 12,6 18,0 24,6" fill="none" stroke="white" strokeWidth="0.7" />
              <polyline points="0,12 6,6 12,12 18,6 24,12" fill="none" stroke="white" strokeWidth="0.7" />
              <polygon points="6,-1.5 7.5,0 6,1.5 4.5,0" fill="white" />
              <polygon points="18,-1.5 19.5,0 18,1.5 16.5,0" fill="white" />
              <polygon points="6,4.5 7.5,6 6,7.5 4.5,6" fill="white" />
              <polygon points="18,4.5 19.5,6 18,7.5 16.5,6" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#kp-l)" opacity="0.09" />
        </svg>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <Link
          href="/lecturer"
          className="flex items-center gap-2.5 pr-4 border-r border-white/15 h-full"
        >
          <Image
            src="/logos/gctu-logo.png"
            alt="GCTU"
            width={34}
            height={34}
            className="rounded-full object-cover flex-shrink-0"
            priority
          />
          <div className="hidden sm:block leading-tight">
            <div className="text-white font-semibold text-[13px]">GCTU Exam Portal</div>
            <div className="text-white/55 text-[9.5px]">Lecturer Portal</div>
          </div>
        </Link>

        <Link
          href="/lecturer/assessments"
          className="hidden md:flex flex-1 max-w-md items-center gap-2 bg-white/10 hover:bg-white/[0.16] rounded px-3 h-[28px] text-white/60 text-[12px] transition-colors ml-1"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Search assessments…
        </Link>

        <div className="ml-auto flex items-center gap-0.5">
          <ThemeToggle onDark />
          <Link
            href="/lecturer"
            className="w-9 h-9 flex items-center justify-center rounded text-white/75 hover:text-white hover:bg-white/12 transition-colors"
          >
            <Bell size={17} />
          </Link>
          <Link
            href="/lecturer/profile"
            className="w-9 h-9 flex items-center justify-center rounded text-white/75 hover:text-white hover:bg-white/12 transition-colors"
          >
            <HelpCircle size={17} />
          </Link>
          <Link
            href="/lecturer/profile"
            className="flex items-center gap-2 ml-2 pl-3 border-l border-white/15 hover:bg-white/10 rounded px-2 py-1 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-accent text-primary flex items-center justify-center font-bold text-[11px] flex-shrink-0 select-none">
              {initials}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-white text-[12px] font-semibold">{userName ?? "Lecturer"}</div>
              <div className="text-white/55 text-[10px]">{lecturerId}</div>
            </div>
          </Link>
        </div>
      </header>

      {/* ── BODY: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Left sidebar */}
        <div
          className={[
            "fixed top-12 bottom-0 left-0 z-50",
            "transition-transform duration-200 ease-in-out",
            "lg:static lg:top-auto lg:bottom-auto lg:z-auto lg:translate-x-0 lg:flex-shrink-0 lg:h-full",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <LecturerNavSidebar onClose={() => setMobileOpen(false)} />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto min-w-0 bg-[#f8f9fa] dark:bg-[#1b1b1f]">
          {children}
        </main>
      </div>
    </div>
  );
}
