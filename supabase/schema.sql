--
-- PostgreSQL database dump
--

\restrict jCKXjgmX01pKry4EuQwrceXupfT1QXlFK6nOEGd9zoScphfszhzD1YDutwaYZvN

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.8 (Ubuntu 17.8-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: cleanup_old_report_ledger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_report_ledger() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete records older than 3 months
  DELETE FROM report_ledger
  WHERE created_at < NOW() - INTERVAL '3 months';
  
  -- Get the count of deleted rows
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup (optional - requires a logs table)
  RAISE NOTICE 'Deleted % old report_ledger records', deleted_count;
  
END;
$$;


--
-- Name: FUNCTION cleanup_old_report_ledger(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_report_ledger() IS 'Deletes report_ledger records older than 3 months. Runs automatically via pg_cron.';


--
-- Name: clear_existing_weekly_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clear_existing_weekly_data() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
    DELETE FROM public.weekly_campaign_performance
      WHERE tenant_id = NEW.tenant_id AND week_id = NEW.week_id;

    DELETE FROM public.weekly_placement_bids
      WHERE tenant_id = NEW.tenant_id AND week_id = NEW.week_id;

    DELETE FROM public.weekly_placement_performance
      WHERE tenant_id = NEW.tenant_id AND week_id = NEW.week_id;

    DELETE FROM public.weekly_portfolios
      WHERE tenant_id = NEW.tenant_id AND week_id = NEW.week_id;

    -- Delete the existing snapshot row last (children cleared above first)
    DELETE FROM public.weekly_snapshots
      WHERE tenant_id = NEW.tenant_id AND week_id = NEW.week_id;

    RETURN NEW;
  END;
  $$;


--
-- Name: delete_tenant_secrets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_tenant_secrets(p_tenant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_cred_record RECORD;
BEGIN
  -- Get the credential record for this tenant
  SELECT vault_id_client_id, vault_id_client_secret, vault_id_refresh_token
  INTO v_cred_record
  FROM public.credentials
  WHERE tenant_id = p_tenant_id;

  -- Delete vault secrets directly from vault.secrets table
  IF v_cred_record.vault_id_client_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_cred_record.vault_id_client_id;
  END IF;

  IF v_cred_record.vault_id_client_secret IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_cred_record.vault_id_client_secret;
  END IF;

  IF v_cred_record.vault_id_refresh_token IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_cred_record.vault_id_refresh_token;
  END IF;

  -- Delete the credentials record
  DELETE FROM public.credentials WHERE tenant_id = p_tenant_id;

  -- Delete all weekly data for this tenant
  -- Order matters due to foreign key constraints
  DELETE FROM public.weekly_placement_performance WHERE tenant_id = p_tenant_id;
  DELETE FROM public.weekly_placement_bids WHERE tenant_id = p_tenant_id;
  DELETE FROM public.weekly_portfolios WHERE tenant_id = p_tenant_id;
  DELETE FROM public.weekly_snapshots WHERE tenant_id = p_tenant_id;

  RETURN;
END;
$$;


--
-- Name: FUNCTION delete_tenant_secrets(p_tenant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_tenant_secrets(p_tenant_id uuid) IS 'Securely deletes all vault secrets and credentials for a tenant during account deletion';


--
-- Name: get_current_week_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_week_id() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN TO_CHAR(CURRENT_DATE, 'IYYY-"W"IW');
END;
$$;


--
-- Name: get_decrypted_refresh_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_decrypted_refresh_token(p_tenant_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'vault'
    AS $$
     DECLARE
         v_refresh_token TEXT;
     BEGIN
        SELECT decrypted_secret INTO v_refresh_token
        FROM vault.decrypted_secrets
        JOIN public.credentials ON credentials.vault_id_refresh_token = decrypted_secrets.id
        WHERE credentials.tenant_id = p_tenant_id;
   
        RETURN v_refresh_token;
    END;
    $$;


--
-- Name: get_tenant_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_tenant_token(p_vault_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT decrypted_secret 
    FROM vault.decrypted_secrets 
    WHERE id = p_vault_id
  );
END;
$$;


--
-- Name: get_week_metadata(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_week_metadata(input_date date DEFAULT CURRENT_DATE) RETURNS TABLE(week_id text, year integer, week_number integer, start_date date, end_date date)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(input_date, 'IYYY-"W"IW') AS week_id,
    EXTRACT(ISOYEAR FROM input_date)::INTEGER AS year,
    EXTRACT(WEEK FROM input_date)::INTEGER AS week_number,
    DATE_TRUNC('week', input_date)::DATE AS start_date,
    (DATE_TRUNC('week', input_date) + INTERVAL '6 days')::DATE AS end_date;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Insert new tenant into credentials table
  -- tenant_id = user's auth.users.id
  INSERT INTO public.credentials (
    tenant_id,
    status,
    amazon_profile_id,
    marketplace_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,                    -- Use auth.users.id as tenant_id
    'inactive',                -- Start as inactive until they add Amazon credentials
    NULL,                      -- User will add this later
    'ATVPDKIKX0DER',          -- Default to US marketplace
    NOW(),
    NOW()
  )
  ON CONFLICT (tenant_id) DO NOTHING; -- Prevent duplicates

  RETURN NEW;
END;
$$;


--
-- Name: normalize_placement_type(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_placement_type(placement_classification text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    CASE placement_classification
        WHEN 'Top of Search on-Amazon' THEN RETURN 'TOP_OF_SEARCH';
        WHEN 'Other on-Amazon' THEN RETURN 'REST_OF_SEARCH';
        WHEN 'Detail Page on-Amazon' THEN RETURN 'PRODUCT_PAGE';
        ELSE RETURN 'UNKNOWN';
    END CASE;
END;
$$;


--
-- Name: populate_weekly_tables(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.populate_weekly_tables(p_tenant_id uuid, p_week_id text, p_snapshot_id uuid) RETURNS void
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

  -- 2. Snapshot placement bid adjustments + change tracking at this point in time
  INSERT INTO public.weekly_placement_bids (
    snapshot_id, tenant_id, week_id,
    campaign_id, campaign_name, campaign_status, portfolio_id, campaign_budget,
    placement_top_of_search, placement_rest_of_search, placement_product_page,
    last_changed_at_top,     last_changed_to_top,
    last_changed_at_rest,    last_changed_to_rest,
    last_changed_at_product, last_changed_to_product
  )
  SELECT
    p_snapshot_id, p_tenant_id, p_week_id,
    campaign_id, campaign_name, campaign_status, portfolio_id, campaign_budget,
    placement_top_of_search, placement_rest_of_search, placement_product_page,
    last_changed_at_top,     last_changed_to_top,
    last_changed_at_rest,    last_changed_to_rest,
    last_changed_at_product, last_changed_to_product
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


--
-- Name: store_amazon_credentials(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_amazon_credentials(p_client_id text, p_client_secret text, p_refresh_token text, p_amazon_profile_id text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
  v_vault_id_client_id UUID;
  v_vault_id_client_secret UUID;
  v_vault_id_refresh_token UUID;
BEGIN
  -- Get current user's tenant_id (same as auth.uid())
  v_tenant_id := auth.uid();

  -- Validate user has access
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Store client_id in vault
  INSERT INTO vault.secrets (secret)
  VALUES (p_client_id)
  RETURNING id INTO v_vault_id_client_id;

  -- Store client_secret in vault
  INSERT INTO vault.secrets (secret)
  VALUES (p_client_secret)
  RETURNING id INTO v_vault_id_client_secret;

  -- Store refresh_token in vault
  INSERT INTO vault.secrets (secret)
  VALUES (p_refresh_token)
  RETURNING id INTO v_vault_id_refresh_token;

  -- Update credentials table with vault IDs
  UPDATE public.credentials
  SET
    vault_id_client_id = v_vault_id_client_id,
    vault_id_client_secret = v_vault_id_client_secret,
    vault_id_refresh_token = v_vault_id_refresh_token,
    amazon_profile_id = p_amazon_profile_id,
    status = 'active',  -- Activate tenant now that they have credentials
    updated_at = NOW()
  WHERE tenant_id = v_tenant_id;

  -- Return success with vault IDs
  RETURN json_build_object(
    'success', true,
    'tenant_id', v_tenant_id,
    'vault_id_client_id', v_vault_id_client_id,
    'vault_id_client_secret', v_vault_id_client_secret,
    'vault_id_refresh_token', v_vault_id_refresh_token
  );
END;
$$;


--
-- Name: FUNCTION store_amazon_credentials(p_client_id text, p_client_secret text, p_refresh_token text, p_amazon_profile_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.store_amazon_credentials(p_client_id text, p_client_secret text, p_refresh_token text, p_amazon_profile_id text) IS 'Allows authenticated users to securely store their Amazon Ads API credentials in Supabase Vault';


--
-- Name: store_tenant_secret(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_tenant_secret(p_tenant_id uuid, p_secret text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_secret_id uuid;
  BEGIN
    -- We hardcode the name here so the token string itself is NEVER used as a label
    SELECT vault.create_secret(
      p_secret,               -- The actual encrypted value
      'amazon_refresh_token', -- The clean, static name
      'Tenant ID: ' || p_tenant_id::text -- The description for tracking
    ) INTO v_secret_id;

    UPDATE public.credentials
    SET vault_id_refresh_token = v_secret_id,
        updated_at = now()
    WHERE tenant_id = p_tenant_id;

    RETURN v_secret_id;
  END;
  $$;


--
-- Name: store_tenant_secret(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_tenant_secret(p_tenant_id uuid, p_secret text, p_secret_type text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT vault.create_secret(
    p_secret,
    p_secret_type || '_token',
    'Tenant: ' || p_tenant_id::text
  ) INTO v_secret_id;

  -- Use INSERT ... ON CONFLICT to upsert the credentials row
  IF p_secret_type = 'refresh' THEN
    INSERT INTO public.credentials (tenant_id, vault_id_refresh_token, updated_at)
    VALUES (p_tenant_id, v_secret_id, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET vault_id_refresh_token = v_secret_id, updated_at = now();

  ELSIF p_secret_type = 'client_id' THEN
    INSERT INTO public.credentials (tenant_id, vault_id_client_id, updated_at)
    VALUES (p_tenant_id, v_secret_id, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET vault_id_client_id = v_secret_id, updated_at = now();

  ELSIF p_secret_type = 'client_secret' THEN
    INSERT INTO public.credentials (tenant_id, vault_id_client_secret, updated_at)
    VALUES (p_tenant_id, v_secret_id, now())
    ON CONFLICT (tenant_id)
    DO UPDATE SET vault_id_client_secret = v_secret_id, updated_at = now();
  END IF;

  RETURN v_secret_id;
END;
$$;


--
-- Name: sync_staging_to_raw(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_staging_to_raw() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  BEGIN
      -- Insert campaign reports with calculated metrics
      INSERT INTO public.raw_campaign_reports (
          report_id, report_name, report_type, data_date,
          campaign_id, campaign_name, campaign_status, campaign_budget_type,
          campaign_budget_amount, campaign_budget_currency_code,
          clicks, impressions, purchases_1d, purchases_7d, purchases_14d, purchases_30d,
          sales_1d, sales_7d, sales_14d, sales_30d,
          top_of_search_impression_share, spend, tenant_id, created_at,
          portfolio_id,
          -- Calculated Columns
          ctr, cpc,
          acos_1d, acos_7d, acos_14d, acos_30d,
          cvr_1d, cvr_7d, cvr_14d, cvr_30d
      )
      SELECT
          scr.report_id, scr.report_name, scr.report_type, scr.data_date,
          scr.campaign_id, scr.campaign_name, scr.campaign_status, scr.campaign_budget_type,
          scr.campaign_budget_amount, scr.campaign_budget_currency_code,
          scr.clicks, scr.impressions, scr.purchases_1d, scr.purchases_7d, scr.purchases_14d, scr.purchases_30d,
          scr.sales_1d, scr.sales_7d, scr.sales_14d, scr.sales_30d,
          scr.top_of_search_impression_share, scr.spend, scr.tenant_id, NOW(),
          -- Try to get portfolio_id from staging bids first, then fallback to existing bids table
          COALESCE(scr.portfolio_id, spb.portfolio_id, pb.portfolio_id),
          
          -- Calculated CTR (Clicks / Impressions)
          CASE WHEN scr.impressions > 0 THEN ROUND(scr.clicks::numeric / scr.impressions, 4) ELSE 0 END,
          -- Calculated CPC (Spend / Clicks)
          CASE WHEN scr.clicks > 0 THEN ROUND(scr.spend / scr.clicks, 2) ELSE 0 END,
          
          -- Calculated ACoS (Spend / Sales)
          CASE WHEN scr.sales_1d > 0 THEN ROUND((scr.spend / scr.sales_1d) * 100, 2) ELSE 0 END,
          CASE WHEN scr.sales_7d > 0 THEN ROUND((scr.spend / scr.sales_7d) * 100, 2) ELSE 0 END,
          CASE WHEN scr.sales_14d > 0 THEN ROUND((scr.spend / scr.sales_14d) * 100, 2) ELSE 0 END,
          CASE WHEN scr.sales_30d > 0 THEN ROUND((scr.spend / scr.sales_30d) * 100, 2) ELSE 0 END,

          -- Calculated CVR (Purchases / Clicks)
          CASE WHEN scr.clicks > 0 THEN ROUND(scr.purchases_1d::numeric / scr.clicks, 4) ELSE 0 END,
          CASE WHEN scr.clicks > 0 THEN ROUND(scr.purchases_7d::numeric / scr.clicks, 4) ELSE 0 END,
          CASE WHEN scr.clicks > 0 THEN ROUND(scr.purchases_14d::numeric / scr.clicks, 4) ELSE 0 END,
          CASE WHEN scr.clicks > 0 THEN ROUND(scr.purchases_30d::numeric / scr.clicks, 4) ELSE 0 END

      FROM public.staging_campaign_reports scr
      LEFT JOIN public.staging_placement_bids spb 
        ON scr.campaign_id = spb.campaign_id AND scr.tenant_id = spb.tenant_id
      LEFT JOIN public.placement_bids pb 
        ON scr.campaign_id = pb.campaign_id AND scr.tenant_id = pb.tenant_id
      ON CONFLICT (tenant_id, campaign_id, report_type, data_date) DO NOTHING;

      -- Insert placement reports with calculated metrics and correct placement columns
      INSERT INTO public.raw_placement_reports (
          report_id, report_name, report_type, data_date,
          campaign_id, campaign_name, campaign_status,
          placement_classification, -- Original Name
          placement_type,           -- Normalized Name
          clicks, impressions,
          purchases_7d, purchases_14d, purchases_30d,
          sales_7d, sales_14d, sales_30d, spend, tenant_id, created_at,
          -- Calculated Columns
          ctr, cpc,
          acos_7d, acos_14d, acos_30d,
          cvr_7d, cvr_14d, cvr_30d
      )
      SELECT
          report_id, report_name, report_type, data_date,
          campaign_id, campaign_name, campaign_status,
          
          -- Fix placement_classification (Map 'Rest of Search' to 'Other on-Amazon')
          CASE 
            WHEN placement_type = 'Rest of Search' THEN 'Other on-Amazon'
            ELSE placement_type 
          END,
          
          -- Fix placement_type (Normalize to standard internal names)
          CASE
            WHEN placement_type IN ('Top of Search on-Amazon', 'TOS') THEN 'Placement Top'
            WHEN placement_type IN ('Other on-Amazon', 'Rest of Search') THEN 'Placement Rest Of Search'
            WHEN placement_type IN ('Detail Page on-Amazon', 'Product Page') THEN 'Placement Product Page'
            ELSE placement_type
          END,

          clicks, impressions,
          purchases_7d, purchases_14d, purchases_30d,
          sales_7d, sales_14d, sales_30d, spend, tenant_id, NOW(),
          
          -- Calculated CTR
          CASE WHEN impressions > 0 THEN ROUND(clicks::numeric / impressions, 4) ELSE 0 END,
          -- Calculated CPC
          CASE WHEN clicks > 0 THEN ROUND(spend / clicks, 2) ELSE 0 END,

          -- Calculated ACoS
          CASE WHEN sales_7d > 0 THEN ROUND((spend / sales_7d) * 100, 2) ELSE 0 END,
          CASE WHEN sales_14d > 0 THEN ROUND((spend / sales_14d) * 100, 2) ELSE 0 END,
          CASE WHEN sales_30d > 0 THEN ROUND((spend / sales_30d) * 100, 2) ELSE 0 END,

          -- Calculated CVR
          CASE WHEN clicks > 0 THEN ROUND(purchases_7d::numeric / clicks, 4) ELSE 0 END,
          CASE WHEN clicks > 0 THEN ROUND(purchases_14d::numeric / clicks, 4) ELSE 0 END,
          CASE WHEN clicks > 0 THEN ROUND(purchases_30d::numeric / clicks, 4) ELSE 0 END

      FROM public.staging_placement_reports
      ON CONFLICT (tenant_id, campaign_id, placement_type, report_type, data_date) DO NOTHING;

      -- Portfolios and Bids logic remains same
      INSERT INTO public.portfolios (
          portfolio_id, portfolio_name, portfolio_state, budget_amount, currency,
          tenant_id, updated_at
      )
      SELECT
          portfolio_id, portfolio_name, portfolio_state, budget_amount, currency,
          tenant_id, NOW()
      FROM public.staging_portfolios
      ON CONFLICT (tenant_id, portfolio_id) DO UPDATE SET
          portfolio_name = EXCLUDED.portfolio_name,
          portfolio_state = EXCLUDED.portfolio_state,
          budget_amount = EXCLUDED.budget_amount,
          currency = EXCLUDED.currency,
          updated_at = NOW();

      INSERT INTO public.placement_bids (
          campaign_id, campaign_name, campaign_status, campaign_budget, portfolio_id,
          placement_top_of_search, placement_rest_of_search, placement_product_page,
          tenant_id, updated_at
      )
      SELECT
          campaign_id, campaign_name, campaign_status, campaign_budget, portfolio_id,
          placement_top_of_search, placement_rest_of_search, placement_product_page,
          tenant_id, NOW()
      FROM public.staging_placement_bids
      ON CONFLICT (tenant_id, campaign_id) DO UPDATE SET
          campaign_name = EXCLUDED.campaign_name,
          campaign_status = EXCLUDED.campaign_status,
          campaign_budget = EXCLUDED.campaign_budget,
          portfolio_id = EXCLUDED.portfolio_id,
          placement_top_of_search = EXCLUDED.placement_top_of_search,
          placement_rest_of_search = EXCLUDED.placement_rest_of_search,
          placement_product_page = EXCLUDED.placement_product_page,
          updated_at = NOW();

      TRUNCATE TABLE public.staging_campaign_reports;
      TRUNCATE TABLE public.staging_placement_reports;
      TRUNCATE TABLE public.staging_portfolios;
      TRUNCATE TABLE public.staging_placement_bids;
  END;
  $$;


--
-- Name: truncate_performance_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.truncate_performance_data() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    TRUNCATE TABLE public.raw_campaign_reports;
    TRUNCATE TABLE public.raw_placement_reports;
    TRUNCATE TABLE public.placement_bids;
    TRUNCATE TABLE public.portfolios;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: campaign_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    campaign_id text NOT NULL,
    placement_type text NOT NULL,
    note text DEFAULT ''::text,
    goal_completed boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credentials (
    tenant_id uuid NOT NULL,
    amazon_profile_id text,
    vault_id_refresh_token uuid,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    marketplace_id text DEFAULT 'ATVPDKIKX0DER'::text,
    updated_at timestamp with time zone DEFAULT now(),
    vault_id_client_id uuid,
    vault_id_client_secret uuid,
    stripe_customer_id text,
    stripe_subscription_id text,
    subscription_status text DEFAULT 'trialing'::text,
    subscription_tier text DEFAULT 'free'::text,
    trial_ends_at timestamp with time zone,
    current_period_end timestamp with time zone,
    report_day text DEFAULT 'monday'::text,
    report_hour integer DEFAULT 3,
    access_token_cache text,
    access_token_expires_at timestamp with time zone,
    CONSTRAINT credentials_report_day_check CHECK ((report_day = ANY (ARRAY['monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text, 'sunday'::text]))),
    CONSTRAINT credentials_report_hour_check CHECK (((report_hour >= 0) AND (report_hour <= 23))),
    CONSTRAINT credentials_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'incomplete'::text, 'incomplete_expired'::text, 'unpaid'::text]))),
    CONSTRAINT credentials_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])))
);


--
-- Name: COLUMN credentials.stripe_customer_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.stripe_customer_id IS 'Stripe customer ID for billing';


--
-- Name: COLUMN credentials.stripe_subscription_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.stripe_subscription_id IS 'Stripe subscription ID for active subscription';


--
-- Name: COLUMN credentials.subscription_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.subscription_status IS 'Current subscription status from Stripe';


--
-- Name: COLUMN credentials.subscription_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.subscription_tier IS 'Subscription tier: free, pro, enterprise';


--
-- Name: COLUMN credentials.trial_ends_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.trial_ends_at IS 'When the trial period ends';


--
-- Name: COLUMN credentials.current_period_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credentials.current_period_end IS 'When the current billing period ends';


--
-- Name: placement_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.placement_bids (
    campaign_id text NOT NULL,
    campaign_name text NOT NULL,
    campaign_status text,
    campaign_budget numeric(10,2),
    portfolio_id text,
    placement_top_of_search integer DEFAULT 0,
    placement_rest_of_search integer DEFAULT 0,
    placement_product_page integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    last_changed_at_top timestamp with time zone,
    last_changed_to_top integer,
    last_changed_at_rest timestamp with time zone,
    last_changed_to_rest integer,
    last_changed_at_product timestamp with time zone,
    last_changed_to_product integer
);


--
-- Name: TABLE placement_bids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.placement_bids IS 'Current placement bid adjustments for active campaigns';


--
-- Name: COLUMN placement_bids.placement_top_of_search; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.placement_bids.placement_top_of_search IS 'Bid adjustment percentage for top of search placement';


--
-- Name: portfolios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolios (
    portfolio_id text NOT NULL,
    portfolio_name text NOT NULL,
    portfolio_state text DEFAULT 'ENABLED'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    budget_amount numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text
);


--
-- Name: TABLE portfolios; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.portfolios IS 'Portfolio information and names for campaign organization';


--
-- Name: raw_campaign_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_campaign_reports (
    id integer NOT NULL,
    report_id text,
    report_name text,
    report_type text,
    data_date date,
    campaign_id text NOT NULL,
    campaign_name text,
    campaign_status text,
    campaign_budget_amount numeric(10,2),
    portfolio_id text,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric(10,2) DEFAULT 0,
    purchases_1d integer DEFAULT 0,
    sales_1d numeric(10,2) DEFAULT 0,
    purchases_7d integer DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    purchases_14d integer DEFAULT 0,
    sales_14d numeric(10,2) DEFAULT 0,
    purchases_30d integer DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    top_of_search_impression_share numeric(5,2) DEFAULT 0,
    ctr numeric(5,4) DEFAULT 0,
    cpc numeric(10,2) DEFAULT 0,
    acos_1d numeric(5,2) DEFAULT 0,
    acos_7d numeric(5,2) DEFAULT 0,
    acos_14d numeric(5,2) DEFAULT 0,
    acos_30d numeric(5,2) DEFAULT 0,
    cvr_1d numeric(5,4) DEFAULT 0,
    cvr_7d numeric(5,4) DEFAULT 0,
    cvr_14d numeric(5,4) DEFAULT 0,
    cvr_30d numeric(5,4) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    campaign_budget_type text,
    campaign_budget_currency_code text
);


--
-- Name: TABLE raw_campaign_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.raw_campaign_reports IS 'Raw campaign performance data from Amazon API reports';


--
-- Name: COLUMN raw_campaign_reports.report_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_campaign_reports.report_type IS 'Time period: 30day, 7day, yesterday, dayBefore';


--
-- Name: raw_campaign_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raw_campaign_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: raw_campaign_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.raw_campaign_reports_id_seq OWNED BY public.raw_campaign_reports.id;


--
-- Name: raw_placement_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_placement_reports (
    id integer NOT NULL,
    report_name text,
    report_type text,
    data_date date,
    campaign_id text NOT NULL,
    campaign_name text,
    campaign_status text,
    placement_classification text,
    placement_type text,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric(10,2) DEFAULT 0,
    purchases_7d integer DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    purchases_14d integer DEFAULT 0,
    sales_14d numeric(10,2) DEFAULT 0,
    purchases_30d integer DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    ctr numeric(10,4) DEFAULT 0,
    cpc numeric(10,2) DEFAULT 0,
    acos_7d numeric(10,2) DEFAULT 0,
    acos_14d numeric(10,2) DEFAULT 0,
    acos_30d numeric(10,2) DEFAULT 0,
    cvr_7d numeric(10,4) DEFAULT 0,
    cvr_14d numeric(10,4) DEFAULT 0,
    cvr_30d numeric(10,4) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    report_id text
);


--
-- Name: TABLE raw_placement_reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.raw_placement_reports IS 'Raw placement performance data from Amazon API reports';


--
-- Name: COLUMN raw_placement_reports.placement_classification; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_placement_reports.placement_classification IS 'Raw placement name from Amazon API';


--
-- Name: COLUMN raw_placement_reports.placement_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.raw_placement_reports.placement_type IS 'Normalized placement type for consistent reporting';


--
-- Name: raw_placement_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.raw_placement_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: raw_placement_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.raw_placement_reports_id_seq OWNED BY public.raw_placement_reports.id;


--
-- Name: report_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_ledger (
    id integer NOT NULL,
    report_id text NOT NULL,
    name text,
    status text NOT NULL,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    url text,
    url_expires_at timestamp without time zone,
    report_type text,
    processed boolean DEFAULT false,
    created_timestamp timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    week_id text
);


--
-- Name: TABLE report_ledger; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.report_ledger IS 'Tracks all Amazon API reports requested and their status';


--
-- Name: report_ledger_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_ledger_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: report_ledger_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_ledger_id_seq OWNED BY public.report_ledger.id;


--
-- Name: staging_campaign_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_campaign_reports (
    id integer DEFAULT nextval('public.raw_campaign_reports_id_seq'::regclass) NOT NULL,
    report_id text,
    report_name text,
    report_type text,
    data_date date,
    campaign_id text NOT NULL,
    campaign_name text,
    campaign_status text,
    campaign_budget_amount numeric(10,2),
    portfolio_id text,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric(10,2) DEFAULT 0,
    purchases_1d integer DEFAULT 0,
    sales_1d numeric(10,2) DEFAULT 0,
    purchases_7d integer DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    purchases_14d integer DEFAULT 0,
    sales_14d numeric(10,2) DEFAULT 0,
    purchases_30d integer DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    top_of_search_impression_share numeric(5,2) DEFAULT 0,
    ctr numeric(5,4) DEFAULT 0,
    cpc numeric(10,2) DEFAULT 0,
    acos_1d numeric(5,2) DEFAULT 0,
    acos_7d numeric(5,2) DEFAULT 0,
    acos_14d numeric(5,2) DEFAULT 0,
    acos_30d numeric(5,2) DEFAULT 0,
    cvr_1d numeric(5,4) DEFAULT 0,
    cvr_7d numeric(5,4) DEFAULT 0,
    cvr_14d numeric(5,4) DEFAULT 0,
    cvr_30d numeric(5,4) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    campaign_budget_type text,
    campaign_budget_currency_code text
);


--
-- Name: COLUMN staging_campaign_reports.report_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staging_campaign_reports.report_type IS 'Time period: 30day, 7day, yesterday, dayBefore';


--
-- Name: staging_placement_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_placement_bids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    campaign_id text NOT NULL,
    campaign_name text,
    campaign_status text,
    campaign_budget numeric,
    portfolio_id text,
    placement_product_page integer DEFAULT 0,
    placement_rest_of_search integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    placement_top_of_search integer DEFAULT 0
);


--
-- Name: staging_placement_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_placement_reports (
    id integer DEFAULT nextval('public.raw_placement_reports_id_seq'::regclass) NOT NULL,
    report_id text,
    report_name text,
    report_type text,
    data_date date,
    campaign_id text NOT NULL,
    campaign_name text,
    campaign_status text,
    placement_type text,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    spend numeric(10,2) DEFAULT 0,
    purchases_7d integer DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    purchases_14d integer DEFAULT 0,
    sales_14d numeric(10,2) DEFAULT 0,
    purchases_30d integer DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    ctr numeric(10,4) DEFAULT 0,
    cpc numeric(10,2) DEFAULT 0,
    acos_7d numeric(10,2) DEFAULT 0,
    acos_14d numeric(10,2) DEFAULT 0,
    acos_30d numeric(10,2) DEFAULT 0,
    cvr_7d numeric(10,4) DEFAULT 0,
    cvr_14d numeric(10,4) DEFAULT 0,
    cvr_30d numeric(10,4) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id uuid NOT NULL
);


--
-- Name: COLUMN staging_placement_reports.placement_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staging_placement_reports.placement_type IS 'Normalized placement type for consistent reporting';


--
-- Name: staging_portfolios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_portfolios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    portfolio_id text NOT NULL,
    portfolio_name text,
    budget_amount numeric,
    currency text,
    portfolio_state text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: view_campaign_day_before; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_campaign_day_before WITH (security_invoker='true') AS
 SELECT campaign_id AS "Campaign Id",
    report_name AS "Report Name",
    campaign_name AS "Campaign Name",
    campaign_budget_amount AS "Budget",
    report_type AS "Report Type",
    spend AS "Spend",
    campaign_status AS "Campaign Status"
   FROM public.raw_campaign_reports rcr
  WHERE ((report_type = 'dayBefore'::text) AND (data_date = ( SELECT max(raw_campaign_reports.data_date) AS max
           FROM public.raw_campaign_reports
          WHERE (raw_campaign_reports.report_type = 'dayBefore'::text))))
  ORDER BY campaign_name;


--
-- Name: view_campaign_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_campaign_summary WITH (security_invoker='true') AS
 SELECT campaign_name,
    campaign_status,
    count(DISTINCT report_type) AS report_types_count,
    max(data_date) AS latest_data_date,
    sum(
        CASE
            WHEN (report_type = '30day'::text) THEN spend
            ELSE (0)::numeric
        END) AS spend_30d,
    sum(
        CASE
            WHEN (report_type = '7day'::text) THEN spend
            ELSE (0)::numeric
        END) AS spend_7d,
    sum(
        CASE
            WHEN (report_type = 'yesterday'::text) THEN spend
            ELSE (0)::numeric
        END) AS spend_yesterday
   FROM public.raw_campaign_reports
  GROUP BY campaign_name, campaign_status
  ORDER BY campaign_name;


--
-- Name: view_campaign_yesterday; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_campaign_yesterday WITH (security_invoker='true') AS
 SELECT tenant_id,
    campaign_id AS "Campaign Id",
    report_name AS "Report Name",
    campaign_name AS "Campaign Name",
    campaign_budget_amount AS "Budget",
    spend AS "Spend",
    top_of_search_impression_share AS "TOS Impression Share",
    report_type AS "Report Type",
    campaign_status AS "Campaign Status"
   FROM public.raw_campaign_reports
  WHERE ((report_type = 'yesterday'::text) AND (data_date = ( SELECT max(raw_campaign_reports_1.data_date) AS max
           FROM public.raw_campaign_reports raw_campaign_reports_1
          WHERE (raw_campaign_reports_1.report_type = 'yesterday'::text))))
  ORDER BY campaign_name;


--
-- Name: view_current_placement_bids; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_current_placement_bids WITH (security_invoker='true') AS
 SELECT campaign_id AS "Campaign Id",
    campaign_name AS "Campaign Name",
    campaign_status AS "Campaign Status",
    campaign_budget AS "Campaign Budget",
    placement_top_of_search AS "Placement TOS",
    placement_rest_of_search AS "Placement ROS",
    placement_product_page AS "Placement PP",
    portfolio_id AS "Portfolio Id"
   FROM public.placement_bids pb
  ORDER BY campaign_name;


--
-- Name: view_data_update_7days; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_data_update_7days WITH (security_invoker='true') AS
 SELECT campaign_name AS "Campaign 7",
        CASE
            WHEN (placement_classification = 'Top of Search on-Amazon'::text) THEN 'Placement Top'::text
            WHEN (placement_classification = 'Other on-Amazon'::text) THEN 'Placement Rest Of Search'::text
            WHEN (placement_classification = 'Detail Page on-Amazon'::text) THEN 'Placement Product Page'::text
            ELSE placement_classification
        END AS "Placement Type 7",
    sum(clicks) AS "Clicks 7",
    sum(spend) AS "Spend 7",
    sum(purchases_7d) AS "Orders 7",
        CASE
            WHEN (sum(sales_7d) > (0)::numeric) THEN round(((sum(spend) / sum(sales_7d)) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "ACoS 7"
   FROM public.raw_placement_reports rpr
  WHERE ((report_type = '7day'::text) AND (campaign_status = 'ENABLED'::text) AND (placement_classification <> 'Off Amazon'::text) AND (data_date = ( SELECT max(raw_placement_reports.data_date) AS max
           FROM public.raw_placement_reports
          WHERE (raw_placement_reports.report_type = '7day'::text))))
  GROUP BY campaign_name, placement_classification
  ORDER BY campaign_name, placement_classification;


--
-- Name: view_data_update_day_before; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_data_update_day_before WITH (security_invoker='true') AS
 SELECT rcr.campaign_name AS "Campaigns DB",
    p.portfolio_name AS "Portfolio DB",
    rcr.campaign_budget_amount AS "Budget(USD) DB",
    rcr.spend AS "Spend(USD) DB"
   FROM ((public.raw_campaign_reports rcr
     LEFT JOIN public.placement_bids pb ON ((rcr.campaign_id = pb.campaign_id)))
     LEFT JOIN public.portfolios p ON ((pb.portfolio_id = p.portfolio_id)))
  WHERE ((rcr.report_type = 'dayBefore'::text) AND (rcr.data_date = ( SELECT max(raw_campaign_reports.data_date) AS max
           FROM public.raw_campaign_reports
          WHERE (raw_campaign_reports.report_type = 'dayBefore'::text))))
  ORDER BY rcr.campaign_name;


--
-- Name: view_data_update_yesterday; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_data_update_yesterday WITH (security_invoker='true') AS
 SELECT campaign_name AS "Campaigns Y",
    spend AS "Spend(USD) Y"
   FROM public.raw_campaign_reports rcr
  WHERE ((report_type = 'yesterday'::text) AND (data_date = ( SELECT max(raw_campaign_reports.data_date) AS max
           FROM public.raw_campaign_reports
          WHERE (raw_campaign_reports.report_type = 'yesterday'::text))))
  ORDER BY campaign_name;


--
-- Name: view_latest_data_dates; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_latest_data_dates WITH (security_invoker='true') AS
 SELECT raw_campaign_reports.report_type,
    max(raw_campaign_reports.data_date) AS latest_date,
    count(*) AS record_count
   FROM public.raw_campaign_reports
  GROUP BY raw_campaign_reports.report_type
UNION ALL
 SELECT ('placement_'::text || raw_placement_reports.report_type) AS report_type,
    max(raw_placement_reports.data_date) AS latest_date,
    count(*) AS record_count
   FROM public.raw_placement_reports
  GROUP BY raw_placement_reports.report_type
  ORDER BY 1;


--
-- Name: view_placement_30_days; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_placement_30_days WITH (security_invoker='true') AS
 SELECT campaign_id AS "Campaign Id",
    campaign_status AS "Campaign Status",
    sum(impressions) AS "Impressions",
    sum(clicks) AS "Clicks",
    sum(spend) AS "Spend",
    sum(purchases_30d) AS "Orders",
    report_type AS "Report Type",
    placement_classification AS "Placement Classification",
    campaign_name AS "Campaign Name",
    sum(sales_30d) AS "Sales"
   FROM public.raw_placement_reports rpr
  WHERE ((report_type = '30day'::text) AND (data_date = ( SELECT max(raw_placement_reports.data_date) AS max
           FROM public.raw_placement_reports
          WHERE (raw_placement_reports.report_type = '30day'::text))))
  GROUP BY campaign_id, campaign_name, campaign_status, placement_classification, report_type
  ORDER BY campaign_name, placement_classification;


--
-- Name: view_placement_7_days; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_placement_7_days WITH (security_invoker='true') AS
 SELECT campaign_id AS "Campaign Id",
    campaign_name AS "Campaign Name",
    sum(clicks) AS "Clicks",
    sum(spend) AS "Spend",
    sum(sales_7d) AS "Sales",
    sum(purchases_7d) AS "Orders",
    report_type AS "Report Type",
    campaign_status AS "Campaign Status",
    placement_classification AS "Placement Classification"
   FROM public.raw_placement_reports rpr
  WHERE ((report_type = '7day'::text) AND (data_date = ( SELECT max(raw_placement_reports.data_date) AS max
           FROM public.raw_placement_reports
          WHERE (raw_placement_reports.report_type = '7day'::text))))
  GROUP BY campaign_id, campaign_name, campaign_status, placement_classification, report_type
  ORDER BY campaign_name, placement_classification;


--
-- Name: weekly_campaign_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_campaign_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    campaign_id text NOT NULL,
    campaign_name text,
    campaign_status text,
    portfolio_id text,
    impressions_30d bigint DEFAULT 0,
    clicks_30d bigint DEFAULT 0,
    spend_30d numeric(10,2) DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    purchases_30d integer DEFAULT 0,
    acos_30d numeric(5,2),
    cvr_30d numeric(5,4),
    impressions_7d bigint DEFAULT 0,
    clicks_7d bigint DEFAULT 0,
    spend_7d numeric(10,2) DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    purchases_7d integer DEFAULT 0,
    acos_7d numeric(5,2),
    cvr_7d numeric(5,4),
    yesterday_impressions bigint DEFAULT 0,
    yesterday_clicks bigint DEFAULT 0,
    yesterday_spend numeric(10,2) DEFAULT 0,
    day_before_impressions bigint DEFAULT 0,
    day_before_clicks bigint DEFAULT 0,
    day_before_spend numeric(10,2) DEFAULT 0,
    campaign_budget numeric(10,2),
    top_of_search_impression_share numeric(5,2),
    created_at timestamp with time zone DEFAULT now(),
    top_of_search_impression_share_7d numeric(5,2),
    top_of_search_impression_share_yesterday numeric(5,2)
);


--
-- Name: weekly_placement_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_placement_bids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    campaign_id text NOT NULL,
    campaign_name text,
    campaign_status text,
    portfolio_id text,
    campaign_budget numeric(10,2),
    placement_top_of_search integer DEFAULT 0,
    placement_rest_of_search integer DEFAULT 0,
    placement_product_page integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    last_changed_at_top timestamp with time zone,
    last_changed_to_top integer,
    last_changed_at_rest timestamp with time zone,
    last_changed_to_rest integer,
    last_changed_at_product timestamp with time zone,
    last_changed_to_product integer
);


--
-- Name: weekly_placement_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_placement_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    campaign_id text NOT NULL,
    campaign_name text,
    placement_type text NOT NULL,
    impressions_30d bigint DEFAULT 0,
    clicks_30d bigint DEFAULT 0,
    spend_30d numeric(10,2) DEFAULT 0,
    sales_30d numeric(10,2) DEFAULT 0,
    purchases_30d integer DEFAULT 0,
    acos_30d numeric(10,2),
    cvr_30d numeric(10,4),
    impressions_7d bigint DEFAULT 0,
    clicks_7d bigint DEFAULT 0,
    spend_7d numeric(10,2) DEFAULT 0,
    sales_7d numeric(10,2) DEFAULT 0,
    purchases_7d integer DEFAULT 0,
    acos_7d numeric(10,2),
    cvr_7d numeric(10,4),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT weekly_placement_type_check CHECK ((placement_type = ANY (ARRAY['Top of Search'::text, 'Rest of Search'::text, 'Product Page'::text])))
);


--
-- Name: weekly_portfolios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_portfolios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    portfolio_id text NOT NULL,
    portfolio_name text,
    budget_amount numeric(10,2),
    currency text DEFAULT 'USD'::text,
    status text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: weekly_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    week_id text NOT NULL,
    year integer NOT NULL,
    week_number integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'collecting'::text NOT NULL,
    workflow_execution_id text,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT weekly_snapshots_status_check CHECK ((status = ANY (ARRAY['collecting'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: view_placement_optimization_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_placement_optimization_report WITH (security_invoker='on') AS
 WITH placement_types AS (
         SELECT 'Top of Search'::text AS wpt,
            'Placement Top'::text AS normalized,
            1 AS sort_order
        UNION ALL
         SELECT 'Rest of Search'::text,
            'Placement Rest Of Search'::text,
            2
        UNION ALL
         SELECT 'Product Page'::text,
            'Placement Product Page'::text,
            3
        ), campaign_week_matrix AS (
         SELECT ws.tenant_id,
            ws.week_id,
            ws.start_date,
            ws.end_date,
            uniq.campaign_id,
            uniq.campaign_name,
            pt.wpt AS placement_type,
            pt.normalized AS placement_normalized,
            pt.sort_order
           FROM ((public.weekly_snapshots ws
             JOIN ( SELECT DISTINCT weekly_placement_performance.tenant_id,
                    weekly_placement_performance.week_id,
                    weekly_placement_performance.campaign_id,
                    weekly_placement_performance.campaign_name
                   FROM public.weekly_placement_performance) uniq ON (((ws.tenant_id = uniq.tenant_id) AND (ws.week_id = uniq.week_id))))
             CROSS JOIN placement_types pt)
          WHERE (ws.status = 'completed'::text)
        )
 SELECT cwm.campaign_name AS "Campaign",
    COALESCE(wpf.portfolio_name, 'Unknown'::text) AS "Portfolio",
    COALESCE(wb.campaign_budget, (0)::numeric) AS "Budget",
    COALESCE(pp.clicks_30d, (0)::bigint) AS "Clicks",
    round(COALESCE(pp.spend_30d, (0)::numeric), 2) AS "Spend",
    COALESCE(pp.purchases_30d, 0) AS "Orders",
        CASE
            WHEN (COALESCE(pp.clicks_30d, (0)::bigint) > 0) THEN round((((COALESCE(pp.purchases_30d, 0))::numeric / (pp.clicks_30d)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "CVR",
    COALESCE(pp.acos_30d, (0)::numeric) AS "ACoS",
    COALESCE(pp.clicks_7d, (0)::bigint) AS "Clicks_7d",
    round(COALESCE(pp.spend_7d, (0)::numeric), 2) AS "Spend_7d",
    COALESCE(pp.purchases_7d, 0) AS "Orders_7d",
        CASE
            WHEN (COALESCE(pp.clicks_7d, (0)::bigint) > 0) THEN round((((COALESCE(pp.purchases_7d, 0))::numeric / (pp.clicks_7d)::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "CVR_7d",
    COALESCE(pp.acos_7d, (0)::numeric) AS "ACoS_7d",
    (''::text || COALESCE(round(cp.yesterday_spend, 2), (0)::numeric)) AS "Spent DB Yesterday",
    (''::text || COALESCE(round(cp.yesterday_spend, 2), (0)::numeric)) AS "Spent Yesterday",
    COALESCE(((cp.top_of_search_impression_share)::text || '%'::text), '0%'::text) AS "Last 30 days",
    COALESCE(((cp.top_of_search_impression_share_7d)::text || '%'::text), '0%'::text) AS "Last 7 days",
    COALESCE(((cp.top_of_search_impression_share_yesterday)::text || '%'::text), '0%'::text) AS "Yesterday",
    cwm.placement_normalized AS "Placement Type",
        CASE cwm.placement_type
            WHEN 'Top of Search'::text THEN COALESCE(wb.placement_top_of_search, 0)
            WHEN 'Rest of Search'::text THEN COALESCE(wb.placement_rest_of_search, 0)
            WHEN 'Product Page'::text THEN COALESCE(wb.placement_product_page, 0)
            ELSE 0
        END AS "Increase bids by placement",
    0 AS "Changes in placement",
    ''::text AS "NOTES",
    ''::text AS "Empty1",
    ''::text AS "Empty2",
    cwm.tenant_id,
    cwm.campaign_id,
        CASE cwm.placement_type
            WHEN 'Top of Search'::text THEN wb.last_changed_to_top
            WHEN 'Rest of Search'::text THEN wb.last_changed_to_rest
            WHEN 'Product Page'::text THEN wb.last_changed_to_product
            ELSE NULL::integer
        END AS last_changed_to,
        CASE cwm.placement_type
            WHEN 'Top of Search'::text THEN wb.last_changed_at_top
            WHEN 'Rest of Search'::text THEN wb.last_changed_at_rest
            WHEN 'Product Page'::text THEN wb.last_changed_at_product
            ELSE NULL::timestamp with time zone
        END AS last_changed_at,
    cwm.week_id,
    (cwm.start_date)::text AS date_range_start,
    (cwm.end_date)::text AS date_range_end
   FROM ((((campaign_week_matrix cwm
     LEFT JOIN public.weekly_placement_performance pp ON (((cwm.tenant_id = pp.tenant_id) AND (cwm.week_id = pp.week_id) AND (cwm.campaign_id = pp.campaign_id) AND (cwm.placement_type = pp.placement_type))))
     LEFT JOIN public.weekly_campaign_performance cp ON (((cwm.tenant_id = cp.tenant_id) AND (cwm.week_id = cp.week_id) AND (cwm.campaign_id = cp.campaign_id))))
     LEFT JOIN public.weekly_placement_bids wb ON (((cwm.tenant_id = wb.tenant_id) AND (cwm.week_id = wb.week_id) AND (cwm.campaign_id = wb.campaign_id))))
     LEFT JOIN public.weekly_portfolios wpf ON (((cwm.tenant_id = wpf.tenant_id) AND (cwm.week_id = wpf.week_id) AND (cp.portfolio_id = wpf.portfolio_id))))
  ORDER BY cwm.week_id DESC, cwm.campaign_name, cwm.sort_order;


--
-- Name: view_portfolio_lookup; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_portfolio_lookup WITH (security_invoker='true') AS
 SELECT portfolio_id AS " Portfolio Id",
    portfolio_name AS " Portfolio Name"
   FROM public.portfolios
  WHERE (portfolio_state = 'ENABLED'::text)
  ORDER BY portfolio_name;


--
-- Name: view_tos_impression_share; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_tos_impression_share WITH (security_invoker='true') AS
 WITH tos_30d AS (
         SELECT raw_campaign_reports.campaign_name,
            avg(raw_campaign_reports.top_of_search_impression_share) AS tos_is_30d
           FROM public.raw_campaign_reports
          WHERE ((raw_campaign_reports.report_type = '30day'::text) AND (raw_campaign_reports.data_date = ( SELECT max(raw_campaign_reports_1.data_date) AS max
                   FROM public.raw_campaign_reports raw_campaign_reports_1
                  WHERE (raw_campaign_reports_1.report_type = '30day'::text))))
          GROUP BY raw_campaign_reports.campaign_name
        ), tos_7d AS (
         SELECT raw_campaign_reports.campaign_name,
            avg(raw_campaign_reports.top_of_search_impression_share) AS tos_is_7d
           FROM public.raw_campaign_reports
          WHERE ((raw_campaign_reports.report_type = '7day'::text) AND (raw_campaign_reports.data_date = ( SELECT max(raw_campaign_reports_1.data_date) AS max
                   FROM public.raw_campaign_reports raw_campaign_reports_1
                  WHERE (raw_campaign_reports_1.report_type = '7day'::text))))
          GROUP BY raw_campaign_reports.campaign_name
        ), tos_yesterday AS (
         SELECT raw_campaign_reports.campaign_name,
            avg(raw_campaign_reports.top_of_search_impression_share) AS tos_is_yesterday
           FROM public.raw_campaign_reports
          WHERE ((raw_campaign_reports.report_type = 'yesterday'::text) AND (raw_campaign_reports.data_date = ( SELECT max(raw_campaign_reports_1.data_date) AS max
                   FROM public.raw_campaign_reports raw_campaign_reports_1
                  WHERE (raw_campaign_reports_1.report_type = 'yesterday'::text))))
          GROUP BY raw_campaign_reports.campaign_name
        ), all_campaigns AS (
         SELECT tos_30d.campaign_name
           FROM tos_30d
        UNION
         SELECT tos_7d.campaign_name
           FROM tos_7d
        UNION
         SELECT tos_yesterday.campaign_name
           FROM tos_yesterday
        )
 SELECT ac.campaign_name AS "Campaigns 30",
    COALESCE(t30.tos_is_30d, (0)::numeric) AS "Top-of-search IS 30",
    ac.campaign_name AS "Campaigns 7",
    COALESCE(t7.tos_is_7d, (0)::numeric) AS "Top-of-search IS 7",
    ac.campaign_name AS "Campaigns Y",
    COALESCE(ty.tos_is_yesterday, (0)::numeric) AS "Top-of-search IS Y"
   FROM (((all_campaigns ac
     LEFT JOIN tos_30d t30 ON ((ac.campaign_name = t30.campaign_name)))
     LEFT JOIN tos_7d t7 ON ((ac.campaign_name = t7.campaign_name)))
     LEFT JOIN tos_yesterday ty ON ((ac.campaign_name = ty.campaign_name)))
  ORDER BY ac.campaign_name;


--
-- Name: view_usa_placement_data; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_usa_placement_data WITH (security_invoker='true') AS
 WITH placement_performance AS (
         SELECT rpr.campaign_name,
                CASE
                    WHEN (rpr.placement_classification = 'Top of Search on-Amazon'::text) THEN 'Placement Top'::text
                    WHEN (rpr.placement_classification = 'Other on-Amazon'::text) THEN 'Placement Rest Of Search'::text
                    WHEN (rpr.placement_classification = 'Detail Page on-Amazon'::text) THEN 'Placement Product Page'::text
                    ELSE rpr.placement_classification
                END AS placement_type,
            sum(rpr.clicks) AS clicks_30d,
            sum(rpr.spend) AS spend_30d,
            sum(rpr.purchases_30d) AS orders_30d,
            sum(rpr.sales_30d) AS sales_30d
           FROM public.raw_placement_reports rpr
          WHERE ((rpr.report_type = '30day'::text) AND (rpr.campaign_status = 'ENABLED'::text) AND (rpr.placement_classification <> 'Off Amazon'::text) AND (rpr.data_date = ( SELECT max(raw_placement_reports.data_date) AS max
                   FROM public.raw_placement_reports
                  WHERE (raw_placement_reports.report_type = '30day'::text))))
          GROUP BY rpr.campaign_name, rpr.placement_classification
        ), all_campaigns AS (
         SELECT DISTINCT placement_performance.campaign_name
           FROM placement_performance
        ), all_placements AS (
         SELECT unnest(ARRAY['Placement Top'::text, 'Placement Rest Of Search'::text, 'Placement Product Page'::text]) AS placement_type
        ), campaign_placement_matrix AS (
         SELECT ac.campaign_name,
            ap.placement_type
           FROM (all_campaigns ac
             CROSS JOIN all_placements ap)
        ), complete_data AS (
         SELECT cpm.campaign_name,
            cpm.placement_type,
            COALESCE(pp.clicks_30d, (0)::bigint) AS clicks_30d,
            COALESCE(pp.spend_30d, (0)::numeric) AS spend_30d,
            COALESCE(pp.orders_30d, (0)::bigint) AS orders_30d,
            COALESCE(pp.sales_30d, (0)::numeric) AS sales_30d
           FROM (campaign_placement_matrix cpm
             LEFT JOIN placement_performance pp ON (((cpm.campaign_name = pp.campaign_name) AND (cpm.placement_type = pp.placement_type))))
        )
 SELECT campaign_name AS "Campaign",
    orders_30d AS "Orders",
    placement_type AS "Placement Type",
    clicks_30d AS "Clicks",
    spend_30d AS "Spend",
        CASE
            WHEN (sales_30d > (0)::numeric) THEN round(((spend_30d / sales_30d) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "ACoS"
   FROM complete_data
  ORDER BY campaign_name,
        CASE placement_type
            WHEN 'Placement Top'::text THEN 1
            WHEN 'Placement Rest Of Search'::text THEN 2
            WHEN 'Placement Product Page'::text THEN 3
            ELSE 4
        END;


--
-- Name: view_weekly_placement_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.view_weekly_placement_report WITH (security_invoker='on') AS
 SELECT pp.id,
    pp.snapshot_id,
    pp.tenant_id,
    pp.week_id,
    pp.campaign_id,
    pp.campaign_name,
    pp.placement_type,
    pp.impressions_30d,
    pp.clicks_30d,
    pp.spend_30d,
    pp.sales_30d,
    pp.purchases_30d,
    pp.acos_30d,
    pp.cvr_30d,
    pp.impressions_7d,
    pp.clicks_7d,
    pp.spend_7d,
    pp.sales_7d,
    pp.purchases_7d,
    pp.acos_7d,
    pp.cvr_7d,
    pp.created_at,
    cp.top_of_search_impression_share,
    cp.yesterday_spend,
    cp.day_before_spend,
    cp.campaign_budget,
    cp.campaign_status,
    cp.portfolio_id,
    pb.placement_top_of_search,
    pb.placement_rest_of_search,
    pb.placement_product_page,
    pf.portfolio_name,
    pf.budget_amount AS portfolio_budget
   FROM (((public.weekly_placement_performance pp
     LEFT JOIN public.weekly_campaign_performance cp ON (((pp.snapshot_id = cp.snapshot_id) AND (pp.campaign_id = cp.campaign_id))))
     LEFT JOIN public.weekly_placement_bids pb ON (((pp.snapshot_id = pb.snapshot_id) AND (pp.campaign_id = pb.campaign_id))))
     LEFT JOIN public.weekly_portfolios pf ON (((pp.snapshot_id = pf.snapshot_id) AND (cp.portfolio_id = pf.portfolio_id))));


--
-- Name: raw_campaign_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_campaign_reports ALTER COLUMN id SET DEFAULT nextval('public.raw_campaign_reports_id_seq'::regclass);


--
-- Name: raw_placement_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_placement_reports ALTER COLUMN id SET DEFAULT nextval('public.raw_placement_reports_id_seq'::regclass);


--
-- Name: report_ledger id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_ledger ALTER COLUMN id SET DEFAULT nextval('public.report_ledger_id_seq'::regclass);


--
-- Name: campaign_notes campaign_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_notes
    ADD CONSTRAINT campaign_notes_pkey PRIMARY KEY (id);


--
-- Name: campaign_notes campaign_notes_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_notes
    ADD CONSTRAINT campaign_notes_unique UNIQUE (tenant_id, week_id, campaign_id, placement_type);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (tenant_id);


--
-- Name: placement_bids placement_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_bids
    ADD CONSTRAINT placement_bids_pkey PRIMARY KEY (tenant_id, campaign_id);


--
-- Name: portfolios portfolios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolios
    ADD CONSTRAINT portfolios_pkey PRIMARY KEY (tenant_id, portfolio_id);


--
-- Name: raw_campaign_reports raw_campaign_reports_campaign_id_report_type_data_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_campaign_reports
    ADD CONSTRAINT raw_campaign_reports_campaign_id_report_type_data_date_key UNIQUE (campaign_id, report_type, data_date);


--
-- Name: raw_campaign_reports raw_campaign_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_campaign_reports
    ADD CONSTRAINT raw_campaign_reports_pkey PRIMARY KEY (id);


--
-- Name: raw_campaign_reports raw_campaign_reports_unique_record; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_campaign_reports
    ADD CONSTRAINT raw_campaign_reports_unique_record UNIQUE (tenant_id, campaign_id, report_type, data_date);


--
-- Name: raw_placement_reports raw_placement_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_placement_reports
    ADD CONSTRAINT raw_placement_reports_pkey PRIMARY KEY (id);


--
-- Name: raw_placement_reports raw_placement_reports_unique_placement_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_placement_reports
    ADD CONSTRAINT raw_placement_reports_unique_placement_type UNIQUE (tenant_id, campaign_id, placement_type, report_type, data_date);


--
-- Name: raw_placement_reports raw_placement_reports_unique_record; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_placement_reports
    ADD CONSTRAINT raw_placement_reports_unique_record UNIQUE (tenant_id, campaign_id, placement_type, report_type, data_date);


--
-- Name: report_ledger report_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_ledger
    ADD CONSTRAINT report_ledger_pkey PRIMARY KEY (report_id, tenant_id);


--
-- Name: staging_campaign_reports staging_campaign_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_campaign_reports
    ADD CONSTRAINT staging_campaign_reports_pkey PRIMARY KEY (id);


--
-- Name: staging_placement_bids staging_placement_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_placement_bids
    ADD CONSTRAINT staging_placement_bids_pkey PRIMARY KEY (id);


--
-- Name: staging_placement_bids staging_placement_bids_tenant_id_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_placement_bids
    ADD CONSTRAINT staging_placement_bids_tenant_id_campaign_id_key UNIQUE (tenant_id, campaign_id);


--
-- Name: staging_placement_reports staging_placement_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_placement_reports
    ADD CONSTRAINT staging_placement_reports_pkey PRIMARY KEY (id);


--
-- Name: staging_portfolios staging_portfolios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_portfolios
    ADD CONSTRAINT staging_portfolios_pkey PRIMARY KEY (id);


--
-- Name: staging_portfolios staging_portfolios_tenant_id_portfolio_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_portfolios
    ADD CONSTRAINT staging_portfolios_tenant_id_portfolio_id_key UNIQUE (tenant_id, portfolio_id);


--
-- Name: weekly_campaign_performance weekly_campaign_perf_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_campaign_performance
    ADD CONSTRAINT weekly_campaign_perf_unique UNIQUE (tenant_id, week_id, campaign_id);


--
-- Name: weekly_campaign_performance weekly_campaign_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_campaign_performance
    ADD CONSTRAINT weekly_campaign_performance_pkey PRIMARY KEY (id);


--
-- Name: weekly_placement_bids weekly_placement_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_placement_bids
    ADD CONSTRAINT weekly_placement_bids_pkey PRIMARY KEY (id);


--
-- Name: weekly_placement_bids weekly_placement_bids_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_placement_bids
    ADD CONSTRAINT weekly_placement_bids_unique UNIQUE (tenant_id, week_id, campaign_id);


--
-- Name: weekly_placement_performance weekly_placement_perf_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_placement_performance
    ADD CONSTRAINT weekly_placement_perf_unique UNIQUE (tenant_id, week_id, campaign_id, placement_type);


--
-- Name: weekly_placement_performance weekly_placement_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_placement_performance
    ADD CONSTRAINT weekly_placement_performance_pkey PRIMARY KEY (id);


--
-- Name: weekly_portfolios weekly_portfolios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_portfolios
    ADD CONSTRAINT weekly_portfolios_pkey PRIMARY KEY (id);


--
-- Name: weekly_portfolios weekly_portfolios_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_portfolios
    ADD CONSTRAINT weekly_portfolios_unique UNIQUE (tenant_id, week_id, portfolio_id);


--
-- Name: weekly_snapshots weekly_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_snapshots
    ADD CONSTRAINT weekly_snapshots_pkey PRIMARY KEY (id);


--
-- Name: weekly_snapshots weekly_snapshots_tenant_week_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_snapshots
    ADD CONSTRAINT weekly_snapshots_tenant_week_unique UNIQUE (tenant_id, week_id);


--
-- Name: idx_campaign_reports_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_reports_campaign_id ON public.raw_campaign_reports USING btree (campaign_id);


--
-- Name: idx_campaign_reports_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_reports_name ON public.raw_campaign_reports USING btree (campaign_name);


--
-- Name: idx_campaign_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_reports_status ON public.raw_campaign_reports USING btree (campaign_status);


--
-- Name: idx_campaign_reports_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_reports_type_date ON public.raw_campaign_reports USING btree (report_type, data_date);


--
-- Name: idx_campaign_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_tenant_date ON public.raw_campaign_reports USING btree (tenant_id, data_date);


--
-- Name: idx_credentials_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_stripe_customer_id ON public.credentials USING btree (stripe_customer_id);


--
-- Name: idx_credentials_subscription_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credentials_subscription_status ON public.credentials USING btree (subscription_status);


--
-- Name: idx_placement_bids_portfolio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_bids_portfolio ON public.placement_bids USING btree (portfolio_id);


--
-- Name: idx_placement_bids_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_bids_status ON public.placement_bids USING btree (campaign_status);


--
-- Name: idx_placement_reports_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_reports_campaign_id ON public.raw_placement_reports USING btree (campaign_id);


--
-- Name: idx_placement_reports_placement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_reports_placement ON public.raw_placement_reports USING btree (placement_classification);


--
-- Name: idx_placement_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_reports_status ON public.raw_placement_reports USING btree (campaign_status);


--
-- Name: idx_placement_reports_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_reports_type_date ON public.raw_placement_reports USING btree (report_type, data_date);


--
-- Name: idx_placement_tenant_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_placement_tenant_date ON public.raw_placement_reports USING btree (tenant_id, data_date);


--
-- Name: idx_report_ledger_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_ledger_status ON public.report_ledger USING btree (status);


--
-- Name: idx_report_ledger_week_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_ledger_week_id ON public.report_ledger USING btree (tenant_id, week_id);


--
-- Name: idx_weekly_campaign_perf_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_campaign_perf_campaign ON public.weekly_campaign_performance USING btree (campaign_id);


--
-- Name: idx_weekly_campaign_perf_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_campaign_perf_snapshot ON public.weekly_campaign_performance USING btree (snapshot_id);


--
-- Name: idx_weekly_campaign_perf_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_campaign_perf_tenant ON public.weekly_campaign_performance USING btree (tenant_id);


--
-- Name: idx_weekly_campaign_perf_tenant_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_campaign_perf_tenant_week ON public.weekly_campaign_performance USING btree (tenant_id, week_id);


--
-- Name: idx_weekly_placement_bids_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_bids_campaign ON public.weekly_placement_bids USING btree (campaign_id);


--
-- Name: idx_weekly_placement_bids_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_bids_snapshot ON public.weekly_placement_bids USING btree (snapshot_id);


--
-- Name: idx_weekly_placement_bids_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_bids_tenant ON public.weekly_placement_bids USING btree (tenant_id);


--
-- Name: idx_weekly_placement_bids_tenant_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_bids_tenant_week ON public.weekly_placement_bids USING btree (tenant_id, week_id);


--
-- Name: idx_weekly_placement_perf_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_perf_campaign ON public.weekly_placement_performance USING btree (campaign_id);


--
-- Name: idx_weekly_placement_perf_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_perf_snapshot ON public.weekly_placement_performance USING btree (snapshot_id);


--
-- Name: idx_weekly_placement_perf_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_perf_tenant ON public.weekly_placement_performance USING btree (tenant_id);


--
-- Name: idx_weekly_placement_perf_tenant_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_perf_tenant_week ON public.weekly_placement_performance USING btree (tenant_id, week_id);


--
-- Name: idx_weekly_placement_perf_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_placement_perf_type ON public.weekly_placement_performance USING btree (placement_type);


--
-- Name: idx_weekly_portfolios_portfolio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_portfolios_portfolio ON public.weekly_portfolios USING btree (portfolio_id);


--
-- Name: idx_weekly_portfolios_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_portfolios_snapshot ON public.weekly_portfolios USING btree (snapshot_id);


--
-- Name: idx_weekly_portfolios_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_portfolios_tenant ON public.weekly_portfolios USING btree (tenant_id);


--
-- Name: idx_weekly_portfolios_tenant_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_portfolios_tenant_week ON public.weekly_portfolios USING btree (tenant_id, week_id);


--
-- Name: idx_weekly_snapshots_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_snapshots_status ON public.weekly_snapshots USING btree (status);


--
-- Name: idx_weekly_snapshots_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_snapshots_tenant ON public.weekly_snapshots USING btree (tenant_id);


--
-- Name: idx_weekly_snapshots_tenant_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_snapshots_tenant_week ON public.weekly_snapshots USING btree (tenant_id, week_id);


--
-- Name: staging_campaign_reports_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_campaign_reports_campaign_id_idx ON public.staging_campaign_reports USING btree (campaign_id);


--
-- Name: staging_campaign_reports_campaign_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_campaign_reports_campaign_name_idx ON public.staging_campaign_reports USING btree (campaign_name);


--
-- Name: staging_campaign_reports_campaign_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_campaign_reports_campaign_status_idx ON public.staging_campaign_reports USING btree (campaign_status);


--
-- Name: staging_campaign_reports_report_type_data_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_campaign_reports_report_type_data_date_idx ON public.staging_campaign_reports USING btree (report_type, data_date);


--
-- Name: staging_campaign_reports_tenant_id_data_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_campaign_reports_tenant_id_data_date_idx ON public.staging_campaign_reports USING btree (tenant_id, data_date);


--
-- Name: staging_placement_reports_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_placement_reports_campaign_id_idx ON public.staging_placement_reports USING btree (campaign_id);


--
-- Name: staging_placement_reports_campaign_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_placement_reports_campaign_status_idx ON public.staging_placement_reports USING btree (campaign_status);


--
-- Name: staging_placement_reports_report_type_data_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_placement_reports_report_type_data_date_idx ON public.staging_placement_reports USING btree (report_type, data_date);


--
-- Name: staging_placement_reports_tenant_id_data_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staging_placement_reports_tenant_id_data_date_idx ON public.staging_placement_reports USING btree (tenant_id, data_date);


--
-- Name: weekly_snapshots before_weekly_snapshot_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER before_weekly_snapshot_insert BEFORE INSERT ON public.weekly_snapshots FOR EACH ROW EXECUTE FUNCTION public.clear_existing_weekly_data();


--
-- Name: raw_campaign_reports update_campaign_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_campaign_reports_updated_at BEFORE UPDATE ON public.raw_campaign_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: placement_bids update_placement_bids_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_placement_bids_updated_at BEFORE UPDATE ON public.placement_bids FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: raw_placement_reports update_placement_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_placement_reports_updated_at BEFORE UPDATE ON public.raw_placement_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: portfolios update_portfolios_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: credentials credentials_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: staging_placement_bids fk_bids_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_placement_bids
    ADD CONSTRAINT fk_bids_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: staging_placement_bids fk_bids_to_credentials; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_placement_bids
    ADD CONSTRAINT fk_bids_to_credentials FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: raw_campaign_reports fk_campaign_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_campaign_reports
    ADD CONSTRAINT fk_campaign_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: placement_bids fk_placement_reports_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_bids
    ADD CONSTRAINT fk_placement_reports_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: raw_placement_reports fk_placement_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_placement_reports
    ADD CONSTRAINT fk_placement_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: raw_campaign_reports fk_raw_campaign_reports_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_campaign_reports
    ADD CONSTRAINT fk_raw_campaign_reports_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: raw_placement_reports fk_raw_placement_reports_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_placement_reports
    ADD CONSTRAINT fk_raw_placement_reports_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: staging_campaign_reports fk_staging_campaign_reports_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_campaign_reports
    ADD CONSTRAINT fk_staging_campaign_reports_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: staging_placement_reports fk_staging_placement_reports_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_placement_reports
    ADD CONSTRAINT fk_staging_placement_reports_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: staging_portfolios fk_staging_portfolios_tenant; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staging_portfolios
    ADD CONSTRAINT fk_staging_portfolios_tenant FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: portfolios fk_tenant_identity; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolios
    ADD CONSTRAINT fk_tenant_identity FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON DELETE CASCADE;


--
-- Name: placement_bids placement_bids_portfolio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.placement_bids
    ADD CONSTRAINT placement_bids_portfolio_id_fkey FOREIGN KEY (tenant_id, portfolio_id) REFERENCES public.portfolios(tenant_id, portfolio_id);


--
-- Name: report_ledger report_ledger_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_ledger
    ADD CONSTRAINT report_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.credentials(tenant_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: weekly_campaign_performance weekly_campaign_performance_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_campaign_performance
    ADD CONSTRAINT weekly_campaign_performance_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.weekly_snapshots(id) ON DELETE CASCADE;


--
-- Name: weekly_placement_bids weekly_placement_bids_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_placement_bids
    ADD CONSTRAINT weekly_placement_bids_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.weekly_snapshots(id) ON DELETE CASCADE;


--
-- Name: weekly_placement_performance weekly_placement_performance_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_placement_performance
    ADD CONSTRAINT weekly_placement_performance_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.weekly_snapshots(id) ON DELETE CASCADE;


--
-- Name: weekly_portfolios weekly_portfolios_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_portfolios
    ADD CONSTRAINT weekly_portfolios_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.weekly_snapshots(id) ON DELETE CASCADE;


--
-- Name: weekly_campaign_performance Service role can manage all weekly campaign performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all weekly campaign performance" ON public.weekly_campaign_performance USING ((auth.role() = 'service_role'::text));


--
-- Name: weekly_placement_bids Service role can manage all weekly placement bids; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all weekly placement bids" ON public.weekly_placement_bids USING ((auth.role() = 'service_role'::text));


--
-- Name: weekly_placement_performance Service role can manage all weekly placement performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all weekly placement performance" ON public.weekly_placement_performance USING ((auth.role() = 'service_role'::text));


--
-- Name: weekly_portfolios Service role can manage all weekly portfolios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all weekly portfolios" ON public.weekly_portfolios USING ((auth.role() = 'service_role'::text));


--
-- Name: weekly_snapshots Service role can manage all weekly snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all weekly snapshots" ON public.weekly_snapshots USING ((auth.role() = 'service_role'::text));


--
-- Name: placement_bids Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.placement_bids TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: portfolios Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.portfolios TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: raw_campaign_reports Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.raw_campaign_reports TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: raw_placement_reports Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.raw_placement_reports TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: report_ledger Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.report_ledger TO authenticated USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text)) WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: campaign_notes Users can manage their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own notes" ON public.campaign_notes USING ((tenant_id = auth.uid())) WITH CHECK ((tenant_id = auth.uid()));


--
-- Name: placement_bids Users can only see their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can only see their own data" ON public.placement_bids USING ((tenant_id = auth.uid()));


--
-- Name: portfolios Users can only see their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can only see their own data" ON public.portfolios USING ((tenant_id = auth.uid()));


--
-- Name: raw_campaign_reports Users can see own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see own data" ON public.raw_campaign_reports FOR SELECT USING ((tenant_id = auth.uid()));


--
-- Name: raw_placement_reports Users can see own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see own data" ON public.raw_placement_reports FOR SELECT USING ((tenant_id = auth.uid()));


--
-- Name: credentials Users can update own credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own credentials" ON public.credentials FOR UPDATE TO authenticated USING ((auth.uid() = tenant_id)) WITH CHECK ((auth.uid() = tenant_id));


--
-- Name: credentials Users can view own credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own credentials" ON public.credentials FOR SELECT TO authenticated USING ((auth.uid() = tenant_id));


--
-- Name: credentials Users can view their own credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own credentials" ON public.credentials FOR SELECT USING ((auth.uid() = tenant_id));


--
-- Name: weekly_campaign_performance Users can view their own weekly campaign performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own weekly campaign performance" ON public.weekly_campaign_performance FOR SELECT USING ((tenant_id = auth.uid()));


--
-- Name: weekly_placement_bids Users can view their own weekly placement bids; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own weekly placement bids" ON public.weekly_placement_bids FOR SELECT USING ((tenant_id = auth.uid()));


--
-- Name: weekly_placement_performance Users can view their own weekly placement performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own weekly placement performance" ON public.weekly_placement_performance FOR SELECT USING ((tenant_id = auth.uid()));


--
-- Name: weekly_portfolios Users can view their own weekly portfolios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own weekly portfolios" ON public.weekly_portfolios FOR SELECT USING ((tenant_id = auth.uid()));


--
-- Name: weekly_snapshots Users can view their own weekly snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own weekly snapshots" ON public.weekly_snapshots FOR SELECT USING ((tenant_id = auth.uid()));


--
-- Name: campaign_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: placement_bids; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.placement_bids ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_campaign_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.raw_campaign_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: raw_placement_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.raw_placement_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: report_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_campaign_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staging_campaign_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_placement_bids; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staging_placement_bids ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_placement_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staging_placement_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: staging_portfolios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staging_portfolios ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_campaign_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_campaign_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_placement_bids; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_placement_bids ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_placement_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_placement_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_portfolios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_portfolios ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict jCKXjgmX01pKry4EuQwrceXupfT1QXlFK6nOEGd9zoScphfszhzD1YDutwaYZvN

