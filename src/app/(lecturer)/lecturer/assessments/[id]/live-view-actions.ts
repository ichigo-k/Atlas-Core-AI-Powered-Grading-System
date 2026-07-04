"use client";

/**
 * Shared client helpers for the two lecturer live-view actions — sending a
 * message and issuing a manual flag. Both map the 409 "attempt ended" case to
 * a distinct `ended` flag so callers can react without inspecting HTTP status.
 */

export type SendMessageResult =
	| { ok: true; message: { id: number; body: string; createdAt: string } }
	| { ok: false; ended?: boolean };

export async function sendStudentMessage(attemptId: number, body: string): Promise<SendMessageResult> {
	try {
		const res = await fetch(`/api/lecturer/attempts/${attemptId}/message`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body }),
		});
		if (res.status === 409) return { ok: false, ended: true };
		if (!res.ok) return { ok: false };
		const data = await res.json();
		return { ok: true, message: data.message };
	} catch {
		return { ok: false };
	}
}

export type FlagResult =
	| { ok: true; flagCount: number; willAutoSubmit: boolean }
	| { ok: false; ended?: boolean };

export async function flagStudent(attemptId: number, reason?: string): Promise<FlagResult> {
	try {
		const res = await fetch(`/api/lecturer/attempts/${attemptId}/flag`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(reason && reason.trim() ? { reason: reason.trim() } : {}),
		});
		if (res.status === 409) return { ok: false, ended: true };
		if (!res.ok) return { ok: false };
		const data = await res.json();
		return { ok: true, flagCount: data.flagCount, willAutoSubmit: data.willAutoSubmit };
	} catch {
		return { ok: false };
	}
}
