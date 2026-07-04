"use client";

import {
	AlertTriangle,
	Flag,
	Loader2,
	Maximize2,
	Minimize2,
	RefreshCw,
	Send,
	Volume2,
	VolumeX,
	WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
	flagBadgeClasses,
	relativeTime,
	violationLabel,
	type LiveStudent,
} from "./StudentLiveCard";
import { flagStudent, sendStudentMessage } from "./live-view-actions";
import { useLiveConnection } from "./useLiveConnection";

interface Props {
	student: LiveStudent;
	spotlight: boolean;
	/** Whether this tile should hold a live connection (on the current page). */
	active: boolean;
	onToggleSpotlight: (attemptId: number) => void;
}

export default function LiveTile({ student, spotlight, active, onToggleSpotlight }: Props) {
	const attemptId = student.attemptId;
	const { connState, stream, reconnect } = useLiveConnection(attemptId, active);

	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [muted, setMuted] = useState(true);
	const [flagCount, setFlagCount] = useState(student.flagCount);

	// Message + flag composer state (only surfaced in the spotlight bar).
	const [messageBody, setMessageBody] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [flagReason, setFlagReason] = useState("");
	const [showFlagConfirm, setShowFlagConfirm] = useState(false);
	const [isFlagging, setIsFlagging] = useState(false);

	useEffect(() => {
		if (videoRef.current) videoRef.current.srcObject = stream;
	}, [stream]);

	// Keep the badge in sync when the roster refresh brings a newer count.
	useEffect(() => {
		setFlagCount((prev) => Math.max(prev, student.flagCount));
	}, [student.flagCount]);

	const ended = connState === "ended";

	async function handleSend() {
		const body = messageBody.trim();
		if (!body || isSending) return;
		setIsSending(true);
		const res = await sendStudentMessage(attemptId, body);
		setIsSending(false);
		if (res.ok) {
			setMessageBody("");
			toast.success("Message sent to student.");
		} else if (res.ended) {
			toast.error("The student has finished this attempt.");
		} else {
			toast.error("Failed to send message.");
		}
	}

	async function handleFlag() {
		setIsFlagging(true);
		const res = await flagStudent(attemptId, flagReason);
		setIsFlagging(false);
		setShowFlagConfirm(false);
		if (res.ok) {
			setFlagCount(res.flagCount);
			setFlagReason("");
			if (res.willAutoSubmit) {
				toast.warning("Flag threshold reached — the attempt was auto-submitted.");
			} else {
				toast.success(`Student flagged (${res.flagCount} total).`);
			}
		} else if (res.ended) {
			toast.error("The student has finished this attempt.");
		} else {
			toast.error("Failed to flag student.");
		}
	}

	return (
		<div
			className={`group relative overflow-hidden rounded-xl border bg-slate-900 ${
				spotlight ? "border-primary/40 ring-1 ring-primary/30" : "border-slate-200"
			}`}
		>
			{/* Video */}
			<div className={`relative ${spotlight ? "aspect-video md:aspect-[16/7]" : "aspect-video"}`}>
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted={spotlight ? muted : true}
					className="absolute inset-0 h-full w-full object-contain bg-slate-900"
				/>

				{/* Connection overlay */}
				{connState !== "live" && (
					<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/80 text-center px-4">
						{connState === "connecting" && (
							<>
								<Loader2 size={18} className="text-slate-400 animate-spin" />
								<p className="text-[11px] text-slate-400">Connecting…</p>
							</>
						)}
						{connState === "lost" && (
							<>
								<WifiOff size={18} className="text-slate-400" />
								<p className="text-[11px] text-slate-300">Offline / connection lost</p>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										reconnect();
									}}
									className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sm bg-white text-slate-900 text-[11px] font-semibold hover:bg-slate-100"
								>
									<RefreshCw size={11} /> Reconnect
								</button>
							</>
						)}
						{connState === "ended" && (
							<p className="text-[11px] text-slate-300">Attempt ended</p>
						)}
					</div>
				)}

				{/* Top-left: online dot + name */}
				<div className="absolute left-2 top-2 z-20 flex items-center gap-1.5 max-w-[80%]">
					<span
						className={`h-2 w-2 shrink-0 rounded-full ring-2 ring-slate-900 ${
							student.online ? "bg-green-500" : "bg-slate-500"
						}`}
						title={student.online ? "Online" : "Offline"}
					/>
					<span className="truncate rounded-sm bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
						{student.studentName ?? "Unknown"}
					</span>
				</div>

				{/* Top-right: flag badge */}
				<span
					className={`absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${flagBadgeClasses(
						flagCount,
						student.flagThreshold,
					)}`}
				>
					<Flag size={9} />
					{flagCount}/{student.flagThreshold}
				</span>

				{/* Spotlight toggle (hover) */}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onToggleSpotlight(attemptId);
					}}
					title={spotlight ? "Exit spotlight" : "Spotlight"}
					className="absolute right-2 bottom-2 z-20 h-7 w-7 flex items-center justify-center rounded-sm bg-slate-800/80 text-white opacity-0 group-hover:opacity-100 hover:bg-slate-700 transition-opacity"
				>
					{spotlight ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
				</button>

				{/* Mute toggle only matters in spotlight (tiles are always muted) */}
				{spotlight && connState === "live" && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setMuted((m) => !m);
						}}
						title={muted ? "Unmute" : "Mute"}
						className="absolute left-2 bottom-2 z-20 h-7 w-7 flex items-center justify-center rounded-sm bg-slate-800/80 text-white hover:bg-slate-700"
					>
						{muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
					</button>
				)}

				{/* Latest violation chip (small tiles only, bottom center) */}
				{!spotlight && student.latestViolation && (
					<div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5">
						<p className="flex items-center gap-1 text-[10px] font-medium text-amber-300">
							<AlertTriangle size={10} className="shrink-0" />
							<span className="truncate">
								{violationLabel(student.latestViolation.violationType)} ·{" "}
								{relativeTime(student.latestViolation.detectedAt)}
							</span>
						</p>
					</div>
				)}
			</div>

			{/* Spotlight action bar */}
			{spotlight && (
				<div className="border-t border-slate-800 bg-slate-900 px-3 py-2.5">
					<div className="flex items-center justify-between mb-2">
						<div className="min-w-0">
							<p className="text-[12px] font-semibold text-white truncate">
								{student.studentName ?? "Unknown student"}
							</p>
							<p className="text-[10px] text-slate-400">
								{student.indexNumber ?? "No index number"}
							</p>
						</div>
						{student.latestViolation && (
							<span className="ml-2 inline-flex items-center gap-1 text-[10px] text-amber-300 shrink-0">
								<AlertTriangle size={10} />
								{violationLabel(student.latestViolation.violationType)}
							</span>
						)}
					</div>

					<div className="flex items-center gap-2">
						<input
							type="text"
							value={messageBody}
							onChange={(e) => setMessageBody(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSend();
							}}
							placeholder="Message the student…"
							disabled={ended}
							className="flex-1 h-8 rounded-sm border border-slate-700 bg-slate-800 px-2.5 text-[12px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
						/>
						<button
							type="button"
							onClick={handleSend}
							disabled={isSending || !messageBody.trim() || ended}
							className="inline-flex items-center gap-1 h-8 px-2.5 rounded-sm bg-primary text-white text-[11px] font-semibold hover:bg-[#001570] disabled:opacity-50"
						>
							{isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
						</button>
						<button
							type="button"
							onClick={() => setShowFlagConfirm(true)}
							disabled={isFlagging || ended}
							className="inline-flex items-center gap-1 h-8 px-2.5 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-[11px] font-semibold hover:bg-red-500/20 disabled:opacity-50"
						>
							<Flag size={12} /> Flag
						</button>
					</div>

					<input
						type="text"
						value={flagReason}
						onChange={(e) => setFlagReason(e.target.value)}
						placeholder="Flag reason (optional)"
						disabled={ended}
						className="mt-2 w-full h-7 rounded-sm border border-slate-700 bg-slate-800 px-2.5 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-red-400/40 disabled:opacity-50"
					/>
				</div>
			)}

			<ConfirmModal
				open={showFlagConfirm}
				title="Flag this student?"
				description={`This counts toward the auto-submit threshold (currently ${flagCount}/${student.flagThreshold}). If the threshold is reached the attempt will be force-submitted immediately.${
					flagReason.trim() ? ` Reason: "${flagReason.trim()}"` : ""
				}`}
				confirmText="Flag Student"
				isDestructive
				isLoading={isFlagging}
				onConfirm={handleFlag}
				onCancel={() => setShowFlagConfirm(false)}
			/>
		</div>
	);
}
