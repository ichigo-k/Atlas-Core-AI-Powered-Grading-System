"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Library,
  FileCheck,
  User,
  LogOut,
} from "lucide-react";
import { signOutAction } from "@/app/actions/signout";

interface LecturerNavSidebarProps {
  onClose?: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard",     href: "/lecturer",              Icon: LayoutDashboard, exact: true  },
  { label: "Assessments",   href: "/lecturer/assessments",  Icon: ClipboardList,   exact: false },
  { label: "Question Bank", href: "/lecturer/question-bank",Icon: Library,         exact: false },
  { label: "Grade Book",    href: "/lecturer/grades",       Icon: FileCheck,       exact: false },
];

export default function LecturerNavSidebar({ onClose }: LecturerNavSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="h-full w-56 bg-white border-r border-border flex flex-col overflow-y-auto">
      <div className="flex-1 py-2">
        <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Main
        </div>

        {NAV_ITEMS.map(({ label, href, Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={[
                "flex items-center gap-2.5 px-4 py-[9px] text-[13px]",
                "border-l-[3px] transition-colors",
                active
                  ? "bg-blue-50 text-primary border-accent font-semibold"
                  : "text-[#323130] border-transparent hover:bg-slate-50",
              ].join(" ")}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2.2 : 1.8}
                className={active ? "text-primary" : "text-[#94A3B8]"}
              />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}

        <div className="px-4 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Account
        </div>

        <Link
          href="/lecturer/profile"
          onClick={onClose}
          className={[
            "flex items-center gap-2.5 px-4 py-[9px] text-[13px]",
            "border-l-[3px] transition-colors",
            isActive("/lecturer/profile", false)
              ? "bg-blue-50 text-primary border-accent font-semibold"
              : "text-[#323130] border-transparent hover:bg-slate-50",
          ].join(" ")}
        >
          <User
            size={15}
            strokeWidth={isActive("/lecturer/profile", false) ? 2.2 : 1.8}
            className={isActive("/lecturer/profile", false) ? "text-primary" : "text-[#94A3B8]"}
          />
          My Profile
        </Link>
      </div>

      <div className="border-t border-border py-2">
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-2.5 w-full px-4 py-[9px] text-[13px] text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={15} className="opacity-70" />
            Sign Out
          </button>
        </form>
      </div>
    </nav>
  );
}
