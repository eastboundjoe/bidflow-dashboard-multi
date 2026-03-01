import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const cookieStore = await cookies();
      const oauthSource = searchParams.get("source") || cookieStore.get("oauth_source")?.value;
      cookieStore.delete("oauth_source");

      if (oauthSource === "login") {
        // Detect if this is a brand new account (created in the last 30 seconds)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
          const isNewUser = accountAgeMs < 30000;

          if (isNewUser) {
            return NextResponse.redirect(`${origin}/login?error=No+account+found.+Please+sign+up+first.`);
          }
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
