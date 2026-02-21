import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Target,
  TrendingUp,
  Shield,
  Clock,
  Zap,
  ArrowRight,
  Activity,
  BarChart3,
} from "lucide-react";

function MockStat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/50 p-3">
      <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <div
        className={`text-xl font-bold font-data ${positive ? "text-green-400" : "text-zinc-100"}`}
      >
        {value}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/60 bg-background/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight font-display">
                BidFlow
              </span>
            </div>
            <div className="flex items-center gap-5">
              <Link
                href="#features"
                className="hidden sm:block text-sm text-zinc-400 hover:text-foreground transition-colors"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="hidden sm:block text-sm text-zinc-400 hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
              <Link href="/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-foreground"
                >
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="font-medium">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-36 pb-24">
        {/* Background */}
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/4 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-20 items-center">
            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary font-medium mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Amazon Placement Optimization
              </div>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-[70px] font-bold leading-[1.03] tracking-tight mb-6">
                Stop guessing.
                <br />
                <span className="text-gradient-green">Start growing.</span>
              </h1>
              <p className="text-base sm:text-lg text-zinc-400 leading-relaxed mb-8 max-w-md">
                See exactly where your Amazon ad budget converts across every
                placement — and submit bid adjustments in one click.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="font-semibold gap-2 w-full sm:w-auto"
                  >
                    Start Free Trial <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-zinc-700 text-zinc-300 hover:text-foreground hover:border-zinc-600"
                  >
                    See How It Works
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-zinc-600">
                30-day free trial · No credit card required
              </p>
            </div>

            {/* Right: dashboard mockup */}
            <div className="hidden lg:block">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-sm p-5 shadow-2xl ring-1 ring-white/5">
                {/* Window chrome */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-600 font-data">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Week 47 · Nov 18–24
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <MockStat label="ROAS" value="6.4×" positive />
                  <MockStat label="ACoS" value="15.6%" />
                  <MockStat label="Ad Spend" value="$4,820" />
                  <MockStat label="Sales" value="$30,848" positive />
                </div>

                {/* Placement table */}
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="grid grid-cols-4 gap-0 px-3 py-2.5 bg-zinc-800/50 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    <span>Placement</span>
                    <span className="text-right">ROAS</span>
                    <span className="text-right">Spend</span>
                    <span className="text-right">Bid Adj.</span>
                  </div>
                  {[
                    {
                      name: "Top of Search",
                      roas: "8.2×",
                      spend: "$2,150",
                      adj: "+30%",
                      adjCls: "text-green-400",
                    },
                    {
                      name: "Rest of Search",
                      roas: "5.1×",
                      spend: "$1,840",
                      adj: "—",
                      adjCls: "text-zinc-600",
                    },
                    {
                      name: "Product Page",
                      roas: "3.8×",
                      spend: "$830",
                      adj: "−20%",
                      adjCls: "text-red-400",
                    },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="grid grid-cols-4 gap-0 px-3 py-2.5 border-t border-zinc-800 text-xs items-center"
                    >
                      <span className="text-zinc-300 truncate">{row.name}</span>
                      <span className="text-right font-data text-primary">
                        {row.roas}
                      </span>
                      <span className="text-right font-data text-zinc-400">
                        {row.spend}
                      </span>
                      <span
                        className={`text-right font-data font-semibold ${row.adjCls}`}
                      >
                        {row.adj}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Submit button mockup */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-zinc-600">
                    1 change pending
                  </span>
                  <div className="rounded-md bg-primary/20 border border-primary/30 px-3 py-1.5 text-xs text-primary font-medium">
                    Submit to Amazon →
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-2 gap-5">
          {/* Problem */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-3 py-1 mb-6">
              The Problem
            </div>
            <h3 className="font-display text-2xl font-bold mb-4 text-zinc-200">
              Flying blind on Amazon ads
            </h3>
            <p className="text-zinc-500 mb-6 text-sm leading-relaxed">
              Most sellers have no idea which placements actually convert. They
              set bids and hope for the best — leaving real money on the table.
            </p>
            <ul className="space-y-3">
              {[
                "No visibility into placement-level performance",
                "Bid adjustments based on gut feeling",
                "Wasted spend on low-converting placements",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-zinc-500"
                >
                  <span className="mt-0.5 text-red-400/70 text-base leading-none shrink-0">
                    ✗
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-6">
                The BidFlow Solution
              </div>
              <h3 className="font-display text-2xl font-bold mb-4">
                Data-backed decisions
              </h3>
              <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
                BidFlow automatically collects your placement reports and shows
                you exactly which placements drive ROI — so you can act on facts,
                not hunches.
              </p>
              <ul className="space-y-3">
                {[
                  "Clear placement performance by campaign",
                  "30-day vs 7-day side-by-side comparison",
                  "Submit bid changes directly to Amazon",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-zinc-300"
                  >
                    <CheckCircle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="features"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 mb-5">
            How It Works
          </div>
          <h2 className="font-display text-4xl font-bold">
            Up and running in minutes
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              num: "01",
              icon: <Target className="h-5 w-5 text-primary" />,
              title: "Connect Your Account",
              desc: "Securely link your Amazon Advertising account via OAuth. We never store your password.",
            },
            {
              num: "02",
              icon: <BarChart3 className="h-5 w-5 text-primary" />,
              title: "Analyze Placements",
              desc: "We pull your placement reports and break down performance across Top of Search, Rest of Search, and Product Pages.",
            },
            {
              num: "03",
              icon: <TrendingUp className="h-5 w-5 text-primary" />,
              title: "Optimize & Grow",
              desc: "Edit bid adjustments directly in the dashboard and submit changes to Amazon with a single click.",
            },
          ].map((step) => (
            <div
              key={step.num}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 relative group hover:border-zinc-700 transition-colors"
            >
              <div className="absolute top-6 right-6 font-display text-6xl font-bold text-zinc-800/80 group-hover:text-zinc-700/80 transition-colors select-none leading-none">
                {step.num}
              </div>
              <div className="mb-5 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                {step.icon}
              </div>
              <h3 className="font-display text-lg font-bold mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Placement Types */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold mb-3">
            Three Placements. One Dashboard.
          </h2>
          <p className="text-zinc-500 text-sm">
            Full visibility across every placement type Amazon offers
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              name: "Top of Search",
              tag: "TOS",
              border: "border-l-green-500",
              tagCls:
                "text-green-400 bg-green-400/10 border border-green-400/20",
              desc: "First row of search results. Highest visibility, often highest CPC — usually your best converters.",
            },
            {
              name: "Rest of Search",
              tag: "ROS",
              border: "border-l-blue-500",
              tagCls: "text-blue-400 bg-blue-400/10 border border-blue-400/20",
              desc: "Below the fold on search pages. Lower CPC with still-high purchase intent.",
            },
            {
              name: "Product Page",
              tag: "PP",
              border: "border-l-orange-500",
              tagCls:
                "text-orange-400 bg-orange-400/10 border border-orange-400/20",
              desc: "On competitor and related product detail pages. Great for conquest and defensive plays.",
            },
          ].map((pt) => (
            <div
              key={pt.name}
              className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 border-l-4 ${pt.border}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold">{pt.name}</h3>
                <span
                  className={`text-xs font-data font-medium rounded px-2 py-0.5 ${pt.tagCls}`}
                >
                  {pt.tag}
                </span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">{pt.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl font-bold mb-3">
            Simple Pricing
          </h2>
          <p className="text-zinc-500">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {/* Pro */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 flex flex-col">
            <div className="mb-7">
              <h3 className="font-display text-xl font-bold mb-2">Pro</h3>
              <div className="flex items-end gap-1">
                <span className="font-display text-5xl font-bold">$29</span>
                <span className="text-zinc-500 mb-1.5">/month</span>
              </div>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {[
                "90 days historical data",
                "Up to 3 Amazon Ads accounts",
                "Weekly automated reports",
                "Placement analytics dashboard",
                "CSV export",
                "Email support",
              ].map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 text-sm text-zinc-400"
                >
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="block">
              <Button
                className="w-full border-zinc-700 text-zinc-300 hover:text-foreground"
                variant="outline"
                size="lg"
              >
                Start Free Trial
              </Button>
            </Link>
          </div>

          {/* Enterprise */}
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-8 relative overflow-hidden flex flex-col">
            <div className="absolute -top-3 left-6 z-10">
              <span className="text-xs font-medium bg-primary text-primary-foreground px-3 py-1 rounded-full">
                Most Popular
              </span>
            </div>
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex flex-col flex-1 pt-2">
              <div className="mb-7">
                <h3 className="font-display text-xl font-bold mb-2">
                  Enterprise
                </h3>
                <div className="flex items-end gap-1">
                  <span className="font-display text-5xl font-bold">$99</span>
                  <span className="text-zinc-400 mb-1.5">/month</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Unlimited historical data",
                  "Unlimited Amazon Ads accounts",
                  "Daily automated reports",
                  "Advanced Sankey visualizations",
                  "API access",
                  "Priority support",
                  "Custom integrations",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-3 text-sm text-zinc-300"
                  >
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block">
                <Button className="w-full font-semibold" size="lg">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Shield className="h-5 w-5" />,
              title: "Secure & Private",
              desc: "AES-256 encrypted credentials. OAuth only — we never see your Amazon password or store sensitive login data.",
            },
            {
              icon: <Clock className="h-5 w-5" />,
              title: "Automated Reports",
              desc: "Weekly collection runs automatically. Your dashboard stays current without any manual intervention.",
            },
            {
              icon: <Zap className="h-5 w-5" />,
              title: "Fast Insights",
              desc: "Filter by week, portfolio, or campaign. See placement trends and submit bid changes all in one flow.",
            },
          ].map((item) => (
            <div key={item.title} className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary mb-4">
                {item.icon}
              </div>
              <h3 className="font-display font-bold mb-2">{item.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 relative overflow-hidden p-12 md:p-16 text-center">
          <div className="absolute inset-0 grid-pattern opacity-40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-72 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-5">
              Ready to optimize?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-md mx-auto text-sm leading-relaxed">
              Join Amazon sellers using data to make smarter bid decisions. Start
              your free trial today — no credit card needed.
            </p>
            <Link href="/signup">
              <Button size="lg" className="font-semibold gap-2">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Activity className="h-3 w-3 text-primary" />
              </div>
              <span className="font-display text-sm font-bold">BidFlow</span>
            </div>
            <p className="text-zinc-600 text-xs">
              &copy; {new Date().getFullYear()} BidFlow. All rights reserved.
            </p>
            <div className="flex gap-5 text-xs text-zinc-600">
              <Link
                href="/privacy"
                className="hover:text-zinc-400 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="hover:text-zinc-400 transition-colors"
              >
                Terms
              </Link>
              <a
                href="mailto:support@bidflow.app"
                className="hover:text-zinc-400 transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
