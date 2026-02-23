import { DashboardContent } from "@/components/dashboard/dashboard-content";

// Data is fetched client-side by DashboardContent to avoid server-side hangs
// when the Supabase query is slow or the session is being refreshed.
export default function DashboardPage() {
  return <DashboardContent initialData={[]} />;
}
