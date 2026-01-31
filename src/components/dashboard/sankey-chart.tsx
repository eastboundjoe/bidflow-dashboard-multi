"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { sankey, sankeyJustify } from "d3-sankey";
import type { PlacementData } from "@/types";

interface SankeyChartProps {
  data: PlacementData[];
  width?: number;
  height?: number;
}

// D3-based Animated Flow Diagram
export function SankeyChart({ data }: SankeyChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const particlesRef = useRef<any[]>([]);
  const cacheRef = useRef<any>({});
  const animationRef = useRef<number | undefined>(undefined);
  const elapsedRef = useRef(0);

  // Calculate stats from data
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

    return { byPlacement, totalSpend, totalSales };
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || data.length === 0 || stats.totalSpend === 0) return;

    // Configuration
    const width = 700;
    const height = 350;
    const psize = 6;
    const margin = { top: 40, right: 100, bottom: 20, left: 10 };
    const bandHeight = 50;
    const padding = 30;
    const speed = 0.8;
    const density = 5;

    // Placement colors
    const placementColors: Record<string, string> = {
      "Top of Search": "#00ff94",
      "Rest of Search": "#0095ff",
      "Product Page": "#ff9500",
    };

    // Build node/link structure: Ad Spend -> Placements -> Sales
    const placements = ["Top of Search", "Rest of Search", "Product Page"];

    const nodes = [
      { name: "Ad Spend" },
      ...placements.map(p => ({ name: p })),
      { name: "Sales" }
    ];

    // Links: Ad Spend to each placement, each placement to Sales
    const links: any[] = [];
    placements.forEach(p => {
      const placementData = stats.byPlacement[p] || { spend: 0, sales: 0 };
      if (placementData.spend > 0) {
        links.push({ source: "Ad Spend", target: p, value: placementData.spend });
        links.push({ source: p, target: "Sales", value: placementData.sales });
      }
    });

    // Prepare data for Sankey layout
    const dataForSankey = {
      nodes: nodes.map(n => ({ ...n, fixedValue: 1 })),
      links: links.map(l => ({ ...l, value: Math.max(l.value, 1) })),
    };

    // Create Sankey layout
    const sankeyLayout = sankey()
      .nodeId((d: any) => d.name)
      .nodeAlign(sankeyJustify)
      .nodeWidth(40)
      .nodePadding(padding)
      .size([width - margin.left - margin.right, height - margin.top - margin.bottom]);

    const sankeyData = sankeyLayout(dataForSankey as any);

    // Generate routes
    const walkRoutes = (n: any): any[] => {
      const subroutes = n.sourceLinks.flatMap((d: any) => walkRoutes(d.target));
      return subroutes.length ? subroutes.map((r: any) => [n, ...r]) : [[n]];
    };

    const root = sankeyData.nodes.find((d: any) => d.targetLinks?.length === 0);
    const routes = root ? walkRoutes(root) : [];

    // Create particle targets based on spend proportion
    const targets: any[] = [];
    placements.forEach(p => {
      const placementData = stats.byPlacement[p] || { spend: 0, sales: 0 };
      if (placementData.spend > 0) {
        const proportion = placementData.spend / stats.totalSpend;
        targets.push({
          name: p,
          path: `/Ad Spend/${p}/Sales`,
          value: proportion,
          color: placementColors[p],
        });
      }
    });

    const totalParticles = 200;
    const thresholds = d3.range(targets.length).map(i =>
      d3.sum(targets.slice(0, i + 1).map(r => r.value))
    );
    const targetScale = d3.scaleThreshold<number, any>().domain(thresholds).range(targets);

    // Scales
    const offsetScale = d3.scaleLinear().range([-bandHeight / 2 + psize, bandHeight / 2 - psize]);
    const speedScale = d3.scaleLinear().range([speed, speed + 0.4]);

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();
    particlesRef.current = [];
    cacheRef.current = {};
    elapsedRef.current = 0;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("overflow", "visible");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Custom path generator
    function sankeyLinkCustom(nodes: any[]) {
      const p = d3.path();
      const h = bandHeight / 2;
      nodes.forEach((n, i) => {
        if (i === 0) {
          p.moveTo(n.x0, n.y0 + h);
        }
        p.lineTo(n.x1, n.y0 + h);
        const nn = nodes[i + 1];
        if (nn) {
          const w = nn.x0 - n.x1;
          p.bezierCurveTo(n.x1 + w / 2, n.y0 + h, n.x1 + w / 2, nn.y0 + h, nn.x0, nn.y0 + h);
        }
      });
      return p.toString();
    }

    // Draw paths
    const route = g.append("g")
      .attr("class", "routes")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.15)
      .attr("stroke", "#888")
      .selectAll("path")
      .data(routes)
      .join("path")
      .attr("d", sankeyLinkCustom)
      .attr("stroke-width", bandHeight);

    // Cache path points
    route.each(function(nodes: any) {
      const path = this as SVGPathElement;
      const length = path.getTotalLength();
      const points = d3.range(length).map(l => {
        const point = path.getPointAtLength(l);
        return { x: point.x, y: point.y };
      });
      const key = "/" + nodes.map((n: any) => n.name).join("/");
      cacheRef.current[key] = { points };
    });

    // Particle container
    const particlesContainer = g.append("g");

    // Node labels and boxes
    sankeyData.nodes.forEach((node: any) => {
      const isPlacement = placements.includes(node.name);
      const color = isPlacement ? placementColors[node.name] :
                    node.name === "Ad Spend" ? "#00ff94" : "#10b981";

      const nodeG = g.append("g")
        .attr("transform", `translate(${node.x0}, ${node.y0})`);

      // Node rectangle
      nodeG.append("rect")
        .attr("width", node.x1 - node.x0)
        .attr("height", bandHeight)
        .attr("fill", "#1f2937")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("rx", 6);

      // Node label
      nodeG.append("text")
        .attr("x", (node.x1 - node.x0) / 2)
        .attr("y", bandHeight / 2 - 8)
        .attr("text-anchor", "middle")
        .attr("fill", color)
        .attr("font-size", "11px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(node.name === "Top of Search" ? "TOP" :
              node.name === "Rest of Search" ? "ROS" :
              node.name === "Product Page" ? "PP" : node.name.toUpperCase());

      // Value label
      const value = node.name === "Ad Spend" ? stats.totalSpend :
                    node.name === "Sales" ? stats.totalSales :
                    stats.byPlacement[node.name]?.spend || 0;

      nodeG.append("text")
        .attr("x", (node.x1 - node.x0) / 2)
        .attr("y", bandHeight / 2 + 10)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", "12px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));
    });

    // ROAS indicator
    const roas = stats.totalSpend > 0 ? (stats.totalSales / stats.totalSpend).toFixed(2) : "0.00";
    const salesNode = sankeyData.nodes.find((n: any) => n.name === "Sales");
    if (salesNode && salesNode.x0 !== undefined) {
      const roasG = g.append("g")
        .attr("transform", `translate(${(salesNode.x0 || 0) + 10}, ${(salesNode.y1 || 0) + 15})`);

      roasG.append("rect")
        .attr("width", 60)
        .attr("height", 30)
        .attr("fill", "#1f2937")
        .attr("stroke", "#6366f1")
        .attr("stroke-width", 1)
        .attr("rx", 4);

      roasG.append("text")
        .attr("x", 30)
        .attr("y", 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#9ca3af")
        .attr("font-size", "8px")
        .attr("font-family", "monospace")
        .text("ROAS");

      roasG.append("text")
        .attr("x", 30)
        .attr("y", 24)
        .attr("text-anchor", "middle")
        .attr("fill", "#6366f1")
        .attr("font-size", "12px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(`${roas}x`);
    }

    // Animation functions
    function addParticlesMaybe(t: number) {
      const particlesToAdd = Math.round(Math.random() * density);
      for (let i = 0; i < particlesToAdd && particlesRef.current.length < totalParticles; i++) {
        const target = targetScale(Math.random());
        if (!target || !cacheRef.current[target.path]) continue;

        const length = cacheRef.current[target.path].points.length;
        const particle = {
          id: `${t}_${i}`,
          speed: speedScale(Math.random()),
          color: target.color,
          offset: offsetScale(Math.random()),
          pos: 0,
          createdAt: t,
          length,
          target,
        };
        particlesRef.current.push(particle);
      }
    }

    function moveParticles(t: number) {
      particlesContainer
        .selectAll<SVGRectElement, any>(".particle")
        .data(particlesRef.current, (d: any) => d.id)
        .join(
          enter => enter
            .append("rect")
            .attr("class", "particle")
            .attr("opacity", 0.9)
            .attr("fill", (d: any) => d.color)
            .attr("width", psize)
            .attr("height", psize)
            .attr("rx", 2),
          update => update,
          exit => exit.remove()
        )
        .each(function(d: any) {
          const localTime = t - d.createdAt;
          d.pos = localTime * d.speed;
          const index = Math.floor(d.pos);

          if (d.pos >= d.length) {
            // Particle finished - fade out
            const lastPoint = cacheRef.current[d.target.path].points[d.length - 1];
            d3.select(this)
              .attr("x", lastPoint.x)
              .attr("y", lastPoint.y + d.offset)
              .attr("opacity", 0.3);
          } else {
            const coo = cacheRef.current[d.target.path].points[index];
            const nextCoo = cacheRef.current[d.target.path].points[index + 1];

            if (coo && nextCoo) {
              const delta = d.pos - index;
              const x = coo.x + (nextCoo.x - coo.x) * delta;
              const y = coo.y + (nextCoo.y - coo.y) * delta;

              d3.select(this)
                .attr("x", x - psize / 2)
                .attr("y", y + d.offset - psize / 2)
                .attr("opacity", 0.9);
            }
          }
        });
    }

    function tick(t: number) {
      addParticlesMaybe(t);
      moveParticles(t);

      // Remove finished particles after a delay
      particlesRef.current = particlesRef.current.filter(p => p.pos < p.length + 50);
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
  }, [data, stats]);

  if (data.length === 0 || stats.totalSpend === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-sm">No spend data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg ref={svgRef} className="w-full" style={{ minHeight: '350px' }} />

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#00ff94" }} />
          <span className="text-muted-foreground">Top of Search</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#0095ff" }} />
          <span className="text-muted-foreground">Rest of Search</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#ff9500" }} />
          <span className="text-muted-foreground">Product Page</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-muted-foreground">Sales</span>
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
