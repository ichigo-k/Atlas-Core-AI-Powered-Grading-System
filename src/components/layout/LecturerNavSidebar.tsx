"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { usePersistedBool } from "@/hooks/usePersistedBool";
import {
  LayoutDashboard,
  ClipboardList,
  Library,
  FileCheck,
  User,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { signOutAction } from "@/app/actions/signout";

interface LecturerNavSidebarProps {
  onClose?: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/lecturer", Icon: LayoutDashboard, exact: true },
  { label: "Assessments", href: "/lecturer/assessments", Icon: ClipboardList, exact: false },
  { label: "Question Bank", href: "/lecturer/question-bank", Icon: Library, exact: false },
  { label: "Grade Book", href: "/lecturer/grades", Icon: FileCheck, exact: false },
];
function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={collapsed ? "Sign Out" : undefined}
      className={[
        "flex items-center gap-2.5 w-full transition-colors text-slate-500 hover:bg-slate-100 hover:text-red-600 relative group disabled:opacity-50",
        collapsed ? "px-0 py-[10px] justify-center" : "px-3 py-[9px]",
      ].join(" ")}
    >
      {pending ? (
        <Loader2 size={15} className="flex-shrink-0 animate-spin" />
      ) : (
        <LogOut size={15} className="flex-shrink-0" />
      )}
      {!collapsed && <span className="text-[13px]">{pending ? "Signing out..." : "Sign Out"}</span>}
      {collapsed && !pending && (
        <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
          Sign Out
        </div>
      )}
    </button>
  );
}

export default function LecturerNavSidebar({ onClose }: LecturerNavSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed, hydrated] = usePersistedBool("nav.lecturer.collapsed", false);

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const w = collapsed ? "w-[48px]" : "w-64 lg:w-56";

  return (
    <nav
      className={`h-full bg-white dark:bg-[#0a1929] border-r border-border flex flex-col overflow-hidden ${hydrated ? "transition-[width] duration-200 ease-in-out" : ""} ${w}`}
    >
      <div className="flex-1 py-1 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
            Main
          </div>
        )}
        {collapsed && <div className="h-3" />}

        {NAV_ITEMS.map(({ label, href, Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={[
                "flex items-center gap-2.5 transition-colors relative group",
                "border-l-[3px]",
                collapsed ? "px-0 py-[10px] justify-center" : "px-3 py-[9px]",
                active
                  ? "bg-[#dde5f5] text-[#002388] border-[#002388] font-semibold"
                  : "text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <Icon
                size={15}
                strokeWidth={active ? 2.2 : 1.8}
                className={`flex-shrink-0 ${active ? "text-[#002388]" : "text-[#94A3B8]"}`}
              />
              {!collapsed && <span className="flex-1 text-[13px] whitespace-nowrap">{label}</span>}
              {collapsed && (
                <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {label}
                </div>
              )}
            </Link>
          );
        })}

        {!collapsed && (
          <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
            Account
          </div>
        )}
        {collapsed && <div className="h-1" />}

        {(() => {
          const active = isActive("/lecturer/profile", false);
          return (
            <Link
              href="/lecturer/profile"
              onClick={onClose}
              title={collapsed ? "My Profile" : undefined}
              className={[
                "flex items-center gap-2.5 transition-colors relative group",
                "border-l-[3px]",
                collapsed ? "px-0 py-[10px] justify-center" : "px-3 py-[9px]",
                active
                  ? "bg-[#dde5f5] text-[#002388] border-[#002388] font-semibold"
                  : "text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <User
                size={15}
                strokeWidth={active ? 2.2 : 1.8}
                className={`flex-shrink-0 ${active ? "text-[#002388]" : "text-[#94A3B8]"}`}
              />
              {!collapsed && <span className="flex-1 text-[13px] whitespace-nowrap">My Profile</span>}
              {collapsed && (
                <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  My Profile
                </div>
              )}
            </Link>
          );
        })()}
      </div>

      <div className="border-t border-border py-1 flex-shrink-0">
        {/* Collapse toggle — desktop only */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={[
            "hidden lg:flex items-center gap-2.5 w-full transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700 relative group",
            collapsed ? "px-0 py-[10px] justify-center" : "px-3 py-[9px]",
          ].join(" ")}
        >
          {collapsed
            ? <PanelLeftOpen size={15} className="flex-shrink-0" />
            : <PanelLeftClose size={15} className="flex-shrink-0" />}
          {!collapsed && <span className="text-[13px]">Collapse</span>}
          {collapsed && (
            <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
              Expand
            </div>
          )}
        </button>
        <form action={signOutAction}>
          <SignOutButton collapsed={collapsed} />
        </form>
      </div>
    </nav>
  );
}
