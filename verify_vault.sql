-- =====================================================
-- VAULT VERIFICATION QUERIES
-- =====================================================
-- Project: Amazon Placement Optimization System
-- Purpose: Verify vault configuration and test credential retrieval
-- Date: 2025-11-06
-- =====================================================

-- =====================================================
-- TEST 1: Verify Vault Extension is Enabled
-- =====================================================
SELECT
    'Vault Extension Status' AS test_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_extension
            WHERE extname = 'supabase_vault'
        ) THEN 'PASS: Vault extension is enabled'
        ELSE 'FAIL: Vault extension is not enabled'
    END AS result;

-- =====================================================
-- TEST 2: Verify Secrets Exist in Vault
-- =====================================================
-- Note: We can see that secrets exist, but NOT their decrypted values
-- This query uses the vault.secrets table (metadata only)
SELECT
    'Secrets Existence Check' AS test_name,
    CASE
        WHEN COUNT(*) = 3 THEN 'PASS: All 3 secrets are stored'
        ELSE 'FAIL: Expected 3 secrets, found ' || COUNT(*)::text
    END AS result,
    array_agg(name ORDER BY name) AS secret_names
FROM vault.secrets
WHERE name IN (
    'amazon_ads_client_id',
    'amazon_ads_client_secret',
    'amazon_ads_refresh_token'
);

-- =====================================================
-- TEST 3: List All Secrets (Metadata Only)
-- =====================================================
-- View when secrets were created/updated
SELECT
    name AS secret_name,
    created_at,
    updated_at,
    CASE
        WHEN secret IS NOT NULL THEN 'Encrypted value present'
        ELSE 'No value stored'
    END AS status
FROM vault.secrets
WHERE name LIKE 'amazon_ads_%'
ORDER BY name;

-- =====================================================
-- TEST 4: Verify Helper Function Exists
-- =====================================================
SELECT
    'Helper Function Check' AS test_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname = 'get_amazon_ads_credentials'
        ) THEN 'PASS: get_amazon_ads_credentials() function exists'
        ELSE 'FAIL: Function not found'
    END AS result;

-- =====================================================
-- TEST 5: Verify Function Permissions
-- =====================================================
SELECT
    'Function Permissions Check' AS test_name,
    proacl AS access_control_list,
    CASE
        WHEN proacl::text LIKE '%service_role%' THEN 'PASS: service_role has access'
        ELSE 'WARNING: service_role access not confirmed'
    END AS result
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_amazon_ads_credentials';

-- =====================================================
-- TEST 6: Test Credential Retrieval (SECURITY DEFINER)
-- =====================================================
-- This test retrieves the ACTUAL credentials
-- WARNING: Only run this test in a secure environment
-- The results will show the decrypted credentials

SELECT
    'Credential Retrieval Test' AS test_name,
    CASE
        WHEN public.get_amazon_ads_credentials() IS NOT NULL THEN 'PASS: Credentials retrieved'
        ELSE 'FAIL: Could not retrieve credentials'
    END AS result;

-- =====================================================
-- TEST 7: Verify Credential Structure
-- =====================================================
-- Verify that all required keys are present in the JSON
WITH creds AS (
    SELECT public.get_amazon_ads_credentials() AS credentials
)
SELECT
    'Credential Structure Check' AS test_name,
    CASE
        WHEN credentials ? 'client_id' AND
             credentials ? 'client_secret' AND
             credentials ? 'refresh_token' THEN 'PASS: All required keys present'
        ELSE 'FAIL: Missing one or more required keys'
    END AS result,
    jsonb_object_keys(credentials) AS available_keys
FROM creds;

-- =====================================================
-- TEST 8: Check for Placeholder Values
-- =====================================================
-- Verify that credentials have been updated from placeholders
WITH creds AS (
    SELECT public.get_amazon_ads_credentials() AS credentials
)
SELECT
    'Placeholder Check' AS test_name,
    CASE
        WHEN credentials->>'client_id' LIKE '%your_actual_%' OR
             credentials->>'client_secret' LIKE '%your_actual_%' OR
             credentials->>'refresh_token' LIKE '%your_actual_%' THEN
            'WARNING: Placeholder values detected. Update with real credentials!'
        ELSE
            'PASS: No placeholder values detected'
    END AS result
FROM creds;

-- =====================================================
-- TEST 9: Verify Audit Log Table (If Enabled)
-- =====================================================
SELECT
    'Audit Log Table Check' AS test_name,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename = 'vault_access_log'
        ) THEN 'PASS: Audit log table exists'
        ELSE 'INFO: Audit log table not created (optional)'
    END AS result;

-- =====================================================
-- TEST 10: View Recent Audit Log Entries (If Enabled)
-- =====================================================
-- This will fail gracefully if audit log doesn't exist
SELECT
    'Recent Vault Access' AS info,
    accessed_at,
    function_name,
    accessed_by
FROM public.vault_access_log
ORDER BY accessed_at DESC
LIMIT 10;

-- =====================================================
-- SUMMARY: Vault Configuration Status
-- =====================================================
DO $$
DECLARE
    vault_enabled boolean;
    secrets_count integer;
    function_exists boolean;
BEGIN
    -- Check vault extension
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault'
    ) INTO vault_enabled;

    -- Count secrets
    SELECT COUNT(*) INTO secrets_count
    FROM vault.secrets
    WHERE name IN (
        'amazon_ads_client_id',
        'amazon_ads_client_secret',
        'amazon_ads_refresh_token'
    );

    -- Check function
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'get_amazon_ads_credentials'
    ) INTO function_exists;

    -- Print summary
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'VAULT CONFIGURATION SUMMARY';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Vault Extension: %', CASE WHEN vault_enabled THEN 'Enabled' ELSE 'Disabled' END;
    RAISE NOTICE 'Secrets Stored: %/3', secrets_count;
    RAISE NOTICE 'Helper Function: %', CASE WHEN function_exists THEN 'Created' ELSE 'Missing' END;
    RAISE NOTICE '==============================================';

    IF vault_enabled AND secrets_count = 3 AND function_exists THEN
        RAISE NOTICE 'STATUS: All vault components configured successfully';
    ELSE
        RAISE NOTICE 'STATUS: Configuration incomplete - review test results';
    END IF;

    RAISE NOTICE '==============================================';
END $$;
