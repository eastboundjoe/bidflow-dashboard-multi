# Deployment Guide - Amazon Placement Optimization Edge Functions

## Prerequisites

✅ Already Completed:
- [x] Database deployed to Supabase (6 tables, 1 view)
- [x] Vault configured with placeholder credentials
- [x] Edge Functions code written
- [x] TypeScript types generated

⏳ To Complete:
- [ ] Update vault with real Amazon Ads API credentials
- [ ] Deploy Edge Functions to Supabase
- [ ] Test functions end-to-end

---

## Step 1: Update Vault Credentials (5 minutes)

Before deploying, update the vault with your real Amazon Ads API credentials.

### 1.1 Get Your Amazon Ads API Credentials

You need three values:
- **Client ID** - From your Amazon Ads API app
- **Client Secret** - From your Amazon Ads API app
- **Refresh Token** - Long-term access token from OAuth flow

If you don't have these yet:
1. Go to: https://advertising.amazon.com/API/docs/en-us/setting-up/overview
2. Register your application
3. Complete OAuth flow to get refresh token

### 1.2 Update Vault Secrets

1. **Open Vault Settings:**
   https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/vault/secrets

2. **Click on each secret and update:**
   - `amazon_ads_client_id` → Your real Client ID
   - `amazon_ads_client_secret` → Your real Client Secret
   - `amazon_ads_refresh_token` → Your real Refresh Token

3. **Click "Update Secret"** for each one

✅ Credentials are now securely stored and encrypted

---

## Step 2: Deploy Edge Functions (5 minutes)

### Option A: Deploy via Dashboard (Easiest)

1. **Open Functions page:**
   https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/functions

2. **Create New Function:**
   - Click "Create a new function"
   - Name: `workflow-executor`
   - Copy code from: `supabase/functions/workflow-executor/index.ts`
   - Click "Deploy function"

3. **Repeat for other functions:**
   - `report-collector` (copy from `supabase/functions/report-collector/index.ts`)
   - `report-generator` (copy from `supabase/functions/report-generator/index.ts`)

4. **Create shared module (if needed):**
   - Upload each file from `supabase/functions/_shared/` as a module
   - Or inline the shared code into each function

---

### Option B: Deploy via CLI (Advanced)

**Note:** This requires linking the project with database password.

1. **Link project (if not already):**
   ```bash
   cd placement-optimization-functions
   npx supabase link --project-ref phhatzkwykqdqfkxinvr
   ```
   Enter your database password when prompted.

2. **Deploy all functions:**
   ```bash
   npx supabase functions deploy workflow-executor
   npx supabase functions deploy report-collector
   npx supabase functions deploy report-generator
   ```

3. **Verify deployment:**
   ```bash
   npx supabase functions list
   ```

---

## Step 3: Test Functions (10 minutes)

### 3.1 Get Service Role Key

1. Go to: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/api
2. Copy your **service_role** key (starts with `eyJ...`)
3. Keep it secure - this key has full database access

### 3.2 Test Report Generator (Read-Only)

Test the simplest function first:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-generator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "test_1",
    "dry_run": true,
    "format": "json"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "execution_id": "test_1",
  "rows": 0,
  "message": "No data available to generate report"
}
```

✅ If you see this, the function is deployed and working!

---

### 3.3 Test Workflow Executor (Dry Run)

Test the full workflow with dry_run to avoid API calls:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "test_dryrun",
    "dry_run": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "execution_id": "test_dryrun",
  "status": "COMPLETED"
}
```

✅ Check Supabase logs to see the execution flow

---

### 3.4 Test Report Collector (Real API Call)

⚠️ **Warning:** This will make real API calls to Amazon Ads!

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-collector \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "test_real",
    "dry_run": false
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "execution_id": "test_real",
  "profile_id": "1234567890",
  "portfolios_count": 3,
  "reports_requested": 6
}
```

✅ Check database to see portfolios and campaigns inserted

---

## Step 4: Run Full Workflow (5 minutes)

Now run the complete workflow end-to-end:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "prod_2024_11_06",
    "dry_run": false
  }'
```

**What happens:**
1. Creates workflow execution record
2. Clears existing performance data
3. Fetches portfolios from Amazon Ads API
4. Requests 6 performance reports
5. Waits for reports to complete (async)
6. Downloads and parses report data
7. Inserts data into database
8. Generates final report

**Check progress:**
1. View logs: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/logs/edge-functions
2. Check executions:
   ```sql
   SELECT * FROM workflow_executions ORDER BY started_at DESC LIMIT 5;
   ```
3. Check data:
   ```sql
   SELECT COUNT(*) FROM portfolios;
   SELECT COUNT(*) FROM campaigns;
   SELECT COUNT(*) FROM placement_performance;
   ```

---

## Step 5: Schedule Weekly Execution

### Option A: External Cron Service (Recommended)

Use a service like:
- **GitHub Actions** (free)
- **EasyCron** (free tier available)
- **Cron-job.org** (free)

**Example GitHub Actions workflow:**
```yaml
name: Weekly Placement Optimization

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC

jobs:
  run-workflow:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger workflow
        run: |
          curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/workflow-executor \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"execution_id": "weekly_${{ github.run_number }}", "dry_run": false}'
```

---

### Option B: Supabase Cron (Future)

Supabase Edge Functions will support built-in cron scheduling. When available:

```typescript
// In supabase/functions/workflow-executor/index.ts
Deno.cron("weekly-placement-optimization", "0 9 * * 1", async () => {
  // Run workflow
});
```

---

## Troubleshooting

### Function Deployment Fails

**Issue:** "Failed to deploy function"

**Solution:**
1. Check function logs for syntax errors
2. Verify all imports are using correct URLs
3. Ensure shared modules are accessible
4. Try deploying via Dashboard UI instead

---

### OAuth Token Refresh Fails

**Issue:** `Token refresh failed: 400 - invalid_grant`

**Solution:**
1. Verify credentials in Vault are correct
2. Check refresh token hasn't expired
3. Re-authorize your Amazon Ads API app
4. Get new refresh token

---

### No Data in Reports

**Issue:** `No data available to generate report`

**Solution:**
1. Check that report-collector ran successfully
2. Verify data was inserted into tables:
   ```sql
   SELECT COUNT(*) FROM placement_performance;
   SELECT COUNT(*) FROM campaign_performance;
   ```
3. Check Amazon Ads API returned data
4. Review report request status:
   ```sql
   SELECT * FROM report_requests ORDER BY requested_at DESC LIMIT 10;
   ```

---

### API Rate Limiting

**Issue:** `API request failed: 429 - Too Many Requests`

**Solution:**
1. Amazon Ads API has rate limits
2. Add delays between report requests
3. Implement exponential backoff (already in code)
4. Contact Amazon to increase rate limits

---

## Monitoring

### View Function Logs

https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/logs/edge-functions

Filter by function name to see specific logs.

### Check Execution Status

```sql
-- Recent executions
SELECT
  execution_id,
  status,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds,
  error_message
FROM workflow_executions
ORDER BY started_at DESC
LIMIT 10;
```

### Monitor Report Requests

```sql
-- Report request status
SELECT
  report_name,
  status,
  rows_processed,
  requested_at,
  completed_at,
  error_details
FROM report_requests
WHERE execution_id = 'prod_2024_11_06';
```

---

## Next Steps

After successful deployment:

1. ✅ **Schedule weekly execution** (GitHub Actions or external cron)
2. ✅ **Set up monitoring alerts** (email on failure)
3. ✅ **Add Google Sheets export** to report-generator
4. ✅ **Implement report downloading** (currently requests only)
5. ✅ **Add retry logic** for failed report downloads
6. ✅ **Create dashboard** to view execution history

---

## Success Checklist

- [ ] Vault credentials updated with real values
- [ ] All 3 Edge Functions deployed
- [ ] Test dry run completed successfully
- [ ] Test real API call completed successfully
- [ ] Full workflow executed end-to-end
- [ ] Data visible in database tables
- [ ] Report generated successfully
- [ ] Weekly schedule configured
- [ ] Monitoring set up

**Once all checked, you're production ready! 🎉**
