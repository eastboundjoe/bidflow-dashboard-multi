"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { PlacementData } from "@/types";

interface PerformanceChartProps {
  data: PlacementData[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  // Aggregate data by week
  const chartData = React.useMemo(() => {
    const weeklyMap = new Map<string, { week: string; spend: number; sales: number; acos: number }>();

    data.forEach((item) => {
      const week = item.week_id;
      const current = weeklyMap.get(week) || { week, spend: 0, sales: 0, acos: 0 };
      
      current.spend += item.spend;
      current.sales += item.sales;
      
      weeklyMap.set(week, current);
    });

    // Convert map to array and sort by week (assuming week_id is sortable like "2024-W01")
    return Array.from(weeklyMap.values())
      .sort((a, b) => a.week.localeCompare(b.week))
      .map(item => ({
        ...item,
        acos: item.sales > 0 ? (item.spend / item.sales) * 100 : 0
      }));
  }, [data]);

  const chartConfig = {
    spend: {
      label: "Ad Spend",
      color: "hsl(var(--primary))",
    },
    sales: {
      label: "Sales",
      color: "hsl(var(--secondary))",
    },
  } satisfies ChartConfig;

  if (chartData.length === 0) {
    return (
      <Card className="flex h-[400px] items-center justify-center text-muted-foreground">
        No performance data available for the selected filters.
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
        <CardDescription>
          Weekly ad spend vs sales performance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[350px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.replace(/^\d{4}-W/, "W")}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="spend"
              type="monotone"
              fill="var(--color-spend)"
              fillOpacity={0.4}
              stroke="var(--color-spend)"
              stackId="a"
            />
            <Area
              dataKey="sales"
              type="monotone"
              fill="var(--color-sales)"
              fillOpacity={0.4}
              stroke="var(--color-sales)"
              stackId="b"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
