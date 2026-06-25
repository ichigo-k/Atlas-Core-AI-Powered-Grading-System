import { formatDistanceToNow } from "date-fns";
import {
	AlertTriangle,
	ArrowRight,
	BookOpen,
	Building2,
	CheckCircle2,
	FolderKanban,
	GraduationCap,
	History,
	LayoutDashboard,
	School,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import AdminPageShell from "@/components/layout/AdminPageShell";
import { getAdminDashboardStats } from "@/lib/admin-stats";
import { getSession } from "@/lib/session";

const statIcons = [Users, GraduationCap, FolderKanban, BookOpen];

const quickLinks = [
	{
		label: "Manage users",
		description: "Students, lecturers, and admins",
		href: "/admin/users",
		Icon: Users,
	},
	{
		label: "Review classes",
		description: "Enrollment groups and course links",
		href: "/admin/classes",
		Icon: FolderKanban,
	},
	{
		label: "Course catalog",
		description: "Lecturers and class assignments",
		href: "/admin/courses",
		Icon: BookOpen,
	},
	{
		label: "Academic setup",
		description: "Faculties, programs, and settings",
		href: "/admin/faculties",
		Icon: Building2,
	},
];

export default async function AdminDashboardPage() {
	const session = await getSession();
	const name = session?.user?.name ?? "Administrator";

	return (
		<AdminPageShell
			title={`Welcome, ${name.split(" ")[0]}`}
			description="A clean overview of people, classes, courses, and operational items that need attention."
			icon={LayoutDashboard}
			eyebrow="Admin dashboard"
		>
			<Suspense fallback={<DashboardSkeleton />}>
				<DashboardContent />
			</Suspense>
		</AdminPageShell>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{[1, 2, 3, 4].map((item) => (
					<div
						key={item}
						className="rounded-sm border border-border bg-white p-4"
					>
						<div className="h-9 w-9 rounded-sm bg-slate-100" />
						<div className="mt-5 h-7 w-16 rounded bg-slate-100" />
						<div className="mt-2 h-3 w-24 rounded bg-slate-100" />
					</div>
				))}
			</div>
			<div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
				<div className="rounded-sm border border-border bg-white p-4">
					<div className="h-5 w-32 rounded bg-slate-100" />
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						{[1, 2, 3, 4].map((item) => (
							<div key={item} className="h-24 rounded-sm bg-slate-100" />
						))}
					</div>
				</div>
				<div className="rounded-sm border border-border bg-white p-4">
					<div className="h-5 w-28 rounded bg-slate-100" />
					<div className="mt-4 space-y-3">
						{[1, 2, 3].map((item) => (
							<div key={item} className="h-14 rounded bg-slate-100" />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

async function DashboardContent() {
	const { stats, structuralStats, auditLogs, auditAlerts, healthStatus } =
		await getAdminDashboardStats();
	const isHealthy = healthStatus === "Healthy";

	return (
		<div className="space-y-6">
			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{stats.map((item, index) => {
					const Icon = statIcons[index] ?? Users;
					return (
						<div
							key={item.label}
							className="rounded-sm border border-border bg-white p-4"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#dbeafe] text-[#002388]">
									<Icon size={20} />
								</div>
								<span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
									Live
								</span>
							</div>
							<p className="mt-4 text-[26px] font-semibold leading-none text-[#1e293b]">
								{item.value}
							</p>
							<p className="mt-1.5 text-[12px] text-muted-foreground">{item.label}</p>
						</div>
					);
				})}
			</section>

			<div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
				<section className="rounded-sm border border-border bg-white">
					<div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
						<div>
							<h2 className="text-[13px] font-semibold text-[#1e293b]">
								Admin shortcuts
							</h2>
							<p className="text-[12px] text-muted-foreground">
								Common setup flows in one place.
							</p>
						</div>
					</div>
					<div className="grid gap-3 p-4 sm:grid-cols-2 md:p-5">
						{quickLinks.map(({ label, description, href, Icon }) => (
							<Link
								key={href}
								href={href}
								className="group rounded-sm border border-border bg-white p-4 transition-colors hover:border-[#002388]/30 hover:bg-[#f8fafc]"
							>
								<div className="flex items-start gap-3">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-slate-600 group-hover:bg-[#dbeafe] group-hover:text-[#002388]">
										<Icon size={18} />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-3">
											<h3 className="text-sm font-semibold text-slate-900">
												{label}
											</h3>
											<ArrowRight
												size={16}
												className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#002388]"
											/>
										</div>
										<p className="mt-1 text-sm leading-5 text-slate-500">
											{description}
										</p>
									</div>
								</div>
							</Link>
						))}
					</div>
				</section>

				<section className="rounded-xl border border-slate-800 bg-slate-900 shadow-md overflow-hidden">
					<div className="flex items-center justify-between border-b border-slate-800/50 px-4 py-3 bg-slate-950/30">
						<div className="flex items-center gap-3">
							<div
								className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-300 ${isHealthy
										? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
										: "bg-amber-500/10 border-amber-500/20 text-amber-400"
									}`}
							>
								{isHealthy ? (
									<CheckCircle2 size={18} className="animate-pulse" />
								) : (
									<AlertTriangle size={18} className="animate-bounce" />
								)}
							</div>
							<div>
								<h2 className="text-[13px] font-bold text-slate-100">
									System health
								</h2>
								<div className="flex items-center gap-1.5 mt-0.5">
									<span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
									<p className="text-[11px] font-medium text-slate-400">
										Status: <span className={isHealthy ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>{healthStatus}</span>
									</p>
								</div>
							</div>
						</div>
					</div>
					<div className="space-y-4 p-4 md:p-5">
						<div className="space-y-2">
							{auditAlerts.map((alert) => (
								<div
									key={alert}
									className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium leading-relaxed transition-colors ${isHealthy
											? "bg-slate-950/30 border-slate-800/40 text-slate-300"
											: "bg-amber-500/5 border-amber-500/10 text-amber-300"
										}`}
								>
									{alert}
								</div>
							))}
						</div>
						<div className="border-t border-slate-800/40 pt-4">
							<div className="grid gap-2.5">
								{structuralStats.map((item) => {
									let badgeClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
									if (item.tone === "#DC2626") {
										badgeClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
									} else if (item.tone === "#D97706") {
										badgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
									}
									return (
										<div
											key={item.label}
											className="flex items-center justify-between gap-4 bg-slate-950/20 hover:bg-slate-950/40 border border-transparent hover:border-slate-800/30 rounded-lg px-3.5 py-2 transition-all duration-200"
										>
											<span className="text-xs font-medium text-slate-300">{item.label}</span>
											<span
												className={`text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-full ${badgeClass}`}
											>
												{item.value}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</section>
			</div>

			<section className="rounded-sm border border-border bg-white">
				<div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-sm bg-slate-100 text-slate-600">
							<History size={18} />
						</div>
						<div>
							<h2 className="text-[13px] font-semibold text-[#1e293b]">
								Recent activity
							</h2>
							<p className="text-[12px] text-muted-foreground">
								Latest system audit events.
							</p>
						</div>
					</div>
					<Link
						href="/admin/settings?tab=logs"
						className="text-sm font-medium text-[#002388] hover:underline"
					>
						View all
					</Link>
				</div>
				<div className="divide-y divide-slate-100">
					{auditLogs.length > 0 ? (
						auditLogs.map((log: { id: number; action: string; details: string; category: string; timestamp: Date }) => (
							<div
								key={log.id}
								className="grid gap-2 px-4 py-3 md:grid-cols-[9rem_1fr_auto] md:items-start md:px-5"
							>
								<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
									{log.category}
								</p>
								<div className="min-w-0">
									<p className="text-sm font-semibold text-slate-900">
										{log.action.replace(/_/g, " ")}
									</p>
									<p className="mt-1 text-sm leading-5 text-slate-600">
										{log.details}
									</p>
								</div>
								<p className="text-xs text-slate-500 md:text-right">
									{formatDistanceToNow(new Date(log.timestamp), {
										addSuffix: true,
									})}
								</p>
							</div>
						))
					) : (
						<div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
							No recent activity recorded.
						</div>
					)}
				</div>
			</section>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				<Link
					href="/admin/programs"
					className="rounded-sm border border-border bg-white p-4 text-sm font-medium text-slate-700 transition-colors hover:border-[#002388]/30 hover:bg-[#f8fafc]"
				>
					<School size={18} className="mb-3 text-[#002388]" />
					Programs and academic structure
				</Link>
				<Link
					href="/admin/settings"
					className="rounded-sm border border-border bg-white p-4 text-sm font-medium text-slate-700 transition-colors hover:border-[#002388]/30 hover:bg-[#f8fafc]"
				>
					<Settings size={18} className="mb-3 text-[#002388]" />
					System settings and grading scale
				</Link>
				<Link
					href="/admin/change-password"
					className="rounded-sm border border-border bg-white p-4 text-sm font-medium text-slate-700 transition-colors hover:border-[#002388]/30 hover:bg-[#f8fafc]"
				>
					<Users size={18} className="mb-3 text-[#002388]" />
					Account security
				</Link>
			</section>
		</div>
	);
}
