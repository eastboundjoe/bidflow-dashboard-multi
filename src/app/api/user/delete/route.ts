import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get user credentials to find Stripe customer ID
    const { data: credentials } = await supabase
      .from("credentials")
      .select("stripe_customer_id")
      .eq("tenant_id", user.id)
      .single();

    // 2. Cancel any active Stripe subscriptions
    if (credentials?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2024-12-18.acacia" as any,
      });

      const subscriptions = await stripe.subscriptions.list({
        customer: credentials.stripe_customer_id,
        status: "active",
      });

      for (const sub of subscriptions.data) {
        await stripe.subscriptions.cancel(sub.id);
      }
    }

    // 3. Delete Amazon credentials and secrets from Vault
    // Note: This RPC should be defined in your Supabase database
    const { error: rpcError } = await supabase.rpc("delete_tenant_secrets", {
      p_tenant_id: user.id
    });

    if (rpcError) {
      console.warn("Error calling delete_account_data RPC:", rpcError);
      // Fallback: Delete from tables directly if RPC fails
      await supabase.from("credentials").delete().eq("tenant_id", user.id);
      await supabase.from("placement_data").delete().eq("tenant_id", user.id);
    }

    // 4. Delete the user from Supabase Auth
    // Note: You need the Service Role key for this, and it must be done via the Admin API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseServiceKey) {
      const { createClient: createAdminClient } = await import("@supabase/supabase-js");
      const adminClient = createAdminClient(supabaseUrl, supabaseServiceKey);
      
      const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteUserError) throw deleteUserError;
    } else {
      console.warn("Missing SUPABASE_SERVICE_ROLE_KEY, could not delete user from Auth");
      // If we can't delete from Auth, at least we deleted their data
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete account" },
      { status: 500 }
    );
  }
}
