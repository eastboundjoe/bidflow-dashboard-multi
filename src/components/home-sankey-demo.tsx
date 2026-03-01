"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { SankeyChart } from "@/components/dashboard/sankey-chart";
import type { PlacementData } from "@/types";

const DEMO_CAMPAIGNS: { label: string; data: Partial<PlacementData>[] }[] = [
  {
    label: "Campaign A",
    data: [
      { placement_type: "Top of Search",  clicks_7d: 180, spend_7d: 95,  orders_7d: 14, sales_7d: 420 },
      { placement_type: "Rest of Search", clicks_7d: 210, spend_7d: 88,  orders_7d: 8,  sales_7d: 192 },
      { placement_type: "Product Page",   clicks_7d: 140, spend_7d: 72,  orders_7d: 4,  sales_7d: 80  },
    ],
  },
  {
    label: "Campaign B",
    data: [
      { placement_type: "Top of Search",  clicks_7d: 95,  spend_7d: 60,  orders_7d: 9,  sales_7d: 270 },
      { placement_type: "Rest of Search", clicks_7d: 320, spend_7d: 110, orders_7d: 12, sales_7d: 264 },
      { placement_type: "Product Page",   clicks_7d: 80,  spend_7d: 40,  orders_7d: 2,  sales_7d: 44  },
    ],
  },
  {
    label: "Campaign C",
    data: [
      { placement_type: "Top of Search",  clicks_7d: 60,  spend_7d: 50,  orders_7d: 3,  sales_7d: 90  },
      { placement_type: "Rest of Search", clicks_7d: 90,  spend_7d: 55,  orders_7d: 4,  sales_7d: 88  },
      { placement_type: "Product Page",   clicks_7d: 280, spend_7d: 130, orders_7d: 18, sales_7d: 540 },
    ],
  },
];

export function HomeSankeyDemo() {
  const [activeIdx, setActiveIdx] = React.useState(0);

  return (
    <section className="py-20 bg-slate-50 dark:bg-gray-950 border-t border-slate-100 dark:border-slate-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
            Live Demo
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
            See Your Click Flow In Action
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Watch how ad spend flows through each placement type — and where conversions actually happen.
          </p>
        </div>

        {/* Campaign switcher */}
        <div className="flex gap-2 justify-center mb-8 flex-wrap">
          {DEMO_CAMPAIGNS.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                activeIdx === i
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Live Sankey */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden p-6">
          <SankeyChart data={DEMO_CAMPAIGNS[activeIdx].data as PlacementData[]} />
        </div>
      </div>
    </section>
  );
}
