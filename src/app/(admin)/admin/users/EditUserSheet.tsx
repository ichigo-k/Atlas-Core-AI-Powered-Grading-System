"use client";

import {
	ArrowRightLeft,
	BadgeInfo,
	Building2,
	GraduationCap,
	Loader2,
	Mail,
	Save,
	User,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	reassignClassAction,
	updateUserAction,
} from "@/app/actions/admin-users-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { UserWithProfile } from "@/lib/admin-users";

interface EditUserSheetProps {
	user: UserWithProfile | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	classes: any[];
	programs: Array<{ id: number; name: string; code?: string | null }>;
}

export default function EditUserSheet({
	user,
	open,
	onOpenChange,
	classes,
	programs,
}: EditUserSheetProps) {
	const [loading, setLoading] = useState(false);
	const submittingRef = useRef(false);

	if (!user) return null;

	async function handleSubmit(formData: FormData) {
		if (submittingRef.current) return;
		submittingRef.current = true;
		setLoading(true);
		try {
			const result = await updateUserAction(user!.id, formData);
			if (result.success) {
				toast.success("Profile updated successfully");
				onOpenChange(false);
			} else {
				toast.error(result.error || "Failed to update profile");
			}
		} catch (error) {
			toast.error("An unexpected error occurred");
		} finally {
			setLoading(false);
			submittingRef.current = false;
		}
	}

	async function handleReassign(classId: string) {
		if (submittingRef.current) return;
		submittingRef.current = true;
		setLoading(true);
		try {
			const result = await reassignClassAction(user!.id, parseInt(classId));
			if (result.success) {
				toast.success("Class assignment updated");
				onOpenChange(false);
			} else {
				toast.error(result.error || "Failed to update assignment");
			}
		} catch (error) {
			toast.error("An unexpected error occurred");
		} finally {
			setLoading(false);
			submittingRef.current = false;
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-120 p-0 border-l border-border">
				<div className="h-full flex flex-col">
					<SheetHeader className="p-8 bg-slate-50/50 border-b border-slate-100">
						<div className="flex items-center gap-4">
							<div className="flex h-12 w-12 items-center justify-center rounded-sm bg-white border border-border text-[#002388]">
								{user.role === "STUDENT" ? (
									<GraduationCap size={24} />
								) : (
									<User size={24} />
								)}
							</div>
							<div className="text-left">
								<SheetTitle className="text-xl font-bold text-slate-900">
									Edit {user.role.toLowerCase()}
								</SheetTitle>
								<SheetDescription className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">
									ID: {user.email.split("@")[0]}
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto p-8 space-y-10">
						{/* Basic Info */}
						<form
							id="edit-user-form"
							action={handleSubmit}
							className="space-y-6"
						>
							<div className="space-y-4">
								<div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
									<BadgeInfo size={14} />
									Basic Information
								</div>

								<div className="space-y-2">
									<Label
										htmlFor="name"
										className="text-xs font-bold text-slate-700 ml-1"
									>
										Full Name
									</Label>
									<div className="relative group">
										<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#002388] transition-colors">
											<User size={18} />
										</div>
										<Input
											id="name"
											name="name"
											defaultValue={user.name || ""}
											className="h-11 pl-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label
										htmlFor="email"
										className="text-xs font-bold text-slate-700 ml-1"
									>
										Email Address
									</Label>
									<div className="relative group">
										<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#002388] transition-colors">
											<Mail size={18} />
										</div>
										<Input
											id="email"
											name="email"
											defaultValue={user.email}
											className="h-11 pl-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all"
										/>
									</div>
								</div>
							</div>

							{/* Role Specific Info */}
							<div className="space-y-4">
								<div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
									<Building2 size={14} />
									Academic Details
								</div>

								{user.role === "STUDENT" && (
									<div className="space-y-2">
										<Label
											htmlFor="indexNumber"
											className="text-xs font-bold text-slate-700 ml-1"
										>
											Index Number
										</Label>
										<Input
											id="indexNumber"
											name="indexNumber"
											defaultValue={user.studentProfile?.indexNumber || ""}
											className="h-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all px-4"
										/>
									</div>
								)}
								{user.role === "STUDENT" && (
									<div className="space-y-2">
										<Label
											htmlFor="programId"
											className="text-xs font-bold text-slate-700 ml-1"
										>
											Academic Program
										</Label>
										<Select
											name="programId"
											defaultValue={user.studentProfile?.programId?.toString()}
										>
											<SelectTrigger
												id="programId"
												className="h-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all px-4"
											>
												<SelectValue placeholder="Select a program" />
											</SelectTrigger>
											<SelectContent className="rounded-sm border-border">
												{programs.map((program) => (
													<SelectItem
														key={program.id}
														value={program.id.toString()}
														className="text-sm rounded-sm"
													>
														{program.name}{program.code ? ` (${program.code})` : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								{user.role === "LECTURER" && (
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2">
											<Label
												htmlFor="department"
												className="text-xs font-bold text-slate-700 ml-1"
											>
												Department
											</Label>
											<Input
												id="department"
												name="department"
												defaultValue={user.lecturerProfile?.department || ""}
												className="h-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all px-4"
											/>
										</div>
										<div className="space-y-2">
											<Label
												htmlFor="title"
												className="text-xs font-bold text-slate-700 ml-1"
											>
												Official Title
											</Label>
											<Input
												id="title"
												name="title"
												defaultValue={user.lecturerProfile?.title || ""}
												className="h-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all px-4"
											/>
										</div>
									</div>
								)}

								{/* Class Assignment Integrated for Students */}
								{user.role === "STUDENT" && (
									<div className="space-y-2">
										<Label className="text-xs font-bold text-slate-700 ml-1">
											Current Class
										</Label>
										<Select
											onValueChange={handleReassign}
											defaultValue={user.studentProfile?.classId?.toString()}
										>
											<SelectTrigger className="h-11 rounded-sm border-border bg-slate-50/50 focus:bg-white transition-all px-4">
												<SelectValue placeholder="Select a class" />
											</SelectTrigger>
											<SelectContent className="rounded-sm border-border">
												{classes.map((cls: any) => (
													<SelectItem
														key={cls.id}
														value={cls.id.toString()}
														className="text-sm rounded-sm"
													>
														{cls.name} (L{cls.level})
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
						</form>
					</div>

					<div className="p-8 border-t border-slate-100 bg-slate-50/50">
						<Button
							type="submit"
							form="edit-user-form"
							className="w-full h-12 bg-[#002388] hover:bg-[#001570] text-white font-bold rounded-sm transition-all flex items-center justify-center gap-2"
							disabled={loading}
						>
							{loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
							{loading ? "Updating..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
