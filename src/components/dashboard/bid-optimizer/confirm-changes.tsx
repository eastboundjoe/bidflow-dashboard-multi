"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { BidChange, BidChangeRule } from "@/types";
import { cn } from "@/lib/utils";

interface ConfirmChangesProps {
  changes: BidChange[];
  weekId: string;
  onBack: () => void;
  onApply: (notes: string) => Promise<void>;
  applying: boolean;
}

const RULE_LABELS: Record<BidChangeRule, { label: string; color: string }> = {
  bleeders:        { label: "Bleeders reduced",      color: "bg-red-100 text-red-700 border-red-200" },
  high_acos:       { label: "High ACOS reduced",      color: "bg-orange-100 text-orange-700 border-orange-200" },
  low_clicks:      { label: "Low clicks increased",   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  good_acos:       { label: "Good ACOS increased",    color: "bg-green-100 text-green-700 border-green-200" },
  manual_override: { label: "Manual overrides",       color: "bg-blue-100 text-blue-700 border-blue-200" },
};

export function ConfirmChanges({ changes, weekId, onBack, onApply, applying }: ConfirmChangesProps) {
  const [notes, setNotes] = React.useState("");
  const activeChanges = changes.filter((c) => !c.excluded);

  const ruleCounts = React.useMemo(() => {
    const counts: Partial<Record<BidChangeRule, number>> = {};
    for (const c of activeChanges) {
      const key = c.overridden ? "manual_override" : c.rule_applied;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [activeChanges]);

  const totalBidIncrease = activeChanges.filter((c) => c.new_bid > c.old_bid).length;
  const totalBidDecrease = activeChanges.filter((c) => c.new_bid < c.old_bid).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-blue-200 dark:border-blue-900 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {activeChanges.length} keyword bid{activeChanges.length !== 1 ? "s" : ""} will be updated
            </h3>
            <Badge variant="outline" className="text-xs text-slate-500">Week: {weekId}</Badge>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-3">
              <p className="text-2xl font-black text-green-700 dark:text-green-400">{totalBidIncrease}</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">bids increased</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3">
              <p className="text-2xl font-black text-red-700 dark:text-red-400">{totalBidDecrease}</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">bids decreased or paused</p>
            </div>
          </div>

          {/* Rule breakdown */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(ruleCounts) as [BidChangeRule, number][]).map(([rule, count]) => {
              const style = RULE_LABELS[rule];
              return (
                <Badge key={rule} variant="outline" className={cn("text-xs", style.color)}>
                  {count} {style.label}
                </Badge>
              );
            })}
          </div>

          {changes.length !== activeChanges.length && (
            <p className="text-xs text-slate-400">
              {changes.length - activeChanges.length} keyword{changes.length - activeChanges.length !== 1 ? "s" : ""} excluded from this run.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Lowered bids on top bleeders, testing 10% increase on high performers..."
          className="w-full resize-none h-20 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-slate-400">Saved to change history for reference next week.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={applying}>
          ← Back to Review
        </Button>
        <Button
          onClick={() => onApply(notes)}
          disabled={applying || activeChanges.length === 0}
          className="btn-gradient font-bold px-8"
        >
          {applying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Applying Changes…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply {activeChanges.length} Changes to Amazon
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
