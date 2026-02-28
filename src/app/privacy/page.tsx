import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Eye, Trash2 } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | BidFlow",
  description:
    "How BidFlow handles your personal information. We collect the minimum data needed to operate the service and never sell it to third parties.",
  alternates: { canonical: "/privacy" },
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

export default function PrivacyPage() {
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
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Privacy Policy</h1>
            <p className="text-slate-500">Last updated: February 28, 2026</p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-2xl p-6 flex gap-4">
            <Shield className="h-6 w-6 text-primary shrink-0" />
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              <strong>Our Commitment:</strong> BidFlow was built to help Amazon sellers, not to harvest data. We collect
              the minimum information needed to run the service and we never sell your data to third parties.
            </p>
          </div>

          <div className="space-y-12 py-8">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Eye className="h-5 w-5 text-primary" />
                What We Collect
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                When you use BidFlow, we collect the following to provide the service:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
                <li>
                  <strong>Account Information:</strong> Your email address for account creation, login, and service communications.
                </li>
                <li>
                  <strong>Amazon Ads Credentials:</strong> OAuth refresh tokens used to fetch your advertising data from the Amazon Ads API. These are encrypted at rest with AES-256 and your Amazon password is never stored.
                </li>
                <li>
                  <strong>Advertising Performance Data:</strong> Placement-level campaign metrics pulled from your Amazon Ads account (spend, clicks, ACOS, ROAS, etc.) for display in your dashboard.
                </li>
                <li>
                  <strong>Billing Information:</strong> Payment details are handled entirely by Stripe — BidFlow never stores card numbers.
                </li>
                <li>
                  <strong>Technical Data:</strong> IP addresses and browser metadata for security and fraud prevention only.
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Lock className="h-5 w-5 text-primary" />
                How We Use It
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Your data is used exclusively to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
                <li>Fetch and display your Amazon Ads placement performance data in your dashboard.</li>
                <li>Generate and store weekly reports tied to your account.</li>
                <li>Process subscription payments securely via Stripe.</li>
                <li>Send transactional emails (data ready notifications, billing receipts).</li>
                <li>Identify and resolve technical issues with the service.</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                We do not sell, rent, or share your data with advertisers or third-party marketing services.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Shield className="h-5 w-5 text-primary" />
                Security
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Amazon Ads credentials (OAuth refresh tokens) are encrypted with AES-256 before being stored in our
                database. All data in transit is protected with SSL/TLS encryption. Our database is hosted on Supabase,
                which uses enterprise-grade security protocols.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                We use OAuth for Amazon authentication — BidFlow never sees or stores your Amazon Seller Central or
                Amazon Advertising console password.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Trash2 className="h-5 w-5 text-primary" />
                Data Retention & Deletion
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Advertising performance data is retained for up to 90 days to power historical trend analysis. After
                90 days, older data is automatically removed.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                You may delete your account and all associated data at any time from the Dashboard under Settings.
                Account deletion permanently removes your credentials, advertising data, and notes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Third-Party Services</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                BidFlow uses the following third-party services to operate:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
                <li><strong>Supabase</strong> — database and authentication hosting.</li>
                <li><strong>Stripe</strong> — subscription billing and payment processing.</li>
                <li><strong>Amazon Advertising API</strong> — to retrieve your campaign data on your behalf.</li>
                <li><strong>Vercel</strong> — application hosting and delivery.</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                Each of these services has its own privacy policy. We only share the minimum data necessary with each
                provider to deliver the service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cookies</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                BidFlow uses essential cookies only — specifically for maintaining your authentication session.
                We do not use advertising or tracking cookies.
                See our <Link href="/cookies" className="text-primary hover:underline font-medium">Cookie Policy</Link> for full details.
              </p>
            </section>

            <section className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Contact</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Questions about how your data is handled? Contact us at:
              </p>
              <a href="mailto:support@bidflow.app" className="text-primary font-bold hover:underline">
                support@bidflow.app
              </a>
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
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/about" className="hover:text-primary transition-colors">About</Link>
              <Link href="/cookies" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
