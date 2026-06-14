"use client";

import {
	AlertCircle,
	CheckCircle2,
	Download,
	FileText,
	Upload,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";

type Role = "STUDENT" | "LECTURER" | "ADMIN";

type RowError = { row: number; field: string; message: string };

type ImportResult = {
	created: number;
	failed: number;
	errors: RowError[];
};

type Step = "upload" | "ready" | "result";

export default function BulkImportSheet({
	open,
	onOpenChange,
	classes = [],
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	classes?: any[];
}) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [role, setRole] = useState<Role>("STUDENT");
	const [step, setStep] = useState<Step>("upload");
	const [fileError, setFileError] = useState<string | null>(null);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [importing, setImporting] = useState(false);
	const [result, setResult] = useState<ImportResult | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	function reset() {
		setStep("upload");
		setFileError(null);
		setSelectedFile(null);
		setResult(null);
		setImporting(false);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	function handleClose(val: boolean) {
		if (!val) reset();
		onOpenChange(val);
	}

	function processFile(file: File) {
		setFileError(null);
		if (!file.name.endsWith(".xlsx")) {
			setFileError(
				"Only Excel (.xlsx) files are accepted. Please download and use the provided template.",
			);
			return;
		}
		setSelectedFile(file);
		setStep("ready");
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) processFile(file);
	}

	const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (file) processFile(file);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	function handleDownloadTemplate() {
		window.open(`/api/admin/users/template?role=${role}`, "_blank");
	}

	async function handleConfirm() {
		if (!selectedFile) return;
		setImporting(true);
		try {
			const formData = new FormData();
			formData.append("role", role);
			formData.append("file", selectedFile);

			const res = await fetch("/api/admin/users/bulk", {
				method: "POST",
				body: formData,
			});
			const json = await res.json();

			if (res.status === 400 && json.error) {
				toast.error(json.error);
				setImporting(false);
				return;
			}

			setResult(json);
			setStep("result");
			if (json.failed === 0) {
				toast.success(
					`${json.created} user${json.created !== 1 ? "s" : ""} imported successfully`,
				);
				router.refresh();
			} else if (json.created > 0) {
				toast.warning(`${json.created} imported, ${json.failed} failed`);
				router.refresh();
			} else {
				toast.error("Import failed — no users were created");
			}
		} catch {
			toast.error("Network error. Please try again.");
		} finally {
			setImporting(false);
		}
	}

	return (
		<Sheet open={open} onOpenChange={handleClose}>
			<SheetContent className="w-full sm:max-w-lg overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Bulk Import Users</SheetTitle>
					<SheetDescription>
						Upload an Excel file to create multiple users at once. Download the
						template for the correct format.
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-col gap-5 px-4 pb-4 mt-6">
					{/* Role selector — always visible */}
					<div className="flex flex-col gap-1.5">
						<Label>Role</Label>
						<Select
							value={role}
							onValueChange={(v) => {
								setRole(v as Role);
								reset();
							}}
						>
							<SelectTrigger className="w-full rounded-xl focus-visible:ring-[#002388]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="STUDENT">Student</SelectItem>
								<SelectItem value="LECTURER">Lecturer</SelectItem>
								<SelectItem value="ADMIN">Admin</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Download template link */}
					<button
						type="button"
						onClick={handleDownloadTemplate}
						className="flex items-center gap-2 text-sm font-medium text-[#002388] hover:underline self-start"
					>
						<Download size={15} />
						Download {role.charAt(0) + role.slice(1).toLowerCase()} template
					</button>

					{/* Step: upload */}
					{step === "upload" && (
						<>
							<div
								onDragOver={(e) => {
									e.preventDefault();
									setIsDragging(true);
								}}
								onDragLeave={() => setIsDragging(false)}
								onDrop={handleDrop}
								onClick={() => fileInputRef.current?.click()}
								className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
									isDragging
										? "border-[#002388] bg-[#002388]/5"
										: "border-slate-200 hover:border-[#002388]/40 hover:bg-slate-50"
								}`}
							>
								<Upload size={28} className="text-slate-400" />
								<div className="text-center">
									<p className="text-sm font-semibold text-slate-700">
										Drop your Excel (.xlsx) file here or click to browse
									</p>
									<p className="text-xs text-slate-400 mt-1">
										Only .xlsx files accepted
									</p>
								</div>
								<input
									ref={fileInputRef}
									type="file"
									accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
									className="hidden"
									onChange={handleFileChange}
								/>
							</div>

							{fileError && (
								<div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
									<AlertCircle
										size={15}
										className="text-red-500 mt-0.5 shrink-0"
									/>
									<p className="text-xs text-red-600">{fileError}</p>
								</div>
							)}
						</>
					)}

					{/* Step: ready */}
					{step === "ready" && selectedFile && (
						<>
							<div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-4 mt-2">
								<FileText size={20} className="text-[#002388] shrink-0" />
								<div className="flex flex-col flex-1 min-w-0">
									<span className="text-sm font-semibold text-slate-700 truncate">
										{selectedFile.name}
									</span>
									<span className="text-xs text-slate-400">
										{(selectedFile.size / 1024).toFixed(1)} KB
									</span>
								</div>
								<button
									type="button"
									onClick={reset}
									className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-md transition-colors"
								>
									<X size={16} />
								</button>
							</div>
							<div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
								Click the import button below to process this file. Our system
								will validate each row and create the users.
							</div>
						</>
					)}

					{/* Step: result */}
					{step === "result" && result && (
						<div className="flex flex-col gap-3">
							<div className="grid grid-cols-2 gap-3">
								<div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
									<p className="text-2xl font-bold text-emerald-600">
										{result.created}
									</p>
									<p className="text-xs font-medium text-emerald-700 mt-0.5">
										Created
									</p>
								</div>
								<div
									className={`rounded-xl border px-4 py-3 text-center ${result.failed > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}
								>
									<p
										className={`text-2xl font-bold ${result.failed > 0 ? "text-red-600" : "text-slate-400"}`}
									>
										{result.failed}
									</p>
									<p
										className={`text-xs font-medium mt-0.5 ${result.failed > 0 ? "text-red-700" : "text-slate-500"}`}
									>
										Failed
									</p>
								</div>
							</div>

							{result.failed === 0 && (
								<div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
									<CheckCircle2
										size={15}
										className="text-emerald-500 shrink-0"
									/>
									<p className="text-xs text-emerald-700 font-medium">
										All users imported successfully.
									</p>
								</div>
							)}

							{result.errors.length > 0 && (
								<div className="flex flex-col gap-1.5">
									<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
										Row Errors
									</p>
									<div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-2">
										{result.errors.map((err, i) => (
											<div
												key={i}
												className="flex items-start gap-2 text-xs text-red-700 py-1 border-b border-red-100 last:border-0"
											>
												<span className="font-bold shrink-0">
													Row {err.row}:
												</span>
												<span className="font-medium text-red-500">
													{err.field}
												</span>
												<span className="text-red-600">— {err.message}</span>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				<SheetFooter className="px-4 pb-4 flex flex-col gap-2 border-t border-slate-100 pt-4 mt-auto">
					{step === "ready" && (
						<Button
							onClick={handleConfirm}
							disabled={importing}
							className="w-full bg-[#002388] hover:bg-[#0B4DBB] text-white rounded-xl h-10"
						>
							{importing ? "Importing…" : "Import Users"}
						</Button>
					)}
					{step === "result" && (
						<Button
							variant="outline"
							onClick={reset}
							className="w-full rounded-xl h-10 border-slate-200"
						>
							Import Another File
						</Button>
					)}
					{step === "upload" && (
						<Button
							variant="outline"
							onClick={() => handleClose(false)}
							className="w-full rounded-xl h-10 border-slate-200"
						>
							Cancel
						</Button>
					)}
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
