import { getSession } from "@/lib/session"
import PasswordForm from "./PasswordForm"
import { User, ShieldCheck } from "lucide-react"

export default async function ProfilePage() {
  const session = await getSession()
  const user = session?.user

  const academicInfo = [
    { label: "Student ID", value: user?.email?.split("@")[0] ?? "—" },
    { label: "Full Name", value: user?.name ?? "—" },
    { label: "Programme", value: "BSc. Computer Science" },
    { label: "Level", value: "300" },
    { label: "Class", value: "CS3A" },
    { label: "Academic Year", value: "2025 / 2026" },
    { label: "Semester", value: "First Semester" },
    { label: "Email", value: user?.email ?? "student@gctu.edu.gh" },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">

      {/* Page title */}
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
           <User className="text-discord-blurple" size={32} strokeWidth={2.5} />
           My Profile
        </h1>
        <p className="text-slate-500 font-medium">Manage your academic credentials and account security.</p>
      </header>

      {/* Academic info card */}
      <div className="discord-card">
        <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              Personal Information
            </h2>
            <p className="text-[11px] text-slate-500 font-bold">Your academic details as registered with GCTU.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-400 shadow-sm">
            Read only
          </span>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-0">
          {academicInfo.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center justify-between py-4 ${
                i < academicInfo.length - (academicInfo.length % 2 === 0 ? 2 : 1) ? "border-b border-slate-50" : ""
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
              <span className="text-sm font-bold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Password section header */}
      <div className="pt-4 border-t border-slate-100">
         <h2 className="flex items-center gap-2.5 text-lg font-black text-slate-900 uppercase tracking-tight">
            <ShieldCheck className="text-discord-blurple" size={20} strokeWidth={3} />
            Security Settings
         </h2>
      </div>

      <PasswordForm />

    </div>
  )
}
