/** Shared free STUN configuration for lecturer and student WebRTC peers. */
export function getWebRtcIceServers(): RTCIceServer[] {
	return [
		{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] },
	];
}
