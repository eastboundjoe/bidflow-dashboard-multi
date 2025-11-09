-- Check status of the 4 successfully requested reports
SELECT
  report_id,
  report_name,
  report_type,
  status,
  requested_at,
  completed_at,
  -- Calculate how long ago the report was requested
  EXTRACT(EPOCH FROM (NOW() - requested_at))/60 as minutes_since_request
FROM report_requests
WHERE execution_id = 'Week45_2025_Final_Fix'
ORDER BY requested_at;

-- This will show us:
-- 1. Which 4 reports were successfully requested
-- 2. Their current status (PENDING, COMPLETED, FAILED, etc.)
-- 3. How many minutes ago they were requested
-- 4. If they're completed, when they finished
