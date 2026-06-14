"use client";

import { AlertCircle, CheckCircle2, Key, Save } from "lucide-react";
import { useState } from "react";
import { changePasswordAction } from "@/app/actions/change-password-server";
import AdminPageShell from "@/components/layout/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ChangePasswordPage() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccess(false);

		const formData = new FormData(e.currentTarget);
		const result = await changePasswordAction(formData);

		if (result.success) {
			setSuccess(true);
			(e.target as HTMLFormElement).reset();
		} else {
			setError(result.error || "Failed to change password");
		}

		setLoading(false);
	};

	return (
		<AdminPageShell
			title="Change password"
			description="Update your administrative credentials securely."
			icon={Key}
			eyebrow="Account settings"
		>
			<div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 md:p-6">
				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					{error && (
						<div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
							<AlertCircle size={16} />
							{error}
						</div>
					)}
					{success && (
						<div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
							<CheckCircle2 size={16} />
							Password successfully updated
						</div>
					)}

					<div className="flex flex-col gap-2">
						<Label
							htmlFor="currentPassword"
							className="text-slate-700 font-medium"
						>
							Current Password
						</Label>
						<Input
							id="currentPassword"
							type="password"
							name="currentPassword"
							required
							className="h-10 rounded-lg border-slate-200 focus-visible:ring-[#1967d2]"
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="newPassword" className="text-slate-700 font-medium">
							New Password
						</Label>
						<Input
							id="newPassword"
							type="password"
							name="newPassword"
							required
							minLength={8}
							placeholder="Minimum 8 characters"
							className="h-10 rounded-lg border-slate-200 focus-visible:ring-[#1967d2]"
						/>
					</div>

					<div className="flex flex-col gap-2">
						<Label
							htmlFor="confirmPassword"
							className="text-slate-700 font-medium"
						>
							Confirm New Password
						</Label>
						<Input
							id="confirmPassword"
							type="password"
							name="confirmPassword"
							required
							minLength={8}
							className="h-10 rounded-lg border-slate-200 focus-visible:ring-[#1967d2]"
						/>
					</div>

					<div className="pt-2">
						<Button
							type="submit"
							disabled={loading}
							className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#1967d2] px-6 font-medium text-white transition-colors hover:bg-[#1558b0]"
						>
							<Save size={16} />
							{loading ? "Updating..." : "Update Password"}
						</Button>
					</div>
				</form>
			</div>
		</AdminPageShell>
	);
}
