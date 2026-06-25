/**
 * Proctoring log serialization utilities.
 *
 * Provides typed serialization, deserialization, and pretty-printing for
 * ProctoringLogEntry arrays stored in ProctorRecord.proctoringLog (JSON field).
 *
 * Requirements: 12.1, 12.2, 12.3
 */

export interface ProctoringLogEntry {
  /**
   * anomalyType from Oracle, or client-side browser event type.
   *
   * Oracle-sourced values (source = 'ORACLE'):
   *   PHONE_DETECTED | LOOKING_AWAY | PERSON_ABSENT | MULTIPLE_PERSONS |
   *   SUSPICIOUS_OBJECT | TALKING_DETECTED | POOR_LIGHTING | CONNECTION_LOST
   *
   * Client-sourced values (source = 'CLIENT'):
   *   FULLSCREEN_EXIT | TAB_SWITCH | CONNECTION_LOST
   */
  violationType: string
  /** Whether the event originated from the client browser or Oracle */
  source: 'CLIENT' | 'ORACLE'
  /** Anomaly confidence score; null for client-side events */
  confidence: number | null
  /** ISO 8601 timestamp of when the event was detected */
  detectedAt: string
  /** Value of ProctorRecord.flagCount after this event was appended */
  flagCountAfter: number
}

/**
 * Serialize an array of ProctoringLogEntry objects to a JSON string.
 *
 * Requirements: 12.1
 */
export function serializeProctoringLog(entries: ProctoringLogEntry[]): string {
  return JSON.stringify(entries)
}

/**
 * Deserialize a JSON string back into a ProctoringLogEntry array.
 *
 * Validates each entry against the schema and throws a descriptive error for
 * any malformed entry rather than crashing silently.
 *
 * Required fields: violationType (string), source ('CLIENT' | 'ORACLE'),
 *                  detectedAt (string), flagCountAfter (number)
 * Optional fields: confidence (number | null)
 *
 * Requirements: 12.2
 */
export function deserializeProctoringLog(json: string): ProctoringLogEntry[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('ProctoringLog JSON is not valid JSON')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('ProctoringLog JSON must be an array')
  }

  return parsed.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`ProctoringLogEntry at index ${index} is not an object`)
    }

    const entry = raw as Record<string, unknown>

    // --- Required fields ---

    if (typeof entry.violationType !== 'string') {
      throw new Error(
        `ProctoringLogEntry at index ${index} is missing required field 'violationType'`,
      )
    }

    if (entry.source !== 'CLIENT' && entry.source !== 'ORACLE') {
      throw new Error(
        `ProctoringLogEntry at index ${index} has invalid 'source': must be 'CLIENT' or 'ORACLE'`,
      )
    }

    if (typeof entry.detectedAt !== 'string') {
      throw new Error(
        `ProctoringLogEntry at index ${index} is missing required field 'detectedAt'`,
      )
    }

    if (typeof entry.flagCountAfter !== 'number') {
      throw new Error(
        `ProctoringLogEntry at index ${index} is missing required field 'flagCountAfter'`,
      )
    }

    // --- Optional fields (default to null if absent) ---

    const confidence =
      entry.confidence === undefined
        ? null
        : entry.confidence === null || typeof entry.confidence === 'number'
          ? (entry.confidence as number | null)
          : (() => {
              throw new Error(
                `ProctoringLogEntry at index ${index} has invalid 'confidence': must be a number or null`,
              )
            })()

    return {
      violationType: entry.violationType as string,
      source: entry.source as 'CLIENT' | 'ORACLE',
      confidence,
      detectedAt: entry.detectedAt as string,
      flagCountAfter: entry.flagCountAfter as number,
    }
  })
}

/**
 * Pretty-print a ProctoringLogEntry array for human-readable export or display.
 *
 * Format per entry:
 *   [N] <detectedAt> | <violationType> | <source> | confidence: <value> | flags: <flagCountAfter>
 *
 * The confidence segment is omitted for CLIENT-sourced entries (where confidence is null).
 *
 * Returns an empty string for empty arrays.
 *
 * Requirements: 12.3
 */
export function formatProctoringLog(entries: ProctoringLogEntry[]): string {
  if (entries.length === 0) return ''

  return entries
    .map((entry, index) => {
      const parts: string[] = [
        `[${index + 1}]`,
        entry.detectedAt,
        entry.violationType,
        entry.source,
      ]

      if (entry.confidence !== null) {
        parts.push(`confidence: ${entry.confidence}`)
      }

      parts.push(`flags: ${entry.flagCountAfter}`)

      return parts.join(' | ')
    })
    .join('\n')
}
