-- =====================================================
-- ROLLBACK 002: REMOVE TENANT_ID COLUMNS
-- =====================================================
-- Purpose: Rollback migration 002_add_tenant_id_columns.sql
-- WARNING: This will DROP tenant_id columns and lose tenant associations
-- Only use this if you haven't added any new tenants yet
-- =====================================================

-- Step 1: Disable RLS (to allow column drops)
ALTER TABLE workflow_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE report_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_performance DISABLE ROW LEVEL SECURITY;
ALTER TABLE placement_performance DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop RLS policies
DROP POLICY IF EXISTS "Users access their tenant's workflow_executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users access their tenant's report_requests" ON report_requests;
DROP POLICY IF EXISTS "Users access their tenant's portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users access their tenant's campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users access their tenant's campaign_performance" ON campaign_performance;
DROP POLICY IF EXISTS "Users access their tenant's placement_performance" ON placement_performance;

DROP POLICY IF EXISTS "Service role full access workflow_executions" ON workflow_executions;
DROP POLICY IF EXISTS "Service role full access report_requests" ON report_requests;
DROP POLICY IF EXISTS "Service role full access portfolios" ON portfolios;
DROP POLICY IF EXISTS "Service role full access campaigns" ON campaigns;
DROP POLICY IF EXISTS "Service role full access campaign_performance" ON campaign_performance;
DROP POLICY IF EXISTS "Service role full access placement_performance" ON placement_performance;

-- Step 3: Drop composite unique constraints (restore originals)
ALTER TABLE placement_performance DROP CONSTRAINT IF EXISTS placement_performance_unique;
ALTER TABLE placement_performance ADD CONSTRAINT placement_performance_campaign_id_placement_period_type_re_key
  UNIQUE (campaign_id, placement, period_type, report_date);

ALTER TABLE campaign_performance DROP CONSTRAINT IF EXISTS campaign_performance_unique;
ALTER TABLE campaign_performance ADD CONSTRAINT campaign_performance_campaign_id_period_type_report_date_key
  UNIQUE (campaign_id, period_type, report_date);

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_tenant_campaign_unique;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_campaign_id_key UNIQUE (campaign_id);

ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS portfolios_tenant_portfolio_unique;
ALTER TABLE portfolios ADD CONSTRAINT portfolios_portfolio_id_key UNIQUE (portfolio_id);

-- Step 4: Drop indexes
DROP INDEX IF EXISTS idx_placement_performance_tenant_campaign;
DROP INDEX IF EXISTS idx_placement_performance_account;
DROP INDEX IF EXISTS idx_placement_performance_tenant;

DROP INDEX IF EXISTS idx_campaign_performance_tenant_campaign;
DROP INDEX IF EXISTS idx_campaign_performance_account;
DROP INDEX IF EXISTS idx_campaign_performance_tenant;

DROP INDEX IF EXISTS idx_campaigns_tenant_campaign;
DROP INDEX IF EXISTS idx_campaigns_account;
DROP INDEX IF EXISTS idx_campaigns_tenant;

DROP INDEX IF EXISTS idx_portfolios_tenant_portfolio;
DROP INDEX IF EXISTS idx_portfolios_account;
DROP INDEX IF EXISTS idx_portfolios_tenant;

DROP INDEX IF EXISTS idx_report_requests_account;
DROP INDEX IF EXISTS idx_report_requests_tenant;

DROP INDEX IF EXISTS idx_workflow_executions_account;
DROP INDEX IF EXISTS idx_workflow_executions_tenant;

-- Step 5: Drop tenant_id columns
ALTER TABLE placement_performance DROP COLUMN IF EXISTS amazon_ads_account_id;
ALTER TABLE placement_performance DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE campaign_performance DROP COLUMN IF EXISTS amazon_ads_account_id;
ALTER TABLE campaign_performance DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE campaigns DROP COLUMN IF EXISTS amazon_ads_account_id;
ALTER TABLE campaigns DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE portfolios DROP COLUMN IF EXISTS amazon_ads_account_id;
ALTER TABLE portfolios DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE report_requests DROP COLUMN IF EXISTS amazon_ads_account_id;
ALTER TABLE report_requests DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE workflow_executions DROP COLUMN IF EXISTS amazon_ads_account_id;
ALTER TABLE workflow_executions DROP COLUMN IF EXISTS tenant_id;

-- Step 6: Re-enable original RLS policies (if they existed)
-- Note: Original system might not have had RLS enabled
-- Check your create_database.sql for original policies

-- Verification
SELECT 'Rollback 002 complete' as status;

-- Verify columns are gone
SELECT
  COUNT(*) FILTER (WHERE column_name = 'tenant_id') as tenant_id_count,
  COUNT(*) FILTER (WHERE column_name = 'amazon_ads_account_id') as account_id_count
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('portfolios', 'campaigns', 'campaign_performance', 'placement_performance', 'workflow_executions', 'report_requests');
-- Both should be 0
