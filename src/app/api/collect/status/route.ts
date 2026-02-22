import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query report_ledger for the most recent report request for this tenant
  const { data, error } = await supabase
    .from("report_ledger")
    .select("requested_at")
    .eq("tenant_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ lastCollectedAt: null });
  }

  return NextResponse.json({
    lastCollectedAt: data?.requested_at ?? null,
  });
}
