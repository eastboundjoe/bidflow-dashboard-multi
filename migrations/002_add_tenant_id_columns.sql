-- =====================================================
-- MIGRATION 002: ADD TENANT_ID TO EXISTING TABLES
-- =====================================================
-- Purpose: Add multi-tenant support to existing single-tenant tables
-- Dependencies: 001_add_multi_tenant_tables.sql
-- Rollback: See rollback_002.sql
-- Estimated Time: 5 minutes
-- IMPORTANT: This migration is NON-DESTRUCTIVE and backward compatible
-- =====================================================

-- =====================================================
-- STEP 1: ADD NULLABLE TENANT_ID COLUMNS
-- =====================================================
-- Add columns as nullable first, will make NOT NULL after backfill

ALTER TABLE workflow_executions
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS amazon_ads_account_id UUID REFERENCES amazon_ads_accounts(id) ON DELETE SET NULL;

ALTER TABLE report_requests
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS amazon_ads_account_id UUID REFERENCES amazon_ads_accounts(id) ON DELETE SET NULL;

ALTER TABLE portfolios
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS amazon_ads_account_id UUID REFERENCES amazon_ads_accounts(id) ON DELETE SET NULL;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS amazon_ads_account_id UUID REFERENCES amazon_ads_accounts(id) ON DELETE SET NULL;

ALTER TABLE campaign_performance
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS amazon_ads_account_id UUID REFERENCES amazon_ads_accounts(id) ON DELETE SET NULL;

ALTER TABLE placement_performance
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS amazon_ads_account_id UUID REFERENCES amazon_ads_accounts(id) ON DELETE SET NULL;

-- =====================================================
-- STEP 2: CREATE INDEXES (BEFORE MAKING NOT NULL)
-- =====================================================
-- Performance optimization for tenant-scoped queries

CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_account ON workflow_executions(amazon_ads_account_id);

CREATE INDEX IF NOT EXISTS idx_report_requests_tenant ON report_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_requests_account ON report_requests(amazon_ads_account_id);

CREATE INDEX IF NOT EXISTS idx_portfolios_tenant ON portfolios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_account ON portfolios(amazon_ads_account_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_tenant_portfolio ON portfolios(tenant_id, portfolio_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns(amazon_ads_account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_campaign ON campaigns(tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_performance_tenant ON campaign_performance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_performance_account ON campaign_performance(amazon_ads_account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_performance_tenant_campaign ON campaign_performance(tenant_id, campaign_id);

CREATE INDEX IF NOT EXISTS idx_placement_performance_tenant ON placement_performance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_placement_performance_account ON placement_performance(amazon_ads_account_id);
CREATE INDEX IF NOT EXISTS idx_placement_performance_tenant_campaign ON placement_performance(tenant_id, campaign_id);

-- =====================================================
-- STEP 3: CREATE "RAMEN BOMB LLC" TENANT
-- =====================================================
-- Create proper tenant for your existing data

DO $$
DECLARE
  ramen_bomb_tenant_id UUID;
  ramen_bomb_account_id UUID;
BEGIN
  -- Create Ramen Bomb LLC tenant
  INSERT INTO tenants (name, slug, plan, is_active)
  VALUES (
    'Ramen Bomb LLC',
    'ramen-bomb-llc',
    'enterprise', -- You're the owner, give yourself enterprise!
    true
  )
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO ramen_bomb_tenant_id;

  RAISE NOTICE 'Created tenant: Ramen Bomb LLC (ID: %)', ramen_bomb_tenant_id;

  -- Create Amazon Ads account for Ramen Bomb
  INSERT INTO amazon_ads_accounts (
    tenant_id,
    profile_id,
    account_name,
    marketplace,
    is_active
  )
  VALUES (
    ramen_bomb_tenant_id,
    '1279339718510959', -- Your current profile_id from claude.md
    'Ramen Bomb - Main Account',
    'US',
    true
  )
  ON CONFLICT (tenant_id, profile_id) DO UPDATE SET account_name = EXCLUDED.account_name
  RETURNING id INTO ramen_bomb_account_id;

  RAISE NOTICE 'Created Amazon Ads account: % (ID: %)', 'Ramen Bomb - Main Account', ramen_bomb_account_id;

  -- Store IDs for next step
  PERFORM set_config('app.ramen_bomb_tenant_id', ramen_bomb_tenant_id::TEXT, false);
  PERFORM set_config('app.ramen_bomb_account_id', ramen_bomb_account_id::TEXT, false);
END $$;

-- =====================================================
-- STEP 4: BACKFILL EXISTING DATA
-- =====================================================
-- Associate all existing data with Ramen Bomb LLC tenant

DO $$
DECLARE
  ramen_bomb_tenant_id UUID;
  ramen_bomb_account_id UUID;
  updated_count INT;
BEGIN
  -- Get tenant and account IDs
  SELECT id INTO ramen_bomb_tenant_id
  FROM tenants
  WHERE slug = 'ramen-bomb-llc';

  SELECT id INTO ramen_bomb_account_id
  FROM amazon_ads_accounts
  WHERE tenant_id = ramen_bomb_tenant_id;

  IF ramen_bomb_tenant_id IS NULL OR ramen_bomb_account_id IS NULL THEN
    RAISE EXCEPTION 'Ramen Bomb tenant or account not found. Run Step 3 first.';
  END IF;

  -- Backfill workflow_executions
  UPDATE workflow_executions
  SET tenant_id = ramen_bomb_tenant_id,
      amazon_ads_account_id = ramen_bomb_account_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % workflow_executions rows', updated_count;

  -- Backfill report_requests
  UPDATE report_requests
  SET tenant_id = ramen_bomb_tenant_id,
      amazon_ads_account_id = ramen_bomb_account_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % report_requests rows', updated_count;

  -- Backfill portfolios
  UPDATE portfolios
  SET tenant_id = ramen_bomb_tenant_id,
      amazon_ads_account_id = ramen_bomb_account_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % portfolios rows', updated_count;

  -- Backfill campaigns
  UPDATE campaigns
  SET tenant_id = ramen_bomb_tenant_id,
      amazon_ads_account_id = ramen_bomb_account_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % campaigns rows', updated_count;

  -- Backfill campaign_performance
  UPDATE campaign_performance
  SET tenant_id = ramen_bomb_tenant_id,
      amazon_ads_account_id = ramen_bomb_account_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % campaign_performance rows', updated_count;

  -- Backfill placement_performance
  UPDATE placement_performance
  SET tenant_id = ramen_bomb_tenant_id,
      amazon_ads_account_id = ramen_bomb_account_id
  WHERE tenant_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % placement_performance rows', updated_count;
END $$;

-- =====================================================
-- STEP 5: VERIFY NO NULL VALUES
-- =====================================================
-- Critical check before making columns NOT NULL

DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count FROM workflow_executions WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % workflow_executions rows with NULL tenant_id', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM report_requests WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % report_requests rows with NULL tenant_id', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM portfolios WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % portfolios rows with NULL tenant_id', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM campaigns WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % campaigns rows with NULL tenant_id', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM campaign_performance WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % campaign_performance rows with NULL tenant_id', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM placement_performance WHERE tenant_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Found % placement_performance rows with NULL tenant_id', null_count;
  END IF;

  RAISE NOTICE '✅ All tables have tenant_id populated (no NULL values)';
END $$;

-- =====================================================
-- STEP 6: MAKE TENANT_ID NOT NULL
-- =====================================================
-- Now safe to enforce NOT NULL constraint

ALTER TABLE workflow_executions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE report_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE portfolios ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE campaign_performance ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE placement_performance ALTER COLUMN tenant_id SET NOT NULL;

-- =====================================================
-- STEP 7: UPDATE UNIQUE CONSTRAINTS
-- =====================================================
-- Add tenant_id to unique constraints for proper multi-tenant isolation

-- Drop old unique constraints
ALTER TABLE portfolios DROP CONSTRAINT IF EXISTS portfolios_portfolio_id_key;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_campaign_id_key;

-- Add new composite unique constraints
ALTER TABLE portfolios ADD CONSTRAINT portfolios_tenant_portfolio_unique UNIQUE (tenant_id, portfolio_id);
ALTER TABLE campaigns ADD CONSTRAINT campaigns_tenant_campaign_unique UNIQUE (tenant_id, campaign_id);

-- Update composite unique constraints that include report_date
ALTER TABLE campaign_performance DROP CONSTRAINT IF EXISTS campaign_performance_campaign_id_period_type_report_date_key;
ALTER TABLE campaign_performance ADD CONSTRAINT campaign_performance_unique UNIQUE (tenant_id, campaign_id, period_type, report_date);

ALTER TABLE placement_performance DROP CONSTRAINT IF EXISTS placement_performance_campaign_id_placement_period_type_re_key;
ALTER TABLE placement_performance ADD CONSTRAINT placement_performance_unique UNIQUE (tenant_id, campaign_id, placement, period_type, report_date);

-- =====================================================
-- STEP 8: ADD RLS POLICIES
-- =====================================================
-- Enable RLS and add tenant-scoped policies

-- Enable RLS on existing tables
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_performance ENABLE ROW LEVEL SECURITY;

-- Service role policies (Edge Functions need full access)
CREATE POLICY "Service role full access workflow_executions"
ON workflow_executions FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access report_requests"
ON report_requests FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access portfolios"
ON portfolios FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access campaigns"
ON campaigns FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access campaign_performance"
ON campaign_performance FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access placement_performance"
ON placement_performance FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Authenticated user policies (tenant-scoped)
CREATE POLICY "Users access their tenant's workflow_executions"
ON workflow_executions FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users access their tenant's report_requests"
ON report_requests FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users access their tenant's portfolios"
ON portfolios FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users access their tenant's campaigns"
ON campaigns FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users access their tenant's campaign_performance"
ON campaign_performance FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users access their tenant's placement_performance"
ON placement_performance FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify migration success:
--
-- Check Ramen Bomb tenant exists:
-- SELECT * FROM tenants WHERE slug = 'ramen-bomb-llc';
--
-- Check all existing data has tenant_id:
-- SELECT
--   (SELECT COUNT(*) FROM workflow_executions WHERE tenant_id IS NULL) as null_workflow,
--   (SELECT COUNT(*) FROM portfolios WHERE tenant_id IS NULL) as null_portfolios,
--   (SELECT COUNT(*) FROM campaigns WHERE tenant_id IS NULL) as null_campaigns,
--   (SELECT COUNT(*) FROM campaign_performance WHERE tenant_id IS NULL) as null_campaign_perf,
--   (SELECT COUNT(*) FROM placement_performance WHERE tenant_id IS NULL) as null_placement_perf;
-- -- All should be 0
--
-- Check RLS enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('workflow_executions', 'portfolios', 'campaigns', 'campaign_performance', 'placement_performance');
-- -- All should show rowsecurity = true

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
