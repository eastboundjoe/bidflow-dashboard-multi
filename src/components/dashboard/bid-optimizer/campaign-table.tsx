"use client";

import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { CampaignRow, CampaignRules } from "@/types";
import { cn } from "@/lib/utils";

interface CampaignTableProps {
  campaigns: CampaignRow[];
  rules: Record<string, CampaignRules>;
  onRuleChange: (campaignId: string, field: keyof CampaignRules, value: unknown) => void;
  onPreview: () => void;
  selectedCount: number;
}

const columnHelper = createColumnHelper<CampaignRow>();

function formatAcos(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(0)}%`;
}

function formatSpend(value: number): string {
  return `$${value.toFixed(2)}`;
}

function TrendBadge({ acos30d, acos7d }: { acos30d: number | null; acos7d: number | null }) {
  if (acos30d === null || acos7d === null || acos30d === 0) return null;
  const diff = acos7d - acos30d;
  if (Math.abs(diff) < 5) return <Badge variant="outline" className="text-xs text-slate-400">~</Badge>;
  if (diff < 0) return <Badge className="text-xs bg-green-100 text-green-700 border-green-200">↓ Improving</Badge>;
  return <Badge className="text-xs bg-red-100 text-red-700 border-red-200">↑ Worsening</Badge>;
}

function BudgetCheck({ yesterday, dayBefore, budget }: { yesterday: number; dayBefore: number; budget: number }) {
  if (budget <= 0) return null;
  const pct = Math.max(yesterday, dayBefore) / budget;
  if (pct >= 0.8) return <span title="Campaign is spending near its budget"><AlertTriangle className="h-4 w-4 text-yellow-500 inline-block ml-1" /></span>;
  return null;
}

function NumericRuleInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | null;
  placeholder?: string;
  onChange: (val: number | null) => void;
}) {
  const [local, setLocal] = React.useState(value !== null ? String(value) : "");

  // Sync if parent resets the value (e.g. clear all rules)
  React.useEffect(() => {
    setLocal(value !== null ? String(value) : "");
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder ?? "—"}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = parseFloat(local);
        if (local === "" || isNaN(n)) {
          setLocal("");
          onChange(null);
        } else {
          setLocal(String(n));
          onChange(n);
        }
      }}
      className="h-7 text-xs px-1.5"
    />
  );
}

function RuleInputs({
  campaignId,
  rules,
  onChange,
}: {
  campaignId: string;
  rules: CampaignRules;
  onChange: (field: keyof CampaignRules, value: unknown) => void;
}) {
  return (
    <div className="flex items-center gap-2 min-w-[480px]">
      {/* Bleeders */}
      <div className="flex flex-col items-center gap-1 w-12">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">Bleeders</span>
        <Checkbox
          checked={rules.bleeders}
          onCheckedChange={(v) => onChange("bleeders", !!v)}
        />
      </div>

      {/* High ACOS threshold */}
      <div className="flex flex-col gap-1 w-16">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">High ACOS %</span>
        <NumericRuleInput
          value={rules.high_acos_threshold}
          onChange={(v) => onChange("high_acos_threshold", v)}
        />
      </div>

      {/* Low clicks increase */}
      <div className="flex flex-col gap-1 w-16">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">Low Clicks %</span>
        <NumericRuleInput
          value={rules.low_clicks_increase}
          onChange={(v) => onChange("low_clicks_increase", v)}
        />
      </div>

      {/* Good ACOS increase */}
      <div className="flex flex-col gap-1 w-16">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">Good ACOS %</span>
        <NumericRuleInput
          value={rules.good_acos_increase}
          onChange={(v) => onChange("good_acos_increase", v)}
        />
      </div>

      {/* Good ACOS max */}
      <div className="flex flex-col gap-1 w-16">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">Max ACOS %</span>
        <NumericRuleInput
          value={rules.good_acos_max}
          onChange={(v) => onChange("good_acos_max", v)}
        />
      </div>

      {/* New budget */}
      <div className="flex flex-col gap-1 w-16">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">New Budget</span>
        <NumericRuleInput
          value={rules.new_budget}
          onChange={(v) => onChange("new_budget", v)}
        />
      </div>

      {/* Pause */}
      <div className="flex flex-col items-center gap-1 w-10">
        <span className="text-[10px] text-slate-400">Pause</span>
        <Checkbox
          checked={rules.pause}
          onCheckedChange={(v) => onChange("pause", !!v)}
        />
      </div>
    </div>
  );
}

export function CampaignTable({ campaigns, rules, onRuleChange, onPreview, selectedCount }: CampaignTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "spend_30d", desc: true }]);

  const columns = React.useMemo(
    () => [
      columnHelper.accessor("campaign_name", {
        header: "Campaign",
        cell: (info) => (
          <div className="max-w-[200px]">
            <p className="font-medium text-sm truncate">{info.getValue()}</p>
            {info.row.original.portfolio_name && (
              <p className="text-xs text-slate-400 truncate">{info.row.original.portfolio_name}</p>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("budget", {
        header: "Budget",
        cell: (info) => (
          <span className="text-sm">
            {formatSpend(info.getValue())}
            <BudgetCheck
              yesterday={info.row.original.yesterday_spend}
              dayBefore={info.row.original.day_before_spend}
              budget={info.getValue()}
            />
          </span>
        ),
      }),
      columnHelper.accessor("spend_30d", {
        header: "Spend 30d",
        cell: (info) => <span className="text-sm">{formatSpend(info.getValue())}</span>,
      }),
      columnHelper.accessor("orders_30d", {
        header: "Orders 30d",
        cell: (info) => <span className="text-sm">{info.getValue()}</span>,
      }),
      columnHelper.accessor("acos_30d", {
        header: "ACOS 30d",
        cell: (info) => (
          <span className={cn("text-sm font-medium", info.getValue() && info.getValue()! > 40 ? "text-red-600" : "text-slate-700 dark:text-slate-300")}>
            {formatAcos(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("spend_7d", {
        header: "Spend 7d",
        cell: (info) => <span className="text-sm">{formatSpend(info.getValue())}</span>,
      }),
      columnHelper.accessor("orders_7d", {
        header: "Orders 7d",
        cell: (info) => <span className="text-sm">{info.getValue()}</span>,
      }),
      columnHelper.accessor("acos_7d", {
        header: "ACOS 7d",
        cell: (info) => (
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium", info.getValue() && info.getValue()! > 40 ? "text-red-600" : "text-slate-700 dark:text-slate-300")}>
              {formatAcos(info.getValue())}
            </span>
            <TrendBadge acos30d={info.row.original.acos_30d} acos7d={info.getValue()} />
          </div>
        ),
      }),
      columnHelper.accessor("yesterday_spend", {
        header: "Yesterday",
        cell: (info) => <span className="text-sm text-slate-500">{formatSpend(info.getValue())}</span>,
      }),
      columnHelper.accessor("day_before_spend", {
        header: "DBY",
        cell: (info) => <span className="text-sm text-slate-500">{formatSpend(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: "rules",
        header: () => <span className="text-xs font-semibold text-blue-600">Rules</span>,
        cell: (info) => (
          <RuleInputs
            campaignId={info.row.original.campaign_id}
            rules={rules[info.row.original.campaign_id] ?? {
              bleeders: false, high_acos_threshold: null, low_clicks_increase: null,
              good_acos_increase: null, good_acos_max: null, new_budget: null, pause: false, notes: "",
            }}
            onChange={(field, value) => onRuleChange(info.row.original.campaign_id, field, value)}
          />
        ),
      }),
    ],
    [rules, onRuleChange]
  );

  const table = useReactTable({
    data: campaigns,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg px-4 py-2">
        <span><strong>High ACOS %</strong> — reduce bids for targets above this ACOS</span>
        <span><strong>Low Clicks %</strong> — increase bids by this % for targets with ≤1 click</span>
        <span><strong>Good ACOS %</strong> — increase by this % · <strong>Max ACOS %</strong> — ceiling for "good"</span>
        <span><AlertTriangle className="h-3 w-3 text-yellow-500 inline" /> = spending near budget</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn("flex items-center gap-1", header.column.getCanSort() && "cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200")}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          header.column.getIsSorted() === "asc" ? <ArrowUp className="h-3 w-3" /> :
                          header.column.getIsSorted() === "desc" ? <ArrowDown className="h-3 w-3" /> :
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const hasRules = Object.values(rules[row.original.campaign_id] ?? {}).some(
                (v) => v !== false && v !== null && v !== ""
              );
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-slate-100 dark:border-slate-800/50 transition-colors",
                    hasRules ? "bg-blue-50/30 dark:bg-blue-950/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {campaigns.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg font-medium">No campaign data available</p>
            <p className="text-sm mt-1">Run a data collection to load your campaigns.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{campaigns.length} campaigns · {selectedCount} with rules set</p>
        <Button
          onClick={onPreview}
          disabled={selectedCount === 0}
          className="btn-gradient font-bold px-8"
        >
          Preview Keyword Changes →
        </Button>
      </div>
    </div>
  );
}
