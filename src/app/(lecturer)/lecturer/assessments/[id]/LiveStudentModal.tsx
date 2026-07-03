"use client";

import {
	Flag,
	Loader2,
	RefreshCw,
	Send,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import type { LiveStudent } from "./StudentLiveCard";
import { flagBadgeClasses } from "./StudentLiveCard";

type ConnState = "connecting" | "live" | "lost" | "ended";

interface OutgoingSignal {
	type: "offer" | "answer" | "ice" | "bye";
	payload: unknown;
}

interface SentMessage {
	id: number;
	body: string;
	createdAt: string;
}

interface Props {
	student: LiveStudent;
	onClose: () => void;
}

export default function LiveStudentModal({ student, onClose }: Props) {
	const attemptId = student.attemptId;

	const videoRef = useRef<HTMLVideoElement | null>(null);
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const queueRef = useRef<OutgoingSignal[]>([]);
	const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pollingRef = useRef(false);
	const closedRef = useRef(false);

	const [connState, setConnState] = useState<ConnState>("connecting");
	const [muted, setMuted] = useState(true);
	const [flagCount, setFlagCount] = useState(student.flagCount);
	const [autoSubmitted, setAutoSubmitted] = useState(false);

	// Messaging state
	const [messageBody, setMessageBody] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);

	// Flag state
	const [flagReason, setFlagReason] = useState("");
	const [showFlagConfirm, setShowFlagConfirm] = useState(false);
	const [isFlagging, setIsFlagging] = useState(false);

	// ── WebRTC ────────────────────────────────────────────────────────────────

	const teardownPeer = useCallback(() => {
		const pc = pcRef.current;
		if (pc) {
			pc.ontrack = null;
			pc.onicecandidate = null;
			pc.onconnectionstatechange = null;
			pc.close();
			pcRef.current = null;
		}
		pendingIceRef.current = [];
	}, []);

	const startConnection = useCallback(async () => {
		teardownPeer();
		queueRef.current = [];
		setConnState("connecting");

		const pc = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});
		pcRef.current = pc;

		pc.addTransceiver("video", { direction: "recvonly" });
		pc.addTransceiver("audio", { direction: "recvonly" });

		pc.ontrack = (e) => {
			if (videoRef.current && e.streams[0]) {
				videoRef.current.srcObject = e.streams[0];
			}
		};
		pc.onicecandidate = (e) => {
			if (e.candidate) {
				queueRef.current.push({ type: "ice", payload: e.candidate.toJSON() });
			}
		};
		pc.onconnectionstatechange = () => {
			if (pcRef.current !== pc) return;
			switch (pc.connectionState) {
				case "connected":
					setConnState("live");
					break;
				case "failed":
				case "disconnected":
				case "closed":
					setConnState((prev) => (prev === "ended" ? prev : "lost"));
					break;
				default:
					break;
			}
		};

		try {
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			queueRef.current.push({
				type: "offer",
				payload: { type: offer.type, sdp: offer.sdp },
			});
		} catch (err) {
			console.error("[LiveStudentModal] failed to create offer", err);
			setConnState("lost");
		}
	}, [teardownPeer]);

	// ── Signaling poll (every 2s) ─────────────────────────────────────────────

	const poll = useCallback(async () => {
		if (pollingRef.current || closedRef.current) return;
		pollingRef.current = true;
		const outgoing = queueRef.current.splice(0, queueRef.current.length);
		try {
			const res = await fetch(`/api/lecturer/attempts/${attemptId}/signal`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(outgoing.length ? { signals: outgoing } : {}),
			});
			if (res.status === 409) {
				// Student finished — normal end-of-stream.
				setConnState("ended");
				if (pollTimerRef.current) clearInterval(pollTimerRef.current);
				pollTimerRef.current = null;
				teardownPeer();
				return;
			}
			if (!res.ok) {
				// Re-queue unsent signals so they flush on the next poll.
				queueRef.current.unshift(...outgoing);
				return;
			}
			const data = await res.json();
			const pc = pcRef.current;
			if (!pc || !Array.isArray(data.signals)) return;

			for (const sig of data.signals) {
				try {
					if (sig.type === "answer") {
						await pc.setRemoteDescription(
							new RTCSessionDescription(sig.payload),
						);
						// Flush ICE candidates buffered before the remote description.
						const buffered = pendingIceRef.current.splice(
							0,
							pendingIceRef.current.length,
						);
						for (const cand of buffered) {
							await pc.addIceCandidate(cand).catch(() => {});
						}
					} else if (sig.type === "ice") {
						if (pc.remoteDescription) {
							await pc.addIceCandidate(sig.payload).catch(() => {});
						} else {
							pendingIceRef.current.push(sig.payload);
						}
					} else if (sig.type === "bye") {
						setConnState((prev) => (prev === "ended" ? prev : "lost"));
					}
				} catch (err) {
					console.error("[LiveStudentModal] failed to apply signal", {
						attemptId,
						type: sig.type,
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}
		} catch {
			queueRef.current.unshift(...outgoing);
		} finally {
			pollingRef.current = false;
		}
	}, [attemptId, teardownPeer]);

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	useEffect(() => {
		closedRef.current = false;
		startConnection();
		poll();
		pollTimerRef.current = setInterval(poll, 2000);
		return () => {
			closedRef.current = true;
			if (pollTimerRef.current) clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
			// Fire a final bye directly — polling has stopped.
			fetch(`/api/lecturer/attempts/${attemptId}/signal`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ signals: [{ type: "bye", payload: {} }] }),
				keepalive: true,
			}).catch(() => {});
			teardownPeer();
		};
	}, [attemptId, startConnection, poll, teardownPeer]);

	// ── Actions ───────────────────────────────────────────────────────────────

	async function handleSendMessage() {
		const body = messageBody.trim();
		if (!body || isSending) return;
		setIsSending(true);
		try {
			const res = await fetch(`/api/lecturer/attempts/${attemptId}/message`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ body }),
			});
			if (res.status === 409) {
				toast.error("The student has finished this attempt.");
				return;
			}
			if (!res.ok) {
				toast.error("Failed to send message.");
				return;
			}
			const data = await res.json();
			setSentMessages((prev) => [...prev, data.message]);
			setMessageBody("");
			toast.success("Message sent to student.");
		} catch {
			toast.error("Failed to send message.");
		} finally {
			setIsSending(false);
		}
	}

	async function handleFlag() {
		setIsFlagging(true);
		try {
			const reason = flagReason.trim();
			const res = await fetch(`/api/lecturer/attempts/${attemptId}/flag`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(reason ? { reason } : {}),
			});
			if (res.status === 409) {
				toast.error("The student has finished this attempt.");
				setShowFlagConfirm(false);
				return;
			}
			if (!res.ok) {
				toast.error("Failed to flag student.");
				return;
			}
			const data = await res.json();
			setFlagCount(data.flagCount);
			setFlagReason("");
			setShowFlagConfirm(false);
			if (data.willAutoSubmit) {
				setAutoSubmitted(true);
				setConnState("ended");
				toast.warning(
					"Flag threshold reached — the attempt was auto-submitted.",
				);
			} else {
				toast.success(`Student flagged (${data.flagCount} total).`);
			}
		} catch {
			toast.error("Failed to flag student.");
		} finally {
			setIsFlagging(false);
		}
	}

	function handleReconnect() {
		startConnection();
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const connLabel: Record<ConnState, { text: string; cls: string }> = {
		connecting: { text: "Connecting…", cls: "bg-amber-50 text-amber-700 border-amber-200" },
		live: { text: "Live", cls: "bg-green-50 text-green-700 border-green-200" },
		lost: {
			text: "Student offline / connection lost",
			cls: "bg-red-50 text-red-700 border-red-200",
		},
		ended: { text: "Attempt ended", cls: "bg-slate-50 text-slate-500 border-slate-200" },
	};
	const conn = connLabel[connState];

	return createPortal(
		<div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
			<div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
					<div className="flex items-center gap-3 min-w-0">
						<div className="min-w-0">
							<p className="text-[14px] font-semibold text-slate-800 truncate">
								{student.studentName ?? "Unknown student"}
							</p>
							<p className="text-[11px] text-slate-400">
								{student.indexNumber ?? "No index number"}
							</p>
						</div>
						<span
							className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[11px] font-semibold ${conn.cls}`}
						>
							{connState === "connecting" && (
								<Loader2 size={11} className="animate-spin" />
							)}
							{connState === "live" && (
								<span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
							)}
							{conn.text}
						</span>
						<span
							className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm border text-[11px] font-bold tabular-nums ${flagBadgeClasses(
								flagCount,
								student.flagThreshold,
							)}`}
						>
							<Flag size={10} />
							{flagCount}/{student.flagThreshold}
						</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="h-8 w-8 flex items-center justify-center rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
						aria-label="Close live view"
					>
						<X size={16} />
					</button>
				</div>

				{/* Body */}
				<div className="flex flex-col md:flex-row flex-1 min-h-0">
					{/* Video area */}
					<div className="relative flex-1 bg-slate-900 min-h-[280px] md:min-h-[420px] flex items-center justify-center">
						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted={muted}
							className="absolute inset-0 h-full w-full object-contain"
						/>
						{connState !== "live" && (
							<div className="relative z-10 flex flex-col items-center gap-3 text-center px-6">
								{connState === "connecting" && (
									<>
										<Loader2 size={22} className="text-slate-400 animate-spin" />
										<p className="text-[13px] text-slate-400">
											Connecting to student camera…
										</p>
									</>
								)}
								{connState === "lost" && (
									<>
										<p className="text-[13px] text-slate-300">
											Student offline / connection lost
										</p>
										<button
											type="button"
											onClick={handleReconnect}
											className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-white text-slate-900 text-[12px] font-semibold hover:bg-slate-100 transition-colors"
										>
											<RefreshCw size={12} /> Reconnect
										</button>
									</>
								)}
								{connState === "ended" && (
									<p className="text-[13px] text-slate-300">
										{autoSubmitted
											? "The attempt was auto-submitted due to reaching the flag threshold."
											: "The student has finished this attempt."}
									</p>
								)}
							</div>
						)}
						{/* Mute toggle */}
						<button
							type="button"
							onClick={() => setMuted((m) => !m)}
							className="absolute bottom-3 left-3 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition-colors"
							title={muted ? "Unmute" : "Mute"}
						>
							{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
						</button>
					</div>

					{/* Side panel */}
					<div className="w-full md:w-[300px] shrink-0 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col min-h-0">
						{autoSubmitted && (
							<div className="mx-4 mt-4 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-[11px] font-semibold text-red-700">
								Flag threshold reached — this attempt was auto-submitted.
							</div>
						)}

						{/* Message log */}
						<div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 min-h-[120px]">
							<p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.12em]">
								Messages sent
							</p>
							{sentMessages.length === 0 ? (
								<p className="text-[12px] text-slate-300">
									No messages sent this session.
								</p>
							) : (
								sentMessages.map((m) => (
									<div
										key={m.id}
										className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
									>
										<p className="text-[12px] text-slate-700 whitespace-pre-wrap break-words">
											{m.body}
										</p>
										<p className="text-[10px] text-slate-400 mt-1">
											{new Date(m.createdAt).toLocaleTimeString()}
										</p>
									</div>
								))
							)}
						</div>

						{/* Composer + flag */}
						<div className="border-t border-slate-100 px-4 py-4 space-y-3 shrink-0">
							<textarea
								value={messageBody}
								onChange={(e) => setMessageBody(e.target.value)}
								placeholder="Message the student…"
								rows={2}
								disabled={connState === "ended"}
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800 placeholder:text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
							/>
							<button
								type="button"
								onClick={handleSendMessage}
								disabled={isSending || !messageBody.trim() || connState === "ended"}
								className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-sm bg-primary text-white text-[12px] font-semibold hover:bg-[#001570] disabled:opacity-50 transition-colors"
							>
								{isSending ? (
									<Loader2 size={12} className="animate-spin" />
								) : (
									<Send size={12} />
								)}
								{isSending ? "Sending…" : "Send"}
							</button>

							<div className="pt-1 space-y-2">
								<input
									type="text"
									value={flagReason}
									onChange={(e) => setFlagReason(e.target.value)}
									placeholder="Flag reason (optional)"
									disabled={connState === "ended"}
									className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 disabled:opacity-50"
								/>
								<button
									type="button"
									onClick={() => setShowFlagConfirm(true)}
									disabled={isFlagging || connState === "ended"}
									className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-sm border border-red-200 bg-red-50 text-red-700 text-[12px] font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
								>
									<Flag size={12} /> Flag student
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

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
		</div>,
		document.body,
	);
}
