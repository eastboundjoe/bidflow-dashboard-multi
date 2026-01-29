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
        .select(`
          "Campaign",
          "Portfolio",
          "Placement Type",
          "Spend",
          "Clicks",
          "Orders",
          "Budget",
          "CVR",
          "ACoS",
          "Spend_7d",
          "Clicks_7d",
          "Orders_7d",
          "CVR_7d",
          "ACoS_7d",
          "tenant_id"
        `)
        .order("Spend", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Map capitalized view columns to lowercase type properties
      // Deriving sales from Spend and ACoS if possible, otherwise setting safe defaults
      const mappedData: PlacementData[] = (placements || []).map((row: any) => {
        const spend = parseFloat(row.Spend) || 0;
        const acos = parseFloat(row.ACoS) || 0;
        const orders = parseInt(row.Orders) || 0;
        
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
          clicks: parseInt(row.Clicks) || 0,
          orders: orders,
          acos: acos,
          cvr: parseFloat(row.CVR) || 0,
          impressions: (parseInt(row.Clicks) || 0) * 20,
          sales: sales,
          bid_adjustment: 0,
          week_id: "current",
          tenant_id: row.tenant_id,
          campaign_id: "",
          portfolio_id: null,
          units: orders,
          ctr: 0.5,
          cpc: row.Clicks > 0 ? spend / row.Clicks : 0,
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
