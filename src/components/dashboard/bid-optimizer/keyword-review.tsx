"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";
import type { BidChange, BidChangeRule } from "@/types";
import { cn } from "@/lib/utils";

interface KeywordReviewProps {
  changes: BidChange[];
  onUpdateChange: (targetId: string, field: "new_bid" | "excluded", value: number | boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

const RULE_LABELS: Record<BidChangeRule, { label: string; color: string }> = {
  bleeders:        { label: "Bleeder",    color: "bg-red-100 text-red-700 border-red-200" },
  high_acos:       { label: "High ACOS",  color: "bg-orange-100 text-orange-700 border-orange-200" },
  low_clicks:      { label: "Low Clicks", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  good_acos:       { label: "Good ACOS",  color: "bg-green-100 text-green-700 border-green-200" },
  manual_override: { label: "Manual",     color: "bg-blue-100 text-blue-700 border-blue-200" },
};

function BidDelta({ oldBid, newBid }: { oldBid: number; newBid: number }) {
  const pct = oldBid > 0 ? ((newBid - oldBid) / oldBid) * 100 : 0;
  const isIncrease = newBid > oldBid;
  return (
    <span className={cn("text-xs font-medium", isIncrease ? "text-green-600" : "text-red-600")}>
      {isIncrease ? "+" : ""}{pct.toFixed(0)}%
    </span>
  );
}

export function KeywordReview({ changes, onUpdateChange, onBack, onContinue }: KeywordReviewProps) {
  const activeChanges = changes.filter((c) => !c.excluded);

  // Group by campaign
  const grouped = React.useMemo(() => {
    const map = new Map<string, { name: string; changes: BidChange[] }>();
    for (const c of changes) {
      if (!map.has(c.campaign_id)) {
        map.set(c.campaign_id, { name: c.campaign_name, changes: [] });
      }
      map.get(c.campaign_id)!.changes.push(c);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [changes]);

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Info className="h-12 w-12 text-slate-300" />
        <p className="text-xl font-semibold text-slate-700 dark:text-slate-300">No targeting data yet</p>
        <p className="text-sm text-slate-500 max-w-sm text-center">
          Targeting data isn&apos;t collected yet. Run a data collection to enable keyword-level preview.
          Campaign-level rules (budget, pause) will still apply.
        </p>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={onContinue} className="btn-gradient font-bold">Continue Anyway →</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {activeChanges.length} keyword{activeChanges.length !== 1 ? "s" : ""} will be updated
          {changes.length !== activeChanges.length && ` (${changes.length - activeChanges.length} excluded)`}
        </p>
        <div className="flex gap-3">
          {Object.entries(RULE_LABELS).filter(([k]) => changes.some((c) => c.rule_applied === k)).map(([k, v]) => (
            <Badge key={k} variant="outline" className={cn("text-xs", v.color)}>
              {v.label}: {changes.filter((c) => c.rule_applied === k && !c.excluded).length}
            </Badge>
          ))}
        </div>
      </div>

      {grouped.map(({ id, name, changes: groupChanges }) => (
        <div key={id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{name}</span>
            <span className="text-xs text-slate-400">{groupChanges.filter((c) => !c.excluded).length} changes</span>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/50">
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Keyword</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Match</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Rule</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Current Bid</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">New Bid</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Change</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Override</th>
                <th className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Skip</th>
              </tr>
            </thead>
            <tbody>
              {groupChanges.map((c) => {
                const ruleStyle = RULE_LABELS[c.rule_applied];
                return (
                  <tr
                    key={c.target_id}
                    className={cn(
                      "border-b border-slate-100 dark:border-slate-800/50 last:border-0",
                      c.excluded && "opacity-40"
                    )}
                  >
                    <td className="px-3 py-2 text-sm font-medium max-w-[200px] truncate">{c.targeting_text}</td>
                    <td className="px-3 py-2">
                      <span className="text-xs text-slate-400">{c.match_type}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={cn("text-xs", ruleStyle.color)}>
                        {ruleStyle.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-sm">${c.old_bid.toFixed(2)}</td>
                    <td className="px-3 py-2 text-sm font-semibold">${c.new_bid.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <BidDelta oldBid={c.old_bid} newBid={c.new_bid} />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0.02}
                        step={0.01}
                        placeholder="Override"
                        className="h-7 w-24 text-xs px-1.5"
                        defaultValue=""
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0.02) {
                            onUpdateChange(c.target_id, "new_bid", val);
                          }
                        }}
                        disabled={c.excluded}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={c.excluded}
                        onCheckedChange={(v) => onUpdateChange(c.target_id, "excluded", !!v)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back to Campaigns</Button>
        <Button
          onClick={onContinue}
          disabled={activeChanges.length === 0}
          className="btn-gradient font-bold px-8"
        >
          Review {activeChanges.length} Changes →
        </Button>
      </div>
    </div>
  );
}
