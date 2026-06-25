"use client";

import {
	CalendarDays,
	CheckCircle2,
	Clock3,
	Search,
	FileText,
	ArrowRight,
	Filter,
	ClipboardList,
	ChevronRight,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";

function gradeColor(pct: number): string {
	if (pct >= 70) return "#107c10";
	if (pct >= 50) return "#8a6d1c";
	if (pct >= 20) return "#b4540a";
	return "#a4262c";
}

// --- Types --------------------------------------------------------------------

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
	EXAM: { bg: "#fbeaea", text: "#a4262c" },
	QUIZ: { bg: "#fdf3e2", text: "#8a6d1c" },
	ASSIGNMENT: { bg: "#e6f2ea", text: "#1d6b3f" },
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
		<div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full">
			{/* Command bar */}
			<div className="sticky top-0 z-10 bg-white dark:bg-[#192534] border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
				<ClipboardList size={11} />
				<span>Student</span>
				<ChevronRight size={11} />
				<span className="text-[#002388] font-medium">Assessments</span>
			</div>
			<div className="px-4 py-5 md:px-6 lg:px-8 space-y-5 pb-12 max-w-[1280px]">

				{/* -- Page header -- */}
				<div>
					<h1 className="text-xl font-semibold text-[#1e293b]">Assessments</h1>
					<p className="text-[12px] text-muted-foreground mt-0.5">
						Track everything in one place � live tests, upcoming exams, and completed results.
					</p>
				</div>

				{/* -- Tabs -- */}
				<div className="flex items-center gap-0 border-b border-border">
					{tabs.map(({ key, label }) => {
						const active = activeTab === key;
						return (
							<button
								type="button"
								key={key}
								onClick={() => setActiveTab(key)}
								className={`relative flex items-center gap-2 px-4 py-2.5 text-[12px] font-semibold transition-colors ${active
									? "text-primary border-b-2 border-primary -mb-px"
									: "text-muted-foreground hover:text-[#1e293b]"
									}`}
							>
								{label}
								<span
									className={`flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold transition-all ${active
										? "bg-primary/10 text-primary"
										: "bg-slate-100 text-slate-500"
										}`}
								>
									{counts[key]}
								</span>
							</button>
						);
					})}
				</div>

				{/* -- Search + Filter -- */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center relative z-20">
					<div className="relative flex-1 group">
						<Search
							className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary"
							size={14}
							strokeWidth={2}
						/>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search assessments..."
							className="w-full rounded-sm border border-border bg-white py-2 pl-9 pr-3 text-[12px] text-[#1e293b] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-400"
						/>
					</div>

					<div className="relative shrink-0">
						<button
							type="button"
							onClick={() => setShowFilters(!showFilters)}
							className="relative flex w-full items-center justify-center sm:w-auto gap-2 rounded-sm border border-border bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#323130] hover:bg-slate-50 transition-all"
						>
							<Filter size={13} strokeWidth={2} />
							Filter
							{hasActiveFilters && (
								<span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
									<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white" />
								</span>
							)}
						</button>

						{showFilters && (
							<>
								<div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
								<div className="absolute right-0 top-full mt-2 w-full sm:w-[300px] rounded-sm border border-border bg-white p-5 shadow-lg z-20 flex flex-col gap-5">
									<div>
										<label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
											Filter by Course
										</label>
										<div className="flex flex-wrap gap-1.5">
											<button
												type="button"
												onClick={() => setCourseFilter("all")}
												className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all ${courseFilter === "all"
													? "bg-primary text-white"
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
													className={`rounded-sm border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all ${courseFilter === course.id
														? "border-primary bg-primary/5 text-primary"
														: "border-border bg-white text-slate-500 hover:border-slate-300"
														}`}
												>
													{course.code}
												</button>
											))}
										</div>
									</div>

									<div>
										<label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
											Filter by Type
										</label>
										<div className="flex flex-wrap gap-1.5">
											{(["all", "EXAM", "QUIZ", "ASSIGNMENT"] as TypeFilter[]).map((type) => (
												<button
													type="button"
													key={type}
													onClick={() => setTypeFilter(type)}
													className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all ${typeFilter === type
														? "bg-[#1e293b] text-white"
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

				{filteredAssessments.length === 0 ? (
					<div className="bg-white border border-border rounded-sm py-20 flex flex-col items-center gap-4 text-center">
						<div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
							<Search size={28} className="text-slate-300" strokeWidth={2} />
						</div>
						<p className="text-[15px] font-semibold text-[#1e293b]">No assessments found</p>
						<p className="max-w-xs text-[13px] text-muted-foreground">
							Try adjusting your filters or search terms to find what you&apos;re looking for.
						</p>
						<button
							type="button"
							onClick={() => {
								setSearch("");
								setCourseFilter("all");
								setTypeFilter("all");
							}}
							className="mt-2 rounded-sm bg-primary px-5 py-2 text-[12px] font-semibold text-white hover:bg-[#001570] transition-colors"
						>
							Clear all filters
						</button>
					</div>
				) : (
					<div className="bg-white border border-border rounded-md divide-y divide-[#f1f5f9] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.05)]">
						{paginatedAssessments.map((assessment) => {
							const isCompleted = assessment.status === "completed";
							const isOngoing = assessment.status === "ongoing";
							const style = typeStyles[assessment.type] ?? { bg: "#f1f5f9", text: "#475569" };
							const rawScore = assessment.latestAttempt?.score ?? null;
							const score = isCompleted ? (rawScore ?? 0) : rawScore;
							const gradeColorVal = gradeColor(score ?? 0);

							return (
								<div
									key={assessment.id}
									className="flex flex-col gap-4 p-5 transition-all hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between"
								>
									{/* Info */}
									<div className="flex items-start gap-3 flex-1 min-w-0">
										<div className="flex-1 min-w-0">
											<div className="flex flex-wrap items-center gap-2 mb-1.5">
												<h3 className="text-[14px] font-semibold text-[#1e293b] truncate">
													{assessment.title}
												</h3>
												<span
													className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-[0.04em] flex-shrink-0"
													style={{ background: style.bg, color: style.text }}
												>
													{assessment.type}
												</span>
												{isOngoing && (
													<span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
														<span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
														Live
													</span>
												)}
											</div>
											<p className="text-[11px] text-muted-foreground flex items-center gap-3">
												<span className="font-semibold text-[#1e293b] uppercase tracking-wide text-[10px]">
													{assessment.courseCode}
												</span>
												<span className="flex items-center gap-1">
													<CalendarDays size={10} />
													{new Date(assessment.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
													{" � "}
													{new Date(assessment.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
												</span>
												{assessment.durationMinutes != null && (
													<span className="flex items-center gap-1">
														<Clock3 size={10} />
														{assessment.durationMinutes}m
													</span>
												)}
											</p>
										</div>
									</div>

									{/* Right: score / action */}
									<div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end pl-6">
										{isCompleted ? (
											<div className="flex flex-col items-end gap-2">
												<div className="flex items-center gap-2">
													<p className="text-[14px] font-bold tabular-nums" style={{ color: gradeColorVal }}>
														{score?.toFixed(1)}%
													</p>
													<div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
														<div
															className="h-full rounded-full transition-all duration-700"
															style={{ width: `${Math.min(score ?? 0, 100)}%`, background: gradeColorVal }}
														/>
													</div>
												</div>
												{assessment.resultsReleased && rawScore != null && (
													<Link
														href={`/student/assessments/${assessment.id}/review`}
														className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[11px] font-semibold border border-border text-[#323130] hover:bg-slate-50 transition-all"
													>
														Review Answers
														<ArrowRight size={11} />
													</Link>
												)}
											</div>
										) : (
											<div className="flex flex-col items-end gap-2">
												<Link
													href={`/student/assessments/${assessment.id}`}
													className={`flex items-center gap-1.5 rounded-sm px-4 py-2 text-[12px] font-semibold transition-all ${isOngoing
														? "bg-primary text-white hover:bg-[#001570]"
														: "border border-border text-[#323130] hover:bg-slate-50"
														}`}
												>
													{isOngoing ? "Take Assessment" : "View Details"}
													<ArrowRight size={12} />
												</Link>
												<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
													{isOngoing
														? "Available Now"
														: `Starts ${new Date(assessment.startsAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}`}
												</p>
											</div>
										)}
									</div>
								</div>
							);
						})}

						{totalPages > 1 && (
							<div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
								<span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
									Page {currentPage} of {totalPages}
								</span>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
										disabled={currentPage === 1}
										className="rounded-sm border border-border bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#323130] hover:bg-slate-50 disabled:opacity-40 transition-all"
									>
										Previous
									</button>
									<button
										type="button"
										onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
										disabled={currentPage === totalPages}
										className="rounded-sm border border-border bg-white px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#323130] hover:bg-slate-50 disabled:opacity-40 transition-all"
									>
										Next
									</button>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
