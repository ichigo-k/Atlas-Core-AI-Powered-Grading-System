"use client";

import { Calendar, ClipboardList, LayoutDashboard, LogOut, Menu, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/signout";

interface StudentNavbarProps {
    userName: string | null | undefined;
}

const navItems = [
    { label: "Dashboard", href: "/student", Icon: LayoutDashboard },
    { label: "Assessments", href: "/student/assessments", Icon: ClipboardList },
    { label: "Schedule", href: "/student/schedule", Icon: Calendar },
];

export default function StudentNavbar({ userName }: StudentNavbarProps) {
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
            <nav
                className="sticky top-0 z-50 w-full bg-white border-b border-[#dadce0]"
            >
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:px-6">
                    <Link href="/student" className="flex shrink-0 items-center gap-2">
                        <Image
                            src="/logos/gctu-logo.png"
                            alt="GCTU"
                            width={38}
                            height={38}
                            className="object-contain"
                        />
                        <div className="hidden leading-tight sm:block">
                            <p className="text-sm font-bold text-[#202124]">
                                GCTU
                            </p>
                            <p
                                className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: "#64748B" }}
                            >
                                Student Portal
                            </p>
                        </div>
                    </Link>

                    <div className="hidden flex-1 items-center gap-1.5 md:flex ml-4">
                        {navItems.map(({ label, href, Icon }) => {
                            const active =
                                pathname === href ||
                                (href !== "/student" && pathname.startsWith(href));
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`flex h-9 items-center gap-2 px-4 rounded-full text-sm font-medium transition-colors ${active ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#5f6368] hover:bg-slate-100"}`}
                                >
                                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                                    {label}
                                </Link>
                            );
                        })}
                    </div>

                    <div className="ml-auto flex items-center gap-1">
                        <div ref={profileMenuRef} className="relative ml-1">
                            <button
                                type="button"
                                onClick={() => setProfileOpen(!profileOpen)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-[#5f6368] transition-colors hover:bg-slate-100"
                            >
                                <User size={20} />
                            </button>

                            {profileOpen ? (
                                <div
                                    className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white p-1.5 shadow-lg"
                                    style={{ border: "1px solid #E2E8F0" }}
                                >
                                    <div className="mb-1 px-3 py-2">
                                        <p
                                            className="truncate text-xs font-semibold"
                                            style={{ color: "#0A1628" }}
                                        >
                                            {userName}
                                        </p>
                                        <p className="text-[11px] text-slate-400">Student</p>
                                    </div>
                                    <Link
                                        href="/student/profile"
                                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                        <User size={14} />
                                        Profile
                                    </Link>
                                    <div className="my-1 h-px bg-slate-100" />
                                    <form action={signOutAction}>
                                        <button
                                            type="submit"
                                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
                                        >
                                            <LogOut size={14} />
                                            Sign out
                                        </button>
                                    </form>
                                </div>
                            ) : null}
                        </div>

                        <button
                            type="button"
                            className="ml-1 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 md:hidden"
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            {menuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>
                </div>
            </nav>

            {menuOpen ? (
                <div
                    className="fixed inset-x-0 top-14 z-40 flex flex-col gap-1 bg-white px-4 py-3 md:hidden shadow-lg border-b border-[#dadce0]"
                >
                    {navItems.map(({ label, href, Icon }) => {
                        const active = pathname === href || (href !== "/student" && pathname.startsWith(href));
                        return (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setMenuOpen(false)}
                                className={`flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors ${active ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#5f6368]"}`}
                            >
                                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            ) : null}
        </>
    );
}
