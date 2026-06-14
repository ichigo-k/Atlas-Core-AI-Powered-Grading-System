import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface AdminPageShellProps {
	title: string;
	description: string;
	icon?: LucideIcon;
	actions?: ReactNode;
	children: ReactNode;
	eyebrow?: string;
}

export default function AdminPageShell({
	title,
	description,
	icon: Icon,
	actions,
	children,
	eyebrow = "Admin console",
}: AdminPageShellProps) {
	return (
		<div className="mx-auto w-full max-w-7xl space-y-6 pb-8">
			<header>
				<nav className="rounded-lg border border-slate-200 bg-white px-4 py-4 md:px-5">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div className="min-w-0">
							<div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
								<Link
									href="/admin"
									className="font-medium text-slate-500 transition-colors hover:text-slate-900"
								>
									Admin
								</Link>
								<ChevronRight size={15} className="text-slate-400" />
								<span className="font-semibold text-slate-900">{title}</span>
							</div>
							<div className="mt-3 flex min-w-0 items-start gap-3">
								{Icon ? (
									<div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#1967d2]">
										<Icon size={18} />
									</div>
								) : null}
								<div className="min-w-0">
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
										{eyebrow}
									</p>
									<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
										{title}
									</h1>
									<p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
										{description}
									</p>
								</div>
							</div>
						</div>
						{actions ? <div className="shrink-0">{actions}</div> : null}
					</div>
				</nav>
			</header>
			{children}
		</div>
	);
}
