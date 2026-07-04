"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
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

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  className,
}: {
  options: { label: string; value: string | number }[];
  selected: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [search, setSearch] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query));
  }, [options, search]);

  const handleToggle = (value: string | number) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v: any) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between h-auto min-h-11 py-2 px-3 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white transition-all text-left",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 items-center overflow-hidden">
            {selected.length > 0 ? (
              options
                .filter((o: any) => selected.includes(o.value))
                .map((o: any) => (
                  <Badge
                    key={o.value}
                    variant="secondary"
                    className="bg-[#002388]/10 text-[#002388] border-none hover:bg-[#002388]/20 text-[10px] py-0 px-1.5 h-5 flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(o.value);
                    }}
                  >
                    {o.label}
                    <X className="h-2.5 w-2.5" />
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
        {options.length > 5 && (
          <div className="p-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="h-8 pl-8 rounded-md border-slate-200 text-xs"
              />
            </div>
          </div>
        )}
        <div className="max-h-52 overflow-y-auto p-1">
          {filteredOptions.map((option: any) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.includes(option.value)}
              onCheckedChange={() => handleToggle(option.value)}
              onSelect={(e) => e.preventDefault()}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {options.length === 0 && (
            <div className="p-2 text-xs text-slate-500 text-center">No options available</div>
          )}
          {options.length > 0 && filteredOptions.length === 0 && (
            <div className="p-2 text-xs text-slate-500 text-center">No matches for "{search}"</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
