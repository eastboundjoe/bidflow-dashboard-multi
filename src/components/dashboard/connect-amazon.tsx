"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AMAZON_CLIENT_ID, AMAZON_SCOPE } from "@/lib/constants";
import type { Credentials } from "@/types";

interface ConnectAmazonProps {
  credentials: Credentials | null;
}

export function ConnectAmazon({ credentials }: ConnectAmazonProps) {
  const [loading, setLoading] = React.useState(false);

  const isConnected = credentials?.status === "active" && !!credentials.refresh_token;

  const handleAuthorize = async () => {
    setLoading(true);
    try {
      // PKCE Generation
      const verifier = generateRandomString(64);
      const state = generateRandomString(16);
      
      // Store in cookies for the callback route (server-side)
      // Max-age 10 minutes
      document.cookie = `amz_code_verifier=${verifier}; path=/; max-age=600; SameSite=Lax; Secure`;
      document.cookie = `amz_auth_state=${state}; path=/; max-age=600; SameSite=Lax; Secure`;

      const challenge = await generateCodeChallenge(verifier);
      const redirectUri = `${window.location.origin}/auth/amazon/callback`;
      
      const authUrl = new URL("https://www.amazon.com/ap/oa");
      authUrl.searchParams.append("client_id", AMAZON_CLIENT_ID);
      authUrl.searchParams.append("scope", AMAZON_SCOPE);
      authUrl.searchParams.append("response_type", "code");
      authUrl.searchParams.append("redirect_uri", redirectUri);
      authUrl.searchParams.append("state", state);
      authUrl.searchParams.append("code_challenge", challenge);
      authUrl.searchParams.append("code_challenge_method", "S256");

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error("Authorization error:", error);
      toast.error("Failed to start authorization flow.");
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your Amazon account? This will stop all automated reports.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/amazon/disconnect", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to disconnect");

      toast.success("Amazon account disconnected.");
      window.location.reload();
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect account.");
      setLoading(false);
    }
  };

  // Helper for PKCE
  const generateRandomString = (length: number) => {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      result += charset[values[i] % charset.length];
    }
    return result;
  };

  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  return (
    <div className="space-y-6">
      <Card className={cn("overflow-hidden card-hover transition-all duration-300", isConnected ? "border-blue-500/50 shadow-md" : "border-slate-200 dark:border-slate-800")}>
        <CardHeader className={cn("border-b", isConnected ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20" : "bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800")}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl font-bold tracking-tight">
              <div className="bg-orange-500 p-2 rounded-lg shadow-sm">
                <img 
                  src="https://www.amazon.com/favicon.ico" 
                  alt="Amazon" 
                  className="w-4 h-4 invert brightness-0"
                />
              </div>
              Amazon Advertising
            </CardTitle>
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className={cn(
                "font-bold px-3 py-0.5 uppercase text-[10px] tracking-widest",
                isConnected ? "bg-blue-600 hover:bg-blue-600 shadow-sm" : "bg-slate-200 text-slate-600"
              )}
            >
              {isConnected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
          <CardDescription className="mt-2 text-slate-600 dark:text-slate-400">
            Connect your Amazon Advertising account to automatically collect and optimize your placement data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {isConnected ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-900/10 p-5 border border-blue-100 dark:border-blue-900/30 flex items-start gap-4 shadow-sm">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Your account is successfully linked</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Amazon Profile ID: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">{credentials.profile_id || "Not selected"}</span>
                  </p>
                </div>
              </div>

              {!credentials.profile_id && (
                <div className="rounded-xl bg-amber-50/50 dark:bg-amber-900/10 p-5 border border-amber-100 dark:border-amber-900/30 flex items-start gap-4 shadow-sm">
                  <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-full">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Profile Selection Required</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      We found your account but you need to select which advertising profile to use.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 font-bold border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                      Select Profile
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-900/10 p-5 border border-blue-100 dark:border-blue-900/30 flex items-start gap-4 shadow-sm">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">How it works</p>
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 font-medium">
                    <p>1. Click "Authorize Amazon Account" below.</p>
                    <p>2. Log in to your Amazon Seller/Vendor account.</p>
                    <p>3. Grant BidFlow permission to access your advertising data.</p>
                    <p>4. You'll be redirected back here to select your profile.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/20 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          {isConnected ? (
            <Button variant="outline" onClick={handleDisconnect} disabled={loading} className="font-bold shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
              Disconnect Account
            </Button>
          ) : (
            <Button onClick={handleAuthorize} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white border-none font-bold px-8 shadow-md">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Authorize Amazon Account
            </Button>
          )}
        </CardFooter>
      </Card>

      {isConnected && (
        <Card className="card-hover border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="bg-slate-50/30 dark:bg-slate-900/10 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg font-bold tracking-tight">Permissions</CardTitle>
            <CardDescription className="text-xs">
              BidFlow currently has the following permissions for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="h-6 w-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                </div>
                <span className="font-medium">Read advertising campaigns and performance data</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="h-6 w-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                </div>
                <span className="font-medium">Update placement bid adjustments</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <div className="h-6 w-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                </div>
                <span className="font-medium">Manage portfolios</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
