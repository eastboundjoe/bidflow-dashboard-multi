"use client";

import * as React from "react";
import type { PlacementData } from "@/types";

interface SankeyChartProps {
  data: PlacementData[];
  width?: number;
  height?: number;
}

// SVG-based Flow Diagram
export function SankeyChart({ data }: SankeyChartProps) {
  const stats = React.useMemo(() => {
    const byPlacement: Record<string, { spend: number; sales: number; clicks: number; cvr: number }> = {};

    data.forEach(row => {
      const placement = row.placement_type || "Unknown";
      if (!byPlacement[placement]) {
        byPlacement[placement] = { spend: 0, sales: 0, clicks: 0, cvr: 0 };
      }
      byPlacement[placement].spend += row.spend || 0;
      byPlacement[placement].sales += row.sales || 0;
      byPlacement[placement].clicks += row.clicks || 0;
    });

    // Calculate CVR for each placement
    Object.keys(byPlacement).forEach(key => {
      const p = byPlacement[key];
      p.cvr = p.clicks > 0 ? (p.sales / p.spend) * 100 : 0;
    });

    const totalSpend = Object.values(byPlacement).reduce((sum, s) => sum + s.spend, 0);
    const totalSales = Object.values(byPlacement).reduce((sum, s) => sum + s.sales, 0);
    const totalClicks = Object.values(byPlacement).reduce((sum, s) => sum + s.clicks, 0);

    return { byPlacement, totalSpend, totalSales, totalClicks };
  }, [data]);

  if (data.length === 0 || stats.totalSpend === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-sm">No spend data available</p>
        </div>
      </div>
    );
  }

  const placements = [
    { key: "Top of Search", color: "#00ff94", label: "TOP", shortLabel: "T" },
    { key: "Rest of Search", color: "#0095ff", label: "ROS", shortLabel: "R" },
    { key: "Product Page", color: "#ff9500", label: "PP", shortLabel: "P" },
  ];

  const formatCurrency = (val: number) =>
    val.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  // Calculate flow widths based on spend proportion
  const getFlowWidth = (spend: number) => {
    const minWidth = 8;
    const maxWidth = 60;
    const proportion = stats.totalSpend > 0 ? spend / stats.totalSpend : 0;
    return minWidth + proportion * (maxWidth - minWidth);
  };

  // SVG dimensions
  const width = 700;
  const height = 400;
  const centerX = width / 2;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minHeight: '350px' }}>
        <defs>
          {/* Gradients for flows */}
          <linearGradient id="flowGradientTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ff94" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00ff94" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="flowGradientRos" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0095ff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0095ff" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="flowGradientPp" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff9500" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff9500" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="salesGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.7" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width={width} height={height} fill="transparent" />

        {/* AD SPEND Node */}
        <g transform={`translate(60, ${height/2})`}>
          <rect x="-50" y="-30" width="100" height="60" rx="8" fill="#1f2937" stroke="#00ff94" strokeWidth="2" />
          <text x="0" y="-8" textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="monospace">AD SPEND</text>
          <text x="0" y="12" textAnchor="middle" fill="#00ff94" fontSize="16" fontWeight="bold" fontFamily="monospace">
            {formatCurrency(stats.totalSpend)}
          </text>
        </g>

        {/* Flow paths from AD SPEND to placements */}
        {placements.map((p, i) => {
          const placementData = stats.byPlacement[p.key] || { spend: 0, clicks: 0, sales: 0 };
          const flowWidth = getFlowWidth(placementData.spend);
          const yOffset = (i - 1) * 100; // -100, 0, 100 for vertical spread
          const startY = height / 2;
          const endY = height / 2 + yOffset;
          const gradientId = i === 0 ? "flowGradientTop" : i === 1 ? "flowGradientRos" : "flowGradientPp";

          return (
            <g key={p.key}>
              {/* Flow path */}
              <path
                d={`M 110 ${startY}
                    C 200 ${startY}, 250 ${endY}, 340 ${endY}`}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={flowWidth}
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Animated particles effect (CSS animation) */}
              <circle r="4" fill={p.color} filter="url(#glow)">
                <animateMotion
                  dur={`${2 + i * 0.5}s`}
                  repeatCount="indefinite"
                  path={`M 110 ${startY} C 200 ${startY}, 250 ${endY}, 340 ${endY}`}
                />
              </circle>
              <circle r="4" fill={p.color} filter="url(#glow)">
                <animateMotion
                  dur={`${2 + i * 0.5}s`}
                  repeatCount="indefinite"
                  begin={`${0.5 + i * 0.2}s`}
                  path={`M 110 ${startY} C 200 ${startY}, 250 ${endY}, 340 ${endY}`}
                />
              </circle>

              {/* Placement Node */}
              <g transform={`translate(380, ${endY})`}>
                <rect x="-40" y="-35" width="120" height="70" rx="8" fill="#1f2937" stroke={p.color} strokeWidth="2" />
                <text x="20" y="-15" textAnchor="middle" fill={p.color} fontSize="14" fontWeight="bold" fontFamily="monospace">
                  {p.label}
                </text>
                <text x="20" y="5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="monospace">
                  {formatCurrency(placementData.spend)}
                </text>
                <text x="20" y="22" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="monospace">
                  {placementData.clicks.toLocaleString()} clicks
                </text>
              </g>

              {/* Flow to outcomes */}
              <path
                d={`M 500 ${endY} C 550 ${endY}, 580 ${height/2 - 40}, 620 ${height/2 - 40}`}
                fill="none"
                stroke="url(#salesGradient)"
                strokeWidth={flowWidth * 0.6}
                strokeLinecap="round"
                opacity="0.6"
              />
            </g>
          );
        })}

        {/* SALES Node */}
        <g transform={`translate(${width - 60}, ${height/2 - 40})`}>
          <rect x="-50" y="-30" width="100" height="60" rx="8" fill="#1f2937" stroke="#10b981" strokeWidth="2" />
          <text x="0" y="-8" textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="monospace">SALES</text>
          <text x="0" y="12" textAnchor="middle" fill="#10b981" fontSize="16" fontWeight="bold" fontFamily="monospace">
            {formatCurrency(stats.totalSales)}
          </text>
        </g>

        {/* ROAS indicator */}
        <g transform={`translate(${width - 60}, ${height/2 + 50})`}>
          <rect x="-40" y="-20" width="80" height="40" rx="6" fill="#1f2937" stroke="#6366f1" strokeWidth="1" />
          <text x="0" y="-2" textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="monospace">ROAS</text>
          <text x="0" y="14" textAnchor="middle" fill="#6366f1" fontSize="14" fontWeight="bold" fontFamily="monospace">
            {(stats.totalSales / stats.totalSpend).toFixed(2)}x
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs">
        {placements.map(({ key, color }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{key}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-muted-foreground">Sales</span>
        </div>
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
