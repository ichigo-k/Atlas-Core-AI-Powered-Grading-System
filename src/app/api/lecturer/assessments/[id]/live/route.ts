import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ONLINE_WINDOW_MS } from '@/lib/live-view'
import type { ProctoringLogEntry } from '@/lib/proctor-log'

/**
 * GET /api/lecturer/assessments/[id]/live
 *
 * Lists all IN_PROGRESS attempts (that have a ProctorRecord) for an
 * assessment the lecturer owns — the Live View roster. Presence is derived
 * from ProctorRecord.lastSeenAt (online = seen within the last 15s).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const assessmentId = parseInt(id)
  try {
    const session = await auth()
    if (!session || session.user.role !== 'LECTURER') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

    if (isNaN(assessmentId)) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { lecturerId: true },
    })
    if (!assessment || assessment.lecturerId !== user.id) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    const onlineCutoff = new Date(Date.now() - ONLINE_WINDOW_MS)
    const records = await prisma.proctorRecord.findMany({
      where: {
        attempt: { assessmentId, status: 'IN_PROGRESS' },
        lastSeenAt: { gte: onlineCutoff },
      },
      orderBy: { flagCount: 'desc' },
      select: {
        attemptId: true,
        flagCount: true,
        flagThreshold: true,
        lastSeenAt: true,
        proctoringLog: true,
        attempt: {
          select: {
            student: {
              select: {
                name: true,
                studentProfile: { select: { indexNumber: true } },
              },
            },
          },
        },
      },
    })

    const now = Date.now()
    const students = records.map((r) => {
      const log = (Array.isArray(r.proctoringLog) ? r.proctoringLog : []) as unknown as ProctoringLogEntry[]
      const latest = log.length > 0 ? log[log.length - 1] : null
      return {
        attemptId: r.attemptId,
        studentName: r.attempt.student.name ?? null,
        indexNumber: r.attempt.student.studentProfile?.indexNumber ?? null,
        lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
        online: r.lastSeenAt !== null && now - r.lastSeenAt.getTime() <= ONLINE_WINDOW_MS,
        flagCount: r.flagCount,
        flagThreshold: r.flagThreshold,
        latestViolation: latest
          ? {
              violationType: latest.violationType,
              source: latest.source,
              detectedAt: latest.detectedAt,
              reason: latest.reason ?? null,
            }
          : null,
      }
    })

    return NextResponse.json({ students })
  } catch (err) {
    console.error('[GET /api/lecturer/assessments/[id]/live]', {
      assessmentId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
