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
        // Check Supabase: does this user have a credentials row?
        // A credentials row is created by the DB trigger on signup.
        // If no row exists yet, this is a brand new account hitting the login route.
        const { data: credentials } = await supabase
          .from("credentials")
          .select("tenant_id")
          .eq("tenant_id", user.id)
          .maybeSingle();

        if (!credentials) {
          // New user — sign them out and send to signup
          await supabase.auth.signOut();
          return NextResponse.redirect(
            `${origin}/login?error=No+account+found.+Please+sign+up+first.`
          );
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
