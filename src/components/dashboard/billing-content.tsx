"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, ExternalLink, Zap, Shield, Rocket } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_TIERS, TIER_LIMITS, STRIPE_PRICES } from "@/lib/constants";
import type { SubscriptionStatus } from "@/types";

interface BillingContentProps {
  subscription: SubscriptionStatus | null;
}

export function BillingContent({ subscription }: BillingContentProps) {
  const [loading, setLoading] = React.useState<string | null>(null);

  const handleUpgrade = async (tier: string, priceId: string) => {
    setLoading(tier);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, tier }),
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Stripe checkout error:", error);
      toast.error("Failed to initiate checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading("manage");
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const { url, error } = await response.json();
      if (error) throw new Error(error);

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Stripe portal error:", error);
      toast.error("Failed to open billing portal. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const currentTier = subscription?.subscription_tier || SUBSCRIPTION_TIERS.FREE;
  const isCanceled = subscription?.subscription_status === "canceled";

  return (
    <div className="space-y-8">
      {/* Current Plan Summary */}
      <Card className="overflow-hidden border-blue-100 dark:border-blue-900/30 card-hover">
        <div className="bg-blue-50/50 dark:bg-blue-900/10 px-6 py-4 border-b border-blue-100 dark:border-blue-900/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold uppercase tracking-widest text-xs text-slate-600 dark:text-slate-400">Your Current Plan</h3>
          </div>
          <Badge variant="outline" className="bg-blue-100/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 uppercase text-[10px] font-bold tracking-tighter">
            {currentTier}
          </Badge>
        </div>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold capitalize tracking-tight text-slate-900 dark:text-white">
                {currentTier} Plan
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-xl">
                {subscription?.subscription_status === "active" 
                  ? "Your subscription is active and will renew automatically."
                  : subscription?.subscription_status === "trialing"
                  ? `Your trial ends on ${new Date(subscription.trial_ends_at!).toLocaleDateString()}.`
                  : isCanceled
                  ? "Your subscription has been canceled but you still have access until the end of the period."
                  : "You're on a free trial. Upgrade to keep access after your trial ends."}
              </p>
            </div>
            {currentTier !== SUBSCRIPTION_TIERS.FREE && (
              <Button 
                variant="outline" 
                onClick={handleManageSubscription}
                disabled={!!loading}
                className="font-bold px-6 shadow-sm"
              >
                {loading === "manage" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Manage Billing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pro Plan */}
        <Card className={cn("relative flex flex-col h-full card-hover border-blue-300 dark:border-blue-900 shadow-lg", currentTier === SUBSCRIPTION_TIERS.PRO && "border-blue-500 ring-1 ring-blue-500/20")}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md z-10">
            Most Popular
          </div>
          <CardHeader className="text-center pb-8 border-b border-blue-50 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10">
            <CardTitle className="flex items-center justify-center gap-2 text-xl font-bold text-blue-600 dark:text-blue-400">
              <Shield className="h-5 w-5" />
              Pro
            </CardTitle>
            <CardDescription className="text-xs">For growing Amazon brands.</CardDescription>
            <div className="mt-6">
              <span className="text-5xl font-extrabold tracking-tighter text-blue-600 dark:text-blue-400">$29</span>
              <span className="text-slate-500 text-sm ml-1">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-8 flex-grow">
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>{TIER_LIMITS.pro.historicalDays} days historical data</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>{TIER_LIMITS.pro.maxAccounts} Amazon Ads accounts</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Weekly automated reports</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 font-medium">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Priority data processing</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className="pt-2 pb-6 px-6">
            <Button 
              className="w-full btn-gradient font-bold py-6 text-base"
              onClick={() => handleUpgrade(SUBSCRIPTION_TIERS.PRO, STRIPE_PRICES.PRO)}
              disabled={!!loading || currentTier === SUBSCRIPTION_TIERS.PRO}
            >
              {loading === SUBSCRIPTION_TIERS.PRO ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentTier === SUBSCRIPTION_TIERS.PRO ? (
                "Current Plan"
              ) : (
                "Upgrade to Pro"
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Enterprise Plan */}
        <Card className={cn("flex flex-col h-full card-hover border-slate-200 dark:border-slate-800", currentTier === SUBSCRIPTION_TIERS.ENTERPRISE && "border-blue-500 shadow-md ring-1 ring-blue-500/20")}>
          <CardHeader className="text-center pb-8 border-b border-slate-50 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-900/10">
            <CardTitle className="flex items-center justify-center gap-2 text-xl font-bold">
              <Rocket className="h-5 w-5 text-blue-400" />
              Enterprise
            </CardTitle>
            <CardDescription className="text-xs">Scale without limits.</CardDescription>
            <div className="mt-6">
              <span className="text-5xl font-extrabold tracking-tighter">$99</span>
              <span className="text-slate-500 text-sm ml-1">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-8 flex-grow">
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Unlimited historical data</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Unlimited Amazon Ads accounts</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Daily automated reports</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <span>Dedicated account manager</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className="pt-2 pb-6 px-6">
            <Button 
              className="w-full font-bold"
              variant={currentTier === SUBSCRIPTION_TIERS.ENTERPRISE ? "outline" : "default"}
              onClick={() => handleUpgrade(SUBSCRIPTION_TIERS.ENTERPRISE, STRIPE_PRICES.ENTERPRISE)}
              disabled={!!loading || currentTier === SUBSCRIPTION_TIERS.ENTERPRISE}
            >
              {loading === SUBSCRIPTION_TIERS.ENTERPRISE ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : currentTier === SUBSCRIPTION_TIERS.ENTERPRISE ? (
                "Current Plan"
              ) : (
                "Contact Sales"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
