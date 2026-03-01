import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch user credentials
  const { data: credentials, error } = await supabase
    .from("credentials")
    .select("*")
    .eq("tenant_id", user.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
          Manage your account and report preferences
        </p>
      </div>

      {error && error.code !== "PGRST116" && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Fetching Settings
            </CardTitle>
            <CardDescription>
              There was an error loading your settings: {error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <SettingsForm credentials={credentials} />

      {/* Amazon connection status card */}
      <Card className={credentials?.status === "active" ? "border-green-500/50" : "border-amber-400/50"}>
        <CardHeader className={credentials?.status === "active" ? "bg-green-50/50 dark:bg-green-900/10 border-b border-green-100 dark:border-green-900/20" : "bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20"}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              {credentials?.status === "active" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              Amazon Advertising
            </CardTitle>
            <Badge className={credentials?.status === "active" ? "bg-green-600 text-white" : "bg-amber-500 text-white"}>
              {credentials?.status === "active" ? "Connected" : "Not Connected"}
            </Badge>
          </div>
          <CardDescription>
            {credentials?.status === "active"
              ? `Profile ID: ${credentials.amazon_profile_id || "—"}`
              : "Connect your Amazon account to enable automated reports."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="py-3 bg-slate-50/50 dark:bg-slate-900/20">
          <Link
            href="/dashboard/connect"
            className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1"
          >
            <Link2 className="h-4 w-4" />
            {credentials?.status === "active" ? "Manage connection" : "Connect now"}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
