# Amazon Placement Optimization - Deployment Troubleshooting Guide

## Common Issues & Solutions

### Issue 1: "relation already exists" Error

**Error Message:**
```
ERROR: relation "workflow_executions" already exists
```

**Cause:** Tables from a previous deployment attempt still exist in the database.

**Solution A: Drop Individual Tables (Safer)**
```sql
-- Run in SQL Editor BEFORE create_database.sql
DROP TABLE IF EXISTS placement_performance CASCADE;
DROP TABLE IF EXISTS campaign_performance CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;
DROP TABLE IF EXISTS report_requests CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP VIEW IF EXISTS view_placement_optimization_report CASCADE;
DROP FUNCTION IF EXISTS truncate_performance_data() CASCADE;

-- Remove cron job if it exists
SELECT cron.unschedule('cleanup-old-workflow-executions');
```

**Solution B: Nuclear Option (Deletes EVERYTHING)**
```sql
-- WARNING: This deletes ALL tables, views, and functions in public schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

---

### Issue 2: "permission denied for schema public"

**Error Message:**
```
ERROR: permission denied for schema public
```

**Cause:** You're not logged in as the project owner, or RLS policies are blocking you.

**Solutions:**
1. Verify you're logged into Supabase Dashboard with the correct account
2. Check Project Settings → Database → ensure you're the owner
3. Use SQL Editor (not psql) - it runs as service_role automatically

---

### Issue 3: "extension pg_cron does not exist"

**Error Message:**
```
ERROR: extension "pg_cron" does not exist
```

**Cause:** pg_cron extension is not enabled on your Supabase project.

**Solution:**
1. Go to: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/database/extensions
2. Search for "pg_cron"
3. Click "Enable"
4. Re-run the cron job section of create_database.sql:
```sql
SELECT cron.schedule(
  'cleanup-old-workflow-executions',
  '0 3 * * 1',
  $$
  DELETE FROM workflow_executions
  WHERE started_at < NOW() - INTERVAL '90 days';
  $$
);
```

---

### Issue 4: Foreign Key Constraint Violation

**Error Message:**
```
ERROR: insert or update on table "report_requests" violates foreign key constraint
```

**Cause:** Trying to insert data with references to non-existent parent records.

**Solution:**
Always insert in this order:
1. workflow_executions (has no dependencies)
2. portfolios (has no dependencies)
3. campaigns (depends on portfolios)
4. report_requests (depends on workflow_executions)
5. campaign_performance (depends on campaigns)
6. placement_performance (depends on campaigns)

**Example:**
```sql
-- Step 1: Create workflow execution
INSERT INTO workflow_executions (execution_id, status)
VALUES ('exec_2025_11_05', 'RUNNING');

-- Step 2: Create portfolio
INSERT INTO portfolios (portfolio_id, portfolio_name)
VALUES ('port_123', 'Test Portfolio');

-- Step 3: Create campaign
INSERT INTO campaigns (campaign_id, campaign_name, campaign_status, portfolio_id, daily_budget)
VALUES ('camp_456', 'Test Campaign', 'ENABLED', 'port_123', 50.00);

-- NOW you can insert performance data
```

---

### Issue 5: View Returns No Data

**Error Message:**
```
0 rows returned
```

**Cause:** This is EXPECTED if you haven't loaded data yet. The view requires:
- Campaigns with status = 'ENABLED'
- Placement performance data with spend_30 > 0

**Solution (Load Test Data):**
```sql
-- 1. Insert test portfolio
INSERT INTO portfolios (portfolio_id, portfolio_name, portfolio_state, in_budget)
VALUES ('test_port_001', 'Test Portfolio', 'ENABLED', true);

-- 2. Insert test campaign
INSERT INTO campaigns (
  campaign_id, campaign_name, campaign_status, portfolio_id,
  daily_budget, bid_top_of_search, bid_rest_of_search, bid_product_page
)
VALUES (
  'test_camp_001', 'Test Campaign', 'ENABLED', 'test_port_001',
  100.00, 50, 30, 20
);

-- 3. Insert placement performance (30-day)
INSERT INTO placement_performance (
  campaign_id, placement, period_type, report_date,
  impressions, clicks, spend, orders_30d, sales_30d
)
VALUES
  ('test_camp_001', 'PLACEMENT_TOP', '30day', CURRENT_DATE, 1000, 50, 25.50, 5, 150.00),
  ('test_camp_001', 'PLACEMENT_REST_OF_SEARCH', '30day', CURRENT_DATE, 800, 40, 18.00, 3, 90.00),
  ('test_camp_001', 'PLACEMENT_PRODUCT_PAGE', '30day', CURRENT_DATE, 500, 25, 12.00, 2, 60.00);

-- 4. Insert placement performance (7-day)
INSERT INTO placement_performance (
  campaign_id, placement, period_type, report_date,
  impressions, clicks, spend, orders_7d, sales_7d
)
VALUES
  ('test_camp_001', 'PLACEMENT_TOP', '7day', CURRENT_DATE, 300, 15, 8.50, 2, 50.00),
  ('test_camp_001', 'PLACEMENT_REST_OF_SEARCH', '7day', CURRENT_DATE, 250, 12, 6.00, 1, 30.00),
  ('test_camp_001', 'PLACEMENT_PRODUCT_PAGE', '7day', CURRENT_DATE, 150, 8, 4.00, 1, 20.00);

-- 5. Test view
SELECT * FROM view_placement_optimization_report;
```

**Expected Result:** 3 rows (one per placement)

---

### Issue 6: TypeScript Type Generation Fails

**Error Message:**
```
Failed to generate types: connection refused
```

**Cause:** Supabase CLI can't connect to your project.

**Solution A: Use Dashboard**
1. Go to: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/api
2. Scroll to "Project API keys"
3. Click "Generate Types"
4. Copy TypeScript output

**Solution B: Use CLI with Project ID**
```bash
npx supabase gen types typescript --project-id phhatzkwykqdqfkxinvr > database.types.ts
```

**Solution C: Link Project First**
```bash
# You'll be prompted for database password
npx supabase link --project-ref phhatzkwykqdqfkxinvr
npx supabase gen types typescript --linked > database.types.ts
```

---

### Issue 7: Cron Job Not Running

**How to Check:**
```sql
-- View cron job status
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-workflow-executions';

-- View cron job history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-workflow-executions')
ORDER BY start_time DESC
LIMIT 10;
```

**Common Causes:**
1. **pg_cron not enabled** → Enable in Extensions
2. **Job not active** → Check `active` column in cron.job
3. **Schedule hasn't triggered yet** → Cron runs Mondays at 3 AM UTC

**Manual Trigger:**
```sql
-- Manually run the cleanup logic
DELETE FROM workflow_executions
WHERE started_at < NOW() - INTERVAL '90 days';
```

---

### Issue 8: RLS Blocking Queries

**Error Message:**
```
ERROR: new row violates row-level security policy
```

**Cause:** You're using anon key instead of service_role key.

**Solution:**
- **SQL Editor:** Automatically uses service_role (no action needed)
- **Edge Functions:** Use `createClient(url, SERVICE_ROLE_KEY)`
- **Client Libraries:** Use service_role key for admin operations

**Verify RLS Policies:**
```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected:** All tables have "Service role full access" policy

---

### Issue 9: Indexes Not Created

**How to Check:**
```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Expected Index Count Per Table:**
- workflow_executions: 4 (1 PK + 3 custom)
- report_requests: 5 (1 PK + 4 custom)
- portfolios: 3 (1 PK + 2 custom)
- campaigns: 4 (1 PK + 3 custom)
- campaign_performance: 5 (1 PK + 4 custom)
- placement_performance: 5 (1 PK + 4 custom)

**Solution if Missing:**
Re-run the CREATE INDEX sections from create_database.sql

---

### Issue 10: Unique Constraint Violation

**Error Message:**
```
ERROR: duplicate key value violates unique constraint "campaigns_campaign_id_key"
```

**Cause:** Trying to insert a campaign_id that already exists.

**Solution:**
Use UPSERT (INSERT ... ON CONFLICT):
```sql
INSERT INTO campaigns (campaign_id, campaign_name, campaign_status, daily_budget)
VALUES ('camp_123', 'Test Campaign', 'ENABLED', 50.00)
ON CONFLICT (campaign_id)
DO UPDATE SET
  campaign_name = EXCLUDED.campaign_name,
  campaign_status = EXCLUDED.campaign_status,
  daily_budget = EXCLUDED.daily_budget,
  updated_at = NOW();
```

---

### Issue 11: View Performance is Slow

**Symptoms:** Query takes more than 5 seconds.

**Diagnosis:**
```sql
EXPLAIN ANALYZE
SELECT * FROM view_placement_optimization_report;
```

**Common Causes:**
1. Missing indexes on foreign keys
2. Large dataset (100k+ rows)
3. Inefficient JOIN order

**Solutions:**

**A. Verify All Indexes Exist**
```sql
-- Should return at least 20 indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
```

**B. Add Missing Indexes** (if not already present)
```sql
CREATE INDEX IF NOT EXISTS idx_campaign_performance_lookup
ON campaign_performance(campaign_id, period_type);

CREATE INDEX IF NOT EXISTS idx_placement_performance_lookup
ON placement_performance(campaign_id, placement, period_type);
```

**C. Limit Results** (for testing)
```sql
SELECT * FROM view_placement_optimization_report LIMIT 100;
```

**D. Consider Materialized View** (if dataset is huge)
```sql
-- Only if regular view is too slow (>10 seconds)
CREATE MATERIALIZED VIEW mv_placement_optimization_report AS
SELECT * FROM view_placement_optimization_report;

-- Refresh weekly after data load
REFRESH MATERIALIZED VIEW mv_placement_optimization_report;
```

---

### Issue 12: Function Not Found

**Error Message:**
```
ERROR: function truncate_performance_data() does not exist
```

**Cause:** Function was not created or was dropped.

**Solution:**
Re-run the function creation section from create_database.sql:
```sql
CREATE OR REPLACE FUNCTION truncate_performance_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE campaign_performance;
  TRUNCATE TABLE placement_performance;
  DELETE FROM campaigns;
  DELETE FROM portfolios;
END;
$$;
```

**Verify:**
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'truncate_performance_data';
```

---

### Issue 13: Cannot Connect via CLI

**Error Message:**
```
failed to connect to postgres: password authentication failed
```

**Solutions:**

**A. Reset Database Password**
1. Go to: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/database
2. Click "Reset database password"
3. Copy new password
4. Use with `--password` flag

**B. Use Connection Pooler**
```bash
# Use pooler connection string (port 5432, not 6543)
psql "postgresql://postgres.[project-ref]:[password]@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
```

**C. Use SQL Editor Instead**
The SQL Editor in Supabase Dashboard doesn't require password authentication.

---

## Deployment Checklist

Use this to verify complete deployment:

```
☐ All 6 tables created
  ☐ workflow_executions
  ☐ report_requests
  ☐ portfolios
  ☐ campaigns
  ☐ campaign_performance
  ☐ placement_performance

☐ 1 view created
  ☐ view_placement_optimization_report

☐ 6 RLS policies created (one per table)

☐ ~20 indexes created

☐ 4 foreign key constraints created

☐ 1 helper function created
  ☐ truncate_performance_data()

☐ 1 cron job scheduled
  ☐ cleanup-old-workflow-executions

☐ View returns correct structure (0 rows OK)

☐ TypeScript types generated

☐ Test data inserted successfully

☐ No errors in pg_stat_statements
```

---

## Getting Help

If issues persist:

1. **Check Supabase Logs**
   https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/logs/postgres-logs

2. **Review Documentation**
   - DATABASE_SCHEMA_EXPLAINED.md
   - DEPLOYMENT_INSTRUCTIONS.md
   - DATABASE_VISUAL_SUMMARY.md

3. **Test Components Individually**
   - Create tables one at a time
   - Test each foreign key constraint
   - Verify indexes after each table

4. **Supabase Support**
   - Community: https://github.com/supabase/supabase/discussions
   - Discord: https://discord.supabase.com
   - Docs: https://supabase.com/docs

