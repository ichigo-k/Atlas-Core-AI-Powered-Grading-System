"use client";

import { Calendar, ClipboardList, LayoutDashboard, LogOut, Menu, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/signout";

interface StudentSidebarProps {
    userName: string | null | undefined;
}

const navItems = [
    { label: "Dashboard", href: "/student", Icon: LayoutDashboard },
    { label: "Assessments", href: "/student/assessments", Icon: ClipboardList },
    { label: "Schedule", href: "/student/schedule", Icon: Calendar },
];

export default function StudentSidebar({ userName }: StudentSidebarProps) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function handlePointerDown(event: MouseEvent | TouchEvent) {
            if (
                profileMenuRef.current &&
                !profileMenuRef.current.contains(event.target as Node)
            ) {
                setProfileOpen(false);
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
        };
    }, []);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-white border-r border-[#dadce0] z-40 shrink-0">
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-transparent shrink-0">
                    <Link href="/student" className="flex items-center gap-3">
                        <Image
                            src="/logos/gctu-logo.png"
                            alt="GCTU"
                            width={32}
                            height={32}
                            className="object-contain"
                        />
                        <div className="leading-tight">
                            <p className="text-sm font-bold text-[#202124]">
                                GCTU
                            </p>
                            <p
                                className="text-[10px] font-bold uppercase tracking-wider text-[#5f6368]"
                            >
                                Student Portal
                            </p>
                        </div>
                    </Link>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 py-4 pr-3 flex flex-col gap-1 overflow-y-auto">
                    {navItems.map(({ label, href, Icon }) => {
                        const active = pathname === href || (href !== "/student" && pathname.startsWith(href));
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`flex items-center gap-3 h-10 px-6 rounded-r-full text-sm font-medium transition-colors ${active ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]"}`}
                            >
                                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                                {label}
                            </Link>
                        );
                    })}
                </div>

                {/* Bottom Profile Area */}
                <div className="p-4 border-t border-[#dadce0] shrink-0">
                    <div ref={profileMenuRef} className="relative w-full">
                        <button
                            type="button"
                            onClick={() => setProfileOpen(!profileOpen)}
                            className="flex items-center gap-3 w-full rounded-full p-2 text-left hover:bg-[#f8f9fa] transition-colors"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f3f4] text-[#5f6368] shrink-0">
                                <User size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-xs font-semibold text-[#202124]">
                                    {userName}
                                </p>
                                <p className="text-[10px] text-[#5f6368]">Student</p>
                            </div>
                        </button>

                        {profileOpen ? (
                            <div
                                className="absolute bottom-full left-0 mb-2 w-full rounded-lg bg-white p-1.5 shadow-lg border border-[#dadce0]"
                            >
                                <Link
                                    href="/student/profile"
                                    onClick={() => setProfileOpen(false)}
                                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124] transition-colors"
                                >
                                    <User size={16} />
                                    Profile
                                </Link>
                                <div className="my-1 h-px bg-[#dadce0]" />
                                <form action={signOutAction}>
                                    <button
                                        type="submit"
                                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#d93025] hover:bg-[#fce8e6] transition-colors"
                                    >
                                        <LogOut size={16} />
                                        Sign out
                                    </button>
                                </form>
                            </div>
                        ) : null}
                    </div>
                </div>
            </aside>

            {/* Mobile Top Nav (visible only on small screens) */}
            <nav className="md:hidden sticky top-0 z-50 w-full bg-white border-b border-[#dadce0] flex h-14 items-center justify-between px-4">
                <Link href="/student" className="flex items-center gap-2">
                    <Image
                        src="/logos/gctu-logo.png"
                        alt="GCTU"
                        width={28}
                        height={28}
                        className="object-contain"
                    />
                    <span className="text-sm font-bold text-[#202124]">GCTU Portal</span>
                </Link>

                <button
                    type="button"
                    className="rounded-full p-2 text-[#5f6368] hover:bg-[#f8f9fa]"
                    onClick={() => setMenuOpen(!menuOpen)}
                >
                    {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </nav>

            {/* Mobile Sidebar Overlay */}
            {menuOpen ? (
                <>
                    <div 
                        className="fixed inset-0 z-40 bg-black/20 md:hidden" 
                        onClick={() => setMenuOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl flex flex-col md:hidden transform transition-transform duration-200">
                        <div className="h-14 flex items-center justify-between px-4 border-b border-[#dadce0]">
                            <span className="text-sm font-bold text-[#202124]">Menu</span>
                            <button
                                type="button"
                                className="rounded-full p-2 text-[#5f6368] hover:bg-[#f8f9fa]"
                                onClick={() => setMenuOpen(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex-1 py-4 pr-3 flex flex-col gap-1 overflow-y-auto">
                            {navItems.map(({ label, href, Icon }) => {
                                const active = pathname === href || (href !== "/student" && pathname.startsWith(href));
                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        onClick={() => setMenuOpen(false)}
                                        className={`flex items-center gap-3 h-10 px-6 rounded-r-full text-sm font-medium transition-colors ${active ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124]"}`}
                                    >
                                        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                                        {label}
                                    </Link>
                                );
                            })}
                        </div>
                        
                        <div className="p-4 border-t border-[#dadce0]">
                            <Link
                                href="/student/profile"
                                onClick={() => setMenuOpen(false)}
                                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#5f6368] hover:bg-[#f8f9fa] hover:text-[#202124] transition-colors"
                            >
                                <User size={16} />
                                Profile
                            </Link>
                            <form action={signOutAction} className="mt-1">
                                <button
                                    type="submit"
                                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#d93025] hover:bg-[#fce8e6] transition-colors"
                                >
                                    <LogOut size={16} />
                                    Sign out
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            ) : null}
        </>
    );
}
