"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectItem,
	SelectValue,
} from "@/components/ui/select";

type Role = "STUDENT" | "LECTURER" | "ADMIN";

type FormState = {
	status: "idle" | "success" | "conflict" | "error";
	conflictMessage?: string;
	fieldErrors?: Partial<Record<string, string>>;
	role?: Role;
};

const initialState: FormState = { status: "idle" };

function validate(
	data: Record<string, string>,
	role: Role,
): Partial<Record<string, string>> {
	const errors: Partial<Record<string, string>> = {};
	if (!data.name?.trim()) errors.name = "Full name is required";
	if (!data.email?.trim()) errors.email = "Email is required";
	if (role === "STUDENT") {
		if (!data.indexNumber?.trim()) errors.indexNumber = "Index number is required";
		// programId expected from dropdown; fall back to program string
		if (!data.programId && !data.program) errors.program = "Program is required";
	}
	if (role === "LECTURER") {
		// facultyId expected from dropdown; fall back to department string
		if (!data.facultyId && !data.department) errors.department = "Faculty is required";
		if (!data.title?.trim()) errors.title = "Title is required";
	}
	return errors;
}

// Separate component so useFormStatus works (must be inside <form>)
function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Button
			type="submit"
			disabled={pending}
			className="w-full bg-[#002388] hover:bg-[#001570] text-white rounded-sm h-10 font-medium transition-colors flex items-center justify-center gap-2"
		>
			{pending ? (
				<>
					<Loader2 className="h-4 w-4 animate-spin" />
					<span>Creating...</span>
				</>
			) : (
				<span>Create User</span>
			)}
		</Button>
	);
}

export default function AddUserSheet({
	open,
	onOpenChange,
	classes = [],
	faculties = [],
	programs = [],
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	classes?: any[];
	faculties?: any[];
	programs?: any[];
}) {
	const router = useRouter();
	const [role, setRole] = useState<Role>("STUDENT");

	const roleRef = useRef<Role>(role);
	useEffect(() => {
		roleRef.current = role;
	}, [role]);

	async function submitAction(
		_prev: FormState,
		formData: FormData,
	): Promise<FormState> {
		const currentRole = roleRef.current;
		const data: Record<string, string> = {};
		for (const [k, v] of formData.entries()) {
			if (typeof v === "string") data[k] = v;
		}

		const fieldErrors = validate(data, currentRole);
		if (Object.keys(fieldErrors).length > 0) {
			return { status: "idle", fieldErrors, role: currentRole };
		}

		const body: Record<string, unknown> = {
			name: data.name,
			email: data.email,
			role: currentRole,
		};
		if (currentRole === "STUDENT") {
			if (data.indexNumber) body.indexNumber = data.indexNumber;
			if (data.programId) body.programId = Number(data.programId);
			// keep legacy program string if provided
			if (data.program) body.program = data.program;
			if (data.classId?.trim()) body.classId = Number(data.classId);
		} else if (currentRole === "LECTURER") {
			if (data.facultyId) body.facultyId = Number(data.facultyId);
			if (data.department) body.department = data.department;
			body.title = data.title;
		}

		try {
			const res = await fetch("/api/admin/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (res.status === 201) {
				return { status: "success" };
			}
			if (res.status === 409) {
				const json = await res.json();
				return {
					status: "conflict",
					conflictMessage: json.error ?? "Conflict",
					role: currentRole,
				};
			}
			return { status: "error", role: currentRole };
		} catch {
			return { status: "error", role: currentRole };
		}
	}

	const [state, formAction] = useActionState(submitAction, initialState);

	// Side-effects
	useEffect(() => {
		if (state.status === "success") {
			onOpenChange(false);
			toast.success("User created successfully");
			router.refresh();
		} else if (state.status === "error") {
			toast.error("Something went wrong. Please try again.");
		}
	}, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reset local state when sheet opens
	useEffect(() => {
		if (open) {
			setRole("STUDENT");
		}
	}, [open]);

	const fe = state.fieldErrors ?? {};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
				<SheetHeader className="mb-6 text-left">
					<SheetTitle className="text-xl font-bold text-slate-900">Add New User</SheetTitle>
					<SheetDescription className="text-sm text-slate-500">
						Fill in the details below to create a new user account.
					</SheetDescription>
				</SheetHeader>

				<form action={formAction} className="flex flex-col gap-5">
					{/* 409 inline error */}
					{state.status === "conflict" && (
						<div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-sm text-sm font-medium">
							{state.conflictMessage}
						</div>
					)}

					{/* Role selector */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="role-select" className="text-slate-700 font-medium">Role</Label>
						<Select value={role} onValueChange={(v) => setRole(v as Role)}>
							<SelectTrigger id="role-select" className="w-full rounded-sm h-10 border-border focus-visible:ring-[#002388]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="STUDENT">Student</SelectItem>
								<SelectItem value="LECTURER">Lecturer</SelectItem>
								<SelectItem value="ADMIN">Admin</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Full Name */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="name" className="text-slate-700 font-medium">Full Name</Label>
						<Input
							id="name"
							name="name"
							placeholder="e.g. Kwame Mensah"
							className="rounded-sm h-10 border-border focus-visible:ring-[#002388]"
						/>
						{fe.name && <p className="text-xs text-red-500">{fe.name}</p>}
					</div>

					{/* Email */}
					<div className="flex flex-col gap-2">
						<Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="e.g. 4211230210@live.gctu.edu.gh"
							className="rounded-sm h-10 border-border focus-visible:ring-[#002388]"
						/>
						<p className="text-[12px] text-slate-500">Password will be set to the local part of the email (before @)</p>
						{fe.email && <p className="text-xs text-red-500">{fe.email}</p>}
					</div>

					{/* Student fields */}
					{role === "STUDENT" && (
						<>
							<div className="flex flex-col gap-2">
								<Label htmlFor="indexNumber" className="text-slate-700 font-medium">Index Number</Label>
								<Input
									id="indexNumber"
									name="indexNumber"
									type="text"
									placeholder="e.g. 4211230210"
									className="rounded-sm h-10 border-border focus-visible:ring-[#002388]"
								/>
								{fe.indexNumber && <p className="text-xs text-red-500">{fe.indexNumber}</p>}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="programId" className="text-slate-700 font-medium">Program</Label>
								<Select name="programId">
									<SelectTrigger id="programId" className="w-full rounded-sm h-10 border-border focus-visible:ring-[#002388]">
										<SelectValue placeholder={programs?.length ? "Select program" : "No programs found"} />
									</SelectTrigger>
									<SelectContent>
										{(!programs || programs.length === 0) ? (
											<div className="p-2 text-sm text-slate-500">No programs found</div>
										) : (
											programs.map((p: any) => (
												<SelectItem key={p.id} value={p.id.toString()}>
													{p.name} {p.faculty ? `— ${p.faculty.name}` : ""}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
								{fe.program && <p className="text-xs text-red-500">{fe.program}</p>}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="classId" className="text-slate-700 font-medium">
									Class <span className="text-slate-400 font-normal">(optional)</span>
								</Label>
								<Select name="classId">
									<SelectTrigger id="classId" className="w-full rounded-sm h-10 border-border focus-visible:ring-[#002388]">
										<SelectValue placeholder="Select class" />
									</SelectTrigger>
									<SelectContent>
										{classes.length === 0 ? (
											<div className="p-2 text-sm text-slate-500">No classes found</div>
										) : (
											classes.map((c: any) => (
												<SelectItem key={c.id} value={c.id.toString()}>
													{c.name} - Level {c.level}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
							</div>
						</>
					)}

					{/* Lecturer fields */}
					{role === "LECTURER" && (
						<>
							<div className="flex flex-col gap-2">
								<Label htmlFor="facultyId" className="text-slate-700 font-medium">Faculty</Label>
								<Select name="facultyId">
									<SelectTrigger id="facultyId" className="w-full rounded-sm h-10 border-border focus-visible:ring-[#002388]">
										<SelectValue placeholder={faculties?.length ? "Select faculty" : "No faculties found"} />
									</SelectTrigger>
									<SelectContent>
										{(!faculties || faculties.length === 0) ? (
											<div className="p-2 text-sm text-slate-500">No faculties found</div>
										) : (
											faculties.map((f: any) => (
												<SelectItem key={f.id} value={f.id.toString()}>
													{f.name}
												</SelectItem>
											))
										)}
									</SelectContent>
								</Select>
								{fe.department && <p className="text-xs text-red-500">{fe.department}</p>}
							</div>
							<div className="flex flex-col gap-2">
								<Label htmlFor="title-select" className="text-slate-700 font-medium">Title</Label>
								<Select name="title">
									<SelectTrigger id="title-select" className="w-full rounded-sm h-10 border-border focus-visible:ring-[#002388]">
										<SelectValue placeholder="Select title" />
									</SelectTrigger>
									<SelectContent>
										{["Dr.", "Prof.", "Mr.", "Mrs.", "Ms."].map((t: any) => (
											<SelectItem key={t} value={t}>{t}</SelectItem>
										))}
									</SelectContent>
								</Select>
								{fe.title && <p className="text-xs text-red-500">{fe.title}</p>}
							</div>
						</>
					)}

					{/* Admin — no extra fields needed */}

					<SheetFooter className="mt-4 pt-4 border-t border-slate-100">
						<SubmitButton />
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	);
}
