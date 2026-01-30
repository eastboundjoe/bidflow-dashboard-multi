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
        const spend = parseFloat(row.Spend) || 0; // Fixed: View uses 'Spend' not 'Spend_30'
        const acos = parseFloat(row.ACoS) || 0;   // Fixed: View uses 'ACoS' not 'ACoS_30'
        const orders = parseInt(row.Orders) || 0; // Fixed: View uses 'Orders' not 'Orders_30'
        const clicks = parseInt(row.Clicks) || 0; // Fixed: View uses 'Clicks' not 'Clicks_30'
        const cvr = parseFloat(row.CVR) || 0;     // Fixed: View uses 'CVR' not 'CVR_30'
        const bidAdjustment = parseInt(row["Increase bids by placement"]) || 0;
        
        // 7-day metrics
        const spend_7d = parseFloat(row.Spend_7d) || 0;
        const clicks_7d = parseInt(row.Clicks_7d) || 0;
        const orders_7d = parseInt(row.Orders_7d) || 0;
        const cvr_7d = parseFloat(row.CVR_7d) || 0;
        const acos_7d = parseFloat(row.ACoS_7d) || 0;

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
        const rawPlacement = row["Placement Type"] || "Unknown";
        let placement_type = rawPlacement;
        if (rawPlacement === "Placement Top") placement_type = "Top of Search";
        else if (rawPlacement === "Placement Rest Of Search") placement_type = "Rest of Search";
        else if (rawPlacement === "Placement Product Page") placement_type = "Product Page";

        // Fix portfolio filtering: use portfolio name as ID if actual ID is missing
        // The view returns 'Portfolio' which is the name
        const portfolioName = row.Portfolio || "No Portfolio";
        const portfolioId = row.portfolio_id || portfolioName;

        return {
          id: `${row.Campaign}-${rawPlacement}`,
          tenant_id: row.tenant_id,
          campaign_id: row.campaign_id || "",
          campaign_name: row.Campaign || "Unknown",
          campaign_budget: row.Budget ? parseFloat(row.Budget) : null,
          
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
          spent_db_yesterday: parseFloat(row["Spent DB Yesterday"]) || 0,
          spent_yesterday: parseFloat(row["Spent Yesterday"]) || 0,
          
          // Impression shares
          impression_share_30d: row["Last 30 days"] || "0%",
          impression_share_7d: row["Last 7 days"] || "0%",
          impression_share_yesterday: row["Yesterday"] || "0%",

          bid_adjustment: bidAdjustment,
          changes_in_placement: "0",
          
          week_id: "current",
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
      const response = await fetch(N8N_WEBHOOKS.SUBMISSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: changesData,
          timestamp: new Date().toISOString(),
          user_id: (await createClient().auth.getUser()).data.user?.id
        }),
      });

      if (response.ok) {
        alert("✅ Changes submitted successfully to Amazon!");
        // Reset changes after successful submission
        setData((prev) =>
          prev.map((row) => ({ ...row, changes_in_placement: "0" }))
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
