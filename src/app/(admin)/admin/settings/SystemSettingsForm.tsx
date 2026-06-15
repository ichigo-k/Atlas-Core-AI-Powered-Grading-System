"use client";

import { GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { saveSystemSettingsAction } from "@/app/actions/admin-settings-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	DEFAULT_GRADING_SCALE,
	type GradeEntry,
	parseGradingScale,
} from "@/lib/grading-scale";

export default function SystemSettingsForm({
	initialSettings,
}: {
	initialSettings: any;
}) {
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		academicYear: initialSettings?.academicYear || "2023/2024",
		semester: initialSettings?.semester || "First Semester",
		contactEmail: initialSettings?.contactEmail || "admin@system.edu",
	});

	const [scale, setScale] = useState<GradeEntry[]>(
		parseGradingScale(initialSettings?.gradingScale),
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
	};

	const handleScaleChange = (
		index: number,
		field: keyof GradeEntry,
		value: string,
	) => {
		setScale((prev) =>
			prev.map((entry, i) =>
				i === index
					? {
							...entry,
							[field]: field === "minPercent" ? Number(value) : value,
						}
					: entry,
			),
		);
	};

	const addRow = () => {
		setScale((prev) => [...prev, { label: "", minPercent: 0 }]);
	};

	const removeRow = (index: number) => {
		setScale((prev) => prev.filter((_, i) => i !== index));
	};

	const resetScale = () => {
		setScale(DEFAULT_GRADING_SCALE);
	};

	const handleSave = async () => {
		// Validate scale — no empty labels, no duplicate labels
		const labels = scale.map((e) => e.label.trim()).filter(Boolean);
		if (labels.length !== scale.length) {
			toast.error("All grade labels must be filled in.");
			return;
		}
		if (new Set(labels).size !== labels.length) {
			toast.error("Grade labels must be unique.");
			return;
		}

		setLoading(true);
		const result = await saveSystemSettingsAction({
			...formData,
			gradingScale: scale,
		});
		if (result.success) {
			toast.success("System settings updated successfully.");
		} else {
			toast.error(result.error || "Failed to update system settings.");
		}
		setLoading(false);
	};

	// Sort scale descending for display (highest threshold first)
	const sortedScale = [...scale].sort((a, b) => b.minPercent - a.minPercent);

	return (
		<section className="space-y-6">
			<div className="grid gap-8">
				{/* Academic Configuration */}
				<div className="space-y-4">
					<h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
						Academic Configuration
					</h2>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label className="text-xs font-bold text-slate-700 uppercase tracking-tight ml-1">
								Current Academic Year
							</Label>
							<Input
								name="academicYear"
								value={formData.academicYear}
								onChange={handleChange}
								className="h-11 rounded-sm border-border"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-xs font-bold text-slate-700 uppercase tracking-tight ml-1">
								Current Semester
							</Label>
							<Input
								name="semester"
								value={formData.semester}
								onChange={handleChange}
								className="h-11 rounded-sm border-border"
							/>
						</div>
					</div>
				</div>

				{/* Portal Information */}
				<div className="space-y-4 pt-6 border-t border-slate-100">
					<h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
						Portal Information
					</h2>
					<div className="space-y-2">
						<Label className="text-xs font-bold text-slate-700 uppercase tracking-tight ml-1">
							Contact Email
						</Label>
						<Input
							name="contactEmail"
							type="email"
							value={formData.contactEmail}
							onChange={handleChange}
							className="h-11 rounded-sm border-border"
						/>
					</div>
				</div>

				{/* Grading Scale */}
				<div className="space-y-4 pt-6 border-t border-slate-100">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
								Grading Scale
							</h2>
							<p className="text-xs text-slate-400 mt-1">
								Define letter grades and their minimum percentage thresholds.
								Grades are awarded to the highest matching threshold.
							</p>
						</div>
						<button
							type="button"
							onClick={resetScale}
							className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
						>
							Reset to default
						</button>
					</div>

					{/* Column headers */}
					<div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-1">
						<span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
							Grade Label
						</span>
						<span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
							Min % (≥)
						</span>
						<span className="w-8" />
					</div>

					<div className="space-y-2">
						{sortedScale.map((entry) => {
							// Find the real index in the unsorted scale array
							const realIndex = scale.findIndex(
								(e) =>
									e.label === entry.label && e.minPercent === entry.minPercent,
							);
							return (
								<div
									key={`${entry.label}-${entry.minPercent}-${realIndex}`}
									className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center"
								>
									<Input
										value={entry.label}
										onChange={(e) =>
											handleScaleChange(realIndex, "label", e.target.value)
										}
										placeholder="e.g. A+"
										className="h-10 rounded-sm border-border font-mono text-sm"
									/>
									<Input
										type="number"
										min={0}
										max={100}
										value={entry.minPercent}
										onChange={(e) =>
											handleScaleChange(realIndex, "minPercent", e.target.value)
										}
										placeholder="e.g. 90"
										className="h-10 rounded-sm border-border font-mono text-sm"
									/>
									<button
										type="button"
										onClick={() => removeRow(realIndex)}
										className="w-8 h-8 flex items-center justify-center rounded-sm text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
										aria-label="Remove grade"
									>
										<Trash2 size={14} />
									</button>
								</div>
							);
						})}
					</div>

					<button
						type="button"
						onClick={addRow}
						className="flex items-center gap-2 text-xs font-semibold text-[#002388] hover:text-[#001570] transition-colors mt-1"
					>
						<Plus size={14} />
						Add grade
					</button>

					{/* Live preview */}
					<div className="mt-4 p-4 bg-slate-50 rounded-sm border border-slate-100">
						<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
							Preview
						</p>
						<div className="flex flex-wrap gap-2">
							{[...scale]
								.sort((a, b) => b.minPercent - a.minPercent)
								.map((entry, i) => (
									<span
										key={i}
										className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-border text-xs font-semibold text-slate-700"
									>
										<span className="font-bold text-[#002388]">
											{entry.label || "?"}
										</span>
										<span className="text-slate-400">
											≥ {entry.minPercent}%
										</span>
									</span>
								))}
						</div>
					</div>
				</div>

				<div className="pt-8">
					<Button
						onClick={handleSave}
						disabled={loading}
						className="h-12 px-8 bg-[#002388] hover:bg-[#001570] text-white font-normal rounded-sm flex items-center gap-2"
					>
						<Save size={18} />
						{loading ? "Saving..." : "Save System Changes"}
					</Button>
				</div>
			</div>
		</section>
	);
}
