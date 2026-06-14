"use server"

import { getProctoringLog } from "@/lib/proctor-queries"
import type { ProctoringLogEntry } from "@/lib/proctor-log"

export async function getProctoringLogAction(
  attemptId: number,
  userId: number,
): Promise<ProctoringLogEntry[]> {
  return getProctoringLog(attemptId, userId)
}
