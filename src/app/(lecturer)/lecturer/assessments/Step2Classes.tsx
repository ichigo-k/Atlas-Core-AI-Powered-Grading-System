"use client"

import { useState } from "react"
import { Search, ShieldCheck, Wifi } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { Step2State, LecturerCourse, TrustedNetworkOption } from "@/lib/assessment-types"

interface Step2ClassesProps {
  state: Step2State
  onChange: (updates: Partial<Step2State>) => void
  selectedCourse: LecturerCourse | null
  errors: {
    classes?: string
    location?: string
  }
	trustedNetworks: TrustedNetworkOption[]
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-4">
      {label}
    </p>
  )
}

export default function Step2Classes({ state, onChange, selectedCourse, errors, trustedNetworks }: Step2ClassesProps) {
  const classes = selectedCourse?.classes ?? []
  const [searchTerm, setSearchTerm] = useState("")

  const toggleClass = (classId: number, className: string, level: number) => {
    const existing = state.selectedClasses.find((c: any) => c.classId === classId)
    if (existing) {
      onChange({ selectedClasses: state.selectedClasses.filter((c: any) => c.classId !== classId) })
    } else {
      onChange({
        selectedClasses: [
          ...state.selectedClasses,
          { classId, className: `${className} (Level ${level})` },
        ],
      })
    }
  }

  const filtered = classes.filter(
    (cls) =>
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.level.toString().includes(searchTerm)
  )

  return (
    <div className="space-y-5">
      {/* Assign Classes */}
      <div className="rounded-sm border border-border bg-white p-5">
        <SectionHeader label="Assign Classes" />

        {classes.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-[#f3f2f1] px-6 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              {selectedCourse
                ? `No classes are assigned to ${selectedCourse.code}.`
                : "Select a course in Step 1 first."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 rounded-sm border-border bg-white text-[13px] focus-visible:ring-primary/30"
              />
            </div>

            <div className="rounded-sm border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#f3f2f1] border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 w-12 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">
                      Select
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">
                      Class Name
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.05em]">
                      Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                        No classes found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((cls: any) => {
                      const isSelected = !!state.selectedClasses.find((c: any) => c.classId === cls.id)
                      return (
                        <tr
                          key={cls.id}
                          className={`transition-colors cursor-pointer hover:bg-slate-50/60 ${isSelected ? "bg-[#dce6f7]" : ""}`}
                          onClick={() => toggleClass(cls.id, cls.name, cls.level)}
                        >
                          <td className="px-4 py-3 text-center">
                            <div
                              className={`flex h-4 w-4 mx-auto items-center justify-center rounded-sm border transition-all ${
                                isSelected
                                  ? "bg-primary border-primary text-white"
                                  : "border-border bg-white"
                              }`}
                            >
                              {isSelected && (
                                <svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
                                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-[#1e293b]">{cls.name}</td>
                          <td className="px-4 py-3 text-[13px] text-muted-foreground">Level {cls.level}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {state.selectedClasses.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {state.selectedClasses.length} class{state.selectedClasses.length !== 1 ? "es" : ""} selected
              </p>
            )}
          </div>
        )}

        {errors.classes && <p className="text-[11px] text-rose-500 mt-2">{errors.classes}</p>}
      </div>

      <div className="rounded-sm border border-border bg-white p-5"><SectionHeader label="Approved network"/><div className={`rounded-md border p-4 ${trustedNetworks.length === 0 ? "bg-slate-50" : "bg-white"}`}><div className="flex items-start gap-3"><div className="rounded-md bg-blue-50 p-2 text-primary"><Wifi size={17}/></div><div className="flex-1"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Require an approved campus network</p><p className="mt-0.5 text-xs text-muted-foreground">Students must connect through a network configured by an administrator.</p></div><button type="button" disabled={trustedNetworks.length === 0} onClick={() => onChange({ requireTrustedNetwork: !state.requireTrustedNetwork, trustedNetworkId: !state.requireTrustedNetwork ? trustedNetworks[0]?.id ?? null : null })} className={`relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${state.requireTrustedNetwork ? "bg-primary" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${state.requireTrustedNetwork ? "left-6" : "left-1"}`}/></button></div>{trustedNetworks.length === 0 ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">Unavailable until an administrator configures an active trusted network.</p> : state.requireTrustedNetwork && <label className="mt-3 block text-xs font-medium">Approved network<select value={state.trustedNetworkId ?? ""} onChange={(e) => onChange({ trustedNetworkId: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm">{trustedNetworks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}</select></label>} {state.requireTrustedNetwork && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700"><ShieldCheck size={13}/> Enforced by the server before an attempt starts.</p>}</div></div></div></div>
    </div>
  )
}
