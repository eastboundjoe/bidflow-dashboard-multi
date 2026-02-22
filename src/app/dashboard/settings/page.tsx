import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

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

      {!credentials && !error && (
        <Card className="border-warning/50 bg-warning/10">
          <CardHeader>
            <CardTitle className="text-warning flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Amazon Account Not Connected
            </CardTitle>
            <CardDescription>
              You need to connect your Amazon Advertising account before you can configure report scheduling.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

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
    </div>
  );
}
