"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createFacultyAction } from "@/app/actions/admin-entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

export default function AddFacultySheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const [loading, setLoading] = useState(false);

	async function handleSubmit(formData: FormData) {
		setLoading(true);
		try {
			const res = await createFacultyAction(formData);
			if (res.success) {
				toast.success("Faculty created");
				onOpenChange(false);
			} else {
				toast.error(res.error || "Failed to create faculty");
			}
		} catch {
			toast.error("An unexpected error occurred");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-[540px] p-0 border-l border-slate-200">
				<div className="h-full flex flex-col">
					<SheetHeader className="p-8 bg-slate-50/50 border-b border-slate-100">
						<div className="flex items-center gap-4">
							<div className="text-left flex-1">
								<SheetTitle className="text-xl font-bold text-slate-900">
									Add Faculty
								</SheetTitle>
								<SheetDescription className="text-xs text-slate-500">
									Create a new faculty
								</SheetDescription>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto">
						<form
							id="faculty-form"
							action={handleSubmit}
							className="p-8 space-y-6"
						>
							<div className="space-y-2">
								<Label
									htmlFor="name"
									className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight"
								>
									Name
								</Label>
								<Input
									id="name"
									name="name"
									placeholder="e.g. Faculty of Science"
									className="h-11"
								/>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="code"
									className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-tight"
								>
									Code (optional)
								</Label>
								<Input
									id="code"
									name="code"
									placeholder="e.g. SCI"
									className="h-11"
								/>
							</div>
						</form>
					</div>

					<div className="p-8 border-t border-slate-100 bg-slate-50/50">
						<Button
							type="submit"
							form="faculty-form"
							className="w-full h-12 bg-[#002388] text-white"
							disabled={loading}
						>
							{loading ? "Creating..." : "Create Faculty"}
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
