-- =====================================================
-- Test Sample Data for Amazon Placement Optimization
-- =====================================================
-- This script inserts realistic sample data to test the view
-- =====================================================

-- Step 1: Insert Sample Portfolios
INSERT INTO portfolios (portfolio_id, portfolio_name, portfolio_state, in_budget) VALUES
('PORT001', 'High Performance Portfolio', 'ENABLED', true),
('PORT002', 'Budget Portfolio', 'ENABLED', true);

-- Step 2: Insert Sample Campaigns
INSERT INTO campaigns (
  campaign_id,
  campaign_name,
  campaign_status,
  portfolio_id,
  daily_budget,
  bid_top_of_search,
  bid_rest_of_search,
  bid_product_page,
  targeting_type,
  start_date
) VALUES
('CAMP001', 'Ramen Bomb - Auto Campaign', 'ENABLED', 'PORT001', 50.00, 250, 150, 100, 'AUTO', '2025-01-01'),
('CAMP002', 'InnerIcons - Exact Match', 'ENABLED', 'PORT001', 75.00, 300, 200, 50, 'MANUAL', '2025-01-15'),
('CAMP003', 'Budget Test Campaign', 'ENABLED', 'PORT002', 25.00, 150, 100, 75, 'AUTO', '2025-02-01');

-- Step 3: Insert Campaign Performance Data (30-day)
INSERT INTO campaign_performance (
  campaign_id,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_14d,
  sales_14d,
  orders_30d,
  sales_30d,
  top_of_search_impression_share
) VALUES
('CAMP001', '30day', '2025-11-06', 50000, 1500, 450.00, 120, 2400.00, 180, 3600.00, 250, 5000.00, 0.45),
('CAMP002', '30day', '2025-11-06', 75000, 2250, 675.00, 180, 4500.00, 270, 6750.00, 375, 9375.00, 0.62),
('CAMP003', '30day', '2025-11-06', 25000, 500, 150.00, 30, 450.00, 45, 675.00, 60, 900.00, 0.28);

-- Step 4: Insert Campaign Performance Data (7-day)
INSERT INTO campaign_performance (
  campaign_id,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_14d,
  sales_14d,
  orders_30d,
  sales_30d,
  top_of_search_impression_share
) VALUES
('CAMP001', '7day', '2025-11-06', 12000, 360, 108.00, 29, 580.00, 43, 860.00, 60, 1200.00, 0.48),
('CAMP002', '7day', '2025-11-06', 18000, 540, 162.00, 43, 1075.00, 65, 1625.00, 90, 2250.00, 0.65),
('CAMP003', '7day', '2025-11-06', 6000, 120, 36.00, 7, 105.00, 11, 165.00, 15, 225.00, 0.30);

-- Step 5: Insert Campaign Performance Data (yesterday)
INSERT INTO campaign_performance (
  campaign_id,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_14d,
  sales_14d,
  orders_30d,
  sales_30d,
  top_of_search_impression_share
) VALUES
('CAMP001', 'yesterday', '2025-11-05', 2000, 60, 18.00, 5, 100.00, 7, 140.00, 10, 200.00, 0.50),
('CAMP002', 'yesterday', '2025-11-05', 3000, 90, 27.00, 7, 175.00, 11, 275.00, 15, 375.00, 0.68),
('CAMP003', 'yesterday', '2025-11-05', 1000, 20, 6.00, 1, 15.00, 2, 30.00, 3, 45.00, 0.32);

-- Step 6: Insert Campaign Performance Data (day before yesterday)
INSERT INTO campaign_performance (
  campaign_id,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_14d,
  sales_14d,
  orders_30d,
  sales_30d,
  top_of_search_impression_share
) VALUES
('CAMP001', 'day_before', '2025-11-04', 1800, 54, 16.20, 4, 80.00, 6, 120.00, 8, 160.00, 0.47),
('CAMP002', 'day_before', '2025-11-04', 2700, 81, 24.30, 6, 150.00, 9, 225.00, 13, 325.00, 0.64),
('CAMP003', 'day_before', '2025-11-04', 900, 18, 5.40, 1, 15.00, 1, 15.00, 2, 30.00, 0.29);

-- Step 7: Insert Placement Performance Data (30-day) - Top of Search
INSERT INTO placement_performance (
  campaign_id,
  placement,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_30d,
  sales_30d
) VALUES
('CAMP001', 'PLACEMENT_TOP', '30day', '2025-11-06', 22500, 750, 225.00, 60, 1200.00, 125, 2500.00),
('CAMP002', 'PLACEMENT_TOP', '30day', '2025-11-06', 46500, 1395, 418.50, 112, 2800.00, 233, 5813.00),
('CAMP003', 'PLACEMENT_TOP', '30day', '2025-11-06', 7000, 140, 42.00, 8, 120.00, 17, 255.00);

-- Step 8: Insert Placement Performance Data (30-day) - Rest of Search
INSERT INTO placement_performance (
  campaign_id,
  placement,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_30d,
  sales_30d
) VALUES
('CAMP001', 'PLACEMENT_REST_OF_SEARCH', '30day', '2025-11-06', 17500, 525, 157.50, 40, 800.00, 83, 1660.00),
('CAMP002', 'PLACEMENT_REST_OF_SEARCH', '30day', '2025-11-06', 21000, 630, 189.00, 50, 1250.00, 105, 2625.00),
('CAMP003', 'PLACEMENT_REST_OF_SEARCH', '30day', '2025-11-06', 12500, 250, 75.00, 15, 225.00, 30, 450.00);

-- Step 9: Insert Placement Performance Data (30-day) - Product Pages
INSERT INTO placement_performance (
  campaign_id,
  placement,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_30d,
  sales_30d
) VALUES
('CAMP001', 'PLACEMENT_PRODUCT_PAGE', '30day', '2025-11-06', 10000, 225, 67.50, 20, 400.00, 42, 840.00),
('CAMP002', 'PLACEMENT_PRODUCT_PAGE', '30day', '2025-11-06', 7500, 225, 67.50, 18, 450.00, 37, 937.00),
('CAMP003', 'PLACEMENT_PRODUCT_PAGE', '30day', '2025-11-06', 5500, 110, 33.00, 7, 105.00, 13, 195.00);

-- Step 10: Insert Placement Performance Data (7-day) - Top of Search
INSERT INTO placement_performance (
  campaign_id,
  placement,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_30d,
  sales_30d
) VALUES
('CAMP001', 'PLACEMENT_TOP', '7day', '2025-11-06', 5400, 180, 54.00, 15, 300.00, 30, 600.00),
('CAMP002', 'PLACEMENT_TOP', '7day', '2025-11-06', 11160, 335, 100.35, 27, 675.00, 56, 1395.00),
('CAMP003', 'PLACEMENT_TOP', '7day', '2025-11-06', 1680, 34, 10.08, 2, 30.00, 4, 63.00);

-- Step 11: Insert Placement Performance Data (7-day) - Rest of Search
INSERT INTO placement_performance (
  campaign_id,
  placement,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_30d,
  sales_30d
) VALUES
('CAMP001', 'PLACEMENT_REST_OF_SEARCH', '7day', '2025-11-06', 4200, 126, 37.80, 10, 200.00, 20, 400.00),
('CAMP002', 'PLACEMENT_REST_OF_SEARCH', '7day', '2025-11-06', 5040, 151, 45.45, 12, 300.00, 25, 630.00),
('CAMP003', 'PLACEMENT_REST_OF_SEARCH', '7day', '2025-11-06', 3000, 60, 18.00, 4, 60.00, 8, 135.00);

-- Step 12: Insert Placement Performance Data (7-day) - Product Pages
INSERT INTO placement_performance (
  campaign_id,
  placement,
  period_type,
  report_date,
  impressions,
  clicks,
  spend,
  orders_7d,
  sales_7d,
  orders_30d,
  sales_30d
) VALUES
('CAMP001', 'PLACEMENT_PRODUCT_PAGE', '7day', '2025-11-06', 2400, 54, 16.20, 4, 80.00, 10, 200.00),
('CAMP002', 'PLACEMENT_PRODUCT_PAGE', '7day', '2025-11-06', 1800, 54, 16.20, 4, 100.00, 9, 225.00),
('CAMP003', 'PLACEMENT_PRODUCT_PAGE', '7day', '2025-11-06', 1320, 26, 7.92, 1, 15.00, 3, 27.00);

-- =====================================================
-- VERIFICATION: Query the View
-- =====================================================

SELECT '=== SAMPLE DATA INSERTED ===' AS status;
SELECT 'Now querying view_placement_optimization_report...' AS next_step;

-- Query the view to see the results
SELECT * FROM view_placement_optimization_report
ORDER BY "Portfolio", "Campaign", "Placement Type";
