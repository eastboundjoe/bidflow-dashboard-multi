import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { N8N_WEBHOOKS } from "@/lib/constants";
import type { BidChange } from "@/types";

interface ApplyPayload {
  week_id: string;
  changes: BidChange[];
  notes?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: credentials, error: credsError } = await supabase
    .from("credentials")
    .select("tenant_id")
    .eq("tenant_id", user.id)
    .single();

  if (credsError || !credentials?.tenant_id) {
    return NextResponse.json({ error: "Amazon account not connected" }, { status: 400 });
  }

  let body: ApplyPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { week_id, changes, notes } = body;

  if (!week_id || !Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: "week_id and changes are required" }, { status: 400 });
  }

  // Filter out excluded changes
  const activeChanges = changes.filter((c) => !c.excluded);
  if (activeChanges.length === 0) {
    return NextResponse.json({ error: "No active changes to apply" }, { status: 400 });
  }

  // Forward to n8n for Amazon API write-back
  try {
    const webhookResponse = await fetch(N8N_WEBHOOKS.BID_OPTIMIZER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: user.id,
        week_id,
        changes: activeChanges.map((c) => ({
          target_id: c.target_id,
          new_bid: c.new_bid,
          campaign_id: c.campaign_id,
        })),
        timestamp: new Date().toISOString(),
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(`n8n webhook returned ${webhookResponse.status}`);
    }
  } catch (err) {
    console.error("Bid optimizer webhook error:", err);
    return NextResponse.json({ error: "Failed to send changes to Amazon" }, { status: 502 });
  }

  // Log all changes to bid_change_log
  const logRows = activeChanges.map((c) => ({
    tenant_id: user.id,
    week_id,
    campaign_id: c.campaign_id,
    campaign_name: c.campaign_name,
    target_id: c.target_id,
    targeting_text: c.targeting_text,
    match_type: c.match_type,
    old_bid: c.old_bid,
    new_bid: c.new_bid,
    rule_applied: c.overridden ? "manual_override" : c.rule_applied,
    notes: notes || null,
  }));

  const { error: logError } = await supabase
    .from("bid_change_log")
    .insert(logRows);

  if (logError) {
    console.error("Failed to log bid changes:", logError);
    // Don't fail the request — changes were already sent to Amazon
  }

  return NextResponse.json({ success: true, applied: activeChanges.length });
}
