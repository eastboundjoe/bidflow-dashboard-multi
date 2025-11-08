-- =====================================================
-- ROLLBACK 001: REMOVE MULTI-TENANT TABLES
-- =====================================================
-- Purpose: Rollback migration 001_add_multi_tenant_tables.sql
-- WARNING: This will DELETE all tenants, users, and amazon_ads_accounts data
-- Only use this if you haven't onboarded any tenants yet
-- =====================================================

-- Step 1: Drop triggers
DROP TRIGGER IF EXISTS update_amazon_ads_accounts_updated_at ON amazon_ads_accounts;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;

-- Step 2: Drop RLS policies
DROP POLICY IF EXISTS "Admins can manage their tenant's amazon accounts" ON amazon_ads_accounts;
DROP POLICY IF EXISTS "Users can view their tenant's amazon accounts" ON amazon_ads_accounts;
DROP POLICY IF EXISTS "Service role full access amazon_ads_accounts" ON amazon_ads_accounts;

DROP POLICY IF EXISTS "Admins can manage their tenant's users" ON users;
DROP POLICY IF EXISTS "Users can view their tenant's users" ON users;
DROP POLICY IF EXISTS "Service role full access users" ON users;

DROP POLICY IF EXISTS "Users can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Service role full access tenants" ON tenants;

-- Step 3: Drop tables (CASCADE will drop foreign keys from other tables)
DROP TABLE IF EXISTS amazon_ads_accounts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Step 4: Drop helper function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Verification
SELECT 'Rollback 001 complete' as status;

-- Verify tables are gone
SELECT COUNT(*) as remaining_tables
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('tenants', 'users', 'amazon_ads_accounts');
-- Should return 0

-- NOTE: pgcrypto extension is NOT dropped in case other parts of your system use it
-- If you want to drop it:
-- DROP EXTENSION IF EXISTS pgcrypto;
