-- =====================================================
-- Amazon Placement Optimization - Deployment Verification
-- =====================================================
-- Run this after executing create_database.sql to verify everything was created correctly
-- =====================================================

-- VERIFICATION 1: List All Tables
-- Expected: 6 tables
SELECT '=== TABLES ===' AS section;
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- VERIFICATION 2: Verify View
-- Expected: 1 view
SELECT '=== VIEWS ===' AS section;
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'view_placement_optimization_report';

-- VERIFICATION 3: Test View Structure (No Data)
-- Expected: 0 rows, but shows column structure
SELECT '=== VIEW STRUCTURE TEST ===' AS section;
SELECT * FROM view_placement_optimization_report LIMIT 1;

-- VERIFICATION 4: Verify RLS Policies
-- Expected: 6 policies (one per table)
SELECT '=== RLS POLICIES ===' AS section;
SELECT
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- VERIFICATION 5: Verify Indexes
-- Expected: ~20 indexes across all tables
SELECT '=== INDEXES ===' AS section;
SELECT
  tablename,
  COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- VERIFICATION 6: Verify Foreign Keys
-- Expected: 4 foreign key constraints
SELECT '=== FOREIGN KEYS ===' AS section;
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- VERIFICATION 7: Verify Helper Functions
-- Expected: 1 function
SELECT '=== FUNCTIONS ===' AS section;
SELECT
  routine_name,
  routine_type,
  security_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'truncate_performance_data';

-- VERIFICATION 8: Verify Cron Jobs
-- Expected: 0 cron jobs (pg_cron not enabled)
SELECT '=== CRON JOBS ===' AS section;
SELECT 'pg_cron extension not enabled - skipping cron job verification' AS status;

-- VERIFICATION 9: Verify Table Row Counts (Should All Be 0)
-- Expected: All 0s
SELECT '=== ROW COUNTS ===' AS section;
SELECT 'workflow_executions' AS table_name, COUNT(*) AS row_count FROM workflow_executions
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

-- VERIFICATION 10: Check RLS is Enabled
-- Expected: All tables should show rls_enabled = true
SELECT '=== RLS ENABLED STATUS ===' AS section;
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =====================================================
-- DEPLOYMENT VERIFICATION COMPLETE
-- =====================================================
-- If all verifications pass, proceed to:
-- 1. Generate TypeScript types
-- 2. Configure Supabase Vault with API credentials
-- 3. Create Edge Functions
-- =====================================================
