import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  BarChart3,
  Target,
  TrendingUp,
  Shield,
  Clock,
  Zap,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-900 dark:to-gray-950 font-sans">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">BidFlow</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="#features"
                className="hidden sm:block text-slate-600 hover:text-primary font-medium transition-colors"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="hidden sm:block text-slate-600 hover:text-primary font-medium transition-colors"
              >
                Pricing
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-slate-300 hover:border-primary hover:text-primary font-medium">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 text-center">
        <Badge variant="secondary" className="mb-4 bg-blue-50 text-blue-700 border-blue-200 font-medium">
          Built for Amazon PPC Sellers
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
          Stop Guessing.
          <br />
          <span className="text-primary">Start Optimizing.</span>
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          BidFlow automatically tracks your placement performance across Top of Search, Rest of Search, and Product Pages — so you know exactly where to raise or cut bids to{" "}
          <strong className="text-slate-900 dark:text-slate-100">maximize your ROAS</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto px-8 shadow-md">
              Start Free Trial
            </Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
              See How It Works
            </Button>
          </Link>
        </div>
        <p className="text-sm text-slate-500 mb-12">
          30-day free trial. No credit card required.
        </p>

        {/* Floating Mini Dashboard Preview */}
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-2xl border border-blue-200 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 mx-4 bg-white dark:bg-gray-700 rounded-md text-xs text-slate-400 py-1 px-3 text-left">
                app.bidflow.com/dashboard
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
              </div>
            </div>
            {/* Mini table */}
            <div className="p-4">
              <div className="text-left mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Placement Performance — Last 30 Days
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Placement</th>
                    <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Spend</th>
                    <th className="text-right py-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ROAS</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">ACOS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-left">Top of Search</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-600 dark:text-slate-400">$1,248</td>
                    <td className="py-3 pr-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                        4.2x
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                        23.8%
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0"></div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-left">Rest of Search</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-600 dark:text-slate-400">$642</td>
                    <td className="py-3 pr-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                        2.8x
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                        35.7%
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-300 flex-shrink-0"></div>
                        <span className="font-medium text-slate-800 dark:text-slate-200 text-left">Product Page</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-600 dark:text-slate-400">$319</td>
                    <td className="py-3 pr-4 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                        1.9x
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                        52.6%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-400">3 placement types · 17 campaigns tracked</span>
                <span className="text-xs font-semibold text-primary flex items-center gap-1">
                  View full report <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-y border-slate-100 dark:border-slate-800 bg-white dark:bg-gray-950 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-extrabold text-primary mb-1">3</div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Placement Types Tracked</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary mb-1">90</div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Days Historical Data</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary mb-1">Weekly</div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Automated Reports</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary mb-1">100%</div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Secure OAuth</div>
            </div>
          </div>
        </div>
      </section>

      {/* Full Dashboard Mockup Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 bg-blue-50 text-blue-700 border-blue-200">
            Dashboard Preview
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Your placement data, organized and actionable
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Every campaign, every placement, every week — laid out so you know exactly where to move the needle.
          </p>
        </div>

        {/* Browser Frame */}
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900">
          {/* Browser Chrome */}
          <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="flex-1 max-w-sm mx-auto bg-white dark:bg-gray-700 rounded-md text-xs text-slate-400 py-1 px-3 text-center">
              app.bidflow.com/dashboard
            </div>
          </div>

          {/* App Nav */}
          <div className="bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-slate-800 px-6 flex items-center gap-6 pt-3">
            <div className="flex items-center gap-2 pb-3 border-b-2 border-primary">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Dashboard</span>
            </div>
            <div className="flex items-center gap-2 pb-3 text-slate-400">
              <span className="text-sm">Reports</span>
            </div>
            <div className="flex items-center gap-2 pb-3 text-slate-400">
              <span className="text-sm">Settings</span>
            </div>
            <div className="ml-auto pb-3">
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-3 py-1 font-medium">
                Week 7 · Feb 10–16
              </span>
            </div>
          </div>

          {/* Dashboard Body */}
          <div className="p-6 bg-slate-50 dark:bg-gray-950">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Total Spend</div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">$2,209</div>
                <div className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +12% vs last week
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Blended ROAS</div>
                <div className="text-2xl font-extrabold text-green-600">3.4x</div>
                <div className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +0.3x vs last week
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Blended ACOS</div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white">29.4%</div>
                <div className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> −2.1% vs last week
                </div>
              </div>
            </div>

            {/* Placement Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Placement Performance by Campaign</span>
                <span className="text-xs text-slate-400">Last 30 days</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Campaign</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Portfolio</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Placement</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">30D Spend</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">ROAS</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">ACOS</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bid Adj.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {[
                      { campaign: "Hot & Spicy Ramen — Broad", portfolio: "Core Products", placement: "Top of Search", spend: "$842", roas: "4.7x", acos: "21.3%", bid: "+35%", roasColor: "green" },
                      { campaign: "Hot & Spicy Ramen — Broad", portfolio: "Core Products", placement: "Rest of Search", spend: "$311", roas: "2.9x", acos: "34.5%", bid: "0%", roasColor: "yellow" },
                      { campaign: "Hot & Spicy Ramen — Broad", portfolio: "Core Products", placement: "Product Page", spend: "$128", roas: "1.6x", acos: "62.5%", bid: "0%", roasColor: "red" },
                      { campaign: "Chicken Seasoning — Exact", portfolio: "Core Products", placement: "Top of Search", spend: "$406", roas: "5.1x", acos: "19.6%", bid: "+50%", roasColor: "green" },
                      { campaign: "Chicken Seasoning — Exact", portfolio: "Core Products", placement: "Rest of Search", spend: "$191", roas: "3.2x", acos: "31.3%", bid: "0%", roasColor: "yellow" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium max-w-[160px] truncate">{row.campaign}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{row.portfolio}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{row.placement}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{row.spend}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.roasColor === "green" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                            row.roasColor === "yellow" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" :
                            "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                          }`}>
                            {row.roas}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 text-xs">{row.acos}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold ${row.bid !== "0%" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`}>
                            {row.bid}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
                Showing 5 of 51 rows · 17 campaigns · 3 placements each
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-6 rounded-2xl overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800">
          {/* Problem side */}
          <div className="bg-slate-50 dark:bg-slate-900 p-10">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-semibold">
              The Problem
            </div>
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              Flying blind on placement bids
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Amazon&apos;s Seller Central buries placement data across multiple reports. Most sellers never look at it — and are silently losing money.
            </p>
            <ul className="space-y-4">
              {[
                "No visibility into which placements are profitable",
                "Guessing at bid adjustments with no data",
                "Overspending on Product Page with 50%+ ACOS",
                "Missing out on Top of Search ROAS gains",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-600 dark:text-slate-400">
                  <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Solution side */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-10 text-white">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-white/20 text-white text-sm font-semibold">
              The BidFlow Way
            </div>
            <h2 className="text-2xl font-bold mb-4">
              Data-backed decisions, every week
            </h2>
            <p className="text-blue-100 mb-8 leading-relaxed">
              BidFlow surfaces exactly where your ad spend works and where it doesn&apos;t — automatically, every week.
            </p>
            <ul className="space-y-4">
              {[
                { text: "See exactly which placements drive your ROAS", metric: "up to 4.7x" },
                { text: "Know precisely where to adjust bids", metric: "+35% where it counts" },
                { text: "Cut waste on underperforming placements", metric: "save 20-40% on spend" },
                { text: "90 days of historical data, updated weekly", metric: "always current" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3">
                  <CheckCircle className="text-blue-200 h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{item.text}</span>
                    <span className="text-blue-200 text-sm ml-2">— {item.metric}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="features"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <h2 className="text-3xl font-bold text-center mb-3 text-slate-900 dark:text-white">How It Works</h2>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-14">Three steps to placement clarity</p>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connector lines (desktop) */}
          <div className="hidden md:block absolute top-12 left-[33%] w-[17%] h-px bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 z-0">
            <ArrowRight className="absolute -right-3 -top-2.5 h-5 w-5 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="hidden md:block absolute top-12 left-[66%] w-[17%] h-px bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 z-0">
            <ArrowRight className="absolute -right-3 -top-2.5 h-5 w-5 text-slate-300 dark:text-slate-600" />
          </div>

          <Card className="border-slate-100 dark:border-slate-800 hover:shadow-lg transition-shadow relative z-10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Step 1</span>
              </div>
              <CardTitle className="text-lg">Connect Your Account</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Securely connect your Amazon Advertising account via OAuth in under 5 minutes. We never store your password.
              </CardDescription>
              <div className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2">
                Set up in &lt; 5 minutes
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 dark:border-slate-800 hover:shadow-lg transition-shadow relative z-10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <BarChart3 className="h-7 w-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Step 2</span>
              </div>
              <CardTitle className="text-lg">Analyze Placements</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-600 dark:text-slate-400 leading-relaxed">
                We collect 90 days of historical placement data and show you ROAS by placement type across every campaign.
              </CardDescription>
              <div className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2">
                90 days of historical data included
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 dark:border-slate-800 hover:shadow-lg transition-shadow relative z-10">
            <CardHeader>
              <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Step 3</span>
              </div>
              <CardTitle className="text-lg">Optimize &amp; Grow</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Use clear data to adjust placement bids — boost where ROAS is strong, cut where it&apos;s not. Updated every week automatically.
              </CardDescription>
              <div className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-md px-3 py-2">
                Weekly automated report delivery
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Placement Types */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-10">
          <h2 className="text-3xl font-bold text-center mb-3 text-slate-900 dark:text-white">
            Placement Types We Track
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-10">
            Every placement type — with real performance context to guide your bids
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border-l-4 border-blue-600 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">Top of Search</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                First row of search results. Highest visibility, highest intent — and often your best ROAS.
              </p>
              <div className="space-y-1.5">
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">Avg. ROAS: 4.2x</div>
                <div className="text-xs text-slate-500">Often benefits from +20–40% bid adjustment</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border-l-4 border-slate-400 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">Rest of Search</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Below the fold on search pages. Lower CPC and still high-intent — solid volume at efficient cost.
              </p>
              <div className="space-y-1.5">
                <div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">Avg. ROAS: 2.8x</div>
                <div className="text-xs text-slate-500">Lower CPC, consistent conversion volume</div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border-l-4 border-blue-400 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">Product Page</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                On competitor or related product detail pages. High conquest value — but watch ACOS closely.
              </p>
              <div className="space-y-1.5">
                <div className="text-sm font-semibold text-red-600 dark:text-red-400">Avg. ROAS: 1.9x</div>
                <div className="text-xs text-slate-500">High conquest value — monitor ACOS weekly</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <h2 className="text-3xl font-bold text-center mb-3 text-slate-900 dark:text-white">Simple Pricing</h2>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-12">
          Start free, upgrade when you&apos;re ready.
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Pro — highlighted as Most Popular */}
          <Card className="border-2 border-primary relative shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary hover:bg-primary shadow-sm px-4">Most Popular</Badge>
            </div>
            <CardHeader className="text-center pt-8">
              <CardTitle className="text-2xl text-primary">Pro</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-extrabold">$29</span>
                <span className="text-slate-600 dark:text-slate-400 ml-1">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "90 days historical data",
                  "Up to 3 Amazon Ads accounts",
                  "Weekly automated reports",
                  "Placement analytics dashboard",
                  "CSV export",
                  "Email support",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href="/signup" className="w-full">
                <Button className="w-full" size="lg">
                  Start Free Trial
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Enterprise — elevated secondary tier */}
          <Card className="border-2 border-slate-200 dark:border-slate-700 relative shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="outline" className="bg-white dark:bg-gray-900 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 shadow-sm px-4">Scale Up</Badge>
            </div>
            <CardHeader className="text-center pt-8">
              <CardTitle className="text-2xl">Enterprise</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-extrabold">$99</span>
                <span className="text-slate-600 dark:text-slate-400 ml-1">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "Unlimited historical data",
                  "Unlimited Amazon Ads accounts",
                  "Daily automated reports",
                  "Advanced Sankey visualizations",
                  "API access",
                  "Priority support",
                  "Custom integrations",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href="/signup" className="w-full">
                <Button className="w-full" variant="outline" size="lg">
                  Start Free Trial
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Trust Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-white dark:bg-gray-950">
        <div className="grid md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">AES-256 Encrypted</div>
            <h3 className="font-bold text-xl mb-3 text-slate-900 dark:text-white">Secure &amp; Private</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Your credentials are AES-256 encrypted at rest. We use OAuth and never store your Amazon password.
            </p>
          </div>
          <div>
            <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">Set up in &lt; 5 minutes</div>
            <h3 className="font-bold text-xl mb-3 text-slate-900 dark:text-white">Automated Reports</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Connect once and we handle the rest. Your placement data is collected and updated every week automatically.
            </p>
          </div>
          <div>
            <div className="h-16 w-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">Filter by week, portfolio, campaign</div>
            <h3 className="font-bold text-xl mb-3 text-slate-900 dark:text-white">Fast Insights</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Drill into any campaign, filter by portfolio or week, and find exactly where your ad spend is winning or wasting.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-primary rounded-2xl p-8 md:p-16 text-center text-primary-foreground shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-semibold mb-6">
              <TrendingUp className="h-4 w-4" />
              Amazon sellers using placement optimization see an average 2.3x improvement in ROAS within 60 days
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-6">
              Ready to Optimize Your Placements?
            </h2>
            <p className="text-primary-foreground/90 mb-10 max-w-2xl mx-auto text-lg leading-relaxed">
              Stop leaving money on the table. Start your free trial and see exactly where your ad spend is winning — and where it&apos;s not.
            </p>
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="px-10 py-6 text-lg font-bold shadow-lg hover:shadow-xl transition-all">
                Get Started Free
              </Button>
            </Link>
            <p className="text-primary-foreground/70 text-sm mt-4">30-day free trial. No credit card required.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-16 bg-slate-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 items-center">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center shadow-sm">
                  <BarChart3 className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl tracking-tight">BidFlow</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs">
                Empowering Amazon sellers with data-driven placement optimization.
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                &copy; {new Date().getFullYear()} BidFlow. All rights reserved.
              </p>
            </div>
            <div className="flex justify-end gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors">
                Terms
              </Link>
              <a href="mailto:support@bidflow.app" className="hover:text-primary transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
