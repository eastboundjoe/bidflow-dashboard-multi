-- =====================================================
-- MIGRATION 004: CREDENTIAL ENCRYPTION FUNCTIONS
-- =====================================================
-- Purpose: Create functions for encrypting/decrypting Amazon Ads credentials
-- Dependencies: 001_add_multi_tenant_tables.sql (amazon_ads_accounts table must exist)
-- Rollback: See rollback_004.sql
-- Estimated Time: 1 minute
-- =====================================================

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- FUNCTION 1: SET AMAZON ADS CREDENTIALS (ENCRYPT)
-- =====================================================
-- Called from Edge Functions to securely store credentials

CREATE OR REPLACE FUNCTION set_amazon_ads_credentials(
  p_account_id UUID,
  p_client_id TEXT,
  p_client_secret TEXT,
  p_refresh_token TEXT,
  p_encryption_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INT;
BEGIN
  -- Validate inputs
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id cannot be NULL';
  END IF;

  IF p_client_id IS NULL OR p_client_secret IS NULL OR p_refresh_token IS NULL THEN
    RAISE EXCEPTION 'Credentials cannot be NULL';
  END IF;

  IF p_encryption_key IS NULL OR LENGTH(p_encryption_key) < 32 THEN
    RAISE EXCEPTION 'Encryption key must be at least 32 characters';
  END IF;

  -- Encrypt and store credentials
  UPDATE amazon_ads_accounts
  SET
    client_id = encode(pgp_sym_encrypt(p_client_id, p_encryption_key), 'base64'),
    client_secret = encode(pgp_sym_encrypt(p_client_secret, p_encryption_key), 'base64'),
    refresh_token = encode(pgp_sym_encrypt(p_refresh_token, p_encryption_key), 'base64'),
    updated_at = NOW()
  WHERE id = p_account_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Amazon Ads account not found: %', p_account_id;
  END IF;

  RAISE NOTICE 'Credentials encrypted and stored for account: %', p_account_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to encrypt credentials: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION set_amazon_ads_credentials(UUID, TEXT, TEXT, TEXT, TEXT) IS
'Encrypts and stores Amazon Ads API credentials using pgp_sym_encrypt. Called from Edge Functions with encryption key from environment.';

-- =====================================================
-- FUNCTION 2: GET AMAZON ADS CREDENTIALS (DECRYPT)
-- =====================================================
-- Called from Edge Functions to retrieve and decrypt credentials

CREATE OR REPLACE FUNCTION get_amazon_ads_credentials(
  p_account_id UUID,
  p_encryption_key TEXT
)
RETURNS TABLE (
  client_id TEXT,
  client_secret TEXT,
  refresh_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate inputs
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id cannot be NULL';
  END IF;

  IF p_encryption_key IS NULL OR LENGTH(p_encryption_key) < 32 THEN
    RAISE EXCEPTION 'Encryption key must be at least 32 characters';
  END IF;

  -- Decrypt and return credentials
  RETURN QUERY
  SELECT
    CASE
      WHEN aa.client_id IS NOT NULL THEN
        pgp_sym_decrypt(decode(aa.client_id, 'base64'), p_encryption_key)::TEXT
      ELSE NULL
    END,
    CASE
      WHEN aa.client_secret IS NOT NULL THEN
        pgp_sym_decrypt(decode(aa.client_secret, 'base64'), p_encryption_key)::TEXT
      ELSE NULL
    END,
    CASE
      WHEN aa.refresh_token IS NOT NULL THEN
        pgp_sym_decrypt(decode(aa.refresh_token, 'base64'), p_encryption_key)::TEXT
      ELSE NULL
    END
  FROM amazon_ads_accounts aa
  WHERE aa.id = p_account_id
    AND aa.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Amazon Ads account not found or inactive: %', p_account_id;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Don't leak encryption errors in production
    RAISE EXCEPTION 'Failed to decrypt credentials (check encryption key)';
END;
$$;

COMMENT ON FUNCTION get_amazon_ads_credentials(UUID, TEXT) IS
'Decrypts and returns Amazon Ads API credentials using pgp_sym_decrypt. Called from Edge Functions with encryption key from environment.';

-- =====================================================
-- FUNCTION 3: VALIDATE AMAZON ADS CREDENTIALS
-- =====================================================
-- Helper to check if credentials are stored (without decrypting)

CREATE OR REPLACE FUNCTION has_amazon_ads_credentials(
  p_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_creds BOOLEAN;
BEGIN
  SELECT
    (client_id IS NOT NULL AND
     client_secret IS NOT NULL AND
     refresh_token IS NOT NULL)
  INTO has_creds
  FROM amazon_ads_accounts
  WHERE id = p_account_id;

  RETURN COALESCE(has_creds, FALSE);
END;
$$;

COMMENT ON FUNCTION has_amazon_ads_credentials(UUID) IS
'Returns true if account has encrypted credentials stored. Does not decrypt or validate credentials.';

-- =====================================================
-- FUNCTION 4: CLEAR AMAZON ADS CREDENTIALS
-- =====================================================
-- Securely remove credentials (e.g., when user disconnects account)

CREATE OR REPLACE FUNCTION clear_amazon_ads_credentials(
  p_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INT;
BEGIN
  UPDATE amazon_ads_accounts
  SET
    client_id = NULL,
    client_secret = NULL,
    refresh_token = NULL,
    is_active = FALSE,
    updated_at = NOW()
  WHERE id = p_account_id;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RAISE EXCEPTION 'Amazon Ads account not found: %', p_account_id;
  END IF;

  RAISE NOTICE 'Credentials cleared for account: %', p_account_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION clear_amazon_ads_credentials(UUID) IS
'Clears encrypted credentials and marks account inactive. Called when user disconnects their Amazon Ads account.';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Only service_role (Edge Functions) can call these functions

GRANT EXECUTE ON FUNCTION set_amazon_ads_credentials(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_amazon_ads_credentials(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION has_amazon_ads_credentials(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION clear_amazon_ads_credentials(UUID) TO service_role;

-- Authenticated users can only check if credentials exist (not decrypt)
GRANT EXECUTE ON FUNCTION has_amazon_ads_credentials(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION & TESTING
-- =====================================================
-- Run these to verify functions work:
--
-- 1. Test encryption (use your actual tenant/account from migration 002):
/*
DO $$
DECLARE
  test_account_id UUID;
  encryption_key TEXT := 'test-key-must-be-at-least-32-chars-long-for-security';
  decrypted_client_id TEXT;
BEGIN
  -- Get your Ramen Bomb account ID
  SELECT id INTO test_account_id
  FROM amazon_ads_accounts
  WHERE profile_id = '1279339718510959'
  LIMIT 1;

  IF test_account_id IS NULL THEN
    RAISE EXCEPTION 'Ramen Bomb account not found';
  END IF;

  -- Encrypt test credentials
  PERFORM set_amazon_ads_credentials(
    test_account_id,
    'test_client_id_12345',
    'test_client_secret_67890',
    'test_refresh_token_abcdef',
    encryption_key
  );

  RAISE NOTICE 'Credentials encrypted successfully';

  -- Decrypt and verify
  SELECT client_id INTO decrypted_client_id
  FROM get_amazon_ads_credentials(test_account_id, encryption_key);

  IF decrypted_client_id = 'test_client_id_12345' THEN
    RAISE NOTICE '✅ Encryption/decryption working correctly';
  ELSE
    RAISE EXCEPTION '❌ Decryption returned wrong value: %', decrypted_client_id;
  END IF;

  -- Test has_credentials function
  IF has_amazon_ads_credentials(test_account_id) THEN
    RAISE NOTICE '✅ has_amazon_ads_credentials working correctly';
  ELSE
    RAISE EXCEPTION '❌ has_amazon_ads_credentials returned false';
  END IF;

  -- Clean up test data
  PERFORM clear_amazon_ads_credentials(test_account_id);
  RAISE NOTICE '✅ Test complete, credentials cleared';
END $$;
*/

-- 2. Verify functions exist:
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
-- AND routine_name LIKE '%amazon_ads_credentials%'
-- ORDER BY routine_name;
-- -- Should show 4 functions

-- 3. Verify permissions:
-- SELECT routine_name, grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
-- AND routine_name LIKE '%amazon_ads_credentials%'
-- ORDER BY routine_name, grantee;

-- =====================================================
-- IMPORTANT SECURITY NOTES
-- =====================================================
-- 1. ENCRYPTION KEY: Must be stored in Edge Function environment variable
--    DO NOT store in database, code repository, or logs
--    Generate with: openssl rand -base64 32
--
-- 2. KEY ROTATION: To rotate encryption key:
--    a) Decrypt all credentials with old key
--    b) Re-encrypt with new key
--    c) Update Edge Function environment variable
--
-- 3. BACKUP: Database backups will contain encrypted credentials
--    Keep encryption key secure separately
--
-- 4. LOGGING: Never log decrypted credentials
--    Functions use RAISE NOTICE for debugging only
--
-- 5. RLS: Functions are SECURITY DEFINER (run as postgres user)
--    Only service_role can call encrypt/decrypt functions
--    This is intentional - Edge Functions authenticate with service_role

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
