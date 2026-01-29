"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DAY_OPTIONS, HOUR_OPTIONS } from "@/lib/constants";
import type { Credentials, ScheduleSettings } from "@/types";

interface SettingsFormProps {
  credentials: Credentials | null;
}

export function SettingsForm({ credentials }: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<ScheduleSettings>({
    report_day: credentials?.report_day || "monday",
    report_hour: credentials?.report_hour || 3,
  });

  const handleSave = async () => {
    if (!credentials) {
      toast.error("No Amazon account connected. Please connect your account first.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("credentials")
        .update({
          report_day: settings.report_day,
          report_hour: settings.report_hour,
          updated_at: new Date().toISOString(),
        })
        .eq("id", credentials.id);

      if (error) throw error;

      toast.success("Settings saved successfully!");
      router.refresh();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you absolutely sure you want to delete your account? This will permanently remove all your data and cancel your subscription. This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/user/delete", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      toast.success("Account deleted successfully.");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please contact support.");
    }
  };

  const getDayLabel = (value: string) => DAY_OPTIONS.find((d) => d.value === value)?.label || value;
  const getHourLabel = (value: number) => HOUR_OPTIONS.find((h) => h.value === value)?.label || value;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Schedule</CardTitle>
          <CardDescription>
            Choose when you want your weekly Amazon Ads placement reports to be generated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="report_day">Report Day</Label>
              <Select
                value={settings.report_day}
                onValueChange={(value) => setSettings({ ...settings, report_day: value })}
              >
                <SelectTrigger id="report_day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report_hour">Report Time (UTC)</Label>
              <Select
                value={settings.report_hour.toString()}
                onValueChange={(value) => setSettings({ ...settings, report_hour: parseInt(value) })}
              >
                <SelectTrigger id="report_hour">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((hour) => (
                    <SelectItem key={hour.value} value={hour.value.toString()}>
                      {hour.label}
                      {hour.value === 3 ? " (Recommended)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-accent/50 p-4 border border-border flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Your reports will be generated every{" "}
              <span className="text-foreground font-medium">
                {getDayLabel(settings.report_day)}
              </span>{" "}
              at{" "}
              <span className="text-foreground font-medium">
                {getHourLabel(settings.report_hour)} UTC
              </span>.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={handleSave} disabled={saving || !credentials}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for your account and data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deleting your account will permanently remove all your Amazon Ads credentials,
            historical placement data, and active subscriptions. This action cannot be undone.
          </p>
          <Separator className="bg-destructive/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
