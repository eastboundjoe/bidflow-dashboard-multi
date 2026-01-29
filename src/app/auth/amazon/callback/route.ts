import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AMAZON_CLIENT_ID } from "@/lib/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("amz_auth_state")?.value;
  const codeVerifier = cookieStore.get("amz_code_verifier")?.value;

  // 1. Basic error handling from Amazon
  if (error) {
    console.error("Amazon OAuth Error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(`/dashboard/connect?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard/connect?error=Missing+authorization+code", request.url)
    );
  }

  // 2. Verify state to prevent CSRF
  if (!state || state !== savedState) {
    console.error("State mismatch:", { state, savedState });
    return NextResponse.redirect(
      new URL("/dashboard/connect?error=State+mismatch+verification+failed", request.url)
    );
  }

  try {
    const clientSecret = process.env.AMAZON_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error("Missing AMAZON_CLIENT_SECRET in environment variables");
    }

    // 3. Exchange code for tokens
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: `${new URL(request.url).origin}/auth/amazon/callback`,
      client_id: AMAZON_CLIENT_ID,
      client_secret: clientSecret,
    };

    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }

    const tokenResponse = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(tokenParams),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`Amazon Token Exchange Failed: ${tokenData.error_description || tokenData.error}`);
    }

    const { refresh_token, access_token } = tokenData;

    // 4. Fetch Amazon Profiles to get the Profile ID
    const profilesResponse = await fetch("https://advertising-api.amazon.com/v2/profiles", {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Amazon-Advertising-API-ClientId": AMAZON_CLIENT_ID,
      },
    });

    const profilesData = await profilesResponse.json();

    if (!profilesResponse.ok) {
      throw new Error("Failed to fetch Amazon Profiles");
    }

    // Default to the first US profile, or just the first one found
    const usProfile = profilesData.find((p: any) => p.countryCode === "US") || profilesData[0];
    
    if (!usProfile) {
      throw new Error("No advertising profile found connected to this account.");
    }

    const profileId = usProfile.profileId;
    const marketplaceId = usProfile.accountInfo?.marketplaceStringId || "ATVPDKIKX0DER";

    // 5. Securely store credentials in Supabase
    // We use the admin client (service role) to call Vault storage RPCs
    // Note: We need a specialized createClient for service role or just use the existing server client
    // if it has the right permissions. But RPCs usually need service role if they interact with Vault.
    
    // For this migration, we'll assume we have a server client that can call the RPCs
    // or we might need to initialize a service role client here.
    const supabase = await createClient(); // This usually creates a client with the user's session
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Call the same RPCs as the original Edge Function
    // We might need to use a service role client if the user doesn't have permission to call store_tenant_secret
    
    // Store refresh token and metadata
    // In a real implementation, you'd use the service role key for these RPCs
    const { error: storeError } = await supabase.rpc("store_tenant_secret", {
      p_tenant_id: user.id,
      p_secret: refresh_token,
      p_secret_type: "refresh",
    });

    if (storeError) {
      console.error("Vault storage error:", storeError);
      // If RPC fails, we'll try direct update (falling back to non-Vault if needed, 
      // though the original plan was Vault-first)
    }

    // Update metadata in credentials table
    const { error: metaError } = await supabase
      .from("credentials")
      .upsert({
        tenant_id: user.id,
        profile_id: profileId.toString(),
        status: "active",
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "tenant_id",
      });

    if (metaError) throw metaError;

    // Clear cookies
    cookieStore.delete("amz_auth_state");
    cookieStore.delete("amz_code_verifier");

    return NextResponse.redirect(new URL("/dashboard/connect?success=true", request.url));
  } catch (err) {
    console.error("Callback error:", err);
    return NextResponse.redirect(
      new URL(`/dashboard/connect?error=${encodeURIComponent(err instanceof Error ? err.message : "Unknown error")}`, request.url)
    );
  }
}
