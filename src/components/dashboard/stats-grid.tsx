"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlacementData, StatsSummary } from "@/types";
import { TrendingUp, TrendingDown, DollarSign, MousePointerClick, Eye, ShoppingCart } from "lucide-react";

interface StatsGridProps {
  stats: StatsSummary | null;
  loading?: boolean;
  allPlacementData: PlacementData[];
  currentWeekId: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(Math.round(value));

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// Mini SVG sparkline — values should be oldest → newest
function Sparkline({ values, isLowerBetter = false }: { values: number[]; isLowerBetter?: boolean }) {
  if (values.length < 2) return null;

  const W = 56;
  const H = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const risingIsGood = !isLowerBetter;
  const isGood = last > prev ? risingIsGood : !risingIsGood;
  const flat = Math.abs(last - prev) < 0.0001 * (Math.abs(prev) || 1);
  const color = flat ? "#94a3b8" : isGood ? "#22c55e" : "#ef4444";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
      {/* Dot on last point */}
      <circle
        cx={W}
        cy={H - ((last - min) / range) * (H - 2) - 1}
        r="2"
        fill={color}
      />
    </svg>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  sparklineValues?: number[];
  isLowerBetter?: boolean;
  weekOverWeekPct?: number | null; // e.g. 5.2 means +5.2%
  loading?: boolean;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  sparklineValues,
  isLowerBetter = false,
  weekOverWeekPct,
  loading,
}: StatCardProps) {
  const hasSparkline = sparklineValues && sparklineValues.length >= 2;
  const hasTrend = weekOverWeekPct !== null && weekOverWeekPct !== undefined;

  let trendColor = "text-slate-400 dark:text-slate-500";
  let TrendIcon = null;
  if (hasTrend && weekOverWeekPct !== 0) {
    const risingIsGood = !isLowerBetter;
    const isGood = weekOverWeekPct! > 0 ? risingIsGood : !risingIsGood;
    trendColor = isGood
      ? "text-green-600 dark:text-green-400"
      : "text-red-500 dark:text-red-400";
    TrendIcon = weekOverWeekPct! > 0 ? TrendingUp : TrendingDown;
  }

  return (
    <Card className="card-hover border-slate-200/50 dark:border-slate-800/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
          {title}
        </CardTitle>
        <div className="text-slate-400 dark:text-slate-500">{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-5 w-14" />
          </>
        ) : (
          <>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {value}
            </span>
            {subtitle && (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            )}
            {(hasSparkline || hasTrend) && (
              <div className="flex items-center justify-between mt-2 gap-2">
                {hasSparkline && (
                  <Sparkline values={sparklineValues!} isLowerBetter={isLowerBetter} />
                )}
                {hasTrend && (
                  <div className={`flex items-center gap-0.5 ml-auto ${trendColor}`}>
                    {TrendIcon && <TrendIcon className="h-3 w-3 shrink-0" />}
                    <span className="text-xs font-semibold">
                      {weekOverWeekPct! > 0 ? "+" : ""}
                      {weekOverWeekPct!.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-0.5">
                      WoW
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Calculate week-over-week % change
function wowPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function StatsGrid({ stats, loading = false, allPlacementData, currentWeekId }: StatsGridProps) {
  // Build per-week stats for the last 4 weeks (current + 3 prior), oldest → newest
  const { weeklyStats, currentStats, priorStats } = React.useMemo(() => {
    const sortedWeeks = Array.from(new Set(allPlacementData.map((d) => d.week_id)))
      .sort((a, b) => a.localeCompare(b)); // ascending: oldest first

    const currentIdx = sortedWeeks.indexOf(currentWeekId);

    // Take up to 4 weeks ending at the current week
    const startIdx = Math.max(0, currentIdx - 3);
    const windowWeeks = currentIdx !== -1 ? sortedWeeks.slice(startIdx, currentIdx + 1) : [];

    const weeklyStats = windowWeeks.map((weekId) => ({
      weekId,
      stats: calculateStats(allPlacementData.filter((d) => d.week_id === weekId)),
    }));

    const currentStats = weeklyStats.find((w) => w.weekId === currentWeekId)?.stats ?? null;
    const priorStats =
      weeklyStats.length >= 2 ? weeklyStats[weeklyStats.length - 2].stats : null;

    return { weeklyStats, currentStats, priorStats };
  }, [allPlacementData, currentWeekId]);

  // Sparkline series — one value per week (oldest → newest)
  const spendSeries = weeklyStats.map((w) => w.stats.totalSpend);
  const salesSeries = weeklyStats.map((w) => w.stats.totalSales);
  const acosSeries = weeklyStats.map((w) => w.stats.avgAcos);
  const roasSeries = weeklyStats.map((w) => w.stats.avgRoas);

  // Week-over-week % changes (current vs immediately prior week)
  const spendWoW = currentStats && priorStats ? wowPct(currentStats.totalSpend, priorStats.totalSpend) : null;
  const salesWoW = currentStats && priorStats ? wowPct(currentStats.totalSales, priorStats.totalSales) : null;
  const acosWoW = currentStats && priorStats ? wowPct(currentStats.avgAcos, priorStats.avgAcos) : null;
  const roasWoW = currentStats && priorStats ? wowPct(currentStats.avgRoas, priorStats.avgRoas) : null;

  if (!stats && !loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <StatCard
            key={i}
            title={["Total Spend", "Total Sales", "ACOS", "ROAS"][i]}
            value="$0"
            subtitle="No data"
            icon={<DollarSign className="h-4 w-4" />}
            loading={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        title="Total Spend"
        value={loading ? "" : formatCurrency(stats?.totalSpend ?? 0)}
        subtitle="All placements"
        icon={<DollarSign className="h-4 w-4" />}
        sparklineValues={spendSeries}
        isLowerBetter={false}
        weekOverWeekPct={spendWoW}
        loading={loading}
      />
      <StatCard
        title="Total Sales"
        value={loading ? "" : formatCurrency(stats?.totalSales ?? 0)}
        subtitle="From ads"
        icon={<ShoppingCart className="h-4 w-4" />}
        sparklineValues={salesSeries}
        isLowerBetter={false}
        weekOverWeekPct={salesWoW}
        loading={loading}
      />
      <StatCard
        title="ACOS"
        value={loading ? "" : formatPercent(stats?.avgAcos ?? 0)}
        subtitle="Avg across placements"
        icon={<TrendingDown className="h-4 w-4" />}
        sparklineValues={acosSeries}
        isLowerBetter={true}
        weekOverWeekPct={acosWoW}
        loading={loading}
      />
      <StatCard
        title="ROAS"
        value={loading ? "" : `${(stats?.avgRoas ?? 0).toFixed(2)}x`}
        subtitle="Return on ad spend"
        icon={<TrendingUp className="h-4 w-4" />}
        sparklineValues={roasSeries}
        isLowerBetter={false}
        weekOverWeekPct={roasWoW}
        loading={loading}
      />
    </div>
  );
}

// Extended stats grid (no sparklines — keeps it simple)
export function StatsGridExtended({ stats, loading = false, allPlacementData, currentWeekId }: StatsGridProps) {
  if (!stats && !loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <StatCard
            key={i}
            title={["Total Spend", "Total Sales", "Impressions", "Clicks", "ACOS", "ROAS"][i]}
            value="$0"
            subtitle="No data"
            icon={<DollarSign className="h-4 w-4" />}
            loading={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <StatCard
        title="Total Spend"
        value={loading ? "" : formatCurrency(stats?.totalSpend ?? 0)}
        subtitle="All placements"
        icon={<DollarSign className="h-4 w-4" />}
        loading={loading}
      />
      <StatCard
        title="Total Sales"
        value={loading ? "" : formatCurrency(stats?.totalSales ?? 0)}
        subtitle="From ads"
        icon={<ShoppingCart className="h-4 w-4" />}
        loading={loading}
      />
      <StatCard
        title="Impressions"
        value={loading ? "" : formatNumber(stats?.totalImpressions ?? 0)}
        subtitle="Total views"
        icon={<Eye className="h-4 w-4" />}
        loading={loading}
      />
      <StatCard
        title="Clicks"
        value={loading ? "" : formatNumber(stats?.totalClicks ?? 0)}
        subtitle={`${formatPercent(stats?.avgCtr ?? 0)} CTR`}
        icon={<MousePointerClick className="h-4 w-4" />}
        loading={loading}
      />
      <StatCard
        title="ACOS"
        value={loading ? "" : formatPercent(stats?.avgAcos ?? 0)}
        subtitle="Avg cost of sale"
        icon={<TrendingDown className="h-4 w-4" />}
        loading={loading}
      />
      <StatCard
        title="ROAS"
        value={loading ? "" : `${(stats?.avgRoas ?? 0).toFixed(2)}x`}
        subtitle="Return on ad spend"
        icon={<TrendingUp className="h-4 w-4" />}
        loading={loading}
      />
    </div>
  );
}

// Calculate stats from placement data
export function calculateStats(data: Array<{ spend: number; sales: number; clicks: number; impressions: number; orders: number; acos: number; roas: number; ctr: number; cvr: number }>): StatsSummary {
  if (data.length === 0) {
    return {
      totalSpend: 0,
      totalSales: 0,
      totalClicks: 0,
      totalImpressions: 0,
      totalOrders: 0,
      avgAcos: 0,
      avgRoas: 0,
      avgCtr: 0,
      avgCvr: 0,
    };
  }

  const totalSpend = data.reduce((sum, row) => sum + (row.spend || 0), 0);
  const totalSales = data.reduce((sum, row) => sum + (row.sales || 0), 0);
  const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
  const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
  const totalOrders = data.reduce((sum, row) => sum + (row.orders || 0), 0);

  return {
    totalSpend,
    totalSales,
    totalClicks,
    totalImpressions,
    totalOrders,
    avgAcos: totalSales > 0 ? (totalSpend / totalSales) * 100 : 0,
    avgRoas: totalSpend > 0 ? totalSales / totalSpend : 0,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avgCvr: totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0,
  };
}
