"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatsSummary } from "@/types";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  MousePointerClick,
  Eye,
  ShoppingCart,
} from "lucide-react";

interface StatsGridProps {
  stats: StatsSummary | null;
  loading?: boolean;
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

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading,
}: StatCardProps) {
  return (
    <Card className="relative overflow-hidden border-zinc-800 bg-zinc-900/50 card-glow">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
        <CardTitle className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
          {title}
        </CardTitle>
        <div className="text-zinc-600">{icon}</div>
      </CardHeader>
      <CardContent className="pb-4 px-5">
        {loading ? (
          <>
            <Skeleton className="h-9 w-28 mb-2 bg-zinc-800" />
            <Skeleton className="h-3 w-16 bg-zinc-800" />
          </>
        ) : (
          <>
            <div className="flex items-end gap-2 mb-1">
              <span className="text-3xl font-bold font-data leading-none text-foreground">
                {value}
              </span>
              {trend && trend !== "neutral" && (
                <div className="mb-0.5">
                  {trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-primary" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-zinc-600">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsGrid({ stats, loading = false }: StatsGridProps) {
  if (!stats && !loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["Total Spend", "Total Sales", "ACoS", "ROAS"] as const).map(
          (title) => (
            <StatCard
              key={title}
              title={title}
              value="—"
              subtitle="No data yet"
              icon={<DollarSign className="h-4 w-4" />}
              loading={false}
            />
          )
        )}
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
        title="ACoS"
        value={loading ? "" : formatPercent(stats?.avgAcos ?? 0)}
        subtitle="Avg across placements"
        icon={<TrendingDown className="h-4 w-4" />}
        trend={stats && stats.avgAcos < 25 ? "up" : "down"}
        loading={loading}
      />
      <StatCard
        title="ROAS"
        value={loading ? "" : `${(stats?.avgRoas ?? 0).toFixed(2)}×`}
        subtitle="Return on ad spend"
        icon={<TrendingUp className="h-4 w-4" />}
        trend={stats && stats.avgRoas > 4 ? "up" : "down"}
        loading={loading}
      />
    </div>
  );
}

// Extended stats grid with more metrics
export function StatsGridExtended({ stats, loading = false }: StatsGridProps) {
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
        title="ACoS"
        value={loading ? "" : formatPercent(stats?.avgAcos ?? 0)}
        subtitle="Avg cost of sale"
        icon={<TrendingDown className="h-4 w-4" />}
        trend={stats && stats.avgAcos < 25 ? "up" : "down"}
        loading={loading}
      />
      <StatCard
        title="ROAS"
        value={loading ? "" : `${(stats?.avgRoas ?? 0).toFixed(2)}×`}
        subtitle="Return on ad spend"
        icon={<TrendingUp className="h-4 w-4" />}
        trend={stats && stats.avgRoas > 4 ? "up" : "down"}
        loading={loading}
      />
    </div>
  );
}

// Calculate stats from placement data
export function calculateStats(
  data: Array<{
    spend: number;
    sales: number;
    clicks: number;
    impressions: number;
    orders: number;
    acos: number;
    roas: number;
    ctr: number;
    cvr: number;
  }>
): StatsSummary {
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
  const totalImpressions = data.reduce(
    (sum, row) => sum + (row.impressions || 0),
    0
  );
  const totalOrders = data.reduce((sum, row) => sum + (row.orders || 0), 0);

  return {
    totalSpend,
    totalSales,
    totalClicks,
    totalImpressions,
    totalOrders,
    avgAcos: totalSales > 0 ? (totalSpend / totalSales) * 100 : 0,
    avgRoas: totalSpend > 0 ? totalSales / totalSpend : 0,
    avgCtr:
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avgCvr: totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0,
  };
}
