import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pre-fetch placement data on the server for faster initial load
  const { data: placements } = await supabase
    .from("view_placement_optimization_report")
    .select("*")
    .order("spend", { ascending: false });

  return <DashboardContent initialData={placements || []} />;
}
