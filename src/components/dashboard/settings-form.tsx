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
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_day: settings.report_day,
          report_hour: settings.report_hour,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update settings");
      }

      toast.success("Settings saved successfully!");
      router.refresh();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
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
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="text-xl font-bold tracking-tight">Report Schedule</CardTitle>
          <CardDescription>
            Choose when you want your weekly Amazon Ads placement reports to be generated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="report_day" className="text-xs font-bold uppercase tracking-wider text-slate-500">Report Day</Label>
              <Select
                value={settings.report_day}
                onValueChange={(value) => setSettings({ ...settings, report_day: value })}
              >
                <SelectTrigger id="report_day" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-xl z-50">
                  {DAY_OPTIONS.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report_hour" className="text-xs font-bold uppercase tracking-wider text-slate-500">Report Time (UTC)</Label>
              <Select
                value={settings.report_hour.toString()}
                onValueChange={(value) => setSettings({ ...settings, report_hour: parseInt(value) })}
              >
                <SelectTrigger id="report_hour" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-xl z-50">
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

          <div className="rounded-lg bg-blue-50/50 dark:bg-blue-900/10 p-4 border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-500 mt-0.5" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your reports will be generated every{" "}
              <span className="text-slate-900 dark:text-slate-100 font-bold">
                {getDayLabel(settings.report_day)}
              </span>{" "}
              at{" "}
              <span className="text-slate-900 dark:text-slate-100 font-bold">
                {getHourLabel(settings.report_hour)} UTC
              </span>.
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end bg-slate-50/50 dark:bg-slate-900/20 px-6 py-4 border-t">
          <Button onClick={handleSave} disabled={saving || !credentials} className="btn-gradient px-8">
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

      <Card className="border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/10 overflow-hidden">
        <CardHeader className="border-b border-red-100 dark:border-red-900/20 bg-red-50/50 dark:bg-red-950/20">
          <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-red-600/70 dark:text-red-400/70">
            Irreversible actions for your account and data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Deleting your account will permanently remove all your Amazon Ads credentials,
            historical placement data, and active subscriptions. This action cannot be undone.
          </p>
          <Separator className="bg-red-200/50 dark:bg-red-900/30" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-red-600 dark:text-red-400">Delete Account</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDeleteAccount} className="font-bold shadow-sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
