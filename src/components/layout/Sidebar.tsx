"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOutAction } from "@/app/actions/signout"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface SidebarProps {
  role: "admin" | "lecturer" | "student"
  userName: string | null | undefined
  userId: string
  navItems: NavItem[]
}

function getInitials(userName: string | null | undefined, userId: string): string {
  if (userName && userName.trim().length > 0) {
    const parts = userName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return userId.slice(0, 2).toUpperCase()
}

const roleLabel: Record<string, string> = {
  admin: "Administrator",
  lecturer: "Lecturer",
  student: "Student",
}

const SupportIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const SignOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

export default function Sidebar({ role, userName, userId, navItems }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="fixed top-0 left-0 h-full w-64 flex flex-col z-40"
      style={{ backgroundColor: "transparent" }}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="flex items-center justify-center flex-shrink-0">
          <Image
            src="/logos/gctu-logo.png"
            alt="GCTU"
            width={48}
            height={48}
            className="object-contain"
          />
        </div>
        <div>
          <p className="text-xl font-bold leading-none tracking-tight text-[#002388]">GCTU</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Assessment Portal</p>
        </div>
      </div>


      {/* Nav */}
      <nav className="flex-1 px-4 py-2 overflow-y-auto space-y-1">
        {navItems.map((item: any) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${
                isActive ? "bg-[#EEF2FF] shadow-sm" : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#002388]"
              }`}
              style={isActive ? { color: "#002388" } : {}}
            >
              <span
                className={`flex-shrink-0 transition-colors ${isActive ? "text-[#002388]" : "text-[#94A3B8] group-hover:text-[#002388]"}`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-5 rounded-full bg-[#002388]" />
              )}
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}
