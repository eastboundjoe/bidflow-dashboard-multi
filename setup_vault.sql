-- =====================================================
-- SUPABASE VAULT SETUP FOR AMAZON ADS API CREDENTIALS
-- =====================================================
-- Project: Amazon Placement Optimization System
-- Purpose: Securely store Amazon Ads API credentials
-- Date: 2025-11-06
-- =====================================================

-- IMPORTANT: This script must be run with ELEVATED PRIVILEGES
-- Execute in Supabase SQL Editor as the postgres role

-- =====================================================
-- STEP 1: Enable Vault Extension (if not already enabled)
-- =====================================================

-- The vault extension is typically enabled by default in Supabase
-- This statement is idempotent (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- =====================================================
-- STEP 2: Create Secrets for Amazon Ads API
-- =====================================================

-- Insert Amazon Ads API Client ID
-- Replace 'your_actual_client_id_here' with your real client_id
INSERT INTO vault.secrets (name, secret)
VALUES (
    'amazon_ads_client_id',
    'your_actual_client_id_here'
)
ON CONFLICT (name)
DO UPDATE SET
    secret = EXCLUDED.secret,
    updated_at = NOW();

-- Insert Amazon Ads API Client Secret
-- Replace 'your_actual_client_secret_here' with your real client_secret
INSERT INTO vault.secrets (name, secret)
VALUES (
    'amazon_ads_client_secret',
    'your_actual_client_secret_here'
)
ON CONFLICT (name)
DO UPDATE SET
    secret = EXCLUDED.secret,
    updated_at = NOW();

-- Insert Amazon Ads API Refresh Token
-- Replace 'your_actual_refresh_token_here' with your real refresh_token
INSERT INTO vault.secrets (name, secret)
VALUES (
    'amazon_ads_refresh_token',
    'your_actual_refresh_token_here'
)
ON CONFLICT (name)
DO UPDATE SET
    secret = EXCLUDED.secret,
    updated_at = NOW();

-- =====================================================
-- STEP 3: Create Helper Functions for Edge Functions
-- =====================================================

-- Function to retrieve Amazon Ads API credentials
-- This function runs with SECURITY DEFINER, allowing Edge Functions
-- (running as service_role) to access vault secrets
CREATE OR REPLACE FUNCTION public.get_amazon_ads_credentials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    client_id_secret text;
    client_secret_secret text;
    refresh_token_secret text;
BEGIN
    -- Retrieve secrets from vault
    SELECT decrypted_secret INTO client_id_secret
    FROM vault.decrypted_secrets
    WHERE name = 'amazon_ads_client_id';

    SELECT decrypted_secret INTO client_secret_secret
    FROM vault.decrypted_secrets
    WHERE name = 'amazon_ads_client_secret';

    SELECT decrypted_secret INTO refresh_token_secret
    FROM vault.decrypted_secrets
    WHERE name = 'amazon_ads_refresh_token';

    -- Verify all credentials are present
    IF client_id_secret IS NULL OR
       client_secret_secret IS NULL OR
       refresh_token_secret IS NULL THEN
        RAISE EXCEPTION 'One or more Amazon Ads API credentials are missing from vault';
    END IF;

    -- Return credentials as JSON
    RETURN jsonb_build_object(
        'client_id', client_id_secret,
        'client_secret', client_secret_secret,
        'refresh_token', refresh_token_secret
    );
END;
$$;

-- Add comment documenting the function
COMMENT ON FUNCTION public.get_amazon_ads_credentials() IS
'Retrieves Amazon Ads API credentials from Supabase Vault.
This function is designed to be called by Edge Functions running as service_role.
Returns: {client_id, client_secret, refresh_token} as JSONB';

-- =====================================================
-- STEP 4: Grant Execution Permissions
-- =====================================================

-- Grant execute permission to service_role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION public.get_amazon_ads_credentials() TO service_role;

-- Explicitly revoke public access (defense in depth)
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials() FROM authenticated;

-- =====================================================
-- STEP 5: Create Audit Function (Optional but Recommended)
-- =====================================================

-- Function to log when credentials are accessed
-- Useful for security monitoring and compliance
CREATE TABLE IF NOT EXISTS public.vault_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    accessed_at timestamptz NOT NULL DEFAULT now(),
    function_name text NOT NULL,
    accessed_by text,
    user_agent text,
    ip_address inet
);

-- Add RLS to protect audit log
ALTER TABLE public.vault_access_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can read audit log
CREATE POLICY "Service role can read audit log"
ON public.vault_access_log
FOR SELECT
TO service_role
USING (true);

-- Function to retrieve credentials WITH audit logging
CREATE OR REPLACE FUNCTION public.get_amazon_ads_credentials_audited()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    credentials jsonb;
BEGIN
    -- Log the access
    INSERT INTO public.vault_access_log (function_name, accessed_by)
    VALUES ('get_amazon_ads_credentials_audited', current_user);

    -- Get credentials
    SELECT public.get_amazon_ads_credentials() INTO credentials;

    RETURN credentials;
END;
$$;

COMMENT ON FUNCTION public.get_amazon_ads_credentials_audited() IS
'Retrieves Amazon Ads API credentials with audit logging enabled.
Use this version in production for compliance and security monitoring.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_amazon_ads_credentials_audited() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials_audited() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials_audited() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials_audited() FROM authenticated;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'VAULT SETUP COMPLETED SUCCESSFULLY';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Verify secrets are stored: Run verify_vault.sql';
    RAISE NOTICE '2. Update placeholder credentials with real values';
    RAISE NOTICE '3. Test credential retrieval';
    RAISE NOTICE '';
    RAISE NOTICE 'Security Notes:';
    RAISE NOTICE '- Secrets are encrypted at rest using AES-256';
    RAISE NOTICE '- Only service_role can access credentials';
    RAISE NOTICE '- Audit logging is enabled for compliance';
    RAISE NOTICE '==============================================';
END $$;
