"use client";

import { CheckCircle } from "lucide-react";

type SectionWithProgress = {
  id: number;
  name: string;
  type: string;
  requiredQuestionsCount: number | null;
  questions: { id: number }[];
  answeredCount: number;
};

interface SectionSelectorProps {
  sections: SectionWithProgress[];
  activeSectionId: number;
  onSelect: (sectionId: number) => void;
}

function isComplete(section: SectionWithProgress): boolean {
  const required = section.requiredQuestionsCount ?? section.questions.length;
  return section.answeredCount >= required;
}

export default function SectionSelector({ sections, activeSectionId, onSelect }: SectionSelectorProps) {
  return (
    <nav aria-label="Assessment sections" className="flex flex-col gap-0.5 w-56 shrink-0">
      {sections.map((section: any) => {
        const active = section.id === activeSectionId;
        const complete = isComplete(section);
        const required = section.requiredQuestionsCount ?? section.questions.length;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={active ? "true" : undefined}
            className={[
              "flex flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors",
              active ? "bg-[#eff6ff] text-[#1d4ed8]" : "text-[#4b5563] hover:bg-[#f9fafb]",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium leading-snug truncate">{section.name}</span>
              {complete && (
                <CheckCircle size={13} className={active ? "text-[#16a34a]" : "text-[#16a34a]"} aria-label="Section complete" />
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={[
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
                  section.type === "OBJECTIVE"
                    ? active ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-[#eff6ff] text-[#3b82f6]"
                    : active ? "bg-[#ede9fe] text-[#6d28d9]" : "bg-[#f5f3ff] text-[#7c3aed]",
                ].join(" ")}
              >
                {section.type}
              </span>
              <span className={["text-[11px]", active ? "text-[#3b82f6]" : "text-[#9ca3af]"].join(" ")}>
                {section.answeredCount} / {required}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
