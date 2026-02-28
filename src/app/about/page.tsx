import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Target, BarChart3, Zap, TrendingUp, CheckCircle } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | BidFlow",
  description:
    "BidFlow is a private Amazon Ads placement optimization tool built for serious sellers who want data-driven control over their PPC spend.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About BidFlow",
    description: "Built by Amazon sellers, for Amazon sellers.",
    url: "/about",
    type: "website",
  },
};

const BidFlowLogo = () => (
  <div className="h-9 w-9 rounded-xl bg-[#0F172A] flex items-center justify-center shadow-sm border border-slate-800">
    <svg viewBox="0 0 32 32" className="h-6 w-6">
      <path
        d="M9 7h8.5a5.5 5.5 0 0 1 0 11H9V7zm0 18h9.5a5.5 5.5 0 0 0 0-11H9v11z"
        fill="#10B981"
        transform="scale(0.85) translate(2.5, 2.5)"
      />
    </svg>
  </div>
);

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <BidFlowLogo />
              <span className="text-xl font-bold tracking-tight">BidFlow</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="hidden sm:block text-slate-600 hover:text-primary font-medium transition-colors"
              >
                Log in
              </Link>
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-20">
        <div className="space-y-16">
          {/* Hero */}
          <section className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
              About BidFlow
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Built by Amazon sellers who got tired of flying blind on placement bids.
            </p>
          </section>

          {/* Mission */}
          <section className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-sm">
                <Target className="h-5 w-5" />
                Our Mission
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                Placement data that actually drives decisions
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Amazon buries placement performance across multiple Seller Central reports that most sellers never look at.
                BidFlow surfaces that data in one clear dashboard — so you know exactly where to raise bids and where to cut them.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                We believe every Amazon advertiser deserves the same data visibility that enterprise agencies have — without
                needing an agency.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 text-center space-y-6">
              <div>
                <div className="text-5xl font-extrabold text-primary mb-1">90</div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">Days of Historical Data</p>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="text-5xl font-extrabold text-primary mb-1">3</div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">Placement Types Tracked Weekly</p>
              </div>
            </div>
          </section>

          {/* Why we built it */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-sm">
              <TrendingUp className="h-5 w-5" />
              Why We Built This
            </div>
            <div className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed space-y-4">
              <p>
                After running Amazon Sponsored Products campaigns, the same pattern kept showing up: Top of Search was
                generating a 4–5x ROAS while Product Page was burning money at 50%+ ACOS — and Seller Central made it
                nearly impossible to see that split quickly.
              </p>
              <p>
                BidFlow was built to solve that. Connect your Amazon Ads account once, and every week we automatically
                pull your placement-level performance across every campaign. You see exactly where your spend works and
                where it doesn&apos;t — and you can submit bid adjustment changes directly from the dashboard.
              </p>
            </div>
          </section>

          {/* What we are / aren't */}
          <section className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 md:p-12 border border-slate-100 dark:border-slate-800">
            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  What BidFlow Is
                </h3>
                <ul className="space-y-3 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {[
                    "A private data tool that connects to your Amazon Ads account via OAuth",
                    "A placement analytics dashboard covering Top of Search, Rest of Search, and Product Page",
                    "A weekly reporting system with 90 days of historical data",
                    "A way to submit bid adjustments directly to Amazon from your dashboard",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  What BidFlow Is Not
                </h3>
                <ul className="space-y-3 text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {[
                    "Not affiliated with or endorsed by Amazon, Inc.",
                    "Not an automated bid management robot — you stay in control of all changes",
                    "Not a replacement for your Amazon Ads strategy — we give you the data, you make the calls",
                    "Not a managed service or agency",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-red-500 font-bold flex-shrink-0 mt-0.5">✗</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="py-8 border-t border-slate-100 dark:border-slate-800 text-center space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Security & Privacy</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Your Amazon Ads credentials are AES-256 encrypted at rest. We use OAuth — your Amazon password never
              touches our servers. We never sell your data to third parties.
            </p>
            <div className="flex justify-center gap-8 pt-2">
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-primary">
                  <Shield className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">AES-256 Encrypted</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-primary">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">OAuth Only</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-full text-primary">
                  <Zap className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">No Data Selling</span>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Contact</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Questions about BidFlow? We&apos;re here to help.
            </p>
            <a
              href="mailto:support@bidflow.app"
              className="text-primary font-bold text-xl hover:underline block"
            >
              support@bidflow.app
            </a>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-slate-50 dark:bg-gray-900 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} BidFlow. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/cookies" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
