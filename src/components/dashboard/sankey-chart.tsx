"use client";

import * as React from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, sankeyLeft, SankeyNode, SankeyLink } from "d3-sankey";
import type { PlacementData } from "@/types";

interface SankeyChartProps {
  data: PlacementData[];
  width?: number;
  height?: number;
}

interface Node {
  name: string;
  category: "placement" | "metric" | "outcome";
}

interface Link {
  source: number;
  target: number;
  value: number;
}

type SankeyNodeExtended = SankeyNode<Node, Link> & Node;

interface SankeyLinkExtended {
  source: SankeyNodeExtended;
  target: SankeyNodeExtended;
  value: number;
  width?: number;
}

// Color scheme for different node categories
const categoryColors = {
  placement: {
    "Top of Search": "#00ff94", // Primary green
    "Rest of Search": "#0095ff", // Secondary blue
    "Product Page": "#ff9500", // Warning orange
  },
  metric: {
    Impressions: "#6366f1",
    Clicks: "#8b5cf6",
  },
  outcome: {
    Sales: "#10b981",
    "No Sale": "#64748b",
  },
};

const getNodeColor = (node: SankeyNodeExtended): string => {
  const colors = categoryColors[node.category];
  if (colors && node.name in colors) {
    return colors[node.name as keyof typeof colors];
  }
  // Fallback colors by category
  switch (node.category) {
    case "placement":
      return "#00ff94";
    case "metric":
      return "#8b5cf6";
    case "outcome":
      return "#10b981";
    default:
      return "#64748b";
  }
};

// Transform placement data into Sankey format
function transformToSankeyData(placements: PlacementData[]): { nodes: Node[]; links: Link[] } {
  if (placements.length === 0) {
    return { nodes: [], links: [] };
  }

  // Aggregate data by placement type
  const placementStats = placements.reduce(
    (acc, row) => {
      const placement = row.placement_type || "Unknown";
      if (!acc[placement]) {
        acc[placement] = {
          impressions: 0,
          clicks: 0,
          sales: 0,
          spend: 0,
          orders: 0,
        };
      }
      acc[placement].impressions += row.impressions || 0;
      acc[placement].clicks += row.clicks || 0;
      acc[placement].sales += row.sales || 0;
      acc[placement].spend += row.spend || 0;
      acc[placement].orders += row.orders || 0;
      return acc;
    },
    {} as Record<string, { impressions: number; clicks: number; sales: number; spend: number; orders: number }>
  );

  // Build nodes
  const nodes: Node[] = [];
  const nodeIndexMap: Record<string, number> = {};

  // Add placement nodes
  const placementTypes = Object.keys(placementStats);
  placementTypes.forEach((placement) => {
    nodeIndexMap[`placement-${placement}`] = nodes.length;
    nodes.push({ name: placement, category: "placement" });
  });

  // Add metric nodes (Clicks)
  nodeIndexMap["metric-Clicks"] = nodes.length;
  nodes.push({ name: "Clicks", category: "metric" });

  // Add outcome nodes
  nodeIndexMap["outcome-Sales"] = nodes.length;
  nodes.push({ name: "Sales", category: "outcome" });

  nodeIndexMap["outcome-NoSale"] = nodes.length;
  nodes.push({ name: "No Sale", category: "outcome" });

  // Build links
  const links: Link[] = [];

  placementTypes.forEach((placement) => {
    const stats = placementStats[placement];
    const placementIdx = nodeIndexMap[`placement-${placement}`];
    const clicksIdx = nodeIndexMap["metric-Clicks"];
    const salesIdx = nodeIndexMap["outcome-Sales"];
    const noSaleIdx = nodeIndexMap["outcome-NoSale"];

    // Placement -> Clicks (use spend as the flow value for visual impact)
    if (stats.spend > 0) {
      links.push({
        source: placementIdx,
        target: clicksIdx,
        value: stats.spend,
      });
    }
  });

  // Calculate total metrics for Clicks -> Outcomes
  const totalSpend = Object.values(placementStats).reduce((sum, s) => sum + s.spend, 0);
  const totalSales = Object.values(placementStats).reduce((sum, s) => sum + s.sales, 0);
  const totalOrders = Object.values(placementStats).reduce((sum, s) => sum + s.orders, 0);

  // Clicks -> Sales (proportion that converted)
  if (totalSales > 0) {
    links.push({
      source: nodeIndexMap["metric-Clicks"],
      target: nodeIndexMap["outcome-Sales"],
      value: totalSales,
    });
  }

  // Clicks -> No Sale (spend that didn't convert)
  const wastedSpend = Math.max(0, totalSpend - totalSales);
  if (wastedSpend > 0) {
    links.push({
      source: nodeIndexMap["metric-Clicks"],
      target: nodeIndexMap["outcome-NoSale"],
      value: wastedSpend,
    });
  }

  return { nodes, links };
}

export function SankeyChart({ data, width = 800, height = 400 }: SankeyChartProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width, height });
  const [tooltip, setTooltip] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
  }>({ visible: false, x: 0, y: 0, content: "" });

  // Handle resize
  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width: containerWidth } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(containerWidth - 32, 400),
          height: Math.min(Math.max(containerWidth * 0.5, 300), 500),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Draw the Sankey diagram
  React.useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const { nodes, links } = transformToSankeyData(data);
    if (nodes.length === 0 || links.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 120, bottom: 20, left: 20 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create Sankey generator
    const sankeyGenerator = sankey<Node, Link>()
      .nodeId((d) => d.name)
      .nodeWidth(20)
      .nodePadding(20)
      .nodeAlign(sankeyLeft)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ]);

    // Generate layout
    let sankeyData;
    try {
      // Ensure all links have a value > 0 as required by d3-sankey
      const validLinks = links.filter(l => l.value > 0).map(d => ({ ...d }));
      const validNodes = nodes.map(d => ({ ...d }));

      // Only run if we have both nodes and valid links
      if (validNodes.length === 0 || validLinks.length === 0) {
        svg.append("text")
           .attr("x", innerWidth / 2)
           .attr("y", innerHeight / 2)
           .attr("text-anchor", "middle")
           .attr("fill", "currentColor")
           .text("Insufficient data for flow visualization");
        return;
      }

      sankeyData = sankeyGenerator({
        nodes: validNodes,
        links: validLinks,
      });
    } catch (err) {
      console.error("Sankey layout failed:", err);
      return;
    }

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyData;

    // Draw links
    const linkGroup = g.append("g").attr("class", "links");

    linkGroup
      .selectAll("path")
      .data(sankeyLinks as SankeyLinkExtended[])
      .join("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("fill", "none")
      .attr("stroke", (d) => getNodeColor(d.source))
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d) => Math.max(1, d.width || 1))
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("stroke-opacity", 0.7);
        const value = d.value.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        });
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: `${d.source.name} → ${d.target.name}: ${value}`,
        });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => ({ ...prev, x: event.pageX, y: event.pageY }));
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-opacity", 0.4);
        setTooltip((prev) => ({ ...prev, visible: false }));
      });

    // Draw nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const nodeRects = nodeGroup
      .selectAll("g")
      .data(sankeyNodes as SankeyNodeExtended[])
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    nodeRects
      .append("rect")
      .attr("width", (d) => (d.x1 || 0) - (d.x0 || 0))
      .attr("height", (d) => (d.y1 || 0) - (d.y0 || 0))
      .attr("fill", (d) => getNodeColor(d))
      .attr("rx", 4)
      .attr("ry", 4)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("opacity", 0.8);
        const value = (d.value || 0).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
        });
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: `${d.name}: ${value}`,
        });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => ({ ...prev, x: event.pageX, y: event.pageY }));
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 1);
        setTooltip((prev) => ({ ...prev, visible: false }));
      });

    // Add node labels
    nodeRects
      .append("text")
      .attr("x", (d) => ((d.x1 || 0) - (d.x0 || 0)) + 8)
      .attr("y", (d) => ((d.y1 || 0) - (d.y0 || 0)) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("fill", "currentColor")
      .attr("class", "text-xs font-mono")
      .text((d) => {
        const value = (d.value || 0).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });
        return `${d.name} (${value})`;
      });
  }, [data, dimensions]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4">📈</div>
          <p className="text-sm">No data available for visualization</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
      />
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-2 text-xs font-mono bg-popover text-popover-foreground border border-border rounded-lg shadow-xl pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
          }}
        >
          {tooltip.content}
        </div>
      )}
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
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#10b981" }} />
          <span className="text-muted-foreground">Sales</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#64748b" }} />
          <span className="text-muted-foreground">No Sale</span>
        </div>
      </div>
    </div>
  );
}

// Alternative: Simple bar-based flow visualization for when data is sparse
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
