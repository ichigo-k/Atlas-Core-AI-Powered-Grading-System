"use client";

import { useEffect, useRef, useState } from "react";
import { saveAnswer } from "@/lib/assessment-actions";
import { Highlight, themes } from "prism-react-renderer";
import { FileText, Check, ChevronDown, Upload } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionWithAnswer = {
  id: number;
  order: number;
  body: string;
  marks: number;
  answerType: string | null;
  options: unknown;
  sectionType: string;
  existingAnswer: {
    answerText: string | null;
    selectedOption: number | null;
    fileUrl: string | null;
  } | null;
};

interface QuestionRendererProps {
  question: QuestionWithAnswer;
  attemptId: number;
  displayNumber: number;
  shuffledOptions?: number[];
  locked?: boolean;
  assessmentType?: string;
  onAnswerChange?: (
    questionId: number,
    payload: { answerText: string | null; selectedOption: number | null; fileUrl: string | null },
  ) => void;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const FONT_SANS = "var(--font-sans, 'Poppins', system-ui, sans-serif)";
const FONT_MONO = "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace";

const FONT_SIZE   = 13.5;
const LINE_HEIGHT = 22;
const GUTTER_W    = 44;
const PAD_V       = 16;

// ─── Supported languages ──────────────────────────────────────────────────────

type SupportedLang = "python" | "javascript" | "typescript" | "java" | "c" | "cpp" | "sql" | "go" | "rust" | "html" | "css"

const LANGUAGES: { value: SupportedLang; label: string }[] = [
  { value: "python",     label: "Python"     },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java",       label: "Java"       },
  { value: "c",          label: "C"          },
  { value: "cpp",        label: "C++"        },
  { value: "sql",        label: "SQL"        },
  { value: "go",         label: "Go"         },
  { value: "rust",       label: "Rust"       },
  { value: "html",       label: "HTML"       },
  { value: "css",        label: "CSS"        },
]

// ─── Editor colours — GitHub light ───────────────────────────────────────────

const EDITOR_BG        = "#f6f8fa";
const EDITOR_GUTTER_BG = "#eef0f3";
const EDITOR_GUTTER_FG = "#8c959f";
const EDITOR_BORDER    = "#d0d7de";
const EDITOR_CARET     = "#24292f";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOptions(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* ignore */ }
  return [];
}

function wordCount(text: string) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ─── PDF Drop Zone ────────────────────────────────────────────────────────────
// Drag-and-drop first: no OS file picker, no fullscreen exit, no proctoring flag.
// A small "or browse" link is kept as fallback — it exits/re-enters fullscreen
// the same way the old component did.

function PdfDropZone({
  onFile,
  error,
  locked,
}: {
  onFile: (file: File) => void
  error: string | null
  locked: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function processFile(file: File) {
    setFileName(file.name)
    onFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!locked) setIsDragging(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (locked) return
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // Fallback: open OS picker. Exits fullscreen first so the dialog can appear,
  // then re-enters after — same pattern as before, kept as last resort.
  function handleBrowse() {
    if (locked) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {}).finally(() => inputRef.current?.click())
    } else {
      inputRef.current?.click()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
    if (!file) return
    processFile(file)
    e.target.value = ""
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={inputRef} type="file" accept=".pdf" className="sr-only" onChange={handleChange} tabIndex={-1} />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all duration-150 select-none",
          locked
            ? "opacity-50 cursor-not-allowed border-[#e5e7eb] bg-[#fafafa]"
            : isDragging
            ? "border-[#002388] bg-[#eef2ff] scale-[1.01]"
            : fileName
            ? "border-[#16a34a] bg-[#f0fdf4]"
            : "border-[#d1d5db] bg-[#fafafa] hover:border-[#002388] hover:bg-[#f8faff] cursor-default",
        ].join(" ")}
      >
        {/* Icon */}
        <div className={[
          "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
          isDragging ? "bg-[#dbeafe]" : fileName ? "bg-[#dcfce7]" : "bg-[#f3f4f6]",
        ].join(" ")}>
          {fileName
            ? <Check size={24} className="text-[#16a34a]" strokeWidth={2.5} />
            : isDragging
            ? <Upload size={24} className="text-[#002388]" strokeWidth={2} />
            : <FileText size={24} className="text-[#6b7280]" strokeWidth={1.5} />
          }
        </div>

        {fileName ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-[14px] font-semibold text-[#15803d]" style={{ fontFamily: FONT_SANS }}>
              File attached
            </p>
            <p className="text-[12px] text-[#6b7280] break-all max-w-xs" style={{ fontFamily: FONT_SANS }}>
              {fileName}
            </p>
            {!locked && (
              <button
                type="button"
                onClick={handleBrowse}
                className="mt-1 text-[12px] text-[#002388] hover:underline font-medium"
                style={{ fontFamily: FONT_SANS }}
              >
                Replace file
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <p className="text-[15px] font-semibold text-[#374151]" style={{ fontFamily: FONT_SANS }}>
              {isDragging ? "Drop your PDF here" : "Drag your PDF here"}
            </p>
            <p className="text-[12px] text-[#9ca3af]" style={{ fontFamily: FONT_SANS }}>
              PDF files only · max 10 MB
            </p>
            {!locked && (
              <button
                type="button"
                onClick={handleBrowse}
                className="mt-2 text-[12px] text-[#002388] hover:underline font-medium"
                style={{ fontFamily: FONT_SANS }}
              >
                or browse to upload
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#dc2626]" style={{ fontFamily: FONT_SANS }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ─── Code Editor ──────────────────────────────────────────────────────────────

function CodeInput({
  value,
  onChange,
  language,
  onLanguageChange,
}: {
  value: string
  onChange: (v: string) => void
  language: SupportedLang
  onLanguageChange: (l: SupportedLang) => void
}) {
  const MIN_LINES = 14;
  const lineCount = Math.max(MIN_LINES, value.split("\n").length + 1);

  const displayCode = value ? (value.endsWith("\n") ? value + " " : value) : " ";

  const sharedStyle: React.CSSProperties = {
    fontFamily: FONT_MONO,
    fontSize: `${FONT_SIZE}px`,
    lineHeight: `${LINE_HEIGHT}px`,
    padding: `${PAD_V}px ${PAD_V}px ${PAD_V}px ${GUTTER_W}px`,
    margin: 0,
    whiteSpace: "pre",
    wordBreak: "normal",
    overflowWrap: "normal",
    tabSize: 2,
  };

  const lineNumberStyle: React.CSSProperties = {
    display: "inline-block",
    width: `${GUTTER_W - PAD_V - 8}px`,
    marginLeft: `-${GUTTER_W - PAD_V}px`,
    marginRight: "8px",
    textAlign: "right",
    color: EDITOR_GUTTER_FG,
    userSelect: "none",
    fontVariantNumeric: "tabular-nums",
  };

  const lineLen = value.split("\n").length;
  const charLen = value.length;

  return (
    <div className="flex flex-col gap-0">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-3 rounded-t-lg border border-b-0 px-3 py-1.5"
        style={{ background: EDITOR_GUTTER_BG, borderColor: EDITOR_BORDER }}
      >
        <div className="flex items-center gap-1.5">
          {/* Traffic-light dots */}
          {["#ff5f57","#febc2e","#28c840"].map((c: any) => (
            <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>

        {/* Language selector */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLang)}
            className="appearance-none rounded border border-[#d0d7de] bg-white pl-2.5 pr-6 py-0.5 text-[11px] font-semibold text-[#24292f] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#002388]"
            style={{ fontFamily: FONT_MONO }}
          >
            {LANGUAGES.map((l: any) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#57606a]" />
        </div>
      </div>

      {/* Editor */}
      <div
        className="relative rounded-b-lg"
        style={{
          background: EDITOR_BG,
          border: `1px solid ${EDITOR_BORDER}`,
          backgroundImage: `linear-gradient(to right, ${EDITOR_GUTTER_BG} ${GUTTER_W}px, ${EDITOR_BG} ${GUTTER_W}px)`,
        }}
      >
        {/* Highlight layer */}
        <Highlight theme={themes.github} code={displayCode} language={language}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 overflow-hidden rounded-b-lg"
              style={{ ...sharedStyle, background: "transparent", margin: 0 }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} style={{ display: "block" }}>
                  <span style={lineNumberStyle}>{i + 1}</span>
                  {line.map((token, j) => <span key={j} {...getTokenProps({ token })} />)}
                </div>
              ))}
            </pre>
          )}
        </Highlight>

        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Write your code here…"
          rows={lineCount}
          className="relative w-full resize-none outline-none block rounded-b-lg"
          style={{
            ...sharedStyle,
            background: "transparent",
            color: "transparent",
            caretColor: EDITOR_CARET,
            overflow: "hidden",
            WebkitTextFillColor: "transparent",
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const s = el.selectionStart;
              const end = el.selectionEnd;
              const indent = "  ";
              const next = value.substring(0, s) + indent + value.substring(end);
              onChange(next);
              requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + indent.length; });
            }
          }}
        />
      </div>

      {/* Footer stats */}
      <div
        className="flex items-center justify-end gap-4 rounded-b border-x border-b px-3 py-1"
        style={{ background: EDITOR_GUTTER_BG, borderColor: EDITOR_BORDER, borderTopColor: "transparent" }}
      >
        <span className="text-[10px] tabular-nums" style={{ color: EDITOR_GUTTER_FG, fontFamily: FONT_MONO }}>
          {lineLen} {lineLen === 1 ? "line" : "lines"} · {charLen} chars
        </span>
      </div>
    </div>
  );
}

// ─── Written Answer (FILL_IN) ─────────────────────────────────────────────────

function WrittenInput({
  value,
  onChange,
  locked,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  locked: boolean
}) {
  const RULE_HEIGHT = 32;
  const words = wordCount(value);
  const chars = value.length;
  const lines = Math.max(12, value.split("\n").length);

  return (
    <div className="flex flex-col gap-0">
      {/* Label strip */}
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-[#e5e7eb] bg-[#f9fafb] px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]" style={{ fontFamily: FONT_SANS }}>
          Written Answer
        </span>
        <span className="text-[10px] text-[#9ca3af] tabular-nums" style={{ fontFamily: FONT_SANS }}>
          {words} {words === 1 ? "word" : "words"} · {chars} chars
        </span>
      </div>

      {/* Ruled textarea */}
      <div className="relative rounded-b-lg border border-[#e5e7eb] bg-white overflow-hidden">
        <textarea
          value={value}
          onChange={onChange}
          disabled={locked}
          rows={lines}
          placeholder="Write your answer here…"
          className="w-full resize-none bg-transparent outline-none text-[#1f2937] placeholder-[#d1d5db] overflow-hidden px-5 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            fontFamily: FONT_SANS,
            fontSize: "15px",
            lineHeight: `${RULE_HEIGHT}px`,
            backgroundImage: `repeating-linear-gradient(
              to bottom,
              transparent,
              transparent ${RULE_HEIGHT - 1}px,
              #ebebeb ${RULE_HEIGHT - 1}px,
              #ebebeb ${RULE_HEIGHT}px
            )`,
            backgroundSize: `100% ${RULE_HEIGHT}px`,
            paddingTop: "6px",
            height: `${lines * RULE_HEIGHT}px`,
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "0px";
            const newLines = Math.max(12, Math.ceil(el.scrollHeight / RULE_HEIGHT));
            el.style.height = `${newLines * RULE_HEIGHT}px`;
          }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuestionRenderer({
  question,
  attemptId,
  displayNumber,
  shuffledOptions,
  locked = false,
  assessmentType,
  onAnswerChange,
}: QuestionRendererProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [fillText, setFillText] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeLang, setCodeLang] = useState<SupportedLang>("python");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ex = question.existingAnswer;
    setSelectedOption(ex?.selectedOption ?? null);
    setFillText(ex?.answerText ?? "");
    setCodeText(ex?.answerText ?? "");
    setPdfError(null);
  }, [question.id]);

  function scheduleDebounce(payload: { answerText: string | null; selectedOption: number | null; fileUrl: string | null }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveAnswer(attemptId, question.id, payload), 2500);
  }

  function handleOptionChange(idx: number) {
    if (locked) return;
    const payload = { answerText: null, selectedOption: idx, fileUrl: null };
    setSelectedOption(idx);
    onAnswerChange?.(question.id, payload);
    scheduleDebounce(payload);
  }

  function handleFillChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (locked) return;
    const payload = { answerText: e.target.value, selectedOption: null, fileUrl: null };
    setFillText(e.target.value);
    onAnswerChange?.(question.id, payload);
    scheduleDebounce(payload);
  }

  function handleCodeChange(v: string) {
    if (locked) return;
    const payload = { answerText: v, selectedOption: null, fileUrl: null };
    setCodeText(v);
    onAnswerChange?.(question.id, payload);
    scheduleDebounce(payload);
  }

  const rawOptions = parseOptions(question.options);
  const displayOptions = shuffledOptions ? shuffledOptions.map((i: any) => rawOptions[i] ?? "") : rawOptions;

  function renderInput() {
    if (locked) {
      return (
        <div className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] px-5 py-6 text-center">
          <p className="text-[13px] text-[#9ca3af]" style={{ fontFamily: FONT_SANS }}>
            You have already answered the required number of questions in this section.
          </p>
        </div>
      );
    }

    // ── Objective (MCQ) ──────────────────────────────────────────────────────
    if (question.sectionType === "OBJECTIVE") {
      return (
        <fieldset className="flex flex-col gap-0.5">
          <legend className="sr-only">Select an answer</legend>
          {displayOptions.map((opt, displayIdx) => {
            const originalIdx = shuffledOptions ? shuffledOptions[displayIdx] : displayIdx;
            const checked = selectedOption === originalIdx;
            const letter = String.fromCharCode(65 + displayIdx);
            return (
              <label
                key={originalIdx}
                className={[
                  "group flex items-start gap-4 rounded-xl border px-4 py-3.5 cursor-pointer transition-all duration-100",
                  checked
                    ? "border-[#002388] bg-[#eef2ff]"
                    : "border-[#f0f0f0] hover:border-[#c7d2fe] hover:bg-[#fafbff]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={originalIdx}
                  checked={checked}
                  onChange={() => handleOptionChange(originalIdx)}
                  className="sr-only"
                />
                <div
                  className={[
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-semibold transition-all",
                    checked
                      ? "border-[#002388] bg-[#002388] text-white"
                      : "border-[#e5e7eb] text-[#9ca3af] group-hover:border-[#6366f1] group-hover:text-[#6366f1]",
                  ].join(" ")}
                  style={{ fontFamily: FONT_SANS }}
                >
                  {checked ? <Check size={13} strokeWidth={3} /> : letter}
                </div>
                <span
                  className={[
                    "text-[15px] leading-relaxed flex-1 pt-0.5 transition-colors",
                    checked ? "font-medium text-[#1e3a8a]" : "text-[#374151] group-hover:text-[#111827]",
                  ].join(" ")}
                  style={{ fontFamily: FONT_SANS }}
                >
                  {opt}
                </span>
              </label>
            );
          })}
          {displayOptions.length === 0 && (
            <p className="text-sm text-[#9ca3af] italic py-2" style={{ fontFamily: FONT_SANS }}>
              No options available.
            </p>
          )}
        </fieldset>
      );
    }

    // ── Code ─────────────────────────────────────────────────────────────────
    if (question.answerType === "CODE") {
      return (
        <CodeInput
          value={codeText}
          onChange={handleCodeChange}
          language={codeLang}
          onLanguageChange={setCodeLang}
        />
      );
    }

    // ── Written answer ────────────────────────────────────────────────────────
    if (question.answerType === "FILL_IN") {
      return (
        <WrittenInput
          value={fillText}
          onChange={handleFillChange}
          locked={locked}
        />
      );
    }

    // ── PDF upload — assignments only (file picker exits fullscreen on EXAM/QUIZ) ──
    if (question.answerType === "PDF_UPLOAD") {
      if (assessmentType !== "ASSIGNMENT") {
        return (
          <div className="flex items-start gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-5 py-4">
            <FileText size={16} className="shrink-0 text-[#d97706] mt-0.5" />
            <p className="text-[13px] text-[#92400e] leading-relaxed" style={{ fontFamily: FONT_SANS }}>
              File upload is only available for <strong>Assignment</strong> type assessments. This question cannot be answered here.
            </p>
          </div>
        );
      }
      return (
        <PdfDropZone
          onFile={(file) => {
            if (file.size > MAX_PDF_BYTES) {
              setPdfError("File exceeds the 10 MB limit.");
              return;
            }
            setPdfError(null);
            const payload = { answerText: null, selectedOption: null, fileUrl: file.name };
            onAnswerChange?.(question.id, payload);
            scheduleDebounce(payload);
          }}
          error={pdfError}
          locked={locked}
        />
      );
    }

    return (
      <p className="text-sm text-[#9ca3af] italic" style={{ fontFamily: FONT_SANS }}>
        Unsupported question type.
      </p>
    );
  }

  return (
    <article className="flex flex-col gap-6" style={{ fontFamily: FONT_SANS }}>
      {/* Question header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9ca3af] mb-2.5">
            Question {displayNumber}
          </p>
          <p className="text-[16px] font-normal text-[#111827] leading-[1.75]">
            {question.body}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-semibold text-[#6b7280] whitespace-nowrap mt-1 tabular-nums">
          {question.marks} {question.marks === 1 ? "mark" : "marks"}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-[#f0f0f0]" />

      {/* Answer area */}
      <div>{renderInput()}</div>
    </article>
  );
}
