# Amazon Placement Optimization - Edge Functions

Supabase Edge Functions for the Amazon Placement Optimization System. These functions orchestrate data collection from Amazon Ads API, process campaign and placement performance data, and generate optimization reports.

## Architecture

```
┌─────────────────────────┐
│  workflow-executor      │  Main orchestrator
│  (Weekly trigger)       │
└───────────┬─────────────┘
            │
            ├──────────────────────┐
            │                      │
            ▼                      ▼
┌─────────────────────┐   ┌──────────────────────┐
│  report-collector   │   │  report-generator    │
│  (Amazon Ads API)   │   │  (Google Sheets)     │
└─────────────────────┘   └──────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────┐
│            Supabase Database                    │
│  • portfolios                                   │
│  • campaigns                                    │
│  • campaign_performance                         │
│  • placement_performance                        │
│  • view_placement_optimization_report           │
└─────────────────────────────────────────────────┘
```

## Functions

### 1. workflow-executor
**Purpose:** Main orchestrator that coordinates the entire workflow

**Endpoint:** `POST /functions/v1/workflow-executor`

**What it does:**
1. Creates workflow execution record
2. Clears existing performance data
3. Triggers report-collector to fetch data from Amazon Ads API
4. Triggers report-generator to export results
5. Updates execution status

**Request:**
```json
{
  "execution_id": "exec_2024_11_06",
  "dry_run": false
}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "exec_2024_11_06",
  "status": "COMPLETED",
  "completed_at": "2024-11-06T10:30:00Z"
}
```

---

### 2. report-collector
**Purpose:** Fetches data from Amazon Ads API and stores in database

**Endpoint:** `POST /functions/v1/report-collector`

**What it does:**
1. Authenticates with Amazon Ads API using vault credentials
2. Fetches portfolios and campaigns
3. Requests 6 types of reports (placement & campaign performance)
4. Polls for report completion
5. Downloads and parses report data
6. Inserts data into database tables

**Request:**
```json
{
  "execution_id": "exec_2024_11_06",
  "profile_id": "1234567890",
  "dry_run": false
}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "exec_2024_11_06",
  "profile_id": "1234567890",
  "portfolios_count": 3,
  "reports_requested": 6,
  "report_ids": [...]
}
```

**Reports Requested:**
- Placement Performance - 30 Day
- Placement Performance - 7 Day
- Campaign Performance - 30 Day
- Campaign Performance - 7 Day
- Campaign Performance - Yesterday
- Campaign Performance - Day Before Yesterday

---

### 3. report-generator
**Purpose:** Queries the database view and exports results

**Endpoint:** `POST /functions/v1/report-generator`

**What it does:**
1. Queries `view_placement_optimization_report`
2. Formats data (JSON or CSV)
3. Returns formatted report
4. (Future: Exports to Google Sheets)

**Request:**
```json
{
  "execution_id": "exec_2024_11_06",
  "format": "json",
  "dry_run": false
}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "exec_2024_11_06",
  "rows": 27,
  "format": "json",
  "data": [...]
}
```

**Formats Supported:**
- `json` - Returns structured JSON data
- `csv` - Returns CSV file for download

---

## Project Structure

```
placement-optimization-functions/
├── database.types.ts              # TypeScript types from database schema
├── README.md                      # This file
├── DEPLOYMENT.md                  # Deployment instructions
└── supabase/
    ├── config.toml                # Supabase configuration
    └── functions/
        ├── _shared/               # Shared utilities
        │   ├── supabase-client.ts     # Database client & vault access
        │   ├── amazon-ads-client.ts   # Amazon Ads API client with OAuth
        │   ├── types.ts               # Shared types
        │   └── errors.ts              # Error handling utilities
        │
        ├── workflow-executor/     # Main orchestrator
        │   └── index.ts
        │
        ├── report-collector/      # Amazon Ads API integration
        │   └── index.ts
        │
        └── report-generator/      # Report export
            └── index.ts
```

---

## Environment Variables

These are automatically provided by Supabase when deployed:

```bash
SUPABASE_URL=https://phhatzkwykqdqfkxinvr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

---

## Vault Secrets

Required secrets (stored in Supabase Vault):

- `amazon_ads_client_id` - Amazon Ads API Client ID
- `amazon_ads_client_secret` - Amazon Ads API Client Secret
- `amazon_ads_refresh_token` - Long-term refresh token

Access via helper function:
```typescript
const { data } = await supabase.rpc('get_amazon_ads_credentials')
```

---

## Local Development

### Prerequisites
- Node.js 18+ installed
- Supabase CLI installed (`npx supabase`)
- Deno installed (for local testing)

### Setup

1. **Initialize project (already done):**
   ```bash
   npx supabase init
   ```

2. **Link to remote project:**
   ```bash
   npx supabase link --project-ref phhatzkwykqdqfkxinvr
   ```
   You'll need your database password from: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/database

3. **Start local Supabase (optional):**
   ```bash
   npx supabase start
   ```

4. **Serve functions locally:**
   ```bash
   npx supabase functions serve
   ```

### Test Locally

```bash
# Test workflow-executor
curl -X POST http://localhost:54321/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"execution_id": "test_local", "dry_run": true}'

# Test report-generator (read-only)
curl -X POST http://localhost:54321/functions/v1/report-generator \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"execution_id": "test_local", "format": "json"}'
```

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy:**
```bash
# Deploy all functions
npx supabase functions deploy workflow-executor
npx supabase functions deploy report-collector
npx supabase functions deploy report-generator
```

---

## Usage

### Weekly Execution

Trigger the workflow executor once per week:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "exec_2024_11_06",
    "dry_run": false
  }'
```

### Manual Report Generation

Generate a report without collecting new data:

```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-generator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "manual_report",
    "format": "csv"
  }'
```

---

## Monitoring

### View Execution History

```sql
SELECT
  execution_id,
  status,
  started_at,
  completed_at,
  error_message
FROM workflow_executions
ORDER BY started_at DESC
LIMIT 10;
```

### Check Report Status

```sql
SELECT
  report_name,
  report_type,
  status,
  rows_processed,
  requested_at,
  completed_at
FROM report_requests
WHERE execution_id = 'exec_2024_11_06';
```

---

## Error Handling

All functions implement:
- Automatic retry with exponential backoff
- Detailed error logging
- Error tracking in `workflow_executions` table
- Graceful failure handling

Check function logs in Supabase Dashboard:
https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/logs/edge-functions

---

## Next Steps

1. ✅ Deploy functions to Supabase
2. ✅ Update vault with real Amazon Ads API credentials
3. ✅ Test with dry run
4. ✅ Run full workflow
5. ✅ Set up weekly scheduling (cron or external trigger)
6. ⏳ Add Google Sheets export to report-generator
7. ⏳ Add email notifications on success/failure

---

## Support

For issues or questions:
- Review logs in Supabase Dashboard
- Check vault credentials are correct
- Verify Amazon Ads API access
- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
