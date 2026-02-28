import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cookie, Shield, CreditCard, Settings } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | BidFlow",
  description:
    "BidFlow uses essential cookies only — for authentication and payments. No advertising or tracking cookies.",
  alternates: { canonical: "/cookies" },
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

const cookies = [
  {
    icon: Shield,
    name: "Authentication Session",
    provider: "Supabase",
    purpose:
      "Keeps you logged in to your BidFlow account. Without this cookie, you would need to log in on every page visit.",
    type: "Essential",
    duration: "Session / 1 week (remember me)",
    canDisable: false,
  },
  {
    icon: CreditCard,
    name: "Payment Session",
    provider: "Stripe",
    purpose:
      "Used by Stripe during the checkout process to securely process subscription payments. Not stored after checkout.",
    type: "Essential",
    duration: "Session",
    canDisable: false,
  },
  {
    icon: Settings,
    name: "CSRF Protection",
    provider: "BidFlow",
    purpose:
      "A security token that protects form submissions and API requests from cross-site request forgery attacks.",
    type: "Essential",
    duration: "Session",
    canDisable: false,
  },
];

export default function CookiesPage() {
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
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Cookie Policy</h1>
            <p className="text-slate-500">Last updated: February 28, 2026</p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-2xl p-6 flex gap-4">
            <Cookie className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
            <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
              <strong>Short version:</strong> BidFlow only uses cookies that are strictly necessary to make the site
              work — keeping you logged in and processing payments securely. We use <strong>no advertising cookies,
              no analytics cookies, and no tracking pixels</strong>.
            </p>
          </div>

          <div className="space-y-12 py-4">
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">What Are Cookies?</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Cookies are small text files stored in your browser when you visit a website. They allow the site
                to remember information about your visit — like the fact that you&apos;re logged in — so you
                don&apos;t have to repeat actions on every page.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cookies We Use</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                BidFlow uses only <strong>essential cookies</strong> — the minimum required for the service to
                function. These cannot be disabled without breaking core functionality.
              </p>

              <div className="space-y-4">
                {cookies.map((cookie) => {
                  const Icon = cookie.icon;
                  return (
                    <div
                      key={cookie.name}
                      className="border border-slate-100 dark:border-slate-800 rounded-xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white text-sm">{cookie.name}</p>
                            <p className="text-xs text-slate-500">Set by: {cookie.provider}</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-primary border border-blue-100 dark:border-blue-800 rounded-full px-3 py-1 shrink-0">
                          {cookie.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {cookie.purpose}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-50 dark:border-slate-800">
                        <span><strong>Duration:</strong> {cookie.duration}</span>
                        <span><strong>Can disable:</strong> {cookie.canDisable ? "Yes" : "No — required for login"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cookies We Do NOT Use</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                BidFlow does not use any of the following:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
                <li>Analytics or tracking cookies (e.g., Google Analytics, Hotjar)</li>
                <li>Advertising or retargeting pixels (e.g., Meta Pixel, Google Ads remarketing)</li>
                <li>Social media tracking cookies</li>
                <li>A/B testing cookies</li>
                <li>Any third-party marketing or behavioral tracking</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Third-Party Cookies</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                When you complete a payment, Stripe may set cookies in your browser to process the transaction
                securely. These are subject to{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Stripe&apos;s Privacy Policy
                </a>
                . BidFlow does not control or have access to these cookies.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Managing Cookies</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Since BidFlow only uses essential cookies, there is no cookie preference panel. If you block all
                cookies via your browser settings, the authentication session cookie will be blocked and you
                will not be able to stay logged in.
              </p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Most browsers allow you to manage cookies under Settings → Privacy. Refer to your browser&apos;s
                help documentation for instructions.
              </p>
            </section>

            <section className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Contact</h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Questions about this Cookie Policy?
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
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/about" className="hover:text-primary transition-colors">About</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
