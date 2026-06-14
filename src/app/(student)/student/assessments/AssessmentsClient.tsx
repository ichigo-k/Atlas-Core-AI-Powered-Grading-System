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
	if (pct >= 70) return "#34a853";   // green
	if (pct >= 50) return "#fbbc04";   // yellow
	if (pct >= 20) return "#f97316";   // orange
	return "#ea4335";                  // red
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SerializedAssessmentRow = {
	id: number;
	title: string;
	type: string; // 'EXAM' | 'QUIZ' | 'ASSIGNMENT'
	status: "upcoming" | "ongoing" | "completed";
	courseTitle: string;
	courseCode: string;
	courseId: number;
	startsAt: string; // ISO string (serialized from Date)
	endsAt: string;   // ISO string (serialized from Date)
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

// ─── Type badge styles (uppercase keys matching DB enum) ─────────────────────

const typeStyles: Record<string, { bg: string; text: string }> = {
	EXAM: { bg: "#fce8e6", text: "#d93025" },
	QUIZ: { bg: "#fef7e0", text: "#e37400" },
	ASSIGNMENT: { bg: "#e6f4ea", text: "#1e8e3e" },
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const tabs = [
	{ key: "ongoing", label: "Live", icon: Clock3 },
	{ key: "upcoming", label: "Upcoming", icon: CalendarDays },
	{ key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

type VisibleTab = (typeof tabs)[number]["key"];
type TypeFilter = "all" | "EXAM" | "QUIZ" | "ASSIGNMENT";

// ─── Component ────────────────────────────────────────────────────────────────

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

	// Reset to page 1 when filters change
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
		<div className="mx-auto max-w-6xl space-y-8 pb-8">
			<header className="flex flex-col gap-1">
				<h1 className="flex items-center gap-2 text-2xl font-normal text-[#202124]">
					<FileText className="text-[#1a73e8]" size={28} />
					Assessments
				</h1>
				<p className="text-sm text-[#5f6368]">
					Track everything in one place, from countdowns to live tests and completed results.
				</p>
			</header>

			<div className="flex flex-col gap-6">
				{/* Tabs */}
				<div className="flex items-center gap-8 border-b border-[#dadce0]">
					{tabs.map(({ key, label }) => {
						const active = activeTab === key;
						return (
							<button
								type="button"
								key={key}
								onClick={() => setActiveTab(key)}
								className={`group relative flex items-center gap-2.5 pb-4 text-sm transition-colors ${active
										? "text-[#1a73e8] font-medium"
										: "text-[#5f6368] font-medium hover:text-[#202124]"
									}`}
							>
								{label}
								<span
									className={`flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${active
											? "bg-[#e8f0fe] text-[#1a73e8]"
											: "border border-[#dadce0] text-[#5f6368] bg-[#f8f9fa] group-hover:border-[#bdc1c6]"
										}`}
								>
									{counts[key]}
								</span>
								{active && (
									<span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1a73e8] rounded-t-full" />
								)}
							</button>
						);
					})}
				</div>

				{/* Search + Filter */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center relative z-20">
					<div className="relative flex-1 group">
						<Search
							className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f6368] transition-colors group-focus-within:text-[#1a73e8]"
							size={16}
						/>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search by title, course, or course code..."
							className="w-full rounded-full border border-[#dadce0] bg-white py-3 pl-10 pr-4 text-sm text-[#202124] outline-none transition-all focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
						/>
					</div>

					<div className="relative shrink-0">
						<button
							type="button"
							onClick={() => setShowFilters(!showFilters)}
							className="relative flex w-full items-center justify-center sm:w-auto gap-2 rounded-full border border-[#dadce0] bg-white px-5 py-3 text-[11px] font-medium uppercase tracking-widest text-[#202124] hover:bg-[#f8f9fa] transition-colors"
						>
							<Filter size={14} strokeWidth={2.5} />
							Filter
							{hasActiveFilters && (
								<span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1a73e8] opacity-50" />
									<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#1a73e8] ring-2 ring-white" />
								</span>
							)}
						</button>

						{showFilters && (
							<>
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
								<div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
								<div className="absolute right-0 top-full mt-2 w-full sm:w-[320px] rounded-lg border border-[#dadce0] bg-white p-5 shadow-lg z-20 flex flex-col gap-6 origin-top-right animate-in fade-in zoom-in-95 duration-200">
									{/* Course filter */}
									<div>
										<label className="mb-3 block text-xs font-medium uppercase tracking-wider text-[#5f6368]">
											Course
										</label>
										<div className="flex flex-wrap gap-2">
											<button
												type="button"
												onClick={() => setCourseFilter("all")}
												className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${courseFilter === "all"
														? "bg-[#1a73e8] text-white"
														: "bg-[#f8f9fa] text-[#5f6368] hover:bg-[#e8eaed]"
													}`}
											>
												All courses
											</button>
											{courses.map((course) => (
												<button
													type="button"
													key={course.id}
													onClick={() => setCourseFilter(course.id)}
													className={`rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${courseFilter === course.id
															? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
															: "border-[#dadce0] bg-white text-[#5f6368] hover:bg-[#f8f9fa]"
														}`}
												>
													{course.code}
												</button>
											))}
										</div>
									</div>

									{/* Type filter */}
									<div>
										<label className="mb-3 block text-xs font-medium uppercase tracking-wider text-[#5f6368]">
											Assessment Type
										</label>
										<div className="flex flex-wrap gap-2">
											{(["all", "EXAM", "QUIZ", "ASSIGNMENT"] as TypeFilter[]).map((type) => (
												<button
													type="button"
													key={type}
													onClick={() => setTypeFilter(type)}
													className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${typeFilter === type
															? "bg-[#e8f0fe] text-[#1a73e8] border border-[#1a73e8]"
															: "bg-white text-[#5f6368] hover:bg-[#f8f9fa] border border-[#dadce0]"
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

			{/* Empty state */}
			{filteredAssessments.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#dadce0] bg-white py-16 text-center shadow-sm">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f8f9fa] text-[#5f6368]">
						<Search size={24} />
					</div>
					<h3 className="mt-4 text-base font-medium text-[#202124]">No assessments found</h3>
					<p className="mt-1 text-sm text-[#5f6368] max-w-sm">
						We couldn't find any assessments matching your current filters. Try adjusting your search term or selected course.
					</p>
					<button
						type="button"
						onClick={() => {
							setSearch("");
							setCourseFilter("all");
							setTypeFilter("all");
						}}
						className="mt-5 rounded-full bg-[#1a73e8] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#174ea6]"
					>
						Clear all filters
					</button>
				</div>
			) : (
				<div className="rounded-lg border border-[#dadce0] bg-white overflow-hidden shadow-sm">
					{paginatedAssessments.map((assessment, i) => {
						const isCompleted = assessment.status === "completed";
						const isOngoing = assessment.status === "ongoing";
						const style = typeStyles[assessment.type] ?? { bg: "#F1F5F9", text: "#475569" };
						const rawScore = assessment.latestAttempt?.score ?? null;
						// Unsubmitted completed assessments count as 0
						const score = isCompleted ? (rawScore ?? 0) : rawScore;
						const grade = isCompleted
							? (rawScore === null ? "F" : (assessment.latestAttempt?.grade ?? null))
							: (assessment.latestAttempt?.grade ?? null);
						const barColor = gradeColor(score ?? 0);

						return (
							<div
								key={assessment.id}
								className={`flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-[#f8f9fa] sm:flex-row sm:items-center sm:justify-between ${i !== 0 ? "border-t border-[#dadce0]" : ""}`}
							>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-medium text-[#202124]">{assessment.title}</p>
										<span
											className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
											style={{ background: style.bg, color: style.text }}
										>
											{assessment.type}
										</span>
									</div>
									<p className="mt-0.5 text-xs text-[#5f6368]">
										<span className="font-medium text-[#5f6368]">{assessment.courseCode}</span>
										{" · "}{assessment.courseTitle}
									</p>
									<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5f6368]">
										<span className="flex items-center gap-1">
											<CalendarDays size={14} className="text-[#5f6368]" />
											{new Date(assessment.startsAt).toLocaleDateString("en-GB")}
											{" – "}
											{new Date(assessment.endsAt).toLocaleDateString("en-GB")}
										</span>
										{assessment.durationMinutes != null && (
											<span className="flex items-center gap-1">
												<Clock3 size={14} className="text-[#5f6368]" />
												{assessment.durationMinutes} min
											</span>
										)}
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
									{isCompleted ? (
										<>
											<div className="flex flex-col items-end">
												<p className="text-sm font-medium" style={{ color: barColor }}>
													{score}%
												</p>
												<div className="mt-1 h-1.5 w-20 rounded-full bg-[#f1f3f4]">
													<div
														className="h-1.5 rounded-full"
														style={{ width: `${Math.min(score ?? 0, 100)}%`, background: barColor }}
													/>
												</div>
											</div>
											{assessment.resultsReleased && rawScore != null && (
												<Link
													href={`/student/assessments/${assessment.id}/review`}
													className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium bg-[#f8f9fa] border border-[#dadce0] text-[#1a73e8] hover:bg-[#f1f3f4] transition-colors"
												>
													Review Answers
													<ArrowRight size={12} />
												</Link>
											)}
										</>
									) : (
										<>
											<Link
												href={`/student/assessments/${assessment.id}`}
												className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors ${isOngoing
														? "bg-[#34a853] text-white hover:bg-[#1e8e3e]"
														: "bg-[#1a73e8] text-white hover:bg-[#174ea6]"
													}`}
											>
												{isOngoing ? "Start" : "View Details"}
												<ArrowRight size={14} />
											</Link>
											<p className="text-xs text-[#5f6368]">
												{isOngoing ? "Open now" : new Date(assessment.startsAt).toLocaleDateString("en-GB")}
											</p>
										</>
									)}
								</div>
							</div>
						);
					})}

					{/* Pagination Controls */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between border-t border-[#dadce0] bg-[#f8f9fa] px-6 py-4">
							<span className="text-xs font-medium text-[#5f6368]">
								Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAssessments.length)} of {filteredAssessments.length}
							</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
									disabled={currentPage === 1}
									className="rounded-full border border-[#dadce0] bg-white px-4 py-1.5 text-xs font-medium text-[#5f6368] hover:bg-[#f8f9fa] disabled:opacity-50 transition-colors"
								>
									Previous
								</button>
								<button
									type="button"
									onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
									disabled={currentPage === totalPages}
									className="rounded-full border border-[#dadce0] bg-white px-4 py-1.5 text-xs font-medium text-[#5f6368] hover:bg-[#f8f9fa] disabled:opacity-50 transition-colors"
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
