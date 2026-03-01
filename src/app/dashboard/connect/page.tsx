import { createClient } from "@/lib/supabase/server";
import { ConnectAmazon } from "@/components/dashboard/connect-amazon";

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: credentials } = await supabase
    .from("credentials")
    .select("*")
    .eq("tenant_id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Amazon Connection</h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium">
          Link your advertising account to start optimizing
        </p>
      </div>

      <ConnectAmazon credentials={credentials} justConnected={params.connected === "true"} />
    </div>
  );
}
