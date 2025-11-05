# Amazon Placement Optimization - Database Deployment Instructions

## Project Details
- **Project Name:** Amazon Placement Optimization
- **Project ID:** phhatzkwykqdqfkxinvr
- **Region:** us-east-2
- **SQL File:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/create_database.sql`

## Deployment Method: Supabase SQL Editor (RECOMMENDED)

### Step 1: Navigate to SQL Editor
Open this URL in your browser:
```
https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/sql/new
```

### Step 2: Copy and Execute SQL
1. Open the file: `/mnt/c/Users/Ramen Bomb/Desktop/Code/create_database.sql`
2. Copy the ENTIRE contents (431 lines)
3. Paste into the SQL Editor
4. Click **"Run"** or press **Ctrl+Enter**

### Step 3: Verify Success
You should see output messages indicating:
```
✅ DATABASE SCHEMA CREATED SUCCESSFULLY!

Tables created:
  1. workflow_executions (execution tracking)
  2. report_requests (report status tracking)
  3. portfolios (portfolio master data)
  4. campaigns (campaign master data + bid adjustments)
  5. campaign_performance (campaign-level metrics)
  6. placement_performance (placement-level metrics)

View created:
  • view_placement_optimization_report (25 columns)

Helper functions created:
  • truncate_performance_data()

Scheduled jobs created:
  • cleanup-old-workflow-executions (runs Mondays at 3 AM)
```

---

## Post-Deployment Verification

Run these queries in the SQL Editor to verify everything was created correctly:

### 1. List All Tables
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected Results (6 tables):**
- campaign_performance
- campaigns
- placement_performance
- portfolios
- report_requests
- workflow_executions

### 2. Verify View Exists
```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'view_placement_optimization_report';
```

**Expected Result:** 1 row with `table_type = 'VIEW'`

### 3. Test the View (Should Return 0 Rows)
```sql
SELECT * FROM view_placement_optimization_report LIMIT 1;
```

**Expected Result:** `0 rows` (no data yet, but view structure is valid)

### 4. Verify RLS Policies
```sql
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected Result:** 6 policies (one "Service role full access" per table)

### 5. Verify Indexes
```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Expected Result:** Multiple indexes on:
- workflow_executions (3 indexes + primary key)
- report_requests (4 indexes + primary key)
- portfolios (2 indexes + primary key)
- campaigns (3 indexes + primary key)
- campaign_performance (4 indexes + primary key)
- placement_performance (4 indexes + primary key)

### 6. Verify Helper Function
```sql
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'truncate_performance_data';
```

**Expected Result:** 1 row showing `routine_type = 'FUNCTION'`

### 7. Verify Scheduled Cron Job
```sql
SELECT jobid, schedule, command, nodename, nodeport, database, username, active
FROM cron.job
WHERE jobname = 'cleanup-old-workflow-executions';
```

**Expected Result:** 1 row with schedule `'0 3 * * 1'` (Mondays at 3 AM)

---

## Generate TypeScript Types

After successful deployment, generate TypeScript types for Edge Functions:

### Option 1: Via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/api
2. Scroll to "API Settings"
3. Click "Generate TypeScript types"
4. Copy the output

### Option 2: Via Supabase CLI
```bash
npx supabase gen types typescript --project-id phhatzkwykqdqfkxinvr > database.types.ts
```

Save the output to:
```
/mnt/c/Users/Ramen Bomb/Desktop/Code/database.types.ts
```

---

## Troubleshooting

### Issue: "relation already exists" Error
**Solution:** Some tables may already exist. You can either:
1. Drop existing tables manually via SQL Editor
2. Clear the entire schema (WARNING: Deletes all data)

To clear schema:
```sql
DROP TABLE IF EXISTS placement_performance CASCADE;
DROP TABLE IF EXISTS campaign_performance CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;
DROP TABLE IF EXISTS report_requests CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP VIEW IF EXISTS view_placement_optimization_report CASCADE;
DROP FUNCTION IF EXISTS truncate_performance_data() CASCADE;
```

Then re-run the create_database.sql script.

### Issue: "permission denied" Error
**Solution:** Ensure you're logged into Supabase Dashboard with owner/admin permissions for the project.

### Issue: pg_cron Extension Not Found
**Solution:** pg_cron is automatically enabled on Supabase. If you see errors:
1. Go to: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/database/extensions
2. Search for "pg_cron"
3. Enable it
4. Re-run the cron job creation section

---

## Next Steps After Deployment

1. ✅ **Configure Supabase Vault**
   - Store Amazon Ads API credentials
   - See: `VAULT_SETUP.md` (to be created)

2. ✅ **Create Edge Functions**
   - `workflow-executor` - Main orchestrator
   - `report-collector` - Amazon API integration
   - `report-generator` - Google Sheets output

3. ✅ **Test Data Flow**
   - Insert test portfolio
   - Insert test campaign
   - Verify view aggregation

4. ✅ **Configure Production Environment**
   - Set up environment variables
   - Configure OAuth tokens
   - Test end-to-end workflow

---

## Database Schema Summary

### Tables

1. **workflow_executions**
   - Tracks weekly workflow runs
   - Idempotency via execution_id
   - Audit trail with timestamps

2. **report_requests**
   - Tracks Amazon API report requests
   - Status monitoring (PENDING → PROCESSING → COMPLETED)
   - Links to workflow executions

3. **portfolios**
   - Portfolio master data
   - ID to name mapping
   - Budget status tracking

4. **campaigns**
   - Campaign master data
   - Placement bid adjustments (0-900%)
   - Links to portfolios

5. **campaign_performance**
   - Campaign-level metrics
   - 30-day, 7-day, yesterday, day-before periods
   - Attribution windows (7d, 14d, 30d)

6. **placement_performance**
   - Placement-level metrics
   - Top of Search, Rest of Search, Product Pages
   - 30-day and 7-day periods

### View

**view_placement_optimization_report**
- 25-column report matching Google Sheets format
- Aggregates performance data across placements and time periods
- Calculates CVR, ACoS, impression share
- Filters to ENABLED campaigns with spend > $0

### Functions

**truncate_performance_data()**
- Clears performance tables before weekly run
- Ensures fresh data each week
- Call via: `SELECT truncate_performance_data();`

### Scheduled Jobs

**cleanup-old-workflow-executions**
- Runs: Mondays at 3 AM UTC
- Deletes workflow executions older than 90 days
- Keeps database lean

---

## Security Configuration

### Row Level Security (RLS)
All tables have RLS enabled with:
- **Service role**: Full access (used by Edge Functions)
- **Anon role**: No access (client-side never accesses directly)

### Foreign Key Constraints
- `report_requests.execution_id` → `workflow_executions.execution_id` (CASCADE)
- `campaigns.portfolio_id` → `portfolios.portfolio_id` (SET NULL)
- `campaign_performance.campaign_id` → `campaigns.campaign_id` (CASCADE)
- `placement_performance.campaign_id` → `campaigns.campaign_id` (CASCADE)

### Check Constraints
- `workflow_executions.status`: RUNNING, COMPLETED, FAILED, CANCELLED
- `report_requests.report_type`: 6 valid report types
- `report_requests.status`: PENDING, PROCESSING, COMPLETED, FAILED, TIMEOUT
- `placement_performance.placement`: 3 valid placement types
- Bid adjustments: 0-900% range

---

## Contact & Support

- **Documentation:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/DATABASE_SCHEMA_EXPLAINED.md`
- **Architecture:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/new_database_schema_design.md`
- **Supabase Project:** https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr

