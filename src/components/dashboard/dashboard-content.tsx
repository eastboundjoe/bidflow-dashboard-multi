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
import { N8N_WEBHOOKS } from "@/lib/constants";
import type { PlacementData } from "@/types";

interface DashboardContentProps {
  initialData?: PlacementData[];
}

// Helper to get ISO week number and week date range
function getWeekInfo(date: Date = new Date()) {
  // Get ISO week number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  // Get week start (Monday) and end (Sunday)
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    week_id: `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`,
    week_number: weekNum,
    year: d.getUTCFullYear(),
    start_date: weekStart.toISOString(),
    end_date: weekEnd.toISOString(),
  };
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
      // Handle potential case variations from Supabase
      const mappedData: PlacementData[] = (placements || []).map((row: any) => {
        // Helper to get value with case-insensitive fallback
        const getVal = (key: string) => row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

        const spend = parseFloat(getVal("Spend")) || 0;
        const acos = parseFloat(getVal("ACoS")) || 0;
        const orders = parseInt(getVal("Orders")) || 0;
        const clicks = parseInt(getVal("Clicks")) || 0;
        const cvr = parseFloat(getVal("CVR")) || 0;
        const bidAdjustment = parseInt(row["Increase bids by placement"]) || 0;

        // 7-day metrics
        const spend_7d = parseFloat(getVal("Spend_7d")) || 0;
        const clicks_7d = parseInt(getVal("Clicks_7d")) || 0;
        const orders_7d = parseInt(getVal("Orders_7d")) || 0;
        const cvr_7d = parseFloat(getVal("CVR_7d")) || 0;
        const acos_7d = parseFloat(getVal("ACoS_7d")) || 0;

        // Calculate sales from Spend and ACoS (Spend / (ACoS/100))
        let sales = 0;
        if (acos > 0) {
          sales = spend / (acos / 100);
        } else if (orders > 0 && spend > 0) {
          sales = spend * 2;
        }
        
        // Calculate 7d sales
        let sales_7d = 0;
        if (acos_7d > 0) {
          sales_7d = spend_7d / (acos_7d / 100);
        }

        // Map database placement types to Sankey display names
        const rawPlacement = row["Placement Type"] || getVal("placement_type") || "Unknown";
        let placement_type = rawPlacement;
        if (rawPlacement === "Placement Top") placement_type = "Top of Search";
        else if (rawPlacement === "Placement Rest Of Search") placement_type = "Rest of Search";
        else if (rawPlacement === "Placement Product Page") placement_type = "Product Page";

        // Fix portfolio filtering: use portfolio name as ID if actual ID is missing
        // The view returns 'Portfolio' which is the name
        const portfolioName = getVal("Portfolio") || "No Portfolio";
        const portfolioId = row.portfolio_id || portfolioName;

        return {
          id: `${getVal("Campaign") || row.campaign_name}-${rawPlacement}`,
          tenant_id: row.tenant_id,
          campaign_id: row.campaign_id || "",
          campaign_name: getVal("Campaign") || row.campaign_name || "Unknown",
          campaign_budget: getVal("Budget") ? parseFloat(getVal("Budget")) : null,
          
          portfolio_id: portfolioId,
          portfolio_name: portfolioName,
          
          placement_type: placement_type,
          
          // 30d
          spend: spend,
          clicks: clicks,
          orders: orders,
          acos: acos,
          cvr: cvr,
          sales: sales,
          impressions: clicks * 20, // Estimate if not available
          units: orders,
          ctr: 0.5, // Placeholder/Estimate
          cpc: clicks > 0 ? spend / clicks : 0,
          roas: spend > 0 ? sales / spend : 0,

          // 7d
          clicks_7d,
          spend_7d,
          orders_7d,
          sales_7d,
          units_7d: orders_7d,
          cvr_7d,
          acos_7d,
          
          // Spend timing
          spent_db_yesterday: parseFloat(row["Spent DB Yesterday"] ?? row["spent_db_yesterday"]) || 0,
          spent_yesterday: parseFloat(row["Spent Yesterday"] ?? row["spent_yesterday"]) || 0,

          // Impression shares
          impression_share_30d: row["Last 30 days"] ?? row["last_30_days"] ?? "0%",
          impression_share_7d: row["Last 7 days"] ?? row["last_7_days"] ?? "0%",
          impression_share_yesterday: row["Yesterday"] ?? row["yesterday"] ?? "0%",

          bid_adjustment: bidAdjustment,
          changes_in_placement: "",

          // Get proper week info
          ...(() => {
            const weekInfo = getWeekInfo();
            return {
              week_id: weekInfo.week_id,
              date_range_start: weekInfo.start_date,
              date_range_end: weekInfo.end_date,
            };
          })(),
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

  const [submitting, setSubmitting] = React.useState(false);

  // Handle editing of Changes column
  const handleEdit = (id: string, value: string) => {
    setData((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, changes_in_placement: value } : row
      )
    );
  };

  // Submit changes to Amazon via n8n webhook
  const handleSubmitChanges = async () => {
    const changesData = data
      .filter(
        (row) =>
          row.changes_in_placement &&
          row.changes_in_placement !== "0" &&
          row.changes_in_placement !== "0%" &&
          row.changes_in_placement.trim() !== ""
      )
      .map((row) => ({
        campaign: row.campaign_name,
        portfolio: row.portfolio_name,
        placement: row.placement_type,
        currentMultiplier: row.bid_adjustment.toString(),
        newMultiplier: row.changes_in_placement,
        week: selectedWeek || "Unknown",
        campaignId: row.campaign_id,
      }));

    if (changesData.length === 0) {
      alert("No changes to submit. Add multiplier percentages in the Changes column first.");
      return;
    }

    setSubmitting(true);
    try {
      const user = (await createClient().auth.getUser()).data.user;
      const response = await fetch(N8N_WEBHOOKS.SUBMISSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: user?.id,
          user_id: user?.id,
          changes: changesData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        alert("✅ Changes submitted successfully to Amazon!");
        // Update bid_adjustment to the submitted value, then clear changes
        setData((prev) =>
          prev.map((row) => {
            const hasChange =
              row.changes_in_placement &&
              row.changes_in_placement !== "0" &&
              row.changes_in_placement !== "0%" &&
              row.changes_in_placement.trim() !== "";
            if (hasChange) {
              const newVal = parseInt(row.changes_in_placement!.replace("%", ""));
              return {
                ...row,
                bid_adjustment: isNaN(newVal) ? row.bid_adjustment : newVal,
                changes_in_placement: "",
              };
            }
            return { ...row, changes_in_placement: "" };
          })
        );
      } else {
        alert("❌ Failed to submit changes. Please try again.");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("❌ Error submitting changes.");
    } finally {
      setSubmitting(false);
    }
  };

  // Export to CSV
  const handleExport = () => {
    if (filteredData.length === 0) return;

    const headers = [
      "Campaign",
      "Portfolio",
      "Placement",
      "Budget",
      "Clicks 30d",
      "Spend 30d",
      "Orders 30d",
      "CVR 30d",
      "ACoS 30d",
      "Clicks 7d",
      "Spend 7d",
      "Orders 7d",
      "CVR 7d",
      "ACoS 7d",
      "Spent DB Yesterday",
      "Spent Yesterday",
      "Impression Share 30d",
      "Impression Share 7d",
      "Impression Share Yesterday",
      "Bid Adjustment",
      "Changes",
    ];

    const rows = filteredData.map((row) => [
      row.campaign_name,
      row.portfolio_name || "",
      row.placement_type,
      row.campaign_budget || "",
      row.clicks,
      row.spend.toFixed(2),
      row.orders,
      row.cvr.toFixed(2) + "%",
      row.acos.toFixed(2) + "%",
      row.clicks_7d,
      row.spend_7d.toFixed(2),
      row.orders_7d,
      row.cvr_7d.toFixed(2) + "%",
      row.acos_7d.toFixed(2) + "%",
      row.spent_db_yesterday.toFixed(2),
      row.spent_yesterday.toFixed(2),
      row.impression_share_30d,
      row.impression_share_7d,
      row.impression_share_yesterday,
      row.bid_adjustment,
      row.changes_in_placement,
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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Placement Optimizer</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Amazon Ads Performance Dashboard
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="h-9 border-slate-200 hover:border-blue-400 hover:text-blue-600 transition-all font-medium"
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
        new Set(data.map(d => d.week_id)).size > 1 ? (
          <PerformanceChart data={data} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <div className="text-4xl mb-4">📈</div>
                  <p className="text-sm">Trend data will appear after multiple weeks of collection</p>
                  <p className="text-xs mt-2">Currently showing: {[...new Set(data.map(d => d.week_id))].join(', ')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
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
            <PlacementDataTable 
              data={filteredData} 
              onExport={handleExport}
              onEdit={handleEdit}
              onSubmit={handleSubmitChanges}
              submitting={submitting}
            />
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
