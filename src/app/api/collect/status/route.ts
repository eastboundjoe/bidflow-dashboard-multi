import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Compute the current ISO week number and year
function getCurrentISOWeek(): { year: number; week: number } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Query weekly_snapshots for the most recent collection run
  const { data } = await supabase
    .from("weekly_snapshots")
    .select("week_id, week_number, year, created_at")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ lastCollectedAt: null, collectedThisWeek: false, lastWeekId: null });
  }

  const current = getCurrentISOWeek();
  const collectedThisWeek =
    data.year === current.year && data.week_number === current.week;

  return NextResponse.json({
    lastCollectedAt: data.created_at,
    lastWeekId: data.week_id,
    collectedThisWeek,
  });
}
