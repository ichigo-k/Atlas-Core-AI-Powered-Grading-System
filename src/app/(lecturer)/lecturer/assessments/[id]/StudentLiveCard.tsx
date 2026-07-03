"use client";

import { AlertTriangle, Flag, Video } from "lucide-react";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface LiveViolation {
	violationType: string;
	source: string;
	detectedAt: string;
	reason: string | null;
}

export interface LiveStudent {
	attemptId: number;
	studentName: string | null;
	indexNumber: string | null;
	lastSeenAt: string | null;
	online: boolean;
	flagCount: number;
	flagThreshold: number;
	latestViolation: LiveViolation | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function violationLabel(type: string): string {
	const pretty = type
		.toLowerCase()
		.split("_")
		.join(" ");
	return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function relativeTime(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const sec = Math.max(0, Math.floor(diffMs / 1000));
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	return `${Math.floor(hr / 24)}d ago`;
}

/** Flag badge colour escalates as flagCount approaches flagThreshold. */
export function flagBadgeClasses(count: number, threshold: number): string {
	if (count === 0) return "bg-slate-50 text-slate-500 border-slate-200";
	const ratio = threshold > 0 ? count / threshold : 1;
	if (ratio >= 0.8) return "bg-red-50 text-red-700 border-red-200";
	if (ratio >= 0.5) return "bg-orange-50 text-orange-700 border-orange-200";
	return "bg-amber-50 text-amber-700 border-amber-200";
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface Props {
	student: LiveStudent;
	onWatch: (student: LiveStudent) => void;
}

export default function StudentLiveCard({ student, onWatch }: Props) {
	return (
		<button
			type="button"
			onClick={() => onWatch(student)}
			className="group text-left rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.06)] transition-all"
		>
			{/* Camera placeholder */}
			<div className="relative aspect-video bg-slate-900 flex items-center justify-center">
				<Video size={22} className="text-slate-600" />
				<span className="absolute inset-0 flex items-center justify-center bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity">
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-slate-900 text-[11px] font-semibold">
						<Video size={11} /> Watch
					</span>
				</span>
				{/* Online dot */}
				<span
					className={`absolute top-2.5 left-2.5 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900 ${
						student.online ? "bg-green-500" : "bg-slate-500"
					}`}
					title={student.online ? "Online" : "Offline"}
				/>
				{/* Flag badge */}
				<span
					className={`absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] font-bold tabular-nums ${flagBadgeClasses(
						student.flagCount,
						student.flagThreshold,
					)}`}
				>
					<Flag size={9} />
					{student.flagCount}/{student.flagThreshold}
				</span>
			</div>

			{/* Details */}
			<div className="px-3.5 py-3 space-y-1">
				<p className="text-[13px] font-semibold text-slate-800 truncate">
					{student.studentName ?? "Unknown student"}
				</p>
				<p className="text-[11px] text-slate-400">
					{student.indexNumber ?? "No index number"}
				</p>
				{student.latestViolation ? (
					<p className="flex items-center gap-1.5 text-[11px] text-amber-700 pt-0.5">
						<AlertTriangle size={11} className="shrink-0" />
						<span className="truncate">
							{violationLabel(student.latestViolation.violationType)} ·{" "}
							{relativeTime(student.latestViolation.detectedAt)}
						</span>
					</p>
				) : (
					<p className="text-[11px] text-slate-300 pt-0.5">No violations</p>
				)}
			</div>
		</button>
	);
}
