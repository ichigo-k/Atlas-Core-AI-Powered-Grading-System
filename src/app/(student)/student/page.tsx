import Link from "next/link";
import { getSession } from "@/lib/session";
import { getDashboardData } from "@/lib/student-queries";
import { prisma } from "@/lib/prisma";
import {
	Calendar,
	Clock,
	TrendingUp,
	CheckCircle2,
	AlertCircle,
	ArrowRight,
	Award,
	BookOpen,
} from "lucide-react";
import LiveBanner from "./LiveBanner";

const typeStyles: Record<string, { bg: string; text: string }> = {
	EXAM:       { bg: "#FEE7E9", text: "#F23F42" }, // Discord-like Red
	QUIZ:       { bg: "#FFF4E5", text: "#F0B132" }, // Discord-like Yellow
	ASSIGNMENT: { bg: "#E6F4EA", text: "#23A559" }, // Discord-like Green
};

export default async function StudentDashboardPage() {
	const session = await getSession();
	const displayName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? "Student";

	const email = session?.user?.email;
	const user = email
		? await prisma.user.findUnique({ where: { email }, select: { id: true } })
		: null;

	const studentId = user?.id ?? null;
	const data = studentId
		? await getDashboardData(studentId)
		: { upcomingCount: 0, ongoingCount: 0, completedCount: 0, averageScore: null, upcomingAssessments: [], recentResults: [] };

	const { upcomingCount, ongoingCount, completedCount, averageScore, upcomingAssessments, recentResults } = data;

	const isEmpty = upcomingCount === 0 && ongoingCount === 0 && completedCount === 0 && recentResults.length === 0;
	const ongoingItems = upcomingAssessments.filter(a => a.status === "ongoing");

	return (
		<div className="mx-auto max-w-6xl space-y-8 pb-12">
			<header className="flex flex-col gap-1">
				<h1 className="text-3xl font-black text-slate-900 tracking-tight">
					Welcome back, <span className="text-discord-blurple">{displayName}</span>
				</h1>
				<p className="text-slate-500 font-medium">
					Here's what's happening with your courses today.
				</p>
			</header>

			{ongoingItems.length > 0 && <LiveBanner items={ongoingItems} />}

			{isEmpty ? (
				<div className="discord-card px-6 py-20 flex flex-col items-center gap-4 text-center">
					<div className="bg-slate-100 p-6 rounded-full">
						<BookOpen size={48} className="text-slate-300" />
					</div>
					<p className="text-xl font-bold text-slate-900">No assessments yet</p>
					<p className="max-w-xs text-slate-500 font-medium">
						You haven't been assigned to a class yet, or no assessments have been scheduled.
					</p>
				</div>
			) : (
				<>
					<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{[
							{ label: "Upcoming", value: upcomingCount, icon: Calendar, color: "text-discord-blurple" },
							{ label: "Live now", value: ongoingCount, icon: AlertCircle, color: "text-[#F23F42]" },
							{ label: "Completed", value: completedCount, icon: CheckCircle2, color: "text-[#23A559]" },
							{ label: "Avg. score", value: averageScore != null ? `${averageScore.toFixed(2)}%` : "—", icon: TrendingUp, color: "text-[#F0B132]" },
						].map((item) => (
							<div key={item.label} className="discord-card p-5 flex items-center gap-4 transition-all hover:border-discord-blurple/30 hover:bg-slate-50/50">
								<div className={`p-2.5 rounded-xl bg-slate-100 ${item.color}`}>
									<item.icon size={24} strokeWidth={2.5} />
								</div>
								<div>
									<p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1.5">{item.label}</p>
									<p className="text-2xl font-black text-slate-900 leading-none">{item.value}</p>
								</div>
							</div>
						))}
					</section>

					<div className="grid gap-8 lg:grid-cols-5">
						<section className="lg:col-span-3 space-y-4">
							<h2 className="flex items-center gap-2.5 text-lg font-black text-slate-900 uppercase tracking-tight px-1">
								<Calendar className="text-discord-blurple" size={20} strokeWidth={3} />
								Upcoming This Week
							</h2>
							<div className="discord-card divide-y divide-slate-100">
								{upcomingAssessments.length === 0 ? (
									<div className="p-12 text-center">
										<p className="text-slate-400 font-bold italic">No upcoming assessments.</p>
									</div>
								) : (
									upcomingAssessments.map((assessment) => (
										<div
											key={assessment.id}
											className="p-5 transition-all hover:bg-slate-50/80 group"
										>
											<div className="flex items-center justify-between gap-4">
												<div className="space-y-1.5 min-w-0">
													<h3 className="font-bold text-slate-900 text-lg group-hover:text-discord-blurple transition-colors truncate">{assessment.title}</h3>
													<div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 font-bold">
														<span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{assessment.courseTitle}</span>
														<span className="flex items-center gap-1.5 ml-1">
															<Clock size={14} strokeWidth={2.5} />
															{assessment.startsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
														</span>
													</div>
												</div>
												<span className="flex-shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 uppercase tracking-widest">
													{assessment.status}
												</span>
											</div>
										</div>
									))
								)}
							</div>
						</section>

						<section className="lg:col-span-2 space-y-4">
							<div className="flex items-center justify-between px-1">
								<h2 className="flex items-center gap-2.5 text-lg font-black text-slate-900 uppercase tracking-tight">
									<Award className="text-discord-blurple" size={20} strokeWidth={3} />
									Recent Results
								</h2>
								<Link
									href="/student/assessments"
									className="group flex items-center gap-1 text-[11px] font-black text-discord-blurple uppercase tracking-widest hover:translate-x-1 transition-all"
								>
									View all
									<ArrowRight size={14} strokeWidth={3} />
								</Link>
							</div>
							<div className="discord-card divide-y divide-slate-100">
								{recentResults.length === 0 ? (
									<div className="p-12 text-center">
										<p className="text-slate-400 font-bold italic">No results yet.</p>
									</div>
								) : (
									recentResults.map((result) => {
										const type = result.type.toUpperCase() as keyof typeof typeStyles;
										const style = typeStyles[type] ?? { bg: "#F1F5F9", text: "#475569" };
										const score = result.score ?? 0;
										const barColor = score >= 70 ? "#23A559" : score >= 50 ? "#F0B132" : score >= 20 ? "#F97316" : "#F23F42";
										return (
											<div
												key={result.id}
												className="p-5 flex flex-col gap-4 transition-all hover:bg-slate-50/80 group"
											>
												<div className="min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<span
															className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
															style={{ background: style.bg, color: style.text }}
														>
															{result.type}
														</span>
														<p className="text-xs font-bold text-slate-400 uppercase tracking-tight truncate">{result.courseTitle}</p>
													</div>
													<p className="font-bold text-slate-900 group-hover:text-discord-blurple transition-colors truncate">{result.title}</p>
												</div>
												<div className="flex items-center gap-3">
													<div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
														<div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(score, 100)}%`, background: barColor }} />
													</div>
													<p className="text-sm font-black text-slate-900 tabular-nums">
														{result.score.toFixed(1)}%
													</p>
												</div>
											</div>
										);
									})
								)}
							</div>
						</section>
					</div>
				</>
			)}
		</div>
	);
}
