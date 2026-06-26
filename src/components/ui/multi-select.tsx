"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
}: {
  options: { label: string; value: string | number }[];
  selected: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  placeholder?: string;
  className?: string;
}) {
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
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto z-[100]">
        {options.map((option: any) => (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
