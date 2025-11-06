-- =====================================================
-- Vault Helper Function (After UI Setup)
-- =====================================================
-- Run this AFTER creating secrets in the Vault UI
-- =====================================================

-- Create helper function to retrieve all Amazon Ads credentials at once
CREATE OR REPLACE FUNCTION get_amazon_ads_credentials()
RETURNS TABLE (
  client_id TEXT,
  client_secret TEXT,
  refresh_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vault.decrypted_secrets.decrypted_secret::TEXT AS client_id,
    (SELECT vault.decrypted_secrets.decrypted_secret::TEXT
     FROM vault.decrypted_secrets
     WHERE name = 'amazon_ads_client_secret') AS client_secret,
    (SELECT vault.decrypted_secrets.decrypted_secret::TEXT
     FROM vault.decrypted_secrets
     WHERE name = 'amazon_ads_refresh_token') AS refresh_token
  FROM vault.decrypted_secrets
  WHERE name = 'amazon_ads_client_id'
  LIMIT 1;
END;
$$;

-- Grant access to service_role only
GRANT EXECUTE ON FUNCTION get_amazon_ads_credentials() TO service_role;
REVOKE EXECUTE ON FUNCTION get_amazon_ads_credentials() FROM anon, authenticated, public;

COMMENT ON FUNCTION get_amazon_ads_credentials() IS 'Retrieves all Amazon Ads API credentials from vault in one call (service_role only)';

-- =====================================================
-- Test the function (should work with service_role key)
-- =====================================================

SELECT '=== HELPER FUNCTION CREATED ===' AS status;
SELECT 'Use: SELECT * FROM get_amazon_ads_credentials();' AS usage;
SELECT 'NOTE: This will only work when called from Edge Functions with service_role key' AS security_note;
