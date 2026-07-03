import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { applyProctorFlag } from '@/lib/proctor-flag'

interface ClientEventBody {
  attemptId: number
  violationType: string
  detectedAt: string
}

// POST /api/internal/proctor/flag
export async function POST(request: NextRequest) {
  try {
    // Guard against empty body (e.g. preflight or mis-fired requests)
    const text = await request.text()
    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    let body: ClientEventBody
    try {
      body = JSON.parse(text) as ClientEventBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Authenticate — must be a logged-in student
    const session = await getSession()
    if (!session?.user || session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attemptId, violationType, detectedAt } = body

    const result = await applyProctorFlag({
      attemptId,
      violationType,
      source: 'CLIENT',
      detectedAt,
    })

    if (!result.found) {
      // Non-proctored exam — graceful no-op
      return NextResponse.json({ success: true, flagCount: 0 })
    }

    return NextResponse.json({
      success: true,
      flagCount: result.flagCount,
      violationType,
      source: 'CLIENT',
      willAutoSubmit: result.willAutoSubmit,
    })
  } catch (err) {
    console.error('[POST /api/internal/proctor/flag]', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 })
  }
}
