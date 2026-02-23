"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { sankey, sankeyJustify } from "d3-sankey";
import type { PlacementData } from "@/types";

interface SankeyChartProps {
  data: PlacementData[];
}

// Sankey Flow Component - Visualizes click flow from ad spend through placements to outcomes
export function SankeyChart({ data }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [speed, setSpeed] = useState(2.0);
  const particlesRef = useRef<any[]>([]);
  const cacheRef = useRef<Record<string, { points: { x: number; y: number }[] }>>({});
  const animationRef = useRef<number | undefined>(undefined);
  const elapsedRef = useRef(0);
  const expandedRef = useRef<Set<string>>(new Set());

  // Calculate placement stats from data
  const placementData = React.useMemo(() => {
    const stats: Record<string, { clicks: number; spend: number; sales: number; orders: number; cvr: number }> = {};

    data.forEach(row => {
      let key = "";
      if (row.placement_type === "Top of Search") key = "TOP";
      else if (row.placement_type === "Rest of Search") key = "ROS";
      else if (row.placement_type === "Product Page") key = "PP";
      else return;

      if (!stats[key]) {
        stats[key] = { clicks: 0, spend: 0, sales: 0, orders: 0, cvr: 0 };
      }
      stats[key].clicks += row.clicks_7d || 0;
      stats[key].spend += row.spend_7d || 0;
      stats[key].sales += row.sales_7d || 0;
      stats[key].orders += row.orders_7d || 0;
    });

    // Calculate CVR for each placement (orders / clicks)
    Object.keys(stats).forEach(key => {
      const s = stats[key];
      s.cvr = s.clicks > 0 ? (s.orders / s.clicks) * 100 : 0;
    });

    return stats;
  }, [data]);

  const handleReset = () => {
    particlesRef.current = [];
    elapsedRef.current = 0;
    if (svgRef.current) {
      d3.select(svgRef.current).selectAll(".p").remove();
    }
  };

  useEffect(() => {
    if (!svgRef.current || !placementData || Object.keys(placementData).length === 0) return;

    // Reset state
    particlesRef.current = [];
    elapsedRef.current = 0;

    const width = 900;
    const psize = 6;
    const margin = { top: 80, right: 220, bottom: 80, left: 10 };
    const bandHeight = 70;
    const padding = 35;

    // Build raw data structure from placement stats
    const raw: Record<string, { "clicks no sales": number; "clicks to sales": number; spend: number }> = {};

    ["TOP", "ROS", "PP"].forEach(key => {
      const p = placementData[key] || { clicks: 0, spend: 0, cvr: 5 };
      const cvr = Math.min(p.cvr, 100) / 100; // Convert percentage to decimal, cap at 100%
      raw[key] = {
        "clicks no sales": Math.round(p.clicks * (1 - cvr)),
        "clicks to sales": Math.round(p.clicks * cvr),
        "spend": p.spend
      };
    });

    const isLeaf = (d: any) => d.hasOwnProperty("clicks no sales");
    const getChildren = ({ name, ...otherProps }: any) =>
      isLeaf(otherProps) ? undefined : Object.entries(otherProps).map(([name, obj]) => ({ name, ...(obj as object) }));

    const hierarchy = d3.hierarchy({ name: "AD SPEND", ...raw }, getChildren).each((d: any) => {
      const absolutePath = (node: any): string => `${node.parent ? absolutePath(node.parent) : ""}/${node.data.name}`;
      const datum: any = { name: d.data.name, path: absolutePath(d) };
      if (isLeaf(d.data)) {
        datum.groups = [
          { key: "clicks no sales", value: d.data["clicks no sales"] },
          { key: "clicks to sales", value: d.data["clicks to sales"] },
        ];
      }
      d.data = datum;
    });

    const uniqueLeaves = [...new Set(hierarchy.leaves().map((d: any) => d.data.name))];
    const height = uniqueLeaves.length * (bandHeight + padding / 2) + 280;

    const nodes = ["AD SPEND", ...Object.keys(raw)];
    const links = Object.keys(raw).map(name => ({ source: "AD SPEND", target: name, value: 1 }));

    const sankeyLayout = sankey<any, any>()
      .nodeId((d: any) => d.name)
      .nodeAlign(sankeyJustify)
      .nodeWidth(30)
      .nodePadding(padding)
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom]);

    const sankeyData = sankeyLayout({
      nodes: nodes.map(name => ({ name, fixedValue: 1 })),
      links: links.map(l => ({ ...l }))
    });

    const walkRoutes = (n: any): any[] => {
      const subroutes = n.sourceLinks.flatMap((d: any) => walkRoutes(d.target));
      return subroutes.length ? subroutes.map((r: any) => [n, ...r]) : [[n]];
    };
    const root = sankeyData.nodes.find((d: any) => d.targetLinks.length === 0);
    const routes = root ? walkRoutes(root) : [];

    const targetsAbsolute = hierarchy.leaves().flatMap((t: any) =>
      t.data.groups.map((g: any) => ({ name: t.data.name, path: t.data.path, group: g.key, value: g.value }))
    );
    const totalP = d3.sum(targetsAbsolute, (d: any) => d.value) || 1;

    // Build a deterministic queue: exactly value[i] entries per bucket, then shuffle.
    // This guarantees final counts match the data exactly (no random drift).
    const particleQueue: any[] = [];
    targetsAbsolute.forEach((t: any) => {
      for (let i = 0; i < t.value; i++) particleQueue.push(t);
    });
    for (let i = particleQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [particleQueue[i], particleQueue[j]] = [particleQueue[j], particleQueue[i]];
    }
    let queueIndex = 0;

    const colorScale = d3.scaleOrdinal<string>().domain(["clicks to sales", "clicks no sales"]).range(["#3b82f6", "#ef4444"]);

    const leaves = sankeyData.nodes
      .filter((n: any) => n.sourceLinks.length === 0)
      .map((n: any) => ({
        node: n,
        targets: targetsAbsolute.filter((t: any) => t.name === n.name),
        spend: raw[n.name]?.spend || 0
      }));

    // Clear and setup SVG
    d3.select(svgRef.current).selectAll("*").remove();
    cacheRef.current = {};

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("overflow", "visible");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Custom path generator
    function sankeyLinkCustom(nodes: any[]) {
      const p = d3.path();
      const h = bandHeight / 2;
      nodes.forEach((n, i) => {
        if (i === 0) p.moveTo(n.x0, n.y0 + h);
        p.lineTo(n.x1, n.y0 + h);
        const nn = nodes[i + 1];
        if (nn) {
          const w = nn.x0 - n.x1;
          p.bezierCurveTo(n.x1 + w / 2, n.y0 + h, n.x1 + w / 2, nn.y0 + h, nn.x0, nn.y0 + h);
        }
      });
      return p.toString();
    }

    // Draw flow paths
    const routeLayer = g.append("g")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.3)
      .attr("stroke", "#94a3b8")
      .selectAll("path")
      .data(routes)
      .join("path")
      .attr("d", sankeyLinkCustom)
      .attr("stroke-width", bandHeight);

    // Cache path points for animation
    routeLayer.each(function(nodes: any) {
      const path = this as SVGPathElement;
      const len = path.getTotalLength();
      const key = "/" + nodes.map((n: any) => n.name).join("/");
      cacheRef.current[key] = {
        points: d3.range(len).map((l) => {
          const pt = path.getPointAtLength(l);
          return { x: pt.x, y: pt.y };
        })
      };
    });

    const particlesContainer = g.append("g");

    // Placement colors
    const placementColors: Record<string, string> = {
      "TOP": "#1d4ed8",
      "ROS": "#3b82f6",
      "PP": "#64748b"
    };

    // Store placement text elements so clicks can toggle all three together
    const placementTextEls = new Map<string, { el: any; shortName: string; fullName: string }>();

    // Labels for nodes
    g.selectAll(".label")
      .data(sankeyData.nodes)
      .join("g")
      .attr("class", "label")
      .attr("transform", (d: any) => {
        if (d.name === "AD SPEND") {
          return `translate(${d.x0}, ${d.y0 + bandHeight / 2})`;
        }
        return `translate(${d.x1 - bandHeight / 2}, ${d.y0 + bandHeight / 2})`;
      })
      .each(function(d: any) {
        const group = d3.select(this as SVGGElement);
        if (d.name === "AD SPEND") {
          // Clean single text — no stroke shadow
          group.append("text")
            .attr("text-anchor", "start")
            .style("font-family", "inherit")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .attr("fill", "#6b7280")
            .text(d.name);
        } else {
          const color = placementColors[d.name] || "#9ca3af";
          const fullName = d.name === "TOP" ? "Top of Search" :
                          d.name === "ROS" ? "Rest of Search" :
                          d.name === "PP" ? "Product Page" : d.name;

          // Badge text — clickable, all three expand/collapse together
          const textEl = group.append("text")
            .attr("x", -40)
            .attr("y", 4)
            .attr("text-anchor", "middle")
            .attr("fill", color)
            .style("font-family", "inherit")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("cursor", "pointer")
            .text(d.name);

          placementTextEls.set(d.name, { el: textEl, shortName: d.name, fullName });

          group
            .style("cursor", "pointer")
            .on("click", function() {
              const anyExpanded = expandedRef.current.size > 0;
              if (anyExpanded) {
                // Collapse all back to short names
                expandedRef.current.clear();
                placementTextEls.forEach(({ el, shortName }) => {
                  el.style("font-size", "12px").text(shortName);
                });
              } else {
                // Expand all to full names at same font size
                placementTextEls.forEach(({ el, fullName: fn }, key) => {
                  expandedRef.current.add(key);
                  el.style("font-size", "10px").text(fn);
                });
              }
            });
        }
      });

    // Description above flow
    const adSpendNode = sankeyData.nodes.find((n: any) => n.name === "AD SPEND");
    if (adSpendNode) {
      const desc = g.append("g")
        .attr("transform", `translate(${adSpendNode.x0}, ${adSpendNode.y0 - 30})`)
        .style("font-family", "inherit")
        .style("font-size", "11px")
        .style("font-weight", "500")
        .attr("fill", "#9ca3af");

      desc.append("text").text("Click Flow ");
      desc.append("text")
        .attr("class", "embedded-counter")
        .attr("x", 72)
        .attr("fill", "#3b82f6")
        .style("font-weight", "600")
        .style("font-size", "11px")
        .text(totalP.toLocaleString());
      desc.append("text")
        .attr("x", 72 + totalP.toLocaleString().length * 7 + 4)
        .text(" clicks");
    }

    // Outcomes header
    if (leaves[0]) {
      const s2 = g.append("g")
        .attr("transform", `translate(${width - margin.left - 120}, ${leaves[0].node.y0 - 40})`)
        .style("font-family", "inherit")
        .style("font-size", "11px")
        .attr("text-anchor", "end")
        .attr("fill", "#9ca3af");

      s2.append("text").attr("fill", "#3b82f6").style("font-weight", "bold").text("Clicks → Sales (orders)");
      s2.append("text").attr("y", 16).attr("fill", "#ef4444").style("font-weight", "bold").text("Clicks → No Sales");
    }

    // Progress bars and metrics for each placement
    const barWidth = 28;
    const barHeight = bandHeight;

    const barGroups = g.selectAll(".bar-group")
      .data(leaves)
      .join("g")
      .attr("class", "bar-group")
      .attr("transform", (d: any) => `translate(${d.node.x1 - 4}, ${d.node.y0})`);

    // Background bar
    barGroups.append("rect")
      .attr("width", barWidth)
      .attr("height", barHeight)
      .attr("fill", "#1f2937")
      .attr("stroke", "#374151")
      .attr("stroke-width", 1)
      .attr("rx", 2);

    // Green bar (sales) - grows from top
    barGroups.append("rect")
      .attr("class", "bar-green")
      .attr("width", barWidth)
      .attr("height", 0)
      .attr("fill", "#3b82f6")
      .attr("rx", 2);

    // Red bar (no sales) - grows from bottom
    barGroups.append("rect")
      .attr("class", "bar-red")
      .attr("x", 0)
      .attr("y", barHeight)
      .attr("width", barWidth)
      .attr("height", 0)
      .attr("fill", "#ef4444")
      .attr("rx", 2);

    // Labels — start at 0, animated to correct final values by tick()
    barGroups.append("text")
      .attr("class", "c-green")
      .attr("x", barWidth + 10).attr("y", barHeight * 0.25).attr("dy", "0.3em")
      .style("font-family", "inherit").style("font-size", "12px").style("font-weight", "bold")
      .attr("fill", "#3b82f6").text("0");

    barGroups.append("text")
      .attr("class", "c-red")
      .attr("x", barWidth + 10).attr("y", barHeight * 0.75).attr("dy", "0.3em")
      .style("font-family", "inherit").style("font-size", "12px").style("font-weight", "bold")
      .attr("fill", "#ef4444").text("0");

    barGroups.append("text")
      .attr("class", "p-green")
      .attr("x", barWidth + 50).attr("y", barHeight * 0.25).attr("dy", "0.3em")
      .style("font-family", "inherit").style("font-size", "12px").style("font-weight", "bold")
      .attr("fill", "#3b82f6").text("0%");

    barGroups.append("text")
      .attr("class", "p-red")
      .attr("x", barWidth + 50).attr("y", barHeight * 0.75).attr("dy", "0.3em")
      .style("font-family", "inherit").style("font-size", "12px").style("font-weight", "bold")
      .attr("fill", "#ef4444").text("0%");


    // Animation tick function
    function tick(t: number) {
      const speedScale = d3.scaleLinear().domain([0, 1]).range([speed, speed + 0.5]);

      // Add new particles from the pre-shuffled deterministic queue
      const pToAdd = Math.round(Math.random() * 6);
      for (let i = 0; i < pToAdd && queueIndex < particleQueue.length; i++) {
        const target = particleQueue[queueIndex++];
        if (!target || !cacheRef.current[target.path]) continue;

        particlesRef.current.push({
          id: `${t}_${i}`,
          speed: speedScale(Math.random()),
          color: colorScale(target.group),
          offset: (Math.random() - 0.5) * (bandHeight - psize),
          pos: 0,
          createdAt: t,
          length: cacheRef.current[target.path].points.length,
          target,
        });
      }

      // Update bars and all labels as particles arrive
      barGroups.each(function(d: any) {
        const placementName = d.node.name;
        const r = raw[placementName];
        // Total expected clicks for this placement (from real data)
        const totalClicks = r ? r["clicks to sales"] + r["clicks no sales"] : 1;

        const kf = particlesRef.current.filter((p: any) =>
          p.target.name === placementName && p.target.group === "clicks to sales" && p.pos >= p.length
        ).length;
        const af = particlesRef.current.filter((p: any) =>
          p.target.name === placementName && p.target.group === "clicks no sales" && p.pos >= p.length
        ).length;
        const tot = kf + af;

        // Bars animate based on arrived vs expected
        d3.select(this).select(".bar-green")
          .attr("height", Math.min(barHeight, (kf / totalClicks) * barHeight));
        d3.select(this).select(".bar-red")
          .attr("y", barHeight - Math.min(barHeight, (af / totalClicks) * barHeight))
          .attr("height", Math.min(barHeight, (af / totalClicks) * barHeight));

        // Labels count up — percentages stabilise at correct final value
        d3.select(this).select(".p-green").text(tot > 0 ? Math.round(kf / tot * 100) + "%" : "0%");
        d3.select(this).select(".p-red").text(tot > 0 ? Math.round(af / tot * 100) + "%" : "0%");
        d3.select(this).select(".c-green").text(kf);
        d3.select(this).select(".c-red").text(af);

      });

      // Move particles
      particlesContainer
        .selectAll<SVGRectElement, any>(".p")
        .data(particlesRef.current, (d: any) => d.id)
        .join(
          enter => enter.append("rect")
            .attr("class", "p")
            .attr("opacity", 0.9)
            .attr("fill", (d: any) => d.color)
            .attr("width", psize)
            .attr("height", psize)
            .attr("rx", 1)
        )
        .each(function(d: any) {
          const localTime = t - d.createdAt;
          d.pos = localTime * d.speed;
          const idx = Math.floor(d.pos);
          const points = cacheRef.current[d.target.path]?.points;

          if (!points) return;

          if (d.pos >= d.length) {
            const last = points[d.length - 1];
            if (last) {
              d3.select(this).attr("x", last.x).attr("y", last.y + d.offset);
            }
          } else {
            const coo = points[idx];
            const next = points[idx + 1];
            if (coo && next) {
              const delta = d.pos - idx;
              const x = coo.x + (next.x - coo.x) * delta;
              const y = coo.y + (next.y - coo.y) * delta;

              // Squeeze effect near end
              const lastX = points[d.length - 1]?.x || x;
              const squeeze = Math.max(0, psize - (lastX - x));
              const h = Math.max(2, psize - squeeze);
              const dy = (psize - h) / 2;
              const w = psize + squeeze;
              const dx = squeeze / 2;

              d3.select(this)
                .attr("x", x - dx)
                .attr("y", y + d.offset + dy)
                .attr("height", h)
                .attr("width", w);
            }
          }
        });
    }

    // Animation loop
    function animate() {
      tick(elapsedRef.current++);
      animationRef.current = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [placementData, speed]);

  // Check if we have data
  const hasData = Object.keys(placementData).length > 0 &&
    Object.values(placementData).some(p => p.clicks > 0 || p.spend > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-sm">No click data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4 px-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Speed</label>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-24 h-1.5 accent-primary rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 w-8">{speed.toFixed(1)}</span>
        </div>
        <button
          onClick={handleReset}
          className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
        >
          Reset
        </button>
      </div>

      {/* SVG Container */}
      <div className="overflow-x-auto">
        <svg ref={svgRef} className="w-full" style={{ minHeight: '380px' }} />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#3b82f6" }} />
          <span className="text-muted-foreground">Clicks → Sales (orders)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#ef4444" }} />
          <span className="text-muted-foreground">Clicks → No Sales</span>
        </div>
      </div>
    </div>
  );
}

// Simple bar-based spend distribution chart (fallback)
export function SpendFlowChart({ data }: { data: PlacementData[] }) {
  const stats = React.useMemo(() => {
    const byPlacement = data.reduce(
      (acc, row) => {
        const placement = row.placement_type || "Unknown";
        if (!acc[placement]) {
          acc[placement] = { spend: 0, sales: 0, clicks: 0, orders: 0 };
        }
        acc[placement].spend += row.spend_7d || 0;
        acc[placement].sales += row.sales_7d || 0;
        acc[placement].clicks += row.clicks_7d || 0;
        acc[placement].orders += row.orders_7d || 0;
        return acc;
      },
      {} as Record<string, { spend: number; sales: number; clicks: number; orders: number }>
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
    { key: "Top of Search", short: "TOP", color: "#1d4ed8" },
    { key: "Rest of Search", short: "ROS", color: "#3b82f6" },
    { key: "Product Page", short: "PP",  color: "#64748b" },
  ];

  return (
    <div className="space-y-6">
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
                    {value.toLocaleString("en-US", { style: "currency", currency: "USD" })} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Click Outcomes — mirrors the Sankey OUTCOMES columns */}
      <div className="pt-2 border-t border-border">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Click Outcomes</h4>
        <div className="w-full">
          {/* Header row */}
          <div className="grid grid-cols-[100px_1fr_1fr_1fr_1fr] gap-x-2 mb-1 px-1">
            <span />
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">sales</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">clicks</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">no sale</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">clicks</span>
            </div>
            <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider text-right">→ sales</span>
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider text-right">→ no sale</span>
          </div>
          {(() => {
            let totalCS = 0, totalCN = 0, totalSS = 0, totalSN = 0;
            return (
              <>
                {placements.map(({ key, short, color }) => {
                  const p = stats.byPlacement[key];
                  if (!p) return null;
                  const cvr = p.clicks > 0 ? p.orders / p.clicks : 0;
                  const clicksSales   = Math.round(p.clicks * cvr);
                  const clicksNoSales = p.clicks - clicksSales;
                  const spendSales    = p.spend * cvr;
                  const spendNoSales  = p.spend - spendSales;
                  const pctSales   = p.clicks > 0 ? (cvr * 100).toFixed(0) : "0";
                  const pctNoSales = p.clicks > 0 ? ((1 - cvr) * 100).toFixed(0) : "0";
                  totalCS += clicksSales;
                  totalCN += clicksNoSales;
                  totalSS += spendSales;
                  totalSN += spendNoSales;
                  return (
                    <div key={key} className="border-b border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-[100px_1fr_1fr_1fr_1fr] gap-x-2 pt-2 pb-0.5 px-1 items-center">
                        <span className="text-[10px] font-semibold leading-tight" style={{ color }}>{key}</span>
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold tabular-nums text-blue-500">{pctSales}%</span>
                          <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">{clicksSales}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold tabular-nums text-red-500">{pctNoSales}%</span>
                          <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">{clicksNoSales}</span>
                        </div>
                        <div className="text-right text-xs font-bold tabular-nums text-blue-500">${Math.round(spendSales)}</div>
                        <div className="text-right text-xs font-bold tabular-nums text-red-500">${Math.round(spendNoSales)}</div>
                      </div>
                      <div className="h-1.5 mx-1 mb-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <div className="h-full flex">
                          <div className="h-full transition-all duration-500" style={{ width: `${pctSales}%`, backgroundColor: '#3b82f6' }} />
                          <div className="h-full transition-all duration-500" style={{ width: `${pctNoSales}%`, backgroundColor: '#ef4444' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Totals row */}
                {(() => {
                  return (
                    <div className="grid grid-cols-[100px_1fr_1fr_1fr_1fr] gap-x-2 py-2 px-1 border-t-2 border-slate-300 dark:border-slate-600 mt-0.5 items-center">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold tabular-nums text-blue-500">{totalCS}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold tabular-nums text-red-500">{totalCN}</span>
                      </div>
                      <div className="text-right text-xs font-bold tabular-nums text-blue-500">${Math.round(totalSS)}</div>
                      <div className="text-right text-xs font-bold tabular-nums text-red-500">${Math.round(totalSN)}</div>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">
            {stats.totalSpend.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-muted-foreground">Total Spend</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.totalSales.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-muted-foreground">Total Sales</div>
        </div>
      </div>

      <div className="text-center pt-4 border-t border-border">
        <div className="text-3xl font-bold">
          <span className={
            stats.totalSpend > 0 && stats.totalSales / stats.totalSpend > 3 ? "text-green-600 dark:text-green-400" :
            stats.totalSpend > 0 && stats.totalSales / stats.totalSpend > 2 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
          }>
            {stats.totalSpend > 0 ? (stats.totalSales / stats.totalSpend).toFixed(2) : "0.00"}x
          </span>
        </div>
        <div className="text-xs text-muted-foreground">Return on Ad Spend</div>
      </div>
    </div>
  );
}
