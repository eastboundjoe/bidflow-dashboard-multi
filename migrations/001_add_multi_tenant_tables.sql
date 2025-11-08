-- =====================================================
-- MIGRATION 001: ADD MULTI-TENANT FOUNDATION TABLES
-- =====================================================
-- Purpose: Create core multi-tenant tables for SaaS functionality
-- Dependencies: None
-- Rollback: See rollback_001.sql
-- Estimated Time: 2 minutes
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABLE 1: TENANTS
-- =====================================================
-- Organizations/companies using the platform
-- Each tenant has completely isolated data

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free', -- free, starter, pro, enterprise
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT tenants_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = true;
CREATE INDEX idx_tenants_plan ON tenants(plan);

COMMENT ON TABLE tenants IS 'Organizations/companies using the platform. Each tenant has isolated data.';
COMMENT ON COLUMN tenants.slug IS 'URL-safe identifier for tenant (used in subdomains, URLs)';
COMMENT ON COLUMN tenants.plan IS 'Subscription plan: free, starter, pro, enterprise';
COMMENT ON COLUMN tenants.settings IS 'Tenant-specific configuration (email notifications, branding, etc.)';

-- =====================================================
-- TABLE 2: USERS
-- =====================================================
-- Application users linked to Supabase Auth
-- Each user belongs to one tenant

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- admin, manager, user, viewer
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_valid CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

COMMENT ON TABLE users IS 'Application users linked to Supabase Auth. Each user belongs to one tenant.';
COMMENT ON COLUMN users.role IS 'User role: admin (full access), manager (manage campaigns), user (view + edit own), viewer (read-only)';
COMMENT ON COLUMN users.permissions IS 'Granular permissions (e.g., can_export_reports, can_modify_bids, can_invite_users)';

-- =====================================================
-- TABLE 3: AMAZON_ADS_ACCOUNTS
-- =====================================================
-- Amazon Ads API accounts per tenant
-- Credentials stored encrypted

CREATE TABLE IF NOT EXISTS amazon_ads_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL, -- Amazon Ads profile ID
    account_name TEXT NOT NULL,
    marketplace TEXT NOT NULL DEFAULT 'US', -- US, CA, UK, DE, FR, IT, ES, JP, AU
    client_id TEXT, -- Encrypted
    client_secret TEXT, -- Encrypted
    refresh_token TEXT, -- Encrypted
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, profile_id),
    CONSTRAINT amazon_ads_accounts_marketplace_valid CHECK (marketplace IN ('US', 'CA', 'UK', 'DE', 'FR', 'IT', 'ES', 'JP', 'AU'))
);

CREATE INDEX idx_amazon_ads_accounts_tenant ON amazon_ads_accounts(tenant_id);
CREATE INDEX idx_amazon_ads_accounts_active ON amazon_ads_accounts(is_active) WHERE is_active = true;
CREATE INDEX idx_amazon_ads_accounts_profile ON amazon_ads_accounts(profile_id);
CREATE INDEX idx_amazon_ads_accounts_last_sync ON amazon_ads_accounts(last_sync_at);

COMMENT ON TABLE amazon_ads_accounts IS 'Amazon Ads API accounts per tenant. Credentials stored encrypted with pgcrypto.';
COMMENT ON COLUMN amazon_ads_accounts.profile_id IS 'Amazon Advertising profile ID (unique per seller account)';
COMMENT ON COLUMN amazon_ads_accounts.client_id IS 'Encrypted Amazon Ads API client ID';
COMMENT ON COLUMN amazon_ads_accounts.client_secret IS 'Encrypted Amazon Ads API client secret';
COMMENT ON COLUMN amazon_ads_accounts.refresh_token IS 'Encrypted Amazon Ads API refresh token';
COMMENT ON COLUMN amazon_ads_accounts.last_sync_at IS 'Timestamp of last successful data sync';

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Enable RLS on all multi-tenant tables

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE amazon_ads_accounts ENABLE ROW LEVEL SECURITY;

-- Service role policies (Edge Functions need full access)
CREATE POLICY "Service role full access tenants"
ON tenants FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access users"
ON users FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access amazon_ads_accounts"
ON amazon_ads_accounts FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Authenticated user policies (tenant-scoped)
CREATE POLICY "Users can view their tenant"
ON tenants FOR SELECT TO authenticated
USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view their tenant's users"
ON users FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their tenant's users"
ON users FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view their tenant's amazon accounts"
ON amazon_ads_accounts FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their tenant's amazon accounts"
ON amazon_ads_accounts FOR ALL TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- =====================================================
-- HELPER FUNCTION: UPDATE TIMESTAMP
-- =====================================================
-- Automatically update updated_at column on record updates

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all multi-tenant tables
CREATE TRIGGER update_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_amazon_ads_accounts_updated_at
BEFORE UPDATE ON amazon_ads_accounts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify migration success:
--
-- SELECT COUNT(*) FROM tenants; -- Should return 0
-- SELECT COUNT(*) FROM users; -- Should return 0
-- SELECT COUNT(*) FROM amazon_ads_accounts; -- Should return 0
--
-- Test RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN ('tenants', 'users', 'amazon_ads_accounts');
-- -- All should show rowsecurity = true

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
