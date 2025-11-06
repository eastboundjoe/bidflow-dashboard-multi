-- =====================================================
-- UPDATE VAULT CREDENTIALS
-- =====================================================
-- Project: Amazon Placement Optimization System
-- Purpose: Update stored credentials with new values
-- Date: 2025-11-06
-- =====================================================

-- Use this script when you need to:
-- 1. Replace placeholder values with real credentials
-- 2. Rotate credentials for security
-- 3. Update expired refresh tokens

-- =====================================================
-- OPTION 1: Update All Credentials at Once
-- =====================================================

-- Uncomment and replace values below with your actual credentials
/*
BEGIN;

UPDATE vault.secrets
SET secret = 'your_new_client_id_here',
    updated_at = NOW()
WHERE name = 'amazon_ads_client_id';

UPDATE vault.secrets
SET secret = 'your_new_client_secret_here',
    updated_at = NOW()
WHERE name = 'amazon_ads_client_secret';

UPDATE vault.secrets
SET secret = 'your_new_refresh_token_here',
    updated_at = NOW()
WHERE name = 'amazon_ads_refresh_token';

-- Verify updates
SELECT
    name,
    updated_at,
    'Updated successfully' AS status
FROM vault.secrets
WHERE name IN (
    'amazon_ads_client_id',
    'amazon_ads_client_secret',
    'amazon_ads_refresh_token'
)
ORDER BY name;

COMMIT;
*/

-- =====================================================
-- OPTION 2: Update Individual Credentials
-- =====================================================

-- Update only Client ID
/*
UPDATE vault.secrets
SET secret = 'your_new_client_id_here',
    updated_at = NOW()
WHERE name = 'amazon_ads_client_id';
*/

-- Update only Client Secret
/*
UPDATE vault.secrets
SET secret = 'your_new_client_secret_here',
    updated_at = NOW()
WHERE name = 'amazon_ads_client_secret';
*/

-- Update only Refresh Token
/*
UPDATE vault.secrets
SET secret = 'your_new_refresh_token_here',
    updated_at = NOW()
WHERE name = 'amazon_ads_refresh_token';
*/

-- =====================================================
-- OPTION 3: Helper Function for Safe Updates
-- =====================================================

-- This function provides a safer interface for updating secrets
-- It validates input and prevents accidental deletion
CREATE OR REPLACE FUNCTION public.update_amazon_ads_credential(
    credential_name text,
    new_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
    -- Validate credential name
    IF credential_name NOT IN (
        'amazon_ads_client_id',
        'amazon_ads_client_secret',
        'amazon_ads_refresh_token'
    ) THEN
        RAISE EXCEPTION 'Invalid credential name: %. Must be one of: amazon_ads_client_id, amazon_ads_client_secret, amazon_ads_refresh_token',
            credential_name;
    END IF;

    -- Validate new value is not empty
    IF new_value IS NULL OR LENGTH(TRIM(new_value)) = 0 THEN
        RAISE EXCEPTION 'Credential value cannot be empty';
    END IF;

    -- Validate new value is not a placeholder
    IF new_value LIKE '%your_actual_%' OR
       new_value LIKE '%placeholder%' OR
       new_value LIKE '%replace_me%' THEN
        RAISE EXCEPTION 'Cannot set credential to placeholder value';
    END IF;

    -- Update the secret
    UPDATE vault.secrets
    SET secret = new_value,
        updated_at = NOW()
    WHERE name = credential_name;

    -- Verify update
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Secret % not found in vault', credential_name;
    END IF;

    RAISE NOTICE 'Successfully updated: %', credential_name;
END;
$$;

COMMENT ON FUNCTION public.update_amazon_ads_credential(text, text) IS
'Safely updates an Amazon Ads API credential in the vault.
Parameters:
  credential_name: One of amazon_ads_client_id, amazon_ads_client_secret, amazon_ads_refresh_token
  new_value: The new credential value (will be validated)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_amazon_ads_credential(text, text) TO postgres;

-- =====================================================
-- USAGE EXAMPLE: Using Helper Function
-- =====================================================

-- Update Client ID using helper function
/*
SELECT public.update_amazon_ads_credential(
    'amazon_ads_client_id',
    'amzn1.application-oa2-client.abc123def456'
);
*/

-- Update Client Secret using helper function
/*
SELECT public.update_amazon_ads_credential(
    'amazon_ads_client_secret',
    'abc123def456ghi789jkl012mno345pqr678'
);
*/

-- Update Refresh Token using helper function
/*
SELECT public.update_amazon_ads_credential(
    'amazon_ads_refresh_token',
    'Atzr|IwEBIJK...your_long_refresh_token_here'
);
*/

-- =====================================================
-- VERIFICATION: Check Updated Values
-- =====================================================

-- View metadata (not the actual secrets)
SELECT
    name AS credential_name,
    updated_at AS last_updated,
    created_at AS originally_created,
    age(updated_at, created_at) AS time_since_creation
FROM vault.secrets
WHERE name IN (
    'amazon_ads_client_id',
    'amazon_ads_client_secret',
    'amazon_ads_refresh_token'
)
ORDER BY name;

-- Test retrieval (this will show actual values - be careful!)
/*
SELECT public.get_amazon_ads_credentials();
*/

-- =====================================================
-- CREDENTIAL ROTATION SCHEDULE
-- =====================================================

-- Best Practices for Credential Management:
--
-- 1. CLIENT_ID and CLIENT_SECRET:
--    - These are long-lived credentials
--    - Rotate every 90-180 days or immediately if compromised
--    - Generate new credentials in Amazon Ads Console
--
-- 2. REFRESH_TOKEN:
--    - Can expire based on Amazon's policies
--    - May need to be refreshed if user revokes access
--    - Update immediately if API calls fail with 401 Unauthorized
--
-- 3. Security Notes:
--    - Always use transactions when updating multiple credentials
--    - Never log or print decrypted credential values
--    - Verify Edge Functions still work after rotation
--    - Keep backup of old credentials until new ones are verified

-- =====================================================
-- TROUBLESHOOTING: Common Issues
-- =====================================================

-- Issue: "Secret not found"
-- Solution: Check that setup_vault.sql was run successfully
/*
SELECT name, created_at
FROM vault.secrets
WHERE name LIKE 'amazon_ads_%';
*/

-- Issue: "Permission denied"
-- Solution: Verify you're running as postgres role with sufficient privileges
/*
SELECT current_user, current_setting('is_superuser');
*/

-- Issue: "Credential validation failed"
-- Solution: Check that new credentials are in correct format
-- Amazon Client ID format: amzn1.application-oa2-client.[alphanumeric]
-- Amazon Client Secret format: [64 character alphanumeric string]
-- Amazon Refresh Token format: Atzr|[long alphanumeric string]
