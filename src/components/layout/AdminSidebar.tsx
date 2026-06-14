"use client";

import {
	BookOpen,
	Building2,
	FolderKanban,
	LayoutDashboard,
	LogOut,
	Menu,
	School,
	Settings,
	Users,
	X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction } from "@/app/actions/signout";

const navItems = [
	{ label: "Dashboard", href: "/admin", Icon: LayoutDashboard },
	{ label: "Users", href: "/admin/users", Icon: Users },
	{ label: "Classes", href: "/admin/classes", Icon: FolderKanban },
	{ label: "Courses", href: "/admin/courses", Icon: BookOpen },
	{ label: "Faculties", href: "/admin/faculties", Icon: Building2 },
	{ label: "Programs", href: "/admin/programs", Icon: School },
	{ label: "Settings", href: "/admin/settings", Icon: Settings },
];

interface AdminSidebarProps {
	userName: string | null | undefined;
	userId?: string;
}

function getInitials(userName: string | null | undefined, userId?: string) {
	if (userName && userName.trim().length > 0) {
		const parts = userName.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
		}
		return parts[0].slice(0, 2).toUpperCase();
	}

	return (userId ?? "AD").slice(0, 2).toUpperCase();
}

export default function AdminSidebar({ userName, userId }: AdminSidebarProps) {
	const pathname = usePathname();
	const initials = getInitials(userName, userId);
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<>
			<header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 xl:hidden">
				<Link href="/admin" className="flex items-center gap-3">
					<Image
						src="/logos/gctu-logo.png"
						alt="GCTU"
						width={36}
						height={36}
						className="object-contain"
					/>
					<div>
						<p className="text-base font-semibold leading-none text-slate-900">
							GCTU Admin
						</p>
						<p className="mt-1 text-xs text-slate-500">Assessment Portal</p>
					</div>
				</Link>
				<button
					type="button"
					aria-label="Open admin navigation"
					onClick={() => setMobileOpen(true)}
					className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
				>
					<Menu size={20} />
				</button>
			</header>

			{mobileOpen ? (
				<div className="fixed inset-0 z-50 xl:hidden">
					<button
						type="button"
						aria-label="Close admin navigation"
						className="absolute inset-0 bg-slate-900/30"
						onClick={() => setMobileOpen(false)}
					/>
					<div className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] border-r border-slate-200 bg-white">
						<SidebarContent
							initials={initials}
							pathname={pathname}
							userName={userName}
							onNavigate={() => setMobileOpen(false)}
						/>
						<button
							type="button"
							aria-label="Close admin navigation"
							onClick={() => setMobileOpen(false)}
							className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
						>
							<X size={18} />
						</button>
					</div>
				</div>
			) : null}

			<aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col">
				<SidebarContent
					initials={initials}
					pathname={pathname}
					userName={userName}
				/>
			</aside>
		</>
	);
}

function SidebarContent({
	initials,
	pathname,
	userName,
	onNavigate,
}: {
	initials: string;
	pathname: string;
	userName: string | null | undefined;
	onNavigate?: () => void;
}) {
	return (
		<div className="flex h-full flex-col">
			<div className="border-b border-slate-100 px-5 py-5">
				<Link
					href="/admin"
					onClick={onNavigate}
					className="flex items-center gap-3"
				>
					<div className="flex shrink-0 items-center justify-center">
						<Image
							src="/logos/gctu-logo.png"
							alt="GCTU"
							width={42}
							height={42}
							className="object-contain"
						/>
					</div>
					<div>
						<p className="text-lg font-semibold leading-none tracking-tight text-slate-900">
							GCTU Admin
						</p>
						<p className="mt-1 text-xs font-medium text-slate-500">
							Assessment Portal
						</p>
					</div>
				</Link>
			</div>

			<div className="flex-1 overflow-y-auto px-3 py-4">
				<div className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-slate-500">
					Workspace
				</div>
				<nav className="space-y-1">
					{navItems.map(({ label, href, Icon }) => {
						const active =
							pathname === href ||
							(href !== "/admin" && pathname.startsWith(`${href}/`));

						return (
							<Link
								key={href}
								href={href}
								onClick={onNavigate}
								className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
									active
										? "bg-[#e8f0fe] text-[#1967d2]"
										: "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
								}`}
							>
								<Icon
									size={18}
									className={
										active
											? "text-[#1967d2]"
											: "text-slate-500 group-hover:text-slate-800"
									}
								/>
								<span className="flex-1">{label}</span>
							</Link>
						);
					})}
				</nav>
			</div>

			<div className="border-t border-slate-100 p-3">
				<Link
					href="/admin/change-password"
					onClick={onNavigate}
					className={`mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
						pathname === "/admin/change-password"
							? "bg-[#e8f0fe] text-[#1967d2]"
							: "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
					}`}
				>
					<Settings
						size={18}
						className={
							pathname === "/admin/change-password"
								? "text-[#1967d2]"
								: "text-slate-500"
						}
					/>
					Account settings
				</Link>
				<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1967d2] text-xs font-semibold text-white uppercase">
							{initials}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold text-slate-900">
								{userName ?? "Admin User"}
							</p>
							<p className="mt-0.5 truncate text-xs text-slate-500">
								System Administrator
							</p>
						</div>
					</div>
					<form action={signOutAction} className="mt-4">
						<button
							type="submit"
							className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600"
						>
							<LogOut size={14} />
							Sign Out
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
