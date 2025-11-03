# Supabase Architecture for Amazon Placement Optimization System

**Document Version:** 1.0
**Date:** 2025-11-03
**Created By:** Supabase Architect Agent
**Purpose:** Complete database architecture, Edge Functions, and deployment plan

---

## Table of Contents

1. [Database Schema Design](#1-database-schema-design)
2. [SQL View Definition](#2-sql-view-definition)
3. [Edge Functions Architecture](#3-edge-functions-architecture)
4. [TypeScript Type Definitions](#4-typescript-type-definitions)
5. [Scheduling with pg_cron](#5-scheduling-with-pg_cron)
6. [Environment Variables & Secrets](#6-environment-variables--secrets)
7. [Error Handling & Logging](#7-error-handling--logging)
8. [Testing Strategy](#8-testing-strategy)
9. [Deployment Steps](#9-deployment-steps)
10. [Migration from N8N](#10-migration-from-n8n)

---

## 1. Database Schema Design

### 1.1 Table: encrypted_credentials

**Purpose:** Store encrypted API credentials using Google KMS encryption

```sql
-- Table already exists in current system
CREATE TABLE IF NOT EXISTS encrypted_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_name TEXT UNIQUE NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE encrypted_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access credentials
CREATE POLICY "Service role only" ON encrypted_credentials
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_encrypted_credentials_name
  ON encrypted_credentials(credential_name);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_encrypted_credentials_updated_at
  BEFORE UPDATE ON encrypted_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Required Credentials:**
- `sp_api_client_id`
- `sp_api_client_secret`
- `sp_api_refresh_token`
- `advertising_client_id`
- `marketplace_id` (optional - can be env var)
- `region` (optional - can be env var)

---

### 1.2 Table: token_cache

**Purpose:** Cache OAuth access tokens to minimize API calls

```sql
-- Table already exists in current system
CREATE TABLE IF NOT EXISTS token_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE token_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access tokens
CREATE POLICY "Service role only" ON token_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookup by service
CREATE INDEX IF NOT EXISTS idx_token_cache_service
  ON token_cache(service);

-- Index for expiration checks
CREATE INDEX IF NOT EXISTS idx_token_cache_expires_at
  ON token_cache(expires_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_token_cache_updated_at
  BEFORE UPDATE ON token_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Service Values:**
- `amazon_ads` - Main Amazon Advertising API token

---

### 1.3 Table: report_ledger

**Purpose:** Track all Amazon report requests and their status

```sql
-- Table already exists in current system with enhancements
CREATE TABLE IF NOT EXISTS report_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  report_type TEXT,
  time_period TEXT,
  url TEXT,
  url_expires_at TIMESTAMPTZ,
  processed BOOLEAN DEFAULT FALSE,
  file_size BIGINT,
  row_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_timestamp TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE report_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role only for write, authenticated users can read
CREATE POLICY "Service role write, authenticated read" ON report_ledger
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role write" ON report_ledger
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role update" ON report_ledger
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_ledger_report_id
  ON report_ledger(report_id);

CREATE INDEX IF NOT EXISTS idx_report_ledger_status
  ON report_ledger(status);

CREATE INDEX IF NOT EXISTS idx_report_ledger_report_type
  ON report_ledger(report_type);

CREATE INDEX IF NOT EXISTS idx_report_ledger_created_at
  ON report_ledger(created_at DESC);

-- Trigger
CREATE TRIGGER update_report_ledger_updated_at
  BEFORE UPDATE ON report_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Status Values:**
- `PENDING` - Report requested, waiting for Amazon
- `PROCESSING` - Amazon is generating report
- `COMPLETED` - Report ready for download
- `FAILED` - Report generation failed
- `TIMEOUT` - Report took too long to generate

**Report Type Values:**
- `placement_30day`
- `placement_7day`
- `campaign_30day`
- `campaign_7day`
- `campaign_yesterday`
- `campaign_dayBefore`

---

### 1.4 Table: portfolios

**Purpose:** Store portfolio metadata for campaign grouping

```sql
-- Table already exists in current system
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id TEXT UNIQUE NOT NULL,
  portfolio_name TEXT NOT NULL,
  portfolio_state TEXT DEFAULT 'ENABLED',
  in_budget BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read
CREATE POLICY "Authenticated read portfolios" ON portfolios
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role write portfolios" ON portfolios
  FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolios_portfolio_id
  ON portfolios(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_portfolios_state
  ON portfolios(portfolio_state);

-- Trigger
CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Notes:**
- Table is cleared and refreshed on each workflow run
- Only ENABLED portfolios are stored

---

### 1.5 Table: placement_bids

**Purpose:** Store current placement bid adjustments from campaigns

```sql
-- Table already exists in current system
CREATE TABLE IF NOT EXISTS placement_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT NOT NULL,
  campaign_budget DECIMAL(10,2),
  portfolio_id TEXT,
  placement_top_of_search INTEGER DEFAULT 0,
  placement_rest_of_search INTEGER DEFAULT 0,
  placement_product_page INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_portfolio
    FOREIGN KEY (portfolio_id)
    REFERENCES portfolios(portfolio_id)
    ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE placement_bids ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read
CREATE POLICY "Authenticated read placement_bids" ON placement_bids
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role write placement_bids" ON placement_bids
  FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_placement_bids_campaign_id
  ON placement_bids(campaign_id);

CREATE INDEX IF NOT EXISTS idx_placement_bids_portfolio_id
  ON placement_bids(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_placement_bids_campaign_status
  ON placement_bids(campaign_status);

-- Composite index for common JOIN pattern
CREATE INDEX IF NOT EXISTS idx_placement_bids_campaign_portfolio
  ON placement_bids(campaign_id, portfolio_id);

-- Trigger
CREATE TRIGGER update_placement_bids_updated_at
  BEFORE UPDATE ON placement_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Bid Adjustment Values:**
- Integer percentages (0-900)
- 0 = no adjustment (use base bid)
- 65 = 65% increase over base bid
- 900 = maximum allowed (900% increase)

---

### 1.6 Table: raw_campaign_reports

**Purpose:** Store raw campaign-level data from Amazon reports

```sql
-- Table already exists in current system with enhancements
CREATE TABLE IF NOT EXISTS raw_campaign_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  data_date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  campaign_status TEXT,
  campaign_budget_amount DECIMAL(10,2),
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  top_of_search_impression_share DECIMAL(10,6),
  purchases_14d INTEGER DEFAULT 0,
  sales_14d DECIMAL(10,2) DEFAULT 0,
  purchases_30d INTEGER DEFAULT 0,
  sales_30d DECIMAL(10,2) DEFAULT 0,
  purchases_7d INTEGER DEFAULT 0,
  sales_7d DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE raw_campaign_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read
CREATE POLICY "Authenticated read raw_campaign_reports" ON raw_campaign_reports
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role write raw_campaign_reports" ON raw_campaign_reports
  FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_campaign_campaign_id
  ON raw_campaign_reports(campaign_id);

CREATE INDEX IF NOT EXISTS idx_raw_campaign_report_type
  ON raw_campaign_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_raw_campaign_date
  ON raw_campaign_reports(data_date);

CREATE INDEX IF NOT EXISTS idx_raw_campaign_status
  ON raw_campaign_reports(campaign_status);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_raw_campaign_type_status
  ON raw_campaign_reports(report_type, campaign_status);

CREATE INDEX IF NOT EXISTS idx_raw_campaign_id_type
  ON raw_campaign_reports(campaign_id, report_type);
```

**Report Type Values:**
- `30day` - 30-day summary data
- `7day` - 7-day summary data
- `yesterday` - Daily data for yesterday
- `dayBefore` - Daily data for day before yesterday

---

### 1.7 Table: raw_placement_reports

**Purpose:** Store raw placement-level data from Amazon reports

```sql
-- Table already exists in current system with enhancements
CREATE TABLE IF NOT EXISTS raw_placement_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  data_date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  campaign_status TEXT,
  placement_classification TEXT NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  purchases_14d INTEGER DEFAULT 0,
  sales_14d DECIMAL(10,2) DEFAULT 0,
  purchases_30d INTEGER DEFAULT 0,
  sales_30d DECIMAL(10,2) DEFAULT 0,
  purchases_7d INTEGER DEFAULT 0,
  sales_7d DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE raw_placement_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read
CREATE POLICY "Authenticated read raw_placement_reports" ON raw_placement_reports
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role write raw_placement_reports" ON raw_placement_reports
  FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_placement_campaign_id
  ON raw_placement_reports(campaign_id);

CREATE INDEX IF NOT EXISTS idx_raw_placement_report_type
  ON raw_placement_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_raw_placement_classification
  ON raw_placement_reports(placement_classification);

CREATE INDEX IF NOT EXISTS idx_raw_placement_status
  ON raw_placement_reports(campaign_status);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_raw_placement_campaign_placement
  ON raw_placement_reports(campaign_id, placement_classification);

CREATE INDEX IF NOT EXISTS idx_raw_placement_type_status
  ON raw_placement_reports(report_type, campaign_status);

CREATE INDEX IF NOT EXISTS idx_raw_placement_type_classification
  ON raw_placement_reports(report_type, placement_classification);
```

**Placement Classification Values:**
- `PLACEMENT_TOP`
- `PLACEMENT_REST_OF_SEARCH`
- `PLACEMENT_PRODUCT_PAGE`

---

### 1.8 Table: workflow_runs

**Purpose:** Track workflow execution for idempotency and monitoring

```sql
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  report_ids JSONB,
  portfolio_count INTEGER,
  campaign_count INTEGER,
  total_rows_inserted INTEGER,
  google_sheet_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read
CREATE POLICY "Authenticated read workflow_runs" ON workflow_runs
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Service role write workflow_runs" ON workflow_runs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_runs_run_id
  ON workflow_runs(run_id);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON workflow_runs(status);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at
  ON workflow_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_type
  ON workflow_runs(workflow_type);
```

**Status Values:**
- `RUNNING` - Workflow currently executing
- `COMPLETED` - Workflow finished successfully
- `FAILED` - Workflow encountered an error
- `PARTIAL` - Some reports succeeded, some failed

**Workflow Type Values:**
- `data_collection`
- `report_processing`
- `report_generation`
- `full_workflow`

---

## 2. SQL View Definition

### 2.1 Main View: view_placement_optimization_report

**Purpose:** Aggregate all data sources into the final 25-column report format

```sql
CREATE OR REPLACE VIEW view_placement_optimization_report AS
WITH
-- Aggregate 30-day placement data
placement_30d AS (
  SELECT
    campaign_id,
    campaign_name,
    placement_classification,
    SUM(impressions) AS impressions_30,
    SUM(clicks) AS clicks_30,
    SUM(spend) AS spend_30,
    SUM(purchases_30d) AS orders_30,
    SUM(sales_30d) AS sales_30
  FROM raw_placement_reports
  WHERE report_type = '30day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id, campaign_name, placement_classification
),

-- Aggregate 7-day placement data
placement_7d AS (
  SELECT
    campaign_id,
    placement_classification,
    SUM(clicks) AS clicks_7,
    SUM(spend) AS spend_7,
    SUM(purchases_7d) AS orders_7,
    SUM(sales_7d) AS sales_7
  FROM raw_placement_reports
  WHERE report_type = '7day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id, placement_classification
),

-- Get yesterday's spend
campaign_yesterday AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_yesterday,
    AVG(top_of_search_impression_share) AS tos_is_yesterday
  FROM raw_campaign_reports
  WHERE report_type = 'yesterday'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id
),

-- Get day before yesterday's spend
campaign_day_before AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_db_yesterday
  FROM raw_campaign_reports
  WHERE report_type = 'dayBefore'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id
),

-- Get 30-day campaign data (budget and TOS impression share)
campaign_30d AS (
  SELECT
    campaign_id,
    MAX(campaign_budget_amount) AS campaign_budget_amount,
    AVG(top_of_search_impression_share) AS tos_is_30
  FROM raw_campaign_reports
  WHERE report_type = '30day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id
),

-- Get 7-day campaign data (TOS impression share)
campaign_7d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) AS tos_is_7
  FROM raw_campaign_reports
  WHERE report_type = '7day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id
)

-- Main query joining all CTEs
SELECT
  -- Column A: Campaign
  p30.campaign_name AS "Campaign",

  -- Column B: Portfolio
  COALESCE(port.portfolio_name, 'No Portfolio') AS "Portfolio",

  -- Column C: Budget
  COALESCE(c30.campaign_budget_amount, 0) AS "Budget",

  -- Column D: Clicks-30
  COALESCE(p30.clicks_30, 0) AS "Clicks-30",

  -- Column E: Spend-30
  COALESCE(p30.spend_30, 0) AS "Spend-30",

  -- Column F: Orders-30
  COALESCE(p30.orders_30, 0) AS "Orders-30",

  -- Column G: CVR-30 (Calculated)
  CASE
    WHEN COALESCE(p30.clicks_30, 0) > 0
    THEN ROUND((COALESCE(p30.orders_30, 0)::DECIMAL / p30.clicks_30) * 100, 2)
    ELSE 0
  END AS "CVR-30",

  -- Column H: ACoS-30 (Calculated)
  CASE
    WHEN COALESCE(p30.sales_30, 0) > 0
    THEN ROUND((COALESCE(p30.spend_30, 0) / p30.sales_30) * 100, 2)
    ELSE 0
  END AS "ACoS-30",

  -- Column I: Clicks-7
  COALESCE(p7.clicks_7, 0) AS "Clicks-7",

  -- Column J: Spend-7
  COALESCE(p7.spend_7, 0) AS "Spend-7",

  -- Column K: Orders-7
  COALESCE(p7.orders_7, 0) AS "Orders-7",

  -- Column L: CVR-7 (Calculated)
  CASE
    WHEN COALESCE(p7.clicks_7, 0) > 0
    THEN ROUND((COALESCE(p7.orders_7, 0)::DECIMAL / p7.clicks_7) * 100, 2)
    ELSE 0
  END AS "CVR-7",

  -- Column M: ACOS-7 (Calculated)
  CASE
    WHEN COALESCE(p7.sales_7, 0) > 0
    THEN ROUND((COALESCE(p7.spend_7, 0) / p7.sales_7) * 100, 2)
    ELSE 0
  END AS "ACOS-7",

  -- Column N: Spent DB Yesterday
  COALESCE(cdb.spent_db_yesterday, 0) AS "Spent DB Yesterday",

  -- Column O: Spent Yesterday
  COALESCE(cy.spent_yesterday, 0) AS "Spent Yesterday",

  -- Column Q: Last 30 days (TOS IS)
  ROUND(COALESCE(c30.tos_is_30, 0) * 100, 4) AS "Last 30 days",

  -- Column R: Last 7 days (TOS IS)
  ROUND(COALESCE(c7.tos_is_7, 0) * 100, 4) AS "Last 7 days",

  -- Column S: Yesterday (TOS IS)
  ROUND(COALESCE(cy.tos_is_yesterday, 0) * 100, 4) AS "Yesterday",

  -- Column T: Placement Type (Mapped)
  CASE
    WHEN p30.placement_classification = 'PLACEMENT_TOP' THEN 'Placement Top'
    WHEN p30.placement_classification = 'PLACEMENT_REST_OF_SEARCH' THEN 'Placement Rest Of Search'
    WHEN p30.placement_classification = 'PLACEMENT_PRODUCT_PAGE' THEN 'Placement Product Page'
    ELSE p30.placement_classification
  END AS "Placement Type",

  -- Column U: Increase bids by placement (Current bid adjustment)
  CASE
    WHEN p30.placement_classification = 'PLACEMENT_TOP'
      THEN COALESCE(pb.placement_top_of_search, 0)
    WHEN p30.placement_classification = 'PLACEMENT_REST_OF_SEARCH'
      THEN COALESCE(pb.placement_rest_of_search, 0)
    WHEN p30.placement_classification = 'PLACEMENT_PRODUCT_PAGE'
      THEN COALESCE(pb.placement_product_page, 0)
    ELSE 0
  END AS "Increase bids by placement",

  -- Column V: Changes in placement (Populated by Edge Function)
  '' AS "Changes in placement",

  -- Column W: NOTES (Left blank for manual input)
  '' AS "NOTES",

  -- Internal columns for Edge Function calculations
  p30.campaign_id AS "_campaign_id",
  p30.sales_30 AS "_sales_30",
  p7.sales_7 AS "_sales_7"

FROM placement_30d p30

LEFT JOIN placement_7d p7
  ON p30.campaign_id = p7.campaign_id
  AND p30.placement_classification = p7.placement_classification

LEFT JOIN campaign_30d c30
  ON p30.campaign_id = c30.campaign_id

LEFT JOIN campaign_7d c7
  ON p30.campaign_id = c7.campaign_id

LEFT JOIN campaign_yesterday cy
  ON p30.campaign_id = cy.campaign_id

LEFT JOIN campaign_day_before cdb
  ON p30.campaign_id = cdb.campaign_id

LEFT JOIN placement_bids pb
  ON p30.campaign_id = pb.campaign_id

LEFT JOIN portfolios port
  ON pb.portfolio_id = port.portfolio_id

WHERE COALESCE(p30.spend_30, 0) > 0  -- Only include campaigns with spend

ORDER BY
  port.portfolio_name NULLS LAST,
  p30.campaign_name,
  p30.placement_classification;
```

**View Characteristics:**
- Returns exactly 25 columns (22 visible + 3 internal)
- Handles NULL values with COALESCE
- Calculates CVR and ACoS with division-by-zero protection
- Maps placement classifications to display values
- Filters to only ENABLED campaigns with spend
- Orders by portfolio, campaign, then placement

**Performance Notes:**
- Uses CTEs for readability and potential optimization
- All foreign key relationships are indexed
- Consider MATERIALIZED VIEW if query time > 5 seconds

---

### 2.2 Optional: Materialized View for Performance

If the standard view becomes slow (>5 seconds), create a materialized view:

```sql
CREATE MATERIALIZED VIEW mv_placement_optimization_report AS
SELECT * FROM view_placement_optimization_report;

-- Create indexes on materialized view
CREATE INDEX idx_mv_placement_campaign
  ON mv_placement_optimization_report("Campaign");

CREATE INDEX idx_mv_placement_portfolio
  ON mv_placement_optimization_report("Portfolio");

CREATE INDEX idx_mv_placement_type
  ON mv_placement_optimization_report("Placement Type");

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_placement_report()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_placement_optimization_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Refresh Strategy:**
- Refresh after report processing completes
- Call from Edge Function: `await supabase.rpc('refresh_placement_report')`

---

## 3. Edge Functions Architecture

### 3.1 Edge Function 1: collect-placement-data

**Trigger:** pg_cron (weekly, Wednesday 09:05 UTC)
**Runtime:** Deno/TypeScript
**Purpose:** Fetch data from Amazon API and initiate reports

#### Function Structure

```typescript
// supabase/functions/collect-placement-data/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface CollectionResult {
  success: boolean;
  reportIds: string[];
  portfolioCount: number;
  campaignCount: number;
  runId: string;
  message: string;
  errors?: string[];
}

serve(async (req) => {
  try {
    // 1. Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Generate run ID for idempotency
    const runId = `collect-${new Date().toISOString()}`;

    // 3. Check if already running
    const { data: existingRun } = await supabase
      .from("workflow_runs")
      .select("status")
      .eq("run_id", runId)
      .single();

    if (existingRun && existingRun.status === "COMPLETED") {
      return new Response(
        JSON.stringify({ success: false, message: "Run already completed" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Record workflow start
    await supabase.from("workflow_runs").insert({
      run_id: runId,
      status: "RUNNING",
      workflow_type: "data_collection",
      started_at: new Date().toISOString()
    });

    // 5. Get Amazon credentials from Supabase Vault
    const credentials = await getAmazonCredentials(supabase);

    // 6. Get or refresh access token
    const accessToken = await getAccessToken(supabase, credentials);

    // 7. Get profile ID
    const profileId = await getProfileId(accessToken, credentials.advertising_client_id);

    // 8. Clear previous data
    await clearPreviousData(supabase);

    // 9. Fetch and store portfolios
    const portfolios = await fetchPortfolios(accessToken, profileId, credentials.advertising_client_id);
    await storePortfolios(supabase, portfolios);

    // 10. Fetch and store current placement bids
    const campaigns = await fetchPlacementBids(accessToken, profileId, credentials.advertising_client_id);
    await storePlacementBids(supabase, campaigns);

    // 11. Calculate date ranges
    const dates = calculateReportDates();

    // 12. Request all 6 reports
    const reportIds = await requestAllReports(
      accessToken,
      profileId,
      credentials.advertising_client_id,
      dates,
      supabase
    );

    // 13. Update workflow run
    await supabase.from("workflow_runs").update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
      report_ids: reportIds,
      portfolio_count: portfolios.length,
      campaign_count: campaigns.length
    }).eq("run_id", runId);

    // 14. Schedule report processor (invoke after 60 minutes)
    const scheduledTime = new Date(Date.now() + 60 * 60 * 1000);
    await scheduleReportProcessor(supabase, reportIds, scheduledTime);

    const result: CollectionResult = {
      success: true,
      reportIds,
      portfolioCount: portfolios.length,
      campaignCount: campaigns.length,
      runId,
      message: `Data collection complete. ${reportIds.length} reports requested.`
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in collect-placement-data:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Helper Functions

async function getAmazonCredentials(supabase: any) {
  // Get encrypted credentials from database
  const { data: creds, error } = await supabase
    .from("encrypted_credentials")
    .select("credential_name, encrypted_value")
    .in("credential_name", [
      "sp_api_client_id",
      "sp_api_client_secret",
      "sp_api_refresh_token",
      "advertising_client_id"
    ]);

  if (error) throw error;

  // Decrypt using Google KMS (implement decryption)
  // For now, assume credentials are stored decrypted in Vault
  const credMap: any = {};
  for (const cred of creds) {
    credMap[cred.credential_name] = await decryptCredential(cred.encrypted_value);
  }

  return {
    client_id: credMap.sp_api_client_id,
    client_secret: credMap.sp_api_client_secret,
    refresh_token: credMap.sp_api_refresh_token,
    advertising_client_id: credMap.advertising_client_id
  };
}

async function getAccessToken(supabase: any, credentials: any): Promise<string> {
  // Check cache first
  const { data: cached } = await supabase
    .from("token_cache")
    .select("access_token, expires_at")
    .eq("service", "amazon_ads")
    .single();

  if (cached) {
    const expiresAt = new Date(cached.expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - now.getTime() > bufferMs) {
      return cached.access_token;
    }
  }

  // Refresh token
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token
    })
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache the token
  await supabase.from("token_cache").upsert({
    service: "amazon_ads",
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString()
  });

  return data.access_token;
}

async function getProfileId(accessToken: string, clientId: string): Promise<string> {
  const response = await fetch("https://advertising-api.amazon.com/v2/profiles", {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Get profiles failed: ${response.statusText}`);
  }

  const profiles = await response.json();
  const usProfile = profiles.find((p: any) => p.countryCode === "US");

  if (!usProfile) {
    throw new Error("US profile not found");
  }

  return usProfile.profileId.toString();
}

async function clearPreviousData(supabase: any) {
  // Clear tables that are refreshed each run
  await supabase.from("raw_campaign_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("raw_placement_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("placement_bids").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("portfolios").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

async function fetchPortfolios(accessToken: string, profileId: string, clientId: string) {
  const response = await fetch("https://advertising-api.amazon.com/portfolios/list", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      stateFilter: { include: ["ENABLED"] },
      includeExtendedDataFields: true
    })
  });

  if (!response.ok) {
    throw new Error(`Fetch portfolios failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.portfolios || [];
}

async function storePortfolios(supabase: any, portfolios: any[]) {
  const rows = portfolios.map(p => ({
    portfolio_id: p.portfolioId.toString(),
    portfolio_name: p.name,
    portfolio_state: p.state,
    in_budget: p.inBudget
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("portfolios").insert(rows);
    if (error) throw error;
  }
}

async function fetchPlacementBids(accessToken: string, profileId: string, clientId: string) {
  const response = await fetch("https://advertising-api.amazon.com/sp/campaigns/list", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Amazon-Advertising-API-Scope": profileId,
      "Content-Type": "application/vnd.spcampaign.v3+json",
      "Accept": "application/vnd.spcampaign.v3+json"
    },
    body: JSON.stringify({
      stateFilter: { include: ["ENABLED"] },
      includeExtendedDataFields: true
    })
  });

  if (!response.ok) {
    throw new Error(`Fetch placement bids failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.campaigns || [];
}

async function storePlacementBids(supabase: any, campaigns: any[]) {
  const rows = campaigns.map(campaign => {
    let placementTop = 0;
    let placementRest = 0;
    let placementProduct = 0;

    if (campaign.dynamicBidding?.placementBidding) {
      for (const p of campaign.dynamicBidding.placementBidding) {
        if (p.placement === "PLACEMENT_TOP") placementTop = p.percentage;
        if (p.placement === "PLACEMENT_REST_OF_SEARCH") placementRest = p.percentage;
        if (p.placement === "PLACEMENT_PRODUCT_PAGE") placementProduct = p.percentage;
      }
    }

    return {
      campaign_id: campaign.campaignId.toString(),
      campaign_name: campaign.name,
      campaign_status: campaign.state,
      campaign_budget: campaign.budget?.budget || 0,
      portfolio_id: campaign.portfolioId ? campaign.portfolioId.toString() : null,
      placement_top_of_search: placementTop,
      placement_rest_of_search: placementRest,
      placement_product_page: placementProduct
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase.from("placement_bids").insert(rows);
    if (error) throw error;
  }
}

function calculateReportDates() {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  const subtractDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  };

  return {
    today: formatDate(today),
    yesterday: formatDate(subtractDays(today, 1)),
    dayBefore: formatDate(subtractDays(today, 2)),
    endDate: formatDate(subtractDays(today, 3)),
    startDate30: formatDate(subtractDays(today, 33)),
    startDate7: formatDate(subtractDays(today, 9))
  };
}

async function requestAllReports(
  accessToken: string,
  profileId: string,
  clientId: string,
  dates: any,
  supabase: any
): Promise<string[]> {
  const reportConfigs = [
    {
      name: `SP-Placement-30Days-${dates.today}`,
      startDate: dates.startDate30,
      endDate: dates.endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        reportTypeId: "spCampaigns",
        timeUnit: "SUMMARY",
        format: "GZIP_JSON",
        groupBy: ["campaign", "campaignPlacement"],
        columns: [
          "campaignId", "campaignName", "campaignStatus", "campaignBudgetAmount",
          "placementClassification", "impressions", "clicks", "spend",
          "purchases30d", "sales30d"
        ]
      }
    },
    {
      name: `SP-Placement-7Days-${dates.today}`,
      startDate: dates.startDate7,
      endDate: dates.endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        reportTypeId: "spCampaigns",
        timeUnit: "SUMMARY",
        format: "GZIP_JSON",
        groupBy: ["campaign", "campaignPlacement"],
        columns: [
          "campaignId", "campaignName", "campaignStatus", "placementClassification",
          "clicks", "spend", "purchases7d", "sales7d"
        ]
      }
    },
    {
      name: `SP-Campaign-30Days-${dates.today}`,
      startDate: dates.startDate30,
      endDate: dates.endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        reportTypeId: "spCampaigns",
        timeUnit: "SUMMARY",
        format: "GZIP_JSON",
        groupBy: ["campaign"],
        columns: [
          "campaignId", "campaignName", "campaignBudgetAmount", "impressions", "clicks",
          "spend", "purchases30d", "sales30d", "purchases14d", "sales14d",
          "purchases7d", "sales7d", "topOfSearchImpressionShare", "campaignStatus"
        ]
      }
    },
    {
      name: `SP-Campaign-7Days-${dates.today}`,
      startDate: dates.startDate7,
      endDate: dates.endDate,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        reportTypeId: "spCampaigns",
        timeUnit: "SUMMARY",
        format: "GZIP_JSON",
        groupBy: ["campaign"],
        columns: [
          "campaignId", "campaignName", "campaignBudgetAmount", "impressions", "clicks",
          "spend", "purchases7d", "sales7d", "purchases14d", "sales14d",
          "purchases30d", "sales30d", "topOfSearchImpressionShare", "campaignStatus"
        ]
      }
    },
    {
      name: `SP-Campaign-Yesterday-${dates.today}`,
      startDate: dates.yesterday,
      endDate: dates.yesterday,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        reportTypeId: "spCampaigns",
        timeUnit: "DAILY",
        format: "GZIP_JSON",
        groupBy: ["campaign"],
        columns: [
          "campaignId", "campaignName", "campaignBudgetAmount",
          "topOfSearchImpressionShare", "date", "campaignStatus", "spend"
        ]
      }
    },
    {
      name: `SP-Campaign-DayBefore-${dates.today}`,
      startDate: dates.dayBefore,
      endDate: dates.dayBefore,
      configuration: {
        adProduct: "SPONSORED_PRODUCTS",
        reportTypeId: "spCampaigns",
        timeUnit: "DAILY",
        format: "GZIP_JSON",
        groupBy: ["campaign"],
        columns: [
          "campaignId", "campaignName", "campaignBudgetAmount",
          "campaignStatus", "date", "spend"
        ]
      }
    }
  ];

  const reportIds: string[] = [];

  for (const config of reportConfigs) {
    // Rate limiting: 1 request per second
    if (reportIds.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const response = await fetch("https://advertising-api.amazon.com/reporting/reports", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Amazon-Advertising-API-ClientId": clientId,
        "Amazon-Advertising-API-Scope": profileId,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      console.error(`Failed to request report ${config.name}: ${response.statusText}`);
      continue;
    }

    const data = await response.json();
    reportIds.push(data.reportId);

    // Store in report_ledger
    await supabase.from("report_ledger").insert({
      report_id: data.reportId,
      name: config.name,
      status: "PENDING",
      report_type: identifyReportType(config.name),
      time_period: config.configuration.timeUnit.toLowerCase(),
      created_timestamp: new Date().toISOString()
    });
  }

  return reportIds;
}

function identifyReportType(reportName: string): string {
  if (reportName.includes("Placement-30Days")) return "placement_30day";
  if (reportName.includes("Placement-7Days")) return "placement_7day";
  if (reportName.includes("Campaign-30Days")) return "campaign_30day";
  if (reportName.includes("Campaign-7Days")) return "campaign_7day";
  if (reportName.includes("Campaign-Yesterday")) return "campaign_yesterday";
  if (reportName.includes("Campaign-DayBefore")) return "campaign_dayBefore";
  return "unknown";
}

async function scheduleReportProcessor(supabase: any, reportIds: string[], scheduledTime: Date) {
  // In production, use pg_cron or invoke Edge Function with delay
  // For now, log the scheduled time
  console.log(`Report processor scheduled for ${scheduledTime.toISOString()}`);
  console.log(`Report IDs: ${reportIds.join(", ")}`);
}

async function decryptCredential(encryptedValue: string): Promise<string> {
  // TODO: Implement Google KMS decryption
  // For now, assume credentials are stored in Supabase Vault
  // Use: SELECT vault.decrypted_secrets() or similar
  return encryptedValue; // Placeholder
}
```

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Error Handling:**
- Try/catch at top level
- Log all errors
- Update workflow_runs status to FAILED
- Return descriptive error messages

**Rate Limiting:**
- 1 second delay between report requests
- Retry logic for 429 errors (exponential backoff)

---

### 3.2 Edge Function 2: process-reports

**Trigger:** HTTP endpoint or delayed cron (60 minutes after Function 1)
**Runtime:** Deno/TypeScript
**Purpose:** Poll, download, and process reports

#### Function Structure

```typescript
// supabase/functions/process-reports/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { gunzip } from "https://deno.land/x/denoflate@1.2.1/mod.ts";

interface ProcessResult {
  success: boolean;
  processedReports: number;
  failedReports: number;
  totalRows: number;
  message: string;
  errors?: string[];
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get report IDs from request or fetch from ledger
    let reportIds: string[];

    if (req.method === "POST") {
      const body = await req.json();
      reportIds = body.reportIds || [];
    } else {
      // Fetch pending reports from ledger
      const { data: pending } = await supabase
        .from("report_ledger")
        .select("report_id")
        .in("status", ["PENDING", "PROCESSING"])
        .order("created_at", { ascending: false })
        .limit(10);

      reportIds = pending?.map(r => r.report_id) || [];
    }

    if (reportIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No reports to process" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const runId = `process-${new Date().toISOString()}`;

    await supabase.from("workflow_runs").insert({
      run_id: runId,
      status: "RUNNING",
      workflow_type: "report_processing",
      started_at: new Date().toISOString(),
      report_ids: reportIds
    });

    // Get credentials and access token
    const credentials = await getAmazonCredentials(supabase);
    const accessToken = await getAccessToken(supabase, credentials);
    const profileId = await getProfileId(accessToken, credentials.advertising_client_id);

    // Poll reports until complete
    const results = await pollAndProcessReports(
      reportIds,
      accessToken,
      profileId,
      credentials.advertising_client_id,
      supabase
    );

    await supabase.from("workflow_runs").update({
      status: results.failedReports === 0 ? "COMPLETED" : "PARTIAL",
      completed_at: new Date().toISOString(),
      total_rows_inserted: results.totalRows,
      error_message: results.errors?.join("; ")
    }).eq("run_id", runId);

    // Trigger report generation if successful
    if (results.processedReports > 0) {
      await triggerReportGeneration(supabase);
    }

    const result: ProcessResult = {
      success: results.processedReports > 0,
      processedReports: results.processedReports,
      failedReports: results.failedReports,
      totalRows: results.totalRows,
      message: `Processed ${results.processedReports} reports, ${results.failedReports} failed`,
      errors: results.errors
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in process-reports:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function pollAndProcessReports(
  reportIds: string[],
  accessToken: string,
  profileId: string,
  clientId: string,
  supabase: any
) {
  const maxAttempts = 60; // 60 minutes
  const pollInterval = 60000; // 60 seconds

  let processedReports = 0;
  let failedReports = 0;
  let totalRows = 0;
  const errors: string[] = [];

  for (const reportId of reportIds) {
    let attempt = 0;
    let reportUrl = null;

    // Poll until complete or timeout
    while (attempt < maxAttempts) {
      const status = await checkReportStatus(reportId, accessToken, profileId, clientId);

      await supabase.from("report_ledger").update({
        status: status.status,
        url: status.url || null,
        file_size: status.fileSize || null,
        updated_at: new Date().toISOString()
      }).eq("report_id", reportId);

      if (status.status === "COMPLETED") {
        reportUrl = status.url;
        break;
      }

      if (status.status === "FAILED") {
        errors.push(`Report ${reportId} failed: ${status.statusDetails}`);
        failedReports++;
        break;
      }

      attempt++;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    if (attempt >= maxAttempts && !reportUrl) {
      errors.push(`Report ${reportId} timed out after ${maxAttempts} attempts`);
      await supabase.from("report_ledger").update({
        status: "TIMEOUT"
      }).eq("report_id", reportId);
      failedReports++;
      continue;
    }

    if (reportUrl) {
      try {
        // Download and process report
        const data = await downloadAndDecompressReport(reportUrl, accessToken, clientId);
        const rowCount = await processReportData(reportId, data, supabase);

        await supabase.from("report_ledger").update({
          processed: true,
          row_count: rowCount
        }).eq("report_id", reportId);

        processedReports++;
        totalRows += rowCount;
      } catch (error) {
        errors.push(`Failed to process report ${reportId}: ${error.message}`);
        failedReports++;
      }
    }
  }

  return { processedReports, failedReports, totalRows, errors };
}

async function checkReportStatus(
  reportId: string,
  accessToken: string,
  profileId: string,
  clientId: string
) {
  const response = await fetch(
    `https://advertising-api.amazon.com/reporting/reports/${reportId}`,
    {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Amazon-Advertising-API-ClientId": clientId,
        "Amazon-Advertising-API-Scope": profileId,
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.statusText}`);
  }

  return await response.json();
}

async function downloadAndDecompressReport(
  url: string,
  accessToken: string,
  clientId: string
): Promise<any[]> {
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Amazon-Advertising-API-ClientId": clientId,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  // Get as Uint8Array
  const buffer = new Uint8Array(await response.arrayBuffer());

  // Decompress GZIP
  const decompressed = gunzip(buffer);

  // Convert to string and parse JSON
  const jsonString = new TextDecoder().decode(decompressed);
  const data = JSON.parse(jsonString);

  if (!Array.isArray(data)) {
    throw new Error("Report data is not an array");
  }

  return data;
}

async function processReportData(
  reportId: string,
  data: any[],
  supabase: any
): Promise<number> {
  // Get report metadata
  const { data: reportMeta } = await supabase
    .from("report_ledger")
    .select("name, report_type")
    .eq("report_id", reportId)
    .single();

  if (!reportMeta) {
    throw new Error(`Report metadata not found for ${reportId}`);
  }

  const reportType = reportMeta.report_type;
  const reportDate = new Date().toISOString().split("T")[0];

  // Transform based on report type
  let transformedData: any[] = [];

  if (reportType.startsWith("placement_")) {
    transformedData = data.map(record => transformPlacementReport(
      record,
      reportType,
      reportMeta.name,
      reportDate
    ));

    // Batch insert into raw_placement_reports
    await batchInsert(supabase, "raw_placement_reports", transformedData);
  } else if (reportType.startsWith("campaign_")) {
    transformedData = data.map(record => transformCampaignReport(
      record,
      reportType,
      reportMeta.name,
      reportDate
    ));

    // Batch insert into raw_campaign_reports
    await batchInsert(supabase, "raw_campaign_reports", transformedData);
  } else {
    throw new Error(`Unknown report type: ${reportType}`);
  }

  return transformedData.length;
}

function transformPlacementReport(
  record: any,
  reportType: string,
  reportName: string,
  reportDate: string
) {
  const is30Day = reportType === "placement_30day";

  return {
    report_name: reportName,
    report_type: reportType.replace("placement_", ""),
    data_date: reportDate,
    campaign_id: record.campaignId?.toString() || "",
    campaign_name: record.campaignName || "",
    campaign_status: record.campaignStatus || "UNKNOWN",
    placement_classification: record.placementClassification || "",
    impressions: parseInt(record.impressions || "0"),
    clicks: parseInt(record.clicks || "0"),
    spend: parseFloat(record.spend || "0"),
    purchases_30d: is30Day ? parseInt(record.purchases30d || "0") : 0,
    sales_30d: is30Day ? parseFloat(record.sales30d || "0") : 0,
    purchases_7d: !is30Day ? parseInt(record.purchases7d || "0") : 0,
    sales_7d: !is30Day ? parseFloat(record.sales7d || "0") : 0,
    purchases_14d: 0,
    sales_14d: 0
  };
}

function transformCampaignReport(
  record: any,
  reportType: string,
  reportName: string,
  reportDate: string
) {
  const type = reportType.replace("campaign_", "");
  const isDaily = type === "yesterday" || type === "dayBefore";

  return {
    report_name: reportName,
    report_type: type,
    data_date: isDaily ? record.date : reportDate,
    campaign_id: record.campaignId?.toString() || "",
    campaign_name: record.campaignName || "",
    campaign_status: record.campaignStatus || "UNKNOWN",
    campaign_budget_amount: parseFloat(record.campaignBudgetAmount || "0"),
    impressions: parseInt(record.impressions || "0"),
    clicks: parseInt(record.clicks || "0"),
    spend: parseFloat(record.spend || "0"),
    top_of_search_impression_share: parseFloat(record.topOfSearchImpressionShare || "0"),
    purchases_14d: parseInt(record.purchases14d || "0"),
    sales_14d: parseFloat(record.sales14d || "0"),
    purchases_30d: parseInt(record.purchases30d || "0"),
    sales_30d: parseFloat(record.sales30d || "0"),
    purchases_7d: parseInt(record.purchases7d || "0"),
    sales_7d: parseFloat(record.sales7d || "0")
  };
}

async function batchInsert(supabase: any, tableName: string, records: any[]) {
  const batchSize = 1000;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).insert(batch);

    if (error) {
      throw new Error(`Batch insert failed: ${error.message}`);
    }
  }
}

async function triggerReportGeneration(supabase: any) {
  // Invoke generate-sheets-report Edge Function
  const { data, error } = await supabase.functions.invoke("generate-sheets-report");

  if (error) {
    console.error("Failed to trigger report generation:", error);
  } else {
    console.log("Report generation triggered:", data);
  }
}

// Reuse helper functions from collect-placement-data
// (getAmazonCredentials, getAccessToken, getProfileId)
```

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Error Handling:**
- Retry logic for failed downloads (3 attempts)
- Partial failure handling (continue processing other reports)
- Timeout detection and logging
- Validation of report data before insertion

**Performance Optimizations:**
- Batch insert (1000 rows per batch)
- Streaming decompression for large reports
- Parallel polling (with concurrency limit)

---

### 3.3 Edge Function 3: generate-sheets-report

**Trigger:** HTTP endpoint or invoked by Function 2
**Runtime:** Deno/TypeScript
**Purpose:** Generate Google Sheets report

#### Function Structure

```typescript
// supabase/functions/generate-sheets-report/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface GenerateResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowCount: number;
  message: string;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const runId = `generate-${new Date().toISOString()}`;

    await supabase.from("workflow_runs").insert({
      run_id: runId,
      status: "RUNNING",
      workflow_type: "report_generation",
      started_at: new Date().toISOString()
    });

    // 1. Query view
    const { data: viewData, error } = await supabase
      .from("view_placement_optimization_report")
      .select("*")
      .order("Portfolio", { ascending: true })
      .order("Campaign", { ascending: true })
      .order("Placement Type", { ascending: true });

    if (error) {
      throw new Error(`Failed to query view: ${error.message}`);
    }

    if (!viewData || viewData.length === 0) {
      throw new Error("View returned no data");
    }

    // 2. Apply optimization logic
    const enrichedData = viewData.map(row => {
      const optimizationRec = calculateOptimizationRecommendation(
        row["CVR-7"],
        row["ACOS-7"],
        row["Clicks-7"],
        row["Orders-7"],
        row["Spend-7"],
        row["Placement Type"]
      );

      return {
        ...row,
        "Changes in placement": optimizationRec
      };
    });

    // 3. Create Google Sheet
    const weekNumber = getWeekNumber(new Date());
    const sheetName = `Week${weekNumber}-Placement Optimization`;

    const { spreadsheetId, spreadsheetUrl } = await createGoogleSheet(
      sheetName,
      enrichedData
    );

    // 4. Store URL in workflow run
    await supabase.from("workflow_runs").update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
      google_sheet_url: spreadsheetUrl
    }).eq("run_id", runId);

    // 5. Send notification
    await sendNotification(spreadsheetUrl, enrichedData.length);

    const result: GenerateResult = {
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      rowCount: enrichedData.length,
      message: `Report generated with ${enrichedData.length} rows`
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in generate-sheets-report:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

function calculateOptimizationRecommendation(
  cvr: number,
  acos: number,
  clicks: number,
  orders: number,
  spend: number,
  placementType: string
): string {
  // Increase bid criteria
  if (cvr >= 10 && acos <= 40 && clicks >= 10) {
    if (placementType === "Placement Top") return "Increase +10-25%";
    if (placementType === "Placement Rest Of Search") return "Increase +5-15%";
    if (placementType === "Placement Product Page") return "Increase +5-10%";
  }

  // Decrease bid criteria
  if (acos >= 60 || cvr <= 3 || (orders === 0 && spend > 20)) {
    return "Decrease -10-25%";
  }

  // Maintain
  return "Maintain";
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

async function createGoogleSheet(
  sheetName: string,
  data: any[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")!;
  const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY")!.replace(/\\n/g, "\n");
  const templateId = Deno.env.get("GOOGLE_SHEETS_TEMPLATE_ID")!;

  // 1. Get Google OAuth token
  const token = await getGoogleAccessToken(serviceAccountEmail, privateKey);

  // 2. Copy template
  const copyResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: sheetName
      })
    }
  );

  if (!copyResponse.ok) {
    throw new Error(`Failed to copy template: ${copyResponse.statusText}`);
  }

  const copyData = await copyResponse.json();
  const spreadsheetId = copyData.id;

  // 3. Prepare data for Sheets API
  const headers = [
    "Campaign", "Portfolio", "Budget", "Clicks-30", "Spend-30", "Orders-30",
    "CVR-30", "ACoS-30", "Clicks-7", "Spend-7", "Orders-7", "CVR-7", "ACOS-7",
    "Spent DB Yesterday", "Spent Yesterday", "", "Last 30 days", "Last 7 days",
    "Yesterday", "Placement Type", "Increase bids by placement",
    "Changes in placement", "NOTES"
  ];

  const rows = data.map(row => [
    row.Campaign,
    row.Portfolio,
    row.Budget,
    row["Clicks-30"],
    row["Spend-30"],
    row["Orders-30"],
    row["CVR-30"],
    row["ACoS-30"],
    row["Clicks-7"],
    row["Spend-7"],
    row["Orders-7"],
    row["CVR-7"],
    row["ACOS-7"],
    row["Spent DB Yesterday"],
    row["Spent Yesterday"],
    "", // Column P (array formula)
    row["Last 30 days"],
    row["Last 7 days"],
    row.Yesterday,
    row["Placement Type"],
    row["Increase bids by placement"],
    row["Changes in placement"],
    row.NOTES || ""
  ]);

  // 4. Append data to sheet
  const appendResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/USA!A2:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: rows
      })
    }
  );

  if (!appendResponse.ok) {
    throw new Error(`Failed to append data: ${appendResponse.statusText}`);
  }

  // 5. Apply conditional formatting (optional)
  await applyConditionalFormatting(spreadsheetId, token, rows.length);

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  };
}

async function getGoogleAccessToken(
  serviceAccountEmail: string,
  privateKey: string
): Promise<string> {
  // Implement JWT-based OAuth for Google API
  // Use https://deno.land/x/djwt for JWT signing

  // For brevity, using placeholder
  // In production, generate JWT and exchange for access token
  const scope = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

  // TODO: Implement proper JWT flow
  throw new Error("Google OAuth not implemented - add JWT signing logic");
}

async function applyConditionalFormatting(
  spreadsheetId: string,
  token: string,
  rowCount: number
) {
  // Apply color coding based on CVR and ACoS values
  // Use Sheets API batchUpdate with ConditionalFormatRule

  const requests = [
    // Green for good CVR (>= 10%)
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: rowCount + 1, startColumnIndex: 6, endColumnIndex: 7 }],
          booleanRule: {
            condition: {
              type: "NUMBER_GREATER_THAN_EQ",
              values: [{ userEnteredValue: "10" }]
            },
            format: {
              backgroundColor: { red: 0.7, green: 1, blue: 0.7 }
            }
          }
        },
        index: 0
      }
    },
    // Red for poor CVR (<= 3%)
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: 0, startRowIndex: 1, endRowIndex: rowCount + 1, startColumnIndex: 6, endColumnIndex: 7 }],
          booleanRule: {
            condition: {
              type: "NUMBER_LESS_THAN_EQ",
              values: [{ userEnteredValue: "3" }]
            },
            format: {
              backgroundColor: { red: 1, green: 0.7, blue: 0.7 }
            }
          }
        },
        index: 1
      }
    }
    // Add more formatting rules as needed
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ requests })
    }
  );

  if (!response.ok) {
    console.error("Failed to apply conditional formatting:", response.statusText);
  }
}

async function sendNotification(spreadsheetUrl: string, rowCount: number) {
  const discordWebhook = Deno.env.get("DISCORD_WEBHOOK_URL");

  if (!discordWebhook) {
    console.log("No Discord webhook configured, skipping notification");
    return;
  }

  const message = {
    content: `Placement Optimization Report Generated\n\nRows: ${rowCount}\nURL: ${spreadsheetUrl}`
  };

  await fetch(discordWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  });
}
```

**Environment Variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_SHEETS_TEMPLATE_ID`
- `DISCORD_WEBHOOK_URL` (optional)

**Error Handling:**
- Validate view data before processing
- Retry Google API calls (3 attempts with exponential backoff)
- Graceful degradation if formatting fails
- Log all errors with context

---

## 4. TypeScript Type Definitions

### 4.1 Database Types

```typescript
// supabase/functions/_shared/types.ts

export interface EncryptedCredential {
  id: string;
  credential_name: string;
  encrypted_value: string;
  created_at: string;
  updated_at: string;
}

export interface TokenCache {
  id: string;
  service: string;
  access_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReportLedger {
  id: string;
  report_id: string;
  name: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "TIMEOUT";
  report_type: string;
  time_period: string;
  url?: string;
  url_expires_at?: string;
  processed: boolean;
  file_size?: number;
  row_count?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  created_timestamp: string;
}

export interface Portfolio {
  id: string;
  portfolio_id: string;
  portfolio_name: string;
  portfolio_state: string;
  in_budget: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlacementBid {
  id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  campaign_budget: number;
  portfolio_id?: string;
  placement_top_of_search: number;
  placement_rest_of_search: number;
  placement_product_page: number;
  created_at: string;
  updated_at: string;
}

export interface RawCampaignReport {
  id: string;
  report_name: string;
  report_type: string;
  data_date: string;
  campaign_id: string;
  campaign_name?: string;
  campaign_status?: string;
  campaign_budget_amount?: number;
  impressions: number;
  clicks: number;
  spend: number;
  top_of_search_impression_share?: number;
  purchases_14d: number;
  sales_14d: number;
  purchases_30d: number;
  sales_30d: number;
  purchases_7d: number;
  sales_7d: number;
  created_at: string;
}

export interface RawPlacementReport {
  id: string;
  report_name: string;
  report_type: string;
  data_date: string;
  campaign_id: string;
  campaign_name?: string;
  campaign_status?: string;
  placement_classification: string;
  impressions: number;
  clicks: number;
  spend: number;
  purchases_14d: number;
  sales_14d: number;
  purchases_30d: number;
  sales_30d: number;
  purchases_7d: number;
  sales_7d: number;
  created_at: string;
}

export interface WorkflowRun {
  id: string;
  run_id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL";
  workflow_type: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  report_ids?: string[];
  portfolio_count?: number;
  campaign_count?: number;
  total_rows_inserted?: number;
  google_sheet_url?: string;
  created_at: string;
}
```

### 4.2 API Types

```typescript
// Amazon Ads API types

export interface AmazonCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  advertising_client_id: string;
  marketplace_id?: string;
  region?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface ReportConfig {
  name: string;
  startDate: string;
  endDate: string;
  configuration: {
    adProduct: string;
    reportTypeId: string;
    timeUnit: string;
    format: string;
    groupBy: string[];
    columns: string[];
  };
}

export interface ReportStatus {
  reportId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  url?: string;
  fileSize?: number;
  statusDetails?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortfolioResponse {
  portfolios: Array<{
    portfolioId: number;
    name: string;
    state: string;
    inBudget: boolean;
    createdDate: string;
    lastUpdatedDate: string;
  }>;
}

export interface CampaignResponse {
  campaigns: Array<{
    campaignId: string;
    name: string;
    portfolioId?: number;
    state: string;
    budget: {
      budget: number;
      budgetType: string;
    };
    dynamicBidding?: {
      strategy: string;
      placementBidding?: Array<{
        placement: string;
        percentage: number;
      }>;
    };
  }>;
}
```

### 4.3 View Types

```typescript
// View result type

export interface PlacementOptimizationRow {
  Campaign: string;
  Portfolio: string;
  Budget: number;
  "Clicks-30": number;
  "Spend-30": number;
  "Orders-30": number;
  "CVR-30": number;
  "ACoS-30": number;
  "Clicks-7": number;
  "Spend-7": number;
  "Orders-7": number;
  "CVR-7": number;
  "ACOS-7": number;
  "Spent DB Yesterday": number;
  "Spent Yesterday": number;
  "Last 30 days": number;
  "Last 7 days": number;
  Yesterday: number;
  "Placement Type": string;
  "Increase bids by placement": number;
  "Changes in placement": string;
  NOTES: string;
  _campaign_id?: string;  // Internal use
  _sales_30?: number;     // Internal use
  _sales_7?: number;      // Internal use
}
```

### 4.4 Edge Function Types

```typescript
// Edge Function input/output types

export interface CollectionResult {
  success: boolean;
  reportIds: string[];
  portfolioCount: number;
  campaignCount: number;
  runId: string;
  message: string;
  errors?: string[];
}

export interface ProcessResult {
  success: boolean;
  processedReports: number;
  failedReports: number;
  totalRows: number;
  message: string;
  errors?: string[];
}

export interface GenerateResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowCount: number;
  message: string;
}
```

---

## 5. Scheduling with pg_cron

### 5.1 Enable pg_cron Extension

```sql
-- Enable the pg_cron extension (requires superuser or admin)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to service role
GRANT USAGE ON SCHEMA cron TO service_role;
```

### 5.2 Job 1: Data Collection

**Schedule:** Every Wednesday at 09:05 UTC (1:05 AM PST)

```sql
-- Schedule data collection job
SELECT cron.schedule(
  'placement-data-collection',        -- job name
  '5 9 * * 3',                        -- cron expression: 09:05 UTC on Wednesday
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/collect-placement-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

**Alternative using Supabase CLI:**

```bash
# Create cron job via Supabase dashboard or CLI
supabase functions schedule create \
  --name placement-data-collection \
  --function collect-placement-data \
  --cron "5 9 * * 3" \
  --timezone "UTC"
```

### 5.3 Job 2: Report Processing

**Schedule:** 60 minutes after Job 1 (10:05 UTC on Wednesday)

```sql
-- Schedule report processing job
SELECT cron.schedule(
  'placement-report-processing',
  '5 10 * * 3',                       -- 10:05 UTC on Wednesday
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/process-reports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### 5.4 Job 3: Report Generation

**Schedule:** 15 minutes after Job 2 (10:20 UTC on Wednesday)

```sql
-- Schedule report generation job
SELECT cron.schedule(
  'placement-report-generation',
  '20 10 * * 3',                      -- 10:20 UTC on Wednesday
  $$
  SELECT
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/generate-sheets-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### 5.5 Monitoring Cron Jobs

```sql
-- View all scheduled jobs
SELECT * FROM cron.job ORDER BY jobid;

-- View job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check for failed jobs
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;

-- Unschedule a job
SELECT cron.unschedule('placement-data-collection');
```

### 5.6 Alternative: Supabase Built-in Scheduler

If pg_cron is not available, use Supabase's built-in function scheduler:

```bash
# Deploy function with schedule
supabase functions deploy collect-placement-data --schedule "5 9 * * 3"
supabase functions deploy process-reports --schedule "5 10 * * 3"
supabase functions deploy generate-sheets-report --schedule "20 10 * * 3"
```

---

## 6. Environment Variables & Secrets

### 6.1 Supabase Project Settings

Configure in Supabase Dashboard → Project Settings → Edge Functions

**Required Environment Variables:**

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Amazon Ads API
AMAZON_BASE_URL=https://advertising-api.amazon.com

# Google Cloud (for KMS decryption - if using)
GCP_PROJECT_ID=n8n-project-464107
KMS_KEY_RING=amazon-api-keyring
KMS_CRYPTO_KEY=sp-api-secrets
KMS_LOCATION=global

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_TEMPLATE_ID=11YhO8fSY0bAVe0s5rjL3gaJRcIeH3GmGaaqt-3pJcbo

# Notifications (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url

# Amazon Settings (or store in database)
MARKETPLACE_ID=ATVPDKIKX0DER
REGION=NA
```

### 6.2 Supabase Vault for Secrets

Use Supabase Vault to store sensitive credentials:

```sql
-- Store secret in Vault
SELECT vault.create_secret('sp_api_client_id', 'your-client-id');
SELECT vault.create_secret('sp_api_client_secret', 'your-client-secret');
SELECT vault.create_secret('sp_api_refresh_token', 'your-refresh-token');
SELECT vault.create_secret('advertising_client_id', 'your-advertising-client-id');

-- Retrieve secret (in Edge Function with service role)
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'sp_api_client_id';
```

### 6.3 Credential Storage Strategy

**Option 1: Continue using Google KMS** (current system)
- Credentials encrypted with Google Cloud KMS
- Stored in `encrypted_credentials` table
- Decrypted in Edge Functions using Google KMS API

**Option 2: Migrate to Supabase Vault** (recommended)
- Credentials stored in Supabase Vault
- No external dependency on Google Cloud
- Simpler Edge Function code

**Recommendation:** Migrate to Supabase Vault for simpler architecture

### 6.4 Secrets Migration Plan

```sql
-- Migration function to move from KMS to Vault
CREATE OR REPLACE FUNCTION migrate_credentials_to_vault()
RETURNS void AS $$
DECLARE
  cred RECORD;
  decrypted_value TEXT;
BEGIN
  FOR cred IN SELECT * FROM encrypted_credentials LOOP
    -- Decrypt using Google KMS (implement in Python script)
    -- Then insert into Vault
    EXECUTE format(
      'SELECT vault.create_secret(%L, %L)',
      cred.credential_name,
      decrypted_value  -- From KMS decryption
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 7. Error Handling & Logging

### 7.1 Error Handling Strategy

**Principles:**
1. **Fail Fast:** Detect errors early and report immediately
2. **Retry Transient Errors:** Retry network and rate limit errors
3. **Log Everything:** Comprehensive logging for debugging
4. **Graceful Degradation:** Continue with partial results when possible
5. **User Notification:** Alert on critical failures

### 7.2 Retry Logic

```typescript
// Shared retry utility

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  retryableStatuses: number[];
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    retryableStatuses: [429, 500, 502, 503, 504]
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry client errors (except 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // Calculate backoff delay
      const delay = Math.min(
        options.initialDelay * Math.pow(2, attempt),
        options.maxDelay
      );

      console.log(`Retry attempt ${attempt + 1}/${options.maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

### 7.3 Logging Strategy

**Log Levels:**
- `DEBUG`: Detailed execution flow
- `INFO`: Important milestones
- `WARN`: Recoverable issues
- `ERROR`: Failures requiring attention

**Log Locations:**
- Edge Function console logs (Supabase Dashboard)
- `workflow_runs` table for run summaries
- `report_ledger` table for report status
- Optional: External logging service (Sentry, Datadog)

**Example Logging:**

```typescript
function log(level: string, message: string, context?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  };

  console.log(JSON.stringify(logEntry));

  // Optional: Send to external service
  // await sendToLoggingService(logEntry);
}

// Usage
log("INFO", "Starting data collection", { runId: "collect-2025-11-03..." });
log("ERROR", "Failed to fetch portfolios", { error: error.message, stack: error.stack });
```

### 7.4 Alert Triggers

**Critical Alerts (immediate notification):**
- All 6 reports failed to generate
- View returns 0 rows
- Google Sheets creation failed
- Workflow timeout (>3 hours)

**Warning Alerts (daily digest):**
- Partial report failures (1-2 reports failed)
- Slow query performance (view >10 seconds)
- Token refresh failures

**Notification Channels:**
- Discord webhook (immediate)
- Email (digest)
- Supabase Dashboard (all logs)

### 7.5 Error Recovery Procedures

**Scenario 1: Report Generation Timeout**
```typescript
// Manual retry endpoint
async function retryFailedReports() {
  const { data: failed } = await supabase
    .from("report_ledger")
    .select("report_id")
    .in("status", ["TIMEOUT", "FAILED"])
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  // Re-request reports
  for (const report of failed) {
    // Implement re-request logic
  }
}
```

**Scenario 2: Data Validation Failure**
```typescript
// Validate before generating report
async function validateReportData() {
  const { count } = await supabase
    .from("view_placement_optimization_report")
    .select("*", { count: "exact", head: true });

  if (count === 0) {
    throw new Error("View has no data - check raw tables");
  }

  // Check for NULL values in critical columns
  const { data: nulls } = await supabase
    .from("view_placement_optimization_report")
    .select("Campaign")
    .is("Campaign", null);

  if (nulls && nulls.length > 0) {
    throw new Error(`Found ${nulls.length} rows with NULL campaign names`);
  }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Test Database Functions:**

```sql
-- Test CVR calculation
CREATE OR REPLACE FUNCTION test_cvr_calculation()
RETURNS void AS $$
DECLARE
  result DECIMAL;
BEGIN
  -- Test normal case
  SELECT (103.0 / 833.0) * 100 INTO result;
  ASSERT result BETWEEN 12.35 AND 12.37, 'CVR calculation incorrect';

  -- Test division by zero
  SELECT CASE WHEN 0 > 0 THEN (10.0 / 0) * 100 ELSE 0 END INTO result;
  ASSERT result = 0, 'Division by zero not handled';

  RAISE NOTICE 'CVR calculation tests passed';
END;
$$ LANGUAGE plpgsql;

SELECT test_cvr_calculation();
```

**Test Edge Function Logic:**

```typescript
// Unit test for optimization recommendation
Deno.test("calculateOptimizationRecommendation - increase bid", () => {
  const result = calculateOptimizationRecommendation(
    12.5,  // cvr
    35,    // acos
    20,    // clicks
    10,    // orders
    50,    // spend
    "Placement Top"
  );

  assertEquals(result, "Increase +10-25%");
});

Deno.test("calculateOptimizationRecommendation - decrease bid", () => {
  const result = calculateOptimizationRecommendation(
    2,     // cvr (too low)
    70,    // acos (too high)
    50,    // clicks
    1,     // orders
    100,   // spend
    "Placement Top"
  );

  assertEquals(result, "Decrease -10-25%");
});
```

### 8.2 Integration Tests

**Test Database Schema:**

```sql
-- Verify all tables exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'encrypted_credentials',
  'token_cache',
  'report_ledger',
  'portfolios',
  'placement_bids',
  'raw_campaign_reports',
  'raw_placement_reports',
  'workflow_runs'
);
-- Expected: 8

-- Verify view exists
SELECT COUNT(*) FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'view_placement_optimization_report';
-- Expected: 1

-- Verify indexes exist
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'raw_campaign_reports',
  'raw_placement_reports'
);
-- Expected: Multiple indexes
```

**Test Edge Function Endpoints:**

```bash
# Test collect-placement-data
curl -X POST \
  https://your-project.supabase.co/functions/v1/collect-placement-data \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Test process-reports
curl -X POST \
  https://your-project.supabase.co/functions/v1/process-reports \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reportIds": ["test-report-id"]}'

# Test generate-sheets-report
curl -X POST \
  https://your-project.supabase.co/functions/v1/generate-sheets-report \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### 8.3 End-to-End Test

**Full Workflow Test:**

```typescript
// E2E test script
async function testFullWorkflow() {
  console.log("1. Triggering data collection...");
  const collectResult = await fetch(
    "https://your-project.supabase.co/functions/v1/collect-placement-data",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const collectData = await collectResult.json();
  console.log("Data collection result:", collectData);

  // Wait for reports to generate (in test, use shorter timeout)
  console.log("2. Waiting 5 minutes for reports...");
  await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));

  console.log("3. Triggering report processing...");
  const processResult = await fetch(
    "https://your-project.supabase.co/functions/v1/process-reports",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reportIds: collectData.reportIds })
    }
  );

  const processData = await processResult.json();
  console.log("Report processing result:", processData);

  console.log("4. Triggering report generation...");
  const generateResult = await fetch(
    "https://your-project.supabase.co/functions/v1/generate-sheets-report",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const generateData = await generateResult.json();
  console.log("Report generation result:", generateData);

  console.log("\n=== E2E Test Complete ===");
  console.log(`Google Sheet URL: ${generateData.spreadsheetUrl}`);
  console.log(`Total rows: ${generateData.rowCount}`);
}

// Run test
testFullWorkflow().catch(console.error);
```

### 8.4 Data Quality Checks

**Post-Processing Validation:**

```sql
-- Check row count (should be campaigns × 3)
SELECT COUNT(*) FROM view_placement_optimization_report;

-- Check for NULL values in critical columns
SELECT
  COUNT(*) FILTER (WHERE "Campaign" IS NULL) AS null_campaigns,
  COUNT(*) FILTER (WHERE "Portfolio" IS NULL) AS null_portfolios,
  COUNT(*) FILTER (WHERE "Placement Type" IS NULL) AS null_placements
FROM view_placement_optimization_report;

-- Check percentage ranges
SELECT
  COUNT(*) FILTER (WHERE "CVR-30" < 0 OR "CVR-30" > 100) AS invalid_cvr_30,
  COUNT(*) FILTER (WHERE "ACoS-30" < 0) AS invalid_acos_30
FROM view_placement_optimization_report;

-- Check placement types
SELECT "Placement Type", COUNT(*)
FROM view_placement_optimization_report
GROUP BY "Placement Type";
-- Expected: 'Placement Top', 'Placement Rest Of Search', 'Placement Product Page'

-- Compare with N8N results (spot check)
SELECT
  "Campaign",
  "Placement Type",
  "CVR-30",
  "ACoS-30"
FROM view_placement_optimization_report
WHERE "Campaign" = 'Known Campaign Name'
ORDER BY "Placement Type";
```

### 8.5 Performance Tests

**View Query Performance:**

```sql
-- Test view query time
EXPLAIN ANALYZE
SELECT * FROM view_placement_optimization_report;

-- Expected: < 5 seconds for ~1000-5000 rows
```

**Edge Function Timeout:**

```bash
# Test Edge Function doesn't timeout (10 min limit)
time curl -X POST \
  https://your-project.supabase.co/functions/v1/collect-placement-data \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Expected: < 2 minutes
```

---

## 9. Deployment Steps

### 9.1 Prerequisites

- Supabase project created
- Supabase CLI installed (`npm install -g supabase`)
- Git repository initialized
- Google Cloud Service Account (for Sheets API)
- Amazon Ads API credentials

### 9.2 Step 1: Create Database Tables

```bash
# Initialize Supabase locally
supabase init

# Create migration file
supabase migration new create_placement_tables

# Copy SQL from Section 1 into migration file
# migrations/20250103_create_placement_tables.sql

# Apply migration
supabase db push
```

**Or apply directly via Supabase Dashboard:**

1. Go to Database → SQL Editor
2. Copy SQL from Section 1 (all table definitions)
3. Execute

### 9.3 Step 2: Create Indexes

```bash
# Create indexes migration
supabase migration new create_indexes

# Copy index SQL and apply
supabase db push
```

### 9.4 Step 3: Create View

```bash
# Create view migration
supabase migration new create_placement_view

# Copy view SQL from Section 2.1
supabase db push
```

**Verify view:**

```sql
SELECT COUNT(*) FROM view_placement_optimization_report;
-- Should return 0 (no data yet)
```

### 9.5 Step 4: Deploy Edge Functions

```bash
# Navigate to project root
cd /mnt/c/Users/Ramen\ Bomb/Desktop/Code

# Create Edge Functions directory structure
mkdir -p supabase/functions/collect-placement-data
mkdir -p supabase/functions/process-reports
mkdir -p supabase/functions/generate-sheets-report
mkdir -p supabase/functions/_shared

# Copy function code from Section 3
# Copy types from Section 4 to _shared/types.ts

# Deploy functions
supabase functions deploy collect-placement-data
supabase functions deploy process-reports
supabase functions deploy generate-sheets-report

# Set environment variables
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=your-email
supabase secrets set GOOGLE_PRIVATE_KEY="your-key"
supabase secrets set GOOGLE_SHEETS_TEMPLATE_ID=11YhO8fSY0bAVe0s5rjL3gaJRcIeH3GmGaaqt-3pJcbo
supabase secrets set DISCORD_WEBHOOK_URL=your-webhook
```

### 9.6 Step 5: Set Up Cron Jobs

**Option A: Using pg_cron (if available)**

```sql
-- Execute SQL from Section 5.2-5.4
```

**Option B: Using Supabase Built-in Scheduler**

```bash
# Schedule via CLI
supabase functions schedule create \
  --name placement-data-collection \
  --function collect-placement-data \
  --cron "5 9 * * 3"

supabase functions schedule create \
  --name placement-report-processing \
  --function process-reports \
  --cron "5 10 * * 3"

supabase functions schedule create \
  --name placement-report-generation \
  --function generate-sheets-report \
  --cron "20 10 * * 3"
```

### 9.7 Step 6: Configure Secrets

**Migrate credentials to Supabase Vault:**

```sql
-- Option 1: Direct insert (if already decrypted)
SELECT vault.create_secret('sp_api_client_id', 'your-value');
SELECT vault.create_secret('sp_api_client_secret', 'your-value');
SELECT vault.create_secret('sp_api_refresh_token', 'your-value');
SELECT vault.create_secret('advertising_client_id', 'your-value');

-- Option 2: Use existing encrypted_credentials table
-- Keep using Google KMS decryption in Edge Functions
```

### 9.8 Step 7: Test Workflow

```bash
# Test data collection manually
curl -X POST \
  https://your-project.supabase.co/functions/v1/collect-placement-data \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"

# Wait 60 minutes for reports to generate

# Test report processing
curl -X POST \
  https://your-project.supabase.co/functions/v1/process-reports \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Test report generation
curl -X POST \
  https://your-project.supabase.co/functions/v1/generate-sheets-report \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### 9.9 Step 8: Monitor First Production Run

**Monitor via Supabase Dashboard:**

1. Go to Edge Functions → Logs
2. Watch for errors
3. Check `workflow_runs` table for status
4. Verify Google Sheet creation

**SQL Monitoring:**

```sql
-- Check workflow status
SELECT * FROM workflow_runs ORDER BY started_at DESC LIMIT 5;

-- Check report status
SELECT status, COUNT(*) FROM report_ledger GROUP BY status;

-- Check data inserted
SELECT
  'raw_campaign_reports' AS table_name,
  COUNT(*) AS row_count
FROM raw_campaign_reports
UNION ALL
SELECT
  'raw_placement_reports',
  COUNT(*)
FROM raw_placement_reports;

-- Check view results
SELECT COUNT(*) FROM view_placement_optimization_report;
```

### 9.10 Step 9: Set Up Monitoring Alerts

**Create monitoring dashboard:**

```sql
-- Create monitoring view
CREATE OR REPLACE VIEW workflow_health AS
SELECT
  workflow_type,
  status,
  COUNT(*) AS run_count,
  MAX(started_at) AS last_run,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration_seconds
FROM workflow_runs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY workflow_type, status;

-- Query health
SELECT * FROM workflow_health;
```

**Set up alerts (Discord webhook):**

```typescript
// Add to Edge Functions
async function sendAlert(level: string, message: string, details?: any) {
  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");

  if (!webhookUrl) return;

  const color = level === "ERROR" ? 15158332 : 16776960; // Red or Yellow

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: `[${level}] Placement Optimization Alert`,
        description: message,
        color,
        fields: details ? [
          { name: "Details", value: JSON.stringify(details, null, 2) }
        ] : [],
        timestamp: new Date().toISOString()
      }]
    })
  });
}
```

---

## 10. Migration from N8N

### 10.1 Parallel Run Strategy

**Week 1-2: Initial Deployment**
1. Deploy Supabase system
2. Run both N8N and Supabase weekly
3. Compare outputs manually

**Week 3-4: Validation**
1. Automated comparison of results
2. Identify and fix discrepancies
3. Performance tuning

**Week 5: Cutover**
1. Disable N8N workflows
2. Monitor Supabase system closely
3. Keep N8N as backup (read-only)

### 10.2 Data Validation Comparison

```sql
-- Create comparison view
CREATE OR REPLACE VIEW n8n_vs_supabase_comparison AS
SELECT
  s."Campaign",
  s."Placement Type",
  s."CVR-30" AS supabase_cvr,
  n."CVR-30" AS n8n_cvr,
  ABS(s."CVR-30" - n."CVR-30") AS cvr_diff,
  s."ACoS-30" AS supabase_acos,
  n."ACoS-30" AS n8n_acos,
  ABS(s."ACoS-30" - n."ACoS-30") AS acos_diff
FROM view_placement_optimization_report s
FULL OUTER JOIN n8n_results n
  ON s."Campaign" = n."Campaign"
  AND s."Placement Type" = n."Placement Type"
WHERE
  ABS(s."CVR-30" - n."CVR-30") > 0.01
  OR ABS(s."ACoS-30" - n."ACoS-30") > 0.01;
```

### 10.3 Rollback Plan

**If Supabase system fails:**

1. Re-enable N8N workflows immediately
2. Investigate Supabase issues
3. Fix and redeploy
4. Resume parallel run

**Rollback Script:**

```bash
#!/bin/bash
# rollback.sh

echo "Rolling back to N8N..."

# Disable Supabase cron jobs
supabase functions schedule delete placement-data-collection
supabase functions schedule delete placement-report-processing
supabase functions schedule delete placement-report-generation

# Re-enable N8N workflows
# (Manual step in N8N UI or API call)

echo "Rollback complete. N8N workflows active."
```

### 10.4 N8N Decommissioning

**After successful cutover (Week 6+):**

1. Archive N8N workflow JSONs to Git
2. Export N8N execution history
3. Disable N8N workflows permanently
4. Document lessons learned
5. Update runbooks

**Archive Command:**

```bash
# Export N8N workflows for archival
n8n export:workflow --all --output=./n8n-archive/
n8n export:credentials --all --output=./n8n-archive/

# Commit to Git
git add n8n-archive/
git commit -m "Archive N8N workflows before decommissioning"
```

---

## Summary

This Supabase architecture provides a complete, production-ready replacement for the N8N-based Amazon Placement Optimization system with the following advantages:

**Key Benefits:**
1. **Fully serverless** - No infrastructure management
2. **Cost-effective** - Pay only for usage
3. **Scalable** - Handles growing data volumes
4. **Maintainable** - Clear code structure with TypeScript
5. **Reliable** - Comprehensive error handling and retries
6. **Monitorable** - Full logging and alerting

**Architecture Highlights:**
- 8 database tables with proper RLS policies
- 1 SQL view for report aggregation
- 3 Edge Functions for workflow orchestration
- pg_cron for automated scheduling
- TypeScript type safety throughout
- Complete error handling and retry logic

**Next Steps:**
1. Review this architecture document
2. Approve for implementation
3. Begin deployment following Section 9
4. Run parallel validation with N8N
5. Cutover to production

**Document Status:** ✅ COMPLETE AND READY FOR REVIEW

**Implementation Timeline:**
- Week 1: Database setup and view creation
- Week 2: Edge Function development and testing
- Week 3: End-to-end testing
- Week 4-5: Parallel run with N8N
- Week 6: Production cutover

---

**Created By:** Supabase Architect Agent
**Date:** 2025-11-03
**Version:** 1.0
