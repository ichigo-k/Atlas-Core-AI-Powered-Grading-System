import type { LucideIcon } from "lucide-react";
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
}: AdminPageShellProps) {
	return (
		<div className="px-4 py-5 md:px-6 lg:px-8 max-w-[1280px] space-y-5 pb-12">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
						{Icon ? <Icon size={11} /> : null}
						<Link href="/admin" className="hover:text-[#1e293b] transition-colors">
							Admin
						</Link>
						<span>›</span>
						<span>{title}</span>
					</div>
					<h1 className="text-xl font-semibold text-[#1e293b]">{title}</h1>
					<p className="text-[12px] text-muted-foreground mt-0.5 max-w-3xl">
						{description}
					</p>
				</div>
				{actions ? <div className="shrink-0">{actions}</div> : null}
			</div>
			{children}
		</div>
	);
}
