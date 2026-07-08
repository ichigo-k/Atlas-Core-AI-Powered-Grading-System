"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedRow {
  rowNum: number
  type: "OBJECTIVE" | "SUBJECTIVE"
  body: string
  marks: number
  // Objective
  optionA?: string
  optionB?: string
  optionC?: string
  optionD?: string
  correctOption?: number // 0-indexed
  // Subjective
  answerType?: "FILL_IN" | "PDF_UPLOAD" | "CODE"
  rubricCriteria: Array<{ description: string; maxMarks: number; order: number }>
  // Validation
  error?: string
}

interface ExcelImportModalProps {
  open: boolean
  bankId: number
  bankTitle: string
  onClose: () => void
  onImported: () => void
}

// ─── Template download ────────────────────────────────────────────────────────

async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Question Bank"

  // ── Instructions sheet ──────────────────────────────────────────────────────
  const info = wb.addWorksheet("Instructions")
  info.getColumn(1).width = 80

  const title = info.getCell("A1")
  title.value = "Question Bank Import — Instructions"
  title.font = { bold: true, size: 14, color: { argb: "FF002388" } }
  info.getRow(1).height = 28

  const rules: [string, string][] = [
    ["Column", "Rules"],
    ["type", 'OBJECTIVE  →  Multiple-choice question (requires options + correct_option)\nSUBJECTIVE →  Open-ended question (requires answer_type, leave options blank)'],
    ["body", "The full question text. Required. No character limit."],
    ["marks", "Whole number ≥ 1. Required."],
    ["option_a … option_d", "OBJECTIVE only. At least option_a and option_b must be filled."],
    ["correct_option", "OBJECTIVE only. Enter A, B, C, or D (the letter of the correct answer)."],
    ["answer_type", "SUBJECTIVE only. Must be exactly one of:\n  FILL_IN     — student types a text answer\n  PDF_UPLOAD  — student uploads a PDF\n  CODE        — student writes code"],
    ["rubric", "SUBJECTIVE only. Optional compact rubric using Description: marks; Description: marks.\nExample: Accuracy: 3; Clarity: 2"],
    ["rubric_1_description / rubric_1_marks", "SUBJECTIVE only. Optional structured rubric columns. The template includes three criteria pairs; CSV imports can add more numbered pairs if needed."],
  ]

  rules.forEach(([col, rule], i) => {
    const row = info.getRow(i + 3)
    row.height = i === 0 ? 18 : 42
    const c1 = row.getCell(1)
    const c2 = row.getCell(2)
    c1.value = col
    c2.value = rule
    c1.font = { bold: i === 0, size: 11, color: { argb: i === 0 ? "FFFFFFFF" : "FF002388" } }
    c2.font = { size: 10 }
    c2.alignment = { wrapText: true, vertical: "top" }
    if (i === 0) {
      c1.fill = c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002388" } }
      c2.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } }
    } else {
      c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF0F4FF" : "FFFFFFFF" } }
      c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FFF0F4FF" : "FFFFFFFF" } }
    }
    c1.border = c2.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    }
  })
  info.getColumn(1).width = 22
  info.getColumn(2).width = 70

  // ── Questions sheet ─────────────────────────────────────────────────────────
  const ws = wb.addWorksheet("Questions")

  const COLS = [
    { key: "type",           header: "type",           width: 14 },
    { key: "body",           header: "body",           width: 60 },
    { key: "marks",          header: "marks",          width: 8  },
    { key: "option_a",       header: "option_a",       width: 22 },
    { key: "option_b",       header: "option_b",       width: 22 },
    { key: "option_c",       header: "option_c",       width: 22 },
    { key: "option_d",       header: "option_d",       width: 22 },
    { key: "correct_option", header: "correct_option", width: 16 },
    { key: "answer_type",    header: "answer_type",    width: 16 },
    { key: "rubric",         header: "rubric",         width: 45 },
    { key: "rubric_1_description", header: "rubric_1_description", width: 28 },
    { key: "rubric_1_marks", header: "rubric_1_marks", width: 16 },
    { key: "rubric_2_description", header: "rubric_2_description", width: 28 },
    { key: "rubric_2_marks", header: "rubric_2_marks", width: 16 },
    { key: "rubric_3_description", header: "rubric_3_description", width: 28 },
    { key: "rubric_3_marks", header: "rubric_3_marks", width: 16 },
  ]

  ws.columns = COLS.map((c: any) => ({ key: c.key, width: c.width }))

  // Header row
  const headerRow = ws.getRow(1)
  COLS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF002388" } }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF001A6E" } },
      right: { style: "thin", color: { argb: "FF3355BB" } },
    }
  })
  headerRow.height = 22

  // Example rows
  const examples = [
    {
      type: "OBJECTIVE",
      body: "Which data structure uses LIFO ordering?",
      marks: 2,
      option_a: "Queue",
      option_b: "Stack",
      option_c: "Linked List",
      option_d: "Tree",
      correct_option: "B",
      answer_type: "",
    },
    {
      type: "OBJECTIVE",
      body: "What is the time complexity of binary search?",
      marks: 2,
      option_a: "O(n)",
      option_b: "O(n²)",
      option_c: "O(log n)",
      option_d: "O(1)",
      correct_option: "C",
      answer_type: "",
    },
    {
      type: "SUBJECTIVE",
      body: "Explain the difference between a process and a thread.",
      marks: 5,
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_option: "",
      answer_type: "FILL_IN",
      rubric: "Accuracy: 3; Clarity: 2",
    },
    {
      type: "SUBJECTIVE",
      body: "Write a function that reverses a linked list.",
      marks: 8,
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_option: "",
      answer_type: "CODE",
      rubric: "",
      rubric_1_description: "Correct algorithm",
      rubric_1_marks: 5,
      rubric_2_description: "Code quality",
      rubric_2_marks: 2,
      rubric_3_description: "Edge cases",
      rubric_3_marks: 1,
    },
  ]

  examples.forEach((ex, ri) => {
    const row = ws.getRow(ri + 2)
    const isObj = ex.type === "OBJECTIVE"
    const bg = ri % 2 === 0 ? "FFF8FAFF" : "FFFFFFFF"

    COLS.forEach((col, ci) => {
      const cell = row.getCell(ci + 1)
      cell.value = (ex as Record<string, string | number>)[col.key] ?? ""
      cell.alignment = { vertical: "top", wrapText: col.key === "body" }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } }
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      }

      // Colour-code type cell
      if (col.key === "type") {
        cell.font = { bold: true, color: { argb: isObj ? "FF92400E" : "FF5B21B6" } }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isObj ? "FFFEF3C7" : "FFF5F3FF" } }
      }
      // Dim N/A cells
      if (
        (isObj && ["answer_type", "rubric", "rubric_1_description", "rubric_1_marks", "rubric_2_description", "rubric_2_marks", "rubric_3_description", "rubric_3_marks"].includes(col.key)) ||
        (!isObj && ["option_a","option_b","option_c","option_d","correct_option"].includes(col.key))
      ) {
        cell.font = { color: { argb: "FFCBD5E1" }, italic: true }
        cell.value = ""
      }
    })
    row.height = 32
  })

  // Data validation for rows 2–200
  for (let r = 2; r <= 200; r++) {
    // type dropdown
    ws.getCell(`A${r}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"OBJECTIVE,SUBJECTIVE"'],
      showErrorMessage: true,
      errorTitle: "Invalid type",
      error: "Must be OBJECTIVE or SUBJECTIVE",
    }
    // correct_option dropdown
    ws.getCell(`H${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"A,B,C,D"'],
      showErrorMessage: true,
      errorTitle: "Invalid option",
      error: "Must be A, B, C, or D",
    }
    // answer_type dropdown
    ws.getCell(`I${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"FILL_IN,PDF_UPLOAD,CODE"'],
      showErrorMessage: true,
      errorTitle: "Invalid answer type",
      error: "Must be FILL_IN, PDF_UPLOAD, or CODE",
    }
    // marks: whole number ≥ 1
    ws.getCell(`C${r}`).dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [1],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Invalid marks",
      error: "Marks must be a whole number ≥ 1",
    }
  }

  // Freeze header row
  ws.views = [{ state: "frozen", ySplit: 1 }]

  // Generate and download
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "question-bank-template.xlsx"
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Parser ───────────────────────────────────────────────────────────────────

async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()

  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer)
    const lines = text.split(/\r?\n/).filter((l: any) => l.trim())
    if (lines.length < 2) return []
    const headers = parseCSVLine(lines[0]).map((h: any) => h.toLowerCase().trim())
    const rows: ParsedRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const row = buildRow(i + 1, headers, cols)
      if (row.body.trim()) rows.push(row)
    }
    return rows
  }

  await wb.xlsx.load(buffer)

  // Prefer a sheet named "Questions", fall back to the last sheet, then first
  const ws =
    wb.getWorksheet("Questions") ??
    wb.worksheets[wb.worksheets.length - 1] ??
    wb.worksheets[0]

  if (!ws) return []

  // Read headers from row 1 using row.values (1-indexed array, index 0 is undefined)
  const headerRow = ws.getRow(1)
  const headers: string[] = []
  // row.values is a sparse array starting at index 1
  const rawHeaders = headerRow.values as (string | undefined)[]
  for (let i = 1; i < rawHeaders.length; i++) {
    headers.push(String(rawHeaders[i] ?? "").toLowerCase().trim())
  }

  const rows: ParsedRow[] = []
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return
    const rawVals = row.values as (unknown)[]
    // Pad to at least headers.length + 1 slots
    const cols: string[] = []
    for (let i = 1; i <= Math.max(headers.length, rawVals.length - 1); i++) {
      const val = rawVals[i]
      cols.push(val != null ? String(val).trim() : "")
    }
    const parsed = buildRow(rowNum, headers, cols)
    if (parsed.body.trim()) rows.push(parsed)
  })

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function buildRow(rowNum: number, headers: string[], cols: string[]): ParsedRow {
  const get = (key: string) => {
    const idx = headers.indexOf(key)
    return idx >= 0 ? (cols[idx] ?? "").trim() : ""
  }

  const typeRaw = get("type").toUpperCase()
  const type: "OBJECTIVE" | "SUBJECTIVE" =
    typeRaw === "SUBJECTIVE" || typeRaw === "S" ? "SUBJECTIVE" : "OBJECTIVE"

  const body = get("body")
  const marksRaw = get("marks")
  const marks = parseInt(marksRaw, 10) || 0

  const row: ParsedRow = { rowNum, type, body, marks, rubricCriteria: [] }

  if (type === "OBJECTIVE") {
    row.optionA = get("option_a")
    row.optionB = get("option_b")
    row.optionC = get("option_c")
    row.optionD = get("option_d")
    const correctRaw = get("correct_option").toUpperCase()
    const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, "0": 0, "1": 1, "2": 2, "3": 3 }
    row.correctOption = map[correctRaw] ?? undefined
  } else {
    const at = get("answer_type").toUpperCase()
    row.answerType =
      at === "PDF_UPLOAD" ? "PDF_UPLOAD" : at === "CODE" ? "CODE" : "FILL_IN"
    row.rubricCriteria = parseRubricCriteria(headers, get)
  }

  // Validate
  if (!body) row.error = "Missing question body"
  else if (marks < 1) row.error = "Marks must be ≥ 1"
  else if (type === "OBJECTIVE") {
    const opts = [row.optionA, row.optionB, row.optionC, row.optionD].filter(Boolean)
    if (opts.length < 2) row.error = "Need at least 2 options (option_a, option_b)"
    else if (row.correctOption === undefined) row.error = "correct_option must be A, B, C, or D"
  } else if (row.rubricCriteria.some((criterion) => criterion.maxMarks < 1)) {
    row.error = "Rubric marks must be >= 1"
  }

  return row
}

function parseRubricCriteria(
  headers: string[],
  get: (key: string) => string
): Array<{ description: string; maxMarks: number; order: number }> {
  const criteria: Array<{ description: string; maxMarks: number; order: number }> = []

  const compact = get("rubric")
  if (compact) {
    for (const part of compact.split(/[;\n]/)) {
      const text = part.trim()
      if (!text) continue
      const match = text.match(/^(.+?)(?::|\(|-)\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)?\)?$/i)
      if (!match) continue
      criteria.push({
        description: match[1].trim(),
        maxMarks: Math.round(Number(match[2])),
        order: criteria.length + 1,
      })
    }
  }

  const rubricIndexes = new Set<number>()
  for (const header of headers) {
    const match = header.match(/^rubric_(\d+)_(description|marks|max_marks)$/)
    if (match) rubricIndexes.add(Number(match[1]))
  }

  for (const index of Array.from(rubricIndexes).sort((a, b) => a - b)) {
    const description = get(`rubric_${index}_description`)
    const marksRaw = get(`rubric_${index}_marks`) || get(`rubric_${index}_max_marks`)
    const maxMarks = Math.round(Number(marksRaw))
    if (!description && !marksRaw) continue
    criteria.push({
      description,
      maxMarks: Number.isFinite(maxMarks) ? maxMarks : 0,
      order: criteria.length + 1,
    })
  }

  return criteria.filter((criterion) => criterion.description.trim())
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExcelImportModal({
  open,
  bankId,
  bankTitle,
  onClose,
  onImported,
}: ExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState("")
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)

  const validRows = rows.filter((r: any) => !r.error)
  const errorRows = rows.filter((r: any) => r.error)

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an .xlsx, .xls, or .csv file")
      return
    }
    setFileName(file.name)
    setParsing(true)
    setRows([])
    try {
      const parsed = await parseExcelFile(file)
      setRows(parsed)
    } catch (e) {
      toast.error("Failed to parse file")
      console.error(e)
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    if (validRows.length === 0) return
    setImporting(true)
    try {
      const items = validRows.map((r: any) => ({
        type: r.type,
        body: r.body,
        marks: r.marks,
        ...(r.type === "OBJECTIVE"
          ? {
              options: [r.optionA, r.optionB, r.optionC, r.optionD].filter(Boolean),
              correctOption: r.correctOption,
            }
          : {
              answerType: r.answerType,
              rubricCriteria: r.rubricCriteria,
            }),
      }))

      const res = await fetch(`/api/lecturer/question-banks/${bankId}/items/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Import failed")
      }
      const data = await res.json()
      toast.success(`Imported ${data.count} question${data.count !== 1 ? "s" : ""}`)
      onImported()
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setRows([])
    setFileName("")
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="sm:max-w-lg w-full flex flex-col gap-0 p-0" showCloseButton={false}>
        <SheetHeader className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <SheetTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Import from Excel / CSV
              </SheetTitle>
              <SheetDescription>
                Upload questions into <span className="font-medium text-slate-700">{bankTitle}</span>
              </SheetDescription>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-800">Need a template?</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Styled Excel file with dropdowns and validation built in.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { downloadTemplate().catch(() => toast.error("Failed to generate template")) }}
              className="rounded-xl border-blue-200 text-blue-700 hover:bg-blue-100 gap-1.5 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download .xlsx
            </Button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors",
              dragging
                ? "border-[#002388] bg-blue-50"
                : "border-slate-200 bg-slate-50 hover:border-[#002388]/40 hover:bg-blue-50/30"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ""
              }}
            />
            {parsing ? (
              <Loader2 className="h-8 w-8 text-[#002388] animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-slate-300" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                {parsing ? "Parsing file…" : fileName ? fileName : "Drop your file here or click to browse"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Supports .xlsx, .xls, .csv</p>
            </div>
          </div>

          {/* Preview */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {validRows.length} valid
                </span>
                {errorRows.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errorRows.length} with errors (will be skipped)
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500 w-10">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Type</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Question</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Marks</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Rubric</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row: any) => (
                        <tr
                          key={row.rowNum}
                          className={cn(
                            "transition-colors",
                            row.error ? "bg-red-50/50" : "bg-white hover:bg-slate-50"
                          )}
                        >
                          <td className="px-3 py-2 text-slate-400">{row.rowNum}</td>
                          <td className="px-3 py-2">
                            <span className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                              row.type === "OBJECTIVE"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            )}>
                              {row.type === "OBJECTIVE" ? "Obj" : "Subj"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{row.body || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{row.marks || "—"}</td>
                          <td className="px-3 py-2 text-slate-500">
                            {row.rubricCriteria.length > 0 ? `${row.rubricCriteria.length} criteria` : "-"}
                          </td>
                          <td className="px-3 py-2">
                            {row.error ? (
                              <span className="inline-flex items-center gap-1 text-red-600">
                                <AlertCircle className="h-3 w-3" />
                                {row.error}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t border-slate-100 flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            className="rounded-xl bg-[#002388] hover:bg-[#002388]/90 gap-1.5"
          >
            {importing ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Importing…</>
            ) : (
              <><Upload className="h-4 w-4" />Import {validRows.length > 0 ? `${validRows.length} Questions` : ""}</>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
