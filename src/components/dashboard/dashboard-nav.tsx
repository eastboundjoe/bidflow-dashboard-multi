"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User } from "@supabase/supabase-js";
import {
  Activity,
  Settings,
  CreditCard,
  Link2,
  LogOut,
  ChevronDown,
} from "lucide-react";

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
      if (!response.ok) {
        throw new Error("Failed to trigger data collection");
      }
    } catch (error) {
      console.error("Error collecting data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-background/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center transition-colors group-hover:bg-primary/20">
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-display text-base font-bold tracking-tight">
              BidFlow
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/settings", label: "Settings" },
              { href: "/dashboard/billing", label: "Billing" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-foreground hover:bg-zinc-800/60 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Status pill */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs text-primary font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Pro
            </div>

            {/* Collect Data */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCollectData}
              disabled={loading}
              className="border-zinc-700 text-zinc-300 hover:text-foreground hover:border-zinc-600 text-xs h-8 px-3"
            >
              {loading ? "Collecting..." : "Collect Data"}
            </Button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8 text-zinc-400 hover:text-foreground px-2"
                >
                  <span className="hidden sm:block text-xs max-w-[140px] truncate">
                    {user.email}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                  {user.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center"
                  >
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
                  className="text-red-400 focus:text-red-400"
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
