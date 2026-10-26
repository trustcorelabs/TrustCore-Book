"use client";
import { useState } from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Search, ArrowUpDown } from "lucide-react";
import { EmptyState } from "./ui/empty-state";
import { StatusBadge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function DataTable({
  columns,
  rows,
  emptyTitle,
  emptyDescription,
}: {
  columns: { key: string; label: string; hrefKey?: string }[];
  rows: Record<string, string>[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  // TanStack Table owns mutable state; keep this component outside compiler memoization.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: columns.map((c) => ({ accessorKey: c.key, header: c.label })),
    state: { globalFilter: filter, sorting },
    onGlobalFilterChange: setFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  const content = (
    key: string,
    value: unknown,
    original: Record<string, string>,
  ) => {
    const hrefKey = columns.find((c) => c.key === key)?.hrefKey;
    const href = hrefKey ? original[hrefKey] : undefined;
    return href?.startsWith("/app/") ? (
      <Link
        className="font-semibold text-primary-ink underline-offset-4 hover:underline"
        href={href}
      >
        {String(value)}
      </Link>
    ) : (
      String(value)
    );
  };
  if (!rows.length)
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="surface min-w-0 overflow-hidden">
      <div className="relative m-5 max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search records"
          className="pl-9"
          placeholder="Search records…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="divide-y divide-border sm:hidden">
        {table.getRowModel().rows.map((row) => (
          <article key={row.id} className="p-5">
            <dl className="space-y-3">
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {String(cell.column.columnDef.header)}
                  </dt>
                  <dd className="mt-1 break-words text-sm">
                    <span
                      className={
                        cell.column.id === "name" ? "font-semibold" : undefined
                      }
                    >
                      {content(cell.column.id, cell.getValue(), row.original)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-background text-[11px] uppercase tracking-wide text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-5 py-4"
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                  >
                    <button
                      className="relative flex items-center gap-2"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      <ArrowUpDown size={12} />
                      <span className="sr-only">
                        Sort {String(header.column.columnDef.header)}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-border transition-colors hover:bg-background"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-5 py-4">
                    {cell.column.id === "status" ? (
                      <StatusBadge status={String(cell.getValue())} />
                    ) : cell.column.id === "name" ? (
                      <span className="flex items-center gap-3 font-semibold">
                        <span
                          aria-hidden="true"
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-soft text-xs font-bold text-amber-ink"
                        >
                          {String(cell.getValue())
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        {content(cell.column.id, cell.getValue(), row.original)}
                      </span>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!table.getRowModel().rows.length && (
          <p
            role="status"
            className="p-8 text-center text-sm text-muted-foreground"
          >
            No matching records.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border p-4">
        <p className="text-xs text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {Math.max(1, table.getPageCount())}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
