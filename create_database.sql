-- =====================================================
-- Amazon Placement Optimization - Database Schema
-- Version: 2.0
-- Date: 2025-11-03
-- Purpose: Create complete database structure for placement optimization
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

COMMENT ON TABLE workflow_executions IS 'Tracks weekly workflow runs for idempotency and audit trail';

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

COMMENT ON TABLE report_requests IS 'Tracks Amazon API report requests and their processing status';

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

COMMENT ON TABLE portfolios IS 'Portfolio master data (ID to name mapping)';

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

COMMENT ON TABLE campaigns IS 'Campaign master data including placement bid adjustments';

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

COMMENT ON TABLE campaign_performance IS 'Campaign-level performance metrics by time period';

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

COMMENT ON TABLE placement_performance IS 'Placement-level performance metrics (Top of Search, Rest of Search, Product Pages)';

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

COMMENT ON VIEW view_placement_optimization_report IS 'Aggregates all data into 25-column report format for Google Sheets';

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to truncate all performance data before weekly run
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

COMMENT ON FUNCTION truncate_performance_data IS 'Clears all performance tables before weekly workflow run';

-- =====================================================
-- 9. SCHEDULED CLEANUP (pg_cron)
-- =====================================================

-- NOTE: Scheduled job skipped - pg_cron extension not enabled
-- To enable later:
-- 1. Enable pg_cron extension in Dashboard → Database → Extensions
-- 2. Run: SELECT cron.schedule('cleanup-old-workflow-executions', '0 3 * * 1',
--         'DELETE FROM workflow_executions WHERE started_at < NOW() - INTERVAL ''90 days'';');

-- =====================================================
-- 10. COMPLETION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ DATABASE SCHEMA CREATED SUCCESSFULLY!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  1. workflow_executions (execution tracking)';
  RAISE NOTICE '  2. report_requests (report status tracking)';
  RAISE NOTICE '  3. portfolios (portfolio master data)';
  RAISE NOTICE '  4. campaigns (campaign master data + bid adjustments)';
  RAISE NOTICE '  5. campaign_performance (campaign-level metrics)';
  RAISE NOTICE '  6. placement_performance (placement-level metrics)';
  RAISE NOTICE '';
  RAISE NOTICE 'View created:';
  RAISE NOTICE '  • view_placement_optimization_report (25 columns)';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions created:';
  RAISE NOTICE '  • truncate_performance_data()';
  RAISE NOTICE '';
  RAISE NOTICE 'Scheduled jobs: SKIPPED (pg_cron not enabled)';
  RAISE NOTICE '  • To add later: Enable pg_cron extension';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test view: SELECT * FROM view_placement_optimization_report LIMIT 10;';
  RAISE NOTICE '  2. Generate TypeScript types: supabase gen types typescript';
  RAISE NOTICE '  3. Configure Supabase Vault with API credentials';
  RAISE NOTICE '';
END $$;
