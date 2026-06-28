"use client";

import { useEffect, useRef, useState } from "react";
import { saveAnswer } from "@/lib/assessment-actions";
import { FileText, Check } from "lucide-react";
import PdfDropZone from "./PdfDropZone";
import CodeInput, { SupportedLang } from "./CodeInput";
import WrittenInput from "./WrittenInput";

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
  simulation?: boolean;
  assessmentType?: string;
  onAnswerChange?: (
    questionId: number,
    payload: { answerText: string | null; selectedOption: number | null; fileUrl: string | null },
  ) => void;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

const FONT_SANS = "var(--font-sans, 'Poppins', system-ui, sans-serif)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOptions(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* ignore */ }
  return [];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuestionRenderer({
  question,
  attemptId,
  displayNumber,
  shuffledOptions,
  locked = false,
  simulation = false,
  assessmentType,
  onAnswerChange,
}: QuestionRendererProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [fillText, setFillText] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeLang, setCodeLang] = useState<SupportedLang>("python");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ex = question.existingAnswer;
    setSelectedOption(ex?.selectedOption ?? null);
    setFillText(ex?.answerText ?? "");
    setCodeText(ex?.answerText ?? "");
    setPdfError(null);
  }, [question.id]);

  function scheduleDebounce(payload: { answerText: string | null; selectedOption: number | null; fileUrl: string | null }) {
    if (simulation) return;
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
  const displayOptions = shuffledOptions ? shuffledOptions.map((i: number) => rawOptions[i] ?? "") : rawOptions;

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
          onFile={async (file) => {
            if (file.size > MAX_PDF_BYTES) {
              setPdfError("File exceeds the 10 MB limit.");
              return;
            }
            setPdfError(null);
            setPdfUploading(true);

            try {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("attemptId", String(attemptId));
              formData.append("questionId", String(question.id));

              const res = await fetch("/api/student/upload", {
                method: "POST",
                body: formData,
              });

              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to upload file");
              }

              const { fileUrl } = await res.json();
              const payload = { answerText: null, selectedOption: null, fileUrl };
              onAnswerChange?.(question.id, payload);
              if (!simulation) await saveAnswer(attemptId, question.id, payload);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : "An error occurred during upload. Please try again.";
              setPdfError(message);
            } finally {
              setPdfUploading(false);
            }
          }}
          error={pdfError}
          locked={locked}
          existingFileUrl={question.existingAnswer?.fileUrl}
          uploading={pdfUploading}
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
