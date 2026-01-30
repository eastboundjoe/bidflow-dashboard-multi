"use client";

import * as React from "react";
import type { PlacementData } from "@/types";

interface SankeyChartProps {
  data: PlacementData[];
  width?: number;
  height?: number;
}

// Simplified Flow Chart using CSS (replaces complex D3 Sankey)
export function SankeyChart({ data }: SankeyChartProps) {
  const stats = React.useMemo(() => {
    const byPlacement: Record<string, { spend: number; sales: number; clicks: number }> = {};

    data.forEach(row => {
      const placement = row.placement_type || "Unknown";
      if (!byPlacement[placement]) {
        byPlacement[placement] = { spend: 0, sales: 0, clicks: 0 };
      }
      byPlacement[placement].spend += row.spend || 0;
      byPlacement[placement].sales += row.sales || 0;
      byPlacement[placement].clicks += row.clicks || 0;
    });

    const totalSpend = Object.values(byPlacement).reduce((sum, s) => sum + s.spend, 0);
    const totalSales = Object.values(byPlacement).reduce((sum, s) => sum + s.sales, 0);
    const totalClicks = Object.values(byPlacement).reduce((sum, s) => sum + s.clicks, 0);

    return { byPlacement, totalSpend, totalSales, totalClicks };
  }, [data]);

  if (data.length === 0 || stats.totalSpend === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-sm">No spend data available</p>
        </div>
      </div>
    );
  }

  const placements = [
    { key: "Top of Search", color: "#00ff94", label: "TOP" },
    { key: "Rest of Search", color: "#0095ff", label: "ROS" },
    { key: "Product Page", color: "#ff9500", label: "PP" },
  ];

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* Flow Visualization */}
      <div className="relative">
        {/* Source: Ad Spend */}
        <div className="flex items-center justify-center mb-4">
          <div className="bg-primary/20 border border-primary rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-muted-foreground">AD SPEND</div>
            <div className="text-xl font-bold text-primary">{formatCurrency(stats.totalSpend)}</div>
          </div>
        </div>

        {/* Flow Lines */}
        <div className="flex justify-center mb-2">
          <div className="w-0.5 h-8 bg-gradient-to-b from-primary to-muted"></div>
        </div>

        {/* Placements */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {placements.map(({ key, color, label }) => {
            const placementData = stats.byPlacement[key] || { spend: 0, sales: 0, clicks: 0 };
            const percentage = stats.totalSpend > 0 ? (placementData.spend / stats.totalSpend) * 100 : 0;
            const acos = placementData.sales > 0 ? (placementData.spend / placementData.sales) * 100 : 0;

            return (
              <div key={key} className="text-center">
                <div
                  className="rounded-lg p-3 border-2 transition-all hover:scale-105"
                  style={{ borderColor: color, backgroundColor: `${color}15` }}
                >
                  <div className="text-xs font-bold mb-1" style={{ color }}>{label}</div>
                  <div className="text-lg font-bold">{formatCurrency(placementData.spend)}</div>
                  <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of spend</div>
                  <div className="text-xs mt-1">
                    <span className={acos < 30 ? "text-green-400" : acos < 50 ? "text-yellow-400" : "text-red-400"}>
                      {acos.toFixed(1)}% ACoS
                    </span>
                  </div>
                </div>
                <div className="w-0.5 h-4 mx-auto mt-2" style={{ backgroundColor: color }}></div>
              </div>
            );
          })}
        </div>

        {/* Converging lines */}
        <div className="flex justify-center mb-2">
          <div className="w-0.5 h-8 bg-gradient-to-b from-muted to-green-500"></div>
        </div>

        {/* Outcomes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">SALES</div>
            <div className="text-xl font-bold text-green-400">{formatCurrency(stats.totalSales)}</div>
            <div className="text-xs text-muted-foreground">
              ROAS: {(stats.totalSales / stats.totalSpend).toFixed(2)}x
            </div>
          </div>
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground">WASTED</div>
            <div className="text-xl font-bold text-red-400">
              {formatCurrency(Math.max(0, stats.totalSpend - stats.totalSales))}
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.totalSpend > stats.totalSales ? "Spend > Sales" : "Profitable!"}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-border text-xs">
        {placements.map(({ key, color }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple bar-based spend distribution chart
export function SpendFlowChart({ data }: { data: PlacementData[] }) {
  const stats = React.useMemo(() => {
    const byPlacement = data.reduce(
      (acc, row) => {
        const placement = row.placement_type || "Unknown";
        if (!acc[placement]) {
          acc[placement] = { spend: 0, sales: 0 };
        }
        acc[placement].spend += row.spend || 0;
        acc[placement].sales += row.sales || 0;
        return acc;
      },
      {} as Record<string, { spend: number; sales: number }>
    );

    const totalSpend = Object.values(byPlacement).reduce((sum, s) => sum + s.spend, 0);
    const totalSales = Object.values(byPlacement).reduce((sum, s) => sum + s.sales, 0);

    return { byPlacement, totalSpend, totalSales };
  }, [data]);

  if (data.length === 0 || stats.totalSpend === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-sm">No spend data available</p>
        </div>
      </div>
    );
  }

  const placements = [
    { key: "Top of Search", color: "#00ff94" },
    { key: "Rest of Search", color: "#0095ff" },
    { key: "Product Page", color: "#ff9500" },
  ];

  return (
    <div className="space-y-6">
      {/* Spend Distribution */}
      <div>
        <h4 className="text-sm font-medium mb-3">Spend by Placement</h4>
        <div className="space-y-3">
          {placements.map(({ key, color }) => {
            const value = stats.byPlacement[key]?.spend || 0;
            const percentage = stats.totalSpend > 0 ? (value / stats.totalSpend) * 100 : 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-mono">
                    {value.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}{" "}
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversion Summary */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">
            {stats.totalSpend.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-xs text-muted-foreground">Total Spend</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {stats.totalSales.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-xs text-muted-foreground">Total Sales</div>
        </div>
      </div>

      {/* ROAS indicator */}
      <div className="text-center pt-4 border-t border-border">
        <div className="text-3xl font-bold">
          <span
            className={
              stats.totalSpend > 0 && stats.totalSales / stats.totalSpend > 3
                ? "text-green-400"
                : stats.totalSpend > 0 && stats.totalSales / stats.totalSpend > 2
                ? "text-yellow-400"
                : "text-red-400"
            }
          >
            {stats.totalSpend > 0
              ? (stats.totalSales / stats.totalSpend).toFixed(2)
              : "0.00"}
            x
          </span>
        </div>
        <div className="text-xs text-muted-foreground">Return on Ad Spend</div>
      </div>
    </div>
  );
}
