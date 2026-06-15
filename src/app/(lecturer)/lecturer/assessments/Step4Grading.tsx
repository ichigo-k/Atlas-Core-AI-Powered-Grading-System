"use client"

import { Button } from "@/components/ui/button"
import type { Step4State, SectionFormState } from "@/lib/assessment-types"
import { ArrowLeft, FileText, Send } from "lucide-react"

interface Step4GradingProps {
  state: Step4State
  sections: SectionFormState[]
  onChange: (updates: Partial<Step4State>) => void
  errors: Partial<Record<keyof Step4State, string>>
  onSaveAsDraft: () => void
  onPublish: () => void
  onBack: () => void
  isSubmitting: boolean
}

export default function Step4Grading({
  state,
  sections,
  onChange,
  errors,
  onSaveAsDraft,
  onPublish,
  onBack,
  isSubmitting,
}: Step4GradingProps) {
  const totalMarks = sections.reduce((total, sec) => {
    const required = Number(sec.requiredQuestionsCount) || sec.questions.length
    const sortedMarks = sec.questions
      .map((q) => Number(q.marks) || 0)
      .sort((a, b) => b - a)
    return total + sortedMarks.slice(0, required).reduce((sum, m) => sum + m, 0)
  }, 0)

  const totalQuestions = sections.reduce((acc, sec) => acc + sec.questions.length, 0)

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="rounded-sm border border-border bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-4">
          Grading Summary
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-sm border border-border bg-[#f3f2f1] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1.5">Total Marks</p>
            <p className="text-[26px] font-semibold text-primary leading-none">{totalMarks}</p>
          </div>
          <div className="rounded-sm border border-border bg-[#f3f2f1] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1.5">Sections</p>
            <p className="text-[26px] font-semibold text-[#1e293b] leading-none">{sections.length}</p>
          </div>
          <div className="rounded-sm border border-border bg-[#f3f2f1] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1.5">Questions</p>
            <p className="text-[26px] font-semibold text-[#1e293b] leading-none">{totalQuestions}</p>
          </div>
          <div className="rounded-sm border border-border bg-[#f3f2f1] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-1.5">Grading</p>
            <p className="text-[13px] font-semibold text-[#1e293b] mt-1">Automated</p>
          </div>
        </div>

        {sections.length > 0 && (
          <div className="rounded-sm border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f3f2f1] border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Section</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Questions</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {sections.map((sec) => {
                  const required = Number(sec.requiredQuestionsCount) || sec.questions.length
                  const sortedMarks = sec.questions.map((q) => Number(q.marks) || 0).sort((a, b) => b - a)
                  const secMarks = sortedMarks.slice(0, required).reduce((acc, m) => acc + m, 0)
                  const pct = totalMarks > 0 ? Math.round((secMarks / totalMarks) * 100) : 0

                  return (
                    <tr key={sec.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-[#1e293b]">
                        {sec.name || <span className="text-muted-foreground italic">Untitled</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold border ${
                          sec.type === "OBJECTIVE"
                            ? "bg-[#dce6f7] text-primary border-primary/20"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}>
                          {sec.type === "OBJECTIVE" ? "Objective" : "Subjective"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {sec.requiredQuestionsCount
                          ? `${sec.requiredQuestionsCount} of ${sec.questions.length}`
                          : `All ${sec.questions.length}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[13px] font-semibold text-[#1e293b]">{secMarks}</span>
                        <span className="text-[11px] text-muted-foreground ml-1">({pct}%)</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-border bg-[#f3f2f1]">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-[12px] font-semibold text-[#1e293b]">Total</td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-semibold text-primary">{totalMarks} pts</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isSubmitting}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-[#1e293b]"
        >
          <ArrowLeft size={15} />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSaveAsDraft}
          disabled={isSubmitting}
          className="h-8 px-4 rounded-sm border-border text-[13px] text-muted-foreground hover:bg-[#f3f2f1]"
        >
          <FileText size={13} className="mr-1.5" />
          {isSubmitting ? "Saving..." : "Save as Draft"}
        </Button>
        <Button
          type="button"
          onClick={onPublish}
          disabled={isSubmitting}
          className="h-8 px-4 rounded-sm bg-primary hover:bg-[#001570] text-white text-[13px] font-semibold ml-auto"
        >
          <Send size={13} className="mr-1.5" />
          {isSubmitting ? "Publishing..." : "Publish Assessment"}
        </Button>
      </div>
    </div>
  )
}
