import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Scale, RefreshCcw, ShieldAlert } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | BidFlow",
  description:
    "Terms and conditions for using BidFlow, a private Amazon Ads placement analytics and bid optimization tool.",
  alternates: { canonical: "/terms" },
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

export default function TermsPage() {
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
              <Link href="/login">
                <Button variant="ghost">Log in</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Terms of Service</h1>
            <p className="text-slate-500">Last updated: February 28, 2026</p>
          </div>

          {/* Disclaimer banner */}
          <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
              <AlertCircle className="h-5 w-5" />
              IMPORTANT DISCLAIMER
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
              BidFlow (bidflow.app) is a private, independent software tool. We are not affiliated with, endorsed by,
              or operated by Amazon, Inc. or any of its subsidiaries. Use of BidFlow does not guarantee any
              advertising outcome, and all bid decisions remain solely your responsibility as the account holder.
            </p>
          </div>

          <div className="space-y-12 py-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Scale className="h-5 w-5 text-primary" />
                Service Description
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                BidFlow is a subscription-based analytics tool that connects to your Amazon Advertising account via
                OAuth, retrieves placement-level performance data, and presents it through a dashboard. The monthly
                subscription fee covers access to this software and the automated weekly data collection system.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                BidFlow does not make bid changes on your behalf without your explicit action. All changes you submit
                through the dashboard are sent to the Amazon Ads API under your credentials.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <ShieldAlert className="h-5 w-5 text-primary" />
                No Guarantee of Results
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                BidFlow provides data and analytics tools to inform your advertising decisions. We cannot guarantee
                specific ROAS, ACOS, sales, or profit outcomes. Advertising results depend on many factors outside
                our control, including Amazon&apos;s algorithm, competitor behavior, seasonality, and product
                listing quality.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                You are solely responsible for all bid adjustments and campaign changes submitted through the
                platform.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <RefreshCcw className="h-5 w-5 text-primary" />
                Subscription & Refund Policy
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Subscriptions are billed monthly and renew automatically. We offer a <strong>7-day refund window</strong> for
                new subscriptions if you have not collected more than one week of data. After this window,
                subscriptions are non-refundable but may be canceled at any time to prevent future charges.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Cancellation takes effect at the end of the current billing period. You retain access to your
                dashboard until the period ends.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Acceptable Use</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                You agree to use BidFlow only in connection with Amazon Ads accounts you own or are authorized to
                manage. You may not use BidFlow to violate Amazon&apos;s Advertising Policies or Terms of Service.
                We reserve the right to suspend accounts found to be in violation.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data & Account Access</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                By connecting your Amazon Ads account, you authorize BidFlow to retrieve advertising performance
                data and submit bid adjustments on your behalf via the Amazon Ads API. You may revoke this access
                at any time from your Amazon Ads account settings or from the BidFlow dashboard.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Limitation of Liability</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                BidFlow is not responsible for Amazon API outages, delays in data availability, or changes in
                Amazon&apos;s advertising policies that affect data access. In no event shall BidFlow be liable
                for any indirect, incidental, special, or consequential damages arising from your use of the
                platform, including but not limited to lost profits or advertising losses.
              </p>
            </section>

            <section className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Acceptance of Terms</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                By creating an account or subscribing to BidFlow, you acknowledge that you have read, understood,
                and agree to be bound by these terms. If you have questions, contact us before subscribing.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} BidFlow. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
              <Link href="/" className="hover:text-primary transition-colors">Home</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="/about" className="hover:text-primary transition-colors">About</Link>
              <Link href="/cookies" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
