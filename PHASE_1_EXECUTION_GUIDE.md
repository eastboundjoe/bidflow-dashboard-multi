# Phase 1 Execution Guide: Database Migration

## Overview
This guide walks you through executing Phase 1 of the multi-tenant migration. Phase 1 adds the database foundation for multi-tenancy while keeping your existing system fully operational.

**Time Required**: 30-45 minutes (including verification)
**Downtime**: None (migrations are backward compatible)
**Reversible**: Yes (rollback scripts included)

## Pre-Flight Checklist

Before starting, ensure:

- [ ] You have access to Supabase Dashboard (SQL Editor)
- [ ] Your existing system is working (run a test workflow)
- [ ] You have a recent database backup
- [ ] You've reviewed all migration files
- [ ] You understand the rollback procedure

## Step-by-Step Execution

### Step 1: Create Database Backup

**In Supabase Dashboard:**
1. Go to Database → Backups
2. Click "Create backup"
3. Wait for backup to complete (~2-5 minutes)
4. Verify backup exists and is recent

**Alternative (if you have direct psql access):**
```bash
pg_dump -h your-db-host -U postgres -d postgres > backup_before_migration.sql
```

### Step 2: Run Migration 001 - Core Tables

**File**: `migrations/001_add_multi_tenant_tables.sql`

1. Open Supabase Dashboard → SQL Editor
2. Create new query
3. Copy entire contents of `001_add_multi_tenant_tables.sql`
4. Paste into SQL Editor
5. Click "Run" (or Cmd/Ctrl + Enter)

**Expected Output:**
```
✓ Extension pgcrypto created
✓ Extension uuid-ossp created
✓ Table tenants created
✓ Table users created
✓ Table amazon_ads_accounts created
✓ Indexes created
✓ RLS policies created
✓ Triggers created
```

**Verification:**
```sql
-- Should return 3 rows
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'users', 'amazon_ads_accounts');

-- Should show rowsecurity = true for all 3
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'users', 'amazon_ads_accounts');
```

**Troubleshooting:**
- If "relation already exists" errors → Tables already exist, safe to skip
- If "permission denied" → You need postgres/service_role permissions
- If "extension does not exist" → pgcrypto not available (contact Supabase support)

### Step 3: Run Migration 002 - Add tenant_id Columns

**File**: `migrations/002_add_tenant_id_columns.sql`

1. In SQL Editor, create new query
2. Copy entire contents of `002_add_tenant_id_columns.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected Output:**
```
✓ Columns added to 6 tables
✓ Indexes created
✓ Tenant "Ramen Bomb LLC" created
✓ Amazon Ads account created for profile 1279339718510959
✓ Backfilled X workflow_executions rows
✓ Backfilled X report_requests rows
✓ Backfilled X portfolios rows
✓ Backfilled X campaigns rows
✓ Backfilled X campaign_performance rows
✓ Backfilled X placement_performance rows
✓ All tables have tenant_id populated (no NULL values)
✓ Constraints updated
✓ RLS policies created
```

**Critical Verification:**
```sql
-- Step 1: Check "Ramen Bomb LLC" tenant exists
SELECT * FROM tenants WHERE slug = 'ramen-bomb-llc';
-- Should return 1 row with your tenant

-- Step 2: Check amazon_ads_accounts
SELECT id, tenant_id, profile_id, account_name
FROM amazon_ads_accounts;
-- Should show your profile_id (1279339718510959)

-- Step 3: Verify NO NULL tenant_id values
SELECT
  (SELECT COUNT(*) FROM workflow_executions WHERE tenant_id IS NULL) as null_workflow,
  (SELECT COUNT(*) FROM portfolios WHERE tenant_id IS NULL) as null_portfolios,
  (SELECT COUNT(*) FROM campaigns WHERE tenant_id IS NULL) as null_campaigns,
  (SELECT COUNT(*) FROM campaign_performance WHERE tenant_id IS NULL) as null_campaign_perf,
  (SELECT COUNT(*) FROM placement_performance WHERE tenant_id IS NULL) as null_placement_perf;
-- All should be 0

-- Step 4: Check your existing data count
SELECT
  (SELECT COUNT(*) FROM portfolios) as portfolios,
  (SELECT COUNT(*) FROM campaigns) as campaigns,
  (SELECT COUNT(*) FROM campaign_performance) as campaign_perf,
  (SELECT COUNT(*) FROM placement_performance) as placement_perf;
-- Should match counts before migration
```

**Troubleshooting:**
- If "tenant_id cannot be null" error → Run Step 4 backfill again
- If "Ramen Bomb tenant not found" → Check Step 3 created the tenant
- If counts don't match → Data loss, ROLLBACK immediately

### Step 4: Run Migration 003 - Update View

**File**: `migrations/003_update_view.sql`

1. In SQL Editor, create new query
2. Copy entire contents of `003_update_view.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected Output:**
```
✓ View dropped
✓ View created with multi-tenant support
✓ RLS policy created
✓ Permissions granted
```

**Verification:**
```sql
-- Check view exists and works
SELECT COUNT(*) FROM view_placement_optimization_report;
-- Should return same or more rows (now shows all 3 placements per campaign)

-- Check new columns exist
SELECT "Tenant Name", "Amazon Account", COUNT(*) as campaigns
FROM view_placement_optimization_report
GROUP BY "Tenant Name", "Amazon Account";
-- Should show "Ramen Bomb LLC" with your campaign count

-- Sample data
SELECT
  "Tenant Name",
  "Amazon Account",
  "Campaign",
  "Portfolio",
  "Placement Type",
  "Spend-30"
FROM view_placement_optimization_report
LIMIT 10;
-- Should show familiar data with new tenant/account columns
```

**Troubleshooting:**
- If "view does not exist" after drop → Expected, continue
- If query times out → View calculation might be slow, check indexes
- If results empty → Check tenant_id joins in view definition

### Step 5: Run Migration 004 - Encryption Functions

**File**: `migrations/004_encryption_functions.sql`

1. In SQL Editor, create new query
2. Copy entire contents of `004_encryption_functions.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected Output:**
```
✓ Extension pgcrypto verified
✓ Function set_amazon_ads_credentials created
✓ Function get_amazon_ads_credentials created
✓ Function has_amazon_ads_credentials created
✓ Function clear_amazon_ads_credentials created
✓ Permissions granted
```

**Verification:**
```sql
-- Check functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%amazon_ads_credentials%'
ORDER BY routine_name;
-- Should show 4 functions

-- Test encryption/decryption (IMPORTANT: Use strong key in production)
DO $$
DECLARE
  test_account_id UUID;
  test_key TEXT := 'test-encryption-key-must-be-32-characters-minimum-length';
  decrypted_id TEXT;
BEGIN
  -- Get your account ID
  SELECT id INTO test_account_id
  FROM amazon_ads_accounts
  WHERE profile_id = '1279339718510959'
  LIMIT 1;

  -- Encrypt test credentials
  PERFORM set_amazon_ads_credentials(
    test_account_id,
    'test_client_id',
    'test_client_secret',
    'test_refresh_token',
    test_key
  );

  -- Decrypt and verify
  SELECT client_id INTO decrypted_id
  FROM get_amazon_ads_credentials(test_account_id, test_key);

  IF decrypted_id = 'test_client_id' THEN
    RAISE NOTICE '✅ Encryption/decryption working';
  ELSE
    RAISE EXCEPTION '❌ Decryption failed';
  END IF;

  -- Clean up
  PERFORM clear_amazon_ads_credentials(test_account_id);
END $$;
```

**Troubleshooting:**
- If "function already exists" → Safe to skip, functions already created
- If decryption test fails → Check encryption key length (must be >= 32 chars)
- If "pgcrypto not available" → Extension not installed (check migration 001)

### Step 6: Run Migration 005 - Auth Trigger

**File**: `migrations/005_auth_trigger.sql`

1. In SQL Editor, create new query
2. Copy entire contents of `005_auth_trigger.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected Output:**
```
✓ Function get_user_tenant_id created
✓ Function user_has_permission created
✓ Function user_has_role created
✓ Function handle_new_user created
✓ Trigger on_auth_user_created created
✓ Function invite_user_to_tenant created
✓ Permissions granted
```

**Verification:**
```sql
-- Check trigger exists
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
-- Should show 1 row

-- Test trigger by creating test user (in Dashboard → Authentication)
-- Then query:
SELECT
  u.email,
  u.role,
  t.name as tenant_name,
  t.slug
FROM users u
JOIN tenants t ON u.tenant_id = t.id
ORDER BY u.created_at DESC
LIMIT 5;
-- Should show test user with auto-created tenant
```

**Troubleshooting:**
- If "trigger already exists" → Safe to skip
- If test user signup doesn't create tenant → Check function logs
- If "auth.users not accessible" → Supabase Auth not enabled

### Step 7: Final Verification

Run this comprehensive verification query:

```sql
-- FINAL VERIFICATION CHECKLIST
SELECT
  '1. Core tables exist' as check_name,
  CASE WHEN COUNT(*) = 3 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND tablename IN ('tenants', 'users', 'amazon_ads_accounts')

UNION ALL

SELECT
  '2. Tenant columns added to 6 tables',
  CASE WHEN COUNT(*) = 12 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_name IN ('tenant_id', 'amazon_ads_account_id')
AND table_name IN ('workflow_executions', 'report_requests', 'portfolios', 'campaigns', 'campaign_performance', 'placement_performance')

UNION ALL

SELECT
  '3. Ramen Bomb tenant exists',
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM tenants
WHERE slug = 'ramen-bomb-llc'

UNION ALL

SELECT
  '4. No NULL tenant_id values',
  CASE WHEN
    (SELECT COUNT(*) FROM portfolios WHERE tenant_id IS NULL) = 0 AND
    (SELECT COUNT(*) FROM campaigns WHERE tenant_id IS NULL) = 0 AND
    (SELECT COUNT(*) FROM campaign_performance WHERE tenant_id IS NULL) = 0 AND
    (SELECT COUNT(*) FROM placement_performance WHERE tenant_id IS NULL) = 0
  THEN '✅ PASS' ELSE '❌ FAIL' END

UNION ALL

SELECT
  '5. View works',
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM view_placement_optimization_report

UNION ALL

SELECT
  '6. Encryption functions exist',
  CASE WHEN COUNT(*) = 4 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%amazon_ads_credentials%'

UNION ALL

SELECT
  '7. Auth trigger exists',
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'

UNION ALL

SELECT
  '8. RLS enabled on all tables',
  CASE WHEN COUNT(*) = 9 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true
AND tablename IN ('tenants', 'users', 'amazon_ads_accounts', 'portfolios', 'campaigns', 'campaign_performance', 'placement_performance', 'workflow_executions', 'report_requests');

-- All checks should show ✅ PASS
```

## Step 8: Test Your Existing System

**CRITICAL**: Verify your existing system still works:

1. **Test the view:**
   ```sql
   SELECT * FROM view_placement_optimization_report LIMIT 10;
   ```
   Should show your familiar data with 2 new columns (Tenant Name, Amazon Account)

2. **Test workflow (if you have Edge Functions deployed):**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/workflow-executor \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"execution_id": "test_after_phase1", "dry_run": true}'
   ```
   Should complete successfully (though functions aren't multi-tenant yet)

3. **Check data counts:**
   ```sql
   SELECT
     (SELECT COUNT(*) FROM portfolios) as portfolios,
     (SELECT COUNT(*) FROM campaigns) as campaigns,
     (SELECT COUNT(*) FROM campaign_performance) as campaign_perf,
     (SELECT COUNT(*) FROM placement_performance) as placement_perf;
   ```
   Should match pre-migration counts

## Rollback Procedure

If anything goes wrong, rollback in REVERSE order:

```sql
-- Rollback in reverse order (005 → 004 → 003 → 002 → 001)
\i migrations/rollback_005.sql  -- Remove auth trigger
\i migrations/rollback_004.sql  -- Remove encryption functions
\i migrations/rollback_003.sql  -- Restore original view
\i migrations/rollback_002.sql  -- Remove tenant_id columns
\i migrations/rollback_001.sql  -- Remove core tables
```

**In Supabase SQL Editor** (run each file separately):
1. Copy contents of `rollback_005.sql`, run
2. Copy contents of `rollback_004.sql`, run
3. Copy contents of `rollback_003.sql`, run
4. Copy contents of `rollback_002.sql`, run
5. Copy contents of `rollback_001.sql`, run

Then verify your system still works with original structure.

## What Changed?

After Phase 1 migration:

### ✅ What Still Works (Backward Compatible)
- Your existing data (all preserved under "Ramen Bomb LLC" tenant)
- Your existing view (2 new columns added, but old queries still work)
- Your existing Edge Functions (will work until Phase 2 update)
- All workflows and reports

### ✨ What's New
- 3 new tables: `tenants`, `users`, `amazon_ads_accounts`
- `tenant_id` and `amazon_ads_account_id` columns in all 6 existing tables
- RLS policies on all tables (data isolation ready)
- Encryption functions for storing credentials
- Auth trigger for automatic tenant creation on signup
- View now shows "Tenant Name" and "Amazon Account" columns

### ⏳ What's Not Ready Yet
- Edge Functions don't use tenant_id yet (Phase 2)
- Users can't sign up yet (need Supabase Auth configuration)
- Can't add new tenants yet (need Phase 2 functions)

## Next Steps

After successful Phase 1:

1. **Review Phase 2**: Edge Function modifications
2. **Generate encryption key**: `openssl rand -base64 32`
3. **Store key securely**: Add to password manager
4. **Plan Phase 2 deployment**: Typically 1-2 weeks after Phase 1

## Troubleshooting

### Common Issues

**Issue**: "relation already exists" errors
**Solution**: Tables already exist, safe to continue

**Issue**: Migration scripts timeout
**Solution**: Run in smaller chunks, contact Supabase support for large databases

**Issue**: Data counts don't match before/after
**Solution**: ROLLBACK immediately, investigate before retrying

**Issue**: View returns no rows
**Solution**: Check JOIN conditions include tenant_id

**Issue**: RLS blocking service_role
**Solution**: Verify service_role policies exist with USING (true)

### Getting Help

If you encounter issues:
1. Check verification queries in each migration file
2. Review Supabase logs (Dashboard → Logs)
3. Check this guide's troubleshooting sections
4. Review `MULTI_TENANT_MIGRATION_GUIDE.md`
5. Use rollback scripts if needed

## Success Criteria

Phase 1 is complete when:
- [✅] All 8 verification checks pass
- [✅] Your existing system still works (view, workflows)
- [✅] "Ramen Bomb LLC" tenant exists
- [✅] All existing data has tenant_id populated
- [✅] No NULL tenant_id values in any table
- [✅] Encryption functions tested successfully
- [✅] Auth trigger verified

**Congratulations!** 🎉 You've completed Phase 1 of the multi-tenant migration. Your system now has a solid multi-tenant foundation while remaining fully backward compatible.

Ready for Phase 2? Review the Edge Function modifications guide.
