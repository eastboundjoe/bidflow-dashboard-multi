-- =====================================================
-- CLEANUP TEST DATA
-- =====================================================
-- Purpose: Remove sample/test data inserted during Phase 1 testing
-- Created: 2024-11-06
-- Run this in Supabase SQL Editor after testing is complete
-- =====================================================

-- Display current row counts before cleanup
SELECT '=== ROW COUNTS BEFORE CLEANUP ===' AS section;
SELECT 'workflow_executions' AS table_name, COUNT(*) AS rows FROM workflow_executions
UNION ALL
SELECT 'report_requests', COUNT(*) FROM report_requests
UNION ALL
SELECT 'portfolios', COUNT(*) FROM portfolios
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'campaign_performance', COUNT(*) FROM campaign_performance
UNION ALL
SELECT 'placement_performance', COUNT(*) FROM placement_performance;

-- Delete all test data (in correct order due to foreign keys)
DELETE FROM placement_performance;
DELETE FROM campaign_performance;
DELETE FROM campaigns;
DELETE FROM portfolios;
DELETE FROM report_requests;
DELETE FROM workflow_executions;

-- Display row counts after cleanup
SELECT '=== ROW COUNTS AFTER CLEANUP ===' AS section;
SELECT 'workflow_executions' AS table_name, COUNT(*) AS rows FROM workflow_executions
UNION ALL
SELECT 'report_requests', COUNT(*) FROM report_requests
UNION ALL
SELECT 'portfolios', COUNT(*) FROM portfolios
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'campaign_performance', COUNT(*) FROM campaign_performance
UNION ALL
SELECT 'placement_performance', COUNT(*) FROM placement_performance;

-- Confirm all tables are empty
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CLEANUP COMPLETE ===';
  RAISE NOTICE 'All test data has been removed from the database.';
  RAISE NOTICE 'Tables are now empty and ready for production data.';
  RAISE NOTICE '';
END $$;
