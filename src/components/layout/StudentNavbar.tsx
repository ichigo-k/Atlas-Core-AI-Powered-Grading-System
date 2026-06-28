"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { usePersistedBool } from "@/hooks/usePersistedBool";
import {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  BarChart2,
  User,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { signOutAction } from "@/app/actions/signout";

interface StudentNavbarProps {
  ongoingCount: number;
  onClose?: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/student", Icon: LayoutDashboard, exact: true, badge: null as "live" | null },
  { label: "Assessments", href: "/student/assessments", Icon: ClipboardList, exact: false, badge: "live" as "live" | null },
  { label: "Schedule", href: "/student/schedule", Icon: Calendar, exact: false, badge: null as "live" | null },
  { label: "My Grades", href: "/student/grades", Icon: BarChart2, exact: false, badge: null as "live" | null },
];

const ACCOUNT_ITEMS = [
  { label: "My Profile", href: "/student/profile", Icon: User },
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
        <Loader2 size={16} className="flex-shrink-0 animate-spin" />
      ) : (
        <LogOut size={16} className="flex-shrink-0" />
      )}
      {!collapsed && (
        <span className="text-[13px] font-medium">
          {pending ? "Signing out..." : "Sign Out"}
        </span>
      )}
      {collapsed && !pending && (
        <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
          Sign Out
        </div>
      )}
    </button>
  );
}

export default function StudentNavbar({ ongoingCount, onClose }: StudentNavbarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed, hydrated] = usePersistedBool("nav.student.collapsed", false);

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const w = collapsed ? "w-[48px]" : "w-[200px]";

  return (
    <nav
      className={`h-full bg-white dark:bg-[#0a1929] border-r border-border flex flex-col overflow-hidden ${hydrated ? "transition-[width] duration-200 ease-in-out" : ""} ${w}`}
    >
      {/* Main nav */}
      <div className="flex-1 py-1 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">
            Main
          </div>
        )}
        {collapsed && <div className="h-3" />}

        {NAV_ITEMS.map(({ label, href, Icon, exact, badge }) => {
          const active = isActive(href, exact);
          const showBadge = badge === "live" && ongoingCount > 0;

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
                  ? "bg-[#dde5f5] text-[#002388] border-[#002388]"
                  : "text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.2 : 1.8}
                className={`flex-shrink-0 ${active ? "text-[#002388]" : "text-slate-400"}`}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 text-[13px] font-medium whitespace-nowrap">{label}</span>
                  {showBadge && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#d83b01] text-white text-[10px] font-bold leading-none">
                      {ongoingCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && showBadge && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#d83b01]" />
              )}
              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {label}
                  {showBadge && (
                    <span className="ml-1.5 bg-[#d83b01] text-white text-[9px] px-1 py-0.5 rounded-full font-bold">
                      {ongoingCount}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}

        {/* Account section */}
        <div className={`mt-1 ${collapsed ? "h-px mx-3 bg-slate-200" : "px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 whitespace-nowrap"}`}>
          {!collapsed && "Account"}
        </div>
        {collapsed && <div className="h-3" />}

        {ACCOUNT_ITEMS.map(({ label, href, Icon }) => {
          const active = isActive(href, false);
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
                  ? "bg-[#dde5f5] text-[#002388] border-[#002388]"
                  : "text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2.2 : 1.8}
                className={`flex-shrink-0 ${active ? "text-[#002388]" : "text-slate-400"}`}
              />
              {!collapsed && (
                <span className="flex-1 text-[13px] font-medium whitespace-nowrap">{label}</span>
              )}
              {collapsed && (
                <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {label}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Sign out */}
      <div className="border-t border-border py-1 flex-shrink-0">
        {/* Collapse toggle - desktop only */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={[
            "hidden lg:flex items-center gap-2.5 w-full transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700 relative group",
            collapsed ? "px-0 py-[10px] justify-center" : "px-3 py-[9px]",
          ].join(" ")}
        >
          {collapsed ? <PanelLeftOpen size={16} className="flex-shrink-0" /> : <PanelLeftClose size={16} className="flex-shrink-0" />}
          {!collapsed && <span className="text-[13px] font-medium">Collapse</span>}
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
