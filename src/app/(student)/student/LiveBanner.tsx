"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowRight } from "lucide-react";
import { createOrResumeAttempt } from "@/lib/assessment-actions";

export default function LiveBanner({ items }: { items: { id: number; title: string; courseTitle: string; passwordProtected: boolean; proctoringEnabled: boolean }[] }) {
	const [dismissed, setDismissed] = useState(false);
	const [startingId, setStartingId] = useState<number | null>(null);
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	if (dismissed || items.length === 0) return null;

	return (
		<div className="rounded-lg border border-[#ceead6] bg-[#e6f4ea] px-4 py-3 flex items-center gap-3 shadow-sm">
			<span className="relative flex h-2 w-2 shrink-0">
				<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34a853] opacity-75" />
				<span className="relative inline-flex h-2 w-2 rounded-full bg-[#1e8e3e]" />
			</span>

			<span className="text-xs font-medium text-[#137333] shrink-0 uppercase tracking-wider">Live now</span>

			<div className="flex flex-wrap gap-2 flex-1 min-w-0">
				{items.map(a => (
					<button
						key={a.id}
						type="button"
						disabled={isPending && startingId === a.id}
						onClick={() => {
							if (a.passwordProtected) {
								router.push(`/student/assessments/${a.id}/assessment-onboarding`)
								return
							}

							setStartingId(a.id)
							startTransition(async () => {
								const result = await createOrResumeAttempt(a.id)
								if ("error" in result) {
									router.push(`/student/assessments/${a.id}`)
									setStartingId(null)
									return
								}

								router.push(`/student/assessments/${a.id}/assessment-onboarding?attemptId=${result.attemptId}`)
							})
						}}
						className="flex items-center gap-1.5 rounded-full border border-[#ceead6] bg-white px-3 py-1 text-xs font-medium text-[#5f6368] hover:bg-[#f8f9fa] transition-colors"
					>
						<span className="font-medium text-[#202124]">{a.courseTitle}</span>
						<span className="text-[#dadce0]">·</span>
						<span className="truncate max-w-35">{a.title}</span>
						<ArrowRight size={10} className="text-[#5f6368] shrink-0" />
					</button>
				))}
			</div>

			<button
				onClick={() => setDismissed(true)}
				className="shrink-0 p-1 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#ceead6] transition-colors"
			>
				<X size={14} />
			</button>
		</div>
	);
}
