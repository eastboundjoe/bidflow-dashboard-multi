-- =====================================================
-- MIGRATION 003: UPDATE VIEW FOR MULTI-TENANCY
-- =====================================================
-- Purpose: Modify view_placement_optimization_report to include tenant context
-- Dependencies: 001_add_multi_tenant_tables.sql, 002_add_tenant_id_columns.sql
-- Rollback: See rollback_003.sql
-- Estimated Time: 2 minutes
-- =====================================================

-- Drop existing view
DROP VIEW IF EXISTS view_placement_optimization_report;

-- Recreate with multi-tenant support
CREATE VIEW view_placement_optimization_report AS
WITH
all_placements AS (
  SELECT 'PLACEMENT_TOP' AS placement
  UNION ALL SELECT 'PLACEMENT_REST_OF_SEARCH'
  UNION ALL SELECT 'PLACEMENT_PRODUCT_PAGE'
),
campaign_placement_combinations AS (
  SELECT
    c.tenant_id,
    c.amazon_ads_account_id,
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
    tenant_id,
    amazon_ads_account_id,
    campaign_id,
    placement,
    SUM(clicks) AS clicks_30,
    SUM(spend) AS spend_30,
    SUM(orders_30d) AS orders_30,
    SUM(sales_30d) AS sales_30
  FROM placement_performance
  WHERE period_type = '30day'
  GROUP BY tenant_id, amazon_ads_account_id, campaign_id, placement
),
placement_7d AS (
  SELECT
    tenant_id,
    amazon_ads_account_id,
    campaign_id,
    placement,
    SUM(clicks) AS clicks_7,
    SUM(spend) AS spend_7,
    SUM(orders_7d) AS orders_7,
    SUM(sales_7d) AS sales_7
  FROM placement_performance
  WHERE period_type = '7day'
  GROUP BY tenant_id, amazon_ads_account_id, campaign_id, placement
),
campaign_tos_30d AS (
  SELECT
    tenant_id,
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_30
  FROM campaign_performance
  WHERE period_type = '30day'
  GROUP BY tenant_id, campaign_id
),
campaign_tos_7d AS (
  SELECT
    tenant_id,
    campaign_id,
    AVG(top_of_search_impression_share) * 100 AS tos_is_7
  FROM campaign_performance
  WHERE period_type = '7day'
  GROUP BY tenant_id, campaign_id
),
campaign_yesterday AS (
  SELECT
    tenant_id,
    campaign_id,
    SUM(spend) AS spent_yesterday,
    AVG(top_of_search_impression_share) * 100 AS tos_is_yesterday
  FROM campaign_performance
  WHERE period_type = 'yesterday'
  GROUP BY tenant_id, campaign_id
),
campaign_day_before AS (
  SELECT
    tenant_id,
    campaign_id,
    SUM(spend) AS spent_day_before
  FROM campaign_performance
  WHERE period_type = 'day_before'
  GROUP BY tenant_id, campaign_id
)
SELECT
  cpc.tenant_id AS "Tenant ID",
  t.name AS "Tenant Name",
  aa.account_name AS "Amazon Account",
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
  ON cpc.tenant_id = p30.tenant_id
  AND cpc.campaign_id = p30.campaign_id
  AND cpc.placement = p30.placement
LEFT JOIN placement_7d p7
  ON cpc.tenant_id = p7.tenant_id
  AND cpc.campaign_id = p7.campaign_id
  AND cpc.placement = p7.placement
LEFT JOIN portfolios p
  ON cpc.tenant_id = p.tenant_id
  AND cpc.portfolio_id = p.portfolio_id
LEFT JOIN campaign_tos_30d c30
  ON cpc.tenant_id = c30.tenant_id
  AND cpc.campaign_id = c30.campaign_id
LEFT JOIN campaign_tos_7d c7
  ON cpc.tenant_id = c7.tenant_id
  AND cpc.campaign_id = c7.campaign_id
LEFT JOIN campaign_yesterday cy
  ON cpc.tenant_id = cy.tenant_id
  AND cpc.campaign_id = cy.campaign_id
LEFT JOIN campaign_day_before cdb
  ON cpc.tenant_id = cdb.tenant_id
  AND cpc.campaign_id = cdb.campaign_id
LEFT JOIN tenants t
  ON cpc.tenant_id = t.id
LEFT JOIN amazon_ads_accounts aa
  ON cpc.amazon_ads_account_id = aa.id
ORDER BY
  t.name,
  aa.account_name,
  p.portfolio_name NULLS LAST,
  cpc.campaign_name,
  CASE
    WHEN cpc.placement = 'PLACEMENT_TOP' THEN 1
    WHEN cpc.placement = 'PLACEMENT_REST_OF_SEARCH' THEN 2
    WHEN cpc.placement = 'PLACEMENT_PRODUCT_PAGE' THEN 3
    ELSE 4
  END;

-- Add comment
COMMENT ON VIEW view_placement_optimization_report IS 'Multi-tenant placement optimization report. Shows all campaigns x 3 placements with tenant/account grouping. Ordered by tenant, account, portfolio, campaign, then placement type.';

-- Grant access
GRANT SELECT ON view_placement_optimization_report TO authenticated;
GRANT SELECT ON view_placement_optimization_report TO service_role;

-- Note: Views cannot have RLS policies directly
-- Data isolation is enforced through RLS policies on underlying tables (portfolios, campaigns, etc.)

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify migration success:
--
-- Check view still works:
-- SELECT COUNT(*) FROM view_placement_optimization_report;
-- -- Should return same count as before (or more if showing all 3 placements per campaign)
--
-- Check new columns exist:
-- SELECT "Tenant Name", "Amazon Account", COUNT(*) as row_count
-- FROM view_placement_optimization_report
-- GROUP BY "Tenant Name", "Amazon Account";
-- -- Should show "Ramen Bomb LLC" with your data
--
-- Check tenant isolation (as authenticated user):
-- SET request.jwt.claims = '{"sub": "YOUR_USER_UUID"}';
-- SELECT DISTINCT "Tenant Name" FROM view_placement_optimization_report;
-- -- Should only see your tenant
--
-- Performance check:
-- EXPLAIN ANALYZE
-- SELECT * FROM view_placement_optimization_report
-- WHERE "Tenant ID" = 'YOUR_TENANT_UUID';
-- -- Should use indexes, < 5 seconds

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
