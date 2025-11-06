# Supabase Vault Setup Guide
## Amazon Placement Optimization System - Credential Management

**Project:** Amazon Placement Optimization System
**Date:** 2025-11-06
**Supabase Project ID:** phhatzkwykqdqfkxinvr

---

## Table of Contents
1. [Overview](#overview)
2. [Quick Start (5 Minutes)](#quick-start-5-minutes)
3. [Understanding Supabase Vault](#understanding-supabase-vault)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Updating Credentials](#updating-credentials)
6. [Using Credentials in Edge Functions](#using-credentials-in-edge-functions)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Supabase Vault is a secure secrets management system built into PostgreSQL that:
- Encrypts secrets at rest using AES-256-GCM encryption
- Provides access control through PostgreSQL security policies
- Stores secrets in a dedicated `vault` schema
- Integrates seamlessly with Edge Functions

### What We're Storing

We need to securely store three Amazon Ads API credentials:
1. **Client ID** - Identifies your application to Amazon
2. **Client Secret** - Authenticates your application
3. **Refresh Token** - Maintains long-term API access

### Why Vault?

**Security Benefits:**
- Encrypted at rest (AES-256-GCM)
- Encrypted in transit (TLS)
- Access controlled via database security policies
- Audit trail of access (optional)

**Operational Benefits:**
- No need for external secret managers (KMS, AWS Secrets Manager)
- Version controlled through SQL migrations
- Testable in local development
- Free with Supabase (no additional cost)

---

## Quick Start (5 Minutes)

### Prerequisites
- Database deployed (create_database.sql executed successfully)
- Amazon Ads API credentials obtained from Amazon Ads Console
- Access to Supabase SQL Editor

### 1. Execute Vault Setup (2 minutes)

Navigate to Supabase SQL Editor:
```
https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/sql/new
```

**Steps:**
1. Open `setup_vault.sql` in your code editor
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click "Run" button
5. Wait for success message

**Expected Output:**
```
VAULT SETUP COMPLETED SUCCESSFULLY
```

### 2. Update Credentials (2 minutes)

**IMPORTANT:** The initial setup uses placeholder values. Update them immediately!

Open `update_vault_credentials.sql` and find the "OPTION 1" section:

```sql
BEGIN;

UPDATE vault.secrets
SET secret = 'amzn1.application-oa2-client.YOUR_ACTUAL_CLIENT_ID',
    updated_at = NOW()
WHERE name = 'amazon_ads_client_id';

UPDATE vault.secrets
SET secret = 'YOUR_ACTUAL_CLIENT_SECRET_HERE',
    updated_at = NOW()
WHERE name = 'amazon_ads_client_secret';

UPDATE vault.secrets
SET secret = 'Atzr|YOUR_ACTUAL_REFRESH_TOKEN_HERE',
    updated_at = NOW()
WHERE name = 'amazon_ads_refresh_token';

COMMIT;
```

1. Replace placeholder values with your real credentials
2. Copy and paste into SQL Editor
3. Run the query
4. Verify "Updated successfully" message for all 3 credentials

### 3. Verify Setup (1 minute)

Run `verify_vault.sql` to confirm everything is configured correctly:

```bash
# Expected results:
✓ Vault Extension Status: PASS
✓ Secrets Existence Check: PASS (3/3 secrets)
✓ Helper Function Check: PASS
✓ Placeholder Check: PASS (no placeholders)
```

**That's it!** Your vault is now configured and ready for Edge Functions.

---

## Understanding Supabase Vault

### Architecture

```
┌─────────────────────────────────────────────────┐
│          Edge Function (service_role)           │
│  • Runs with elevated privileges                │
│  • Can call get_amazon_ads_credentials()        │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│     public.get_amazon_ads_credentials()         │
│  • SECURITY DEFINER function                    │
│  • Retrieves secrets from vault                 │
│  • Returns JSON with all credentials            │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│            vault.decrypted_secrets              │
│  • Decrypts secrets on-the-fly                  │
│  • Requires special permissions to access       │
│  • Never exposed to client applications         │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│              vault.secrets (table)              │
│  • Stores encrypted secrets                     │
│  • AES-256-GCM encryption at rest               │
│  • Only accessible by postgres role             │
└─────────────────────────────────────────────────┘
```

### Security Model

**Access Tiers:**
1. **Client Applications** (anon, authenticated roles)
   - NO access to vault
   - Cannot call credential functions
   - Cannot read vault tables

2. **Edge Functions** (service_role)
   - CAN call `get_amazon_ads_credentials()`
   - Cannot directly access vault tables
   - Returns only what the function exposes

3. **Database Administrator** (postgres role)
   - Full vault access
   - Can read/write secrets
   - Used only for setup and updates

### What Gets Created

**Tables:**
- `vault.secrets` - Encrypted credential storage
- `public.vault_access_log` - Audit trail (optional)

**Functions:**
- `public.get_amazon_ads_credentials()` - Basic credential retrieval
- `public.get_amazon_ads_credentials_audited()` - With audit logging
- `public.update_amazon_ads_credential()` - Safe credential updates

**Views:**
- `vault.decrypted_secrets` - On-the-fly decryption view (internal)

---

## Step-by-Step Setup

### Step 1: Enable Vault Extension

The vault extension is pre-installed in Supabase but needs to be enabled:

```sql
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
```

**What this does:**
- Creates the `vault` schema
- Sets up encryption infrastructure
- Creates `vault.secrets` table

**Verification:**
```sql
SELECT * FROM pg_extension WHERE extname = 'supabase_vault';
```

### Step 2: Store Secrets

Insert your three credentials into the vault:

```sql
INSERT INTO vault.secrets (name, secret)
VALUES ('amazon_ads_client_id', 'amzn1.application-oa2-client.abc123')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

**Key points:**
- `name` is the unique identifier (use consistent naming)
- `secret` is automatically encrypted when inserted
- `ON CONFLICT` allows safe re-runs (updates instead of errors)

**All three secrets:**
```sql
-- Client ID
INSERT INTO vault.secrets (name, secret)
VALUES ('amazon_ads_client_id', 'your_client_id_here')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

-- Client Secret
INSERT INTO vault.secrets (name, secret)
VALUES ('amazon_ads_client_secret', 'your_client_secret_here')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

-- Refresh Token
INSERT INTO vault.secrets (name, secret)
VALUES ('amazon_ads_refresh_token', 'your_refresh_token_here')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

### Step 3: Create Helper Function

This function allows Edge Functions to retrieve credentials safely:

```sql
CREATE OR REPLACE FUNCTION public.get_amazon_ads_credentials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    client_id_secret text;
    client_secret_secret text;
    refresh_token_secret text;
BEGIN
    -- Retrieve secrets from vault
    SELECT decrypted_secret INTO client_id_secret
    FROM vault.decrypted_secrets
    WHERE name = 'amazon_ads_client_id';

    SELECT decrypted_secret INTO client_secret_secret
    FROM vault.decrypted_secrets
    WHERE name = 'amazon_ads_client_secret';

    SELECT decrypted_secret INTO refresh_token_secret
    FROM vault.decrypted_secrets
    WHERE name = 'amazon_ads_refresh_token';

    -- Verify all credentials are present
    IF client_id_secret IS NULL OR
       client_secret_secret IS NULL OR
       refresh_token_secret IS NULL THEN
        RAISE EXCEPTION 'One or more Amazon Ads API credentials are missing';
    END IF;

    -- Return as JSON
    RETURN jsonb_build_object(
        'client_id', client_id_secret,
        'client_secret', client_secret_secret,
        'refresh_token', refresh_token_secret
    );
END;
$$;
```

**Function characteristics:**
- `SECURITY DEFINER` - Runs with creator's privileges (postgres role)
- `SET search_path` - Prevents schema hijacking attacks
- Returns `jsonb` - Easy to parse in TypeScript
- Validates all secrets exist before returning

### Step 4: Set Permissions

Grant access ONLY to service_role (Edge Functions):

```sql
-- Grant to service_role
GRANT EXECUTE ON FUNCTION public.get_amazon_ads_credentials() TO service_role;

-- Explicitly deny everyone else
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_amazon_ads_credentials() FROM authenticated;
```

**Security principle:**
- Edge Functions use `service_role` key
- Client apps use `anon` or `authenticated` roles
- Only Edge Functions should access secrets

### Step 5: Verify Setup

Run verification queries to ensure everything works:

```sql
-- Check secrets exist
SELECT name, created_at, updated_at
FROM vault.secrets
WHERE name LIKE 'amazon_ads_%';

-- Test retrieval
SELECT public.get_amazon_ads_credentials();
```

---

## Updating Credentials

### When to Update

Update credentials when:
1. **Initial setup** - Replace placeholders with real values
2. **Token expiration** - Refresh token expires or is revoked
3. **Security rotation** - Regular rotation (every 90-180 days)
4. **Compromise** - Credentials may have been exposed

### Method 1: Direct UPDATE Query

```sql
UPDATE vault.secrets
SET secret = 'new_credential_value',
    updated_at = NOW()
WHERE name = 'amazon_ads_client_id';
```

**Pros:** Simple, direct
**Cons:** No validation, easy to make mistakes

### Method 2: Helper Function (Recommended)

```sql
SELECT public.update_amazon_ads_credential(
    'amazon_ads_client_id',
    'amzn1.application-oa2-client.newvalue123'
);
```

**Pros:**
- Validates input (no empty values, no placeholders)
- Prevents typos in secret names
- Provides clear error messages

**Cons:** Slightly more complex

### Method 3: Batch Update with Transaction

```sql
BEGIN;

UPDATE vault.secrets
SET secret = 'new_client_id', updated_at = NOW()
WHERE name = 'amazon_ads_client_id';

UPDATE vault.secrets
SET secret = 'new_client_secret', updated_at = NOW()
WHERE name = 'amazon_ads_client_secret';

UPDATE vault.secrets
SET secret = 'new_refresh_token', updated_at = NOW()
WHERE name = 'amazon_ads_refresh_token';

-- Verify before committing
SELECT name, updated_at FROM vault.secrets WHERE name LIKE 'amazon_ads_%';

COMMIT;
```

**Pros:** All-or-nothing update, safe
**Cons:** More verbose

### Credential Formats

**Amazon Ads API Credential Formats:**

1. **Client ID**
   - Format: `amzn1.application-oa2-client.[alphanumeric]`
   - Example: `amzn1.application-oa2-client.abc123def456ghi789`
   - Length: ~50 characters

2. **Client Secret**
   - Format: 64-character alphanumeric string
   - Example: `abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567`
   - Length: 64 characters

3. **Refresh Token**
   - Format: `Atzr|[long alphanumeric string with special chars]`
   - Example: `Atzr|IwEBIJK1234567890abcdefghijklmnopqrstuvwxyz...`
   - Length: 300-500 characters

---

## Using Credentials in Edge Functions

### TypeScript Example

Create an Edge Function that retrieves credentials:

```typescript
// supabase/functions/workflow-executor/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AmazonAdsCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

serve(async (req) => {
  try {
    // Create Supabase client with SERVICE_ROLE key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Retrieve credentials from vault
    const { data, error } = await supabase
      .rpc('get_amazon_ads_credentials');

    if (error) {
      throw new Error(`Failed to retrieve credentials: ${error.message}`);
    }

    const credentials = data as AmazonAdsCredentials;

    // Use credentials to authenticate with Amazon Ads API
    const accessToken = await getAmazonAccessToken(credentials);

    // Make API calls...
    const reportData = await fetchAmazonReport(accessToken);

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

async function getAmazonAccessToken(
  credentials: AmazonAdsCredentials
): Promise<string> {
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refresh_token,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Amazon Auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchAmazonReport(accessToken: string): Promise<any> {
  // Implementation of report fetching logic
  // Uses accessToken for authentication
}
```

### Key Points for Edge Functions

1. **Use SERVICE_ROLE key:**
   ```typescript
   const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
   ```

2. **Call RPC function:**
   ```typescript
   const { data, error } = await supabase.rpc('get_amazon_ads_credentials');
   ```

3. **Handle errors:**
   ```typescript
   if (error) {
     throw new Error(`Failed to retrieve credentials: ${error.message}`);
   }
   ```

4. **Never log credentials:**
   ```typescript
   // BAD - Don't do this!
   console.log('Credentials:', credentials);

   // GOOD - Log without sensitive data
   console.log('Credentials retrieved successfully');
   ```

### Environment Variables Required

Set these in your Supabase project dashboard:
```
SUPABASE_URL=https://phhatzkwykqdqfkxinvr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Security Best Practices

### 1. Never Expose Credentials to Clients

**Bad:**
```typescript
// Client-side code (NEVER DO THIS!)
const credentials = await supabase.rpc('get_amazon_ads_credentials');
```

**Good:**
```typescript
// Edge Function only (server-side)
const credentials = await supabase.rpc('get_amazon_ads_credentials');
```

### 2. Use Auditing for Compliance

Enable the audited version for production:

```typescript
// Instead of:
const { data } = await supabase.rpc('get_amazon_ads_credentials');

// Use:
const { data } = await supabase.rpc('get_amazon_ads_credentials_audited');
```

Review audit logs regularly:
```sql
SELECT * FROM public.vault_access_log
ORDER BY accessed_at DESC
LIMIT 100;
```

### 3. Rotate Credentials Regularly

**Rotation schedule:**
- **Client ID/Secret:** Every 90-180 days
- **Refresh Token:** When expired or if suspicious activity

**Rotation process:**
1. Generate new credentials in Amazon Ads Console
2. Test new credentials in staging environment
3. Update vault using `update_vault_credentials.sql`
4. Verify Edge Functions still work
5. Revoke old credentials in Amazon console

### 4. Implement Rate Limiting

Protect against credential abuse:

```sql
-- Track credential access frequency
CREATE TABLE IF NOT EXISTS public.credential_access_rate_limit (
    function_name text PRIMARY KEY,
    access_count integer DEFAULT 0,
    window_start timestamptz DEFAULT now()
);

-- Modified function with rate limiting
CREATE OR REPLACE FUNCTION public.get_amazon_ads_credentials_rate_limited()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_count integer;
    window_age interval;
BEGIN
    -- Check rate limit (max 100 calls per hour)
    SELECT access_count, age(now(), window_start)
    INTO current_count, window_age
    FROM public.credential_access_rate_limit
    WHERE function_name = 'get_amazon_ads_credentials';

    -- Reset if window expired
    IF window_age > interval '1 hour' THEN
        UPDATE public.credential_access_rate_limit
        SET access_count = 1, window_start = now()
        WHERE function_name = 'get_amazon_ads_credentials';
    ELSIF current_count >= 100 THEN
        RAISE EXCEPTION 'Rate limit exceeded. Max 100 calls per hour.';
    ELSE
        UPDATE public.credential_access_rate_limit
        SET access_count = access_count + 1
        WHERE function_name = 'get_amazon_ads_credentials';
    END IF;

    -- Return credentials
    RETURN public.get_amazon_ads_credentials();
END;
$$;
```

### 5. Monitor for Anomalies

Set up alerts for suspicious activity:

```sql
-- Find unusual access patterns
SELECT
    date_trunc('hour', accessed_at) AS hour,
    COUNT(*) AS access_count
FROM public.vault_access_log
WHERE accessed_at > now() - interval '24 hours'
GROUP BY hour
HAVING COUNT(*) > 50  -- Alert if > 50 accesses per hour
ORDER BY hour DESC;
```

### 6. Backup Strategy

**What to backup:**
- Vault secret names (not values)
- Helper functions
- Access policies

**What NOT to backup:**
- Decrypted secret values (security risk)

**Backup approach:**
```sql
-- Export vault structure (safe to commit to git)
SELECT name, created_at, updated_at
FROM vault.secrets
WHERE name LIKE 'amazon_ads_%';

-- Keep credentials in password manager separately
```

---

## Troubleshooting

### Issue: "vault schema does not exist"

**Cause:** Vault extension not enabled

**Solution:**
```sql
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
```

### Issue: "permission denied for function get_amazon_ads_credentials"

**Cause:** Missing permissions for service_role

**Solution:**
```sql
GRANT EXECUTE ON FUNCTION public.get_amazon_ads_credentials() TO service_role;
```

### Issue: "One or more credentials are missing"

**Cause:** Secrets not inserted or incorrect names

**Solution:**
```sql
-- Check what exists
SELECT name FROM vault.secrets WHERE name LIKE 'amazon_ads_%';

-- Expected output:
-- amazon_ads_client_id
-- amazon_ads_client_secret
-- amazon_ads_refresh_token
```

### Issue: "Cannot decrypt secret"

**Cause:** Database encryption keys may have changed (rare)

**Solution:**
Contact Supabase support. This is a critical issue.

### Issue: Placeholder values still present

**Cause:** Forgot to update with real credentials

**Solution:**
Run `update_vault_credentials.sql` with your real values.

**Check:**
```sql
-- This will show if placeholders exist
WITH creds AS (
    SELECT public.get_amazon_ads_credentials() AS c
)
SELECT
    CASE
        WHEN c->>'client_id' LIKE '%your_actual_%' THEN 'UPDATE NEEDED'
        ELSE 'OK'
    END AS client_id_status,
    CASE
        WHEN c->>'client_secret' LIKE '%your_actual_%' THEN 'UPDATE NEEDED'
        ELSE 'OK'
    END AS client_secret_status,
    CASE
        WHEN c->>'refresh_token' LIKE '%your_actual_%' THEN 'UPDATE NEEDED'
        ELSE 'OK'
    END AS refresh_token_status
FROM creds;
```

### Issue: Edge Function returns 500 error

**Debugging steps:**

1. **Check Edge Function logs:**
   ```bash
   supabase functions serve workflow-executor --inspect-brk
   ```

2. **Test credential retrieval directly:**
   ```sql
   SELECT public.get_amazon_ads_credentials();
   ```

3. **Verify service_role key:**
   - Check that you're using `SUPABASE_SERVICE_ROLE_KEY`
   - Not `SUPABASE_ANON_KEY` (won't have vault access)

4. **Check function exists:**
   ```sql
   SELECT proname
   FROM pg_proc
   WHERE proname = 'get_amazon_ads_credentials';
   ```

### Issue: "function result contains no rows"

**Cause:** Function returned NULL or empty

**Solution:**
```sql
-- Debug: Check if secrets decrypt properly
SELECT
    name,
    CASE
        WHEN LENGTH(decrypted_secret) > 0 THEN 'Has value'
        ELSE 'Empty'
    END AS status
FROM vault.decrypted_secrets
WHERE name LIKE 'amazon_ads_%';
```

---

## Next Steps

After completing vault setup:

### 1. Generate TypeScript Types
```bash
npx supabase gen types typescript \
  --project-id phhatzkwykqdqfkxinvr \
  > database.types.ts
```

### 2. Set Up Local Development
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize project
supabase init

# Link to remote project
supabase link --project-ref phhatzkwykqdqfkxinvr

# Pull vault secrets (for local development)
supabase secrets list
```

### 3. Create Edge Functions

Create the three required functions:
- `workflow-executor` - Main orchestrator
- `report-collector` - Amazon API integration
- `report-generator` - Google Sheets output

### 4. Test Credential Flow

```typescript
// Test file: test-vault.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testVault() {
  const { data, error } = await supabase
    .rpc('get_amazon_ads_credentials');

  if (error) {
    console.error('Vault error:', error);
    return;
  }

  console.log('✓ Credentials retrieved successfully');
  console.log('✓ Client ID:', data.client_id.substring(0, 20) + '...');
  console.log('✓ Client Secret:', data.client_secret.substring(0, 10) + '...');
  console.log('✓ Refresh Token:', data.refresh_token.substring(0, 10) + '...');
}

testVault();
```

---

## Additional Resources

### Supabase Documentation
- [Supabase Vault Official Docs](https://supabase.com/docs/guides/database/vault)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Database Functions](https://supabase.com/docs/guides/database/functions)

### Amazon Ads API Documentation
- [Amazon Ads API Authentication](https://advertising.amazon.com/API/docs/en-us/get-started/authentication)
- [OAuth 2.0 Flow](https://developer.amazon.com/docs/login-with-amazon/authorization-code-grant.html)

### Project Documentation
- `DATABASE_SCHEMA_EXPLAINED.md` - Database schema overview
- `DEPLOYMENT_QUICKSTART.md` - Database deployment guide
- `api_integration_plan.md` - API integration architecture

---

## Summary

You now have:
- ✓ Supabase Vault configured with AES-256 encryption
- ✓ Three Amazon Ads API credentials securely stored
- ✓ Helper functions for safe credential retrieval
- ✓ Audit logging for compliance
- ✓ Access controls limiting credential access to Edge Functions only

**Files created:**
1. `setup_vault.sql` - Initial vault configuration (run once)
2. `verify_vault.sql` - Verification and testing queries
3. `update_vault_credentials.sql` - Credential update utilities
4. `VAULT_SETUP_GUIDE.md` - This comprehensive guide

**Next phase:** Edge Functions development (Phase 2)
