"use client";

import { useState } from "react";
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
import { User } from "@supabase/supabase-js";
import { BarChart3, Settings, CreditCard, Link2, LogOut, ChevronDown } from "lucide-react";

interface DashboardNavProps {
  user: User;
}

export function DashboardNav({ user }: DashboardNavProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleCollectData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/collect", {
        method: "POST",
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to trigger data collection");
      }

      toast.success("Data collection started successfully!");
    } catch (error) {
      console.error("Error collecting data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to trigger data collection");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">BidFlow</span>
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

            {/* Collect Data Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCollectData}
              disabled={loading}
            >
              {loading ? "Collecting..." : "Collect Data"}
            </Button>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="hidden sm:inline-block max-w-[150px] truncate">
                    {user.email}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/billing" className="flex items-center">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/connect" className="flex items-center">
                    <Link2 className="mr-2 h-4 w-4" />
                    Amazon Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
