import { History, Settings2 } from "lucide-react";
import Link from "next/link";
import { getSystemSettingsAction } from "@/app/actions/admin-settings-server";
import AdminPageShell from "@/components/layout/AdminPageShell";
import { getAuditLogs } from "@/lib/audit";
import SystemLogsTable, { type AuditLogRow } from "./SystemLogsTable";
import SystemSettingsForm from "./SystemSettingsForm";

export default async function AdminSettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) {
	const { tab } = await searchParams;
	const activeTab = tab || "system";
	const logs: AuditLogRow[] = await getAuditLogs({ limit: 100 });
	const systemSettings = await getSystemSettingsAction();

	return (
		<AdminPageShell
			title="Settings"
			description="Manage system-wide configuration, grading scale, and audit trails."
			icon={Settings2}
			actions={
				<div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
					<Link
						href="/admin/settings?tab=system"
						className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
							activeTab === "system"
								? "bg-white text-[#1967d2]"
								: "text-slate-600 hover:text-slate-900"
						}`}
					>
						<Settings2 size={14} />
						System
					</Link>
					<Link
						href="/admin/settings?tab=logs"
						className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
							activeTab === "logs"
								? "bg-white text-[#1967d2]"
								: "text-slate-600 hover:text-slate-900"
						}`}
					>
						<History size={14} />
						Logs
					</Link>
				</div>
			}
		>
			{activeTab === "system" ? (
				<div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-4 md:p-6">
					<SystemSettingsForm initialSettings={systemSettings} />
				</div>
			) : (
				<SystemLogsTable initialLogs={logs} />
			)}
		</AdminPageShell>
	);
}
