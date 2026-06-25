"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePersistedBool } from "@/hooks/usePersistedBool";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  BookOpen,
  Building2,
  School,
  Settings,
  KeyRound,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  History,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/actions/signout";

interface AdminNavSidebarProps {
  onClose?: () => void;
}

type NavItem = { label: string; href: string; Icon: LucideIcon; exact: boolean };
type NavGroup = { heading: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Main",
    items: [
      { label: "Dashboard", href: "/admin", Icon: LayoutDashboard, exact: true },
    ],
  },
  {
    heading: "Management",
    items: [
      { label: "Users", href: "/admin/users", Icon: Users, exact: false },
      { label: "Classes", href: "/admin/classes", Icon: FolderKanban, exact: false },
      { label: "Courses", href: "/admin/courses", Icon: BookOpen, exact: false },
      { label: "Faculties", href: "/admin/faculties", Icon: Building2, exact: false },
      { label: "Programs", href: "/admin/programs", Icon: School, exact: false },
    ],
  },
  {
    heading: "Records",
    items: [
      { label: "Student History", href: "/admin/student-history", Icon: History, exact: false },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Settings", href: "/admin/settings", Icon: Settings, exact: false },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "Change Password", href: "/admin/change-password", Icon: KeyRound, exact: false },
    ],
  },
];

export default function AdminNavSidebar({ onClose }: AdminNavSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed, hydrated] = usePersistedBool("nav.admin.collapsed", false);

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const w = collapsed ? "w-[48px]" : "w-56";

  return (
    <nav
      className={`h-full bg-white dark:bg-[#0a1929] border-r border-border flex flex-col overflow-hidden ${hydrated ? "transition-[width] duration-200 ease-in-out" : ""} ${w}`}
    >
      <div className="flex-1 py-1 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map(({ heading, items }) => (
          <div key={heading}>
            {!collapsed && (
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                {heading}
              </div>
            )}
            {collapsed && <div className="h-2" />}
            {items.map(({ label, href, Icon, exact }) => {
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
          </div>
        ))}
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
          <button
            type="submit"
            title={collapsed ? "Sign Out" : undefined}
            className={[
              "flex items-center gap-2.5 w-full transition-colors text-slate-500 hover:bg-slate-100 hover:text-red-600 relative group",
              collapsed ? "px-0 py-[10px] justify-center" : "px-3 py-[9px]",
            ].join(" ")}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {!collapsed && <span className="text-[13px]">Sign Out</span>}
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-[#323130] text-white text-[11px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Sign Out
              </div>
            )}
          </button>
        </form>
      </div>
    </nav>
  );
}
