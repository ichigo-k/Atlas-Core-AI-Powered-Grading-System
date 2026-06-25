/**
 * HTTP client for the Django grader microservice.
 *
 * All calls require the X-API-Key header. Both GRADER_URL and GRADER_API_KEY
 * are read from process.env at call time so that tests can override them via
 * environment variables without module-level caching issues.
 */

// Timeouts (ms) — batch can take long for large assessments; single is bounded.
const BATCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const SINGLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const HEALTH_TIMEOUT_MS = 5 * 1000; // 5 seconds

function getGraderConfig(): { graderUrl: string; graderApiKey: string } {
	const graderUrl = process.env.GRADER_URL;
	if (!graderUrl) {
		throw new Error("GRADER_URL environment variable is not set");
	}

	const graderApiKey = process.env.GRADER_API_KEY;
	if (!graderApiKey) {
		throw new Error("GRADER_API_KEY environment variable is not set");
	}

	return { graderUrl, graderApiKey };
}

/**
 * Calls POST <GRADER_URL>/api/grade/assessment/{assessmentId}/
 *
 * Batch-grades all eligible attempts for the given assessment.
 * Returns the raw Response so callers can inspect status and body.
 *
 * Timeout: 15 minutes (large assessments with many attempts can take a while).
 */
export async function callGraderBatch(assessmentId: number): Promise<Response> {
	const { graderUrl, graderApiKey } = getGraderConfig();

	return fetch(`${graderUrl}/api/grade/assessment/${assessmentId}/`, {
		method: "POST",
		headers: {
			"X-API-Key": graderApiKey,
		},
		signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
	});
}

/**
 * Calls POST <GRADER_URL>/api/grade/attempt/{attemptId}/
 *
 * Grades a single attempt. Returns the raw Response so callers can inspect
 * status and body.
 *
 * Timeout: 3 minutes (one attempt with ~10-15 questions).
 */
export async function callGraderSingle(attemptId: number): Promise<Response> {
	const { graderUrl, graderApiKey } = getGraderConfig();

	return fetch(`${graderUrl}/api/grade/attempt/${attemptId}/`, {
		method: "POST",
		headers: {
			"X-API-Key": graderApiKey,
		},
		signal: AbortSignal.timeout(SINGLE_TIMEOUT_MS),
	});
}

/**
 * Calls GET <GRADER_URL>/api/health/
 *
 * Lightweight health check to verify the grader service is reachable.
 * Returns true if the service responds with 2xx within 5 seconds, false otherwise.
 */
export async function isGraderHealthy(): Promise<boolean> {
	try {
		const { graderUrl } = getGraderConfig();
		const res = await fetch(`${graderUrl}/api/health/`, {
			method: "GET",
			signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
		});
		return res.ok;
	} catch {
		return false;
	}
}
