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
	EXAM:       { bg: "#fce8e6", text: "#d93025" },
	QUIZ:       { bg: "#fef7e0", text: "#e37400" },
	ASSIGNMENT: { bg: "#e6f4ea", text: "#1e8e3e" },
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
		<div className="mx-auto max-w-6xl space-y-6 pb-8">
			<header className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-2xl font-normal text-[#202124]">
						Welcome back, <span className="text-[#1a73e8]">{displayName}</span>
					</h1>
					<p className="mt-1 text-sm text-[#5f6368]">
						Here's what's happening with your courses today.
					</p>
				</div>
			</header>

			{ongoingItems.length > 0 && <LiveBanner items={ongoingItems} />}

			{isEmpty ? (
				<div className="rounded-lg border border-[#dadce0] bg-white px-6 py-16 flex flex-col items-center gap-3 text-center shadow-sm">
					<BookOpen size={40} className="text-[#dadce0]" />
					<p className="text-lg font-medium text-[#202124]">No assessments yet</p>
					<p className="text-sm text-[#5f6368]">
						You haven't been assigned to a class yet, or no assessments have been scheduled.
					</p>
				</div>
			) : (
				<>
					<section className="rounded-lg border border-[#dadce0] bg-white px-6 py-4 grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#dadce0] shadow-sm">
						{[
							{ label: "Upcoming", value: upcomingCount, icon: Calendar },
							{ label: "Live now", value: ongoingCount, icon: AlertCircle },
							{ label: "Completed", value: completedCount, icon: CheckCircle2 },
							{ label: "Avg. score", value: averageScore != null ? `${averageScore.toFixed(2)}%` : "—", icon: TrendingUp },
						].map((item, i) => (
							<div key={item.label} className={`flex items-center gap-3 px-5 first:pl-0 last:pr-0 ${i >= 2 ? "mt-4 sm:mt-0 border-t sm:border-t-0 border-[#dadce0] pt-4 sm:pt-0" : ""}`}>
								<item.icon size={16} className="text-[#5f6368] shrink-0" />
								<div>
									<p className="text-xs text-[#5f6368] font-medium tracking-wide">{item.label}</p>
									<p className="text-xl font-normal text-[#202124]">{item.value}</p>
								</div>
							</div>
						))}
					</section>

					<div className="grid gap-6 xl:grid-cols-2">
						<section className="flex flex-col gap-4">
							<div className="px-1">
								<h2 className="flex items-center gap-2 text-lg font-medium text-[#202124]">
									<Calendar className="text-[#1a73e8]" size={20} />
									Upcoming This Week
								</h2>
							</div>
							<div className="rounded-lg border border-[#dadce0] bg-white overflow-hidden shadow-sm">
								{upcomingAssessments.length === 0 ? (
									<p className="p-6 text-sm text-slate-400 text-center">No upcoming assessments.</p>
								) : (
									upcomingAssessments.map((assessment, i) => (
										<div
											key={assessment.id}
											className={`p-4 transition-colors hover:bg-[#f8f9fa] ${i !== 0 ? "border-t border-[#dadce0]" : ""}`}
										>
											<div className="flex items-start justify-between gap-3">
												<div className="space-y-1">
													<h3 className="font-medium text-[#202124]">{assessment.title}</h3>
													<div className="flex flex-col gap-1 text-sm text-[#5f6368] sm:flex-row sm:items-center">
														<span className="font-medium text-[#5f6368]">{assessment.courseTitle}</span>
														<span className="hidden h-1 w-1 rounded-full bg-[#dadce0] sm:block"></span>
														<span className="flex items-center gap-1.5">
															<Clock size={14} />
															{assessment.startsAt.toLocaleDateString()}
														</span>
													</div>
												</div>
												<span className="flex-shrink-0 rounded-full border border-[#dadce0] px-3 py-1 text-[11px] font-medium text-[#5f6368] uppercase tracking-wider">
													{assessment.status}
												</span>
											</div>
										</div>
									))
								)}
							</div>
						</section>

						<section className="flex flex-col gap-4">
							<div className="flex items-center justify-between px-1">
								<h2 className="flex items-center gap-2 text-lg font-medium text-[#202124]">
									<Award className="text-[#1a73e8]" size={20} />
									Recent Results
								</h2>
								<Link
									href="/student/assessments"
									className="flex items-center gap-1 text-sm font-medium text-[#1a73e8] hover:text-[#174ea6] transition-colors"
								>
									View all
									<ArrowRight size={14} />
								</Link>
							</div>
							<div className="rounded-lg overflow-hidden bg-white border border-[#dadce0] shadow-sm">
								{recentResults.length === 0 ? (
									<p className="p-6 text-sm text-slate-400 text-center">No results yet.</p>
								) : (
									recentResults.map((result, i) => {
										const type = result.type.toUpperCase() as keyof typeof typeStyles;
										const style = typeStyles[type] ?? { bg: "#F1F5F9", text: "#475569" };
										const score = result.score ?? 0;
										const barColor = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 20 ? "#f97316" : "#ef4444";
										return (
											<div
												key={result.id}
												className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-[#f8f9fa] ${i !== 0 ? "border-t border-[#dadce0]" : ""}`}
											>
												<div className="min-w-0 flex-1">
													<p className="font-medium text-[#202124] truncate text-sm">{result.title}</p>
													<p className="text-xs text-[#5f6368] mt-0.5 truncate">{result.courseTitle}</p>
												</div>
												<div className="flex items-center gap-4 shrink-0">
													<span
														className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-center"
														style={{ background: style.bg, color: style.text }}
													>
														{result.type}
													</span>
													<div className="flex items-center gap-2 w-28">
														<div className="h-1.5 flex-1 rounded-full bg-[#f1f3f4]">
															<div className="h-1.5 rounded-full" style={{ width: `${Math.min(score, 100)}%`, background: barColor }} />
														</div>
														<p className="text-sm font-medium text-[#202124] whitespace-nowrap w-12 text-right">
															{result.score.toFixed(2)}%
														</p>
													</div>
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
