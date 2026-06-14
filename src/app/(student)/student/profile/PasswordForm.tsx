"use client"

import { useState } from "react"
import { Lock, ShieldCheck, KeyRound } from "lucide-react"

export default function PasswordForm() {
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
    <div className="discord-card">

      {/* Header */}
      <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-0.5">
          <KeyRound className="text-slate-900" size={16} strokeWidth={2.5} />
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Access Credentials</h2>
        </div>
        <p className="text-[11px] text-slate-500 font-bold">Update your password to keep your account secure.</p>
      </div>

      {/* Body — two columns */}
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">

          {/* Left col */}
          <div className="space-y-6">
            {/* Warning box */}
            <div className="flex items-start gap-4 rounded-xl p-4 border border-slate-100 bg-slate-50/50">
              <ShieldCheck className="text-slate-400 flex-shrink-0" size={20} strokeWidth={2.5} />
              <p className="text-sm text-slate-500 font-medium">
                You must verify your current password to save <strong className="font-black text-slate-900">any</strong> changes.
              </p>
            </div>

            {/* Current password */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-400">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-discord-blurple" size={16} strokeWidth={2.5} />
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={form.current}
                  onChange={(e) => setForm((p) => ({ ...p, current: e.target.value }))}
                  required
                  className="w-full pl-12 pr-4 py-3 text-sm font-bold rounded-xl border border-slate-200 text-slate-900 outline-none transition-all focus:border-discord-blurple focus:ring-4 focus:ring-discord-blurple/5 placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-6">
            {/* New password */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-400">
                New Password
              </label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={form.next}
                onChange={(e) => setForm((p) => ({ ...p, next: e.target.value }))}
                className="w-full px-4 py-3 text-sm font-bold rounded-xl border border-slate-200 text-slate-900 outline-none transition-all focus:border-discord-blurple focus:ring-4 focus:ring-discord-blurple/5 placeholder:text-slate-400"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-slate-400">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="Repeat new password"
                value={form.confirm}
                onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))}
                className="w-full px-4 py-3 text-sm font-bold rounded-xl border border-slate-200 text-slate-900 outline-none transition-all focus:border-discord-blurple focus:ring-4 focus:ring-discord-blurple/5 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-slate-50 gap-4">
          <div className="flex-1">
            {status !== "idle" && (
              <p
                className={`text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all animate-in fade-in slide-in-from-left-2 ${
                  status === "success" ? "bg-[#E6F4EA] text-[#23A559]" :
                  status === "error" ? "bg-[#FEE7E9] text-[#F23F42]" :
                  "bg-slate-100 text-slate-500"
                }`}
              >
                {status === "loading" ? "Processing update..." : message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full sm:w-auto px-10 py-3 rounded-xl text-sm font-black text-white transition-all bg-discord-blurple hover:bg-[#4752c4] hover:shadow-xl hover:shadow-discord-blurple/20 disabled:opacity-60 active:scale-95"
          >
            {status === "loading" ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  )
}
