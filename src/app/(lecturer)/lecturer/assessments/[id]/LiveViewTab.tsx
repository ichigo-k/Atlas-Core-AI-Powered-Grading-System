"use client";

import { Loader2, MonitorPlay } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import LiveStudentModal from "./LiveStudentModal";
import StudentLiveCard, { type LiveStudent } from "./StudentLiveCard";

interface Props {
	assessmentId: number;
	/** Polling only makes sense while the assessment is running. */
	isRunning: boolean;
}

export default function LiveViewTab({ assessmentId, isRunning }: Props) {
	const [students, setStudents] = useState<LiveStudent[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [fetchError, setFetchError] = useState(false);
	const [watching, setWatching] = useState<LiveStudent | null>(null);
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
		const id = setInterval(fetchRoster, 5000);
		const onVisibility = () => {
			if (document.visibilityState === "visible") fetchRoster();
		};
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			clearInterval(id);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [isRunning, fetchRoster]);

	return (
		<div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
			{/* Header */}
			<div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
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
				<div className="p-5">
					{fetchError && (
						<p className="text-[11px] text-rose-500 mb-3">
							Could not refresh the live roster — showing the last known state.
						</p>
					)}
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{students.map((s) => (
							<StudentLiveCard key={s.attemptId} student={s} onWatch={setWatching} />
						))}
					</div>
				</div>
			)}

			{watching && (
				<LiveStudentModal
					key={watching.attemptId}
					student={watching}
					onClose={() => setWatching(null)}
				/>
			)}
		</div>
	);
}
