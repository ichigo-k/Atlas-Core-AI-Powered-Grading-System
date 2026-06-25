"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, MapPin, CalendarClock, ChevronRight } from "lucide-react";

export type ScheduleItemSerialized = {
	id: number;
	title: string;
	type: string;
	courseTitle: string;
	courseCode: string;
	startsAt: string;
	endsAt: string;
	durationMinutes: number | null;
	location: string | null;
	status: "ongoing" | "upcoming" | "completed";
};

function formatDuration(minutes: number | null): string {
	if (!minutes) return "";
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getTodayIso(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
	EXAM: { bg: "#fbeaea", text: "#a4262c" },
	QUIZ: { bg: "#fdf3e2", text: "#8a6d1c" },
	ASSIGNMENT: { bg: "#e6f2ea", text: "#1d6b3f" },
};

export default function ScheduleClient({ items }: { items: ScheduleItemSerialized[] }) {
	const router = useRouter();
	const todayIso = getTodayIso();
	const [activePill, setActivePill] = useState<string | null>(null);
	const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const scrollingFromPill = useRef(false);

	const grouped = useMemo(() => {
		const map: Record<string, ScheduleItemSerialized[]> = {};
		for (const a of items) {
			const key = a.startsAt.slice(0, 10);
			if (!map[key]) map[key] = [];
			map[key].push(a);
		}
		return map;
	}, [items]);

	const activeDates = useMemo(
		() => Object.keys(grouped).filter((d) => d >= todayIso).sort().slice(0, 14),
		[grouped, todayIso],
	);

	const pills = useMemo(
		() => activeDates.map((iso) => {
			const d = new Date(`${iso}T00:00:00`);
			return {
				iso,
				isToday: iso === todayIso,
				day: d.getDate(),
				weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
				count: grouped[iso]?.length ?? 0,
			};
		}),
		[activeDates, grouped, todayIso],
	);

	useEffect(() => {
		if (activeDates.length > 0 && !activePill) setActivePill(activeDates[0]);
	}, [activeDates, activePill]);

	const handlePillClick = (iso: string) => {
		setActivePill(iso);
		const el = sectionRefs.current[iso];
		if (el) {
			scrollingFromPill.current = true;
			el.scrollIntoView({ behavior: "smooth", block: "start" });
			setTimeout(() => { scrollingFromPill.current = false; }, 800);
		}
	};

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (scrollingFromPill.current) return;
				for (const entry of entries) {
					if (entry.isIntersecting) {
						const date = entry.target.getAttribute("data-date");
						if (date) setActivePill(date);
					}
				}
			},
			{ threshold: 0.4 },
		);
		for (const date of activeDates) {
			const el = sectionRefs.current[date];
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, [activeDates]);

	return (
		<div className="bg-[#f8f9fa] dark:bg-[#1b1b1f] min-h-full">
			{/* Command bar */}
			<div className="sticky top-0 z-20 bg-white dark:bg-[#2b2b30] border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
				<CalendarDays size={11} />
				<span>Student</span>
				<ChevronRight size={11} />
				<span className="text-[#002388] font-medium">Schedule</span>
			</div>
			<div className="px-4 py-5 md:px-6 lg:px-8 space-y-5 pb-12 max-w-[1280px]">

				{/* -- Page header -- */}
				<div>
					<h1 className="text-xl font-semibold text-[#1e293b]">Schedule</h1>
					<p className="text-[12px] text-muted-foreground mt-0.5">
						{activeDates.length > 0
							? `Stay ahead of your next ${activeDates.length} assessment day${activeDates.length !== 1 ? "s" : ""}.`
							: "Your schedule is currently clear."}
					</p>
				</div>

				{/* -- Date pills -- */}
				{pills.length > 0 && (
					<div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
						{pills.map((p) => (
							<button
								key={p.iso}
								onClick={() => handlePillClick(p.iso)}
								className={`flex flex-col items-center min-w-[52px] gap-0.5 rounded-sm px-3 py-2.5 transition-all ${activePill === p.iso
									? "bg-primary text-white"
									: p.isToday
										? "bg-primary/10 text-primary border border-primary/20"
										: "bg-white border border-border text-muted-foreground hover:bg-slate-50"
									}`}
							>
								<span className="text-[9px] font-semibold uppercase tracking-widest leading-none">{p.weekday}</span>
								<span className="text-[18px] font-semibold leading-none mt-0.5">{p.day}</span>
								{p.count > 0 && (
									<div className={`w-1 h-1 rounded-full mt-1 ${activePill === p.iso ? "bg-white" : "bg-primary"}`} />
								)}
							</button>
						))}
					</div>
				)}

				{/* -- Content -- */}
				{activeDates.length === 0 ? (
					<div className="bg-white border border-border rounded-sm py-20 flex flex-col items-center gap-4 text-center">
						<div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
							<CalendarDays size={28} className="text-slate-300" strokeWidth={2} />
						</div>
						<p className="text-[15px] font-semibold text-[#1e293b]">No assessments scheduled</p>
						<p className="max-w-xs text-[13px] text-muted-foreground">
							Check back later when assessments have been scheduled for you.
						</p>
					</div>
				) : (
					<div className="space-y-8">
						{activeDates.map((date) => {
							const dayItems = grouped[date];
							const isToday = date === todayIso;
							const d = new Date(`${date}T00:00:00`);
							return (
								<div
									key={date}
									data-date={date}
									ref={(el) => { sectionRefs.current[date] = el; }}
									className="space-y-3"
								>
									{/* Day header */}
									<div className="flex items-center gap-3 sticky top-[42px] bg-[#f8f9fa]/95 backdrop-blur py-2 z-10">
										<div
											className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[13px] font-semibold transition-all ${isToday ? "bg-primary text-white" : "bg-white border border-border text-[#1e293b]"
												}`}
										>
											{d.getDate()}
										</div>
										<div className="flex flex-col">
											<span className="text-[12px] font-semibold text-[#1e293b]">
												{isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "long" })}
											</span>
											<span className="text-[11px] text-muted-foreground">
												{d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
											</span>
										</div>
										<div className="flex-1 h-px bg-border" />
										<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-white border border-border px-2 py-0.5 rounded-sm">
											{dayItems.length} item{dayItems.length !== 1 ? "s" : ""}
										</span>
									</div>

									{/* Day items */}
									<div className="grid gap-2">
										{dayItems.map((a) => (
											<AssessmentCard
												key={a.id}
												item={a}
												onClick={() => router.push(`/student/assessments/${a.id}`)}
											/>
										))}
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

function AssessmentCard({
	item: a,
	onClick,
}: {
	item: ScheduleItemSerialized;
	onClick: () => void;
}) {
	const isOngoing = a.status === "ongoing";
	const time = new Date(a.startsAt).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
	});
	const style = TYPE_BADGE[a.type] ?? { bg: "#f1f5f9", text: "#475569" };

	return (
		<button
			type="button"
			onClick={onClick}
			className="bg-white border border-border rounded-md w-full text-left p-4 flex items-center gap-4 transition-all duration-200 hover:bg-slate-50/60 hover:border-[#c7d0e0] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] group"
		>
			{/* Left stripe */}
			<div
				className="w-[3px] h-10 rounded-sm flex-shrink-0"
				style={{ background: isOngoing ? "#EF4444" : "#002388" }}
			/>

			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-1">
					<p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
						{a.courseCode}
					</p>
					<span
						className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider flex-shrink-0"
						style={{ background: style.bg, color: style.text }}
					>
						{a.type}
					</span>
					{isOngoing && (
						<span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-red-50 text-[9px] font-bold text-red-600 uppercase tracking-widest">
							<span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
							Live
						</span>
					)}
				</div>
				<p className="text-[13px] font-semibold text-[#1e293b] truncate group-hover:text-primary transition-colors">
					{a.title}
				</p>
			</div>

			<div className="flex flex-col items-end gap-1.5 shrink-0">
				<div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-slate-50 border border-border px-2.5 py-1 rounded-sm">
					<div className="flex items-center gap-1">
						<Clock size={11} className="text-slate-400" strokeWidth={2} />
						{time}
					</div>
					{a.durationMinutes && (
						<>
							<div className="w-px h-3 bg-slate-200" />
							<span>{formatDuration(a.durationMinutes)}</span>
						</>
					)}
				</div>
				{a.location && (
					<div className="flex items-center gap-1 text-[10px] text-muted-foreground">
						<MapPin size={10} strokeWidth={2} />
						{a.location}
					</div>
				)}
			</div>
		</button>
	);
}
