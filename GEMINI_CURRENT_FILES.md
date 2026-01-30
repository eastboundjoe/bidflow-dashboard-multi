# Current Files That Need Fixing

## File 1: src/types/index.ts

```typescript
// Type definitions for BidFlow

import { SubscriptionTier } from "@/lib/constants";

// User and Auth Types
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Session {
  user: User;
  access_token: string;
  refresh_token: string;
}

// Subscription Types
export interface SubscriptionStatus {
  subscription_tier: SubscriptionTier;
  subscription_status: "active" | "trialing" | "canceled" | "past_due" | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
}

// Credentials Types
export interface Credentials {
  id: string;
  tenant_id: string;
  client_id: string | null;
  client_secret: string | null;
  refresh_token: string | null;
  profile_id: string | null;
  status: "active" | "inactive";
  report_day: string;
  report_hour: number;
  created_at: string;
  updated_at: string;
}

export interface CredentialFormData {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  profileId: string;
}

// Schedule Settings
export interface ScheduleSettings {
  report_day: string;
  report_hour: number;
}

// Placement Data Types
export interface PlacementData {
  id: string;
  tenant_id: string;
  campaign_id: string;
  campaign_name: string;
  portfolio_id: string | null;
  portfolio_name: string | null;
  placement_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  ctr: number;
  cpc: number;
  acos: number;
  roas: number;
  cvr: number;
  bid_adjustment: number;
  week_id: string;
  date_range_start: string;
  date_range_end: string;
}

// Stats Summary
export interface StatsSummary {
  totalSpend: number;
  totalSales: number;
  totalClicks: number;
  totalImpressions: number;
  totalOrders: number;
  avgAcos: number;
  avgRoas: number;
  avgCtr: number;
  avgCvr: number;
}

// Table Sort Configuration
export interface SortConfig {
  key: keyof PlacementData | null;
  direction: "asc" | "desc";
}

// Sankey Chart Types
export interface SankeyNode {
  name: string;
  value?: number;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Stripe Types
export interface CheckoutSessionRequest {
  priceId: string;
  tier: SubscriptionTier;
}

export interface PortalSessionRequest {
  customerId: string;
}
```

---

## File 2: src/components/dashboard/dashboard-content.tsx

```typescript
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertCircle } from "lucide-react";
import { StatsGrid, calculateStats } from "./stats-grid";
import { PlacementDataTable } from "./placement-data-table";
import { WeekSelector, generateWeekOptions } from "./week-selector";
import { PortfolioFilter, extractPortfolios } from "./portfolio-filter";
import { SankeyChart, SpendFlowChart } from "./sankey-chart";
import { PerformanceChart } from "./performance-chart";
import { createClient } from "@/lib/supabase/client";
import type { PlacementData } from "@/types";

interface DashboardContentProps {
  initialData?: PlacementData[];
}

export function DashboardContent({ initialData = [] }: DashboardContentProps) {
  const [data, setData] = React.useState<PlacementData[]>(initialData);
  const [loading, setLoading] = React.useState(initialData.length === 0);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = React.useState<string>("");
  const [selectedPortfolio, setSelectedPortfolio] = React.useState<string | null>(null);

  // Generate week options and portfolios from data
  const weeks = React.useMemo(() => generateWeekOptions(data), [data]);
  const portfolios = React.useMemo(() => extractPortfolios(data), [data]);

  // Set initial selected week
  React.useEffect(() => {
    if (weeks.length > 0 && !selectedWeek) {
      setSelectedWeek(weeks[0].id);
    }
  }, [weeks, selectedWeek]);

  // Filter data based on selections
  const filteredData = React.useMemo(() => {
    let filtered = data;

    if (selectedWeek) {
      filtered = filtered.filter((row) => row.week_id === selectedWeek);
    }

    if (selectedPortfolio) {
      filtered = filtered.filter((row) => row.portfolio_id === selectedPortfolio);
    }

    return filtered;
  }, [data, selectedWeek, selectedPortfolio]);

  // Calculate stats from filtered data
  const stats = React.useMemo(() => calculateStats(filteredData), [filteredData]);

  // Fetch data from Supabase
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: placements, error: fetchError } = await supabase
        .from("view_placement_optimization_report")
        .select("*")
        .order("Spend", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Map view columns to lowercase type properties
      // Using select("*") and accessing columns by their actual names
      const mappedData: PlacementData[] = (placements || []).map((row: any) => {
        const spend = parseFloat(row.Spend_30) || 0;
        const acos = parseFloat(row.ACoS_30) || 0;
        const orders = parseInt(row.Orders_30) || 0;
        const clicks = parseInt(row.Clicks_30) || 0;
        const cvr = parseFloat(row.CVR_30) || 0;
        const bidAdjustment = parseInt(row["Increase bids by placement"]) || 0;

        // Calculate sales from Spend and ACoS (Spend / (ACoS/100))
        let sales = 0;
        if (acos > 0) {
          sales = spend / (acos / 100);
        } else if (orders > 0 && spend > 0) {
          sales = spend * 2;
        }

        // Map database placement types to Sankey display names
        const rawPlacement = row["Placement Type"] || "Unknown";
        let placement_type = rawPlacement;
        if (rawPlacement === "Placement Top") placement_type = "Top of Search";
        else if (rawPlacement === "Placement Rest Of Search") placement_type = "Rest of Search";
        else if (rawPlacement === "Placement Product Page") placement_type = "Product Page";

        return {
          id: `${row.Campaign}-${rawPlacement}`,
          campaign_name: row.Campaign || "Unknown",
          portfolio_name: row.Portfolio || "No Portfolio",
          placement_type: placement_type,
          spend: spend,
          clicks: clicks,
          orders: orders,
          acos: acos,
          cvr: cvr,
          impressions: clicks * 20,
          sales: sales,
          bid_adjustment: bidAdjustment,
          week_id: "current",
          tenant_id: row.tenant_id,
          campaign_id: "",
          portfolio_id: null,  // <-- THIS IS THE BUG - hardcoded to null
          units: orders,
          ctr: 0.5,
          cpc: clicks > 0 ? spend / clicks : 0,
          roas: spend > 0 ? sales / spend : 0,
          date_range_start: new Date().toISOString(),
          date_range_end: new Date().toISOString(),
        };
      });

      setData(mappedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on mount if no initial data
  React.useEffect(() => {
    if (initialData.length === 0) {
      fetchData();
    }
  }, [fetchData, initialData.length]);

  // Export to CSV
  const handleExport = () => {
    if (filteredData.length === 0) return;

    const headers = [
      "Campaign",
      "Portfolio",
      "Placement",
      "Impressions",
      "Clicks",
      "Spend",
      "Sales",
      "ACOS",
      "ROAS",
      "Bid Adjustment",
    ];

    const rows = filteredData.map((row) => [
      row.campaign_name,
      row.portfolio_name || "",
      row.placement_type,
      row.impressions,
      row.clicks,
      row.spend.toFixed(2),
      row.sales.toFixed(2),
      row.acos.toFixed(2),
      row.roas.toFixed(2),
      row.bid_adjustment,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bidflow-placements-${selectedWeek || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Placement Optimizer</h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
            Amazon Ads Performance Dashboard
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Error loading data</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="ml-auto"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <StatsGrid stats={stats} loading={loading} />

      {/* Performance Trends Chart */}
      {!loading && data.length > 0 && (
        <PerformanceChart data={data} />
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Placement Performance</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              {loading ? (
                <>
                  <Skeleton className="h-9 w-[200px]" />
                  <Skeleton className="h-9 w-[180px]" />
                </>
              ) : (
                <>
                  <WeekSelector
                    weeks={weeks}
                    selectedWeek={selectedWeek}
                    onWeekChange={setSelectedWeek}
                    disabled={data.length === 0}
                  />
                  <PortfolioFilter
                    portfolios={portfolios}
                    selectedPortfolio={selectedPortfolio}
                    onPortfolioChange={setSelectedPortfolio}
                    disabled={data.length === 0}
                  />
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-lg mb-2">No placement data yet</p>
              <p className="text-sm">
                Connect your Amazon Advertising account and collect data to see
                your placement performance.
              </p>
            </div>
          ) : (
            <PlacementDataTable data={filteredData} onExport={handleExport} />
          )}
        </CardContent>
      </Card>

      {/* Ad Spend Flow Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sankey Chart - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ad Spend Flow</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-[300px] w-full" />
              </div>
            ) : (
              <SankeyChart data={filteredData} />
            )}
          </CardContent>
        </Card>

        {/* Spend Distribution - Takes 1 column */}
        <Card>
          <CardHeader>
            <CardTitle>Spend Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-20 w-full mt-4" />
              </div>
            ) : (
              <SpendFlowChart data={filteredData} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## File 3: src/components/dashboard/placement-data-table.tsx

```typescript
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
import { ArrowUpDown, ChevronDown, Download } from "lucide-react";

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

export const placementColumns: ColumnDef<PlacementData>[] = [
  {
    accessorKey: "campaign_name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="font-mono text-xs uppercase tracking-wider"
      >
        Campaign
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate font-medium">
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
        className="font-mono text-xs uppercase tracking-wider"
      >
        Portfolio
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-muted-foreground">
        {row.getValue("portfolio_name") || "—"}
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
    accessorKey: "impressions",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="font-mono text-xs uppercase tracking-wider"
      >
        Impr.
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums">
        {formatNumber(row.getValue("impressions"))}
      </div>
    ),
  },
  {
    accessorKey: "clicks",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="font-mono text-xs uppercase tracking-wider"
      >
        Clicks
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums">
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
        className="font-mono text-xs uppercase tracking-wider"
      >
        Spend
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums text-primary">
        {formatCurrency(row.getValue("spend"))}
      </div>
    ),
  },
  {
    accessorKey: "sales",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="font-mono text-xs uppercase tracking-wider"
      >
        Sales
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums text-primary">
        {formatCurrency(row.getValue("sales"))}
      </div>
    ),
  },
  {
    accessorKey: "acos",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="font-mono text-xs uppercase tracking-wider"
      >
        ACOS
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
        <div className={`text-right font-mono tabular-nums ${colorClass}`}>
          {formatPercent(acos)}
        </div>
      );
    },
  },
  {
    accessorKey: "roas",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="font-mono text-xs uppercase tracking-wider"
      >
        ROAS
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const roas = row.getValue("roas") as number;
      const colorClass =
        roas > 5
          ? "text-green-400"
          : roas > 3
          ? "text-yellow-400"
          : "text-red-400";
      return (
        <div className={`text-right font-mono tabular-nums ${colorClass}`}>
          {roas.toFixed(2)}x
        </div>
      );
    },
  },
  {
    accessorKey: "bid_adjustment",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="font-mono text-xs uppercase tracking-wider"
      >
        Bid Adj.
        <ArrowUpDown className="ml-2 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const adjustment = row.getValue("bid_adjustment") as number;
      return (
        <div className="text-right font-mono tabular-nums">
          {adjustment > 0 ? `+${adjustment}%` : `${adjustment}%`}
        </div>
      );
    },
  },
];

export function PlacementDataTable({ data, onExport }: PlacementDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "spend", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns: placementColumns,
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
                    {column.id.replace("_", " ")}
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
                  <TableHead key={header.id} className="bg-card/50">
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
                    <TableCell key={cell.id}>
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
                  colSpan={placementColumns.length}
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
```

---

## File 4: src/components/dashboard/portfolio-filter.tsx

```typescript
"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Portfolio {
  id: string;
  name: string;
}

interface PortfolioFilterProps {
  portfolios: Portfolio[];
  selectedPortfolio: string | null;
  onPortfolioChange: (portfolioId: string | null) => void;
  disabled?: boolean;
}

export function PortfolioFilter({
  portfolios,
  selectedPortfolio,
  onPortfolioChange,
  disabled = false,
}: PortfolioFilterProps) {
  return (
    <Select
      value={selectedPortfolio ?? "all"}
      onValueChange={(value) => onPortfolioChange(value === "all" ? null : value)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px] bg-background">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="All portfolios" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Portfolios</SelectItem>
        {portfolios.map((portfolio) => (
          <SelectItem key={portfolio.id} value={portfolio.id}>
            {portfolio.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Extract unique portfolios from placement data
export function extractPortfolios(data: Array<{ portfolio_id: string | null; portfolio_name: string | null }>): Portfolio[] {
  const portfolioMap = new Map<string, Portfolio>();

  data.forEach((row) => {
    if (row.portfolio_id && row.portfolio_name && !portfolioMap.has(row.portfolio_id)) {
      portfolioMap.set(row.portfolio_id, {
        id: row.portfolio_id,
        name: row.portfolio_name,
      });
    }
  });

  return Array.from(portfolioMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}
```

---

## Supabase View Column Names (Actual from database)

When querying `view_placement_optimization_report`, these are the actual column names returned:

```
Campaign
Portfolio
Budget
Clicks
Spend
Orders
CVR
ACoS
Clicks_7d
Spend_7d
Orders_7d
CVR_7d
ACoS_7d
Spent DB Yesterday
Spent Yesterday
Last 30 days
Last 7 days
Yesterday
Placement Type
Increase bids by placement
Changes in placement
NOTES
Empty1
Empty2
tenant_id
```

Note: The view uses title case and spaces in column names (e.g., "Placement Type" not "placement_type").
