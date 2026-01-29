import { createClient } from "@/lib/supabase/server";
import { ConnectAmazon } from "@/components/dashboard/connect-amazon";

export default async function ConnectPage() {
  const supabase = await createClient();

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
      <div>
        <h1 className="text-3xl font-bold text-gradient">Amazon Connection</h1>
        <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">
          Link your advertising account to start optimizing
        </p>
      </div>

      <ConnectAmazon credentials={credentials} />
    </div>
  );
}
