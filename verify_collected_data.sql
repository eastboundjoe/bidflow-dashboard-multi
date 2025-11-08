-- Verify data collection from report-collector function

-- 1. Check row counts in all tables
SELECT 'PORTFOLIOS' as table_name, COUNT(*) as row_count FROM portfolios
UNION ALL
SELECT 'REPORT_REQUESTS', COUNT(*) FROM report_requests
UNION ALL
SELECT 'WORKFLOW_EXECUTIONS', COUNT(*) FROM workflow_executions
ORDER BY table_name;

-- 2. View the portfolios that were collected
SELECT
  portfolio_id,
  portfolio_name,
  portfolio_state,
  in_budget,
  created_at
FROM portfolios
ORDER BY portfolio_name;

-- 3. View the report requests that were created
SELECT
  execution_id,
  report_id,
  report_name,
  report_type,
  status,
  requested_at
FROM report_requests
WHERE execution_id = 'test_fixed_api'
ORDER BY requested_at;

-- 4. Summary of what was collected
SELECT
  'Portfolios Collected' as metric,
  COUNT(*) as count
FROM portfolios
UNION ALL
SELECT
  'Reports Requested',
  COUNT(*)
FROM report_requests
WHERE execution_id = 'test_fixed_api';
