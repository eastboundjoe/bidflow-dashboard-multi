# Amazon Placement Optimization - Deployment Quickstart

## 1-Minute Deployment Guide

### Step 1: Open SQL Editor (10 seconds)
Click this link: [Open Supabase SQL Editor](https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/sql/new)

### Step 2: Execute Schema (30 seconds)
1. Open: `/mnt/c/Users/Ramen Bomb/Desktop/Code/create_database.sql`
2. Copy all 431 lines
3. Paste into SQL Editor
4. Click **"Run"** (or Ctrl+Enter)

### Step 3: Verify Deployment (20 seconds)
1. Open: `/mnt/c/Users/Ramen Bomb/Desktop/Code/verify_deployment.sql`
2. Copy and paste into SQL Editor
3. Click **"Run"**
4. Confirm you see:
   - ✅ 6 tables
   - ✅ 1 view
   - ✅ 6 RLS policies
   - ✅ 1 helper function
   - ✅ 1 cron job

### Step 4: Generate TypeScript Types (Optional)
```bash
npx supabase gen types typescript --project-id phhatzkwykqdqfkxinvr > database.types.ts
```

---

## What Gets Created

| Component | Count | Names |
|-----------|-------|-------|
| **Tables** | 6 | workflow_executions, report_requests, portfolios, campaigns, campaign_performance, placement_performance |
| **Views** | 1 | view_placement_optimization_report |
| **Functions** | 1 | truncate_performance_data() |
| **Cron Jobs** | 1 | cleanup-old-workflow-executions |
| **RLS Policies** | 6 | Service role full access on each table |
| **Indexes** | ~20 | Foreign keys, lookups, date ranges |

---

## Quick Test Queries

### Test 1: List Tables
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```
**Expected:** 6 rows

### Test 2: Test View
```sql
SELECT * FROM view_placement_optimization_report LIMIT 1;
```
**Expected:** 0 rows (structure valid, no data yet)

### Test 3: Verify RLS
```sql
SELECT tablename, COUNT(*) FROM pg_policies
WHERE schemaname = 'public' GROUP BY tablename;
```
**Expected:** 6 rows, each with count = 1

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "relation already exists" | Run cleanup script from DEPLOYMENT_INSTRUCTIONS.md, then re-run |
| "permission denied" | Verify you're logged in as project owner/admin |
| "extension pg_cron does not exist" | Enable pg_cron extension in Dashboard → Database → Extensions |

---

## Next Steps

After successful deployment:

1. ✅ Configure Supabase Vault with Amazon Ads API credentials
2. ✅ Create 3 Edge Functions:
   - workflow-executor
   - report-collector
   - report-generator
3. ✅ Test end-to-end workflow with sample data

---

## Project Links

- **SQL Editor:** https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/sql/new
- **Table Editor:** https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/editor
- **Extensions:** https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/database/extensions
- **API Settings:** https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/api

---

## Files Created

1. `create_database.sql` - Main schema deployment script (431 lines)
2. `verify_deployment.sql` - Verification queries
3. `DEPLOYMENT_INSTRUCTIONS.md` - Detailed deployment guide
4. `DEPLOYMENT_QUICKSTART.md` - This quick reference (you are here)

