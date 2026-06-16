import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeGrade, parseGradingScale } from "@/lib/grading-scale"
import ExcelJS from "exceljs"

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

const SUPPORTED_FIELDS = [
  "studentId",
  "studentName",
  "email",
  "score",
  "totalMarks",
  "percentage",
  "grade",
  "attemptNumber",
  "submittedAt",
  "plagiarismFlagged",
] as const

type SupportedField = (typeof SUPPORTED_FIELDS)[number]

const FIELD_LABELS: Record<SupportedField, string> = {
  studentId: "Student ID",
  studentName: "Student Name",
  email: "Email",
  score: "Score",
  totalMarks: "Total Marks",
  percentage: "Percentage (%)",
  grade: "Grade",
  attemptNumber: "Best Attempt #",
  submittedAt: "Submitted At",
  plagiarismFlagged: "Plagiarism Flagged",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getLecturerId(email: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

function parseFieldsParam(searchParams: URLSearchParams): string[] | null {
  const all = searchParams.getAll("fields")
  if (all.length === 0) return null
  const flat = all.flatMap((v) => v.split(",").map((s) => s.trim())).filter(Boolean)
  return flat.length > 0 ? flat : null
}

function pct(score: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((score / total) * 10000) / 100
}

function fmtDate(d: Date | null): string {
  if (!d) return ""
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// Apply bold + fill to a header row
function styleHeader(row: ExcelJS.Row, fillColor = "002388") {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${fillColor}` } }
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: false }
  row.height = 22
}

// Auto-fit column widths based on content
function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 12
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length
      if (len > max) max = len
    })
    col.width = Math.min(max + 4, 50)
  })
}

// ---------------------------------------------------------------------------
// GET /api/lecturer/assessments/[id]/export/marks
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth
    const session = await auth()
    if (!session || session.user.role !== "LECTURER") {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const lecturerId = await getLecturerId(session.user.email!)
    if (!lecturerId) return Response.json({ error: "Forbidden" }, { status: 403 })

    // Parse assessment ID
    const { id } = await params
    const assessmentId = parseInt(id)
    if (isNaN(assessmentId)) return Response.json({ error: "Not found" }, { status: 404 })

    // Parse & validate fields
    const rawFields = parseFieldsParam(request.nextUrl.searchParams)
    let requestedFields: SupportedField[]
    if (rawFields === null) {
      requestedFields = [...SUPPORTED_FIELDS]
    } else {
      const invalid = rawFields.filter((f) => !(SUPPORTED_FIELDS as readonly string[]).includes(f))
      if (invalid.length > 0) {
        return Response.json({ error: `Invalid fields: ${invalid.join(", ")}` }, { status: 400 })
      }
      requestedFields = SUPPORTED_FIELDS.filter((f) => rawFields.includes(f))
    }

    // Ownership + grading status
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        lecturerId: true, gradingStatus: true, totalMarks: true, title: true,
        course: { select: { code: true, title: true } },
      },
    })
    if (!assessment || assessment.lecturerId !== lecturerId) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    if (assessment.gradingStatus !== "GRADED") {
      return Response.json({ error: "Cannot export marks before grading is complete" }, { status: 409 })
    }

    const totalMarks = assessment.totalMarks

    // Fetch all data in parallel
    const [attempts, gradingResults, settingsRow, enrolled] = await Promise.all([
      prisma.assessmentAttempt.findMany({
        where: { assessmentId, status: { in: ["SUBMITTED", "TIMED_OUT"] } },
        select: {
          id: true,
          attemptNumber: true,
          score: true,
          submittedAt: true,
          student: { select: { id: true, name: true, email: true } },
        },
        orderBy: { score: "desc" }, // highest score first so we pick best easily
      }),
      prisma.gradingResult.findMany({
        where: { assessmentId },
        select: { attemptId: true, plagiarismFlagged: true },
      }),
      prisma.systemSettings.findFirst({ select: { gradingScale: true } }),
      // Enrolled students via class assignments
      prisma.assessmentClass.findMany({
        where: { assessmentId },
        select: {
          class: {
            select: {
              name: true,
              students: {
                select: {
                  id: true, // StudentProfile.id == User.id
                  user: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      }),
    ])

    const grMap = new Map(gradingResults.map((r) => [r.attemptId, r]))
    const scale = parseGradingScale(settingsRow?.gradingScale)

    // Build enrolled student → class name map
    // StudentProfile.id == User.id; name/email are on .user
    const studentClassMap = new Map<number, string>()
    for (const ac of enrolled) {
      for (const s of ac.class.students) {
        if (!studentClassMap.has(s.id)) studentClassMap.set(s.id, ac.class.name)
      }
    }
    const allEnrolledStudents = enrolled.flatMap((ac) =>
      ac.class.students.map((s) => ({ id: s.id, name: s.user.name, email: s.user.email }))
    )
    const uniqueEnrolled = new Map(allEnrolledStudents.map((s) => [s.id, s]))

    // ── One row per student: pick best (highest score) attempt ───────────────
    const bestAttemptByStudent = new Map<
      number,
      { id: number; score: number; attemptNumber: number; submittedAt: Date | null; studentName: string; email: string; studentDbId: number }
    >()

    for (const attempt of attempts) {
      const sid = attempt.student.id
      const existing = bestAttemptByStudent.get(sid)
      const score = attempt.score ?? 0
      if (!existing || score > existing.score) {
        bestAttemptByStudent.set(sid, {
          id: attempt.id,
          score,
          attemptNumber: attempt.attemptNumber,
          submittedAt: attempt.submittedAt,
          studentName: attempt.student.name ?? "",
          email: attempt.student.email,
          studentDbId: sid,
        })
      }
    }

    // Build main rows — enrolled students first, non-submitters included
    type MarksRow = {
      studentId: string
      studentName: string
      email: string
      className: string
      score: number | null
      totalMarks: number
      percentage: number | null
      grade: string
      attemptNumber: number | null
      submittedAt: string
      plagiarismFlagged: boolean
      submitted: boolean
    }

    const marksRows: MarksRow[] = []
    for (const [sid, student] of uniqueEnrolled) {
      const best = bestAttemptByStudent.get(sid)
      const gr = best ? grMap.get(best.id) : undefined
      const score = best?.score ?? null
      const percentage = score !== null ? pct(score, totalMarks) : null
      const grade = score !== null ? computeGrade(score, totalMarks, scale) : "N/A"

      marksRows.push({
        studentId: student.email.split("@")[0],
        studentName: student.name ?? "",
        email: student.email,
        className: studentClassMap.get(sid) ?? "",
        score,
        totalMarks,
        percentage,
        grade,
        attemptNumber: best?.attemptNumber ?? null,
        submittedAt: best?.submittedAt ? fmtDate(best.submittedAt) : "",
        plagiarismFlagged: gr?.plagiarismFlagged ?? false,
        submitted: !!best,
      })
    }

    // Sort: submitted first, then by score desc, then name asc
    marksRows.sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1
      if (b.score !== a.score) return (b.score ?? -1) - (a.score ?? -1)
      return a.studentName.localeCompare(b.studentName)
    })

    // ── Build workbook ────────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "GCTU Grading System"
    workbook.created = new Date()

    // ── Sheet 1: Marks ────────────────────────────────────────────────────────
    const marksSheet = workbook.addWorksheet("Marks")

    // Assessment info rows
    marksSheet.addRow(["Assessment", assessment.title])
    marksSheet.addRow(["Course", assessment.course ? `${assessment.course.code} — ${assessment.course.title}` : ""])
    marksSheet.addRow(["Total Marks", totalMarks])
    marksSheet.addRow(["Exported", fmtDate(new Date())])
    marksSheet.addRow([]) // blank spacer

    // Column headers (row 6)
    const headerFields: (SupportedField | "className")[] = [
      ...(requestedFields.filter((f) => ["studentId", "studentName", "email"].includes(f)) as SupportedField[]),
      "className" as const,
      ...(requestedFields.filter((f) => !["studentId", "studentName", "email"].includes(f)) as SupportedField[]),
    ]

    const headerLabels = headerFields.map((f) =>
      f === "className" ? "Class" : FIELD_LABELS[f as SupportedField]
    )
    const headerRow = marksSheet.addRow(headerLabels)
    styleHeader(headerRow)

    // Data rows
    for (const row of marksRows) {
      const values = headerFields.map((f) => {
        if (f === "className") return row.className
        if (f === "studentId") return row.studentId
        if (f === "studentName") return row.studentName
        if (f === "email") return row.email
        if (f === "score") return row.score ?? "Not submitted"
        if (f === "totalMarks") return row.totalMarks
        if (f === "percentage") return row.percentage !== null ? row.percentage : "N/A"
        if (f === "grade") return row.grade
        if (f === "attemptNumber") return row.attemptNumber ?? "N/A"
        if (f === "submittedAt") return row.submittedAt || "Not submitted"
        if (f === "plagiarismFlagged") return row.plagiarismFlagged ? "Yes" : "No"
        return ""
      })
      const dataRow = marksSheet.addRow(values)

      // Highlight non-submitters in light red
      if (!row.submitted) {
        dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0F0" } }
      }
      // Highlight plagiarism flags
      if (row.plagiarismFlagged) {
        const flagIdx = headerFields.indexOf("plagiarismFlagged")
        if (flagIdx >= 0) {
          const cell = dataRow.getCell(flagIdx + 1)
          cell.font = { bold: true, color: { argb: "FFA4262C" } }
        }
      }
      // Color-code score cell
      const scoreIdx = headerFields.indexOf("score")
      if (scoreIdx >= 0 && row.score !== null) {
        const p = row.percentage ?? 0
        const cell = dataRow.getCell(scoreIdx + 1)
        cell.font = {
          bold: true,
          color: { argb: p >= 70 ? "FF107C10" : p >= 50 ? "FF7A5E00" : "FFA4262C" },
        }
      }
    }

    // Freeze header row
    marksSheet.views = [{ state: "frozen", ySplit: 6 }]
    autoFitColumns(marksSheet)

    // ── Sheet 2: Score Distribution ───────────────────────────────────────────
    const distSheet = workbook.addWorksheet("Score Distribution")

    const distHeader = distSheet.addRow(["Grade Band", "Score Range", "Students", "Percentage of Submitted"])
    styleHeader(distHeader, "0B4DBB")

    const submitted = marksRows.filter((r) => r.submitted)
    const gradeBands = [
      { label: "A+", min: 90,  max: 100 },
      { label: "A",  min: 80,  max: 89.99 },
      { label: "B",  min: 70,  max: 79.99 },
      { label: "C",  min: 60,  max: 69.99 },
      { label: "D",  min: 50,  max: 59.99 },
      { label: "F",  min: 0,   max: 49.99 },
    ]

    for (const band of gradeBands) {
      const count = submitted.filter(
        (r) => r.percentage !== null && r.percentage >= band.min && r.percentage <= band.max
      ).length
      const bandPct = submitted.length > 0 ? pct(count, submitted.length) : 0
      distSheet.addRow([
        band.label,
        `${band.min}% – ${band.max === 100 ? "100" : Math.floor(band.max)}%`,
        count,
        `${bandPct}%`,
      ])
    }

    // Summary rows
    distSheet.addRow([])
    distSheet.addRow(["Total enrolled", uniqueEnrolled.size])
    distSheet.addRow(["Total submitted", submitted.length])
    distSheet.addRow(["Not submitted", uniqueEnrolled.size - submitted.length])
    distSheet.addRow(["Submission rate", submitted.length > 0 ? `${pct(submitted.length, uniqueEnrolled.size)}%` : "0%"])

    const scores = submitted.map((r) => r.score ?? 0)
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      const highest = Math.max(...scores)
      const lowest = Math.min(...scores)
      distSheet.addRow([])
      distSheet.addRow(["Average score", `${Math.round(avg * 100) / 100} / ${totalMarks}`, `${pct(avg, totalMarks)}%`])
      distSheet.addRow(["Highest score", `${highest} / ${totalMarks}`, `${pct(highest, totalMarks)}%`])
      distSheet.addRow(["Lowest score", `${lowest} / ${totalMarks}`, `${pct(lowest, totalMarks)}%`])
    }

    autoFitColumns(distSheet)

    // ── Sheet 3: Class Summary ────────────────────────────────────────────────
    const classSheet = workbook.addWorksheet("Class Summary")
    const classHeader = classSheet.addRow([
      "Class", "Enrolled", "Submitted", "Submission Rate",
      "Average Score", "Average %", "Highest Score", "Lowest Score", "Pass Rate (≥50%)",
    ])
    styleHeader(classHeader, "0B4DBB")

    // Group by class
    const classMap = new Map<string, MarksRow[]>()
    for (const row of marksRows) {
      const cls = row.className || "Unknown"
      if (!classMap.has(cls)) classMap.set(cls, [])
      classMap.get(cls)!.push(row)
    }

    for (const [className, rows] of classMap) {
      const sub = rows.filter((r) => r.submitted)
      const classScores = sub.map((r) => r.score ?? 0)
      const avg = classScores.length > 0 ? classScores.reduce((a, b) => a + b, 0) / classScores.length : 0
      const highest = classScores.length > 0 ? Math.max(...classScores) : 0
      const lowest = classScores.length > 0 ? Math.min(...classScores) : 0
      const passes = sub.filter((r) => (r.percentage ?? 0) >= 50).length

      classSheet.addRow([
        className,
        rows.length,
        sub.length,
        sub.length > 0 ? `${pct(sub.length, rows.length)}%` : "0%",
        classScores.length > 0 ? `${Math.round(avg * 100) / 100} / ${totalMarks}` : "N/A",
        classScores.length > 0 ? `${pct(avg, totalMarks)}%` : "N/A",
        classScores.length > 0 ? `${highest} / ${totalMarks}` : "N/A",
        classScores.length > 0 ? `${lowest} / ${totalMarks}` : "N/A",
        sub.length > 0 ? `${pct(passes, sub.length)}%` : "N/A",
      ])
    }

    autoFitColumns(classSheet)

    // ── Sheet 4: All Attempts (raw) ───────────────────────────────────────────
    const allSheet = workbook.addWorksheet("All Attempts")
    const allHeader = allSheet.addRow([
      "Student Name", "Email", "Class", "Attempt #", "Score", "Total Marks",
      "Percentage (%)", "Grade", "Submitted At", "Plagiarism Flagged", "Is Best Attempt",
    ])
    styleHeader(allHeader, "605e5c")

    for (const attempt of attempts.sort((a, b) => {
      const nameA = a.student.name ?? a.student.email
      const nameB = b.student.name ?? b.student.email
      if (nameA !== nameB) return nameA.localeCompare(nameB)
      return a.attemptNumber - b.attemptNumber
    })) {
      const gr = grMap.get(attempt.id)
      const score = attempt.score ?? 0
      const p = pct(score, totalMarks)
      const grade = attempt.score != null ? computeGrade(score, totalMarks, scale) : "N/A"
      const best = bestAttemptByStudent.get(attempt.student.id)
      const isBest = best?.id === attempt.id

      allSheet.addRow([
        attempt.student.name ?? "",
        attempt.student.email,
        studentClassMap.get(attempt.student.id) ?? "",
        attempt.attemptNumber,
        attempt.score ?? 0,
        totalMarks,
        attempt.score != null ? p : "N/A",
        grade,
        attempt.submittedAt ? fmtDate(attempt.submittedAt) : "",
        gr?.plagiarismFlagged ? "Yes" : "No",
        isBest ? "Yes" : "",
      ])
    }

    autoFitColumns(allSheet)

    // ── Stream response ───────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer()
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `marks-${assessmentId}-${timestamp}.xlsx`

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[GET /api/lecturer/assessments/[id]/export/marks] export failed", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return Response.json({ error: "SERVER_ERROR" }, { status: 500 })
  }
}
