"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, ExternalLink, Zap, Shield, Rocket } from "lucide-react";
import { toast } from "sonner";
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
      <Card className="overflow-hidden border-primary/20">
        <div className="bg-primary/10 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Your Current Plan</h3>
          </div>
          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 uppercase">
            {currentTier}
          </Badge>
        </div>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold capitalize">
                {currentTier} Plan
              </h2>
              <p className="text-muted-foreground">
                {subscription?.subscription_status === "active" 
                  ? "Your subscription is active and will renew automatically."
                  : subscription?.subscription_status === "trialing"
                  ? `Your trial ends on ${new Date(subscription.trial_ends_at!).toLocaleDateString()}.`
                  : isCanceled
                  ? "Your subscription has been canceled but you still have access until the end of the period."
                  : "You are currently on the free plan with limited features."}
              </p>
            </div>
            {currentTier !== SUBSCRIPTION_TIERS.FREE && (
              <Button 
                variant="outline" 
                onClick={handleManageSubscription}
                disabled={!!loading}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <Card className={currentTier === SUBSCRIPTION_TIERS.FREE ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>Perfect for testing the waters.</CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold">$0</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>{TIER_LIMITS.free.historicalDays} days historical data</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>{TIER_LIMITS.free.maxAccounts} Amazon Ads account</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Manual data collection</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              variant={currentTier === SUBSCRIPTION_TIERS.FREE ? "outline" : "default"}
              disabled={currentTier === SUBSCRIPTION_TIERS.FREE}
            >
              {currentTier === SUBSCRIPTION_TIERS.FREE ? "Current Plan" : "Get Started"}
            </Button>
          </CardFooter>
        </Card>

        {/* Pro Plan */}
        <Card className={`relative ${currentTier === SUBSCRIPTION_TIERS.PRO ? "border-primary" : "border-primary/50"}`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            Most Popular
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Pro
            </CardTitle>
            <CardDescription>For growing Amazon brands.</CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold">$29</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>{TIER_LIMITS.pro.historicalDays} days historical data</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>{TIER_LIMITS.pro.maxAccounts} Amazon Ads accounts</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Weekly automated reports</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Priority data processing</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
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
        <Card className={currentTier === SUBSCRIPTION_TIERS.ENTERPRISE ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-secondary" />
              Enterprise
            </CardTitle>
            <CardDescription>Scale without limits.</CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold">$99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Unlimited historical data</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Unlimited Amazon Ads accounts</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Daily automated reports</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Dedicated account manager</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full"
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
