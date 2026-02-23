"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { User } from "@supabase/supabase-js";
import { BarChart3, Settings, CreditCard, Link2, LogOut, ChevronDown, AlertTriangle } from "lucide-react";

interface DashboardNavProps {
  user: User;
}

function formatCollectionDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

interface CollectionStatus {
  lastCollectedAt: Date | null;
  lastWeekId: string | null;
  collectedThisWeek: boolean;
}

export function DashboardNav({ user }: DashboardNavProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<CollectionStatus>({
    lastCollectedAt: null,
    lastWeekId: null,
    collectedThisWeek: false,
  });
  const [showWarning, setShowWarning] = useState(false);

  const userInitial = user.email?.[0]?.toUpperCase() || "U";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const fullName = user.user_metadata?.full_name || user.email;

  useEffect(() => {
    fetch("/api/collect/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus({
          lastCollectedAt: data.lastCollectedAt ? new Date(data.lastCollectedAt) : null,
          lastWeekId: data.lastWeekId ?? null,
          collectedThisWeek: data.collectedThisWeek ?? false,
        });
      })
      .catch(() => {/* silent — button still works */});
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const triggerCollection = async () => {
    setShowWarning(false);
    setLoading(true);
    try {
      const response = await fetch("/api/collect", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger data collection");
      }

      setStatus((prev) => ({ ...prev, lastCollectedAt: new Date(), collectedThisWeek: true }));
      toast.success(
        "Reports requested! Amazon is processing them now. This takes about an hour. We'll email you when your data is ready.",
        { duration: 8000 }
      );
    } catch (error) {
      console.error("Error collecting data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to trigger data collection");
    } finally {
      setLoading(false);
    }
  };

  const handleCollectData = () => {
    if (status.collectedThisWeek) {
      setShowWarning(true);
      return;
    }
    triggerCollection();
  };

  const collectedToday = status.lastCollectedAt ? isToday(status.lastCollectedAt) : false;

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-[#0F172A] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all border border-slate-800">
              <svg viewBox="0 0 32 32" className="h-6 w-6">
                <path d="M9 7h8.5a5.5 5.5 0 0 1 0 11H9V7zm0 18h9.5a5.5 5.5 0 0 0 0-11H9v11z" fill="#10B981" transform="scale(0.85) translate(2.5, 2.5)"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">BidFlow</span>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-400 hover:text-primary font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/settings"
              className="text-gray-600 dark:text-gray-400 hover:text-primary font-medium"
            >
              Settings
            </Link>
            <Link
              href="/dashboard/billing"
              className="text-gray-600 dark:text-gray-400 hover:text-primary font-medium"
            >
              Billing
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <Badge
              variant="outline"
              className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse" />
              Pro
            </Badge>

            {/* Collect Data — inline confirmation when warning is active */}
            {showWarning ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="text-xs text-amber-800 dark:text-amber-300 font-medium hidden sm:block">
                  {collectedToday
                    ? `Already collected today${status.lastWeekId ? ` (${status.lastWeekId})` : ""}`
                    : `Collected ${status.lastCollectedAt ? formatCollectionDate(status.lastCollectedAt) : ""}${status.lastWeekId ? ` · ${status.lastWeekId}` : ""}`}
                </span>
                <div className="flex items-center gap-1.5 ml-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs border-amber-300 hover:border-amber-400 text-amber-800 dark:text-amber-300"
                    onClick={() => setShowWarning(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={triggerCollection}
                    disabled={loading}
                  >
                    {loading ? "Collecting..." : "Collect Anyway"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCollectData}
                disabled={loading}
              >
                {loading ? "Collecting..." : "Collect Data"}
              </Button>
            )}

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-slate-200 hover:border-primary hover:text-primary">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={avatarUrl} alt={fullName || ""} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block max-w-[140px] truncate text-sm font-medium">
                    {fullName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl p-1">
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl} alt={fullName || ""} referrerPolicy="no-referrer" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <Settings className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium">Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/billing" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <CreditCard className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium">Billing</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/connect" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <Link2 className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium">Amazon Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
