import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's tenant and credentials
  // TODO: Fetch actual credentials from database
  // const { data: credentials } = await supabase
  //   .from('credentials')
  //   .select('*')
  //   .eq('user_id', user.id)
  //   .single();

  // Trigger n8n webhook for data collection
  const webhookUrl = process.env.N8N_COLLECTION_WEBHOOK;

  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Collection webhook not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user.id,
        email: user.email,
        // tenant_id: credentials?.tenant_id,
        triggered_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      message: "Data collection triggered",
    });
  } catch (error) {
    console.error("Error triggering data collection:", error);
    return NextResponse.json(
      { error: "Failed to trigger data collection" },
      { status: 500 }
    );
  }
}
