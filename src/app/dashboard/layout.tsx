import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get current path to avoid redirect loops on connect/collecting pages
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isOnboardingPage = pathname.includes("/connect") || pathname.includes("/collecting");

  if (!isOnboardingPage) {
    const { data: credentials } = await supabase
      .from("credentials")
      .select("status")
      .eq("tenant_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!credentials) {
      redirect("/dashboard/connect");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/20">
      <DashboardNav user={user} />
      <main className="max-w-[1800px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
