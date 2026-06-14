"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, MapPin } from "lucide-react";

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
		[grouped, todayIso]
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
		[activeDates, grouped, todayIso]
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
			{ threshold: 0.4 }
		);
		for (const date of activeDates) {
			const el = sectionRefs.current[date];
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, [activeDates]);

	return (
		<div className="mx-auto max-w-6xl space-y-8 pb-12">
			<header className="flex flex-col gap-1">
				<h1 className="flex items-center gap-3 text-3xl font-black text-slate-900 tracking-tight">
					<CalendarDays className="text-discord-blurple" size={32} strokeWidth={2.5} />
					Schedule
				</h1>
				<p className="text-slate-500 font-medium">
					{activeDates.length > 0
						? `Stay ahead of your next ${activeDates.length} assessment days.`
						: "Your schedule is currently clear."}
				</p>
			</header>

			{pills.length > 0 && (
				<div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
					{pills.map((p) => (
						<button
							key={p.iso}
							onClick={() => handlePillClick(p.iso)}
							className={`flex flex-col items-center min-w-[64px] gap-1 rounded-2xl p-3 transition-all active:scale-95 ${
								activePill === p.iso
									? "bg-discord-blurple text-white shadow-xl shadow-discord-blurple/20"
									: p.isToday
									? "bg-discord-blurple/10 text-discord-blurple"
									: "bg-white text-slate-500 hover:bg-slate-50"
							}`}
						>
							<span className="text-[10px] font-black uppercase tracking-widest leading-none">{p.weekday}</span>
							<span className="text-xl font-black leading-none mt-1">{p.day}</span>
							{p.count > 0 && (
								<div className={`w-1 h-1 rounded-full mt-1.5 ${activePill === p.iso ? "bg-white" : "bg-discord-blurple"}`} />
							)}
						</button>
					))}
				</div>
			)}

			{activeDates.length === 0 ? (
				<div className="discord-card py-24 flex flex-col items-center justify-center text-center">
					<div className="bg-slate-100 p-6 rounded-full mb-4">
						<CalendarDays size={40} className="text-slate-300" strokeWidth={3} />
					</div>
					<h3 className="text-xl font-black text-slate-900">No assessments found</h3>
					<p className="mt-1 text-slate-500 font-bold max-w-xs">
						Check back later when assessments have been scheduled for you.
					</p>
				</div>
			) : (
				<div className="space-y-12">
					{activeDates.map((date) => {
						const dayItems = grouped[date];
						const isToday = date === todayIso;
						const d = new Date(`${date}T00:00:00`);
						return (
							<div
								key={date}
								data-date={date}
								ref={(el) => { sectionRefs.current[date] = el; }}
								className="space-y-4"
							>
								<div className="flex items-center gap-4 sticky top-0 bg-white/80 backdrop-blur py-2 z-10 -mx-4 px-4 sm:mx-0 sm:px-0">
									<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black transition-all ${
										isToday ? "bg-discord-blurple text-white shadow-lg shadow-discord-blurple/20" : "bg-slate-100 text-slate-500"
									}`}>
										{d.getDate()}
									</div>
									<div className="flex flex-col">
										<span className="text-sm font-black text-slate-900 uppercase tracking-tight">
											{isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "long" })}
										</span>
										<span className="text-xs font-bold text-slate-400">
											{d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
										</span>
									</div>
									<div className="flex-1 h-px bg-slate-100" />
									<span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
										{dayItems.length}
									</span>
								</div>
								<div className="grid gap-3">
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

	return (
		<button
			type="button"
			onClick={onClick}
			className="discord-card w-full text-left p-4 flex items-center gap-5 transition-all hover:border-discord-blurple/30 hover:bg-slate-50/50 group active:scale-[0.99]"
		>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-1">
					<p className="text-xs font-bold text-slate-400 uppercase tracking-tight truncate">{a.courseCode}</p>
					{isOngoing && (
						<span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FEE7E9] text-[10px] font-black text-[#F23F42] uppercase tracking-widest">
							<span className="h-1.5 w-1.5 rounded-full bg-[#F23F42] animate-pulse" />
							Live
						</span>
					)}
				</div>
				<p className="text-lg font-black text-slate-900 truncate group-hover:text-discord-blurple transition-colors">{a.title}</p>
			</div>

			<div className="flex flex-col items-end gap-2 shrink-0">
				<div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
					<div className="flex items-center gap-1.5">
						<Clock size={14} className="text-slate-400" strokeWidth={2.5} />
						{time}
					</div>
					{a.durationMinutes && (
						<>
							<div className="w-1 h-1 rounded-full bg-slate-300" />
							<span>{formatDuration(a.durationMinutes)}</span>
						</>
					)}
				</div>
				{a.location && (
					<div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
						<MapPin size={12} strokeWidth={2.5} />
						{a.location}
					</div>
				)}
			</div>
		</button>
	);
}
