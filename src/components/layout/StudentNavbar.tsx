"use client";

import {
	Calendar,
	ClipboardList,
	LayoutDashboard,
	LogOut,
	User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/signout";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

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
		<nav className="fixed left-0 top-0 z-50 flex h-full w-[72px] flex-col items-center bg-discord-secondary py-3">
			{/* Logo Area */}
			<Link href="/student" className="discord-sidebar-item group mb-2">
				<div className="discord-sidebar-pill" />
				<div className="discord-sidebar-icon bg-white p-2 group-hover:rounded-[16px]">
					<Image
						src="/logos/gctu-logo.png"
						alt="GCTU"
						width={32}
						height={32}
						className="object-contain"
					/>
				</div>
			</Link>

			<div className="mb-2 h-[2px] w-8 rounded-full bg-[#35363C]" />

			{/* Nav Items */}
			<div className="flex flex-1 flex-col gap-2">
				<TooltipProvider delayDuration={0}>
					{navItems.map(({ label, href, Icon }) => {
						const active =
							pathname === href ||
							(href !== "/student" && pathname.startsWith(href));
						return (
							<Tooltip key={href}>
								<TooltipTrigger asChild>
									<Link
										href={href}
										className={`discord-sidebar-item ${active ? "active" : ""}`}
									>
										<div className="discord-sidebar-pill" />
										<div className="discord-sidebar-icon">
											<Icon size={24} />
										</div>
									</Link>
								</TooltipTrigger>
								<TooltipContent
									side="right"
									sideOffset={12}
									className="bg-black text-white border-none font-bold"
								>
									{label}
								</TooltipContent>
							</Tooltip>
						);
					})}
				</TooltipProvider>
			</div>

			{/* User Actions */}
			<div className="mt-auto flex flex-col gap-2">
				<div ref={profileMenuRef} className="relative">
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => setProfileOpen(!profileOpen)}
									className="discord-sidebar-item group"
								>
									<div className="discord-sidebar-pill" />
									<div className="discord-sidebar-icon">
										<User size={24} />
									</div>
								</button>
							</TooltipTrigger>
							<TooltipContent
								side="right"
								sideOffset={12}
								className="bg-black text-white border-none font-bold"
							>
								Profile
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{profileOpen && (
						<div className="absolute bottom-0 left-full ml-4 w-48 rounded-lg bg-discord-sidebar p-2 shadow-xl ring-1 ring-black/20 animate-in fade-in zoom-in-95 duration-100">
							<div className="mb-2 border-b border-white/10 px-2 py-1.5">
								<p className="truncate text-sm font-bold text-white">
									{userName}
								</p>
								<p className="text-[11px] font-medium text-slate-400">
									Student
								</p>
							</div>
							<Link
								href="/student/profile"
								className="flex items-center gap-2 rounded px-2 py-1.5 text-sm font-medium text-[#DBDEE1] transition-colors hover:bg-discord-blurple hover:text-white"
							>
								<User size={16} />
								Profile
							</Link>
							<form action={signOutAction} className="mt-1">
								<button
									type="submit"
									className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500 hover:text-white"
								>
									<LogOut size={16} />
									Sign out
								</button>
							</form>
						</div>
					)}
				</div>
			</div>
		</nav>
	);
}
