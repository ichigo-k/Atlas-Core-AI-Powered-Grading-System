"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      { label: "Users",     href: "/admin/users",     Icon: Users,        exact: false },
      { label: "Classes",   href: "/admin/classes",   Icon: FolderKanban, exact: false },
      { label: "Courses",   href: "/admin/courses",   Icon: BookOpen,     exact: false },
      { label: "Faculties", href: "/admin/faculties", Icon: Building2,    exact: false },
      { label: "Programs",  href: "/admin/programs",  Icon: School,       exact: false },
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

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="h-full w-56 bg-white border-r border-border flex flex-col overflow-y-auto">
      <div className="flex-1 py-2">
        {NAV_GROUPS.map(({ heading, items }) => (
          <div key={heading}>
            <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {heading}
            </div>
            {items.map(({ label, href, Icon, exact }) => {
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
          </div>
        ))}
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
