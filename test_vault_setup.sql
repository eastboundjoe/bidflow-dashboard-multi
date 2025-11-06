-- =====================================================
-- Test Vault Setup
-- =====================================================
-- Verify that vault secrets are stored correctly
-- =====================================================

-- Test 1: Check if secrets exist in vault
SELECT '=== TEST 1: SECRETS EXIST ===' AS test;
SELECT
  name,
  CASE
    WHEN description IS NOT NULL THEN 'Has description'
    ELSE 'No description'
  END AS description_status,
  created_at
FROM vault.secrets
WHERE name IN (
  'amazon_ads_client_id',
  'amazon_ads_client_secret',
  'amazon_ads_refresh_token'
)
ORDER BY name;

-- Test 2: Check secret count
SELECT '=== TEST 2: SECRET COUNT ===' AS test;
SELECT
  COUNT(*) AS total_secrets,
  CASE
    WHEN COUNT(*) = 3 THEN '✅ PASS - All 3 secrets exist'
    ELSE '❌ FAIL - Expected 3 secrets, found ' || COUNT(*)
  END AS status
FROM vault.secrets
WHERE name IN (
  'amazon_ads_client_id',
  'amazon_ads_client_secret',
  'amazon_ads_refresh_token'
);

-- Test 3: Verify secrets are not placeholder values
SELECT '=== TEST 3: CHECK FOR PLACEHOLDERS ===' AS test;
SELECT
  name,
  CASE
    WHEN decrypted_secret LIKE '%placeholder%' OR
         decrypted_secret LIKE '%your_%_here%' OR
         decrypted_secret LIKE '%example%' OR
         decrypted_secret = '' OR
         decrypted_secret IS NULL
    THEN '⚠️  WARNING - Appears to be placeholder'
    ELSE '✅ OK - Real value detected'
  END AS validation_status,
  LENGTH(decrypted_secret) AS secret_length
FROM vault.decrypted_secrets
WHERE name IN (
  'amazon_ads_client_id',
  'amazon_ads_client_secret',
  'amazon_ads_refresh_token'
)
ORDER BY name;

-- Test 4: Verify helper function exists
SELECT '=== TEST 4: HELPER FUNCTION ===' AS test;
SELECT
  routine_name AS function_name,
  routine_type,
  security_type,
  CASE
    WHEN security_type = 'DEFINER' THEN '✅ PASS - SECURITY DEFINER set'
    ELSE '❌ FAIL - Should be SECURITY DEFINER'
  END AS security_status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_amazon_ads_credentials';

-- Test 5: Check function permissions
SELECT '=== TEST 5: FUNCTION PERMISSIONS ===' AS test;
SELECT
  grantee,
  privilege_type,
  CASE
    WHEN grantee = 'service_role' AND privilege_type = 'EXECUTE' THEN '✅ PASS'
    ELSE '⚠️  Check'
  END AS status
FROM information_schema.role_routine_grants
WHERE routine_name = 'get_amazon_ads_credentials'
ORDER BY grantee;

-- =====================================================
-- SUMMARY
-- =====================================================

SELECT '=== VAULT SETUP SUMMARY ===' AS summary;

WITH summary_data AS (
  SELECT
    (SELECT COUNT(*) FROM vault.secrets
     WHERE name IN ('amazon_ads_client_id', 'amazon_ads_client_secret', 'amazon_ads_refresh_token')) AS secrets_count,
    (SELECT COUNT(*) FROM information_schema.routines
     WHERE routine_name = 'get_amazon_ads_credentials') AS function_count,
    (SELECT COUNT(*) FROM vault.decrypted_secrets
     WHERE name IN ('amazon_ads_client_id', 'amazon_ads_client_secret', 'amazon_ads_refresh_token')
     AND (decrypted_secret LIKE '%placeholder%' OR
          decrypted_secret LIKE '%your_%_here%' OR
          decrypted_secret LIKE '%example%' OR
          decrypted_secret = '')) AS placeholder_count
)
SELECT
  CASE
    WHEN secrets_count = 3 THEN '✅ Secrets: 3/3 created'
    ELSE '❌ Secrets: ' || secrets_count || '/3 created'
  END AS secrets_status,
  CASE
    WHEN function_count = 1 THEN '✅ Helper function: Created'
    ELSE '❌ Helper function: Missing'
  END AS function_status,
  CASE
    WHEN placeholder_count = 0 THEN '✅ Credentials: Real values'
    WHEN placeholder_count > 0 THEN '⚠️  Credentials: ' || placeholder_count || ' placeholders detected'
    ELSE '✅ Credentials: Ready'
  END AS credentials_status
FROM summary_data;

SELECT '=== NEXT STEPS ===' AS next_steps;
SELECT
  'If placeholders detected: Update secrets in Vault UI with real Amazon Ads API credentials' AS step_1,
  'Phase 2: Create Edge Functions to use these credentials' AS step_2;
