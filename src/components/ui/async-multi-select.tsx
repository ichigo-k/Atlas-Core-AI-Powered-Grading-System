"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AsyncOption = { id: string | number; label: string; sublabel?: string };

/**
 * Multi-select that fetches options from `searchUrl?q=...` as the user types,
 * instead of rendering a full in-memory list. Keeps this usable when the
 * underlying table has hundreds of rows (lecturers, classes, etc.).
 */
export function AsyncMultiSelect({
  searchUrl,
  selected,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Type to search...",
  className,
}: {
  searchUrl: string;
  selected: AsyncOption[];
  onChange: (values: AsyncOption[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<AsyncOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const query = search.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${searchUrl}?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          const list: AsyncOption[] = data.lecturers ?? data.classes ?? data.results ?? [];
          setResults(list);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, search, searchUrl]);

  const selectedIds = new Set(selected.map((s) => String(s.id)));

  const handleToggle = (option: AsyncOption) => {
    if (selectedIds.has(String(option.id))) {
      onChange(selected.filter((s) => String(s.id) !== String(option.id)));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between h-auto min-h-11 py-2 px-3 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white transition-all text-left",
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 items-center overflow-hidden">
            {selected.length > 0 ? (
              selected.map((o) => (
                <Badge
                  key={o.id}
                  variant="secondary"
                  className="bg-[#002388]/10 text-[#002388] border-none hover:bg-[#002388]/20 text-[10px] py-0 px-1.5 h-5 flex items-center gap-1 max-w-[180px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(o);
                  }}
                >
                  <span className="truncate">{o.label}</span>
                  <X className="h-2.5 w-2.5 shrink-0" />
                </Badge>
              ))
            ) : (
              <span className="text-slate-400 font-normal text-sm">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] p-0 z-[100]">
        <div className="p-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 rounded-md border-slate-200 text-xs"
            />
          </div>
        </div>
        <div className="max-h-52 overflow-y-auto p-1">
          {loading && (
            <div className="flex items-center justify-center gap-2 p-3 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-2 text-xs text-slate-500 text-center">
              {search.trim()
                ? `No matches for "${search}"`
                : "Start typing to search"}
            </div>
          )}
          {!loading &&
            results.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={selectedIds.has(String(option.id))}
                onCheckedChange={() => handleToggle(option)}
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{option.label}</span>
                  {option.sublabel && (
                    <span className="truncate text-[10px] text-slate-400">
                      {option.sublabel}
                    </span>
                  )}
                </div>
              </DropdownMenuCheckboxItem>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
