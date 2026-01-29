"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
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
      <Card className={isConnected ? "border-primary/50" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="bg-orange-500 p-1.5 rounded-md">
                <img 
                  src="https://www.amazon.com/favicon.ico" 
                  alt="Amazon" 
                  className="w-4 h-4 invert brightness-0"
                />
              </div>
              Amazon Advertising
            </CardTitle>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
          <CardDescription>
            Connect your Amazon Advertising account to automatically collect and optimize your placement data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-accent/50 p-4 border border-border flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Your account is successfully linked</p>
                  <p className="text-xs text-muted-foreground">
                    Amazon Profile ID: <span className="font-mono">{credentials.profile_id || "Not selected"}</span>
                  </p>
                </div>
              </div>

              {!credentials.profile_id && (
                <div className="rounded-lg bg-warning/10 p-4 border border-warning/20 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-warning">Profile Selection Required</p>
                    <p className="text-xs text-muted-foreground">
                      We found your account but you need to select which advertising profile to use.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Select Profile
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-accent/50 p-4 border border-border flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">How it works</p>
                  <p className="text-xs text-muted-foreground">
                    1. Click "Authorize Amazon Account" below.<br />
                    2. Log in to your Amazon Seller/Vendor account.<br />
                    3. Grant BidFlow permission to access your advertising data.<br />
                    4. You'll be redirected back here to select your profile.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {isConnected ? (
            <Button variant="outline" onClick={handleDisconnect} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlink className="h-4 w-4 mr-2" />}
              Disconnect Account
            </Button>
          ) : (
            <Button onClick={handleAuthorize} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white border-none">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
              Authorize Amazon Account
            </Button>
          )}
        </CardFooter>
      </Card>

      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              BidFlow currently has the following permissions for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Read advertising campaigns and performance data
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Update placement bid adjustments
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Manage portfolios
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
