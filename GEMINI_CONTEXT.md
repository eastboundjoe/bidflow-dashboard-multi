# BidFlow 2.0 Multi-Tenant Migration Context

## Purpose of This Document
This document provides comprehensive context for AI assistants (Gemini, Claude, or others) to continue work on migrating BidFlow from a single HTML file to a professional Next.js application. When one AI hits usage limits, another can pick up exactly where it left off.

---

## Project Overview

### What is BidFlow?
BidFlow is a SaaS application for Amazon sellers that helps optimize advertising placement bids. It:
- Connects to Amazon Advertising API to collect placement performance data
- Visualizes data with tables, charts, and Sankey diagrams
- Provides recommendations for bid adjustments by placement type (Top of Search, Rest of Search, Product Pages)
- Supports multi-tenant architecture (multiple users with isolated data)

### Migration Goal
Convert `bidflow/index(multi-tenant).html` (a single 3300-line, 162KB HTML file with inline React/CSS/JS) into a professional Next.js 14+ application matching the architecture of `visa-monitor-web` (the CRBA Monitor site at crba.app).

### Source Files
- **Original file:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow/index(multi-tenant).html`
- **Reference project:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/visa-monitor-web` (Next.js app to model after)
- **New project:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow-2.0-multi`

---

## Source File Analysis (index(multi-tenant).html)

### External Dependencies (CDN)
```html
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://unpkg.com/d3-sankey@0.12.3/dist/d3-sankey.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**npm equivalents for Next.js:**
- react, react-dom (built-in with Next.js)
- papaparse (for CSV parsing)
- chart.js + react-chartjs-2
- d3 + d3-sankey
- @supabase/supabase-js
- @supabase/ssr (for server-side Supabase)

### CSS Theme Variables
```css
:root {
    --bg-dark: #0a0e15;
    --bg-card: #111827;
    --bg-hover: #1a2332;
    --accent-primary: #00ff94;
    --accent-secondary: #0095ff;
    --accent-warning: #ff9500;
    --accent-danger: #ff3366;
    --text-primary: #e5e7eb;
    --text-secondary: #9ca3af;
    --border: #1f2937;
    --shadow: rgba(0, 255, 148, 0.1);
}
```
These should be converted to Tailwind CSS custom colors in `tailwind.config.ts`.

### Fonts
- JetBrains Mono (monospace, for data/code)
- DM Sans (sans-serif, for UI text)

### Configuration Constants
```javascript
const CONFIG = {
    N8N_COLLECTION_WEBHOOK: 'https://n8n.bidflow.app/webhook/d4a5a8ed-0382-44e8-b011-b14e48a89b87',
    N8N_SUBMISSION_WEBHOOK: 'https://n8n.bidflow.app/webhook/32328f48-51f5-4123-b693-af5455d3b29c',
    AUTO_REFRESH_INTERVAL: 300000 // 5 minutes
};
```
These should become environment variables.

### Stripe Price IDs
- Pro Plan: `price_1SilYGCmYUDdt3YtJZUK1EB6` ($29/month)
- Enterprise Plan: `price_1SilZOCmYUDdt3YteqUqq7zU` ($99/month)

---

## React Components to Extract

### 1. AuthComponent (Main wrapper)
**Location in source:** Lines ~1100-1955
**Purpose:** Handles authentication state, session management, credential setup
**States managed:**
- `session` - Supabase auth session
- `loading` - Loading state
- `credentials` - Amazon Ads API credentials
- `subscriptionStatus` - Stripe subscription info
- `showPricingModal`, `showSettingsModal`, `showTrialExpiredModal`
- `showCredentialForm`, `showUnsubscribePage`
- `authorizingAmazon` - OAuth flow state
- `email`, `password`, `isSignUp` - Auth form state
- `formData` - Credential form data
- `scheduleSettings` - Report scheduling

**Key functions:**
- `handleEmailAuth()` - Email/password auth
- `signInWithGoogle()` - Google OAuth
- `signOut()` - Sign out
- `handleStoreCredentials()` - Save Amazon credentials
- `authorizeAmazon()` - Start Amazon OAuth flow
- `handleUpgrade()` - Stripe checkout
- `handleUnsubscribe()` - Delete account
- `triggerDataCollection()` - Call n8n webhook

### 2. PricingModal
**Location:** Lines ~1430-1532
**Purpose:** Display subscription tiers
**Tiers:**
- Pro ($29/mo): 90 days data, 3 accounts, weekly reports
- Enterprise ($99/mo): Unlimited data, unlimited accounts, daily reports

### 3. TrialExpiredModal
**Location:** Lines ~1534-1554
**Purpose:** Show when trial ends, prompt to subscribe

### 4. SettingsModal
**Location:** Lines ~1556-1695
**Purpose:** Configure report schedule (day of week, hour UTC)
**Features:**
- Day selector (Monday-Sunday)
- Hour selector (0-23 UTC)
- Save to Supabase credentials table

### 5. AmazonAuthLoadingOverlay
**Purpose:** Full-screen loading overlay during Amazon OAuth

### 6. PlacementBadge
**Location:** Lines ~1964-1997
**Purpose:** Color-coded badges for placement types
- TOP (green) - Top of Search
- PP (orange) - Product Pages
- ROS (blue) - Rest of Search

### 7. SankeyChart (SankeyFlow)
**Location:** Lines ~1999+
**Purpose:** D3-based Sankey diagram showing ad spend flow
**Data flow:** Ad Spend → Placements → Clicks → Conversions

### 8. Main Dashboard
**Features:**
- Stats grid (total spend, clicks, conversions, ACOS)
- Data table with sorting, filtering, search
- Week selector for historical data
- Portfolio/campaign grouping
- CSV export

---

## Target Next.js Architecture

```
bidflow-2.0-multi/
├── .env.local                    # Environment variables
├── .env.example                  # Template for env vars
├── next.config.ts
├── tailwind.config.ts
├── components.json               # shadcn/ui config
├── package.json
├── tsconfig.json
├── GEMINI_CONTEXT.md            # This file
├── MIGRATION_PROGRESS.md        # Track what's done
│
├── public/
│   └── favicon.ico
│
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with fonts, providers
│   │   ├── page.tsx             # Landing page (marketing)
│   │   ├── globals.css          # Global styles + Tailwind
│   │   │
│   │   ├── (auth)/              # Auth route group
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   │
│   │   ├── (marketing)/         # Public pages route group
│   │   │   ├── pricing/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   └── terms/page.tsx
│   │   │
│   │   ├── dashboard/           # Protected dashboard
│   │   │   ├── layout.tsx       # Dashboard layout with nav
│   │   │   ├── page.tsx         # Main dashboard view
│   │   │   ├── settings/page.tsx
│   │   │   ├── billing/page.tsx
│   │   │   └── connect/page.tsx # Amazon account connection
│   │   │
│   │   ├── auth/
│   │   │   └── callback/route.ts # OAuth callback handler
│   │   │
│   │   └── api/
│   │       ├── stripe/
│   │       │   ├── checkout/route.ts
│   │       │   ├── portal/route.ts
│   │       │   └── webhook/route.ts
│   │       ├── amazon/
│   │       │   ├── authorize/route.ts
│   │       │   └── callback/route.ts
│   │       ├── collect/route.ts  # Trigger n8n data collection
│   │       └── user/
│   │           └── delete/route.ts
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   └── ... (other shadcn components)
│   │   │
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   ├── signup-form.tsx
│   │   │   └── google-button.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard-nav.tsx
│   │   │   ├── stats-grid.tsx
│   │   │   ├── data-table.tsx
│   │   │   ├── week-selector.tsx
│   │   │   ├── portfolio-filter.tsx
│   │   │   └── export-button.tsx
│   │   │
│   │   ├── charts/
│   │   │   ├── sankey-chart.tsx
│   │   │   └── performance-chart.tsx
│   │   │
│   │   ├── modals/
│   │   │   ├── pricing-modal.tsx
│   │   │   ├── settings-modal.tsx
│   │   │   └── trial-expired-modal.tsx
│   │   │
│   │   ├── placement-badge.tsx
│   │   ├── subscription-check.tsx
│   │   └── amazon-auth-overlay.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser client
│   │   │   ├── server.ts        # Server client
│   │   │   └── middleware.ts    # Auth middleware
│   │   ├── stripe.ts            # Stripe utilities
│   │   ├── utils.ts             # cn() and helpers
│   │   └── constants.ts         # App constants
│   │
│   ├── hooks/
│   │   ├── use-session.ts
│   │   ├── use-subscription.ts
│   │   └── use-placement-data.ts
│   │
│   ├── types/
│   │   ├── database.ts          # Supabase generated types
│   │   ├── placement.ts         # Placement data types
│   │   └── subscription.ts      # Subscription types
│   │
│   └── middleware.ts            # Next.js middleware for auth
│
└── supabase/
    └── migrations/              # Database migrations if needed
```

---

## Environment Variables (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_1SilYGCmYUDdt3YtJZUK1EB6
STRIPE_ENTERPRISE_PRICE_ID=price_1SilZOCmYUDdt3YteqUqq7zU

# n8n Webhooks
N8N_COLLECTION_WEBHOOK=https://n8n.bidflow.app/webhook/d4a5a8ed-0382-44e8-b011-b14e48a89b87
N8N_SUBMISSION_WEBHOOK=https://n8n.bidflow.app/webhook/32328f48-51f5-4123-b693-af5455d3b29c

# Amazon OAuth (if handling directly)
AMAZON_CLIENT_ID=your-client-id
AMAZON_CLIENT_SECRET=your-client-secret

# App
NEXT_PUBLIC_APP_URL=https://app.bidflow.app
```

---

## Database Schema (Supabase)

### Tables Used
Based on the source code, these tables are referenced:

**credentials** (amazon_ads_accounts equivalent)
- tenant_id
- client_id, client_secret, refresh_token (encrypted)
- profile_id
- status ('active' | 'inactive')
- report_day, report_hour
- subscription_tier, subscription_status, trial_ends_at, stripe_customer_id

**placement_data** (or similar)
- Campaign/placement performance metrics
- Weekly snapshots

### Key Queries
```javascript
// Get credentials
supabase.from('credentials').select('*').eq('tenant_id', tenantId).single()

// Update schedule settings
supabase.from('credentials').update({
    report_day: 'monday',
    report_hour: 3,
    updated_at: new Date().toISOString()
}).eq('tenant_id', tenantId)

// Get placement data
supabase.from('view_placement_optimization_report')
    .select('*')
    .eq('tenant_id', tenantId)
```

---

## Migration Checklist

### Phase 1: Project Setup
- [ ] Initialize Next.js 14 with TypeScript
- [ ] Configure Tailwind CSS with custom theme colors
- [ ] Set up shadcn/ui
- [ ] Configure fonts (JetBrains Mono, DM Sans)
- [ ] Set up Supabase client (browser + server)
- [ ] Create .env.example

### Phase 2: Authentication
- [ ] Create auth pages (login, signup, forgot-password, reset-password)
- [ ] Set up Supabase auth with email/password
- [ ] Add Google OAuth
- [ ] Create auth callback route
- [ ] Add middleware for protected routes
- [ ] Create session hook

### Phase 3: Core Components
- [ ] Port UI components to shadcn/ui
- [ ] Create PlacementBadge component
- [ ] Create StatsGrid component
- [ ] Create DataTable with sorting/filtering
- [ ] Create WeekSelector component
- [ ] Create PortfolioFilter component

### Phase 4: Dashboard
- [ ] Create dashboard layout with navigation
- [ ] Create main dashboard page
- [ ] Implement data fetching from Supabase
- [ ] Add real-time updates (optional)
- [ ] Create settings page
- [ ] Create billing page

### Phase 5: Charts & Visualization
- [ ] Set up Chart.js with react-chartjs-2
- [ ] Create SankeyChart component with D3
- [ ] Create PerformanceChart component

### Phase 6: Stripe Integration
- [ ] Create checkout API route
- [ ] Create portal API route
- [ ] Create webhook handler
- [ ] Create PricingModal component
- [ ] Create TrialExpiredModal
- [ ] Add subscription check wrapper

### Phase 7: Amazon Integration
- [ ] Create Amazon OAuth flow
- [ ] Create credentials form
- [ ] Create AmazonAuthOverlay
- [ ] Integrate with n8n webhooks

### Phase 8: Polish
- [ ] Create landing page
- [ ] Add marketing pages (pricing, about)
- [ ] Add legal pages (privacy, terms)
- [ ] Add loading states and skeletons
- [ ] Add error handling
- [ ] Test all flows end-to-end

---

## Reference: visa-monitor-web Structure

The CRBA Monitor site uses this pattern that we should follow:

```
visa-monitor-web/src/
├── app/
│   ├── (auth)/           # Grouped auth routes
│   ├── dashboard/        # Protected with layout
│   ├── api/stripe/       # Stripe endpoints
│   └── auth/callback/    # OAuth callback
├── components/
│   ├── ui/               # shadcn components
│   └── [feature].tsx     # Feature components
├── lib/
│   ├── supabase/         # Supabase clients
│   └── utils.ts          # Utilities
```

Key patterns from visa-monitor-web:
1. Uses `@supabase/ssr` for server-side auth
2. Middleware protects dashboard routes
3. Stripe webhook validates signatures
4. shadcn/ui for consistent component library
5. Tailwind for styling

---

## Current Progress

### Completed
- [x] Created project directory: bidflow-2.0-multi
- [x] Created this context document (GEMINI_CONTEXT.md)

### In Progress
- [ ] Next.js project initialization

### Next Steps
1. Initialize Next.js project with `npx create-next-app@latest`
2. Configure Tailwind with BidFlow theme colors
3. Install and configure shadcn/ui
4. Set up Supabase client files
5. Create base layout with fonts

---

## Important Notes for AI Assistants

1. **Always read this file first** when continuing work on this project
2. **Update MIGRATION_PROGRESS.md** after completing any task
3. **Don't modify the original** `bidflow/index(multi-tenant).html` - only read from it
4. **Follow visa-monitor-web patterns** for consistency
5. **Use shadcn/ui components** instead of custom UI where possible
6. **Keep the dark theme** - BidFlow has a distinctive dark UI with green/blue accents
7. **Preserve all functionality** - every feature in the original must work in Next.js version

---

## Quick Commands

```bash
# Navigate to project
cd "/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow-2.0-multi"

# Initialize Next.js (if not done)
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Install dependencies
npm install @supabase/supabase-js @supabase/ssr stripe chart.js react-chartjs-2 d3 d3-sankey papaparse

# Install shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card dialog input label select table badge

# Run dev server
npm run dev
```

---

## Contact / Repository

- **GitHub:** https://github.com/eastboundjoe/bidflow-dashboard-multi (original)
- **New repo:** Will be created for bidflow-2.0-multi
- **Live reference:** https://crba.app (visa-monitor-web)

---

*Last updated: 2025-01-27*
*Migration started by: Claude*
*Continue with: Gemini or Claude*
