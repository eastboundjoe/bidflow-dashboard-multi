-- Manually insert the 6 pending report requests
-- These were already requested from Amazon API but the database insert failed

-- Step 1: Insert the workflow execution record (required by foreign key)
INSERT INTO workflow_executions (execution_id, status, started_at)
VALUES ('test_fixed_api', 'RUNNING', NOW())
ON CONFLICT (execution_id) DO NOTHING;

-- Step 2: Insert the report requests
INSERT INTO report_requests
  (execution_id, report_id, report_name, report_type, status)
VALUES
  ('test_fixed_api', '601333d5-535e-40b7-b73d-fe36472aa5eb', 'SP-Placement-30Days-2025-11-08', 'placement_30day', 'PENDING'),
  ('test_fixed_api', 'a196b773-62ac-4454-9345-ac9a97f25b85', 'SP-Placement-7Days-2025-11-08', 'placement_7day', 'PENDING'),
  ('test_fixed_api', '81306bd0-9a32-4007-968c-3e35222b55f3', 'SP-Campaign-30Days', 'campaign_30day', 'PENDING'),
  ('test_fixed_api', '495be67d-db0c-4fdf-acc4-59b4f8bb3685', 'SP-Campaign-7Days', 'campaign_7day', 'PENDING'),
  ('test_fixed_api', 'fcf23303-7d5b-4e16-9e16-f7df60aaa7f7', 'SP-Campaign-Yesterday-2025-11-08', 'campaign_yesterday', 'PENDING'),
  ('test_fixed_api', 'b6bdbbf0-ef5d-4a10-97d3-848f7fb19c09', 'SP-Campaign-DayBefore-2025-11-08', 'campaign_day_before', 'PENDING');

-- Verify the inserts
SELECT report_name, report_type, status, requested_at
FROM report_requests
WHERE execution_id = 'test_fixed_api'
ORDER BY report_name;
