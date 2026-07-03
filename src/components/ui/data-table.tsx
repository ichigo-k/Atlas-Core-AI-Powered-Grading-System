"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SlidersHorizontal,
  Monitor,
  X
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  placeholder?: string
  onRowClick?: (row: TData) => void
  toolbarActions?: React.ReactNode
  /** Adds a checkbox column and drives an Azure/AWS-style command bar — selection
   *  is reported to the parent so it can enable/disable toolbarActions buttons
   *  instead of falling back to a per-row dropdown menu. */
  enableSelection?: boolean
  getRowId?: (row: TData) => string | number
  onSelectionChange?: (rows: TData[]) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  placeholder = "Search...",
  onRowClick,
  toolbarActions,
  enableSelection = false,
  getRowId,
  onSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const tableColumns = React.useMemo(() => {
    if (!enableSelection) return columns
    const selectColumn: ColumnDef<TData, TValue> = {
      id: "select",
      size: 40,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
    }
    return [selectColumn, ...columns]
  }, [columns, enableSelection])

  const table = useReactTable({
    data,
    columns: tableColumns,
    getRowId: getRowId ? (row) => String(getRowId(row)) : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  const isMobile = useIsMobile()
  const searchValue = (table.getColumn(searchKey || "")?.getFilterValue() as string) ?? ""
  const selectedRows = table.getSelectedRowModel().rows as Row<TData>[]

  React.useEffect(() => {
    if (!enableSelection) return
    onSelectionChange?.(selectedRows.map((r) => r.original))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-colors group-focus-within:text-[#002388]" />
            <Input
              placeholder={placeholder}
              value={searchValue}
              onChange={(event) =>
                table.getColumn(searchKey || "")?.setFilterValue(event.target.value)
              }
              className="pl-9 pr-9 h-10 rounded-sm border-border focus-visible:ring-primary focus-visible:border-primary text-[12px]"
            />
            {searchValue ? (
              <button
                type="button"
                onClick={() => table.getColumn(searchKey || "")?.setFilterValue("")}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
          {enableSelection && selectedRows.length > 0 && (
            <div className="flex items-center gap-2 rounded-sm bg-[#eef3ff] border border-[#002388]/15 px-3 h-10 text-[12px] font-semibold text-[#002388] shrink-0">
              {selectedRows.length} selected
              <button
                type="button"
                onClick={() => table.resetRowSelection()}
                className="text-[#002388]/60 hover:text-[#002388] transition-colors"
                aria-label="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {toolbarActions}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto h-10 gap-2 rounded-sm border-border text-[#323130] font-semibold text-[11px] uppercase tracking-wider hover:bg-slate-50">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px] rounded-sm">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column: any) => column.getCanHide())
                .map((column: any) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-xs font-medium"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isMobile ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-white py-16 px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-primary">
            <Monitor size={24} />
          </div>
          <p className="text-[14px] font-semibold text-[#1e293b]">Desktop Required</p>
          <p className="mt-2 text-[12px] text-muted-foreground max-w-[280px]">
            This table is best viewed on a desktop. Please switch to a larger screen.
          </p>
        </div>
      ) : (
        <div className="rounded-sm border border-border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup: any) => (
                <TableRow key={headerGroup.id} className="bg-slate-50/80 hover:bg-slate-50/80 border-b border-border">
                  {headerGroup.headers.map((header: any) => (
                    <TableHead key={header.id} className="h-11 px-5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row: any) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`group hover:bg-slate-50/60 transition-colors border-b border-[#f1f5f9] last:border-0 ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell: any) => (
                      <TableCell key={cell.id} className="px-5 py-3.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-[13px] text-muted-foreground">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination — inside the card */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border bg-slate-50/50 px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rows</span>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => table.setPageSize(Number(value))}
                >
                  <SelectTrigger className="h-8 w-16 rounded-sm border-border text-[11px] font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top" className="rounded-sm">
                    {[10, 20, 30, 40, 50].map((pageSize: any) => (
                      <SelectItem key={pageSize} value={`${pageSize}`} className="text-[11px] font-medium">{pageSize}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-border" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-border" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-border" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-8 w-8 p-0 rounded-sm border-border" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
