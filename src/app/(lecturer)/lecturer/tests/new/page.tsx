"use client"

import { useState } from "react"

const courses = [
  { id: "1", code: "CS101", name: "Introduction to Computing" },
  { id: "2", code: "CSC 402", name: "Advanced Neural Architectures" },
  { id: "3", code: "CS301", name: "Data Structures" },
]

const batches = [
  { id: "b1", name: "Level 100 A", courseId: "1" },
  { id: "b2", name: "Level 100 B", courseId: "1" },
  { id: "b3", name: "Final Year Alpha", courseId: "2" },
  { id: "b4", name: "Level 300", courseId: "3" },
]

export default function CreateTestPage() {
  const [step, setStep] = useState(1)
  const [selectedCourse, setSelectedCourse] = useState("")
  const [selectedBatches, setSelectedBatches] = useState<string[]>([])

  const filteredBatches = batches.filter(b => b.courseId === selectedCourse)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Stepper Header */}
      <div className="mb-12">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10" />
          {[1, 2, 3].map((s: any) => (
            <div key={s} className="flex flex-col items-center gap-2 bg-[#F4F6FB] px-4">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  step >= s ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-400 border border-slate-200"
                }`}
              >
                {s}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${step >= s ? "text-slate-900" : "text-slate-400"}`}>
                {s === 1 ? "Basics" : s === 2 ? "Target Classes" : "Grading Rubric"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Assessment Basics</h2>
              <p className="text-slate-500 mt-1 text-sm">Define the core identity of your new grading assessment.</p>
            </div>

            <div className="grid gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Assessment Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Midterm Theory Exam"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Select Course</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {courses.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCourse(c.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        selectedCourse === c.id 
                        ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600" 
                        : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <p className="text-xs font-bold text-indigo-600 mb-1">{c.code}</p>
                      <p className="text-sm font-bold text-slate-900 leading-tight">{c.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Start Time</label>
                  <input type="datetime-local" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Duration (Mins)</label>
                  <input type="number" placeholder="60" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Target Classes */}
        {step === 2 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Target Classes</h2>
              <p className="text-slate-500 mt-1 text-sm">Select which batches are allowed to take this test.</p>
            </div>

            {!selectedCourse ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-medium">Please go back and select a course first.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredBatches.map((b: any) => (
                  <label 
                    key={b.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                      selectedBatches.includes(b.id)
                      ? "border-indigo-600 bg-indigo-50/50"
                      : "border-slate-100 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        selectedBatches.includes(b.id) ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"
                      }`}>
                        {selectedBatches.includes(b.id) && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{b.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Assigned to this course</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={selectedBatches.includes(b.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBatches([...selectedBatches, b.id])
                        else setSelectedBatches(selectedBatches.filter(id => id !== b.id))
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Rubric Placeholder */}
        {step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Grading Rubric (AI Settings)</h2>
              <p className="text-slate-500 mt-1 text-sm">Upload your marking scheme or define question-by-question rules for the AI.</p>
            </div>

            <div className="bg-slate-900 rounded-2xl p-8 text-center border-2 border-dashed border-slate-700">
              <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Drop Marking Scheme</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto mb-6">
                Upload a PDF or Word document. Our AI will analyze it to understand how to award marks.
              </p>
              <button className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors">
                Select File
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4 text-slate-400">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Or define manually</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <button className="w-full py-3 rounded-xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors">
                + Add Grading Question
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button 
            disabled={step === 1}
            onClick={() => setStep(s => s - 1)}
            className="px-6 py-2 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-900 disabled:opacity-0 transition-all"
          >
            Back
          </button>
          <button 
            onClick={() => step < 3 ? setStep(s => s + 1) : alert("Test Created (UI Only)")}
            className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-indigo-500/20 transition-all"
          >
            {step === 3 ? "Create Assessment" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}
