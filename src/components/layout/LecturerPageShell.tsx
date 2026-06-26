import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

interface LecturerPageShellProps {
	title: string;
	description?: string;
	icon?: LucideIcon;
	actions?: ReactNode;
	children: ReactNode;
	/** Override the last crumb label (defaults to title) */
	crumb?: string;
	/** Extra breadcrumb segments between "Lecturer" and the final crumb */
	parentCrumbs?: { label: string; href: string }[];
}

export default function LecturerPageShell({
	title,
	description,
	icon: Icon,
	actions,
	children,
	crumb,
	parentCrumbs,
}: LecturerPageShellProps) {
	return (
		<div className="bg-[#f8f9fa] dark:bg-[#0f1b2d] min-h-full flex flex-col">
			{/* Sticky command bar */}
			<div className="sticky top-0 z-10 bg-white dark:bg-[#192534] border-b border-border px-5 py-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-shrink-0">
				{Icon && <Icon size={11} />}
				<Link href="/lecturer" className="hover:text-[#1e293b] transition-colors">
					Lecturer
				</Link>
				{parentCrumbs?.map((c: any) => (
					<Fragment key={c.href}>
						<ChevronRight size={11} />
						<Link href={c.href} className="hover:text-[#1e293b] transition-colors">
							{c.label}
						</Link>
					</Fragment>
				))}
				<ChevronRight size={11} />
				<span className="text-[#002388] font-medium">{crumb ?? title}</span>
			</div>

			{/* Page content */}
			<div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<h1 className="text-xl font-semibold text-[#1e293b]">{title}</h1>
						{description && (
							<p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
								{description}
							</p>
						)}
					</div>
					{actions ? <div className="shrink-0">{actions}</div> : null}
				</div>
				{children}
			</div>
		</div>
	);
}
