import { Skeleton } from "@/components/ui/skeleton";

function StudentPage({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-full bg-[#f8f9fa] dark:bg-[#0f1b2d]">
			<div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-border bg-white px-5">
				<Skeleton className="h-2.5 w-12" />
				<Skeleton className="h-2.5 w-2 rounded-full" />
				<Skeleton className="h-2.5 w-20" />
			</div>
			<div className="mx-auto w-full max-w-[1280px] space-y-5 px-4 py-5 pb-12 md:px-6 lg:px-8">
				{children}
			</div>
		</div>
	);
}

function Heading({ wide = false }: { wide?: boolean }) {
	return (
		<div className="space-y-2">
			<Skeleton className={`h-6 ${wide ? "w-64" : "w-40"}`} />
			<Skeleton className="h-3 w-full max-w-md" />
		</div>
	);
}

function MetricCard({ delay = 0 }: { delay?: number }) {
	return (
		<div
			className="rounded-md border border-border bg-white p-4"
			style={{ animationDelay: `${delay}ms` }}
		>
			<Skeleton className="h-3 w-24" />
			<Skeleton className="mt-4 h-7 w-16" />
			<Skeleton className="mt-3 h-2.5 w-32" />
		</div>
	);
}

function AssessmentRow({ delay = 0 }: { delay?: number }) {
	return (
		<div
			className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
			style={{ animationDelay: `${delay}ms` }}
		>
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<Skeleton className="h-10 w-10 shrink-0 rounded-md" />
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex gap-2">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-3 w-20" />
					</div>
					<Skeleton className="h-4 w-full max-w-sm" />
					<Skeleton className="h-3 w-full max-w-xs" />
				</div>
			</div>
			<Skeleton className="h-9 w-full rounded-sm sm:w-28" />
		</div>
	);
}

function ChartPlaceholder() {
	return (
		<div className="relative mt-6 h-48 overflow-hidden border-b border-l border-slate-200">
			<div className="absolute inset-x-0 top-1/4 border-t border-dashed border-slate-100" />
			<div className="absolute inset-x-0 top-2/4 border-t border-dashed border-slate-100" />
			<div className="absolute inset-x-0 top-3/4 border-t border-dashed border-slate-100" />
			<div className="absolute bottom-0 left-[8%] h-[35%] w-[9%] rounded-t bg-emerald-100" />
			<div className="absolute bottom-0 left-[25%] h-[58%] w-[9%] rounded-t bg-emerald-100" />
			<div className="absolute bottom-0 left-[42%] h-[48%] w-[9%] rounded-t bg-emerald-100" />
			<div className="absolute bottom-0 left-[59%] h-[72%] w-[9%] rounded-t bg-emerald-100" />
			<div className="absolute bottom-0 left-[76%] h-[64%] w-[9%] rounded-t bg-emerald-100" />
		</div>
	);
}

export function StudentDashboardSkeleton() {
	return (
		<StudentPage>
			<Heading wide />
			<div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
				<div className="rounded-md border border-border bg-white p-5">
					<div className="flex items-center justify-between">
						<Skeleton className="h-3 w-28" />
						<Skeleton className="h-5 w-20 rounded-full" />
					</div>
					<Skeleton className="mt-6 h-6 w-3/4" />
					<Skeleton className="mt-3 h-3 w-1/2" />
					<div className="mt-6 grid grid-cols-3 gap-3">
						{[0, 1, 2].map((i) => (
							<Skeleton key={i} className="h-14 rounded-sm" />
						))}
					</div>
					<Skeleton className="mt-5 h-10 w-full rounded-sm sm:w-36" />
				</div>
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
					{[0, 1, 2].map((i) => (
						<MetricCard key={i} delay={i * 80} />
					))}
				</div>
			</div>
			<div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
				<div className="overflow-hidden rounded-md border border-border bg-white">
					<div className="p-4">
						<Skeleton className="h-4 w-40" />
					</div>
					{[0, 1, 2].map((i) => (
						<AssessmentRow key={i} delay={i * 70} />
					))}
				</div>
				<div className="rounded-md border border-border bg-white p-5">
					<Skeleton className="h-4 w-28" />
					{[0, 1, 2].map((i) => (
						<div key={i} className="mt-5 flex items-center justify-between">
							<div className="space-y-2">
								<Skeleton className="h-3 w-36" />
								<Skeleton className="h-2.5 w-24" />
							</div>
							<Skeleton className="h-6 w-12" />
						</div>
					))}
				</div>
			</div>
		</StudentPage>
	);
}

export function StudentAssessmentsSkeleton() {
	return (
		<StudentPage>
			<Heading />
			<div className="flex gap-6 border-b border-border pb-2">
				{[
					["all", "w-16"],
					["ongoing", "w-20"],
					["upcoming", "w-20"],
					["completed", "w-24"],
				].map(([key, width]) => (
					<Skeleton key={key} className={`h-4 ${width}`} />
				))}
			</div>
			<div className="flex gap-3">
				<Skeleton className="h-9 flex-1 rounded-sm" />
				<Skeleton className="h-9 w-24 rounded-sm" />
			</div>
			<div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-border bg-white">
				{[0, 1, 2, 3, 4, 5].map((i) => (
					<AssessmentRow key={i} delay={i * 55} />
				))}
			</div>
			<div className="flex justify-between">
				<Skeleton className="h-3 w-28" />
				<Skeleton className="h-8 w-36" />
			</div>
		</StudentPage>
	);
}

export function StudentAssessmentOverviewSkeleton() {
	return (
		<StudentPage>
			<Heading wide />
			<div className="rounded-md border border-border border-t-4 border-t-emerald-500 bg-white p-6">
				<div className="flex flex-col gap-5 sm:flex-row sm:justify-between">
					<div className="space-y-3">
						<Skeleton className="h-5 w-24 rounded-full" />
						<Skeleton className="h-7 w-72 max-w-full" />
						<Skeleton className="h-3 w-48" />
					</div>
					<Skeleton className="h-12 w-12 rounded-md" />
				</div>
				<div className="mt-7 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 md:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<div key={i} className="space-y-2">
							<Skeleton className="h-2.5 w-16" />
							<Skeleton className="h-4 w-24" />
						</div>
					))}
				</div>
			</div>
			<div className="grid gap-5 lg:grid-cols-[1fr_280px]">
				<div className="space-y-4 rounded-md border border-border bg-white p-5">
					<Skeleton className="h-4 w-32" />
					{[0, 1, 2, 3].map((i) => (
						<div key={i} className="flex gap-3">
							<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-3 w-40" />
								<Skeleton className="h-3 w-full" />
							</div>
						</div>
					))}
				</div>
				<div className="h-fit rounded-md border border-border bg-white p-5">
					<Skeleton className="h-4 w-28" />
					<Skeleton className="mt-5 h-20 w-full rounded-sm" />
					<Skeleton className="mt-5 h-10 w-full rounded-sm" />
				</div>
			</div>
		</StudentPage>
	);
}

export function StudentGradesSkeleton() {
	return (
		<StudentPage>
			<Heading wide />
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[0, 1, 2, 3].map((i) => (
					<MetricCard key={i} delay={i * 70} />
				))}
			</div>
			<div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
				<div className="rounded-md border border-border bg-white p-5">
					<Skeleton className="h-4 w-28" />
					<ChartPlaceholder />
				</div>
				<div className="rounded-md border border-border bg-white p-5">
					<Skeleton className="h-4 w-36" />
					<Skeleton className="mx-auto mt-7 h-36 w-36 rounded-full" />
					<div className="mt-6 space-y-3">
						{[0, 1, 2].map((i) => (
							<Skeleton key={i} className="h-3 w-full" />
						))}
					</div>
				</div>
			</div>
			<div className="rounded-md border border-border bg-white p-5">
				<Skeleton className="h-4 w-40" />
				{[0, 1, 2, 3].map((i) => (
					<div key={i} className="mt-5 grid grid-cols-[1fr_80px_60px] gap-4">
						<Skeleton className="h-4" />
						<Skeleton className="h-4" />
						<Skeleton className="h-4" />
					</div>
				))}
			</div>
		</StudentPage>
	);
}

export function StudentScheduleSkeleton() {
	return (
		<StudentPage>
			<Heading />
			<div className="flex items-center justify-between rounded-md border border-border bg-white p-4">
				<Skeleton className="h-8 w-24" />
				<Skeleton className="h-5 w-36" />
				<Skeleton className="h-8 w-24" />
			</div>
			<div className="grid grid-cols-7 overflow-hidden rounded-md border border-border bg-white">
				{Array.from({ length: 35 }, (_, i) => `calendar-cell-${i + 1}`).map(
					(cell, i) => (
						<div
							key={cell}
							className="min-h-24 border-b border-r border-slate-100 p-2"
						>
							<Skeleton className="h-3 w-5" />
							{i % 4 === 0 && (
								<Skeleton className="mt-4 h-8 w-full rounded-sm" />
							)}
						</div>
					),
				)}
			</div>
		</StudentPage>
	);
}

export function StudentProfileSkeleton() {
	return (
		<StudentPage>
			<Heading />
			<div className="rounded-md border border-border bg-white p-6">
				<div className="flex items-center gap-4">
					<Skeleton className="h-16 w-16 rounded-full" />
					<div className="space-y-2">
						<Skeleton className="h-5 w-48" />
						<Skeleton className="h-3 w-60" />
					</div>
				</div>
			</div>
			<div className="grid gap-5 lg:grid-cols-2">
				{[0, 1].map((card) => (
					<div
						key={card}
						className="rounded-md border border-border bg-white p-5"
					>
						<Skeleton className="h-4 w-40" />
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="mt-5 space-y-2">
								<Skeleton className="h-2.5 w-24" />
								<Skeleton className="h-9 w-full rounded-sm" />
							</div>
						))}
					</div>
				))}
			</div>
		</StudentPage>
	);
}

export function StudentResultsSkeleton() {
	return (
		<StudentPage>
			<Heading wide />
			<div className="grid gap-5 rounded-md border border-border bg-white p-6 md:grid-cols-[180px_1fr]">
				<Skeleton className="mx-auto h-36 w-36 rounded-full" />
				<div className="space-y-4">
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-3 w-64 max-w-full" />
					<div className="grid grid-cols-3 gap-3">
						{[0, 1, 2].map((i) => (
							<Skeleton key={i} className="h-14 rounded-sm" />
						))}
					</div>
				</div>
			</div>
			<div className="rounded-md border border-border bg-white p-5">
				<Skeleton className="h-4 w-40" />
				{[0, 1, 2].map((i) => (
					<div key={i} className="mt-5">
						<div className="flex justify-between">
							<Skeleton className="h-3 w-36" />
							<Skeleton className="h-3 w-12" />
						</div>
						<Skeleton className="mt-2 h-2 w-full rounded-full" />
					</div>
				))}
			</div>
			<div className="rounded-md border border-border bg-white p-5">
				<Skeleton className="h-4 w-36" />
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="mt-5 flex justify-between border-t border-slate-100 pt-4"
					>
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-6 w-14 rounded-full" />
					</div>
				))}
			</div>
		</StudentPage>
	);
}

export function StudentReviewSkeleton() {
	return (
		<StudentPage>
			<div className="flex items-center justify-between">
				<Heading wide />
				<Skeleton className="h-9 w-32 rounded-sm" />
			</div>
			<div className="grid gap-5 lg:grid-cols-[230px_1fr]">
				<div className="h-fit rounded-md border border-border bg-white p-4">
					<Skeleton className="h-4 w-28" />
					<div className="mt-4 grid grid-cols-5 gap-2">
						{Array.from({ length: 15 }, (_, i) => `question-${i + 1}`).map(
							(question) => (
								<Skeleton key={question} className="aspect-square rounded-sm" />
							),
						)}
					</div>
				</div>
				<div className="space-y-5">
					<div className="rounded-md border border-border bg-white p-6">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="mt-5 h-5 w-4/5" />
						<Skeleton className="mt-3 h-4 w-full" />
						<div className="mt-7 space-y-3">
							{[0, 1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-11 w-full rounded-sm" />
							))}
						</div>
					</div>
					<div className="rounded-md border border-border bg-white p-5">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="mt-4 h-16 w-full" />
					</div>
				</div>
			</div>
		</StudentPage>
	);
}

export function StudentOnboardingSkeleton() {
	return (
		<div className="min-h-dvh bg-[#f8f9fa] px-4 py-8">
			<div className="mx-auto max-w-4xl">
				<div className="mb-8 flex justify-center">
					<Skeleton className="h-8 w-56" />
				</div>
				<div className="mb-6 flex items-center justify-between">
					{[0, 1, 2, 3, 4].map((i) => (
						<div key={i} className="flex flex-1 items-center last:flex-none">
							<Skeleton className="h-8 w-8 shrink-0 rounded-full" />
							{i < 4 && <Skeleton className="mx-2 h-1 flex-1" />}
						</div>
					))}
				</div>
				<div className="grid gap-5 rounded-md border border-border bg-white p-6 md:grid-cols-[1fr_280px]">
					<div className="space-y-4">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-3 w-full" />
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="flex gap-3">
								<Skeleton className="h-8 w-8 rounded-full" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-3 w-40" />
									<Skeleton className="h-3 w-full" />
								</div>
							</div>
						))}
						<div className="flex justify-end gap-3 pt-4">
							<Skeleton className="h-9 w-24 rounded-sm" />
							<Skeleton className="h-9 w-28 rounded-sm" />
						</div>
					</div>
					<div>
						<Skeleton className="aspect-video w-full rounded-md" />
						<Skeleton className="mt-4 h-3 w-2/3" />
					</div>
				</div>
			</div>
		</div>
	);
}

export function StudentExamBootstrapSkeleton() {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-white px-4">
			<div className="w-full max-w-sm text-center">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eef2ff]">
					<div className="h-6 w-6 animate-spin rounded-full border-2 border-[#002388] border-t-transparent" />
				</div>
				<p className="mt-5 text-[15px] font-semibold text-[#111827]">Preparing your assessment</p>
				<p className="mt-1.5 text-[12px] text-[#6b7280]">Restoring your answers and secure exam session…</p>
				<div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#eef2ff]">
					<div className="h-full w-1/3 animate-loading-sweep rounded-full bg-[#002388]" />
				</div>
				<p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-[#9ca3af]">Please keep this tab open</p>
			</div>
		</div>
	);
}
