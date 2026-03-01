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
      const source = searchParams.get("source");

      if (source === "login") {
        // Detect if this is a brand new account (created just now)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const createdAt = new Date(user.created_at).getTime();
          const lastSignIn = new Date(user.last_sign_in_at ?? user.created_at).getTime();
          const isNewUser = Math.abs(createdAt - lastSignIn) < 5000; // within 5 seconds = new account

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
