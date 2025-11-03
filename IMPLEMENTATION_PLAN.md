# Amazon Placement Optimization System - Implementation Plan

## Overview
This document outlines the implementation plan for rebuilding the Amazon Placement Optimization reporting system using Supabase Edge Functions, replacing the N8N workflows.

## Key Decisions

### ✅ Confirmed Choices
- **Secrets Management**: Supabase Vault (NOT Google Cloud KMS)
- **Database View**: Regular View (NOT materialized view)
- **Output Format**: Google Sheets (keeping existing format)
- **Code Language**: TypeScript for Edge Functions
- **Deployment**: Direct cutover (no parallel run with N8N)

### Reasoning
- **Supabase Vault**: Easier to scale to multiple users, free, simpler architecture
- **Regular View**: Fast enough for weekly reports (2-5 seconds), simpler maintenance
- **No Parallel Run**: N8N system is on different Supabase account, clean separation

## Implementation Phases

### Phase 1: Database Setup (Day 1)
**Goal**: Create all database tables, indexes, and views

**Tasks**:
1. Create 8 tables with RLS policies:
   - encrypted_credentials → **DEPRECATED** (using Vault instead)
   - token_cache
   - report_ledger
   - portfolios
   - placement_bids
   - raw_campaign_reports
   - raw_placement_reports
   - workflow_runs

2. Create indexes on:
   - Foreign keys
   - Query columns (report_id, campaign_id, placement type)
   - Date columns for time-based queries

3. Create view_placement_optimization_report:
   - Aggregates data from raw tables
   - Calculates CVR and ACoS
   - Returns 25 columns for Google Sheets

4. Generate TypeScript types:
   - Run supabase gen types command
   - Save to types/database.types.ts

**Validation**:
- All tables created successfully
- RLS policies active
- View query returns expected structure
- Types generated without errors

---

### Phase 2: Edge Function 1 - Data Collection (Days 2-3)
**Goal**: Implement collect-placement-data Edge Function

**Function**: `collect-placement-data`
**Trigger**: pg_cron (weekly, Wednesday 09:05 UTC)
**Duration**: ~5-10 minutes

**Tasks**:
1. Set up function scaffolding
2. Implement credential retrieval from Supabase Vault:
   - sp_api_refresh_token
   - sp_api_client_id
   - sp_api_client_secret
   - advertising_client_id
   - advertising_client_secret

3. Implement OAuth token management:
   - Check token_cache for valid token
   - Request new token if expired
   - Cache token with 55-minute TTL

4. Implement API calls:
   - Get profile ID
   - Fetch portfolios (POST /portfolios/list)
   - Fetch placement bids (POST /sp/campaigns/list)
   - Clear old data from tables

5. Implement report requests (6 reports):
   - Placement Report 30-day
   - Placement Report 7-day
   - Campaign Report 30-day
   - Campaign Report 7-day
   - Campaign Report Yesterday
   - Campaign Report Day Before

6. Store report IDs in report_ledger

**Validation**:
- Function deploys successfully
- Can retrieve credentials from Vault
- OAuth token obtained and cached
- All 6 reports requested
- Report IDs stored in ledger
- Portfolios and placement bids stored

---

### Phase 3: Edge Function 2 - Report Processing (Days 4-5)
**Goal**: Implement process-reports Edge Function

**Function**: `process-reports`
**Trigger**: pg_cron (60 minutes after Function 1)
**Duration**: ~60-75 minutes

**Tasks**:
1. Set up function scaffolding
2. Implement report status polling:
   - Query report_ledger for pending reports
   - Poll /reporting/reports/{reportId} every 60 seconds
   - Max 60 attempts (1 hour timeout)
   - Update status in ledger

3. Implement report download:
   - Download from URL in status response
   - Decompress GZIP
   - Parse JSON

4. Implement data transformation:
   - Transform placement reports to raw_placement_reports schema
   - Transform campaign reports to raw_campaign_reports schema
   - Handle NULL values
   - Calculate 3-day lag dates

5. Implement batch insertion:
   - Insert in batches of 1000 rows
   - Use transactions for consistency
   - Update report_ledger status

6. Error handling:
   - Retry logic for API failures
   - Partial success handling
   - Logging for debugging

**Validation**:
- Function deploys successfully
- Polls report status correctly
- Downloads and decompresses reports
- Transforms data correctly
- Inserts into database
- Handles errors gracefully

---

### Phase 4: Edge Function 3 - Sheet Generation (Days 6-7)
**Goal**: Implement generate-sheets-report Edge Function

**Function**: `generate-sheets-report`
**Trigger**: pg_cron (75 minutes after Function 1)
**Duration**: ~5-10 minutes

**Tasks**:
1. Set up function scaffolding
2. Configure Google Sheets API:
   - Service account authentication
   - JWT token signing
   - Sheets API client

3. Implement report query:
   - Query view_placement_optimization_report
   - Validate 25 columns returned
   - Apply placement optimization logic

4. Implement sheet creation:
   - Copy template sheet
   - Set permissions
   - Clear existing data

5. Implement data population:
   - Format data for batch append
   - Write to "USA" sheet
   - Apply conditional formatting
   - Set column widths

6. Implement notification:
   - Discord webhook message
   - Include report URL
   - Include summary stats

7. Update report_ledger with URL

**Validation**:
- Function deploys successfully
- Queries view correctly
- Creates Google Sheet
- Populates data accurately
- Formatting matches template
- Notification sent
- URL stored in ledger

---

### Phase 5: Scheduling (Day 8)
**Goal**: Set up pg_cron jobs for automated execution

**Tasks**:
1. Create cron job for collect-placement-data:
   ```sql
   SELECT cron.schedule(
     'collect-placement-data-weekly',
     '5 9 * * 3',  -- Every Wednesday at 09:05 UTC
     $$SELECT net.http_post(...)$$
   );
   ```

2. Create cron job for process-reports:
   ```sql
   SELECT cron.schedule(
     'process-reports-weekly',
     '5 10 * * 3',  -- Every Wednesday at 10:05 UTC
     $$SELECT net.http_post(...)$$
   );
   ```

3. Create cron job for generate-sheets-report:
   ```sql
   SELECT cron.schedule(
     'generate-sheets-weekly',
     '20 10 * * 3',  -- Every Wednesday at 10:20 UTC
     $$SELECT net.http_post(...)$$
   );
   ```

**Validation**:
- All cron jobs created
- Jobs show in cron.job table
- Jobs execute on schedule
- Can manually trigger for testing

---

### Phase 6: Supabase Vault Setup (Day 9)
**Goal**: Configure secrets in Supabase Vault

**Secrets to Store**:
1. **amazon_sp_api_refresh_token** - Amazon SP-API refresh token
2. **amazon_sp_api_client_id** - SP-API LWA client ID
3. **amazon_sp_api_client_secret** - SP-API LWA client secret
4. **amazon_advertising_client_id** - Amazon Ads API client ID
5. **amazon_advertising_client_secret** - Amazon Ads API client secret
6. **google_sheets_service_account** - Google Sheets service account JSON
7. **discord_webhook_url** - Discord webhook for notifications

**Tasks**:
1. Navigate to Supabase Dashboard → Project Settings → Vault
2. Create each secret with appropriate name
3. Test retrieval from Edge Function
4. Document secret names for reference

**Validation**:
- All secrets stored in Vault
- Edge Functions can retrieve secrets
- No secrets in environment variables
- No secrets in code

---

### Phase 7: Testing (Days 10-11)
**Goal**: Comprehensive testing of entire workflow

#### Unit Tests
- [ ] CVR calculation (divide by zero handling)
- [ ] ACoS calculation
- [ ] Date calculations (3-day lag)
- [ ] Placement type mapping
- [ ] NULL value handling

#### Integration Tests
- [ ] OAuth token flow
- [ ] Report request creation
- [ ] Report status polling
- [ ] Report download and decompression
- [ ] Data transformation
- [ ] Database insertion
- [ ] View query
- [ ] Google Sheets creation

#### End-to-End Test
1. **Manual trigger** of collect-placement-data
2. **Verify** 6 report IDs in report_ledger
3. **Wait** for reports to complete
4. **Manual trigger** of process-reports
5. **Verify** data in raw tables
6. **Manual trigger** of generate-sheets-report
7. **Verify** Google Sheet created with correct data

#### Data Validation
- [ ] All 25 columns present
- [ ] CVR matches manual calculation
- [ ] ACoS matches manual calculation
- [ ] Placement types mapped correctly
- [ ] Portfolio names correct
- [ ] No missing campaigns
- [ ] Formatting matches template

**Validation**:
- All tests pass
- End-to-end workflow successful
- Data accuracy verified
- Performance acceptable (<90 min total)

---

### Phase 8: Documentation (Day 12)
**Goal**: Create comprehensive documentation

**Documents to Create**:
1. **DEPLOYMENT.md** - Deployment instructions
2. **OPERATIONS.md** - How to monitor and troubleshoot
3. **SECRETS.md** - Secret management guide
4. **TESTING.md** - Testing procedures
5. **ROLLBACK.md** - How to rollback if needed

**Update**:
- README.md with new architecture
- Environment variable documentation
- API endpoint references

---

### Phase 9: Production Deployment (Day 13)
**Goal**: Deploy to production Supabase project

**Pre-Deployment Checklist**:
- [ ] All secrets in Vault
- [ ] All Edge Functions tested
- [ ] Database schema deployed
- [ ] View query tested
- [ ] Cron jobs configured
- [ ] Documentation complete
- [ ] Backup plan ready

**Deployment Steps**:
1. Deploy database schema (tables, indexes, view)
2. Deploy Edge Functions (all 3)
3. Configure Vault secrets
4. Set up cron jobs
5. Verify first execution (manual trigger)
6. Monitor logs
7. Verify Google Sheet output

**Post-Deployment**:
- Monitor first automatic execution (next Wednesday)
- Review logs for errors
- Validate output data
- Send test notification

---

### Phase 10: Monitoring (Ongoing)
**Goal**: Ensure system reliability

**Monitoring Points**:
1. **Cron Job Execution**:
   - Check cron.job_run_details for failures
   - Alert if job doesn't run

2. **Edge Function Logs**:
   - Monitor for errors
   - Track execution time
   - Watch for rate limiting

3. **Report Generation**:
   - Verify reports complete within 45 minutes
   - Check for missing reports
   - Validate data quality

4. **Google Sheets**:
   - Verify sheet created weekly
   - Check data accuracy
   - Monitor formatting

**Alerting**:
- Discord notification on failure
- Email alerts for critical errors
- Weekly summary report

---

## Timeline Summary

| Phase | Duration | Days | Status |
|-------|----------|------|--------|
| Database Setup | 1 day | 1 | Pending |
| Edge Function 1 | 2 days | 2-3 | Pending |
| Edge Function 2 | 2 days | 4-5 | Pending |
| Edge Function 3 | 2 days | 6-7 | Pending |
| Scheduling | 1 day | 8 | Pending |
| Vault Setup | 1 day | 9 | Pending |
| Testing | 2 days | 10-11 | Pending |
| Documentation | 1 day | 12 | Pending |
| Deployment | 1 day | 13 | Pending |

**Total: 13 days** (assuming dedicated work time)

**Realistic with interruptions: 2-3 weeks**

---

## Success Criteria

✅ **Functional**:
- All 6 reports requested successfully
- Reports process within 90 minutes
- Google Sheet generated with 25 columns
- CVR and ACoS calculations accurate
- Notification sent on completion

✅ **Reliability**:
- No manual intervention needed
- Error handling prevents partial failures
- Logs provide debugging information
- 99% success rate on weekly runs

✅ **Performance**:
- Total execution < 90 minutes
- View query < 5 seconds
- Sheet generation < 10 minutes

✅ **Maintainability**:
- Code is well-documented
- Secrets in Vault (not code)
- TypeScript types for safety
- Clear error messages

---

## Migration from N8N

Since N8N is on a different Supabase account:
- **No data migration needed**
- **No parallel run required**
- **Clean cutover**

**Steps**:
1. Complete implementation and testing
2. Deploy to production
3. Disable N8N workflows (or leave running on old account)
4. Monitor first production run
5. Archive N8N configuration for reference

---

## Rollback Plan

If something goes wrong after deployment:

**Immediate**:
1. Disable pg_cron jobs:
   ```sql
   SELECT cron.unschedule('collect-placement-data-weekly');
   SELECT cron.unschedule('process-reports-weekly');
   SELECT cron.unschedule('generate-sheets-weekly');
   ```

2. Re-enable N8N workflows (if still available)

**Data Recovery**:
- Database tables have timestamps (can identify last good run)
- Report ledger tracks all executions
- Google Sheets have version history

**Long-term Fix**:
- Review logs to identify issue
- Fix bug in Edge Function
- Re-deploy and test
- Re-enable cron jobs

---

## Next Steps

Ready to begin Phase 1: Database Setup

**Command to proceed**:
"Start implementing the database schema"

This will:
1. Create all 8 tables with RLS policies
2. Create indexes
3. Create the SQL view
4. Generate TypeScript types
