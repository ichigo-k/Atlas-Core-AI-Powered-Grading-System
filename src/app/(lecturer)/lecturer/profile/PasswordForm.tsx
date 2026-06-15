"use client"

import { useState } from "react"
import { Lock, ShieldCheck, KeyRound } from "lucide-react"

export default function LecturerPasswordForm() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.next !== form.confirm) {
      setStatus("error")
      setMessage("New passwords do not match.")
      return
    }
    if (form.next.length < 8) {
      setStatus("error")
      setMessage("New password must be at least 8 characters.")
      return
    }
    setStatus("loading")
    await new Promise((r) => setTimeout(r, 800))
    setStatus("success")
    setMessage("Password updated successfully.")
    setForm({ current: "", next: "", confirm: "" })
  }

  return (
    <div className="bg-white border border-border rounded-sm">
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-1.5 mb-0.5">
          <KeyRound className="text-primary" size={13} strokeWidth={2} />
          <h2 className="text-[13px] font-semibold text-[#1e293b]">Access Credentials</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">Update your password to keep your account secure.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Left col */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-sm border border-border bg-slate-50/50 p-4">
              <ShieldCheck className="text-slate-400 flex-shrink-0 mt-0.5" size={16} strokeWidth={2} />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                You must verify your current password to save <strong className="font-semibold text-[#1e293b]">any</strong> changes.
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary" size={13} strokeWidth={2} />
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={form.current}
                  onChange={(e) => setForm((p) => ({ ...p, current: e.target.value }))}
                  required
                  className="w-full pl-9 pr-3 py-2 text-[12px] font-semibold rounded-sm border border-border text-[#1e293b] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">
                New Password
              </label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={form.next}
                onChange={(e) => setForm((p) => ({ ...p, next: e.target.value }))}
                className="w-full px-3 py-2 text-[12px] font-semibold rounded-sm border border-border text-[#1e293b] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-muted-foreground">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Repeat new password"
                value={form.confirm}
                onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
                className="w-full px-3 py-2 text-[12px] font-semibold rounded-sm border border-border text-[#1e293b] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-5 border-t border-[#f1f5f9] gap-4">
          <div className="flex-1">
            {status !== "idle" && (
              <p className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-all animate-in fade-in slide-in-from-left-2 ${
                status === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                status === "error"   ? "bg-red-50 text-red-700 border border-red-100" :
                "bg-slate-100 text-slate-500 border border-slate-200"
              }`}>
                {status === "loading" ? "Processing update..." : message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full sm:w-auto px-6 py-2 rounded-sm text-[12px] font-semibold text-white transition-all bg-primary hover:bg-[#001570] disabled:opacity-60 active:scale-95"
          >
            {status === "loading" ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
