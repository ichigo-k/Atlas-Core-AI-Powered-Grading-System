import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PasswordForm from "./PasswordForm";
import { ChevronRight, ShieldCheck, User, Mail, Hash, GraduationCap, BookOpen, Calendar, Layers } from "lucide-react";

function getInitials(name: string | null | undefined): string {
  if (!name) return "S";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p: any) => p[0]).join("").toUpperCase();
}

function avatarColor(name: string | null | undefined): string {
  const colors = [
    { bg: "#002388", text: "white" },
    { bg: "#107c10", text: "white" },
    { bg: "#8764b8", text: "white" },
    { bg: "#d83b01", text: "white" },
    { bg: "#038387", text: "white" },
  ];
  const seed = (name ?? "S").charCodeAt(0) % colors.length;
  return colors[seed].bg;
}

export default async function ProfilePage() {
  const session = await getSession();
  const user = session?.user;

  // Load student profile for index number / class / program
  const dbUser = user?.email
    ? await prisma.user.findUnique({
      where: { email: user.email },
      select: {
        studentProfile: {
          select: {
            indexNumber: true,
            class: { select: { name: true, level: true } },
            program: { select: { name: true, faculty: { select: { name: true } } } },
          },
        },
      },
    })
    : null;

  const profile = dbUser?.studentProfile;

  const settings = await prisma.systemSettings.findUnique({
    where: { id: 1 },
    select: { academicYear: true, semester: true },
  });

  const initials = getInitials(user?.name);
  const bgColor = avatarColor(user?.name);

  const details = [
    { Icon: User, label: "Full Name", value: user?.name ?? "-" },
    { Icon: Mail, label: "Email", value: user?.email ?? "-" },
    { Icon: Hash, label: "Student ID", value: profile?.indexNumber ?? user?.email?.split("@")[0] ?? "-" },
    { Icon: Layers, label: "Class", value: profile?.class ? `${profile.class.name} (Level ${profile.class.level})` : "-" },
    { Icon: GraduationCap, label: "Programme", value: profile?.program?.name ?? "-" },
    { Icon: BookOpen, label: "Faculty", value: profile?.program?.faculty?.name ?? "-" },
    { Icon: Calendar, label: "Academic Year", value: settings?.academicYear ?? "-" },
    { Icon: Calendar, label: "Semester", value: settings?.semester ?? "-" },
  ];

  return (
    <div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full">

      {/* -- Command bar -- */}
      <div className="bg-white dark:bg-[#192534] border-b border-[#edebe9] dark:border-white/10 px-5 py-3">
        <div className="flex items-center gap-1 text-[11px] text-[#8a8886]">
          <span>Student</span>
          <ChevronRight size={11} />
          <span className="text-[#002388] font-medium">My Profile</span>
        </div>
      </div>

      <div className="px-4 py-4 md:px-6 space-y-4 pb-12 max-w-[900px]">

        {/* -- Academic details -- */}
        <div className="bg-white border border-[#edebe9] rounded overflow-hidden">
          <div className="px-5 py-3 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
            <h2 className="text-[13px] font-semibold text-[#323130]">Academic Information</h2>
            <span className="text-[9px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded bg-[#f8f9fa] border border-[#edebe9] text-[#8a8886]">
              Read only
            </span>
          </div>

          <div className="divide-y divide-[#f8f9fa]">
            {details.map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 px-5 py-3 hover:bg-[#faf9f8] transition-colors">
                <Icon size={14} className="text-[#8a8886] flex-shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8886] w-28 flex-shrink-0">
                  {label}
                </span>
                <span className="text-[13px] font-medium text-[#323130]">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* -- Security -- */}
        <div className="bg-white border border-[#edebe9] rounded overflow-hidden">
          <div className="px-5 py-3 border-b border-[#edebe9] bg-[#faf9f8] flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#002388]" />
            <h2 className="text-[13px] font-semibold text-[#323130]">Security Settings</h2>
          </div>
          <div className="p-5">
            <PasswordForm />
          </div>
        </div>

      </div>
    </div>
  );
}
