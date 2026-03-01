import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if this is a new user by how recently the credentials row was created.
        // The DB trigger creates a credentials row immediately on every new auth.users insert,
        // so !credentials is always false. Instead, check if the row is < 60s old.
        const { data: credentials } = await supabase
          .from("credentials")
          .select("created_at")
          .eq("tenant_id", user.id)
          .maybeSingle();

        const isNewUser =
          credentials &&
          Date.now() - new Date(credentials.created_at).getTime() < 60000;

        if (isNewUser) {
          // Don't sign out server-side (fails 403). Redirect to client-side sign-out page.
          return NextResponse.redirect(`${origin}/auth/login-error`);
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
