"use client";

/**
 * LiveProctorBridge — student side of Live View proctoring.
 *
 * Polls POST /api/student/attempts/[id]/live (the combined poll: presence
 * heartbeat + signaling + messages + lecturer flags), and answers WebRTC
 * offers from a watching lecturer by attaching the camera/mic streams owned
 * by ProctorCamera / ProctorAudio (shared via proctorSignals).
 *
 * Adaptive cadence to keep Vercel function invocations down: most of the exam
 * nobody is watching a given student, so we idle-poll every 8s (still well
 * inside the 15s ONLINE_WINDOW_MS, so the student stays "online" on the
 * lecturer roster, and an incoming offer is picked up within ~8s). The moment
 * an offer arrives we switch to a fast 2s cadence for a smooth ICE exchange,
 * then drop back to idle when the connection closes.
 *
 * - Outgoing signals (answer / ice) are queued in a ref and flushed in the
 *   next poll body — no extra requests.
 * - 409 ATTEMPT_NOT_IN_PROGRESS / 404 → stop polling permanently. Network
 *   errors are treated as transient and polling continues.
 * - Lecturer messages surface as a long-duration sonner toast AND a compact
 *   fixed panel (bottom-right, above the exam UI) the student can dismiss.
 * - Lecturer flags feed the shared violation store like any other proctor
 *   source (overlay + count), deduped by detectedAt across polls.
 */

import { MessageSquare, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { proctorSignals } from "@/lib/proctor-signals";
import { useViolationStore } from "@/lib/violation-store";
import { MAX_VIOLATIONS } from "@/lib/violation-tracker";
import { getWebRtcIceServers } from "@/lib/webrtc";

// Idle cadence while no lecturer is connected. Must stay below
// ONLINE_WINDOW_MS (15s) so the presence heartbeat keeps the student "online".
const IDLE_POLL_INTERVAL_MS = 8000;
// Fast cadence once an offer/connection is active, for smooth ICE exchange.
const ACTIVE_POLL_INTERVAL_MS = 2000;
const STREAM_RETRY_MS = 500;
const STREAM_RETRY_MAX_MS = 10000;

interface LiveSignal {
	type: "offer" | "answer" | "ice" | "bye";
	payload: unknown;
}

interface LecturerMessage {
	id: number;
	senderRole: string;
	body: string;
	createdAt: string;
}

interface LecturerFlag {
	type: string;
	message: string | null;
	detectedAt: string;
	flagCountAfter: number;
}

interface Props {
	attemptId: number;
}

export default function LiveProctorBridge({ attemptId }: Props) {
	const [messages, setMessages] = useState<LecturerMessage[]>([]);

	// ── Mutable plumbing (no re-renders) ──────────────────────────────────────
	const outQueueRef = useRef<LiveSignal[]>([]);
	const inFlightRef = useRef(false);
	const stoppedRef = useRef(false);
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
	const remoteSetRef = useRef(false);
	const seenFlagsRef = useRef<Set<string>>(new Set());
	// True while a lecturer is connected/connecting — drives the fast poll cadence.
	const activeRef = useRef(false);

	useEffect(() => {
		stoppedRef.current = false;

		function closePc() {
			if (pcRef.current) {
				try {
					pcRef.current.close();
				} catch {
					/* ignore */
				}
				pcRef.current = null;
			}
			remoteSetRef.current = false;
			pendingIceRef.current = [];
			// Connection gone → fall back to the idle poll cadence.
			activeRef.current = false;
		}

		// ── WebRTC: answer an incoming offer ────────────────────────────────────
		async function answerOffer(offer: RTCSessionDescriptionInit, waitedMs = 0) {
			// Camera may not be ready yet on early polls. Wait for video specifically;
			// answering with mic only creates a connected but black lecturer tile.
			const videoTracks = proctorSignals.cameraStream?.getVideoTracks() ?? [];
			if (videoTracks.length === 0) {
				if (waitedMs >= STREAM_RETRY_MAX_MS || stoppedRef.current) return;
				setTimeout(() => {
					void answerOffer(offer, waitedMs + STREAM_RETRY_MS);
				}, STREAM_RETRY_MS);
				return;
			}
			try {
				// A new offer replaces any existing connection.
				closePc();
				const pc = new RTCPeerConnection({ iceServers: getWebRtcIceServers() });
				pcRef.current = pc;

				const tracks = [
					...videoTracks,
					...(proctorSignals.micStream?.getAudioTracks() ?? []),
				];
				const outboundStream = new MediaStream(tracks);
				for (const track of tracks) pc.addTrack(track, outboundStream);

				pc.onicecandidate = (e) => {
					if (e.candidate) {
						outQueueRef.current.push({
							type: "ice",
							payload: e.candidate.toJSON(),
						});
					}
				};

				await pc.setRemoteDescription(offer);
				remoteSetRef.current = true;
				// Flush ICE candidates that arrived before the remote description.
				for (const cand of pendingIceRef.current) {
					await pc.addIceCandidate(cand).catch(() => {
						/* stale candidate */
					});
				}
				pendingIceRef.current = [];

				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				outQueueRef.current.push({ type: "answer", payload: answer });
			} catch (err) {
				console.error("[LiveProctorBridge] failed to answer offer", {
					attemptId,
					error: err instanceof Error ? err.message : String(err),
				});
				closePc();
			}
		}

		async function handleIce(candidate: RTCIceCandidateInit) {
			const pc = pcRef.current;
			if (!pc || !remoteSetRef.current) {
				pendingIceRef.current.push(candidate);
				return;
			}
			await pc.addIceCandidate(candidate).catch(() => {
				/* stale candidate */
			});
		}

		// ── Poll loop ───────────────────────────────────────────────────────────
		async function poll() {
			if (stoppedRef.current || inFlightRef.current) return;
			inFlightRef.current = true;
			const signals = outQueueRef.current;
			outQueueRef.current = [];
			try {
				const res = await fetch(`/api/student/attempts/${attemptId}/live`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(signals.length ? { signals } : {}),
				});

				if (res.status === 409 || res.status === 404) {
					// Attempt ended / no proctor record — stop for good.
					stoppedRef.current = true;
					closePc();
					return;
				}
				if (!res.ok) {
					// Transient server error — requeue signals and try again next tick.
					outQueueRef.current = [...signals, ...outQueueRef.current];
					return;
				}

				const data = await res.json();

				// Messages → toast + panel.
				for (const msg of (data.messages ?? []) as LecturerMessage[]) {
					toast.message("Message from your lecturer", {
						description: msg.body,
						duration: 15000,
					});
				}
				if (data.messages?.length) {
					setMessages((prev) => [
						...prev,
						...(data.messages as LecturerMessage[]),
					]);
				}

				// Lecturer flags → violation store (dedupe by detectedAt across polls).
				const flags = (data.lecturerFlags ?? []) as LecturerFlag[];
				const flagCount =
					typeof data.flagCount === "number" ? data.flagCount : 0;
				for (const flag of flags) {
					if (seenFlagsRef.current.has(flag.detectedAt)) continue;
					seenFlagsRef.current.add(flag.detectedAt);
					const s = useViolationStore.getState();
					if (s.submitting) continue;
					s.recordViolation({
						type: "LECTURER_FLAG",
						flagCountAfter: flag.flagCountAfter || flagCount,
						source: "LECTURER",
						reason: flag.message,
					});
				}
				if (flagCount > 0) useViolationStore.getState().syncCount(flagCount);
				// Threshold reached — the server has force-submitted (or is about to);
				// mirror the other proctor sources and show the final-warning screen.
				if (flags.length > 0 && flagCount >= MAX_VIOLATIONS) {
					useViolationStore.getState().showFinalWarning();
				}

				// Signaling.
				for (const sig of (data.signals ?? []) as Array<
					LiveSignal & { id: number }
				>) {
					if (sig.type === "offer") {
						// A lecturer is connecting — go to the fast cadence immediately so
						// the ICE handshake isn't paced by the 8s idle poll.
						activeRef.current = true;
						// Offers and the ICE candidates following them must be applied in
						// order. Fire-and-forget here used to let ICE run first and then be
						// erased when answerOffer replaced the peer, producing black video.
						await answerOffer(sig.payload as RTCSessionDescriptionInit);
					} else if (sig.type === "ice") {
						void handleIce(sig.payload as RTCIceCandidateInit);
					} else if (sig.type === "bye") {
						closePc();
					}
				}
			} catch {
				// Network error — transient; requeue the signals we tried to send.
				outQueueRef.current = [...signals, ...outQueueRef.current];
			} finally {
				inFlightRef.current = false;
			}
		}

		// Self-scheduling loop so the delay can adapt between polls: fast while a
		// lecturer is connected, slow (idle heartbeat) otherwise.
		let timer: ReturnType<typeof setTimeout> | null = null;
		async function loop() {
			await poll();
			if (stoppedRef.current) return;
			const delay = activeRef.current
				? ACTIVE_POLL_INTERVAL_MS
				: IDLE_POLL_INTERVAL_MS;
			timer = setTimeout(() => {
				void loop();
			}, delay);
		}
		void loop();
		return () => {
			stoppedRef.current = true;
			if (timer) clearTimeout(timer);
			closePc();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [attemptId]);

	// ── Compact "Lecturer messages" panel (latest message, dismissable) ────────
	const latest = messages.length > 0 ? messages[messages.length - 1] : null;
	if (!latest) return null;

	return (
		<div className="fixed bottom-4 right-4 z-[9000] w-72 overflow-hidden rounded-lg border border-[#2f2f33] bg-[#0c0c0e] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
			<div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.06]">
				<div className="flex items-center gap-1.5">
					<MessageSquare size={11} className="text-white/40" />
					<span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/70">
						Lecturer message
						{messages.length > 1 ? `s · ${messages.length}` : ""}
					</span>
				</div>
				<button
					type="button"
					aria-label="Dismiss lecturer messages"
					onClick={() => setMessages([])}
					className="text-white/40 hover:text-white/80 transition-colors"
				>
					<X size={12} />
				</button>
			</div>
			<div className="px-2.5 py-2">
				<p className="text-[12px] leading-relaxed text-white/85">
					{latest.body}
				</p>
				<p className="mt-1 text-[9px] text-white/35">
					{new Date(latest.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</p>
			</div>
		</div>
	);
}
