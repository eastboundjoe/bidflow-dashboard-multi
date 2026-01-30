"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, Download, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlacementBadge } from "@/components/placement-badge";
import type { PlacementData } from "@/types";

interface PlacementDataTableProps {
  data: PlacementData[];
  onExport?: () => void;
  onEdit?: (id: string, value: string) => void;
  onSubmit?: () => void;
  submitting?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);

const formatPercent = (value: number) =>
  `${value.toFixed(2)}%`;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

export function PlacementDataTable({ 
  data, 
  onExport,
  onEdit,
  onSubmit,
  submitting = false
}: PlacementDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "spend", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
        // Hide some 7d columns by default to reduce clutter
        clicks_7d: false,
        spend_7d: false,
        orders_7d: false,
        cvr_7d: false,
        acos_7d: false,
        spent_db_yesterday: false,
    });
  const [globalFilter, setGlobalFilter] = React.useState("");

  const columns = React.useMemo<ColumnDef<PlacementData>[]>(
    () => [
      {
        accessorKey: "campaign_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Campaign
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="max-w-[150px] truncate font-medium text-xs" title={row.getValue("campaign_name")}>
            {row.getValue("campaign_name")}
          </div>
        ),
      },
      {
        accessorKey: "portfolio_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Portfolio
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-muted-foreground text-xs max-w-[100px] truncate" title={row.getValue("portfolio_name") || ""}>
            {row.getValue("portfolio_name") || "—"}
          </div>
        ),
      },
      {
        accessorKey: "campaign_budget",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Budget
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
            const val = row.getValue("campaign_budget") as number | null;
            return <div className="text-right font-mono tabular-nums text-xs">{val ? `$${val}` : "-"}</div>;
        }
      },
      {
        accessorKey: "clicks",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Clicks<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {formatNumber(row.getValue("clicks"))}
          </div>
        ),
      },
      {
        accessorKey: "spend",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Spend<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-primary text-xs">
            {formatCurrency(row.getValue("spend"))}
          </div>
        ),
      },
      {
        accessorKey: "orders",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Orders<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {row.getValue("orders")}
          </div>
        ),
      },
      {
        accessorKey: "cvr",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            CVR<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {formatPercent(row.getValue("cvr"))}
          </div>
        ),
      },
      {
        accessorKey: "acos",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            ACoS<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const acos = row.getValue("acos") as number;
          const colorClass =
            acos < 20
              ? "text-green-400"
              : acos < 35
              ? "text-yellow-400"
              : "text-red-400";
          return (
            <div className={`text-right font-mono tabular-nums text-xs ${colorClass}`}>
              {formatPercent(acos)}
            </div>
          );
        },
      },
      // 7 Day Metrics
      {
        accessorKey: "clicks_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Clicks<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {formatNumber(row.getValue("clicks_7d"))}
          </div>
        ),
      },
      {
        accessorKey: "spend_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Spend<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {formatCurrency(row.getValue("spend_7d"))}
          </div>
        ),
      },
      {
        accessorKey: "orders_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Orders<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {row.getValue("orders_7d")}
          </div>
        ),
      },
      {
        accessorKey: "cvr_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            CVR<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {formatPercent(row.getValue("cvr_7d"))}
          </div>
        ),
      },
      {
        accessorKey: "acos_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            ACoS<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const acos = row.getValue("acos_7d") as number;
          const colorClass =
            acos < 20
              ? "text-green-400"
              : acos < 35
              ? "text-yellow-400"
              : "text-red-400";
          return (
            <div className={`text-right font-mono tabular-nums text-xs ${colorClass}`}>
              {formatPercent(acos)}
            </div>
          );
        },
      },
      // Spend Timing
      {
        accessorKey: "spent_db_yesterday",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            DB<br/>Yest
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {formatCurrency(row.getValue("spent_db_yesterday"))}
          </div>
        ),
      },
      {
        accessorKey: "spent_yesterday",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Spent<br/>Yest
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {formatCurrency(row.getValue("spent_yesterday"))}
          </div>
        ),
      },
      // Impression Shares
      {
        accessorKey: "impression_share_30d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            LAST<br/>30D
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {row.getValue("impression_share_30d")}
          </div>
        ),
      },
      {
        accessorKey: "impression_share_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            LAST<br/>7D
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {row.getValue("impression_share_7d")}
          </div>
        ),
      },
      {
        accessorKey: "impression_share_yesterday",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            YEST
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono tabular-nums text-xs">
            {row.getValue("impression_share_yesterday")}
          </div>
        ),
      },
      {
        accessorKey: "placement_type",
        header: "Placement",
        cell: ({ row }) => {
          const placement = row.getValue("placement_type") as string;
          return <PlacementBadge placement={placement} />;
        },
      },
      {
        accessorKey: "bid_adjustment",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2"
          >
            Multiplier
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const adjustment = row.getValue("bid_adjustment") as number;
          return (
            <div className="text-right font-mono tabular-nums text-xs">
              {adjustment > 0 ? `+${adjustment}%` : `${adjustment}%`}
            </div>
          );
        },
      },
      {
        accessorKey: "changes_in_placement",
        header: ({ column }) => (
           <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="font-mono text-xs uppercase tracking-wider h-8 px-2 text-primary"
          >
            Changes
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
            const val = row.getValue("changes_in_placement") as string;
            return (
                <Input 
                    className="h-7 w-20 text-xs text-right" 
                    value={val}
                    onChange={(e) => onEdit?.(row.original.id, e.target.value)}
                />
            )
        }
      }
    ],
    [onEdit]
  );

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search campaigns..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm bg-background"
        />
        <div className="flex items-center gap-2">
          {onSubmit && (
              <Button onClick={onSubmit} disabled={submitting} className="gap-2">
                  {submitting ? (
                      "Submitting..."
                  ) : (
                      <>
                        <Rocket className="h-4 w-4" />
                        Submit to Amazon
                      </>
                  )}
              </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 h-96 overflow-y-auto">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id.replace(/_/g, " ")}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/50">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border/50 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-card/50 px-2 h-10">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-border/50 hover:bg-card/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2 py-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="text-muted-foreground">
                    No placement data found.
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} results
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}