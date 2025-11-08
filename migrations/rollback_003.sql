-- =====================================================
-- ROLLBACK 003: RESTORE ORIGINAL VIEW
-- =====================================================
-- Purpose: Rollback migration 003_update_view.sql
-- Restores view to pre-multi-tenant version
-- =====================================================

-- Drop multi-tenant view
DROP VIEW IF EXISTS view_placement_optimization_report;

-- Recreate original single-tenant view (from create_database.sql)
CREATE VIEW view_placement_optimization_report AS
WITH
all_placements AS (
  SELECT 'PLACEMENT_TOP' AS placement
  UNION ALL SELECT 'PLACEMENT_REST_OF_SEARCH'
  UNION ALL SELECT 'PLACEMENT_PRODUCT_PAGE'
),
campaign_placement_combinations AS (
  SELECT
    c.campaign_id,
    c.campaign_name,
    c.campaign_status,
    c.portfolio_id,
    c.daily_budget,
    c.bid_top_of_search,
    c.bid_rest_of_search,
    c.bid_product_page,
    c.targeting_type,
    c.start_date,
    ap.placement
  FROM campaigns c
  CROSS JOIN all_placements ap
  WHERE c.campaign_status = 'ENABLED'
),
placement_30d AS (
  SELECT
    campaign_id,
    placement,
    SUM(clicks) AS clicks_30,
    SUM(spend) AS spend_30,
    SUM(orders_30d) AS orders_30,
    SUM(sales_30d) AS sales_30
  FROM placement_performance
  WHERE period_type = '30day'
  GROUP BY campaign_id, placement
),
placement_7d AS (
  SELECT
    campaign_id,
    placement,
    SUM(clicks) AS clicks_7,
    SUM(spend) AS spend_7,
    SUM(orders_7d) AS orders_7,
    SUM(sales_7d) AS sales_7
  FROM placement_performance
  WHERE period_type = '7day'
  GROUP BY campaign_id, placement
),
campaign_tos_30d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_30
  FROM campaign_performance
  WHERE period_type = '30day'
  GROUP BY campaign_id
),
campaign_tos_7d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_7
  FROM campaign_performance
  WHERE period_type = '7day'
  GROUP BY campaign_id
),
campaign_yesterday AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_yesterday,
    AVG(top_of_search_impression_share) * 100 AS tos_is_yesterday
  FROM campaign_performance
  WHERE period_type = 'yesterday'
  GROUP BY campaign_id
),
campaign_day_before AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_day_before
  FROM campaign_performance
  WHERE period_type = 'day_before'
  GROUP BY campaign_id
)
SELECT
  cpc.campaign_name AS "Campaign",
  p.portfolio_name AS "Portfolio",
  cpc.daily_budget AS "Budget",
  COALESCE(p30.clicks_30, 0) AS "Clicks-30",
  COALESCE(p30.spend_30, 0) AS "Spend-30",
  COALESCE(p30.orders_30, 0) AS "Orders-30",
  CASE
    WHEN COALESCE(p30.clicks_30, 0) > 0 THEN
      ROUND((COALESCE(p30.orders_30, 0)::DECIMAL / p30.clicks_30) * 100, 2)
    ELSE 0
  END AS "CVR-30",
  CASE
    WHEN COALESCE(p30.sales_30, 0) > 0 THEN
      ROUND((COALESCE(p30.spend_30, 0) / p30.sales_30) * 100, 2)
    ELSE 0
  END AS "ACoS-30",
  COALESCE(p7.clicks_7, 0) AS "Clicks-7",
  COALESCE(p7.spend_7, 0) AS "Spend-7",
  COALESCE(p7.orders_7, 0) AS "Orders-7",
  CASE
    WHEN COALESCE(p7.clicks_7, 0) > 0 THEN
      ROUND((COALESCE(p7.orders_7, 0)::DECIMAL / p7.clicks_7) * 100, 2)
    ELSE 0
  END AS "CVR-7",
  CASE
    WHEN COALESCE(p7.sales_7, 0) > 0 THEN
      ROUND((COALESCE(p7.spend_7, 0) / p7.sales_7) * 100, 2)
    ELSE 0
  END AS "ACoS-7",
  COALESCE(cdb.spent_day_before, 0) AS "Spent DB Yesterday",
  COALESCE(cy.spent_yesterday, 0) AS "Spent Yesterday",
  NULL AS "Array Formula",
  COALESCE(c30.tos_is_30, 0) AS "Last 30 days",
  COALESCE(c7.tos_is_7, 0) AS "Last 7 days",
  COALESCE(cy.tos_is_yesterday, 0) AS "Yesterday",
  CASE
    WHEN cpc.placement = 'PLACEMENT_TOP' THEN 'Placement Top'
    WHEN cpc.placement = 'PLACEMENT_REST_OF_SEARCH' THEN 'Placement Rest Of Search'
    WHEN cpc.placement = 'PLACEMENT_PRODUCT_PAGE' THEN 'Placement Product Page'
    ELSE cpc.placement
  END AS "Placement Type",
  CASE
    WHEN cpc.placement = 'PLACEMENT_TOP' THEN cpc.bid_top_of_search
    WHEN cpc.placement = 'PLACEMENT_REST_OF_SEARCH' THEN cpc.bid_rest_of_search
    WHEN cpc.placement = 'PLACEMENT_PRODUCT_PAGE' THEN cpc.bid_product_page
    ELSE 0
  END AS "Increase bids by placement",
  '' AS "Changes in placement",
  '' AS "NOTES"
FROM campaign_placement_combinations cpc
LEFT JOIN placement_30d p30
  ON cpc.campaign_id = p30.campaign_id
  AND cpc.placement = p30.placement
LEFT JOIN placement_7d p7
  ON cpc.campaign_id = p7.campaign_id
  AND cpc.placement = p7.placement
LEFT JOIN portfolios p
  ON cpc.portfolio_id = p.portfolio_id
LEFT JOIN campaign_tos_30d c30
  ON cpc.campaign_id = c30.campaign_id
LEFT JOIN campaign_tos_7d c7
  ON cpc.campaign_id = c7.campaign_id
LEFT JOIN campaign_yesterday cy
  ON cpc.campaign_id = cy.campaign_id
LEFT JOIN campaign_day_before cdb
  ON cpc.campaign_id = cdb.campaign_id
ORDER BY
  p.portfolio_name NULLS LAST,
  cpc.campaign_name,
  CASE
    WHEN cpc.placement = 'PLACEMENT_TOP' THEN 1
    WHEN cpc.placement = 'PLACEMENT_REST_OF_SEARCH' THEN 2
    WHEN cpc.placement = 'PLACEMENT_PRODUCT_PAGE' THEN 3
    ELSE 4
  END;

-- Verification
SELECT 'Rollback 003 complete' as status;

-- Test view works
SELECT COUNT(*) as view_row_count
FROM view_placement_optimization_report;
