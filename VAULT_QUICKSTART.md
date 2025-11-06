# Supabase Vault - 5 Minute Quickstart

**Goal:** Securely store Amazon Ads API credentials in 5 minutes

---

## Step 1: Run Setup Script (2 minutes)

### Open Supabase SQL Editor
```
https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/sql/new
```

### Execute setup_vault.sql
1. Open `setup_vault.sql` in your code editor
2. Copy entire file contents (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click "Run" button
5. Wait for success message:
   ```
   VAULT SETUP COMPLETED SUCCESSFULLY
   ```

**What this does:**
- Enables vault extension
- Creates 3 secrets with placeholder values
- Creates helper functions
- Sets up access policies

---

## Step 2: Update Credentials (2 minutes)

### Get Your Amazon Ads API Credentials

You need three values from Amazon Ads Console:
1. **Client ID** - Format: `amzn1.application-oa2-client.abc123...`
2. **Client Secret** - Format: 64-character alphanumeric string
3. **Refresh Token** - Format: `Atzr|IwEBI...` (long string)

### Run Update Script

1. Open `update_vault_credentials.sql`
2. Find "OPTION 1: Update All Credentials at Once"
3. Uncomment the block (remove `/*` and `*/`)
4. Replace placeholder values:
   ```sql
   UPDATE vault.secrets
   SET secret = 'amzn1.application-oa2-client.YOUR_ACTUAL_ID',
       updated_at = NOW()
   WHERE name = 'amazon_ads_client_id';

   UPDATE vault.secrets
   SET secret = 'YOUR_64_CHAR_SECRET_HERE',
       updated_at = NOW()
   WHERE name = 'amazon_ads_client_secret';

   UPDATE vault.secrets
   SET secret = 'Atzr|YOUR_LONG_TOKEN_HERE',
       updated_at = NOW()
   WHERE name = 'amazon_ads_refresh_token';
   ```
5. Copy and paste into SQL Editor
6. Click "Run"
7. Verify "Updated successfully" appears

---

## Step 3: Verify Setup (1 minute)

### Run Verification Tests

1. Open `verify_vault.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click "Run"

### Expected Results

```
✓ Vault Extension Status: PASS
✓ Secrets Existence Check: PASS (3/3 secrets)
✓ Helper Function Check: PASS
✓ Function Permissions Check: PASS
✓ Credential Retrieval Test: PASS
✓ Credential Structure Check: PASS
✓ Placeholder Check: PASS (no placeholders)
```

**If any test fails:** See troubleshooting section in VAULT_SETUP_GUIDE.md

---

## Usage in Edge Functions

### TypeScript Example

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // Important: Use SERVICE_ROLE
);

// Retrieve credentials
const { data, error } = await supabase
  .rpc('get_amazon_ads_credentials');

if (error) {
  throw new Error(`Failed to get credentials: ${error.message}`);
}

// Use credentials
const { client_id, client_secret, refresh_token } = data;

// Authenticate with Amazon Ads API
const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id,
    client_secret,
  }),
});

const { access_token } = await tokenResponse.json();
```

---

## Common Issues

### "Permission denied"
**Fix:** Make sure you're using `SUPABASE_SERVICE_ROLE_KEY`, not `SUPABASE_ANON_KEY`

### "Credentials missing"
**Fix:** Run `setup_vault.sql` first, then `update_vault_credentials.sql`

### "Placeholder values detected"
**Fix:** Update credentials with real values (Step 2)

### "Function not found"
**Fix:** Re-run `setup_vault.sql`

---

## Security Checklist

- ✓ Secrets encrypted at rest (AES-256)
- ✓ Only Edge Functions (service_role) can access
- ✓ Client applications have NO access
- ✓ Audit logging enabled
- ✓ Helper functions use SECURITY DEFINER
- ✓ No credentials in git or logs

---

## Next Steps

1. **Test credential retrieval** in an Edge Function
2. **Generate TypeScript types:**
   ```bash
   npx supabase gen types typescript \
     --project-id phhatzkwykqdqfkxinvr > database.types.ts
   ```
3. **Create Edge Functions** (Phase 2):
   - `workflow-executor`
   - `report-collector`
   - `report-generator`

---

## Files Reference

- `setup_vault.sql` - Initial setup (run once)
- `verify_vault.sql` - Test vault configuration
- `update_vault_credentials.sql` - Update/rotate credentials
- `VAULT_SETUP_GUIDE.md` - Comprehensive documentation (17KB)
- `VAULT_QUICKSTART.md` - This file (5-minute guide)

---

**Done!** Your vault is now configured and ready for Edge Functions.

For detailed documentation, security best practices, and troubleshooting, see **VAULT_SETUP_GUIDE.md**.
