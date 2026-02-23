-- =============================================================================
-- WEEKLY TABLES MIGRATION
-- Run this in Supabase SQL Editor (once)
-- =============================================================================
-- What this does:
--   STEP 1: Adds impression share columns for 7d and yesterday
--   STEP 2: Creates populate_weekly_tables() function
--           Called by n8n Flow 2 after each run to snapshot weekly data
--   STEP 3: Replaces view_placement_optimization_report to read from
--           weekly tables so the dashboard week selector shows real weeks
--   STEP 4: Backfill — populates weekly tables from existing raw data
-- =============================================================================


-- =============================================================================
-- STEP 1: Add missing impression share columns
-- =============================================================================

ALTER TABLE public.weekly_campaign_performance
  ADD COLUMN IF NOT EXISTS top_of_search_impression_share_7d numeric(5,2),
  ADD COLUMN IF NOT EXISTS top_of_search_impression_share_yesterday numeric(5,2);


-- =============================================================================
-- STEP 2: populate_weekly_tables() function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.populate_weekly_tables(
  p_tenant_id  uuid,
  p_week_id    text,
  p_snapshot_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN

  -- 1. Snapshot portfolios
  INSERT INTO public.weekly_portfolios (
    snapshot_id, tenant_id, week_id,
    portfolio_id, portfolio_name, budget_amount, currency, status
  )
  SELECT
    p_snapshot_id, p_tenant_id, p_week_id,
    portfolio_id, portfolio_name, budget_amount, currency, portfolio_state
  FROM public.portfolios
  WHERE tenant_id = p_tenant_id
  ON CONFLICT DO NOTHING;

  -- 2. Snapshot placement bid adjustments
  INSERT INTO public.weekly_placement_bids (
    snapshot_id, tenant_id, week_id,
    campaign_id, campaign_name, campaign_status, portfolio_id, campaign_budget,
    placement_top_of_search, placement_rest_of_search, placement_product_page
  )
  SELECT
    p_snapshot_id, p_tenant_id, p_week_id,
    campaign_id, campaign_name, campaign_status, portfolio_id, campaign_budget,
    placement_top_of_search, placement_rest_of_search, placement_product_page
  FROM public.placement_bids
  WHERE tenant_id = p_tenant_id
  ON CONFLICT DO NOTHING;

  -- 3. Snapshot campaign-level performance (joins 30d, 7d, yesterday, dayBefore)
  INSERT INTO public.weekly_campaign_performance (
    snapshot_id, tenant_id, week_id,
    campaign_id, campaign_name, campaign_status, portfolio_id,
    impressions_30d, clicks_30d, spend_30d, sales_30d, purchases_30d, acos_30d, cvr_30d,
    impressions_7d,  clicks_7d,  spend_7d,  sales_7d,  purchases_7d,  acos_7d,  cvr_7d,
    yesterday_impressions, yesterday_clicks, yesterday_spend,
    day_before_impressions, day_before_clicks, day_before_spend,
    campaign_budget, top_of_search_impression_share,
    top_of_search_impression_share_7d, top_of_search_impression_share_yesterday
  )
  SELECT
    p_snapshot_id, p_tenant_id, p_week_id,
    c30.campaign_id, c30.campaign_name, c30.campaign_status, c30.portfolio_id,
    COALESCE(c30.impressions, 0), COALESCE(c30.clicks, 0), COALESCE(c30.spend, 0),
    COALESCE(c30.sales_30d, 0),  COALESCE(c30.purchases_30d, 0), c30.acos_30d, c30.cvr_30d,
    COALESCE(c7.impressions,  0), COALESCE(c7.clicks,  0), COALESCE(c7.spend,  0),
    COALESCE(c7.sales_7d,  0),   COALESCE(c7.purchases_7d,  0),  c7.acos_7d,  c7.cvr_7d,
    COALESCE(cy.impressions,  0), COALESCE(cy.clicks,  0), COALESCE(cy.spend,  0),
    COALESCE(cdb.impressions, 0), COALESCE(cdb.clicks, 0), COALESCE(cdb.spend, 0),
    c30.campaign_budget_amount,
    c30.top_of_search_impression_share,
    c7.top_of_search_impression_share,
    cy.top_of_search_impression_share
  FROM (
    SELECT * FROM public.raw_campaign_reports
    WHERE tenant_id = p_tenant_id AND report_type = '30day'
      AND data_date = (SELECT MAX(data_date) FROM public.raw_campaign_reports
                       WHERE tenant_id = p_tenant_id AND report_type = '30day')
  ) c30
  LEFT JOIN (
    SELECT * FROM public.raw_campaign_reports
    WHERE tenant_id = p_tenant_id AND report_type = '7day'
      AND data_date = (SELECT MAX(data_date) FROM public.raw_campaign_reports
                       WHERE tenant_id = p_tenant_id AND report_type = '7day')
  ) c7  ON c30.campaign_id = c7.campaign_id
  LEFT JOIN (
    SELECT * FROM public.raw_campaign_reports
    WHERE tenant_id = p_tenant_id AND report_type = 'yesterday'
      AND data_date = (SELECT MAX(data_date) FROM public.raw_campaign_reports
                       WHERE tenant_id = p_tenant_id AND report_type = 'yesterday')
  ) cy  ON c30.campaign_id = cy.campaign_id
  LEFT JOIN (
    SELECT * FROM public.raw_campaign_reports
    WHERE tenant_id = p_tenant_id AND report_type = 'dayBefore'
      AND data_date = (SELECT MAX(data_date) FROM public.raw_campaign_reports
                       WHERE tenant_id = p_tenant_id AND report_type = 'dayBefore')
  ) cdb ON c30.campaign_id = cdb.campaign_id
  ON CONFLICT DO NOTHING;

  -- 4. Snapshot placement-level performance (30d + 7d, maps raw names to weekly CHECK values)
  INSERT INTO public.weekly_placement_performance (
    snapshot_id, tenant_id, week_id,
    campaign_id, campaign_name, placement_type,
    impressions_30d, clicks_30d, spend_30d, sales_30d, purchases_30d, acos_30d, cvr_30d,
    impressions_7d,  clicks_7d,  spend_7d,  sales_7d,  purchases_7d,  acos_7d,  cvr_7d
  )
  SELECT
    p_snapshot_id, p_tenant_id, p_week_id,
    p30.campaign_id, p30.campaign_name,
    CASE p30.placement_classification
      WHEN 'Top of Search on-Amazon' THEN 'Top of Search'
      WHEN 'Other on-Amazon'         THEN 'Rest of Search'
      WHEN 'Detail Page on-Amazon'   THEN 'Product Page'
    END,
    COALESCE(p30.impressions, 0), COALESCE(p30.clicks, 0), COALESCE(p30.spend, 0),
    COALESCE(p30.sales_30d,  0),  COALESCE(p30.purchases_30d, 0), p30.acos_30d, p30.cvr_30d,
    COALESCE(p7.impressions, 0),  COALESCE(p7.clicks,  0),  COALESCE(p7.spend,  0),
    COALESCE(p7.sales_7d,  0),    COALESCE(p7.purchases_7d,  0),  p7.acos_7d,  p7.cvr_7d
  FROM (
    SELECT * FROM public.raw_placement_reports
    WHERE tenant_id = p_tenant_id AND report_type = '30day'
      AND placement_classification IN (
        'Top of Search on-Amazon', 'Other on-Amazon', 'Detail Page on-Amazon'
      )
      AND data_date = (SELECT MAX(data_date) FROM public.raw_placement_reports
                       WHERE tenant_id = p_tenant_id AND report_type = '30day')
  ) p30
  LEFT JOIN (
    SELECT * FROM public.raw_placement_reports
    WHERE tenant_id = p_tenant_id AND report_type = '7day'
      AND data_date = (SELECT MAX(data_date) FROM public.raw_placement_reports
                       WHERE tenant_id = p_tenant_id AND report_type = '7day')
  ) p7 ON p30.campaign_id = p7.campaign_id
      AND p30.placement_classification = p7.placement_classification
  ON CONFLICT DO NOTHING;

  -- 5. Mark snapshot completed
  UPDATE public.weekly_snapshots
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_snapshot_id AND tenant_id = p_tenant_id;

END;
$$;


-- =============================================================================
-- STEP 3: Replace view_placement_optimization_report (reads from weekly tables)
-- =============================================================================

DROP VIEW IF EXISTS public.view_placement_optimization_report;

CREATE VIEW public.view_placement_optimization_report
WITH (security_invoker = 'on') AS
WITH placement_types AS (
  SELECT 'Top of Search'  AS wpt, 'Placement Top'           AS normalized, 1 AS sort_order
  UNION ALL SELECT 'Rest of Search',  'Placement Rest Of Search',            2
  UNION ALL SELECT 'Product Page',    'Placement Product Page',              3
),
campaign_week_matrix AS (
  SELECT
    ws.tenant_id, ws.week_id, ws.start_date, ws.end_date,
    uniq.campaign_id, uniq.campaign_name,
    pt.wpt AS placement_type, pt.normalized AS placement_normalized, pt.sort_order
  FROM public.weekly_snapshots ws
  JOIN (
    SELECT DISTINCT tenant_id, week_id, campaign_id, campaign_name
    FROM public.weekly_placement_performance
  ) uniq ON ws.tenant_id = uniq.tenant_id AND ws.week_id = uniq.week_id
  CROSS JOIN placement_types pt
  WHERE ws.status = 'completed'
)
SELECT
  cwm.campaign_name                                                         AS "Campaign",
  COALESCE(wpf.portfolio_name, 'Unknown')                                  AS "Portfolio",
  COALESCE(wb.campaign_budget, 0)                                          AS "Budget",
  COALESCE(pp.clicks_30d, 0)                                               AS "Clicks",
  ROUND(COALESCE(pp.spend_30d, 0), 2)                                      AS "Spend",
  COALESCE(pp.purchases_30d, 0)                                            AS "Orders",
  CASE WHEN COALESCE(pp.clicks_30d, 0) > 0
    THEN ROUND(COALESCE(pp.purchases_30d, 0)::numeric / pp.clicks_30d * 100, 2)
    ELSE 0 END                                                              AS "CVR",
  COALESCE(pp.acos_30d, 0)                                                 AS "ACoS",
  COALESCE(pp.clicks_7d, 0)                                                AS "Clicks_7d",
  ROUND(COALESCE(pp.spend_7d, 0), 2)                                       AS "Spend_7d",
  COALESCE(pp.purchases_7d, 0)                                             AS "Orders_7d",
  CASE WHEN COALESCE(pp.clicks_7d, 0) > 0
    THEN ROUND(COALESCE(pp.purchases_7d, 0)::numeric / pp.clicks_7d * 100, 2)
    ELSE 0 END                                                              AS "CVR_7d",
  COALESCE(pp.acos_7d, 0)                                                  AS "ACoS_7d",
  ('' || COALESCE(ROUND(cp.yesterday_spend, 2), 0))                        AS "Spent DB Yesterday",
  ('' || COALESCE(ROUND(cp.yesterday_spend, 2), 0))                        AS "Spent Yesterday",
  COALESCE(cp.top_of_search_impression_share::text || '%', '0%')           AS "Last 30 days",
  COALESCE(cp.top_of_search_impression_share_7d::text || '%', '0%')        AS "Last 7 days",
  COALESCE(cp.top_of_search_impression_share_yesterday::text || '%', '0%') AS "Yesterday",
  cwm.placement_normalized                                                  AS "Placement Type",
  CASE cwm.placement_type
    WHEN 'Top of Search'  THEN COALESCE(wb.placement_top_of_search,  0)
    WHEN 'Rest of Search' THEN COALESCE(wb.placement_rest_of_search, 0)
    WHEN 'Product Page'   THEN COALESCE(wb.placement_product_page,   0)
    ELSE 0 END                                                              AS "Increase bids by placement",
  0                                                                         AS "Changes in placement",
  ''                                                                        AS "NOTES",
  ''                                                                        AS "Empty1",
  ''                                                                        AS "Empty2",
  cwm.tenant_id,
  cwm.campaign_id,
  cwm.week_id,
  cwm.start_date::text  AS date_range_start,
  cwm.end_date::text    AS date_range_end
FROM campaign_week_matrix cwm
LEFT JOIN public.weekly_placement_performance pp
       ON cwm.tenant_id = pp.tenant_id AND cwm.week_id = pp.week_id
      AND cwm.campaign_id = pp.campaign_id AND cwm.placement_type = pp.placement_type
LEFT JOIN public.weekly_campaign_performance cp
       ON cwm.tenant_id = cp.tenant_id AND cwm.week_id = cp.week_id
      AND cwm.campaign_id = cp.campaign_id
LEFT JOIN public.weekly_placement_bids wb
       ON cwm.tenant_id = wb.tenant_id AND cwm.week_id = wb.week_id
      AND cwm.campaign_id = wb.campaign_id
LEFT JOIN public.weekly_portfolios wpf
       ON cwm.tenant_id = wpf.tenant_id AND cwm.week_id = wpf.week_id
      AND cp.portfolio_id = wpf.portfolio_id
ORDER BY cwm.week_id DESC, cwm.campaign_name, cwm.sort_order;


-- =============================================================================
-- STEP 4: Backfill existing data
-- =============================================================================

-- Backfill impression share columns for existing weekly rows
UPDATE public.weekly_campaign_performance wcp
SET
  top_of_search_impression_share_7d = (
    SELECT top_of_search_impression_share
    FROM public.raw_campaign_reports
    WHERE campaign_id = wcp.campaign_id
      AND tenant_id = wcp.tenant_id
      AND report_type = '7day'
    ORDER BY data_date DESC LIMIT 1
  ),
  top_of_search_impression_share_yesterday = (
    SELECT top_of_search_impression_share
    FROM public.raw_campaign_reports
    WHERE campaign_id = wcp.campaign_id
      AND tenant_id = wcp.tenant_id
      AND report_type = 'yesterday'
    ORDER BY data_date DESC LIMIT 1
  );

-- Populate weekly tables for any snapshots not yet backfilled
DO $$
DECLARE
  snap RECORD;
BEGIN
  FOR snap IN
    SELECT id, tenant_id, week_id
    FROM public.weekly_snapshots
    WHERE status != 'completed'
       OR NOT EXISTS (
         SELECT 1 FROM public.weekly_placement_performance
         WHERE snapshot_id = weekly_snapshots.id
       )
    ORDER BY week_id
  LOOP
    PERFORM public.populate_weekly_tables(snap.tenant_id, snap.week_id, snap.id);
    RAISE NOTICE 'Backfilled week % for tenant %', snap.week_id, snap.tenant_id;
  END LOOP;
END;
$$;
