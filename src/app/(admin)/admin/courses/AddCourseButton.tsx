"use client";

import { BookPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function AddCourseButton() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const handleClick = () => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("add", "true");
		router.push(`${pathname}?${params.toString()}`);
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			className="flex items-center gap-2 rounded-sm bg-[#002388] px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#001570]"
		>
			<BookPlus size={18} />
			Add New Course
		</button>
	);
}
