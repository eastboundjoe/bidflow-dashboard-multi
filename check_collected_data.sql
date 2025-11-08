-- Check all tables for collected data

SELECT 'PORTFOLIOS' as table_name, COUNT(*) as row_count FROM portfolios
UNION ALL
SELECT 'CAMPAIGNS', COUNT(*) FROM campaigns
UNION ALL
SELECT 'CAMPAIGN_PERFORMANCE', COUNT(*) FROM campaign_performance
UNION ALL
SELECT 'PLACEMENT_PERFORMANCE', COUNT(*) FROM placement_performance
UNION ALL
SELECT 'REPORT_REQUESTS', COUNT(*) FROM report_requests
UNION ALL
SELECT 'WORKFLOW_EXECUTIONS', COUNT(*) FROM workflow_executions;

-- Show some sample data
SELECT '=== PORTFOLIOS ===' as section;
SELECT * FROM portfolios LIMIT 5;

SELECT '=== CAMPAIGNS ===' as section;
SELECT campaign_id, campaign_name, campaign_status, daily_budget FROM campaigns LIMIT 5;

SELECT '=== REPORT REQUESTS ===' as section;
SELECT report_name, status, rows_processed FROM report_requests ORDER BY requested_at DESC LIMIT 10;
