"use client";

import {
	CalendarDays,
	CheckCircle2,
	Clock3,
	Search,
	FileText,
	ArrowRight,
	Filter,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";

function gradeColor(pct: number): string {
	if (pct >= 70) return "#23A559";   // Discord green
	if (pct >= 50) return "#F0B132";   // Discord yellow
	if (pct >= 20) return "#F97316";   // Discord orange
	return "#F23F42";                  // Discord red
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SerializedAssessmentRow = {
	id: number;
	title: string;
	type: string;
	status: "upcoming" | "ongoing" | "completed";
	courseTitle: string;
	courseCode: string;
	courseId: number;
	startsAt: string;
	endsAt: string;
	durationMinutes: number | null;
	totalMarks: number;
	maxAttempts: number;
	resultsReleased: boolean;
	gradingStatus: string;
	sections: { id: number; name: string; type: string; requiredQuestionsCount: number | null }[];
	latestAttempt: { score: number | null; grade: string | null; attemptNumber: number; status: string } | null;
};

type Course = { id: number; code: string; title: string };

interface Props {
	assessments: SerializedAssessmentRow[];
	courses: Course[];
}

const typeStyles: Record<string, { bg: string; text: string }> = {
	EXAM: { bg: "#FEE7E9", text: "#F23F42" },
	QUIZ: { bg: "#FFF4E5", text: "#F0B132" },
	ASSIGNMENT: { bg: "#E6F4EA", text: "#23A559" },
};

const tabs = [
	{ key: "ongoing", label: "Live", icon: Clock3 },
	{ key: "upcoming", label: "Upcoming", icon: CalendarDays },
	{ key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

type VisibleTab = (typeof tabs)[number]["key"];
type TypeFilter = "all" | "EXAM" | "QUIZ" | "ASSIGNMENT";

export default function AssessmentsClient({ assessments, courses }: Props) {
	const [activeTab, setActiveTab] = useState<VisibleTab>("ongoing");
	const [courseFilter, setCourseFilter] = useState<number | "all">("all");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
	const [search, setSearch] = useState("");
	const [showFilters, setShowFilters] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 8;

	const counts = useMemo(
		() => ({
			upcoming: assessments.filter((a) => a.status === "upcoming").length,
			ongoing: assessments.filter((a) => a.status === "ongoing").length,
			completed: assessments.filter((a) => a.status === "completed").length,
		}),
		[assessments],
	);

	const filteredAssessments = useMemo(() => {
		return assessments.filter((a) => {
			if (a.status !== activeTab) return false;
			if (courseFilter !== "all" && a.courseId !== courseFilter) return false;
			if (typeFilter !== "all" && a.type !== typeFilter) return false;
			if (search.length > 0) {
				const q = search.toLowerCase();
				const inTitle = a.title.toLowerCase().includes(q);
				const inCourse = a.courseTitle.toLowerCase().includes(q);
				const inCode = a.courseCode.toLowerCase().includes(q);
				if (!inTitle && !inCourse && !inCode) return false;
			}
			return true;
		});
	}, [assessments, activeTab, courseFilter, typeFilter, search]);

	useEffect(() => {
		setCurrentPage(1);
	}, [activeTab, courseFilter, typeFilter, search]);

	const totalPages = Math.ceil(filteredAssessments.length / ITEMS_PER_PAGE);
	const paginatedAssessments = useMemo(() => {
		const start = (currentPage - 1) * ITEMS_PER_PAGE;
		return filteredAssessments.slice(start, start + ITEMS_PER_PAGE);
	}, [filteredAssessments, currentPage]);

	const hasActiveFilters = courseFilter !== "all" || typeFilter !== "all";

	return (
		<div className="mx-auto max-w-6xl space-y-8 pb-12">
			<header className="flex flex-col gap-1">
				<h1 className="flex items-center gap-3 text-3xl font-black text-slate-900 tracking-tight">
					<FileText className="text-discord-blurple" size={32} strokeWidth={2.5} />
					Assessments
				</h1>
				<p className="text-slate-500 font-medium">
					Track everything in one place, from live tests to completed results.
				</p>
			</header>

			<div className="flex flex-col gap-6">
				{/* Tabs */}
				<div className="flex items-center gap-8 border-b border-slate-200">
					{tabs.map(({ key, label }) => {
						const active = activeTab === key;
						return (
							<button
								type="button"
								key={key}
								onClick={() => setActiveTab(key)}
								className={`group relative flex items-center gap-2.5 pb-4 text-sm transition-all ${active
										? "text-discord-blurple font-black"
										: "text-slate-500 font-bold hover:text-slate-900"
									}`}
							>
								{label}
								<span
									className={`flex items-center justify-center rounded-lg px-2 py-0.5 text-[11px] font-black transition-all ${active
											? "bg-discord-blurple/10 text-discord-blurple"
											: "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
										}`}
								>
									{counts[key]}
								</span>
								{active && (
									<span className="absolute bottom-0 left-0 right-0 h-[3px] bg-discord-blurple rounded-t-full" />
								)}
							</button>
						);
					})}
				</div>

				{/* Search + Filter */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center relative z-20">
					<div className="relative flex-1 group">
						<Search
							className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-discord-blurple"
							size={18}
							strokeWidth={2.5}
						/>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search assessments..."
							className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-discord-blurple focus:ring-4 focus:ring-discord-blurple/5 placeholder:text-slate-400 shadow-sm"
						/>
					</div>

					<div className="relative shrink-0">
						<button
							type="button"
							onClick={() => setShowFilters(!showFilters)}
							className="relative flex w-full items-center justify-center sm:w-auto gap-2.5 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
						>
							<Filter size={16} strokeWidth={3} />
							Filter
							{hasActiveFilters && (
								<span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-discord-blurple opacity-50" />
									<span className="relative inline-flex h-3 w-3 rounded-full bg-discord-blurple ring-2 ring-white" />
								</span>
							)}
						</button>

						{showFilters && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
								<div className="absolute right-0 top-full mt-3 w-full sm:w-[340px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl z-20 flex flex-col gap-8 origin-top-right animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5">
									<div>
										<label className="mb-4 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
											Filter by Course
										</label>
										<div className="flex flex-wrap gap-2">
											<button
												type="button"
												onClick={() => setCourseFilter("all")}
												className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${courseFilter === "all"
														? "bg-discord-blurple text-white shadow-lg shadow-discord-blurple/20"
														: "bg-slate-100 text-slate-500 hover:bg-slate-200"
													}`}
											>
												All
											</button>
											{courses.map((course) => (
												<button
													type="button"
													key={course.id}
													onClick={() => setCourseFilter(course.id)}
													className={`rounded-lg border-2 px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${courseFilter === course.id
															? "border-discord-blurple bg-discord-blurple/5 text-discord-blurple"
															: "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
														}`}
												>
													{course.code}
												</button>
											))}
										</div>
									</div>

									<div>
										<label className="mb-4 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
											Filter by Type
										</label>
										<div className="flex flex-wrap gap-2">
											{(["all", "EXAM", "QUIZ", "ASSIGNMENT"] as TypeFilter[]).map((type) => (
												<button
													type="button"
													key={type}
													onClick={() => setTypeFilter(type)}
													className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${typeFilter === type
															? "bg-slate-900 text-white shadow-lg"
															: "bg-slate-100 text-slate-500 hover:bg-slate-200"
														}`}
												>
													{type === "all" ? "All types" : type}
												</button>
											))}
										</div>
									</div>
								</div>
							</>
						)}
					</div>
				</div>
			</div>

			{filteredAssessments.length === 0 ? (
				<div className="discord-card py-24 flex flex-col items-center justify-center text-center">
					<div className="bg-slate-100 p-6 rounded-full mb-4">
						<Search size={40} className="text-slate-300" strokeWidth={3} />
					</div>
					<h3 className="text-xl font-black text-slate-900">No assessments found</h3>
					<p className="mt-1 text-slate-500 font-bold max-w-xs">
						Try adjusting your filters or search terms to find what you're looking for.
					</p>
					<button
						type="button"
						onClick={() => {
							setSearch("");
							setCourseFilter("all");
							setTypeFilter("all");
						}}
						className="mt-8 rounded-xl bg-discord-blurple px-8 py-3 text-sm font-black text-white transition-all hover:shadow-xl hover:shadow-discord-blurple/20 active:scale-95"
					>
						Clear all filters
					</button>
				</div>
			) : (
				<div className="discord-card divide-y divide-slate-100">
					{paginatedAssessments.map((assessment) => {
						const isCompleted = assessment.status === "completed";
						const isOngoing = assessment.status === "ongoing";
						const style = typeStyles[assessment.type] ?? { bg: "#F1F5F9", text: "#475569" };
						const rawScore = assessment.latestAttempt?.score ?? null;
						const score = isCompleted ? (rawScore ?? 0) : rawScore;
						const gradeColorVal = gradeColor(score ?? 0);

						return (
							<div
								key={assessment.id}
								className="flex flex-col gap-6 p-6 transition-all hover:bg-slate-50/80 group sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2.5 mb-2">
										<h3 className="text-lg font-black text-slate-900 group-hover:text-discord-blurple transition-colors">{assessment.title}</h3>
										<span
											className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
											style={{ background: style.bg, color: style.text }}
										>
											{assessment.type}
										</span>
									</div>
									<p className="text-xs font-bold text-slate-500 mb-4 flex items-center gap-2">
										<span className="text-slate-900 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">{assessment.courseCode}</span>
										<span className="w-1 h-1 rounded-full bg-slate-300" />
										{assessment.courseTitle}
									</p>
									<div className="flex flex-wrap gap-x-5 gap-y-2">
										<div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
											<CalendarDays size={16} className="text-slate-400" strokeWidth={2.5} />
											{new Date(assessment.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
											{" – "}
											{new Date(assessment.endsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
										</div>
										{assessment.durationMinutes != null && (
											<div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
												<Clock3 size={16} className="text-slate-400" strokeWidth={2.5} />
												{assessment.durationMinutes} minutes
											</div>
										)}
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
									{isCompleted ? (
										<div className="flex flex-col items-end gap-2 w-full sm:w-auto">
											<div className="flex items-center gap-3">
												<p className="text-lg font-black tabular-nums" style={{ color: gradeColorVal }}>
													{score?.toFixed(1)}%
												</p>
												<div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
													<div
														className="h-full rounded-full transition-all duration-1000 ease-out"
														style={{ width: `${Math.min(score ?? 0, 100)}%`, background: gradeColorVal }}
													/>
												</div>
											</div>
											{assessment.resultsReleased && rawScore != null && (
												<Link
													href={`/student/assessments/${assessment.id}/review`}
													className="flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-widest bg-white border-2 border-slate-100 text-discord-blurple hover:border-discord-blurple hover:bg-discord-blurple/5 transition-all active:scale-95 shadow-sm"
												>
													Review Answers
													<ArrowRight size={14} strokeWidth={3} />
												</Link>
											)}
										</div>
									) : (
										<div className="flex flex-col items-end gap-3 w-full sm:w-auto">
											<Link
												href={`/student/assessments/${assessment.id}`}
												className={`flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl px-8 py-3 text-sm font-black transition-all active:scale-95 shadow-lg shadow-black/5 ${isOngoing
														? "bg-[#23A559] text-white hover:bg-[#1e8e3e] shadow-[#23A559]/20"
														: "bg-discord-blurple text-white hover:bg-[#4752c4] shadow-discord-blurple/20"
													}`}
											>
												{isOngoing ? "Take Assessment" : "View Details"}
												<ArrowRight size={16} strokeWidth={3} />
											</Link>
											<p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
												{isOngoing ? "Available Now" : `Starts ${new Date(assessment.startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
											</p>
										</div>
									)}
								</div>
							</div>
						);
					})}

					{totalPages > 1 && (
						<div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
							<span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
								Page {currentPage} of {totalPages}
							</span>
							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
									disabled={currentPage === 1}
									className="flex-1 sm:flex-none rounded-xl border-2 border-slate-200 bg-white px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-all active:scale-95"
								>
									Previous
								</button>
								<button
									type="button"
									onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
									disabled={currentPage === totalPages}
									className="flex-1 sm:flex-none rounded-xl border-2 border-slate-200 bg-white px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-all active:scale-95"
								>
									Next
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
