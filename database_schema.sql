-- ============================================================================
-- Amazon Placement Optimization System - Database Schema
-- ============================================================================
-- Purpose: Create all database tables, indexes, and views for the placement
--          optimization reporting system using Supabase
-- Version: 1.0
-- Date: 2025-11-03
-- ============================================================================

-- ============================================================================
-- SECTION 1: HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 2: CORE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: token_cache
-- Purpose: Cache OAuth access tokens to minimize API calls
-- ----------------------------------------------------------------------------
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

-- Index for service lookup
CREATE INDEX IF NOT EXISTS idx_token_cache_service
  ON token_cache(service);

-- Index for expiration checks
CREATE INDEX IF NOT EXISTS idx_token_cache_expires_at
  ON token_cache(expires_at);

-- Trigger to update updated_at
CREATE TRIGGER update_token_cache_updated_at
  BEFORE UPDATE ON token_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE token_cache IS 'Caches OAuth access tokens with expiration';
COMMENT ON COLUMN token_cache.service IS 'Service name (e.g., amazon_advertising_api)';
COMMENT ON COLUMN token_cache.access_token IS 'OAuth access token';
COMMENT ON COLUMN token_cache.expires_at IS 'Token expiration timestamp';

-- ----------------------------------------------------------------------------
-- Table: report_ledger
-- Purpose: Track all report requests, statuses, and URLs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  url TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE report_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role and authenticated users can read
CREATE POLICY "Service role and authenticated users" ON report_ledger
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- RLS Policy: Only service role can insert/update
CREATE POLICY "Service role can modify" ON report_ledger
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for report_id lookup
CREATE INDEX IF NOT EXISTS idx_report_ledger_report_id
  ON report_ledger(report_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_report_ledger_status
  ON report_ledger(status);

-- Index for report_type filtering
CREATE INDEX IF NOT EXISTS idx_report_ledger_type
  ON report_ledger(report_type);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_report_ledger_requested_at
  ON report_ledger(requested_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_report_ledger_updated_at
  BEFORE UPDATE ON report_ledger
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE report_ledger IS 'Tracks all Amazon API report requests and their status';
COMMENT ON COLUMN report_ledger.report_id IS 'Amazon API report ID';
COMMENT ON COLUMN report_ledger.report_type IS 'Type: placement_30d, campaign_7d, etc.';
COMMENT ON COLUMN report_ledger.status IS 'Status: PENDING, IN_PROGRESS, SUCCESS, FAILED';

-- ----------------------------------------------------------------------------
-- Table: portfolios
-- Purpose: Store portfolio ID to name mapping
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id BIGINT UNIQUE NOT NULL,
  portfolio_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role and authenticated users can read
CREATE POLICY "Service role and authenticated users" ON portfolios
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- RLS Policy: Only service role can modify
CREATE POLICY "Service role can modify" ON portfolios
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for portfolio_id lookup
CREATE INDEX IF NOT EXISTS idx_portfolios_portfolio_id
  ON portfolios(portfolio_id);

-- Trigger to update updated_at
CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE portfolios IS 'Maps portfolio IDs to portfolio names';

-- ----------------------------------------------------------------------------
-- Table: placement_bids
-- Purpose: Store current placement bid adjustments for campaigns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS placement_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id BIGINT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT,
  campaign_budget DECIMAL(10,2),
  portfolio_id BIGINT,
  placement_top_of_search INTEGER,
  placement_rest_of_search INTEGER,
  placement_product_page INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE placement_bids ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role and authenticated users can read
CREATE POLICY "Service role and authenticated users" ON placement_bids
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- RLS Policy: Only service role can modify
CREATE POLICY "Service role can modify" ON placement_bids
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for campaign_id lookup
CREATE INDEX IF NOT EXISTS idx_placement_bids_campaign_id
  ON placement_bids(campaign_id);

-- Index for portfolio_id lookup (foreign key)
CREATE INDEX IF NOT EXISTS idx_placement_bids_portfolio_id
  ON placement_bids(portfolio_id);

-- Trigger to update updated_at
CREATE TRIGGER update_placement_bids_updated_at
  BEFORE UPDATE ON placement_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE placement_bids IS 'Current placement bid adjustment percentages per campaign';
COMMENT ON COLUMN placement_bids.placement_top_of_search IS 'Bid adjustment % for Top of Search';
COMMENT ON COLUMN placement_bids.placement_rest_of_search IS 'Bid adjustment % for Rest of Search';
COMMENT ON COLUMN placement_bids.placement_product_page IS 'Bid adjustment % for Product Pages';

-- ----------------------------------------------------------------------------
-- Table: raw_campaign_reports
-- Purpose: Store raw campaign performance data from Amazon API
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_campaign_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  campaign_id BIGINT NOT NULL,
  campaign_name TEXT,
  portfolio_id BIGINT,
  campaign_status TEXT,
  campaign_budget DECIMAL(10,2),
  date DATE,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  purchases1d INTEGER DEFAULT 0,
  purchases7d INTEGER DEFAULT 0,
  purchases14d INTEGER DEFAULT 0,
  purchases30d INTEGER DEFAULT 0,
  sales1d DECIMAL(10,2) DEFAULT 0,
  sales7d DECIMAL(10,2) DEFAULT 0,
  sales14d DECIMAL(10,2) DEFAULT 0,
  sales30d DECIMAL(10,2) DEFAULT 0,
  top_of_search_impression_share DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE raw_campaign_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role and authenticated users can read
CREATE POLICY "Service role and authenticated users" ON raw_campaign_reports
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- RLS Policy: Only service role can insert
CREATE POLICY "Service role can insert" ON raw_campaign_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Index for report_id lookup
CREATE INDEX IF NOT EXISTS idx_raw_campaign_reports_report_id
  ON raw_campaign_reports(report_id);

-- Index for campaign_id lookup
CREATE INDEX IF NOT EXISTS idx_raw_campaign_reports_campaign_id
  ON raw_campaign_reports(campaign_id);

-- Index for report_type filtering
CREATE INDEX IF NOT EXISTS idx_raw_campaign_reports_type
  ON raw_campaign_reports(report_type);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_raw_campaign_reports_date
  ON raw_campaign_reports(date DESC);

COMMENT ON TABLE raw_campaign_reports IS 'Raw campaign performance data from Amazon API';
COMMENT ON COLUMN raw_campaign_reports.report_type IS 'campaign_30d, campaign_7d, campaign_yesterday, campaign_day_before';

-- ----------------------------------------------------------------------------
-- Table: raw_placement_reports
-- Purpose: Store raw placement performance data from Amazon API
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raw_placement_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  campaign_id BIGINT NOT NULL,
  campaign_name TEXT,
  portfolio_id BIGINT,
  placement TEXT NOT NULL,
  date DATE,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  purchases1d INTEGER DEFAULT 0,
  purchases7d INTEGER DEFAULT 0,
  purchases14d INTEGER DEFAULT 0,
  purchases30d INTEGER DEFAULT 0,
  sales1d DECIMAL(10,2) DEFAULT 0,
  sales7d DECIMAL(10,2) DEFAULT 0,
  sales14d DECIMAL(10,2) DEFAULT 0,
  sales30d DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE raw_placement_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role and authenticated users can read
CREATE POLICY "Service role and authenticated users" ON raw_placement_reports
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- RLS Policy: Only service role can insert
CREATE POLICY "Service role can insert" ON raw_placement_reports
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Index for report_id lookup
CREATE INDEX IF NOT EXISTS idx_raw_placement_reports_report_id
  ON raw_placement_reports(report_id);

-- Index for campaign_id + placement lookup
CREATE INDEX IF NOT EXISTS idx_raw_placement_reports_campaign_placement
  ON raw_placement_reports(campaign_id, placement);

-- Index for report_type filtering
CREATE INDEX IF NOT EXISTS idx_raw_placement_reports_type
  ON raw_placement_reports(report_type);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_raw_placement_reports_date
  ON raw_placement_reports(date DESC);

COMMENT ON TABLE raw_placement_reports IS 'Raw placement performance data from Amazon API';
COMMENT ON COLUMN raw_placement_reports.placement IS 'Placement: Top of Search (First Page), Placement Product Page, Placement Rest of Search';
COMMENT ON COLUMN raw_placement_reports.report_type IS 'placement_30d, placement_7d';

-- ----------------------------------------------------------------------------
-- Table: workflow_runs
-- Purpose: Track workflow execution for idempotency and debugging
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role and authenticated users can read
CREATE POLICY "Service role and authenticated users" ON workflow_runs
  FOR SELECT
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- RLS Policy: Only service role can modify
CREATE POLICY "Service role can modify" ON workflow_runs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for workflow_name + run_date (unique constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_runs_name_date
  ON workflow_runs(workflow_name, run_date);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON workflow_runs(status);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at
  ON workflow_runs(started_at DESC);

COMMENT ON TABLE workflow_runs IS 'Tracks workflow execution for idempotency and monitoring';
COMMENT ON COLUMN workflow_runs.workflow_name IS 'collect, process, or generate';
COMMENT ON COLUMN workflow_runs.status IS 'RUNNING, SUCCESS, FAILED';
COMMENT ON COLUMN workflow_runs.metadata IS 'Additional execution details (report IDs, counts, etc.)';

-- ============================================================================
-- SECTION 3: COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - token_cache (OAuth token caching)';
  RAISE NOTICE '  - report_ledger (report tracking)';
  RAISE NOTICE '  - portfolios (portfolio mapping)';
  RAISE NOTICE '  - placement_bids (bid adjustments)';
  RAISE NOTICE '  - raw_campaign_reports (campaign data)';
  RAISE NOTICE '  - raw_placement_reports (placement data)';
  RAISE NOTICE '  - workflow_runs (execution tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run create_indexes.sql';
  RAISE NOTICE '  2. Run create_view.sql';
  RAISE NOTICE '  3. Generate TypeScript types';
END $$;
