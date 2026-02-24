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
import { cn } from "@/lib/utils";
import type { PlacementData } from "@/types";

interface PlacementDataTableProps {
  data: PlacementData[];
  onExport?: () => void;
  onEdit?: (id: string, value: string) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  onNoteEdit?: (campaignId: string, weekId: string, placementType: string, note: string) => void;
  onGoalToggle?: (campaignId: string, weekId: string, placementType: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPercent = (value: number) =>
  `${value.toFixed(1)}%`;

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

// Sub-component for editable changes with focus preservation and Bezos warning
function ChangesInput({
    id,
    initialValue,
    isSubmitted,
    onEdit
}: {
    id: string;
    initialValue: string;
    isSubmitted?: boolean;
    onEdit?: (id: string, value: string) => void
}) {
    const [localValue, setLocalValue] = React.useState(initialValue);
    const [showWarning, setShowWarning] = React.useState(false);

    React.useEffect(() => {
        setLocalValue(initialValue);
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        const num = parseFloat(val);
        setShowWarning(!isNaN(num) && num > 900);
    };

    const handleBlur = () => {
        if (localValue !== initialValue) {
            onEdit?.(id, localValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onEdit?.(id, localValue);
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <div className="relative group" onClick={(e) => e.stopPropagation()}>
            <Input
                className={cn(
                    "h-7 w-20 text-xs text-right transition-colors font-bold",
                    isSubmitted && localValue !== "" && "border-orange-500 bg-orange-50/50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
                    !isSubmitted && localValue !== "" && "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20",
                    showWarning && "border-red-500 animate-pulse"
                )}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onFocus={(e) => {
                    e.stopPropagation();
                    e.target.select();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            />
            {showWarning && (
                <div className="absolute bottom-full right-0 mb-2 z-50 bg-red-600 text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap animate-bounce pointer-events-none">
                    💸 DANGER! YOU ARE BUYING BEZOS ANOTHER YACHT! 🛥️
                </div>
            )}
        </div>
    );
}

// Sub-component for per-row notes (auto-save on blur)
function NoteInput({
  initialValue, campaignId, weekId, placementType, onNoteEdit,
}: {
  initialValue: string;
  campaignId: string;
  weekId: string;
  placementType: string;
  onNoteEdit?: (campaignId: string, weekId: string, placementType: string, note: string) => void;
}) {
  const [localValue, setLocalValue] = React.useState(initialValue);
  React.useEffect(() => { setLocalValue(initialValue); }, [initialValue]);

  const save = () => {
    if (localValue !== initialValue) {
      onNoteEdit?.(campaignId, weekId, placementType, localValue);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Input
        className="h-7 w-28 text-xs"
        value={localValue}
        placeholder="Add note..."
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") { save(); (e.target as HTMLInputElement).blur(); } }}
        onFocus={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// Sub-component for goal toggle: null (—) → true (✓ Yes) → false (✗ No) → null
function GoalToggle({
  value, campaignId, weekId, placementType, onGoalToggle,
}: {
  value: boolean | null;
  campaignId: string;
  weekId: string;
  placementType: string;
  onGoalToggle?: (campaignId: string, weekId: string, placementType: string) => void;
}) {
  return (
    <button
      className={cn(
        "h-6 w-14 text-xs font-bold rounded border transition-colors",
        value === true && "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-400 dark:border-green-700",
        value === false && "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700",
        value === null && "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
      )}
      onClick={(e) => { e.stopPropagation(); onGoalToggle?.(campaignId, weekId, placementType); }}
    >
      {value === true ? "✓ Yes" : value === false ? "✗ No" : "—"}
    </button>
  );
}

export function PlacementDataTable({
  data,
  onExport,
  onEdit,
  onSubmit,
  submitting = false,
  onNoteEdit,
  onGoalToggle,
}: PlacementDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "campaign_name", desc: false },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      roas: false,
      roas_7d: false,
    });
  const [globalFilter, setGlobalFilter] = React.useState("");
  
  // State for expanding campaign names and placement badges
  const [expandedCampaigns, setExpandedCampaigns] = React.useState<Set<string>>(new Set());
  const [isPlacementsExpanded, setIsPlacementsExpanded] = React.useState(false);

  const toggleCampaign = (id: string) => {
    const next = new Set(expandedCampaigns);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCampaigns(next);
  };

  // Custom sort: Campaign Name ASC, then Placement Type (TOP > ROS > PP)
  const sortedData = React.useMemo(() => {
    return [...data].sort((a, b) => {
        // First sort by Campaign Name
        const campComp = a.campaign_name.localeCompare(b.campaign_name);
        if (campComp !== 0) return campComp;

        // Then by Placement Type order
        const getOrder = (p: string) => {
            const lower = p.toLowerCase();
            if (lower.includes("top")) return 1;
            if (lower.includes("rest")) return 2;
            if (lower.includes("product")) return 3;
            return 4;
        };
        return getOrder(a.placement_type) - getOrder(b.placement_type);
    });
  }, [data]);

  const columns = React.useMemo<ColumnDef<PlacementData>[]>(
    () => [
      {
        accessorKey: "campaign_name",
        size: 138,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Campaign
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
            const name = row.getValue("campaign_name") as string;
            const isExpanded = expandedCampaigns.has(row.original.campaign_id || row.original.id);
            return (
                <div 
                    className={cn(
                        "cursor-pointer font-medium text-xs transition-all",
                        !isExpanded && "max-w-[150px] truncate",
                        isExpanded && "whitespace-normal break-all"
                    )} 
                    onClick={() => toggleCampaign(row.original.campaign_id || row.original.id)}
                    title={name}
                >
                    {name}
                </div>
            );
        },
      },
      {
        accessorKey: "portfolio_name",
        size: 52,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Budget
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
            const val = row.getValue("campaign_budget") as number | null;
            return <div className="text-center font-bold text-slate-900 dark:text-slate-100 text-xs">{val ? `$${Math.round(val)}` : "-"}</div>;
        }
      },
      {
        accessorKey: "clicks",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Clicks<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
            {formatNumber(row.getValue("clicks"))}
          </div>
        ),
      },
      {
        accessorKey: "spend",
        size: 48,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Spend<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-slate-900 dark:text-slate-100 text-xs">
            {formatCurrency(row.getValue("spend"))}
          </div>
        ),
      },
      {
        accessorKey: "roas",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            ROAS<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const roas = row.getValue("roas") as number;
          const badgeClass =
            roas > 4
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : roas > 2.5
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
              : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400";
          return (
            <div className="flex justify-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                {roas.toFixed(1)}x
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "orders",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Orders<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            CVR<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            ACoS<br/>30d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const acos = row.getValue("acos") as number;
          const badgeClass =
            acos < 20
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : acos < 35
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
              : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400";
          return (
            <div className="flex justify-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${badgeClass}`}>
                {formatPercent(acos)}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "clicks_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Clicks<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
            {formatNumber(row.getValue("clicks_7d"))}
          </div>
        ),
      },
      {
        accessorKey: "spend_7d",
        size: 52,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Spend<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-slate-900 dark:text-slate-100 text-xs">
            {formatCurrency(row.getValue("spend_7d"))}
          </div>
        ),
      },
      {
        accessorKey: "roas_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            ROAS<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          // Calculate ROAS 7d if not directly in data
          const spend = row.original.spend_7d || 0;
          const sales = row.original.sales_7d || 0;
          const roas = spend > 0 ? sales / spend : 0;
          
          const badgeClass =
            roas > 4
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : roas > 2.5
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
              : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400";
          return (
            <div className="flex justify-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                {roas.toFixed(1)}x
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "orders_7d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Orders<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            CVR<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            ACoS<br/>7d
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const acos = row.getValue("acos_7d") as number;
          const badgeClass =
            acos < 20
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : acos < 35
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
              : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400";
          return (
            <div className="flex justify-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${badgeClass}`}>
                {formatPercent(acos)}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "spent_db_yesterday",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            DB<br/>Yest
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Spent<br/>Yest
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
            {formatCurrency(row.getValue("spent_yesterday"))}
          </div>
        ),
      },
      {
        accessorKey: "impression_share_30d",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            LAST<br/>30D
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            LAST<br/>7D
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
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
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            YEST
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-xs">
            {row.getValue("impression_share_yesterday")}
          </div>
        ),
      },
      {
        accessorKey: "placement_type",
        size: 55,
        header: "Placement",
        cell: ({ row }) => {
          const placement = row.getValue("placement_type") as string;
          return (
            <PlacementBadge 
                placement={placement} 
                expanded={isPlacementsExpanded} 
                onClick={() => setIsPlacementsExpanded(!isPlacementsExpanded)}
            />
          );
        },
      },
      {
        accessorKey: "bid_adjustment",
        size: 50,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-slate-500 dark:text-slate-400 h-6 px-1 uppercase tracking-wider"
          >
            Multiplier
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const adjustment = row.getValue("bid_adjustment") as number;
          const changedAt = row.original.changed_at;
          const isNonZero = adjustment !== 0;
          return (
            <div className={cn(
                "text-center text-xs font-bold",
                changedAt ? "text-orange-500 dark:text-orange-400" :
                isNonZero ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
            )}>
              {adjustment > 0 ? `+${adjustment}%` : `${adjustment}%`}
              {changedAt && <span className="font-normal ml-1 opacity-75">({changedAt})</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "changes_in_placement",
        size: 52,
        header: ({ column }) => (
           <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-semibold text-primary h-8 px-2"
          >
            Changes
            <ArrowUpDown className="ml-2 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
            <ChangesInput
                id={row.original.id}
                initialValue={row.getValue("changes_in_placement") as string}
                isSubmitted={!!row.original.changed_at}
                onEdit={onEdit}
            />
        )
      },
      {
        accessorKey: "note",
        size: 120,
        header: () => (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider">
            Notes
          </span>
        ),
        cell: ({ row }) => (
          <NoteInput
            initialValue={row.original.note || ""}
            campaignId={row.original.campaign_id}
            weekId={row.original.week_id}
            placementType={row.original.placement_type}
            onNoteEdit={onNoteEdit}
          />
        ),
      },
      {
        accessorKey: "goal_completed",
        size: 56,
        header: () => (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider">
            Goal
          </span>
        ),
        cell: ({ row }) => (
          <GoalToggle
            value={row.original.goal_completed}
            campaignId={row.original.campaign_id}
            weekId={row.original.week_id}
            placementType={row.original.placement_type}
            onGoalToggle={onGoalToggle}
          />
        ),
      },
    ],
    [onEdit, onNoteEdit, onGoalToggle, expandedCampaigns, isPlacementsExpanded]
  );

  const table = useReactTable({
    data: sortedData,
    columns,
    defaultColumn: { size: 40, minSize: 36 },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    autoResetPageIndex: false,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 12,
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all font-medium">
                Columns <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 h-96 overflow-y-auto bg-white dark:bg-slate-950 border-2 shadow-xl opacity-100 z-[100] rounded-xl p-1">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize rounded-lg focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:text-blue-600 transition-colors"
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
            <Button variant="outline" size="sm" onClick={onExport} className="h-9 border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all font-medium">
              <Download className="mr-2 h-4 w-4 opacity-70" />
              Export
            </Button>
          )}
          {onSubmit && (
              <Button onClick={onSubmit} disabled={submitting} className="h-9 btn-gradient font-bold px-5 shadow-sm hover:shadow-md transition-all gap-2">
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
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      "bg-slate-50 dark:bg-slate-800/50 h-8",
                      header.column.id === "campaign_name"
                        ? "px-2 sticky left-0 z-20 border-r border-slate-200 dark:border-slate-700"
                        : "px-1"
                    )}>
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
              table.getRowModel().rows.map((row, idx) => {
                // Check if this is a new campaign group to potentially add visual separation
                const prevRow = idx > 0 ? table.getRowModel().rows[idx - 1] : null;
                const isNewCampaign = !prevRow || prevRow.original.campaign_name !== row.original.campaign_name;

                return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={cn(
                        "group border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors",
                        isNewCampaign && idx > 0 && "border-t-2 border-t-primary/10"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className={cn(
                            cell.column.id === "campaign_name"
                              ? "px-2 py-2 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700"
                              : "px-0.5 py-2"
                          )}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                );
              })
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
            className="border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            Previous
          </Button>
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Page <span className="text-slate-900 dark:text-slate-100">{table.getState().pagination.pageIndex + 1}</span> of{" "}
            <span className="text-slate-900 dark:text-slate-100">{table.getPageCount()}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
