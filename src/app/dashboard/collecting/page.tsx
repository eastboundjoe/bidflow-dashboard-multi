"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function CollectingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("weekly_snapshots")
        .select("status")
        .eq("tenant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data?.status) setStatus(data.status);

      if (data?.status === "completed") {
        router.push("/dashboard");
      }
    }

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center px-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <h1 className="text-2xl font-semibold text-gray-900">Collecting Your Data</h1>
        <p className="text-gray-500 max-w-sm">
          Amazon is generating your placement reports. This usually takes <strong>1 hour</strong>, and up to 24 hours.
        </p>
        <p className="text-sm text-gray-400">
          You&apos;ll receive an email when your data is ready.
        </p>
        {status && (
          <p className="text-xs text-gray-400">Status: {status}</p>
        )}
      </div>
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
        Go to Dashboard Anyway
      </Link>
    </div>
  );
}
