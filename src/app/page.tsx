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
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-950/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">BidFlow</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="#features"
                className="hidden sm:block text-gray-600 hover:text-primary font-medium"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="hidden sm:block text-gray-600 hover:text-primary font-medium"
              >
                Pricing
              </Link>
              <Link href="/login">
                <Button variant="ghost">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <Badge variant="secondary" className="mb-4">
          Trusted by Amazon Sellers Worldwide
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Optimize Your Amazon
          <br />
          <span className="text-primary">Ad Placements</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          Data-driven insights to maximize your Amazon PPC performance. Analyze
          placement data, optimize bid adjustments, and{" "}
          <strong>increase your ROAS</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="w-full sm:w-auto">
              Start Free Trial
            </Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              See How It Works
            </Button>
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          30-day free trial. No credit card required.
        </p>
      </section>

      {/* Problem/Solution Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">The Problem</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Managing Amazon Ads placement bids is time-consuming and
                confusing. Most sellers are leaving money on the table.
              </p>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> No visibility into
                  placement performance
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> Guessing at bid
                  adjustments
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-red-500">✗</span> Wasting ad spend on
                  poor placements
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-4 text-primary">
                Our Solution
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                BidFlow automatically collects and analyzes your placement data,
                giving you clear insights to optimize your bids.
              </p>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <CheckCircle className="text-primary h-5 w-5" /> Clear
                  placement performance data
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="text-primary h-5 w-5" /> Data-backed
                  bid recommendations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="text-primary h-5 w-5" /> Weekly
                  automated reports
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16"
      >
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Target className="h-10 w-10 text-primary mb-2" />
              <CardTitle>1. Connect Your Account</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Securely connect your Amazon Advertising account. We use OAuth
                and never store your password.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <BarChart3 className="h-10 w-10 text-primary mb-2" />
              <CardTitle>2. Analyze Placements</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                We collect placement reports and show you exactly how Top of
                Search, Rest of Search, and Product Pages perform.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-primary mb-2" />
              <CardTitle>3. Optimize & Grow</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Use our insights to adjust your bids, reduce wasted spend, and
                maximize your return on ad spend.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Placement Types Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-gray-50 dark:bg-gray-900 rounded-2xl">
        <h2 className="text-3xl font-bold text-center mb-4">
          Placement Types We Track
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Get granular insights into each placement type
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-sm border-l-4 border-green-500">
            <h3 className="font-semibold text-lg mb-2">Top of Search</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              First row of search results. Highest visibility, often highest
              CPC.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-sm border-l-4 border-blue-500">
            <h3 className="font-semibold text-lg mb-2">Rest of Search</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Below the fold on search pages. Lower CPC, still high intent.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center shadow-sm border-l-4 border-orange-500">
            <h3 className="font-semibold text-lg mb-2">Product Page</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              On competitor or related product detail pages. Great for conquest.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <h2 className="text-3xl font-bold text-center mb-4">Simple Pricing</h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
          Start free, upgrade when you&apos;re ready.
        </p>
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Pro</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold">$29</span>
                <span className="text-gray-600 dark:text-gray-400">/month</span>
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
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>{feature}</span>
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

          <Card className="border-2 border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary">Most Popular</Badge>
            </div>
            <CardHeader className="text-center pt-8">
              <CardTitle className="text-2xl">Enterprise</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold">$99</span>
                <span className="text-gray-600 dark:text-gray-400">/month</span>
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
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span>{feature}</span>
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
        </div>
      </section>

      {/* Trust Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Secure & Private</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your data is encrypted and never shared. We use OAuth and never
              store your Amazon password.
            </p>
          </div>
          <div>
            <Clock className="h-10 w-10 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Automated Reports</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Set it and forget it. We collect your placement data weekly and
              keep your dashboard updated.
            </p>
          </div>
          <div>
            <Zap className="h-10 w-10 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Fast Insights</h3>
            <p className="text-gray-600 dark:text-gray-400">
              See your placement performance at a glance. Filter by week,
              portfolio, or campaign.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-primary rounded-2xl p-8 md:p-12 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Optimize Your Placements?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Join Amazon sellers who are using data to make smarter bid
            decisions. Start your free trial today.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">BidFlow</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} BidFlow. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
              <Link href="/privacy" className="hover:text-primary">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-primary">
                Terms
              </Link>
              <a href="mailto:support@bidflow.app" className="hover:text-primary">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
