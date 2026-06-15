import { getSession } from "@/lib/session"
import { User, ShieldCheck } from "lucide-react"
import LecturerPasswordForm from "./PasswordForm"

export default async function LecturerProfilePage() {
  const session = await getSession()
  const user = session?.user

  const info = [
    { label: "Staff ID",      value: user?.email?.split("@")[0] ?? "—" },
    { label: "Full Name",     value: user?.name ?? "—" },
    { label: "Role",          value: "Lecturer" },
    { label: "Email",         value: user?.email ?? "lecturer@gctu.edu.gh" },
  ]

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">

      {/* Page header */}
      <div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
          <User size={11} />
          <span>Lecturer</span>
          <span>›</span>
          <span>Profile</span>
        </div>
        <h1 className="text-xl font-semibold text-[#1e293b]">My Profile</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Manage your account information and security settings.
        </p>
      </div>

      {/* Personal info card */}
      <div className="bg-white border border-border rounded-sm">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-[#1e293b]">Personal Information</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Your details as registered with GCTU.
            </p>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded-sm bg-slate-100 border border-border text-slate-500">
            Read only
          </span>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
          {info.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center justify-between py-3 ${
                i < info.length - (info.length % 2 === 0 ? 2 : 1)
                  ? "border-b border-[#f1f5f9]"
                  : ""
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <span className="text-[12px] font-semibold text-[#1e293b]">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security section */}
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-[#1e293b] pt-2">
        <ShieldCheck className="text-primary" size={14} strokeWidth={2} />
        Security Settings
      </h2>

      <LecturerPasswordForm />

    </div>
  )
}
