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
	status: "upcoming" | "ongoing" | "completed";
};

function formatDuration(minutes: number | null): string {
	if (!minutes) return "";
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

function getRelativeLabel(isoDate: string, todayIso: string): string {
	const diff = Math.round(
		(new Date(isoDate).setHours(0, 0, 0, 0) - new Date(todayIso).setHours(0, 0, 0, 0)) / 86400000
	);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff > 1) return `In ${diff} days`;
	return `${Math.abs(diff)} days ago`;
}

function toDateKey(iso: string): string {
	return iso.slice(0, 10);
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
			const key = toDateKey(a.startsAt);
			if (!map[key]) map[key] = [];
			map[key].push(a);
		}
		return map;
	}, [items]);

	const activeDates = useMemo(
		() => Object.keys(grouped).filter((d) => d >= todayIso).sort().slice(0, 7),
		[grouped, todayIso]
	);

	const pills = useMemo(
		() => activeDates.map((iso) => {
			const d = new Date(`${iso}T00:00:00`);
			return {
				iso,
				isToday: iso === todayIso,
				monthDay: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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
		<div className="mx-auto max-w-6xl pb-8">
			<div className="pt-4 pb-6 mb-6 space-y-4">
				<header className="flex flex-col gap-0.5">
					<h1 className="flex items-center gap-2 text-[22px] font-normal text-[#202124]">
						<CalendarDays className="text-[#1a73e8]" size={24} />
						Schedule
					</h1>
					<p className="text-sm text-[#5f6368]">
						{activeDates.length > 0
							? `Your next ${activeDates.length} assessment day${activeDates.length !== 1 ? "s" : ""}, at a glance.`
							: "No upcoming assessments scheduled."}
					</p>
				</header>

				{pills.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{pills.map((p) => (
							<button
								key={p.iso}
								onClick={() => handlePillClick(p.iso)}
								className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all border ${
									activePill === p.iso
										? "bg-[#1a73e8] border-[#1a73e8] text-white shadow-sm"
										: p.isToday
										? "bg-[#e8f0fe] border-[#c5d8fd] text-[#1a73e8]"
										: "bg-white border-[#dadce0] text-[#5f6368] hover:border-[#bdc1c6] hover:text-[#202124]"
								}`}
							>
								<span>{p.isToday ? "Today" : `${p.monthDay} · ${p.weekday}`}</span>
								<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
									activePill === p.iso
										? "bg-white/20 text-white"
										: p.isToday
										? "bg-[#c5d8fd] text-[#1a73e8]"
										: "bg-[#f8f9fa] text-[#5f6368]"
								}`}>
									{p.count}
								</span>
							</button>
						))}
					</div>
				)}
			</div>

			{activeDates.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#dadce0] bg-white py-20 text-center shadow-sm">
					<CalendarDays size={28} className="text-[#bdc1c6] mb-3" />
					<p className="text-sm font-medium text-[#5f6368]">No upcoming assessments</p>
					<p className="text-xs text-[#80868b] mt-1">Check back later for new assessments.</p>
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
							>
								<div className="flex items-center gap-3 mb-3">
									<div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
										isToday ? "bg-[#1a73e8] text-white" : "bg-[#f8f9fa] text-[#5f6368]"
									}`}>
										{d.getDate()}
									</div>
									<div className="flex items-baseline gap-2">
										<span className="text-sm font-medium text-[#202124]">
											{isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
										</span>
										<span className="text-xs text-[#80868b]">{getRelativeLabel(date, todayIso)}</span>
									</div>
									<div className="flex-1 h-px bg-[#dadce0]" />
									<span className="text-xs text-[#80868b]">{dayItems.length} assessment{dayItems.length !== 1 ? "s" : ""}</span>
								</div>
								<div className="pl-11 space-y-2">
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
			className="w-full text-left bg-white rounded-lg border border-[#dadce0] hover:border-[#1a73e8] hover:shadow-sm transition-all"
		>
			<div className="flex items-center gap-4 px-4 py-3">
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-[#202124] truncate">{a.title}</p>
					<p className="text-xs text-[#80868b] truncate mt-0.5">
						<span className="font-medium text-[#5f6368]">{a.courseCode}</span>
						{" · "}{a.courseTitle}
					</p>
				</div>

				{isOngoing && (
					<span className="shrink-0 flex items-center gap-1 rounded-full bg-[#fce8e6] border border-[#f5c6c2] px-2.5 py-0.5 text-[10px] font-bold text-[#c5221f] uppercase tracking-wider">
						<span className="h-1.5 w-1.5 rounded-full bg-[#ea4335] animate-pulse" />
						Live
					</span>
				)}

				<div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-[#80868b]">
					<span className="flex items-center gap-1">
						<Clock size={11} />
						{time}{a.durationMinutes ? ` · ${formatDuration(a.durationMinutes)}` : ""}
					</span>
					{a.location && (
						<span className="flex items-center gap-1">
							<MapPin size={11} />
							{a.location}
						</span>
					)}
				</div>
			</div>
		</button>
	);
}
