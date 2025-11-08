# Deploy Fixed Report Collector

The report-collector function has been updated to fix the API endpoint issues:

## Changes Made
1. ✅ Fixed portfolios endpoint: `/v2/portfolios/extended` → `/portfolios/list` (POST)
2. ✅ Fixed report requests endpoint: `/v2/sp/reports` → `/reporting/reports`
3. ✅ Updated request structures to match n8n working flow
4. ✅ Added proper response handling for portfolios array

## Deployment Steps

### Option 1: Deploy via Supabase Dashboard (Easiest)

1. **Open the Edge Function in Dashboard:**
   - Go to https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/functions
   - Click on `report-collector` function

2. **Update the code:**
   - Copy the contents from: `Project Context/Amazon Placement Optimization/functions/report-collector-complete.ts`
   - Paste into the Supabase editor
   - Click "Deploy" or "Save"

3. **Test the updated function:**
   ```bash
   curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-collector \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"execution_id": "test_fixed_1", "dry_run": false}'
   ```

### Option 2: Deploy via Supabase CLI (Recommended for version control)

If you have Supabase CLI installed:

```bash
# Navigate to project directory
cd "C:\Users\Ramen Bomb\Desktop\Code\placement-optimization-functions"

# Copy the updated file
copy "..\Project Context\Amazon Placement Optimization\functions\report-collector-complete.ts" "supabase\functions\report-collector\index.ts"

# Deploy
npx supabase functions deploy report-collector
```

## What to Expect After Deployment

The function should now:
- ✅ Successfully fetch profiles from `/v2/profiles`
- ✅ Successfully fetch portfolios from `/portfolios/list`
- ✅ Store enabled portfolios in the database
- ✅ Request 6 reports using the new reporting API
- ✅ Store report requests in the database

## Testing

After deployment, you should see:
1. Portfolios table populated with your enabled portfolios
2. Report requests table showing 6 pending reports
3. No 404 errors

Use this query to verify data collection:
```sql
SELECT 'PORTFOLIOS' as table_name, COUNT(*) as row_count FROM portfolios
UNION ALL
SELECT 'REPORT_REQUESTS', COUNT(*) FROM report_requests;
```
