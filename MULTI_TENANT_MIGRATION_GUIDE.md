# Multi-Tenant SaaS Migration Guide

## Overview
This guide walks you through migrating the Amazon Placement Optimization system from single-tenant to multi-tenant SaaS.

**Configuration**:
- Credentials: Encrypted in database with pgcrypto
- Onboarding: Supabase Auth with automatic tenant creation
- Existing Data: Migrated to "Ramen Bomb LLC" tenant
- Approach: 4-phase rollout

## Phase 1: Database Schema ✅ (Files Created)

### Migration Files
1. `migrations/001_add_multi_tenant_tables.sql` - Creates tenants, users, amazon_ads_accounts tables
2. `migrations/002_add_tenant_id_columns.sql` - Adds tenant_id to existing tables, backfills data
3. `migrations/003_update_view.sql` - Updates view for multi-tenant support
4. `migrations/004_encryption_functions.sql` - Credential encryption/decryption functions
5. `migrations/005_auth_trigger.sql` - Auto-create tenant on user signup

### Execution Order
```bash
# In Supabase SQL Editor, run in this order:
psql < migrations/001_add_multi_tenant_tables.sql
psql < migrations/002_add_tenant_id_columns.sql
psql < migrations/003_update_view.sql
psql < migrations/004_encryption_functions.sql
psql < migrations/005_auth_trigger.sql
```

### Verification
```sql
-- 1. Check tenant created
SELECT * FROM tenants WHERE slug = 'ramen-bomb-llc';

-- 2. Check all data has tenant_id
SELECT
  (SELECT COUNT(*) FROM portfolios WHERE tenant_id IS NULL) as null_portfolios,
  (SELECT COUNT(*) FROM campaigns WHERE tenant_id IS NULL) as null_campaigns;
-- Should return 0, 0

-- 3. Check view works
SELECT COUNT(*) FROM view_placement_optimization_report;
-- Should return same count as before migration

-- 4. Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('tenants', 'users', 'amazon_ads_accounts', 'portfolios', 'campaigns');
-- All should show rowsecurity = true
```

## Phase 2: Edge Functions (TODO)

### Files to Create
- `report-collector-multitenant.ts` - Multi-tenant data collector
- `report-processor-multitenant.ts` - Multi-tenant report processor
- `workflow-executor-multitenant.ts` - Multi-tenant workflow orchestrator
- `scheduled-workflow-runner.ts` - Automated scheduler for all tenants
- `get-user-context.ts` - Returns user's tenant info (for frontend)
- `add-amazon-account.ts` - Allows users to add Amazon credentials

### Key Changes from Single-Tenant
```typescript
// OLD (single-tenant):
const { execution_id, dry_run } = body;

// NEW (multi-tenant):
const { tenant_id, amazon_ads_account_id, execution_id, dry_run } = body;

// Fetch credentials for specific account
const credentials = await getCredentials(amazon_ads_account_id);

// Include tenant_id in all database operations
await supabase.from('portfolios').insert({
  tenant_id,
  amazon_ads_account_id,
  portfolio_id,
  // ...
});
```

### Deployment
```bash
# Deploy all functions
cd placement-optimization-functions
supabase functions deploy report-collector-mt
supabase functions deploy report-processor-mt
supabase functions deploy workflow-executor-mt
supabase functions deploy scheduled-workflow-runner
supabase functions deploy get-user-context
supabase functions deploy add-amazon-account

# Set environment variables
supabase secrets set CREDENTIAL_ENCRYPTION_KEY="your-256-bit-key"
```

## Phase 3: Authentication & Testing (TODO)

### Configure Supabase Auth
1. Dashboard → Authentication → Providers → Enable Email
2. Dashboard → Authentication → Email Templates → Customize welcome email
3. Dashboard → Authentication → URL Configuration → Set redirect URLs

### User Signup Flow
```
1. User visits app → clicks "Sign Up"
2. Enters email/password → Supabase Auth creates auth.users record
3. Database trigger fires → creates tenant + user record automatically
4. User redirected to onboarding: "Connect Your Amazon Ads Account"
5. User submits credentials → Edge Function encrypts and stores
6. System runs first workflow → user sees their data
```

### Integration Tests
```bash
# Test signup flow
./test-auth-flow.sh

# Test data isolation
./test-multi-tenant.sh

# Test Amazon account connection
curl -X POST .../add-amazon-account \
  -H "Authorization: Bearer USER_JWT" \
  -d '{
    "account_name": "My Amazon Account",
    "profile_id": "1234567890",
    "client_id": "...",
    "client_secret": "...",
    "refresh_token": "..."
  }'
```

## Phase 4: Production Deployment (TODO)

### Pre-Deployment Checklist
- [ ] All migration SQL executed successfully
- [ ] All Edge Functions deployed
- [ ] Environment variables set (CREDENTIAL_ENCRYPTION_KEY)
- [ ] Supabase Auth configured
- [ ] Integration tests passing
- [ ] Rollback scripts ready
- [ ] Backup created

### Deployment Steps
1. Run Phase 1 migrations
2. Deploy Phase 2 Edge Functions
3. Configure Supabase Auth
4. Update pg_cron job to use `scheduled-workflow-runner`
5. Test with Ramen Bomb tenant (your data)
6. Invite test user to verify new tenant flow
7. Monitor first automated run

### Monitoring
```sql
-- Monitor workflow executions by tenant
SELECT
  t.name as tenant_name,
  aa.account_name,
  w.status,
  w.started_at,
  w.completed_at,
  w.error_message
FROM workflow_executions w
JOIN tenants t ON w.tenant_id = t.id
JOIN amazon_ads_accounts aa ON w.amazon_ads_account_id = aa.id
WHERE w.started_at > NOW() - INTERVAL '24 hours'
ORDER BY w.started_at DESC;

-- Check tenant activity
SELECT
  t.name,
  COUNT(DISTINCT aa.id) as accounts,
  COUNT(DISTINCT w.id) as workflows_30d,
  MAX(w.started_at) as last_workflow
FROM tenants t
LEFT JOIN amazon_ads_accounts aa ON t.id = aa.tenant_id
LEFT JOIN workflow_executions w ON t.id = w.tenant_id
WHERE w.started_at > NOW() - INTERVAL '30 days'
GROUP BY t.id, t.name;
```

## Rollback Strategy

Each phase has a rollback script. If issues occur:

### Rollback Phase 2 (Edge Functions)
```bash
# Redeploy original single-tenant functions
git checkout HEAD~1 -- report-collector-deploy.ts
supabase functions deploy report-collector
# Repeat for other functions
```

### Rollback Phase 1 (Database)
```bash
# Run rollback script
psql < migrations/rollback_002.sql
psql < migrations/rollback_001.sql

# Verify original system still works
SELECT COUNT(*) FROM view_placement_optimization_report;
```

## Next Steps

After successful migration:

1. **User Documentation**: Create user guide for signup, adding Amazon accounts, viewing reports
2. **Admin Dashboard**: Build UI for managing tenants, viewing system health
3. **Billing Integration**: Add usage tracking and Stripe integration
4. **Webhooks**: Notify users when reports complete
5. **Multi-Marketplace**: Support CA, UK, EU, JP Amazon marketplaces

## Support

If you encounter issues during migration:

1. Check verification queries in each migration file
2. Review Supabase logs for Edge Function errors
3. Verify RLS policies aren't blocking legitimate access
4. Check encryption key is set correctly
5. Test with dry_run=true first

## File Structure

```
/mnt/c/Users/Ramen Bomb/Desktop/Code/
├── migrations/
│   ├── 001_add_multi_tenant_tables.sql ✅
│   ├── 002_add_tenant_id_columns.sql ✅
│   ├── 003_update_view.sql (TODO)
│   ├── 004_encryption_functions.sql (TODO)
│   ├── 005_auth_trigger.sql (TODO)
│   ├── rollback_001.sql (TODO)
│   └── rollback_002.sql (TODO)
├── report-collector-multitenant.ts (TODO)
├── report-processor-multitenant.ts (TODO)
├── workflow-executor-multitenant.ts (TODO)
├── scheduled-workflow-runner.ts (TODO)
├── get-user-context.ts (TODO)
├── add-amazon-account.ts (TODO)
├── test-auth-flow.sh (TODO)
├── test-multi-tenant.sh (TODO)
└── MULTI_TENANT_MIGRATION_GUIDE.md ✅
```

## Estimated Timeline

- **Phase 1 (Database)**: 3-4 hours (including testing)
- **Phase 2 (Functions)**: 4-5 hours (including deployment)
- **Phase 3 (Auth & Testing)**: 5-7 hours (including integration tests)
- **Phase 4 (Production)**: 3-4 hours (including monitoring)

**Total**: 15-20 hours over 2-3 weeks

## Current Status

✅ Phase 1: Migration files 001 and 002 created
⏳ Phase 1: Migration files 003, 004, 005 remaining
⏳ Phase 2: Edge Function files to create
⏳ Phase 3: Testing scripts to create
⏳ Phase 4: Documentation to create
