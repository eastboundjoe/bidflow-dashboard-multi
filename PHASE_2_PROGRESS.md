# Phase 2: Multi-Tenant Edge Functions - Progress

## Status: ✅ COMPLETE - Ready for Deployment

### ✅ All Tasks Completed

1. **Phase 1 Database Migration**
   - All 5 migrations executed successfully
   - All 8 verification checks passed
   - Database is multi-tenant ready

2. **Shared Utilities Created**
   - `_shared/supabase-client-multitenant.ts` - Multi-tenant version with:
     - `createSupabaseClient()` - Service role client
     - `createSupabaseClientWithAuth()` - User-authenticated client
     - `getAmazonAdsCredentials()` - Retrieve encrypted credentials
     - `setAmazonAdsCredentials()` - Store encrypted credentials
     - `getUserContext()` - Get tenant/user/accounts for authenticated user

3. **New Edge Functions Created**
   - `get-user-context/index.ts` - Returns tenant info for logged-in user
   - `add-amazon-account/index.ts` - Stores encrypted Amazon Ads credentials

4. **Updated Edge Functions (Multi-Tenant Versions)**
   - `workflow-executor-multitenant/index.ts` - Orchestrates workflow for specific tenant
   - `report-collector-multitenant/index.ts` - Collects data with tenant_id + account_id
   - `report-processor-multitenant/index.ts` - Processes reports with multi-tenant support
   - `report-generator-multitenant/index.ts` - Generates reports filtered by tenant

### ⏳ Next Steps: Deployment

All code has been created! Now you need to:

#### 1. Generate Encryption Key

Generate a secure encryption key for credential storage:

```bash
openssl rand -base64 32
```

Store this key securely (password manager) - you'll need it for deployment.

#### 2. Add Environment Variable to Supabase

1. Go to Supabase Dashboard → Settings → Edge Functions
2. Add new environment variable:
   - Name: `ENCRYPTION_KEY`
   - Value: (the key generated above)

#### 3. Deploy Edge Functions

Since we're using modular code (imports from `_shared`), you have two options:

**Option A: Deploy using Supabase CLI**

```bash
cd /mnt/c/Users/Ramen\ Bomb/Desktop/Code/placement-optimization-functions

# Deploy all 6 functions
supabase functions deploy get-user-context
supabase functions deploy add-amazon-account
supabase functions deploy workflow-executor-multitenant
supabase functions deploy report-collector-multitenant
supabase functions deploy report-processor-multitenant
supabase functions deploy report-generator-multitenant
```

**Option B: Create Standalone Versions** (if CLI doesn't work)

We would need to create standalone deployment files that bundle all shared code inline (similar to the single-tenant deploy files).

#### 4. Store Your Credentials

Call the `add-amazon-account` function to encrypt and store your Ramen Bomb credentials:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/add-amazon-account \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "1279339718510959",
    "account_name": "Ramen Bomb - Main Account",
    "marketplace": "US",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

This will encrypt and store credentials in the database.

#### 5. Test the Multi-Tenant Workflow

Get your Ramen Bomb tenant_id and amazon_ads_account_id:

```sql
SELECT
  t.id as tenant_id,
  aa.id as amazon_ads_account_id
FROM tenants t
JOIN amazon_ads_accounts aa ON t.id = aa.tenant_id
WHERE t.slug = 'ramen-bomb-llc';
```

Then test the workflow:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/workflow-executor-multitenant \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "test_multitenant",
    "tenant_id": "YOUR_TENANT_ID",
    "amazon_ads_account_id": "YOUR_ACCOUNT_ID",
    "dry_run": true
  }'
```

#### 6. Test Report Processing

Manually trigger report processing:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-processor-multitenant \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "YOUR_TENANT_ID"}'
```

#### 7. Test Report Generation

Generate report for your tenant:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-generator-multitenant \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "YOUR_TENANT_ID",
    "format": "json"
  }'
```

## Architecture Decisions

### Multi-Tenant Request Flow

**Option 1: Service Role with Explicit tenant_id (CHOSEN)**
- Edge Functions called with service_role key
- Request body includes `tenant_id` and `amazon_ads_account_id`
- Functions explicitly filter/insert using these IDs
- Bypasses RLS, full control over tenant scoping

**Option 2: User Auth with RLS**
- Edge Functions called with user's auth token
- Get tenant_id from `get_user_tenant_id()` RLS function
- RLS policies automatically enforce tenant isolation
- More secure but less flexible for admin operations

**Why Option 1:**
- Scheduled workflows need to run without user session
- Admin operations may need cross-tenant access
- Simpler debugging (explicit tenant_id in logs)
- Consistent with current architecture

### Credential Storage

- **Phase 1**: Supabase Vault (single-tenant, 3 secrets)
- **Phase 2**: pgcrypto in amazon_ads_accounts table (multi-tenant, unlimited accounts)
- Encryption key stored in Edge Function environment variable
- AES-256 encryption via pgp_sym_encrypt/decrypt

### Data Isolation

- Database: RLS policies on all tables
- Edge Functions: Explicit tenant_id in all queries
- View: Filtered by tenant_id in WHERE clause
- Credentials: Encrypted per amazon_ads_accounts row

## Next Session TODO

1. Create multi-tenant versions of 4 existing functions
2. Create 6 standalone deployment files
3. Generate and store ENCRYPTION_KEY
4. Deploy all 6 functions to Supabase
5. Test with your Ramen Bomb tenant
6. Create Phase 3 plan (testing + production launch)
