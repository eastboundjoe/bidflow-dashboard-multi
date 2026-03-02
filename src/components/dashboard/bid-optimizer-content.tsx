"use client";

import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CampaignTable } from "@/components/dashboard/bid-optimizer/campaign-table";
import { KeywordReview } from "@/components/dashboard/bid-optimizer/keyword-review";
import { ConfirmChanges } from "@/components/dashboard/bid-optimizer/confirm-changes";
import { Loader2, BarChart3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CampaignRow,
  CampaignRules,
  TargetingRow,
  BidChange,
  BidChangeRule,
} from "@/types";

type Screen = "campaigns" | "keywords" | "confirm";

// ─── Rule Calculation ────────────────────────────────────────────────────────

function calculateChanges(
  campaignId: string,
  campaignName: string,
  rules: CampaignRules,
  keywords: TargetingRow[]
): BidChange[] {
  const changes: BidChange[] = [];
  const campaignKeywords = keywords.filter((k) => k.campaign_id === campaignId);

  for (const kw of campaignKeywords) {
    // Rule 1: Bleeders — clicks with no orders
    if (rules.bleeders) {
      if (kw.clicks_30d >= 14 && kw.orders_30d === 0) {
        changes.push({
          target_id: kw.target_id, campaign_id: campaignId, campaign_name: campaignName,
          targeting_text: kw.targeting_text, match_type: kw.match_type,
          old_bid: kw.bid, new_bid: 0, // 0 = pause signal
          rule_applied: "bleeders", overridden: false, excluded: false,
        });
        continue;
      }
      if (kw.clicks_30d >= 8 && kw.clicks_30d <= 13 && kw.orders_30d === 0) {
        const newBid = Math.max(0.02, kw.bid * 0.90);
        changes.push({
          target_id: kw.target_id, campaign_id: campaignId, campaign_name: campaignName,
          targeting_text: kw.targeting_text, match_type: kw.match_type,
          old_bid: kw.bid, new_bid: Math.round(newBid * 100) / 100,
          rule_applied: "bleeders", overridden: false, excluded: false,
        });
        continue;
      }
      if (kw.clicks_30d >= 6 && kw.clicks_30d <= 7 && kw.orders_30d === 0) {
        const newBid = Math.max(0.02, kw.bid * 0.95);
        changes.push({
          target_id: kw.target_id, campaign_id: campaignId, campaign_name: campaignName,
          targeting_text: kw.targeting_text, match_type: kw.match_type,
          old_bid: kw.bid, new_bid: Math.round(newBid * 100) / 100,
          rule_applied: "bleeders", overridden: false, excluded: false,
        });
        continue;
      }
    }

    // Rule 2: High ACOS — reduce bids by the delta between actual ACOS and threshold
    if (rules.high_acos_threshold !== null && kw.orders_30d >= 1 && kw.acos_30d !== null) {
      const threshold = rules.high_acos_threshold;
      if (kw.acos_30d > threshold) {
        const reduction = Math.min((kw.acos_30d - threshold) / 100, 0.99);
        const newBid = Math.max(0.02, kw.bid * (1 - reduction));
        changes.push({
          target_id: kw.target_id, campaign_id: campaignId, campaign_name: campaignName,
          targeting_text: kw.targeting_text, match_type: kw.match_type,
          old_bid: kw.bid, new_bid: Math.round(newBid * 100) / 100,
          rule_applied: "high_acos", overridden: false, excluded: false,
        });
        continue;
      }
    }

    // Rule 3: Low clicks — increase bids for targets with ≤1 click
    if (rules.low_clicks_increase !== null && kw.clicks_30d <= 1) {
      const newBid = kw.bid * (1 + rules.low_clicks_increase / 100);
      changes.push({
        target_id: kw.target_id, campaign_id: campaignId, campaign_name: campaignName,
        targeting_text: kw.targeting_text, match_type: kw.match_type,
        old_bid: kw.bid, new_bid: Math.round(newBid * 100) / 100,
        rule_applied: "low_clicks", overridden: false, excluded: false,
      });
      continue;
    }

    // Rule 4: Good ACOS — increase bids for targets below max ACOS with at least 1 order
    if (
      rules.good_acos_increase !== null &&
      rules.good_acos_max !== null &&
      kw.orders_30d >= 1 &&
      kw.acos_30d !== null &&
      kw.acos_30d < rules.good_acos_max
    ) {
      const newBid = kw.bid * (1 + rules.good_acos_increase / 100);
      changes.push({
        target_id: kw.target_id, campaign_id: campaignId, campaign_name: campaignName,
        targeting_text: kw.targeting_text, match_type: kw.match_type,
        old_bid: kw.bid, new_bid: Math.round(newBid * 100) / 100,
        rule_applied: "good_acos", overridden: false, excluded: false,
      });
    }
  }

  return changes;
}

function hasAnyRule(rules: CampaignRules): boolean {
  return (
    rules.bleeders ||
    rules.high_acos_threshold !== null ||
    rules.low_clicks_increase !== null ||
    rules.good_acos_increase !== null ||
    rules.pause ||
    rules.new_budget !== null
  );
}

function defaultRules(): CampaignRules {
  return {
    bleeders: false, high_acos_threshold: null, low_clicks_increase: null,
    good_acos_increase: null, good_acos_max: null, new_budget: null,
    pause: false, notes: "",
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BidOptimizerContent() {
  const [screen, setScreen] = React.useState<Screen>("campaigns");
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState(false);

  const [campaigns, setCampaigns] = React.useState<CampaignRow[]>([]);
  const [keywords, setKeywords] = React.useState<TargetingRow[]>([]);
  const [rules, setRules] = React.useState<Record<string, CampaignRules>>({});
  const [changes, setChanges] = React.useState<BidChange[]>([]);

  const [weeks, setWeeks] = React.useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = React.useState<string | null>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();

      const [{ data: campaignRows }, { data: targetingRows }] = await Promise.all([
        supabase
          .from("weekly_campaign_performance")
          .select(`
            campaign_id, campaign_name, campaign_budget,
            spend_30d, purchases_30d, acos_30d,
            spend_7d, purchases_7d, acos_7d,
            yesterday_spend, day_before_spend,
            week_id
          `)
          .order("spend_30d", { ascending: false }),
        supabase
          .from("weekly_targeting_performance")
          .select("*")
          .order("clicks_30d", { ascending: false }),
      ]);

      if (campaignRows && campaignRows.length > 0) {
        // Extract unique weeks
        const uniqueWeeks = [...new Set(campaignRows.map((r: { week_id: string }) => r.week_id))].sort().reverse();
        setWeeks(uniqueWeeks);
        const latestWeek = uniqueWeeks[0] ?? null;
        setSelectedWeek(latestWeek);

        const mapped: CampaignRow[] = campaignRows.map((r: {
          campaign_id: string;
          campaign_name: string;
          campaign_budget: number | null;
          spend_30d: number;
          purchases_30d: number;
          acos_30d: number | null;
          spend_7d: number;
          purchases_7d: number;
          acos_7d: number | null;
          yesterday_spend: number;
          day_before_spend: number;
          week_id: string;
        }) => ({
          campaign_id: r.campaign_id,
          campaign_name: r.campaign_name,
          portfolio_id: null,
          portfolio_name: null,
          budget: r.campaign_budget ?? 0,
          spend_30d: r.spend_30d ?? 0,
          orders_30d: r.purchases_30d ?? 0,
          acos_30d: r.acos_30d ?? null,
          spend_7d: r.spend_7d ?? 0,
          orders_7d: r.purchases_7d ?? 0,
          acos_7d: r.acos_7d ?? null,
          yesterday_spend: r.yesterday_spend ?? 0,
          day_before_spend: r.day_before_spend ?? 0,
          week_id: r.week_id,
        }));
        setCampaigns(mapped);
      }

      if (targetingRows) {
        setKeywords(targetingRows as TargetingRow[]);
      }

      setLoading(false);
    }
    load();
  }, []);

  // Filter campaigns by selected week
  const filteredCampaigns = React.useMemo(
    () => selectedWeek ? campaigns.filter((c) => c.week_id === selectedWeek) : campaigns,
    [campaigns, selectedWeek]
  );

  const selectedCount = Object.values(rules).filter(hasAnyRule).length;

  // ── Rule change handler ─────────────────────────────────────────────────────
  function handleRuleChange(campaignId: string, field: keyof CampaignRules, value: unknown) {
    setRules((prev) => ({
      ...prev,
      [campaignId]: { ...(prev[campaignId] ?? defaultRules()), [field]: value },
    }));
  }

  // ── Preview — calculate all changes ────────────────────────────────────────
  function handlePreview() {
    const allChanges: BidChange[] = [];
    for (const campaign of filteredCampaigns) {
      const campaignRules = rules[campaign.campaign_id];
      if (!campaignRules || !hasAnyRule(campaignRules)) continue;
      const campaignKeywords = keywords.filter((k) => k.campaign_id === campaign.campaign_id);
      const computed = calculateChanges(
        campaign.campaign_id, campaign.campaign_name, campaignRules, campaignKeywords
      );
      allChanges.push(...computed);
    }
    setChanges(allChanges);
    setScreen("keywords");
  }

  // ── Keyword override / exclude ──────────────────────────────────────────────
  function handleUpdateChange(targetId: string, field: "new_bid" | "excluded", value: number | boolean) {
    setChanges((prev) =>
      prev.map((c) =>
        c.target_id === targetId
          ? { ...c, [field]: value, overridden: field === "new_bid" ? true : c.overridden }
          : c
      )
    );
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  async function handleApply(notes: string) {
    if (!selectedWeek) return;
    setApplying(true);
    try {
      const res = await fetch("/api/bid-optimizer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_id: selectedWeek, changes, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      toast.success(`${json.applied} keyword bid${json.applied !== 1 ? "s" : ""} updated in Amazon.`);
      // Reset to campaign screen
      setScreen("campaigns");
      setChanges([]);
      setRules({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply changes.");
    } finally {
      setApplying(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const stepLabels: Record<Screen, string> = {
    campaigns: "1. Set Rules",
    keywords: "2. Review Keywords",
    confirm: "3. Confirm & Apply",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Bid Optimizer
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set rules per campaign → preview keyword changes → apply to Amazon
          </p>
        </div>
        <div className="flex items-center gap-3">
          {weeks.length > 0 && (
            <Select value={selectedWeek ?? ""} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-40 text-sm">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["campaigns", "keywords", "confirm"] as Screen[]).map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => {
                if (s === "campaigns") setScreen("campaigns");
                if (s === "keywords" && changes.length > 0) setScreen("keywords");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                screen === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="text-xs opacity-70">{i + 1}</span>
              {stepLabels[s]}
            </button>
            {i < 2 && <span className="text-slate-300 dark:text-slate-600">→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading campaign data…</span>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <BarChart3 className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">No campaign data for this week</p>
          <p className="text-sm">Run a data collection from the main dashboard to load your campaigns.</p>
        </div>
      ) : screen === "campaigns" ? (
        <CampaignTable
          campaigns={filteredCampaigns}
          rules={rules}
          onRuleChange={handleRuleChange}
          onPreview={handlePreview}
          selectedCount={selectedCount}
        />
      ) : screen === "keywords" ? (
        <KeywordReview
          changes={changes}
          onUpdateChange={handleUpdateChange}
          onBack={() => setScreen("campaigns")}
          onContinue={() => setScreen("confirm")}
        />
      ) : (
        <ConfirmChanges
          changes={changes}
          weekId={selectedWeek ?? ""}
          onBack={() => setScreen("keywords")}
          onApply={handleApply}
          applying={applying}
        />
      )}
    </div>
  );
}
