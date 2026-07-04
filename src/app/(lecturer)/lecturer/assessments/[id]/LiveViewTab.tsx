"use client";

import { ChevronLeft, ChevronRight, Loader2, MonitorPlay } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LiveTile from "./LiveTile";
import type { LiveStudent } from "./StudentLiveCard";

interface Props {
	assessmentId: number;
	/** Polling only makes sense while the assessment is running. */
	isRunning: boolean;
}

const PAGE_SIZE = 8;
const ROSTER_INTERVAL_MS = 4000;

export default function LiveViewTab({ assessmentId, isRunning }: Props) {
	const [students, setStudents] = useState<LiveStudent[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [fetchError, setFetchError] = useState(false);
	const [page, setPage] = useState(0);
	const [spotlightId, setSpotlightId] = useState<number | null>(null);
	const inFlightRef = useRef(false);

	const fetchRoster = useCallback(async () => {
		if (inFlightRef.current || document.visibilityState === "hidden") return;
		inFlightRef.current = true;
		try {
			const res = await fetch(`/api/lecturer/assessments/${assessmentId}/live`);
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = await res.json();
			setStudents(Array.isArray(data.students) ? data.students : []);
			setFetchError(false);
		} catch {
			setFetchError(true);
		} finally {
			inFlightRef.current = false;
			setLoaded(true);
		}
	}, [assessmentId]);

	useEffect(() => {
		if (!isRunning) {
			setLoaded(true);
			return;
		}
		fetchRoster();
		const id = setInterval(fetchRoster, ROSTER_INTERVAL_MS);
		const onVisibility = () => {
			if (document.visibilityState === "visible") fetchRoster();
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			clearInterval(id);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [isRunning, fetchRoster]);

	const pageCount = Math.max(1, Math.ceil(students.length / PAGE_SIZE));

	// Keep the current page in range as the roster grows/shrinks.
	useEffect(() => {
		if (page >= pageCount) setPage(pageCount - 1);
	}, [page, pageCount]);

	const pageStudents = useMemo(
		() => students.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
		[students, page],
	);

	// Drop the spotlight if that student is no longer on the visible page
	// (paged away, finished, or left the roster) — their tile would unmount.
	useEffect(() => {
		if (spotlightId != null && !pageStudents.some((s) => s.attemptId === spotlightId)) {
			setSpotlightId(null);
		}
	}, [pageStudents, spotlightId]);

	const toggleSpotlight = useCallback((attemptId: number) => {
		setSpotlightId((prev) => (prev === attemptId ? null : attemptId));
	}, []);

	return (
		<div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
			{/* Header */}
			<div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]">
						Live View
					</p>
					{isRunning && loaded && (
						<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
							<span
								className={`h-1.5 w-1.5 rounded-full ${
									students.length > 0 ? "bg-green-500 animate-pulse" : "bg-slate-300"
								}`}
							/>
							{students.length} student{students.length !== 1 ? "s" : ""} live
						</span>
					)}
				</div>

				{/* Pagination */}
				{pageCount > 1 && (
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							disabled={page === 0}
							className="h-7 w-7 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
							aria-label="Previous page"
						>
							<ChevronLeft size={14} />
						</button>
						<span className="text-[11px] font-semibold text-slate-500 tabular-nums px-1">
							{page + 1} / {pageCount}
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
							disabled={page >= pageCount - 1}
							className="h-7 w-7 flex items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
							aria-label="Next page"
						>
							<ChevronRight size={14} />
						</button>
					</div>
				)}
			</div>

			{/* Body */}
			{!loaded ? (
				<div className="px-5 py-12 flex items-center justify-center gap-2 text-slate-400">
					<Loader2 size={14} className="animate-spin" />
					<span className="text-sm">Loading live roster…</span>
				</div>
			) : students.length === 0 ? (
				<div className="px-5 py-12 text-center">
					<MonitorPlay size={26} className="mx-auto text-slate-200 mb-3" />
					<p className="text-sm text-slate-400">
						No students are currently taking this assessment.
					</p>
					{fetchError && (
						<p className="text-[11px] text-rose-500 mt-2">
							Could not refresh the live roster — retrying automatically.
						</p>
					)}
				</div>
			) : (
				<div className="p-4 sm:p-5">
					{fetchError && (
						<p className="text-[11px] text-rose-500 mb-3">
							Could not refresh the live roster — showing the last known state.
						</p>
					)}
					<div className="flex flex-wrap gap-3">
						{pageStudents.map((s) => {
							const isSpot = s.attemptId === spotlightId;
							return (
								<div
									key={s.attemptId}
									className={
										isSpot
											? "order-first basis-full"
											: "basis-[calc(50%-6px)] sm:basis-[calc(33.333%-8px)] lg:basis-[calc(25%-9px)]"
									}
								>
									<LiveTile
										student={s}
										spotlight={isSpot}
										active
										onToggleSpotlight={toggleSpotlight}
									/>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
