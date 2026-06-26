"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, User, GraduationCap, Award, ChevronRight } from "lucide-react"
import { toast } from "sonner"

type StudentSearchResult = {
    id: number
    name: string
    email: string
    indexNumber: string | null
    program: string | null
    className: string | null
    classLevel: number | null
}

export default function StudentHistoryLookup() {
    const router = useRouter()
    const [query, setQuery] = useState("")
    const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([])
    const [searching, setSearching] = useState(false)

    const handleSearch = useCallback(async (q: string) => {
        setQuery(q)
        if (q.trim().length < 2) {
            setSearchResults([])
            return
        }
        setSearching(true)
        try {
            const res = await fetch(`/api/admin/student-history/search?q=${encodeURIComponent(q.trim())}`)
            if (!res.ok) throw new Error("Search failed")
            const data = await res.json()
            setSearchResults(data.students ?? [])
        } catch {
            toast.error("Failed to search students")
            setSearchResults([])
        } finally {
            setSearching(false)
        }
    }, [])

    function navigateToStudent(studentId: number) {
        router.push(`/admin/student-history/${studentId}`)
    }

    return (
        <div className="space-y-6">
            {/* Search bar */}
            <div className="relative">
                <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search by student name, email, or index number..."
                        className="w-full rounded-sm border border-border bg-white py-2.5 pl-10 pr-4 text-[13px] placeholder:text-slate-400 focus:border-[#002388] focus:outline-none focus:ring-2 focus:ring-[#002388]/10"
                    />
                    {searching && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#002388]" />
                        </div>
                    )}
                </div>

                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                    <div className="absolute z-10 mt-1.5 w-full rounded-sm border border-border bg-white shadow-lg overflow-hidden">
                        <div className="px-4 py-2 bg-[#fafaf9] border-b border-border">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        {searchResults.map((s: any) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => navigateToStudent(s.id)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f8f9fa] transition-colors border-b border-[#f1f5f9] last:border-b-0 group"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbeafe] text-[#002388] shrink-0">
                                    <User size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1e293b] truncate">{s.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {s.indexNumber && <span className="mr-2 font-medium">{s.indexNumber}</span>}
                                        {s.email}
                                    </p>
                                </div>
                                <div className="shrink-0 flex items-center gap-2">
                                    {s.className && (
                                        <span className="text-[10px] font-semibold text-muted-foreground bg-slate-100 border border-border px-2 py-0.5 rounded-sm">
                                            {s.className} L{s.classLevel}
                                        </span>
                                    )}
                                    <ChevronRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Empty state */}
            <div className="rounded-sm border border-border bg-white px-6 py-16 text-center">
                <Award size={40} className="mx-auto text-[#c8c6c4]" />
                <p className="mt-4 text-[14px] font-semibold text-[#1e293b]">Search for a student</p>
                <p className="mt-1.5 text-[12px] text-muted-foreground max-w-sm mx-auto">
                    Enter a name, email, or index number above to view their complete assessment history across all courses.
                </p>
            </div>
        </div>
    )
}
