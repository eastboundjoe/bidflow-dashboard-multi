-- =====================================================
-- ROLLBACK 005: REMOVE AUTH TRIGGER
-- =====================================================
-- Purpose: Rollback migration 005_auth_trigger.sql
-- WARNING: This will not delete tenants/users already created by the trigger
-- =====================================================

-- Drop trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS invite_user_to_tenant(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS user_has_role(TEXT);
DROP FUNCTION IF EXISTS user_has_permission(TEXT);
DROP FUNCTION IF EXISTS get_user_tenant_id();

-- Verification
SELECT 'Rollback 005 complete' as status;

-- Check trigger is gone
SELECT COUNT(*) as remaining_triggers
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Should return 0
