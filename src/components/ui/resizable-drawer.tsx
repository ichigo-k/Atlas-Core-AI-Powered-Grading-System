"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ResizableDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	/** Initial height as a percentage of viewport height. */
	defaultHeight?: number;
	minHeight?: number;
	maxHeight?: number;
}

export function ResizableDrawer({
	open,
	onOpenChange,
	children,
	defaultHeight = 62,
	minHeight = 32,
	maxHeight = 96,
}: ResizableDrawerProps) {
	const [height, setHeight] = useState(defaultHeight);
	const [isDragging, setIsDragging] = useState(false);
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	useEffect(() => {
		if (open) setHeight(defaultHeight);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	useEffect(() => {
		if (!open) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onOpenChange(false);
		}
		document.addEventListener("keydown", onKeyDown);
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = "";
		};
	}, [open, onOpenChange]);

	const startDrag = useCallback(
		(clientY: number) => {
			setIsDragging(true);
			const startY = clientY;
			const startHeight = height;

			function onMove(e: MouseEvent | TouchEvent) {
				const y = "touches" in e ? e.touches[0].clientY : e.clientY;
				const deltaVh = ((startY - y) / window.innerHeight) * 100;
				const next = Math.min(maxHeight, Math.max(minHeight, startHeight + deltaVh));
				setHeight(next);
			}
			function onUp() {
				setIsDragging(false);
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
				window.removeEventListener("touchmove", onMove);
				window.removeEventListener("touchend", onUp);
			}
			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
			window.addEventListener("touchmove", onMove, { passive: false });
			window.addEventListener("touchend", onUp);
		},
		[height, minHeight, maxHeight],
	);

	if (!mounted || !open) return null;

	return createPortal(
		<div className="fixed inset-0 z-50">
			<div
				className="absolute inset-0 bg-black/40 animate-in fade-in duration-150"
				onClick={() => onOpenChange(false)}
			/>
			<div
				className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-xl border-t border-border bg-white shadow-2xl ${
					isDragging ? "" : "transition-[height] duration-200 ease-out"
				}`}
				style={{ height: `${height}vh` }}
			>
				<div className="relative shrink-0">
					<div
						className="flex items-center justify-center py-2.5 cursor-grab touch-none select-none active:cursor-grabbing"
						onMouseDown={(e) => startDrag(e.clientY)}
						onTouchStart={(e) => startDrag(e.touches[0].clientY)}
					>
						<div className="h-1.5 w-12 rounded-full bg-slate-300" />
					</div>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						aria-label="Close"
						className="absolute right-4 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
					>
						<X size={17} />
					</button>
				</div>
				<div className="flex-1 min-h-0 flex flex-col">{children}</div>
			</div>
		</div>,
		document.body,
	);
}
