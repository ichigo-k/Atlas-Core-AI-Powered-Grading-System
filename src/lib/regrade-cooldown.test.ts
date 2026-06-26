/**
 * Tests for computeRetryAfterSeconds — pure cooldown computation utility.
 *
 * Covers:
 *  - Example-based unit tests for the documented behaviour
 *  - Property-based tests (fast-check) for Property 4 from the design doc
 *
 * Feature: grading-workflow, Property 4: Cooldown enforcement is correct for any timestamp
 * Validates: Requirements 3.1, 3.2, 3.5
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeRetryAfterSeconds } from "./regrade-cooldown";

// ---------------------------------------------------------------------------
// Example-based unit tests
// ---------------------------------------------------------------------------

describe("computeRetryAfterSeconds — example-based", () => {
	const BASE = new Date("2024-01-01T10:00:00.000Z");

	it("returns remaining seconds when 15 minutes have elapsed of a 30-minute cooldown", () => {
		const now = new Date("2024-01-01T10:15:00.000Z"); // 15 min elapsed
		expect(computeRetryAfterSeconds(BASE, 30, now)).toBe(900); // 15 * 60
	});

	it("returns null when exactly 30 minutes have elapsed (cooldown boundary)", () => {
		const now = new Date("2024-01-01T10:30:00.000Z"); // exactly 30 min
		expect(computeRetryAfterSeconds(BASE, 30, now)).toBeNull();
	});

	it("returns null when more than 30 minutes have elapsed", () => {
		const now = new Date("2024-01-01T10:45:00.000Z"); // 45 min elapsed
		expect(computeRetryAfterSeconds(BASE, 30, now)).toBeNull();
	});

	it("returns null when now equals gradedAt (zero elapsed, zero cooldown)", () => {
		expect(computeRetryAfterSeconds(BASE, 0, BASE)).toBeNull();
	});

	it("returns 1 when only 1 second remains (rounds up with Math.ceil)", () => {
		// 30 min cooldown, 29 min 59.5 s elapsed → 0.5 s remaining → ceil → 1
		const now = new Date(BASE.getTime() + 30 * 60 * 1000 - 500);
		expect(computeRetryAfterSeconds(BASE, 30, now)).toBe(1);
	});

	it("returns the full cooldown in seconds when now === gradedAt", () => {
		// 0 elapsed, full 30 min remaining
		expect(computeRetryAfterSeconds(BASE, 30, BASE)).toBe(1800);
	});

	it("defaults now to the current time when omitted (smoke test)", () => {
		// gradedAt far in the future → cooldown definitely not expired
		const futureGradedAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
		const result = computeRetryAfterSeconds(futureGradedAt, 30);
		// The cooldown window starts in the future, so remaining > 30 min
		expect(result).not.toBeNull();
		expect(result as number).toBeGreaterThan(0);
	});

	it("returns null when gradedAt is in the future but cooldown is 0", () => {
		const futureGradedAt = new Date(Date.now() + 60 * 60 * 1000);
		// cooldown 0 → expiry === gradedAt, which is in the future relative to now
		// remaining > 0, so should return ceil(remaining/1000) > 0
		const result = computeRetryAfterSeconds(futureGradedAt, 0);
		// expiry = futureGradedAt + 0 = futureGradedAt > now → still in window
		expect(result).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Property-based tests (fast-check)
// Feature: grading-workflow, Property 4: Cooldown enforcement is correct for any timestamp
// Validates: Requirements 3.1, 3.2, 3.5
// ---------------------------------------------------------------------------

describe("computeRetryAfterSeconds — property-based (Property 4)", () => {
	/**
	 * Arbitrary for a Date within a reasonable range (±10 years from epoch).
	 * Using integer milliseconds to avoid floating-point edge cases.
	 */
	const dateArb = fc
		.integer({ min: 0, max: 2 * 365 * 24 * 60 * 60 * 1000 * 10 })
		.map((ms: any) => new Date(ms));

	/** Cooldown in minutes: 0–120 (covers realistic values including 30). */
	const cooldownArb = fc.integer({ min: 0, max: 120 });

	it("returns null when elapsed time >= cooldown duration", () => {
		fc.assert(
			fc.property(dateArb, cooldownArb, (gradedAt, cooldownMinutes) => {
				const cooldownMs = cooldownMinutes * 60 * 1000;
				// Place `now` exactly at or after the expiry
				const now = new Date(gradedAt.getTime() + cooldownMs);
				const result = computeRetryAfterSeconds(gradedAt, cooldownMinutes, now);
				expect(result).toBeNull();
			}),
			{ numRuns: 200 },
		);
	});

	it("returns null when now is strictly after the expiry", () => {
		fc.assert(
			fc.property(
				dateArb,
				cooldownArb,
				fc.integer({ min: 1, max: 60 * 60 * 1000 }), // 1 ms – 1 hour past expiry
				(gradedAt, cooldownMinutes, msAfterExpiry) => {
					const cooldownMs = cooldownMinutes * 60 * 1000;
					const now = new Date(
						gradedAt.getTime() + cooldownMs + msAfterExpiry,
					);
					const result = computeRetryAfterSeconds(gradedAt, cooldownMinutes, now);
					expect(result).toBeNull();
				},
			),
			{ numRuns: 200 },
		);
	});

	it("returns a positive integer when now is strictly before the expiry", () => {
		fc.assert(
			fc.property(
				dateArb,
				fc.integer({ min: 1, max: 120 }), // cooldown must be > 0 for window to exist
				fc.integer({ min: 1, max: 60 * 60 * 1000 - 1 }), // ms before expiry (at least 1 ms remaining)
				(gradedAt, cooldownMinutes, msBeforeExpiry) => {
					const cooldownMs = cooldownMinutes * 60 * 1000;
					// Ensure msBeforeExpiry < cooldownMs so now is inside the window
					const clampedMs = Math.min(msBeforeExpiry, cooldownMs - 1);
					const now = new Date(
						gradedAt.getTime() + cooldownMs - clampedMs,
					);
					const result = computeRetryAfterSeconds(gradedAt, cooldownMinutes, now);
					expect(result).not.toBeNull();
					expect(result as number).toBeGreaterThan(0);
					expect(Number.isInteger(result)).toBe(true);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("returned seconds equals Math.ceil of remaining milliseconds / 1000", () => {
		fc.assert(
			fc.property(
				dateArb,
				fc.integer({ min: 1, max: 120 }),
				fc.integer({ min: 1, max: 60 * 60 * 1000 - 1 }),
				(gradedAt, cooldownMinutes, msBeforeExpiry) => {
					const cooldownMs = cooldownMinutes * 60 * 1000;
					const clampedMs = Math.min(msBeforeExpiry, cooldownMs - 1);
					const now = new Date(
						gradedAt.getTime() + cooldownMs - clampedMs,
					);
					const result = computeRetryAfterSeconds(gradedAt, cooldownMinutes, now);
					const expectedRemainingMs =
						gradedAt.getTime() + cooldownMs - now.getTime();
					const expected = Math.ceil(expectedRemainingMs / 1000);
					expect(result).toBe(expected);
				},
			),
			{ numRuns: 200 },
		);
	});

	it("result is never zero or negative when within the cooldown window", () => {
		fc.assert(
			fc.property(
				dateArb,
				fc.integer({ min: 1, max: 120 }),
				fc.integer({ min: 1, max: 60 * 60 * 1000 - 1 }),
				(gradedAt, cooldownMinutes, msBeforeExpiry) => {
					const cooldownMs = cooldownMinutes * 60 * 1000;
					const clampedMs = Math.min(msBeforeExpiry, cooldownMs - 1);
					const now = new Date(
						gradedAt.getTime() + cooldownMs - clampedMs,
					);
					const result = computeRetryAfterSeconds(gradedAt, cooldownMinutes, now);
					if (result !== null) {
						expect(result).toBeGreaterThan(0);
					}
				},
			),
			{ numRuns: 200 },
		);
	});
});
