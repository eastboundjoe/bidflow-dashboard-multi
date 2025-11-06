-- =====================================================
-- Enable Vault Extensions
-- =====================================================
-- Run this first before setting up vault
-- =====================================================

-- Enable pgsodium (encryption functions)
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Enable vault schema
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Verify extensions are enabled
SELECT '=== EXTENSIONS ENABLED ===' AS status;

SELECT
  extname AS extension_name,
  extversion AS version
FROM pg_extension
WHERE extname IN ('pgsodium', 'supabase_vault', 'pg_graphql', 'pgcrypto')
ORDER BY extname;

SELECT '=== VAULT READY ===' AS next_step;
