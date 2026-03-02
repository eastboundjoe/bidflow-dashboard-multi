-- Migration 007: Bid Optimizer Tables
-- Layer 3 keyword-level bid adjustment infrastructure

-- Table 1: Raw targeting report data from Amazon spTargeting reports
CREATE TABLE public.raw_targeting_reports (
    id SERIAL PRIMARY KEY,
    report_id text,
    tenant_id uuid NOT NULL,
    data_date date,
    campaign_id text NOT NULL,
    campaign_name text,
    ad_group_id text,
    ad_group_name text,
    target_id text,           -- Amazon targetId (used for bid write-back)
    targeting_text text,      -- the actual keyword or ASIN
    targeting_type text,      -- KEYWORD, AUTO, PRODUCT_TARGET
    match_type text,          -- EXACT, PHRASE, BROAD
    bid numeric(10,2),        -- current bid at time of report
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric(10,2) DEFAULT 0,
    purchases_30d integer DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    purchases_7d integer DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    acos_30d numeric(5,2),
    acos_7d numeric(5,2),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT raw_targeting_tenant_fk FOREIGN KEY (tenant_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.raw_targeting_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.raw_targeting_reports
    FOR ALL USING (tenant_id = auth.uid());

CREATE INDEX idx_raw_targeting_tenant_date ON public.raw_targeting_reports(tenant_id, data_date);
CREATE INDEX idx_raw_targeting_campaign ON public.raw_targeting_reports(tenant_id, campaign_id);
CREATE INDEX idx_raw_targeting_target ON public.raw_targeting_reports(tenant_id, target_id);


-- Table 2: Weekly snapshot of keyword/targeting performance
CREATE TABLE public.weekly_targeting_performance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    campaign_id text NOT NULL,
    campaign_name text,
    ad_group_id text,
    ad_group_name text,
    target_id text,
    targeting_text text,
    targeting_type text,
    match_type text,
    bid numeric(10,2),
    clicks_30d bigint DEFAULT 0,
    spend_30d numeric(10,2) DEFAULT 0,
    orders_30d integer DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    acos_30d numeric(5,2),
    clicks_7d bigint DEFAULT 0,
    spend_7d numeric(10,2) DEFAULT 0,
    orders_7d integer DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    acos_7d numeric(5,2),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT wtp_snapshot_fk FOREIGN KEY (snapshot_id) REFERENCES public.weekly_snapshots(id) ON DELETE CASCADE
);

ALTER TABLE public.weekly_targeting_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.weekly_targeting_performance
    FOR ALL USING (tenant_id = auth.uid());

CREATE INDEX idx_wtp_tenant_week ON public.weekly_targeting_performance(tenant_id, week_id);
CREATE INDEX idx_wtp_campaign ON public.weekly_targeting_performance(tenant_id, campaign_id);
CREATE INDEX idx_wtp_target ON public.weekly_targeting_performance(tenant_id, target_id);

-- Unique constraint to prevent duplicate rows per snapshot + target
CREATE UNIQUE INDEX idx_wtp_unique_snapshot_target
    ON public.weekly_targeting_performance(snapshot_id, target_id);


-- Table 3: Audit log of every keyword bid change applied through BidFlow
CREATE TABLE public.bid_change_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    campaign_id text NOT NULL,
    campaign_name text,
    target_id text NOT NULL,
    targeting_text text,
    match_type text,
    old_bid numeric(10,2),
    new_bid numeric(10,2),
    rule_applied text CHECK (rule_applied IN ('bleeders', 'high_acos', 'low_clicks', 'good_acos', 'manual_override')),
    applied_at timestamptz DEFAULT now(),
    notes text,
    CONSTRAINT bcl_tenant_fk FOREIGN KEY (tenant_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.bid_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.bid_change_log
    FOR ALL USING (tenant_id = auth.uid());

CREATE INDEX idx_bcl_tenant_week ON public.bid_change_log(tenant_id, week_id);
CREATE INDEX idx_bcl_campaign ON public.bid_change_log(tenant_id, campaign_id);
