-- =====================================================
-- ROLLBACK 004: REMOVE ENCRYPTION FUNCTIONS
-- =====================================================
-- Purpose: Rollback migration 004_encryption_functions.sql
-- WARNING: This will not decrypt or delete existing encrypted credentials
-- =====================================================

-- Drop functions
DROP FUNCTION IF EXISTS clear_amazon_ads_credentials(UUID);
DROP FUNCTION IF EXISTS has_amazon_ads_credentials(UUID);
DROP FUNCTION IF EXISTS get_amazon_ads_credentials(UUID, TEXT);
DROP FUNCTION IF EXISTS set_amazon_ads_credentials(UUID, TEXT, TEXT, TEXT, TEXT);

-- Verification
SELECT 'Rollback 004 complete' as status;

-- Check functions are gone
SELECT COUNT(*) as remaining_functions
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%amazon_ads_credentials%';
-- Should return 0
