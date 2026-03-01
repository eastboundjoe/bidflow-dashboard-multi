"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, AlertCircle, Rocket } from "lucide-react";
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

// Inline sub-component: auto-saving weekly goals textarea for Spend Distribution
function WeeklyGoalsNote({
  weekId,
  portfolioId,
  portfolioName,
  value,
  onSave,
}: {
  weekId: string;
  portfolioId: string;
  portfolioName: string | null;
  value: string;
  onSave: (weekId: string, portfolioId: string, note: string) => void;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  const savedRef = React.useRef(value);

  // Sync when week or portfolio changes
  React.useEffect(() => {
    setLocalValue(value);
    savedRef.current = value;
  }, [value]);

  const handleBlur = () => {
    if (localValue !== savedRef.current) {
      savedRef.current = localValue;
      onSave(weekId, portfolioId, localValue);
    }
  };

  const hasContent = localValue.trim().length > 0;
  const label = portfolioName ? `Goals — ${portfolioName}` : "Goals — All Portfolios";

  return (
    <div className={`mt-auto pt-3 border-t transition-colors ${hasContent ? "border-orange-200 dark:border-orange-800" : "border-slate-100 dark:border-slate-800"}`}>
      <p className={`text-xs font-medium mb-1.5 transition-colors ${hasContent ? "text-orange-600 dark:text-orange-400" : "text-slate-500 dark:text-slate-400"}`}>
        {label}
      </p>
      <textarea
        className={`w-full min-h-[80px] resize-none rounded-lg border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-colors ${
          hasContent
            ? "border-orange-500 bg-orange-50/50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-600"
            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
        }`}
        placeholder="Add weekly goals or notes for this portfolio..."
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
}


export function DashboardContent({ initialData = [] }: DashboardContentProps) {
  const [data, setData] = React.useState<PlacementData[]>(initialData);
  const dataRef = React.useRef<PlacementData[]>(initialData);
  React.useEffect(() => { dataRef.current = data; }, [data]);
  const [loading, setLoading] = React.useState(initialData.length === 0);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = React.useState<string>("");
  const [selectedPortfolio, setSelectedPortfolio] = React.useState<string | null>(null);

  // Collection status banner
  const [collectionStatus, setCollectionStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    let interval: ReturnType<typeof setInterval>;

    async function checkCollection() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: snapshot } = await supabase
        .from("weekly_snapshots")
        .select("status")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const status = snapshot?.status ?? null;
      setCollectionStatus(status === "completed" ? null : status);

      // Stop polling once completed
      if (status === "completed") {
        clearInterval(interval);
        // Reload dashboard data now that collection is done
        fetchData();
      }
    }

    checkCollection();
    interval = setInterval(checkCollection, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // All weeks but portfolio-filtered — used for sparklines and WoW trend
  const portfolioFilteredData = React.useMemo(() => {
    if (!selectedPortfolio) return data;
    return data.filter((row) => row.portfolio_id === selectedPortfolio);
  }, [data, selectedPortfolio]);

  // Fetch data from Supabase
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [{ data: placements, error: fetchError }, { data: notes }, { data: portfolioGoals }] = await Promise.all([
        supabase.from("view_placement_optimization_report").select("*").order("Spend", { ascending: false }),
        supabase.from("campaign_notes").select("*"),
        supabase.from("portfolio_goals").select("*"),
      ]);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Build notes lookup: "campaignId|weekId|placementType" → {note, goal_completed}
      const notesMap = new Map<string, { note: string; goal_completed: boolean | null }>();
      (notes || []).forEach((n: any) => {
        notesMap.set(`${n.campaign_id}|${n.week_id}|${n.placement_type}`, {
          note: n.note || "",
          goal_completed: n.goal_completed ?? null,
        });
      });

      // Build portfolio goals lookup: "weekId|portfolioId" → note
      const goalsMap = new Map<string, string>();
      (portfolioGoals || []).forEach((g: any) => {
        goalsMap.set(`${g.week_id}|${g.portfolio_id}`, g.note || "");
      });
      setPortfolioGoalsMap(goalsMap);

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

        // Derive change tracking from weekly snapshot (week-specific, not global)
        const campaignId = row.campaign_id || "";
        let changed_at: string | undefined;
        let changes_in_placement = "";
        if (row.last_changed_at) {
          const d = new Date(row.last_changed_at);
          changed_at = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
        }
        if (row.last_changed_to !== null && row.last_changed_to !== undefined && row.last_changed_to !== 0) {
          changes_in_placement = row.last_changed_to.toString();
        }

        const noteKey = `${campaignId}|${row.week_id || ""}|${placement_type}`;
        const noteData = notesMap.get(noteKey);

        return {
          id: `${getVal("Campaign") || row.campaign_name}-${rawPlacement}`,
          tenant_id: row.tenant_id,
          campaign_id: campaignId,
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
          changes_in_placement,
          changed_at,

          note: noteData?.note ?? "",
          goal_completed: noteData?.goal_completed ?? null,

          week_id: row.week_id || "",
          date_range_start: row.date_range_start || "",
          date_range_end: row.date_range_end || "",
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

  const [portfolioGoalsMap, setPortfolioGoalsMap] = React.useState<Map<string, string>>(new Map());

  const [submitting, setSubmitting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingChanges, setPendingChanges] = React.useState<ReturnType<typeof buildChanges>>([]);

  const buildChanges = (rows: PlacementData[]) =>
    rows
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

  // Handle editing of Changes column
  const handleEdit = (id: string, value: string) => {
    setData((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, changes_in_placement: value } : row
      )
    );
  };

  // Handle saving a note for a placement row (auto-save on blur)
  const handleNoteEdit = React.useCallback(async (
    campaignId: string, weekId: string, placementType: string, note: string
  ) => {
    setData((prev) =>
      prev.map((row) =>
        row.campaign_id === campaignId && row.week_id === weekId && row.placement_type === placementType
          ? { ...row, note }
          : row
      )
    );
    const supabase = createClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    // If note is cleared and goal is also unset, delete the row entirely
    const row = dataRef.current.find(
      (r) => r.campaign_id === campaignId && r.week_id === weekId && r.placement_type === placementType
    );
    if (!note.trim() && row?.goal_completed === null) {
      await supabase.from("campaign_notes")
        .delete()
        .eq("tenant_id", user.id)
        .eq("week_id", weekId)
        .eq("campaign_id", campaignId)
        .eq("placement_type", placementType);
    } else {
      await supabase.from("campaign_notes").upsert(
        { tenant_id: user.id, week_id: weekId, campaign_id: campaignId, placement_type: placementType, note },
        { onConflict: "tenant_id,week_id,campaign_id,placement_type" }
      );
    }
  }, []);

  // Handle toggling goal_completed: null → true → false → null
  const handleGoalToggle = React.useCallback(async (
    campaignId: string, weekId: string, placementType: string
  ) => {
    const row = dataRef.current.find(
      (r) => r.campaign_id === campaignId && r.week_id === weekId && r.placement_type === placementType
    );
    if (!row) return;
    const next = row.goal_completed === null ? true : row.goal_completed === true ? false : null;
    setData((prev) =>
      prev.map((r) =>
        r.campaign_id === campaignId && r.week_id === weekId && r.placement_type === placementType
          ? { ...r, goal_completed: next }
          : r
      )
    );
    const supabase = createClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    // If goal is reset to null and note is also empty, delete the row entirely
    if (next === null && !row.note.trim()) {
      await supabase.from("campaign_notes")
        .delete()
        .eq("tenant_id", user.id)
        .eq("week_id", weekId)
        .eq("campaign_id", campaignId)
        .eq("placement_type", placementType);
    } else {
      await supabase.from("campaign_notes").upsert(
        { tenant_id: user.id, week_id: weekId, campaign_id: campaignId, placement_type: placementType, goal_completed: next },
        { onConflict: "tenant_id,week_id,campaign_id,placement_type" }
      );
    }
  }, []);

  // Handle saving a portfolio-level weekly goal (auto-save on blur)
  const handlePortfolioGoalEdit = React.useCallback(async (
    weekId: string, portfolioId: string, note: string
  ) => {
    const key = `${weekId}|${portfolioId}`;
    setPortfolioGoalsMap((prev) => new Map(prev).set(key, note));
    const supabase = createClient();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    if (!note.trim()) {
      await supabase.from("portfolio_goals")
        .delete()
        .eq("tenant_id", user.id)
        .eq("week_id", weekId)
        .eq("portfolio_id", portfolioId);
    } else {
      await supabase.from("portfolio_goals").upsert(
        { tenant_id: user.id, week_id: weekId, portfolio_id: portfolioId, note, updated_at: new Date().toISOString() },
        { onConflict: "tenant_id,week_id,portfolio_id" }
      );
    }
  }, []);

  // Step 1: build preview and open confirmation dialog
  const handleSubmitChanges = () => {
    const changes = buildChanges(data);
    if (changes.length === 0) {
      alert("No changes to submit. Add multiplier percentages in the Changes column first.");
      return;
    }
    setPendingChanges(changes);
    setConfirmOpen(true);
  };

  // Step 2: confirmed — actually send to Amazon
  const handleConfirmedSubmit = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const user = (await createClient().auth.getUser()).data.user;
      const response = await fetch(N8N_WEBHOOKS.SUBMISSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: user?.id,
          user_id: user?.id,
          changes: pendingChanges,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        alert("✅ Changes submitted successfully to Amazon!");
        const today = new Date();
        const now = today.toISOString();
        const dateLabel = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

        // Persist change tracking to placement_bids
        const supabaseClient = createClient();
        const updatesByCampaign: Record<string, Record<string, any>> = {};
        pendingChanges.forEach((change) => {
          const suffix =
            change.placement.toLowerCase().includes("top") ? "top" :
            change.placement.toLowerCase().includes("rest") ? "rest" :
            change.placement.toLowerCase().includes("product") ? "product" : null;
          if (!suffix || !change.campaignId) return;
          const val = parseInt(String(change.newMultiplier).replace("%", ""));
          if (isNaN(val)) return;
          if (!updatesByCampaign[change.campaignId]) updatesByCampaign[change.campaignId] = {};
          updatesByCampaign[change.campaignId][`last_changed_at_${suffix}`] = now;
          updatesByCampaign[change.campaignId][`last_changed_to_${suffix}`] = val;
        });
        await Promise.all(
          Object.entries(updatesByCampaign).map(([campaignId, updates]) =>
            supabaseClient.from("placement_bids").update(updates).eq("campaign_id", campaignId)
          )
        );

        // Update bid_adjustment to submitted value, keep changes value, mark changed_at
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
                changed_at: dateLabel,
              };
            }
            return row;
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

      {/* Collection in progress banner */}
      {collectionStatus && (
        <div className="flex items-center gap-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-5 py-4">
          <div className="relative shrink-0">
            <div className="h-3 w-3 rounded-full bg-blue-500 animate-ping absolute inset-0" />
            <div className="h-3 w-3 rounded-full bg-blue-600 relative" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
              Data collection in progress
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Amazon is generating your placement reports. This can take 1–3 hours. Your dashboard will update automatically when ready.
            </p>
          </div>
          <RefreshCw className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
        </div>
      )}

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

      {/* Ad Spend Flow + Spend Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sankey Chart - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Ad Spend Flow</CardTitle>
              <div className="flex flex-wrap items-center gap-3">
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
              </div>
            </div>
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
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Spend Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 gap-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-20 w-full mt-4" />
              </div>
            ) : (
              <>
                <SpendFlowChart data={filteredData} />
                <WeeklyGoalsNote
                  weekId={selectedWeek}
                  portfolioId={selectedPortfolio ?? "__ALL__"}
                  portfolioName={
                    selectedPortfolio
                      ? (portfolios.find((p) => p.id === selectedPortfolio)?.name ?? selectedPortfolio)
                      : null
                  }
                  value={portfolioGoalsMap.get(`${selectedWeek}|${selectedPortfolio ?? "__ALL__"}`) ?? ""}
                  onSave={handlePortfolioGoalEdit}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Placement Performance */}
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
              weekId={selectedWeek}
              onExport={handleExport}
              onEdit={handleEdit}
              onSubmit={handleSubmitChanges}
              submitting={submitting}
              onNoteEdit={handleNoteEdit}
              onGoalToggle={handleGoalToggle}
            />
          )}
        </CardContent>
      </Card>

      {/* Confirm Changes Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white text-lg font-bold">
              Confirm Bid Changes
            </DialogTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              The following multipliers will be sent to Amazon Ads:
            </p>
          </DialogHeader>

          <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaign</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Placement</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Was</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">New</th>
                </tr>
              </thead>
              <tbody>
                {pendingChanges.map((c, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 max-w-[160px] truncate text-xs font-medium" title={c.campaign}>
                      {c.campaign}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                      {c.placement.replace("Placement ", "")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400 text-xs tabular-nums">
                      +{c.currentMultiplier}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold tabular-nums text-orange-500">
                      +{c.newMultiplier.replace("%", "")}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="border-slate-200">
              Cancel
            </Button>
            <Button onClick={handleConfirmedSubmit} className="btn-gradient gap-2 font-bold">
              <Rocket className="h-4 w-4" />
              Confirm &amp; Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Grid (Totals) */}
      <StatsGrid
        stats={stats}
        loading={loading}
        allPlacementData={portfolioFilteredData}
        currentWeekId={selectedWeek}
      />

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
    </div>
  );
}
