"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
          <p className="text-slate-600 mb-8">
            We&apos;ve sent a password reset link to <span className="font-semibold text-slate-900">{email}</span>
          </p>
          <Button variant="outline" className="w-full" onClick={() => router.push("/login")}>
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-xl bg-[#0F172A] flex items-center justify-center shadow-sm group-hover:shadow-md transition-all border border-slate-800">
                <svg viewBox="0 0 32 32" className="h-6 w-6">
                  <path d="M9 7h8.5a5.5 5.5 0 0 1 0 11H9V7zm0 18h9.5a5.5 5.5 0 0 0 0-11H9v11z" fill="#10B981" transform="scale(0.85) translate(2.5, 2.5)"/>
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">BidFlow</span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-medium text-slate-600 hover:text-primary transition-colors">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Form */}
      <div className="flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Reset Password</h1>
            <p className="text-slate-600">Enter your email and we&apos;ll send you a recovery link</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 border-slate-200 focus:border-primary"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-11 font-semibold text-base shadow-md btn-gradient" disabled={loading}>
                {loading ? "Sending link…" : "Send Reset Link"}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <Link href="/login" className="text-sm text-slate-500 hover:text-primary font-medium transition-colors inline-flex items-center gap-1">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                </svg>
                Back to Login
              </Link>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">
            BidFlow securely handles your data with industry-standard encryption
          </p>
        </div>
      </div>
    </div>
  );
}
