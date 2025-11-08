# Set Up Automatic Report Processing with Cron

Since Amazon reports can take 30-45 minutes (or up to 3 hours), we need a scheduled job that checks periodically instead of a single long-running function.

## Option 1: Supabase Cron (Simplest)

Supabase has built-in cron scheduling using pg_cron extension.

### Step 1: Enable pg_cron
1. Go to Database > Extensions
2. Search for "pg_cron"
3. Enable it

### Step 2: Create a cron job that calls report-processor

Run this SQL:

```sql
-- Schedule report-processor to run every 5 minutes
SELECT cron.schedule(
  'process-pending-reports',           -- Job name
  '*/5 * * * *',                       -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-processor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object()
    ) as request_id;
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- To unschedule later:
-- SELECT cron.unschedule('process-pending-reports');
```

### Step 3: Set the service role key as a setting

```sql
-- Store the service role key (do this once)
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoaGF0emt3eWtxZHFma3hpbnZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDg0MzQxOSwiZXhwIjoyMDQ2NDE5NDE5fQ.YjzQDuEhATJBL_uTmz3yrMdBHxsgLr9Jx6c1JNEwD8w';
```

## Option 2: GitHub Actions (Free & Reliable)

Use GitHub Actions to trigger the report-processor every 5 minutes.

Create `.github/workflows/process-reports.yml`:

```yaml
name: Process Pending Amazon Reports

on:
  schedule:
    # Run every 5 minutes
    - cron: '*/5 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  process-reports:
    runs-on: ubuntu-latest
    steps:
      - name: Call report-processor
        run: |
          curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-processor \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

Add `SUPABASE_SERVICE_ROLE_KEY` to GitHub Secrets.

## Option 3: External Cron Service

Use a service like:
- **Cron-job.org** (free, simple web interface)
- **EasyCron** (free tier available)
- **Google Cloud Scheduler** (99¢/month for 3 jobs)

Configure it to call:
```
POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-processor
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
Body: {}
```

## Recommended Approach

**For now (testing):** Just run report-processor manually every 10-15 minutes until reports are ready.

**For production:** Set up pg_cron (Option 1) - it's the simplest and runs directly in Supabase.

## Manual Approach (For Right Now)

Since you're testing, just invoke `report-processor` manually:
1. Wait 10-15 minutes
2. Invoke report-processor
3. Check if reports downloaded
4. If still pending, wait another 10-15 minutes
5. Repeat until all done

Once you verify everything works, set up the cron job for automatic processing.
