# Live View Proctoring API Contract

Backend for real-time exam proctoring. Video goes browser-to-browser via WebRTC;
this API handles **signaling, presence, chat, and lecturer flags** through
Postgres-backed polling routes (serverless-friendly — no websockets).

Conventions:

- All responses are JSON. Errors are `{ "error": "<CODE>" }` with an appropriate
  HTTP status. Server failures are `{ "error": "SERVER_ERROR" }` with status 500.
- All timestamps are ISO 8601 strings.
- Signal `type` is one of `"offer" | "answer" | "ice" | "bye"`; `payload` is
  arbitrary JSON (SDP / ICE candidate / `{}` for bye).
- Signal rows older than 5 minutes are deleted opportunistically by the polling
  routes — clients must tolerate lost stale signals and restart negotiation.
- Presence: a student is **online** if their last combined poll was within 15s.

---

## Student

### `POST /api/student/attempts/[id]/live`

The single combined poll the exam client calls every ~2s while an attempt is
IN_PROGRESS. `[id]` = attemptId. Auth: session student must own the attempt.

**Request body** (all optional; `{}` or empty body = pure poll):

```json
{
  "signals": [
    { "type": "answer", "payload": { /* SDP */ } },
    { "type": "ice", "payload": { /* ICE candidate */ } }
  ]
}
```

Student-sent signals are persisted with sender `STUDENT` (typically
`answer`/`ice`, plus `bye` when tearing down).

**Response 200:**

```json
{
  "messages": [
    { "id": 12, "senderRole": "LECTURER", "body": "Please face the camera", "createdAt": "2026-07-03T10:00:00.000Z" }
  ],
  "signals": [
    { "id": 55, "type": "offer", "payload": { }, "createdAt": "2026-07-03T10:00:01.000Z" }
  ],
  "flagCount": 2,
  "lecturerFlags": [
    { "type": "LECTURER_FLAG", "message": "Talking detected", "detectedAt": "2026-07-03T10:00:02.000Z", "flagCountAfter": 2 }
  ]
}
```

- `messages`: all previously undelivered `ProctorMessage` rows for this attempt,
  oldest first. Marked delivered by this call (returned exactly once).
- `signals`: all unconsumed LECTURER-sender signals, oldest first. Marked
  consumed by this call (returned exactly once).
- `flagCount`: current total flag count from the ProctorRecord.
- `lecturerFlags`: lecturer-issued flags **since the previous poll** — derived
  from proctoringLog entries with `source: "LECTURER"` whose `detectedAt` is
  newer than the ProctorRecord's previous `lastSeenAt` (falls back to the last
  10 seconds on the first poll). Because a flag can theoretically straddle two
  polls, clients should dedupe by `detectedAt`. `message` is the lecturer's
  reason or `null`. Usually empty (`[]`).

Side effect: updates `ProctorRecord.lastSeenAt = now` (presence heartbeat).

**Errors:**

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "INVALID_JSON" }` | body is not valid JSON |
| 400 | `{ "error": "INVALID_SIGNALS" }` | signals not an array of `{type, payload}` with a valid type |
| 401 | `{ "error": "UNAUTHORIZED" }` | not logged in as a STUDENT |
| 404 | `{ "error": "NOT_FOUND" }` | attempt missing or not owned by this student |
| 404 | `{ "error": "NO_PROCTOR_RECORD" }` | attempt has no ProctorRecord (non-proctored) |
| 409 | `{ "error": "ATTEMPT_NOT_IN_PROGRESS" }` | attempt submitted/ended — stop polling |

---

## Lecturer

All lecturer routes require a LECTURER session **and** that the lecturer owns
the assessment the attempt/assessment belongs to. Failures: 403
`{ "error": "FORBIDDEN" }` (not a lecturer), 404 `{ "error": "NOT_FOUND" }`
(missing or not owned).

### `GET /api/lecturer/assessments/[id]/live`

Live View roster. `[id]` = assessmentId. Lists every IN_PROGRESS attempt of the
assessment that has a ProctorRecord.

**Response 200:**

```json
{
  "students": [
    {
      "attemptId": 41,
      "studentName": "Ama Mensah",
      "indexNumber": "UEB0123456",
      "lastSeenAt": "2026-07-03T10:00:03.000Z",
      "online": true,
      "flagCount": 2,
      "flagThreshold": 5,
      "latestViolation": {
        "violationType": "TAB_SWITCH",
        "source": "CLIENT",
        "detectedAt": "2026-07-03T09:59:50.000Z",
        "reason": null
      }
    }
  ]
}
```

- Sorted by `flagCount` descending.
- `online` = `lastSeenAt` within the last 15 seconds.
- `latestViolation` is the newest proctoringLog entry, or `null` if none.
  `studentName`, `indexNumber`, `lastSeenAt` may be `null`.

### `POST /api/lecturer/attempts/[id]/signal`

The lecturer's signaling poll for one attempt (call every ~2s while watching).
`[id]` = attemptId.

**Request body** (empty/omitted `signals` = pure poll):

```json
{ "signals": [ { "type": "offer", "payload": { /* SDP */ } } ] }
```

Persists the given signals with sender `LECTURER`, then returns **and marks
consumed** all unconsumed STUDENT-sender signals.

**Response 200:**

```json
{
  "signals": [
    { "id": 60, "type": "answer", "payload": { }, "createdAt": "2026-07-03T10:00:04.000Z" }
  ]
}
```

**Errors:** 400 `INVALID_JSON` / `INVALID_SIGNALS`, 403, 404, and
409 `{ "error": "ATTEMPT_NOT_IN_PROGRESS" }` once the attempt ends (stop
polling; treat as a normal end-of-stream, not a failure).

### `POST /api/lecturer/attempts/[id]/message`

Send a chat message to the student. Delivered on the student's next combined
poll.

**Request body:** `{ "body": "Please face the camera" }` (non-empty string;
trimmed).

**Response 200:**

```json
{ "message": { "id": 12, "body": "Please face the camera", "createdAt": "2026-07-03T10:00:00.000Z" } }
```

**Errors:** 400 `INVALID_JSON` / `BODY_REQUIRED`, 403, 404,
409 `ATTEMPT_NOT_IN_PROGRESS`.

### `POST /api/lecturer/attempts/[id]/flag`

Issue a manual proctoring flag. Same semantics as automatic client flags:
increments `flagCount`, appends a proctoringLog entry
(`violationType: "LECTURER_FLAG"`, `source: "LECTURER"`, `reason`, timestamp),
and **auto-submits the attempt** if `flagCount` reaches `flagThreshold`.

**Request body (optional):** `{ "reason": "Talking to someone off-screen" }`

**Response 200:**

```json
{ "flagCount": 3, "willAutoSubmit": false }
```

When `willAutoSubmit` is `true` the attempt has been force-submitted
(`PROCTOR_VIOLATION`); subsequent polls will return 409.

**Errors:** 400 `INVALID_JSON`, 403, 404 (`NOT_FOUND` or `NO_PROCTOR_RECORD`),
409 `ATTEMPT_NOT_IN_PROGRESS`.

---

## Suggested client loops

- **Student (every ~2s):** POST `/live` with any queued answer/ice signals →
  render `messages`, feed `signals` to RTCPeerConnection, toast `lecturerFlags`,
  update flag counter from `flagCount`.
- **Lecturer roster (every ~5s):** GET `/assessments/[id]/live`.
- **Lecturer watching a student (every ~2s):** POST `/attempts/[id]/signal`
  with queued offer/ice; on stop, send a `bye` signal and cease polling.
