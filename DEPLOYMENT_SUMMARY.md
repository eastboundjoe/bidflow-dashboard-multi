# Amazon Placement Optimization - Database Deployment Summary

## Overview

This document provides a complete summary of the database deployment package created for your Amazon Placement Optimization project on Supabase.

## Project Information

- **Project Name:** Amazon Placement Optimization
- **Project ID:** phhatzkwykqdqfkxinvr
- **Region:** us-east-2 (US East - Ohio)
- **Database:** PostgreSQL (via Supabase)
- **Created:** 2025-11-05

## Files Created

### 1. Core Deployment Files

| File | Lines | Purpose |
|------|-------|---------|
| `create_database.sql` | 431 | Main database schema creation script |
| `verify_deployment.sql` | ~100 | Post-deployment verification queries |

### 2. Documentation Files

| File | Purpose |
|------|---------|
| `DEPLOYMENT_QUICKSTART.md` | 1-minute quick reference guide |
| `DEPLOYMENT_INSTRUCTIONS.md` | Detailed step-by-step deployment guide |
| `DATABASE_VISUAL_SUMMARY.md` | Visual database architecture diagrams |
| `TROUBLESHOOTING_GUIDE.md` | Solutions to common deployment issues |
| `DEPLOYMENT_SUMMARY.md` | This file - complete overview |

### 3. Existing Related Documentation

| File | Purpose |
|------|---------|
| `DATABASE_SCHEMA_EXPLAINED.md` | Plain English walkthrough of schema design |
| `new_database_schema_design.md` | Technical schema specification v2.0 |
| `database_schema.sql` | Original schema DDL (predecessor to create_database.sql) |

## Database Components Created

### Tables (6)

1. **workflow_executions**
   - Purpose: Track weekly workflow runs
   - Key Features: Idempotency via execution_id, audit trail
   - Indexes: 3 (execution_id, status, started_at)

2. **report_requests**
   - Purpose: Track Amazon API report requests
   - Key Features: Status monitoring, download URL management
   - Foreign Keys: → workflow_executions.execution_id
   - Indexes: 4 (execution_id, report_type, status, requested_at)

3. **portfolios**
   - Purpose: Portfolio master data
   - Key Features: ID to name mapping, budget status
   - Indexes: 2 (portfolio_id, portfolio_state)

4. **campaigns**
   - Purpose: Campaign master data + bid adjustments
   - Key Features: Placement bid adjustments (0-900%), budget tracking
   - Foreign Keys: → portfolios.portfolio_id
   - Indexes: 3 (campaign_id, portfolio_id, campaign_status)

5. **campaign_performance**
   - Purpose: Campaign-level performance metrics
   - Key Features: Multiple time periods, attribution windows
   - Foreign Keys: → campaigns.campaign_id
   - Indexes: 4 (campaign_id, period_type, report_date, composite lookup)
   - Unique Constraint: (campaign_id, period_type, report_date)

6. **placement_performance**
   - Purpose: Placement-level performance metrics
   - Key Features: Top of Search, Rest of Search, Product Pages
   - Foreign Keys: → campaigns.campaign_id
   - Indexes: 4 (campaign_id, placement, period_type, composite lookup)
   - Unique Constraint: (campaign_id, placement, period_type, report_date)

### Views (1)

**view_placement_optimization_report**
- Purpose: Aggregate all data into 25-column report for Google Sheets
- CTEs: 6 (placement_30d, placement_7d, campaign_tos_30d, campaign_tos_7d, campaign_yesterday, campaign_day_before)
- Joins: 8 (1 base + 7 LEFT/INNER joins)
- Filters: ENABLED campaigns with spend > 0
- Output: Ready-to-export format matching Google Sheets template

### Functions (1)

**truncate_performance_data()**
- Purpose: Clear performance data before weekly run
- Security: SECURITY DEFINER
- Operations: Truncate campaign_performance, placement_performance; Delete campaigns, portfolios
- Preserves: workflow_executions, report_requests (audit trail)

### Scheduled Jobs (1)

**cleanup-old-workflow-executions**
- Schedule: Mondays at 3:00 AM UTC
- Purpose: Delete workflow executions older than 90 days
- Cascades: Also deletes related report_requests

### Security (RLS Policies - 6)

All tables have identical RLS policy:
- **Policy Name:** "Service role full access"
- **Applies To:** service_role
- **Operations:** ALL (SELECT, INSERT, UPDATE, DELETE)
- **Condition:** true (always)
- **Effect:** Edge Functions (using service_role key) have full access; anon key has no access

### Indexes (~20)

**Total Index Count:**
- workflow_executions: 4 (1 PK + 3 custom)
- report_requests: 5 (1 PK + 4 custom)
- portfolios: 3 (1 PK + 2 custom)
- campaigns: 4 (1 PK + 3 custom)
- campaign_performance: 5 (1 PK + 4 custom)
- placement_performance: 5 (1 PK + 4 custom)

**Index Types:**
- Primary keys (UUIDs)
- Foreign key indexes (for JOINs)
- Lookup indexes (for WHERE clauses)
- Composite indexes (multi-column lookups)
- Time-series indexes (date ranges with DESC)
- Partial indexes (WHERE clauses on status fields)

## Deployment Process

### Quick Deployment (Recommended)

**3 Simple Steps:**

1. **Open SQL Editor**
   - URL: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/sql/new

2. **Execute Schema**
   - Copy: `/mnt/c/Users/Ramen Bomb/Desktop/Code/create_database.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Deployment**
   - Copy: `/mnt/c/Users/Ramen Bomb/Desktop/Code/verify_deployment.sql`
   - Paste into SQL Editor
   - Click "Run"
   - Confirm all checks pass

**Time Required:** ~2 minutes

### Alternative Methods

**CLI Method:**
```bash
# Requires database password
npx supabase link --project-ref phhatzkwykqdqfkxinvr
psql "connection_string" < create_database.sql
```

**Migration Method:**
```bash
# For version-controlled deployments
npx supabase db push
```

## Verification Checklist

After deployment, verify:

```
✓ All 6 tables created (workflow_executions, report_requests, portfolios,
  campaigns, campaign_performance, placement_performance)

✓ 1 view created (view_placement_optimization_report)

✓ 6 RLS policies enabled (one per table)

✓ ~20 indexes created (foreign keys, lookups, composites)

✓ 4 foreign key constraints (report_requests → workflow_executions,
  campaigns → portfolios, campaign_performance → campaigns,
  placement_performance → campaigns)

✓ 1 helper function (truncate_performance_data)

✓ 1 cron job scheduled (cleanup-old-workflow-executions)

✓ View returns correct structure (0 rows expected initially)

✓ No errors in deployment output
```

## Post-Deployment Tasks

### Immediate Next Steps

1. **Generate TypeScript Types**
   ```bash
   npx supabase gen types typescript --project-id phhatzkwykqdqfkxinvr > database.types.ts
   ```
   Or via Dashboard: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/api

2. **Configure Supabase Vault**
   - Store Amazon Ads API credentials
   - client_id, client_secret, refresh_token
   - See: VAULT_SETUP.md (to be created in Phase 2)

3. **Test with Sample Data**
   - Insert test portfolio
   - Insert test campaign
   - Insert performance data
   - Verify view aggregation

### Phase 2 Tasks (Edge Functions)

1. **Create Edge Functions**
   - workflow-executor
   - report-collector
   - report-generator

2. **Configure OAuth Token Management**
   - Refresh token rotation
   - Access token caching

3. **Test End-to-End Workflow**
   - Trigger weekly execution
   - Monitor report collection
   - Verify Google Sheets export

## Data Flow Overview

```
1. WEEKLY TRIGGER (Sunday night)
   ↓
2. workflow-executor Edge Function
   ↓
3. CREATE workflow_execution record
   ↓
4. CALL truncate_performance_data()
   ↓
5. REQUEST 6 reports from Amazon Ads API
   ↓
6. CREATE 6 report_request records
   ↓
7. POLL for report completion (report-collector)
   ↓
8. DOWNLOAD and PARSE reports
   ↓
9. INSERT into portfolios, campaigns, performance tables
   ↓
10. GENERATE report via view_placement_optimization_report
   ↓
11. EXPORT to Google Sheets (report-generator)
   ↓
12. UPDATE workflow_execution status = 'COMPLETED'
```

## Storage & Performance Estimates

### Weekly Data Volume

```
Assumptions:
- 50 campaigns
- 3 placements per campaign
- 6 report types

Rows Per Week:
├── workflow_executions:     1
├── report_requests:         6
├── portfolios:              ~5 (stable)
├── campaigns:               50 (mostly stable)
├── campaign_performance:    200 (50 × 4 periods)
└── placement_performance:   300 (50 × 3 × 2 periods)

Total: ~562 rows/week
```

### Yearly Projections

```
Total Rows: ~29,000 rows/year
Storage: ~25 MB/year (negligible)
Query Performance: <2 seconds (with indexes)
```

### Cleanup & Retention

```
Performance Data: Truncated weekly (fresh data each run)
Audit Trail: 90-day retention (automatic cleanup via cron)
Master Data: Upserted weekly (campaigns, portfolios)
```

## Security Architecture

### Access Control

```
Service Role Key (Edge Functions)
├── Full read/write access to all tables
├── Can call helper functions
├── Can schedule cron jobs
└── Used by: workflow-executor, report-collector, report-generator

Anon Key (Public)
├── No access (all blocked by RLS)
└── Never used in this project

Database Owner (Dashboard)
├── Full access to all operations
├── Can modify schema, RLS policies
└── Used by: SQL Editor, CLI tools
```

### Data Encryption

```
At Rest: Supabase default encryption (AES-256)
In Transit: TLS 1.2+ (all connections)
Secrets: Supabase Vault (encrypted storage)
```

### Compliance

```
Data Residency: US East (Ohio) - us-east-2
GDPR: Not applicable (no personal data)
PCI: Not applicable (no payment data)
Business Data: Amazon advertising metrics (proprietary)
```

## Technology Stack

```
Database:        PostgreSQL 15+ (via Supabase)
Extensions:      uuid-ossp, pg_cron
Schema Version:  2.0
Deployment Date: 2025-11-05
Region:          us-east-2 (AWS)
Plan:            Supabase Free/Pro (pg_cron requires Pro for cron jobs)
```

## Key Design Decisions

1. **Regular Views (not materialized)**
   - Rationale: 2-5 second query time acceptable for weekly reports
   - Benefit: Always fresh data, no refresh management

2. **Truncate Weekly (not incremental)**
   - Rationale: Simplifies data management, prevents drift
   - Benefit: Fresh baseline every week, no deduplication needed

3. **Service Role RLS (not user-level)**
   - Rationale: Backend-only access, no client-side queries
   - Benefit: Simpler security model, better performance

4. **UUID Primary Keys**
   - Rationale: Distributed system, prevent ID collisions
   - Benefit: Scalable, can merge data from multiple sources

5. **Composite Unique Constraints**
   - Rationale: Prevent duplicate performance records
   - Benefit: Data integrity, idempotent inserts

6. **Foreign Key Cascades**
   - Rationale: Maintain referential integrity
   - Benefit: Automatic cleanup, prevent orphaned records

## Known Limitations

1. **pg_cron Requires Pro Plan**
   - Free tier: Manual cleanup needed
   - Workaround: Run cleanup SQL manually or via Edge Function

2. **No Real-Time Subscriptions**
   - This system processes weekly, not real-time
   - Views are queried on-demand, not pushed

3. **No Multi-User Access Control**
   - All Edge Functions use service_role (full access)
   - No user-level RLS policies

4. **No Data Versioning**
   - Performance data is truncated weekly
   - No historical snapshots beyond current week

5. **No Soft Deletes**
   - Cascading deletes are hard deletes
   - Audit trail preserved via workflow_executions

## Troubleshooting Resources

**For Common Issues:**
- See: TROUBLESHOOTING_GUIDE.md

**For Understanding Schema:**
- See: DATABASE_SCHEMA_EXPLAINED.md (plain English)
- See: DATABASE_VISUAL_SUMMARY.md (diagrams)

**For Implementation Details:**
- See: new_database_schema_design.md (technical spec)

**For Deployment Steps:**
- See: DEPLOYMENT_INSTRUCTIONS.md (detailed guide)
- See: DEPLOYMENT_QUICKSTART.md (quick reference)

## Support & Maintenance

### Regular Maintenance

```
Weekly:   Automatic data refresh (via workflow)
Monthly:  Review cron job logs
Yearly:   Review schema for optimizations
```

### Monitoring

```
Query Performance:
  → Dashboard: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/database/query-performance

Logs:
  → Postgres Logs: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/logs/postgres-logs
  → Edge Function Logs: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/logs/edge-functions

Storage:
  → Database Size: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/database
```

### Backup Strategy

```
Automatic Backups: Enabled by Supabase (daily snapshots)
Manual Backups:    Export via pg_dump or Supabase Dashboard
Point-in-Time:     Available on Pro plan (Supabase feature)
```

## Success Criteria

This deployment is successful when:

```
✓ All tables created without errors
✓ View returns correct structure (even with 0 rows)
✓ Verification queries all pass
✓ TypeScript types generated successfully
✓ Test data can be inserted and queried
✓ No permission errors when using service_role key
✓ Cron job is scheduled (visible in cron.job table)
✓ Foreign key constraints prevent invalid data
```

## Next Phase Preview

**Phase 2: Edge Functions Development**

Files to be created:
- `/supabase/functions/workflow-executor/index.ts`
- `/supabase/functions/report-collector/index.ts`
- `/supabase/functions/report-generator/index.ts`
- `VAULT_SETUP.md` (Supabase Vault configuration)
- `EDGE_FUNCTIONS_GUIDE.md` (Deployment instructions)

Tasks:
1. Configure Supabase Vault with Amazon Ads API credentials
2. Implement OAuth token refresh logic
3. Create workflow orchestration function
4. Build report collection and parsing logic
5. Implement Google Sheets export
6. Set up weekly trigger (cron or external)

## Conclusion

This database schema provides a robust, scalable foundation for the Amazon Placement Optimization system. All components have been designed following PostgreSQL and Supabase best practices, with comprehensive security, indexing, and data integrity measures.

The deployment package includes:
- Production-ready SQL scripts
- Comprehensive documentation
- Verification tools
- Troubleshooting guides

**You are now ready to deploy Phase 1: Database Setup.**

Follow DEPLOYMENT_QUICKSTART.md for the fastest deployment path.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Author:** supabase-architect agent
**Project:** Amazon Placement Optimization

