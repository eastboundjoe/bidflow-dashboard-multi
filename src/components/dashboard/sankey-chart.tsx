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
  const spendCounterRef = useRef<Record<string, { sales: number; noSales: number }>>({});

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
    spendCounterRef.current = {};
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
    const thresholds = d3.range(targetsAbsolute.length).map((i) =>
      d3.sum(targetsAbsolute.slice(0, i + 1).map((r: any) => r.value / totalP))
    );
    const targetScale = d3.scaleThreshold<number, any>().domain(thresholds).range(targetsAbsolute);

    const colorScale = d3.scaleOrdinal<string>().domain(["clicks to sales", "clicks no sales"]).range(["#3b82f6", "#ef4444"]);

    const leaves = sankeyData.nodes
      .filter((n: any) => n.sourceLinks.length === 0)
      .map((n: any) => ({
        node: n,
        targets: targetsAbsolute.filter((t: any) => t.name === n.name),
        spend: raw[n.name]?.spend || 0
      }));

    // Initialize CPC for each placement
    const cpcByPlacement: Record<string, number> = {};
    leaves.forEach((leaf: any) => {
      const totalClicks = leaf.targets.reduce((sum: number, t: any) => sum + t.value, 0);
      cpcByPlacement[leaf.node.name] = totalClicks > 0 ? leaf.spend / totalClicks : 0;
      if (!spendCounterRef.current[leaf.node.name]) {
        spendCounterRef.current[leaf.node.name] = { sales: 0, noSales: 0 };
      }
    });

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
          group.append("text")
            .attr("stroke", "#111827")
            .attr("stroke-width", 4)
            .attr("text-anchor", "start")
            .style("font-family", "monospace")
            .style("font-size", "16px")
            .style("font-weight", "700")
            .attr("fill", "#9ca3af")
            .text(d.name);
          group.append("text")
            .attr("fill", "#f3f4f6")
            .attr("text-anchor", "start")
            .style("font-family", "monospace")
            .style("font-size", "16px")
            .style("font-weight", "700")
            .text(d.name);
        } else {
          const color = placementColors[d.name] || "#9ca3af";
          const fullName = d.name === "TOP" ? "Top of Search" :
                          d.name === "ROS" ? "Rest of Search" :
                          d.name === "PP" ? "Product Page" : d.name;

          // Badge background
          group.append("rect")
            .attr("x", -80)
            .attr("y", -14)
            .attr("width", 80)
            .attr("height", 28)
            .attr("rx", 4)
            .attr("fill", "#1f2937")
            .attr("stroke", color)
            .attr("stroke-width", 2);

          // Badge text
          group.append("text")
            .attr("x", -40)
            .attr("y", 4)
            .attr("text-anchor", "middle")
            .attr("fill", color)
            .style("font-family", "monospace")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .text(d.name);
        }
      });

    // Description above flow
    const adSpendNode = sankeyData.nodes.find((n: any) => n.name === "AD SPEND");
    if (adSpendNode) {
      const desc = g.append("g")
        .attr("transform", `translate(${adSpendNode.x0}, ${adSpendNode.y0 - 30})`)
        .style("font-family", "monospace")
        .style("font-size", "11px")
        .attr("fill", "#9ca3af");

      desc.append("text").text("CLICK FLOW ");
      desc.append("text")
        .attr("class", "embedded-counter")
        .attr("x", 85)
        .attr("fill", "#0095ff")
        .style("font-weight", "bold")
        .style("font-size", "13px")
        .text(totalP.toLocaleString());
      desc.append("text")
        .attr("x", 85 + totalP.toLocaleString().length * 8 + 5)
        .text(" CLICKS");
    }

    // Outcomes header
    if (leaves[0]) {
      const s2 = g.append("g")
        .attr("transform", `translate(${width - margin.left - 120}, ${leaves[0].node.y0 - 40})`)
        .style("font-family", "monospace")
        .style("font-size", "11px")
        .attr("text-anchor", "end")
        .attr("fill", "#9ca3af");

      s2.append("text").text("OUTCOMES");
      s2.append("text").attr("y", 16).attr("fill", "#3b82f6").style("font-weight", "bold").text("sales");
      s2.append("text").attr("y", 30).attr("fill", "#ef4444").style("font-weight", "bold").text("no sales");

      // Spend header
      const s4 = g.append("g")
        .attr("transform", `translate(${width - margin.left + 10}, ${leaves[0].node.y0 - 40})`)
        .style("font-family", "monospace")
        .style("font-size", "11px")
        .attr("text-anchor", "end")
        .attr("fill", "#9ca3af");

      s4.append("text").text("SPEND");
      s4.append("text").attr("y", 16).attr("fill", "#3b82f6").style("font-weight", "bold").text("→ sales");
      s4.append("text").attr("y", 30).attr("fill", "#ef4444").style("font-weight", "bold").text("→ no sales");
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

    // Percentage labels
    barGroups.append("text")
      .attr("class", "p-green")
      .attr("x", barWidth + 10)
      .attr("y", barHeight * 0.25)
      .attr("dy", "0.3em")
      .style("font-family", "monospace")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .attr("fill", "#3b82f6")
      .text("0%");

    barGroups.append("text")
      .attr("class", "p-red")
      .attr("x", barWidth + 10)
      .attr("y", barHeight * 0.75)
      .attr("dy", "0.3em")
      .style("font-family", "monospace")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .attr("fill", "#ef4444")
      .text("0%");

    // Click counts
    barGroups.append("text")
      .attr("class", "c-green")
      .attr("x", barWidth + 50)
      .attr("y", barHeight * 0.25)
      .attr("dy", "0.3em")
      .style("font-family", "monospace")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .attr("fill", "#3b82f6")
      .text("0");

    barGroups.append("text")
      .attr("class", "c-red")
      .attr("x", barWidth + 50)
      .attr("y", barHeight * 0.75)
      .attr("dy", "0.3em")
      .style("font-family", "monospace")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .attr("fill", "#ef4444")
      .text("0");

    // Spend values - separate for sales and no sales
    barGroups.append("text")
      .attr("class", "spend-green")
      .attr("x", barWidth + 130)
      .attr("y", barHeight * 0.25)
      .attr("dy", "0.3em")
      .attr("text-anchor", "end")
      .style("font-family", "monospace")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .attr("fill", "#3b82f6")
      .text("$0");

    barGroups.append("text")
      .attr("class", "spend-red")
      .attr("x", barWidth + 130)
      .attr("y", barHeight * 0.75)
      .attr("dy", "0.3em")
      .attr("text-anchor", "end")
      .style("font-family", "monospace")
      .style("font-size", "11px")
      .style("font-weight", "bold")
      .attr("fill", "#ef4444")
      .text("$0");

    // Animation tick function
    function tick(t: number) {
      const speedScale = d3.scaleLinear().domain([0, 1]).range([speed, speed + 0.5]);

      // Add new particles
      const pToAdd = Math.round(Math.random() * 6);
      for (let i = 0; i < pToAdd && particlesRef.current.length < totalP; i++) {
        const target = targetScale(Math.random());
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
          counted: false
        });
      }

      // Update bars and metrics
      barGroups.each(function(d: any) {
        const exp = d3.sum(d.targets, (t: any) => t.value) || 1;
        const placementName = d.node.name;

        // Count completed particles for spend - separate by outcome
        const completedNow = particlesRef.current.filter((p: any) =>
          p.target.name === placementName && p.pos >= p.length && !p.counted
        );

        completedNow.forEach((p: any) => {
          if (cpcByPlacement[placementName]) {
            const cpc = cpcByPlacement[placementName];
            if (!spendCounterRef.current[placementName]) {
              spendCounterRef.current[placementName] = { sales: 0, noSales: 0 };
            }
            if (p.target.group === "clicks to sales") {
              spendCounterRef.current[placementName].sales += cpc;
            } else {
              spendCounterRef.current[placementName].noSales += cpc;
            }
          }
          p.counted = true;
        });

        const af = particlesRef.current.filter((p: any) =>
          p.target.name === placementName && p.target.group === "clicks no sales" && p.pos >= p.length
        ).length;
        const kf = particlesRef.current.filter((p: any) =>
          p.target.name === placementName && p.target.group === "clicks to sales" && p.pos >= p.length
        ).length;

        // Update bars
        d3.select(this).select(".bar-green")
          .attr("height", Math.min(barHeight, (kf / exp) * barHeight));
        d3.select(this).select(".bar-red")
          .attr("y", barHeight - Math.min(barHeight, (af / exp) * barHeight))
          .attr("height", Math.min(barHeight, (af / exp) * barHeight));

        // Update labels
        const tot = af + kf;
        d3.select(this).select(".p-green").text(tot > 0 ? (kf / tot * 100).toFixed(0) + "%" : "0%");
        d3.select(this).select(".p-red").text(tot > 0 ? (af / tot * 100).toFixed(0) + "%" : "0%");
        d3.select(this).select(".c-green").text(kf);
        d3.select(this).select(".c-red").text(af);

        // Update spend - separate for sales vs no sales
        const spendData = spendCounterRef.current[placementName] || { sales: 0, noSales: 0 };
        const maxSpend = d.spend || 0;
        const totalSpendSoFar = spendData.sales + spendData.noSales;
        const ratio = maxSpend > 0 && totalSpendSoFar > 0 ? Math.min(1, maxSpend / totalSpendSoFar) : 1;

        d3.select(this).select(".spend-green").text("$" + Math.round(spendData.sales * ratio));
        d3.select(this).select(".spend-red").text("$" + Math.round(spendData.noSales * ratio));
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

      {/* Click Outcomes — mirrors the Sankey OUTCOMES/SPEND columns */}
      <div className="pt-2 border-t border-border">
        <h4 className="text-sm font-medium mb-3">Click Outcomes</h4>
        <div className="w-full text-xs font-mono">
          <div className="grid grid-cols-[44px_1fr_1fr_1fr_1fr] gap-x-2 mb-1.5 text-muted-foreground">
            <span />
            <span className="text-center text-blue-500">sales</span>
            <span className="text-center text-red-500">no sale</span>
            <span className="text-right text-blue-500">→ sales</span>
            <span className="text-right text-red-500">→ no sale</span>
          </div>
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
            return (
              <div key={key} className="grid grid-cols-[44px_1fr_1fr_1fr_1fr] gap-x-2 py-1.5 border-b border-border/40 last:border-0 items-center">
                <span className="font-bold" style={{ color }}>{short}</span>
                <div className="text-center">
                  <div className="font-bold text-blue-500">{pctSales}%</div>
                  <div className="text-muted-foreground">{clicksSales}</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-red-500">{pctNoSales}%</div>
                  <div className="text-muted-foreground">{clicksNoSales}</div>
                </div>
                <div className="text-right text-blue-500">${Math.round(spendSales)}</div>
                <div className="text-right text-red-500">${Math.round(spendNoSales)}</div>
              </div>
            );
          })}
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
