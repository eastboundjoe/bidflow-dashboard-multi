import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Mark credentials as inactive or delete sensitive data
    // Ideally, we should also remove secrets from Vault
    const { error: rpcError } = await supabase.rpc("delete_tenant_secrets", {
      p_tenant_id: user.id
    });

    if (rpcError) {
      console.warn("Error deleting secrets from vault:", rpcError);
    }

    // 2. Update credentials table
    const { error } = await supabase
      .from("credentials")
      .update({
        status: "inactive",
        refresh_token: null, // If stored in the table directly
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to disconnect" },
      { status: 500 }
    );
  }
}
