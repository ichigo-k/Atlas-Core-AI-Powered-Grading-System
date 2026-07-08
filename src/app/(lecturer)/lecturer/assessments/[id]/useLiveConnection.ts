"use client";

/**
 * useLiveConnection — one lecturer→student WebRTC receive connection plus its
 * signaling poll, extracted so every live tile in the grid can hold its own
 * independent stream (a CCTV-style wall). Mirrors the negotiation the old
 * single-student modal did; the only difference is it exposes the received
 * MediaStream as state instead of writing straight to one <video> element, so
 * the consuming tile owns its own element.
 *
 * Connections are only opened while `enabled` is true — the grid passes false
 * for tiles that aren't on the current page, so the number of concurrent peer
 * connections stays bounded by the page size.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type ConnState = "connecting" | "live" | "lost" | "ended";

interface OutgoingSignal {
	type: "offer" | "answer" | "ice" | "bye";
	payload: unknown;
}

export function useLiveConnection(attemptId: number, enabled: boolean) {
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const remoteStreamRef = useRef<MediaStream | null>(null);
	const queueRef = useRef<OutgoingSignal[]>([]);
	const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const pollingRef = useRef(false);
	const closedRef = useRef(false);

	const [connState, setConnState] = useState<ConnState>("connecting");
	const [stream, setStream] = useState<MediaStream | null>(null);

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
		remoteStreamRef.current = null;
		setStream(null);
	}, []);

	const startConnection = useCallback(async () => {
		teardownPeer();
		queueRef.current = [];
		remoteStreamRef.current = new MediaStream();
		setStream(remoteStreamRef.current);
		setConnState("connecting");

		const pc = new RTCPeerConnection({
			iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
		});
		pcRef.current = pc;

		pc.addTransceiver("video", { direction: "recvonly" });
		pc.addTransceiver("audio", { direction: "recvonly" });

		pc.ontrack = (e) => {
			let remoteStream = remoteStreamRef.current;
			if (!remoteStream) {
				remoteStream = new MediaStream();
				remoteStreamRef.current = remoteStream;
				setStream(remoteStream);
			}

			if (!remoteStream.getTracks().some((track) => track.id === e.track.id)) {
				remoteStream.addTrack(e.track);
				setStream(new MediaStream(remoteStream.getTracks()));
			}
		};
		pc.onicecandidate = (e) => {
			if (e.candidate) queueRef.current.push({ type: "ice", payload: e.candidate.toJSON() });
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
			queueRef.current.push({ type: "offer", payload: { type: offer.type, sdp: offer.sdp } });
		} catch (err) {
			console.error("[useLiveConnection] failed to create offer", {
				attemptId,
				error: err instanceof Error ? err.message : String(err),
			});
			setConnState("lost");
		}
	}, [attemptId, teardownPeer]);

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
				setConnState("ended");
				if (pollTimerRef.current) clearInterval(pollTimerRef.current);
				pollTimerRef.current = null;
				teardownPeer();
				return;
			}
			if (!res.ok) {
				queueRef.current.unshift(...outgoing);
				return;
			}
			const data = await res.json();
			const pc = pcRef.current;
			if (!pc || !Array.isArray(data.signals)) return;

			for (const sig of data.signals) {
				try {
					if (sig.type === "answer") {
						await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
						const buffered = pendingIceRef.current.splice(0, pendingIceRef.current.length);
						for (const cand of buffered) await pc.addIceCandidate(cand).catch(() => {});
					} else if (sig.type === "ice") {
						if (pc.remoteDescription) await pc.addIceCandidate(sig.payload).catch(() => {});
						else pendingIceRef.current.push(sig.payload);
					} else if (sig.type === "bye") {
						setConnState((prev) => (prev === "ended" ? prev : "lost"));
					}
				} catch (err) {
					console.error("[useLiveConnection] failed to apply signal", {
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

	useEffect(() => {
		if (!enabled) return;
		closedRef.current = false;
		startConnection();
		poll();
		pollTimerRef.current = setInterval(poll, 2000);
		return () => {
			closedRef.current = true;
			if (pollTimerRef.current) clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
			// Final bye so the student stops offering to a viewer that's gone.
			fetch(`/api/lecturer/attempts/${attemptId}/signal`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ signals: [{ type: "bye", payload: {} }] }),
				keepalive: true,
			}).catch(() => {});
			teardownPeer();
			setStream(null);
		};
	}, [enabled, attemptId, startConnection, poll, teardownPeer]);

	return { connState, stream, reconnect: startConnection };
}
