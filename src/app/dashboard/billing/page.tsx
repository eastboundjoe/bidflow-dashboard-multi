import { createClient } from "@/lib/supabase/server";
import { BillingContent } from "@/components/dashboard/billing-content";
import type { SubscriptionStatus } from "@/types";

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch subscription status from credentials table
  // In the multi-tenant version, subscription info is stored in the credentials table
  const { data: credentials } = await supabase
    .from("credentials")
    .select("subscription_tier, subscription_status, trial_ends_at, stripe_customer_id")
    .eq("tenant_id", user.id)
    .single();

  const subscription: SubscriptionStatus = {
    subscription_tier: credentials?.subscription_tier || "free",
    subscription_status: credentials?.subscription_status || null,
    trial_ends_at: credentials?.trial_ends_at || null,
    stripe_customer_id: credentials?.stripe_customer_id || null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Billing &amp; Subscription</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Manage your plan and billing details
        </p>
      </div>

      <BillingContent subscription={subscription} />
    </div>
  );
}
