import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { priceId, tier } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: "Price ID is required" }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia" as any,
    });

    // 1. Get or create Stripe customer
    const { data: credentials } = await supabase
      .from("credentials")
      .select("stripe_customer_id")
      .eq("tenant_id", user.id)
      .single();

    let customerId = credentials?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          tenant_id: user.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to credentials
      await supabase
        .from("credentials")
        .upsert({
          tenant_id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "tenant_id",
        });
    }

    // 2. Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${new URL(request.url).origin}/dashboard/billing?success=true`,
      cancel_url: `${new URL(request.url).origin}/dashboard/billing?canceled=true`,
      subscription_data: {
        metadata: {
          tenant_id: user.id,
          tier: tier,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
