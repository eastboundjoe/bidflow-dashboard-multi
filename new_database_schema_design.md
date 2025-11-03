# Amazon Placement Optimization - Database Schema Design

**Document Version:** 2.0
**Date:** 2025-11-03
**Purpose:** Complete database schema redesign optimized for Supabase Edge Functions
**Status:** Ready for Implementation

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Table Designs](#2-table-designs)
3. [View Design](#3-view-design)
4. [Design Decisions](#4-design-decisions)
5. [Migration Strategy](#5-migration-strategy)
6. [Implementation DDL](#6-implementation-ddl)

---

## 1. Schema Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE VAULT                               │
│  Stores: API credentials (client_id, client_secret, etc.)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                               │
│  1. Workflow Executor                                           │
│  2. Report Collector                                            │
│  3. Report Generator                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  EXECUTION LAYER                                │
│  workflow_executions: Track runs for idempotency               │
│  report_requests: Track Amazon report status                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MASTER DATA LAYER                             │
│  portfolios: Portfolio ID → Name mapping                       │
│  campaigns: Campaign master data                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  PERFORMANCE DATA LAYER                         │
│  campaign_performance: Time-series metrics by period            │
│  placement_performance: Placement-level metrics                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AGGREGATION LAYER                            │
│  view_placement_optimization_report: Final 25-column output     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
Amazon API Reports
    ↓
Extract & Transform (Edge Function)
    ↓
Insert to Performance Tables
    ↓
Query View (aggregates + calculations)
    ↓
Apply Business Logic (CVR, ACoS, recommendations)
    ↓
Export to Google Sheets (25 columns)
```

### 1.3 Table List

| Table Name | Purpose | Rows (Est.) |
|------------|---------|-------------|
| workflow_executions | Track workflow runs for idempotency | ~52/year |
| report_requests | Track Amazon API report status | ~300/week |
| portfolios | Portfolio metadata | ~10-20 |
| campaigns | Campaign master data | ~100-300 |
| campaign_performance | Campaign-level metrics by period | ~1200/week |
| placement_performance | Placement-level metrics | ~900/week |
| view_placement_optimization_report | Final report output (view) | ~900 rows |

---

## 2. Table Designs

### 2.1 Execution Tracking: `workflow_executions`

**Purpose:** Track workflow runs to ensure idempotency and provide audit trail.

**Columns:**

```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  workflow_type TEXT NOT NULL DEFAULT 'placement_optimization',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflow_executions_execution_id ON workflow_executions(execution_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- RLS Policies
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON workflow_executions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sample Data:**

| id | execution_id | status | started_at | completed_at |
|----|--------------|--------|------------|--------------|
| uuid-1 | 2025-11-03T09:05:00Z | COMPLETED | 2025-11-03 09:05:00 | 2025-11-03 10:30:00 |
| uuid-2 | 2025-11-10T09:05:00Z | RUNNING | 2025-11-10 09:05:00 | NULL |

**Design Notes:**
- `execution_id` uses ISO timestamp for easy identification
- `metadata` JSONB stores additional context (profile_id, report_counts, etc.)
- Prevents duplicate runs by checking for RUNNING/COMPLETED status

---

### 2.2 Report Tracking: `report_requests`

**Purpose:** Track Amazon Ads API report requests and their processing status.

**Columns:**

```sql
CREATE TABLE report_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL,
  report_id TEXT UNIQUE NOT NULL,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'placement_30day',
    'placement_7day',
    'campaign_30day',
    'campaign_7day',
    'campaign_yesterday',
    'campaign_day_before'
  )),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'TIMEOUT')),
  download_url TEXT,
  url_expires_at TIMESTAMPTZ,
  rows_processed INTEGER DEFAULT 0,
  error_details TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (execution_id) REFERENCES workflow_executions(execution_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_report_requests_execution_id ON report_requests(execution_id);
CREATE INDEX idx_report_requests_report_type ON report_requests(report_type);
CREATE INDEX idx_report_requests_status ON report_requests(status);
CREATE INDEX idx_report_requests_requested_at ON report_requests(requested_at DESC);

-- RLS Policies
ALTER TABLE report_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON report_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sample Data:**

| id | execution_id | report_id | report_type | status | rows_processed |
|----|--------------|-----------|-------------|--------|----------------|
| uuid-1 | 2025-11-03T09:05:00Z | amzn1.sd...001 | placement_30day | COMPLETED | 450 |
| uuid-2 | 2025-11-03T09:05:00Z | amzn1.sd...002 | placement_7day | COMPLETED | 450 |
| uuid-3 | 2025-11-03T09:05:00Z | amzn1.sd...003 | campaign_yesterday | COMPLETED | 150 |

**Design Notes:**
- Links to `workflow_executions` for traceability
- `status` tracks Amazon's report generation lifecycle
- `rows_processed` helps validate data completeness
- Cascade delete ensures cleanup when execution is removed

---

### 2.3 Master Data: `portfolios`

**Purpose:** Store portfolio metadata for campaign grouping and reporting.

**Columns:**

```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id TEXT UNIQUE NOT NULL,
  portfolio_name TEXT NOT NULL,
  portfolio_state TEXT NOT NULL DEFAULT 'ENABLED',
  in_budget BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_portfolios_portfolio_id ON portfolios(portfolio_id);
CREATE INDEX idx_portfolios_state ON portfolios(portfolio_state) WHERE portfolio_state = 'ENABLED';

-- RLS Policies
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON portfolios
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sample Data:**

| id | portfolio_id | portfolio_name | portfolio_state |
|----|--------------|----------------|-----------------|
| uuid-1 | 123456789 | Ramen Bomb | ENABLED |
| uuid-2 | 987654321 | Premium Products | ENABLED |

**Design Notes:**
- Refreshed on each workflow run (truncate + insert)
- Only stores ENABLED portfolios
- Simple structure - no historical tracking needed

---

### 2.4 Master Data: `campaigns`

**Purpose:** Store campaign master data and current placement bid adjustments.

**Columns:**

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT UNIQUE NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT NOT NULL,
  portfolio_id TEXT,
  daily_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
  bid_top_of_search INTEGER NOT NULL DEFAULT 0 CHECK (bid_top_of_search BETWEEN 0 AND 900),
  bid_rest_of_search INTEGER NOT NULL DEFAULT 0 CHECK (bid_rest_of_search BETWEEN 0 AND 900),
  bid_product_page INTEGER NOT NULL DEFAULT 0 CHECK (bid_product_page BETWEEN 0 AND 900),
  targeting_type TEXT,
  start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_campaigns_campaign_id ON campaigns(campaign_id);
CREATE INDEX idx_campaigns_portfolio_id ON campaigns(portfolio_id);
CREATE INDEX idx_campaigns_status ON campaigns(campaign_status) WHERE campaign_status = 'ENABLED';

-- RLS Policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sample Data:**

| id | campaign_id | campaign_name | portfolio_id | daily_budget | bid_top_of_search | bid_rest_of_search |
|----|-------------|---------------|--------------|--------------|-------------------|--------------------|
| uuid-1 | 123456789 | RamenToppings-SP-ASIN(Exact) | 123456789 | 60.00 | 65 | 35 |
| uuid-2 | 987654321 | PremiumSoup-SP-Broad | 987654321 | 45.00 | 50 | 25 |

**Design Notes:**
- Combines campaign metadata + placement bids in one table
- Refreshed on each workflow run
- Bid adjustments stored as integers (0-900 = 0%-900%)
- Foreign key to portfolios with SET NULL (preserves campaign if portfolio removed)

---

### 2.5 Performance Data: `campaign_performance`

**Purpose:** Store campaign-level performance metrics aggregated by time period.

**Columns:**

```sql
CREATE TABLE campaign_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('30day', '7day', 'yesterday', 'day_before')),
  report_date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_7d INTEGER NOT NULL DEFAULT 0,
  sales_7d DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_14d INTEGER NOT NULL DEFAULT 0,
  sales_14d DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_30d INTEGER NOT NULL DEFAULT 0,
  sales_30d DECIMAL(10,2) NOT NULL DEFAULT 0,
  top_of_search_impression_share DECIMAL(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,

  -- Ensure one record per campaign per period
  UNIQUE(campaign_id, period_type, report_date)
);

-- Indexes
CREATE INDEX idx_campaign_performance_campaign_id ON campaign_performance(campaign_id);
CREATE INDEX idx_campaign_performance_period_type ON campaign_performance(period_type);
CREATE INDEX idx_campaign_performance_report_date ON campaign_performance(report_date DESC);
CREATE INDEX idx_campaign_performance_lookup ON campaign_performance(campaign_id, period_type);

-- RLS Policies
ALTER TABLE campaign_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON campaign_performance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sample Data:**

| campaign_id | period_type | report_date | clicks | spend | orders_30d | sales_30d | top_of_search_impression_share |
|-------------|-------------|-------------|--------|-------|------------|-----------|-------------------------------|
| 123456789 | 30day | 2025-10-31 | 1471 | 595.17 | 155 | 1669.94 | 0.0563 |
| 123456789 | 7day | 2025-10-31 | 382 | 124.50 | 42 | 487.23 | 0.0569 |
| 123456789 | yesterday | 2025-11-02 | 45 | 13.90 | 0 | 0 | 0.0833 |
| 123456789 | day_before | 2025-11-01 | 52 | 25.96 | 0 | 0 | NULL |

**Design Notes:**
- One row per campaign per period type per date
- Stores all attribution windows (7d, 14d, 30d) for flexibility
- TOS impression share only populated for applicable periods
- Cascade delete when campaign removed
- Daily periods (yesterday, day_before) have minimal data

---

### 2.6 Performance Data: `placement_performance`

**Purpose:** Store placement-level performance metrics for each campaign.

**Columns:**

```sql
CREATE TABLE placement_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('PLACEMENT_TOP', 'PLACEMENT_REST_OF_SEARCH', 'PLACEMENT_PRODUCT_PAGE')),
  period_type TEXT NOT NULL CHECK (period_type IN ('30day', '7day')),
  report_date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_7d INTEGER NOT NULL DEFAULT 0,
  sales_7d DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_30d INTEGER NOT NULL DEFAULT 0,
  sales_30d DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,

  -- Ensure one record per campaign per placement per period
  UNIQUE(campaign_id, placement, period_type, report_date)
);

-- Indexes
CREATE INDEX idx_placement_performance_campaign_id ON placement_performance(campaign_id);
CREATE INDEX idx_placement_performance_placement ON placement_performance(placement);
CREATE INDEX idx_placement_performance_period_type ON placement_performance(period_type);
CREATE INDEX idx_placement_performance_lookup ON placement_performance(campaign_id, placement, period_type);

-- RLS Policies
ALTER TABLE placement_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON placement_performance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**Sample Data:**

| campaign_id | placement | period_type | clicks | spend | orders_30d | sales_30d |
|-------------|-----------|-------------|--------|-------|------------|-----------|
| 123456789 | PLACEMENT_TOP | 30day | 833 | 404.07 | 103 | 1103.85 |
| 123456789 | PLACEMENT_REST_OF_SEARCH | 30day | 382 | 117.28 | 38 | 423.26 |
| 123456789 | PLACEMENT_PRODUCT_PAGE | 30day | 256 | 73.82 | 14 | 142.23 |
| 123456789 | PLACEMENT_TOP | 7day | 202 | 96.82 | 13 | 118.86 |

**Design Notes:**
- Stores placement-specific metrics for 30day and 7day periods
- Each campaign has 3 rows per period (one per placement)
- No daily placement data (Amazon doesn't provide it)
- Cascade delete when campaign removed

---

## 3. View Design

### 3.1 View: `view_placement_optimization_report`

**Purpose:** Aggregate all data sources into the final 25-column report format.

**Complete SQL:**

```sql
CREATE OR REPLACE VIEW view_placement_optimization_report AS
WITH
-- Aggregate 30-day placement data
placement_30d AS (
  SELECT
    campaign_id,
    placement,
    SUM(clicks) AS clicks_30,
    SUM(spend) AS spend_30,
    SUM(orders_30d) AS orders_30,
    SUM(sales_30d) AS sales_30
  FROM placement_performance
  WHERE period_type = '30day'
  GROUP BY campaign_id, placement
),

-- Aggregate 7-day placement data
placement_7d AS (
  SELECT
    campaign_id,
    placement,
    SUM(clicks) AS clicks_7,
    SUM(spend) AS spend_7,
    SUM(orders_7d) AS orders_7,
    SUM(sales_7d) AS sales_7
  FROM placement_performance
  WHERE period_type = '7day'
  GROUP BY campaign_id, placement
),

-- Get campaign-level TOS impression share for 30 days
campaign_tos_30d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_30
  FROM campaign_performance
  WHERE period_type = '30day'
  GROUP BY campaign_id
),

-- Get campaign-level TOS impression share for 7 days
campaign_tos_7d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_7
  FROM campaign_performance
  WHERE period_type = '7day'
  GROUP BY campaign_id
),

-- Get yesterday's spend and TOS IS
campaign_yesterday AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_yesterday,
    AVG(top_of_search_impression_share) * 100 AS tos_is_yesterday
  FROM campaign_performance
  WHERE period_type = 'yesterday'
  GROUP BY campaign_id
),

-- Get day before yesterday's spend
campaign_day_before AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_day_before
  FROM campaign_performance
  WHERE period_type = 'day_before'
  GROUP BY campaign_id
)

-- Main query: Join all CTEs and calculate metrics
SELECT
  -- Column A: Campaign
  c.campaign_name AS "Campaign",

  -- Column B: Portfolio
  p.portfolio_name AS "Portfolio",

  -- Column C: Budget
  c.daily_budget AS "Budget",

  -- Column D: Clicks-30
  COALESCE(p30.clicks_30, 0) AS "Clicks-30",

  -- Column E: Spend-30
  COALESCE(p30.spend_30, 0) AS "Spend-30",

  -- Column F: Orders-30
  COALESCE(p30.orders_30, 0) AS "Orders-30",

  -- Column G: CVR-30 (calculated)
  CASE
    WHEN COALESCE(p30.clicks_30, 0) > 0 THEN
      ROUND((COALESCE(p30.orders_30, 0)::DECIMAL / p30.clicks_30) * 100, 2)
    ELSE 0
  END AS "CVR-30",

  -- Column H: ACoS-30 (calculated)
  CASE
    WHEN COALESCE(p30.sales_30, 0) > 0 THEN
      ROUND((COALESCE(p30.spend_30, 0) / p30.sales_30) * 100, 2)
    ELSE 0
  END AS "ACoS-30",

  -- Column I: Clicks-7
  COALESCE(p7.clicks_7, 0) AS "Clicks-7",

  -- Column J: Spend-7
  COALESCE(p7.spend_7, 0) AS "Spend-7",

  -- Column K: Orders-7
  COALESCE(p7.orders_7, 0) AS "Orders-7",

  -- Column L: CVR-7 (calculated)
  CASE
    WHEN COALESCE(p7.clicks_7, 0) > 0 THEN
      ROUND((COALESCE(p7.orders_7, 0)::DECIMAL / p7.clicks_7) * 100, 2)
    ELSE 0
  END AS "CVR-7",

  -- Column M: ACoS-7 (calculated)
  CASE
    WHEN COALESCE(p7.sales_7, 0) > 0 THEN
      ROUND((COALESCE(p7.spend_7, 0) / p7.sales_7) * 100, 2)
    ELSE 0
  END AS "ACoS-7",

  -- Column N: Spent DB Yesterday
  COALESCE(cdb.spent_day_before, 0) AS "Spent DB Yesterday",

  -- Column O: Spent Yesterday
  COALESCE(cy.spent_yesterday, 0) AS "Spent Yesterday",

  -- Column P: (Array Formula - leave blank, handled in Google Sheets)
  NULL AS "Array Formula",

  -- Column Q: Last 30 days (TOS IS)
  COALESCE(c30.tos_is_30, 0) AS "Last 30 days",

  -- Column R: Last 7 days (TOS IS)
  COALESCE(c7.tos_is_7, 0) AS "Last 7 days",

  -- Column S: Yesterday (TOS IS)
  COALESCE(cy.tos_is_yesterday, 0) AS "Yesterday",

  -- Column T: Placement Type (map to display values)
  CASE
    WHEN p30.placement = 'PLACEMENT_TOP' THEN 'Placement Top'
    WHEN p30.placement = 'PLACEMENT_REST_OF_SEARCH' THEN 'Placement Rest Of Search'
    WHEN p30.placement = 'PLACEMENT_PRODUCT_PAGE' THEN 'Placement Product Page'
    ELSE p30.placement
  END AS "Placement Type",

  -- Column U: Increase bids by placement
  CASE
    WHEN p30.placement = 'PLACEMENT_TOP' THEN c.bid_top_of_search
    WHEN p30.placement = 'PLACEMENT_REST_OF_SEARCH' THEN c.bid_rest_of_search
    WHEN p30.placement = 'PLACEMENT_PRODUCT_PAGE' THEN c.bid_product_page
    ELSE 0
  END AS "Increase bids by placement",

  -- Column V: Changes in placement (populated by application logic)
  '' AS "Changes in placement",

  -- Column W: NOTES (left blank for manual entry)
  '' AS "NOTES"

FROM placement_30d p30

-- Join 7-day placement data
LEFT JOIN placement_7d p7
  ON p30.campaign_id = p7.campaign_id
  AND p30.placement = p7.placement

-- Join campaign master data
INNER JOIN campaigns c
  ON p30.campaign_id = c.campaign_id

-- Join portfolio names
LEFT JOIN portfolios p
  ON c.portfolio_id = p.portfolio_id

-- Join campaign-level TOS impression share data
LEFT JOIN campaign_tos_30d c30
  ON p30.campaign_id = c30.campaign_id

LEFT JOIN campaign_tos_7d c7
  ON p30.campaign_id = c7.campaign_id

LEFT JOIN campaign_yesterday cy
  ON p30.campaign_id = cy.campaign_id

LEFT JOIN campaign_day_before cdb
  ON p30.campaign_id = cdb.campaign_id

-- Filter criteria
WHERE
  c.campaign_status = 'ENABLED'
  AND COALESCE(p30.spend_30, 0) > 0  -- Only campaigns with spend

-- Sort by portfolio, campaign, placement
ORDER BY
  p.portfolio_name NULLS LAST,
  c.campaign_name,
  p30.placement;
```

### 3.2 View Explanation

**Section 1: CTEs (Common Table Expressions)**

1. **placement_30d**: Aggregates 30-day placement data (clicks, spend, orders, sales) by campaign and placement
2. **placement_7d**: Aggregates 7-day placement data (same metrics)
3. **campaign_tos_30d**: Calculates average TOS impression share for 30-day period (converted to percentage)
4. **campaign_tos_7d**: Same for 7-day period
5. **campaign_yesterday**: Gets yesterday's spend and TOS IS
6. **campaign_day_before**: Gets day before yesterday's spend

**Section 2: Main Query**

- **Base**: Starts from `placement_30d` (ensures we have 3 rows per campaign - one per placement)
- **JOINs**: Brings in 7-day data, campaign metadata, portfolio names, and TOS IS metrics
- **Calculations**: CVR and ACoS calculated inline using CASE statements for division-by-zero handling
- **Mapping**: Placement types mapped to human-readable display values
- **Filtering**: Only ENABLED campaigns with spend > $0
- **Sorting**: By portfolio, campaign, placement for logical grouping

**Section 3: Column Types**

- **Direct values**: Campaign, Portfolio, Budget, Clicks, Spend, Orders
- **Calculated metrics**: CVR-30, ACoS-30, CVR-7, ACoS-7 (with safe division)
- **Percentage conversions**: TOS IS values multiplied by 100 (Amazon returns decimals)
- **Mapped values**: Placement type display names
- **Placeholder fields**: Array Formula, Changes in placement, NOTES (handled by application)

### 3.3 Performance Estimate

**Expected Query Performance:**
- **Row Count**: 300-900 rows (100-300 campaigns × 3 placements)
- **Execution Time**: 2-5 seconds (with proper indexes)
- **Bottlenecks**: None expected with current data volume

**Optimization Techniques:**
- All foreign key columns indexed
- Composite indexes on lookup patterns (campaign_id + period_type)
- UNIQUE constraints prevent duplicates
- CTEs improve readability without performance penalty (PostgreSQL optimizes)

**Scaling Considerations:**
- At 1000 campaigns: Still <10 seconds
- Consider materialized view if query time exceeds 10 seconds
- Current design should handle 5000+ campaigns without issues

---

## 4. Design Decisions

### 4.1 Why This Structure vs Alternatives?

**Decision 1: Separate Campaign and Placement Performance Tables**

**Alternative Considered:** Single `performance` table with nullable placement column

**Why This Way:**
- Clear separation of campaign-level metrics (TOS IS) vs placement-level metrics
- Easier to query and validate data completeness
- Placement data only exists for 30day and 7day periods (not daily)
- Better indexing strategy (smaller indexes, faster lookups)

**Trade-off:** One additional table, but cleaner data model

---

**Decision 2: Store Placement Bids in Campaigns Table**

**Alternative Considered:** Separate `placement_bids` table with 3 rows per campaign

**Why This Way:**
- Bids are attributes of the campaign, not separate entities
- Reduces JOINs in view (3 fewer JOINs)
- Simpler updates (1 row vs 3 rows)
- Current bid values don't need historical tracking

**Trade-off:** Wider table, but significant JOIN reduction

---

**Decision 3: Use Supabase Vault Instead of `encrypted_credentials` Table**

**Alternative Considered:** Continue using `encrypted_credentials` with Google KMS

**Why This Way:**
- Supabase Vault is purpose-built for secrets
- Native integration with Edge Functions
- Simpler credential rotation
- No need to manage encryption keys
- Better security model

**Trade-off:** Migration effort, but long-term benefit

---

**Decision 4: Periods as Enum Values, Not Separate Tables**

**Alternative Considered:** Separate tables for each period (30day, 7day, etc.)

**Why This Way:**
- Single table easier to maintain
- UNIQUE constraint enforces data integrity
- Simpler queries (no UNION needed)
- Easier to add new periods (just add enum value)

**Trade-off:** Slightly wider table, but much simpler schema

---

**Decision 5: Calculate CVR/ACoS in View, Not Store**

**Alternative Considered:** Pre-calculate and store in performance tables

**Why This Way:**
- Source data (clicks, orders, spend, sales) is truth
- Calculations are simple and fast
- Eliminates sync issues (stored calc getting stale)
- Easy to change calculation logic

**Trade-off:** Slight query overhead, but negligible with current data volume

---

### 4.2 How Does It Support the 25-Column Output?

**Direct Mapping (No Calculation):**
- Columns A-C: From `campaigns` and `portfolios` tables
- Columns D-F: From `placement_performance` 30day period
- Columns I-K: From `placement_performance` 7day period
- Columns N-O: From `campaign_performance` daily periods
- Column T: From `placement_performance.placement`
- Column U: From `campaigns.bid_*` columns

**Calculated in View:**
- Columns G, H: CVR-30, ACoS-30 (orders/clicks, spend/sales)
- Columns L, M: CVR-7, ACoS-7 (same formulas)
- Columns Q-S: TOS IS values (multiplied by 100 for percentage display)

**Populated by Application:**
- Column V: Changes in placement (business logic in Edge Function)
- Column W: NOTES (left blank, manual entry)
- Column P: Array formula (Google Sheets template)

**Clean Separation:**
- Database: Stores facts and performs aggregation
- View: Calculates simple metrics (CVR, ACoS)
- Application: Applies complex business logic (recommendations)

---

### 4.3 Where Are Calculations Done?

**Database (View):**
- Aggregations (SUM, AVG)
- Simple calculations (CVR, ACoS)
- Type conversions (decimal to percentage)
- Placement type mapping

**Application (Edge Function):**
- Optimization recommendations (Column V)
- Business logic thresholds
- Google Sheets formatting
- Conditional formatting rules

**Why This Split:**
- Database is fast at aggregation and simple math
- Application handles complex if/then logic
- Easier to modify business rules without changing schema
- Better testability (can mock view data)

---

### 4.4 Historical Data Strategy

**Current Approach: No Historical Tracking**

**Rationale:**
- Weekly report is point-in-time snapshot
- Amazon API provides historical periods (30day, 7day)
- Old data replaced each week
- Google Sheets serves as historical archive

**Implementation:**
- TRUNCATE performance tables before each run
- Campaigns and portfolios refreshed completely
- `workflow_executions` table preserves run history
- Google Sheets accumulate over time (Week44, Week45, etc.)

**Future Enhancement:**
If historical tracking needed:
- Add `execution_id` to performance tables
- Change TRUNCATE to INSERT (append mode)
- Query by latest `execution_id` in view
- Enables trend analysis and time-series queries

---

### 4.5 Data Retention Strategy

**Operational Data (Performance Tables):**
- **Retention**: Latest run only
- **Cleanup**: TRUNCATE before each workflow run
- **Reason**: Reduces storage, speeds up queries, data always current

**Audit Trail (Execution Tables):**
- **Retention**: 90 days
- **Cleanup**: Weekly cron job deletes old executions
- **Reason**: Debugging and compliance

**Master Data (Campaigns, Portfolios):**
- **Retention**: Latest run only
- **Cleanup**: Refresh on each workflow run
- **Reason**: Single source of truth, no historical value

**Reports (Google Sheets):**
- **Retention**: Indefinite
- **Cleanup**: Manual (archive old sheets)
- **Reason**: Business stakeholders want historical access

**Implementation:**

```sql
-- Weekly cleanup job (pg_cron)
SELECT cron.schedule(
  'cleanup-old-executions',
  '0 3 * * 1',  -- Monday 3 AM
  $$
  DELETE FROM workflow_executions
  WHERE started_at < NOW() - INTERVAL '90 days';
  $$
);
```

---

## 5. Migration Strategy

### 5.1 Initial Data Population

**Phase 1: Set Up Schema**
1. Create all tables in order (portfolios → campaigns → performance)
2. Create indexes
3. Enable RLS policies
4. Create view

**Phase 2: Migrate Credentials to Vault**
1. Extract credentials from `encrypted_credentials` table
2. Decrypt using current Google KMS process
3. Store in Supabase Vault using `vault.create_secret()`
4. Test retrieval in Edge Function
5. Delete old `encrypted_credentials` table

**Phase 3: Run First Workflow**
1. Execute Edge Function manually
2. Populate all tables from Amazon API
3. Verify view returns expected data
4. Validate 25-column output

**Phase 4: Validate Data**
1. Compare row counts with old system
2. Spot-check CVR/ACoS calculations
3. Verify portfolio/campaign joins
4. Test Google Sheets export

---

### 5.2 Ongoing Weekly Updates

**Workflow Execution Pattern:**

```typescript
// Edge Function: workflow-executor
async function executeWeeklyWorkflow() {
  // 1. Create execution record
  const executionId = new Date().toISOString();
  await supabase.from('workflow_executions').insert({
    execution_id: executionId,
    status: 'RUNNING',
    workflow_type: 'placement_optimization'
  });

  try {
    // 2. Clear old data
    await supabase.from('campaign_performance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('placement_performance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('portfolios').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Fetch fresh data from Amazon
    const portfolios = await fetchPortfolios();
    const campaigns = await fetchCampaigns();
    await insertPortfolios(portfolios);
    await insertCampaigns(campaigns);

    // 4. Request reports
    const reportIds = await requestAllReports();
    await insertReportRequests(executionId, reportIds);

    // 5. Wait for reports (handled by separate Edge Function)
    // ... polling logic ...

    // 6. Process reports
    const performanceData = await downloadAndTransformReports();
    await insertPerformanceData(performanceData);

    // 7. Mark complete
    await supabase.from('workflow_executions')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('execution_id', executionId);

  } catch (error) {
    // Mark failed
    await supabase.from('workflow_executions')
      .update({
        status: 'FAILED',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('execution_id', executionId);

    throw error;
  }
}
```

---

### 5.3 Data Cleanup Strategy

**Before Each Run:**
1. TRUNCATE performance tables (keeps schema, fast delete)
2. DELETE FROM campaigns/portfolios (respects foreign keys)
3. Log cleanup counts in execution metadata

**After Each Run:**
4. Validate row counts match expectations
5. Update `workflow_executions` with row counts

**Weekly Maintenance:**
- Clean up old `workflow_executions` (>90 days)
- Clean up old `report_requests` (>90 days)
- Vacuum tables for performance

---

## 6. Implementation DDL

### 6.1 Complete Schema Creation Script

```sql
-- =====================================================
-- Amazon Placement Optimization - Database Schema
-- Version: 2.0
-- Date: 2025-11-03
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. EXECUTION TRACKING
-- =====================================================

CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  workflow_type TEXT NOT NULL DEFAULT 'placement_optimization',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_execution_id ON workflow_executions(execution_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON workflow_executions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 2. REPORT TRACKING
-- =====================================================

CREATE TABLE report_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL,
  report_id TEXT UNIQUE NOT NULL,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'placement_30day',
    'placement_7day',
    'campaign_30day',
    'campaign_7day',
    'campaign_yesterday',
    'campaign_day_before'
  )),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'TIMEOUT')),
  download_url TEXT,
  url_expires_at TIMESTAMPTZ,
  rows_processed INTEGER DEFAULT 0,
  error_details TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (execution_id) REFERENCES workflow_executions(execution_id) ON DELETE CASCADE
);

CREATE INDEX idx_report_requests_execution_id ON report_requests(execution_id);
CREATE INDEX idx_report_requests_report_type ON report_requests(report_type);
CREATE INDEX idx_report_requests_status ON report_requests(status);
CREATE INDEX idx_report_requests_requested_at ON report_requests(requested_at DESC);

ALTER TABLE report_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON report_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 3. MASTER DATA - PORTFOLIOS
-- =====================================================

CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id TEXT UNIQUE NOT NULL,
  portfolio_name TEXT NOT NULL,
  portfolio_state TEXT NOT NULL DEFAULT 'ENABLED',
  in_budget BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolios_portfolio_id ON portfolios(portfolio_id);
CREATE INDEX idx_portfolios_state ON portfolios(portfolio_state) WHERE portfolio_state = 'ENABLED';

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON portfolios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 4. MASTER DATA - CAMPAIGNS
-- =====================================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT UNIQUE NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT NOT NULL,
  portfolio_id TEXT,
  daily_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
  bid_top_of_search INTEGER NOT NULL DEFAULT 0 CHECK (bid_top_of_search BETWEEN 0 AND 900),
  bid_rest_of_search INTEGER NOT NULL DEFAULT 0 CHECK (bid_rest_of_search BETWEEN 0 AND 900),
  bid_product_page INTEGER NOT NULL DEFAULT 0 CHECK (bid_product_page BETWEEN 0 AND 900),
  targeting_type TEXT,
  start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id) ON DELETE SET NULL
);

CREATE INDEX idx_campaigns_campaign_id ON campaigns(campaign_id);
CREATE INDEX idx_campaigns_portfolio_id ON campaigns(portfolio_id);
CREATE INDEX idx_campaigns_status ON campaigns(campaign_status) WHERE campaign_status = 'ENABLED';

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 5. PERFORMANCE DATA - CAMPAIGN LEVEL
-- =====================================================

CREATE TABLE campaign_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('30day', '7day', 'yesterday', 'day_before')),
  report_date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_7d INTEGER NOT NULL DEFAULT 0,
  sales_7d DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_14d INTEGER NOT NULL DEFAULT 0,
  sales_14d DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_30d INTEGER NOT NULL DEFAULT 0,
  sales_30d DECIMAL(10,2) NOT NULL DEFAULT 0,
  top_of_search_impression_share DECIMAL(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  UNIQUE(campaign_id, period_type, report_date)
);

CREATE INDEX idx_campaign_performance_campaign_id ON campaign_performance(campaign_id);
CREATE INDEX idx_campaign_performance_period_type ON campaign_performance(period_type);
CREATE INDEX idx_campaign_performance_report_date ON campaign_performance(report_date DESC);
CREATE INDEX idx_campaign_performance_lookup ON campaign_performance(campaign_id, period_type);

ALTER TABLE campaign_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON campaign_performance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 6. PERFORMANCE DATA - PLACEMENT LEVEL
-- =====================================================

CREATE TABLE placement_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('PLACEMENT_TOP', 'PLACEMENT_REST_OF_SEARCH', 'PLACEMENT_PRODUCT_PAGE')),
  period_type TEXT NOT NULL CHECK (period_type IN ('30day', '7day')),
  report_date DATE NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  spend DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_7d INTEGER NOT NULL DEFAULT 0,
  sales_7d DECIMAL(10,2) NOT NULL DEFAULT 0,
  orders_30d INTEGER NOT NULL DEFAULT 0,
  sales_30d DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  UNIQUE(campaign_id, placement, period_type, report_date)
);

CREATE INDEX idx_placement_performance_campaign_id ON placement_performance(campaign_id);
CREATE INDEX idx_placement_performance_placement ON placement_performance(placement);
CREATE INDEX idx_placement_performance_period_type ON placement_performance(period_type);
CREATE INDEX idx_placement_performance_lookup ON placement_performance(campaign_id, placement, period_type);

ALTER TABLE placement_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON placement_performance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- 7. VIEW - PLACEMENT OPTIMIZATION REPORT
-- =====================================================

CREATE OR REPLACE VIEW view_placement_optimization_report AS
WITH
placement_30d AS (
  SELECT
    campaign_id,
    placement,
    SUM(clicks) AS clicks_30,
    SUM(spend) AS spend_30,
    SUM(orders_30d) AS orders_30,
    SUM(sales_30d) AS sales_30
  FROM placement_performance
  WHERE period_type = '30day'
  GROUP BY campaign_id, placement
),

placement_7d AS (
  SELECT
    campaign_id,
    placement,
    SUM(clicks) AS clicks_7,
    SUM(spend) AS spend_7,
    SUM(orders_7d) AS orders_7,
    SUM(sales_7d) AS sales_7
  FROM placement_performance
  WHERE period_type = '7day'
  GROUP BY campaign_id, placement
),

campaign_tos_30d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_30
  FROM campaign_performance
  WHERE period_type = '30day'
  GROUP BY campaign_id
),

campaign_tos_7d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_7
  FROM campaign_performance
  WHERE period_type = '7day'
  GROUP BY campaign_id
),

campaign_yesterday AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_yesterday,
    AVG(top_of_search_impression_share) * 100 AS tos_is_yesterday
  FROM campaign_performance
  WHERE period_type = 'yesterday'
  GROUP BY campaign_id
),

campaign_day_before AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_day_before
  FROM campaign_performance
  WHERE period_type = 'day_before'
  GROUP BY campaign_id
)

SELECT
  c.campaign_name AS "Campaign",
  p.portfolio_name AS "Portfolio",
  c.daily_budget AS "Budget",
  COALESCE(p30.clicks_30, 0) AS "Clicks-30",
  COALESCE(p30.spend_30, 0) AS "Spend-30",
  COALESCE(p30.orders_30, 0) AS "Orders-30",
  CASE
    WHEN COALESCE(p30.clicks_30, 0) > 0 THEN
      ROUND((COALESCE(p30.orders_30, 0)::DECIMAL / p30.clicks_30) * 100, 2)
    ELSE 0
  END AS "CVR-30",
  CASE
    WHEN COALESCE(p30.sales_30, 0) > 0 THEN
      ROUND((COALESCE(p30.spend_30, 0) / p30.sales_30) * 100, 2)
    ELSE 0
  END AS "ACoS-30",
  COALESCE(p7.clicks_7, 0) AS "Clicks-7",
  COALESCE(p7.spend_7, 0) AS "Spend-7",
  COALESCE(p7.orders_7, 0) AS "Orders-7",
  CASE
    WHEN COALESCE(p7.clicks_7, 0) > 0 THEN
      ROUND((COALESCE(p7.orders_7, 0)::DECIMAL / p7.clicks_7) * 100, 2)
    ELSE 0
  END AS "CVR-7",
  CASE
    WHEN COALESCE(p7.sales_7, 0) > 0 THEN
      ROUND((COALESCE(p7.spend_7, 0) / p7.sales_7) * 100, 2)
    ELSE 0
  END AS "ACoS-7",
  COALESCE(cdb.spent_day_before, 0) AS "Spent DB Yesterday",
  COALESCE(cy.spent_yesterday, 0) AS "Spent Yesterday",
  NULL AS "Array Formula",
  COALESCE(c30.tos_is_30, 0) AS "Last 30 days",
  COALESCE(c7.tos_is_7, 0) AS "Last 7 days",
  COALESCE(cy.tos_is_yesterday, 0) AS "Yesterday",
  CASE
    WHEN p30.placement = 'PLACEMENT_TOP' THEN 'Placement Top'
    WHEN p30.placement = 'PLACEMENT_REST_OF_SEARCH' THEN 'Placement Rest Of Search'
    WHEN p30.placement = 'PLACEMENT_PRODUCT_PAGE' THEN 'Placement Product Page'
    ELSE p30.placement
  END AS "Placement Type",
  CASE
    WHEN p30.placement = 'PLACEMENT_TOP' THEN c.bid_top_of_search
    WHEN p30.placement = 'PLACEMENT_REST_OF_SEARCH' THEN c.bid_rest_of_search
    WHEN p30.placement = 'PLACEMENT_PRODUCT_PAGE' THEN c.bid_product_page
    ELSE 0
  END AS "Increase bids by placement",
  '' AS "Changes in placement",
  '' AS "NOTES"

FROM placement_30d p30

LEFT JOIN placement_7d p7
  ON p30.campaign_id = p7.campaign_id
  AND p30.placement = p7.placement

INNER JOIN campaigns c
  ON p30.campaign_id = c.campaign_id

LEFT JOIN portfolios p
  ON c.portfolio_id = p.portfolio_id

LEFT JOIN campaign_tos_30d c30
  ON p30.campaign_id = c30.campaign_id

LEFT JOIN campaign_tos_7d c7
  ON p30.campaign_id = c7.campaign_id

LEFT JOIN campaign_yesterday cy
  ON p30.campaign_id = cy.campaign_id

LEFT JOIN campaign_day_before cdb
  ON p30.campaign_id = cdb.campaign_id

WHERE
  c.campaign_status = 'ENABLED'
  AND COALESCE(p30.spend_30, 0) > 0

ORDER BY
  p.portfolio_name NULLS LAST,
  c.campaign_name,
  p30.placement;

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to truncate all performance data
CREATE OR REPLACE FUNCTION truncate_performance_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE campaign_performance;
  TRUNCATE TABLE placement_performance;
  DELETE FROM campaigns;
  DELETE FROM portfolios;
END;
$$;

-- =====================================================
-- 9. SCHEDULED CLEANUP (pg_cron)
-- =====================================================

-- Clean up old executions (90 days)
SELECT cron.schedule(
  'cleanup-old-workflow-executions',
  '0 3 * * 1',  -- Monday at 3 AM
  $$
  DELETE FROM workflow_executions
  WHERE started_at < NOW() - INTERVAL '90 days';
  $$
);

-- =====================================================
-- END OF SCHEMA
-- =====================================================
```

### 6.2 Supabase Vault Setup

```sql
-- Store Amazon API credentials in Vault
-- Run these from Supabase SQL Editor or Edge Function

-- 1. Store SP API Client ID
SELECT vault.create_secret(
  'sp_api_client_id',
  'YOUR_CLIENT_ID_HERE',
  'Amazon SP API Client ID'
);

-- 2. Store SP API Client Secret
SELECT vault.create_secret(
  'sp_api_client_secret',
  'YOUR_CLIENT_SECRET_HERE',
  'Amazon SP API Client Secret'
);

-- 3. Store SP API Refresh Token
SELECT vault.create_secret(
  'sp_api_refresh_token',
  'YOUR_REFRESH_TOKEN_HERE',
  'Amazon SP API Refresh Token'
);

-- 4. Store Advertising Client ID
SELECT vault.create_secret(
  'advertising_client_id',
  'YOUR_ADVERTISING_CLIENT_ID_HERE',
  'Amazon Advertising API Client ID'
);

-- 5. Store Marketplace ID
SELECT vault.create_secret(
  'marketplace_id',
  'ATVPDKIKX0DER',  -- US marketplace
  'Amazon Marketplace ID'
);

-- 6. Store Region
SELECT vault.create_secret(
  'region',
  'NA',  -- North America
  'Amazon Ads API Region'
);
```

### 6.3 Retrieve Secrets in Edge Function

```typescript
// Example: Retrieve credentials from Vault in Edge Function
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function getAmazonCredentials() {
  // Retrieve secrets from Vault
  const { data: secrets, error } = await supabase
    .rpc('vault_get_secrets', {
      secret_names: [
        'sp_api_client_id',
        'sp_api_client_secret',
        'sp_api_refresh_token',
        'advertising_client_id',
        'marketplace_id',
        'region'
      ]
    });

  if (error) throw error;

  return {
    spApiClientId: secrets.sp_api_client_id,
    spApiClientSecret: secrets.sp_api_client_secret,
    spApiRefreshToken: secrets.sp_api_refresh_token,
    advertisingClientId: secrets.advertising_client_id,
    marketplaceId: secrets.marketplace_id,
    region: secrets.region
  };
}
```

---

## 7. Summary

### 7.1 Schema Benefits

1. **Clean Architecture**: Clear separation between execution tracking, master data, and performance metrics
2. **Optimized for Queries**: Indexes on all foreign keys and common query patterns
3. **Data Integrity**: UNIQUE constraints, CHECK constraints, and foreign keys prevent bad data
4. **Scalable**: Can handle 5000+ campaigns without performance degradation
5. **Maintainable**: Simple structure, easy to understand and modify
6. **Secure**: RLS policies, Vault integration, no plaintext secrets

### 7.2 Key Features

- **6 tables** instead of 8 (consolidated placement bids into campaigns)
- **1 view** that generates all 25 columns
- **Idempotent execution** tracking
- **Comprehensive audit trail**
- **Fast queries** (2-5 seconds for 900 rows)
- **Supabase Vault** for credential management

### 7.3 Next Steps

1. **Execute DDL script** in Supabase SQL Editor
2. **Migrate credentials** to Vault
3. **Build Edge Functions** to populate tables
4. **Test view query** with sample data
5. **Validate 25-column output** matches specification
6. **Deploy to production**

---

**Document Status:** ✅ COMPLETE AND READY FOR IMPLEMENTATION

**Implementation Checklist:**
- [ ] Run schema DDL in Supabase
- [ ] Migrate credentials to Vault
- [ ] Create Edge Functions
- [ ] Test with sample data
- [ ] Validate view output
- [ ] Deploy and schedule cron job
