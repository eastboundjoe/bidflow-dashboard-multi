-- =====================================================
-- Update View: Sort Placements in Specific Order
-- =====================================================
-- Order: 1. Placement Top, 2. Placement Rest of Search, 3. Placement Product Page
-- =====================================================

DROP VIEW IF EXISTS view_placement_optimization_report;

CREATE OR REPLACE VIEW view_placement_optimization_report AS
WITH
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
  c.campaign_name AS "Campaign",
  p.portfolio_name AS "Portfolio",
  c.daily_budget AS "Budget",
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
    WHEN p30.placement = 'PLACEMENT_TOP' THEN 'Placement Top'
    WHEN p30.placement = 'PLACEMENT_REST_OF_SEARCH' THEN 'Placement Rest Of Search'
    WHEN p30.placement = 'PLACEMENT_PRODUCT_PAGE' THEN 'Placement Product Page'
    ELSE p30.placement
  END AS "Placement Type",
  CASE
    WHEN p30.placement = 'PLACEMENT_TOP' THEN c.bid_top_of_search
    WHEN p30.placement = 'PLACEMENT_REST_OF_SEARCH' THEN c.bid_rest_of_search
    WHEN p30.placement = 'PLACEMENT_PRODUCT_PAGE' THEN c.bid_product_page
    ELSE 0
  END AS "Increase bids by placement",
  '' AS "Changes in placement",
  '' AS "NOTES"

FROM placement_30d p30

LEFT JOIN placement_7d p7
  ON p30.campaign_id = p7.campaign_id
  AND p30.placement = p7.placement

INNER JOIN campaigns c
  ON p30.campaign_id = c.campaign_id

LEFT JOIN portfolios p
  ON c.portfolio_id = p.portfolio_id

LEFT JOIN campaign_tos_30d c30
  ON p30.campaign_id = c30.campaign_id

LEFT JOIN campaign_tos_7d c7
  ON p30.campaign_id = c7.campaign_id

LEFT JOIN campaign_yesterday cy
  ON p30.campaign_id = cy.campaign_id

LEFT JOIN campaign_day_before cdb
  ON p30.campaign_id = cdb.campaign_id

WHERE
  c.campaign_status = 'ENABLED'
  AND COALESCE(p30.spend_30, 0) > 0

ORDER BY
  p.portfolio_name NULLS LAST,
  c.campaign_name,
  CASE p30.placement
    WHEN 'PLACEMENT_TOP' THEN 1
    WHEN 'PLACEMENT_REST_OF_SEARCH' THEN 2
    WHEN 'PLACEMENT_PRODUCT_PAGE' THEN 3
    ELSE 4
  END;

COMMENT ON VIEW view_placement_optimization_report IS 'Aggregates all data into 25-column report format for Google Sheets - Placements ordered: Top, Rest of Search, Product Pages';

-- =====================================================
-- Test the Updated View
-- =====================================================

SELECT '=== VIEW UPDATED ===' AS status;
SELECT 'Placements now ordered: 1. Top, 2. Rest of Search, 3. Product Pages' AS info;

-- Query to verify the new sort order
SELECT
  "Campaign",
  "Portfolio",
  "Placement Type",
  "Clicks-30",
  "Orders-30"
FROM view_placement_optimization_report
ORDER BY "Portfolio", "Campaign", "Placement Type";
