


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."cleanup_old_report_ledger"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."cleanup_old_report_ledger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_report_ledger"() IS 'Deletes report_ledger records older than 3 months. Runs automatically via pg_cron.';



CREATE OR REPLACE FUNCTION "public"."delete_tenant_secrets"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."delete_tenant_secrets"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_tenant_secrets"("p_tenant_id" "uuid") IS 'Securely deletes all vault secrets and credentials for a tenant during account deletion';



CREATE OR REPLACE FUNCTION "public"."get_current_week_id"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN TO_CHAR(CURRENT_DATE, 'IYYY-"W"IW');
END;
$$;


ALTER FUNCTION "public"."get_current_week_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_token"("p_vault_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT decrypted_secret 
    FROM vault.decrypted_secrets 
    WHERE id = p_vault_id
  );
END;
$$;


ALTER FUNCTION "public"."get_tenant_token"("p_vault_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_week_metadata"("input_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("week_id" "text", "year" integer, "week_number" integer, "start_date" "date", "end_date" "date")
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."get_week_metadata"("input_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_placement_type"("placement_classification" "text") RETURNS "text"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."normalize_placement_type"("placement_classification" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_amazon_credentials"("p_client_id" "text", "p_client_secret" "text", "p_refresh_token" "text", "p_amazon_profile_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."store_amazon_credentials"("p_client_id" "text", "p_client_secret" "text", "p_refresh_token" "text", "p_amazon_profile_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."store_amazon_credentials"("p_client_id" "text", "p_client_secret" "text", "p_refresh_token" "text", "p_amazon_profile_id" "text") IS 'Allows authenticated users to securely store their Amazon Ads API credentials in Supabase Vault';



CREATE OR REPLACE FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text", "p_secret_type" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text", "p_secret_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_staging_to_raw"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."sync_staging_to_raw"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."truncate_performance_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    TRUNCATE TABLE public.raw_campaign_reports;
    TRUNCATE TABLE public.raw_placement_reports;
    TRUNCATE TABLE public.placement_bids;
    TRUNCATE TABLE public.portfolios;
END;
$$;


ALTER FUNCTION "public"."truncate_performance_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."credentials" (
    "tenant_id" "uuid" NOT NULL,
    "amazon_profile_id" "text",
    "vault_id_refresh_token" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "marketplace_id" "text" DEFAULT 'ATVPDKIKX0DER'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vault_id_client_id" "uuid",
    "vault_id_client_secret" "uuid",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_status" "text" DEFAULT 'trialing'::"text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "trial_ends_at" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "report_day" "text" DEFAULT 'monday'::"text",
    "report_hour" integer DEFAULT 3,
    CONSTRAINT "credentials_report_day_check" CHECK (("report_day" = ANY (ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"]))),
    CONSTRAINT "credentials_report_hour_check" CHECK ((("report_hour" >= 0) AND ("report_hour" <= 23))),
    CONSTRAINT "credentials_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['trialing'::"text", 'active'::"text", 'past_due'::"text", 'canceled'::"text", 'incomplete'::"text", 'incomplete_expired'::"text", 'unpaid'::"text"]))),
    CONSTRAINT "credentials_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."credentials" OWNER TO "postgres";


COMMENT ON COLUMN "public"."credentials"."stripe_customer_id" IS 'Stripe customer ID for billing';



COMMENT ON COLUMN "public"."credentials"."stripe_subscription_id" IS 'Stripe subscription ID for active subscription';



COMMENT ON COLUMN "public"."credentials"."subscription_status" IS 'Current subscription status from Stripe';



COMMENT ON COLUMN "public"."credentials"."subscription_tier" IS 'Subscription tier: free, pro, enterprise';



COMMENT ON COLUMN "public"."credentials"."trial_ends_at" IS 'When the trial period ends';



COMMENT ON COLUMN "public"."credentials"."current_period_end" IS 'When the current billing period ends';



CREATE TABLE IF NOT EXISTS "public"."placement_bids" (
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text" NOT NULL,
    "campaign_status" "text",
    "campaign_budget" numeric(10,2),
    "portfolio_id" "text",
    "placement_top_of_search" integer DEFAULT 0,
    "placement_rest_of_search" integer DEFAULT 0,
    "placement_product_page" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."placement_bids" OWNER TO "postgres";


COMMENT ON TABLE "public"."placement_bids" IS 'Current placement bid adjustments for active campaigns';



COMMENT ON COLUMN "public"."placement_bids"."placement_top_of_search" IS 'Bid adjustment percentage for top of search placement';



CREATE TABLE IF NOT EXISTS "public"."portfolios" (
    "portfolio_id" "text" NOT NULL,
    "portfolio_name" "text" NOT NULL,
    "portfolio_state" "text" DEFAULT 'ENABLED'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "budget_amount" numeric DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text"
);


ALTER TABLE "public"."portfolios" OWNER TO "postgres";


COMMENT ON TABLE "public"."portfolios" IS 'Portfolio information and names for campaign organization';



CREATE TABLE IF NOT EXISTS "public"."raw_campaign_reports" (
    "id" integer NOT NULL,
    "report_id" "text",
    "report_name" "text",
    "report_type" "text",
    "data_date" "date",
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "campaign_status" "text",
    "campaign_budget_amount" numeric(10,2),
    "portfolio_id" "text",
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "spend" numeric(10,2) DEFAULT 0,
    "purchases_1d" integer DEFAULT 0,
    "sales_1d" numeric(10,2) DEFAULT 0,
    "purchases_7d" integer DEFAULT 0,
    "sales_7d" numeric(10,2) DEFAULT 0,
    "purchases_14d" integer DEFAULT 0,
    "sales_14d" numeric(10,2) DEFAULT 0,
    "purchases_30d" integer DEFAULT 0,
    "sales_30d" numeric(10,2) DEFAULT 0,
    "top_of_search_impression_share" numeric(5,2) DEFAULT 0,
    "ctr" numeric(5,4) DEFAULT 0,
    "cpc" numeric(10,2) DEFAULT 0,
    "acos_1d" numeric(5,2) DEFAULT 0,
    "acos_7d" numeric(5,2) DEFAULT 0,
    "acos_14d" numeric(5,2) DEFAULT 0,
    "acos_30d" numeric(5,2) DEFAULT 0,
    "cvr_1d" numeric(5,4) DEFAULT 0,
    "cvr_7d" numeric(5,4) DEFAULT 0,
    "cvr_14d" numeric(5,4) DEFAULT 0,
    "cvr_30d" numeric(5,4) DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "campaign_budget_type" "text",
    "campaign_budget_currency_code" "text"
);


ALTER TABLE "public"."raw_campaign_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."raw_campaign_reports" IS 'Raw campaign performance data from Amazon API reports';



COMMENT ON COLUMN "public"."raw_campaign_reports"."report_type" IS 'Time period: 30day, 7day, yesterday, dayBefore';



CREATE SEQUENCE IF NOT EXISTS "public"."raw_campaign_reports_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."raw_campaign_reports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."raw_campaign_reports_id_seq" OWNED BY "public"."raw_campaign_reports"."id";



CREATE TABLE IF NOT EXISTS "public"."raw_placement_reports" (
    "id" integer NOT NULL,
    "report_name" "text",
    "report_type" "text",
    "data_date" "date",
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "campaign_status" "text",
    "placement_classification" "text",
    "placement_type" "text",
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "spend" numeric(10,2) DEFAULT 0,
    "purchases_7d" integer DEFAULT 0,
    "sales_7d" numeric(10,2) DEFAULT 0,
    "purchases_14d" integer DEFAULT 0,
    "sales_14d" numeric(10,2) DEFAULT 0,
    "purchases_30d" integer DEFAULT 0,
    "sales_30d" numeric(10,2) DEFAULT 0,
    "ctr" numeric(5,4) DEFAULT 0,
    "cpc" numeric(10,2) DEFAULT 0,
    "acos_7d" numeric(5,2) DEFAULT 0,
    "acos_14d" numeric(5,2) DEFAULT 0,
    "acos_30d" numeric(5,2) DEFAULT 0,
    "cvr_7d" numeric(5,4) DEFAULT 0,
    "cvr_14d" numeric(5,4) DEFAULT 0,
    "cvr_30d" numeric(5,4) DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "report_id" "text"
);


ALTER TABLE "public"."raw_placement_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."raw_placement_reports" IS 'Raw placement performance data from Amazon API reports';



COMMENT ON COLUMN "public"."raw_placement_reports"."placement_classification" IS 'Raw placement name from Amazon API';



COMMENT ON COLUMN "public"."raw_placement_reports"."placement_type" IS 'Normalized placement type for consistent reporting';



CREATE SEQUENCE IF NOT EXISTS "public"."raw_placement_reports_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."raw_placement_reports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."raw_placement_reports_id_seq" OWNED BY "public"."raw_placement_reports"."id";



CREATE TABLE IF NOT EXISTS "public"."report_ledger" (
    "id" integer NOT NULL,
    "report_id" "text" NOT NULL,
    "name" "text",
    "status" "text" NOT NULL,
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone,
    "url" "text",
    "url_expires_at" timestamp without time zone,
    "report_type" "text",
    "processed" boolean DEFAULT false,
    "created_timestamp" timestamp without time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."report_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."report_ledger" IS 'Tracks all Amazon API reports requested and their status';



CREATE SEQUENCE IF NOT EXISTS "public"."report_ledger_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."report_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."report_ledger_id_seq" OWNED BY "public"."report_ledger"."id";



CREATE TABLE IF NOT EXISTS "public"."staging_campaign_reports" (
    "id" integer DEFAULT "nextval"('"public"."raw_campaign_reports_id_seq"'::"regclass") NOT NULL,
    "report_id" "text",
    "report_name" "text",
    "report_type" "text",
    "data_date" "date",
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "campaign_status" "text",
    "campaign_budget_amount" numeric(10,2),
    "portfolio_id" "text",
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "spend" numeric(10,2) DEFAULT 0,
    "purchases_1d" integer DEFAULT 0,
    "sales_1d" numeric(10,2) DEFAULT 0,
    "purchases_7d" integer DEFAULT 0,
    "sales_7d" numeric(10,2) DEFAULT 0,
    "purchases_14d" integer DEFAULT 0,
    "sales_14d" numeric(10,2) DEFAULT 0,
    "purchases_30d" integer DEFAULT 0,
    "sales_30d" numeric(10,2) DEFAULT 0,
    "top_of_search_impression_share" numeric(5,2) DEFAULT 0,
    "ctr" numeric(5,4) DEFAULT 0,
    "cpc" numeric(10,2) DEFAULT 0,
    "acos_1d" numeric(5,2) DEFAULT 0,
    "acos_7d" numeric(5,2) DEFAULT 0,
    "acos_14d" numeric(5,2) DEFAULT 0,
    "acos_30d" numeric(5,2) DEFAULT 0,
    "cvr_1d" numeric(5,4) DEFAULT 0,
    "cvr_7d" numeric(5,4) DEFAULT 0,
    "cvr_14d" numeric(5,4) DEFAULT 0,
    "cvr_30d" numeric(5,4) DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "campaign_budget_type" "text",
    "campaign_budget_currency_code" "text"
);


ALTER TABLE "public"."staging_campaign_reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staging_campaign_reports"."report_type" IS 'Time period: 30day, 7day, yesterday, dayBefore';



CREATE TABLE IF NOT EXISTS "public"."staging_placement_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "campaign_status" "text",
    "campaign_budget" numeric,
    "portfolio_id" "text",
    "placement_product_page" integer DEFAULT 0,
    "placement_rest_of_search" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "placement_top_of_search" integer DEFAULT 0
);


ALTER TABLE "public"."staging_placement_bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_placement_reports" (
    "id" integer DEFAULT "nextval"('"public"."raw_placement_reports_id_seq"'::"regclass") NOT NULL,
    "report_id" "text",
    "report_name" "text",
    "report_type" "text",
    "data_date" "date",
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "campaign_status" "text",
    "placement_type" "text",
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "spend" numeric(10,2) DEFAULT 0,
    "purchases_7d" integer DEFAULT 0,
    "sales_7d" numeric(10,2) DEFAULT 0,
    "purchases_14d" integer DEFAULT 0,
    "sales_14d" numeric(10,2) DEFAULT 0,
    "purchases_30d" integer DEFAULT 0,
    "sales_30d" numeric(10,2) DEFAULT 0,
    "ctr" numeric(5,4) DEFAULT 0,
    "cpc" numeric(10,2) DEFAULT 0,
    "acos_7d" numeric(5,2) DEFAULT 0,
    "acos_14d" numeric(5,2) DEFAULT 0,
    "acos_30d" numeric(5,2) DEFAULT 0,
    "cvr_7d" numeric(5,4) DEFAULT 0,
    "cvr_14d" numeric(5,4) DEFAULT 0,
    "cvr_30d" numeric(5,4) DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."staging_placement_reports" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staging_placement_reports"."placement_type" IS 'Normalized placement type for consistent reporting';



CREATE TABLE IF NOT EXISTS "public"."staging_portfolios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "portfolio_id" "text" NOT NULL,
    "portfolio_name" "text",
    "budget_amount" numeric,
    "currency" "text",
    "portfolio_state" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staging_portfolios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_campaign_day_before" WITH ("security_invoker"='true') AS
 SELECT "campaign_id" AS "Campaign Id",
    "report_name" AS "Report Name",
    "campaign_name" AS "Campaign Name",
    "campaign_budget_amount" AS "Budget",
    "report_type" AS "Report Type",
    "spend" AS "Spend",
    "campaign_status" AS "Campaign Status"
   FROM "public"."raw_campaign_reports" "rcr"
  WHERE (("report_type" = 'dayBefore'::"text") AND ("data_date" = ( SELECT "max"("raw_campaign_reports"."data_date") AS "max"
           FROM "public"."raw_campaign_reports"
          WHERE ("raw_campaign_reports"."report_type" = 'dayBefore'::"text"))))
  ORDER BY "campaign_name";


ALTER VIEW "public"."view_campaign_day_before" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_campaign_summary" WITH ("security_invoker"='true') AS
 SELECT "campaign_name",
    "campaign_status",
    "count"(DISTINCT "report_type") AS "report_types_count",
    "max"("data_date") AS "latest_data_date",
    "sum"(
        CASE
            WHEN ("report_type" = '30day'::"text") THEN "spend"
            ELSE (0)::numeric
        END) AS "spend_30d",
    "sum"(
        CASE
            WHEN ("report_type" = '7day'::"text") THEN "spend"
            ELSE (0)::numeric
        END) AS "spend_7d",
    "sum"(
        CASE
            WHEN ("report_type" = 'yesterday'::"text") THEN "spend"
            ELSE (0)::numeric
        END) AS "spend_yesterday"
   FROM "public"."raw_campaign_reports"
  GROUP BY "campaign_name", "campaign_status"
  ORDER BY "campaign_name";


ALTER VIEW "public"."view_campaign_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_campaign_yesterday" WITH ("security_invoker"='true') AS
 SELECT "tenant_id",
    "campaign_id" AS "Campaign Id",
    "report_name" AS "Report Name",
    "campaign_name" AS "Campaign Name",
    "campaign_budget_amount" AS "Budget",
    "spend" AS "Spend",
    "top_of_search_impression_share" AS "TOS Impression Share",
    "report_type" AS "Report Type",
    "campaign_status" AS "Campaign Status"
   FROM "public"."raw_campaign_reports"
  WHERE (("report_type" = 'yesterday'::"text") AND ("data_date" = ( SELECT "max"("raw_campaign_reports_1"."data_date") AS "max"
           FROM "public"."raw_campaign_reports" "raw_campaign_reports_1"
          WHERE ("raw_campaign_reports_1"."report_type" = 'yesterday'::"text"))))
  ORDER BY "campaign_name";


ALTER VIEW "public"."view_campaign_yesterday" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_current_placement_bids" WITH ("security_invoker"='true') AS
 SELECT "campaign_id" AS "Campaign Id",
    "campaign_name" AS "Campaign Name",
    "campaign_status" AS "Campaign Status",
    "campaign_budget" AS "Campaign Budget",
    "placement_top_of_search" AS "Placement TOS",
    "placement_rest_of_search" AS "Placement ROS",
    "placement_product_page" AS "Placement PP",
    "portfolio_id" AS "Portfolio Id"
   FROM "public"."placement_bids" "pb"
  ORDER BY "campaign_name";


ALTER VIEW "public"."view_current_placement_bids" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_data_update_7days" WITH ("security_invoker"='true') AS
 SELECT "campaign_name" AS "Campaign 7",
        CASE
            WHEN ("placement_classification" = 'Top of Search on-Amazon'::"text") THEN 'Placement Top'::"text"
            WHEN ("placement_classification" = 'Other on-Amazon'::"text") THEN 'Placement Rest Of Search'::"text"
            WHEN ("placement_classification" = 'Detail Page on-Amazon'::"text") THEN 'Placement Product Page'::"text"
            ELSE "placement_classification"
        END AS "Placement Type 7",
    "sum"("clicks") AS "Clicks 7",
    "sum"("spend") AS "Spend 7",
    "sum"("purchases_7d") AS "Orders 7",
        CASE
            WHEN ("sum"("sales_7d") > (0)::numeric) THEN "round"((("sum"("spend") / "sum"("sales_7d")) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "ACoS 7"
   FROM "public"."raw_placement_reports" "rpr"
  WHERE (("report_type" = '7day'::"text") AND ("campaign_status" = 'ENABLED'::"text") AND ("placement_classification" <> 'Off Amazon'::"text") AND ("data_date" = ( SELECT "max"("raw_placement_reports"."data_date") AS "max"
           FROM "public"."raw_placement_reports"
          WHERE ("raw_placement_reports"."report_type" = '7day'::"text"))))
  GROUP BY "campaign_name", "placement_classification"
  ORDER BY "campaign_name", "placement_classification";


ALTER VIEW "public"."view_data_update_7days" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_data_update_day_before" WITH ("security_invoker"='true') AS
 SELECT "rcr"."campaign_name" AS "Campaigns DB",
    "p"."portfolio_name" AS "Portfolio DB",
    "rcr"."campaign_budget_amount" AS "Budget(USD) DB",
    "rcr"."spend" AS "Spend(USD) DB"
   FROM (("public"."raw_campaign_reports" "rcr"
     LEFT JOIN "public"."placement_bids" "pb" ON (("rcr"."campaign_id" = "pb"."campaign_id")))
     LEFT JOIN "public"."portfolios" "p" ON (("pb"."portfolio_id" = "p"."portfolio_id")))
  WHERE (("rcr"."report_type" = 'dayBefore'::"text") AND ("rcr"."data_date" = ( SELECT "max"("raw_campaign_reports"."data_date") AS "max"
           FROM "public"."raw_campaign_reports"
          WHERE ("raw_campaign_reports"."report_type" = 'dayBefore'::"text"))))
  ORDER BY "rcr"."campaign_name";


ALTER VIEW "public"."view_data_update_day_before" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_data_update_yesterday" WITH ("security_invoker"='true') AS
 SELECT "campaign_name" AS "Campaigns Y",
    "spend" AS "Spend(USD) Y"
   FROM "public"."raw_campaign_reports" "rcr"
  WHERE (("report_type" = 'yesterday'::"text") AND ("data_date" = ( SELECT "max"("raw_campaign_reports"."data_date") AS "max"
           FROM "public"."raw_campaign_reports"
          WHERE ("raw_campaign_reports"."report_type" = 'yesterday'::"text"))))
  ORDER BY "campaign_name";


ALTER VIEW "public"."view_data_update_yesterday" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_latest_data_dates" WITH ("security_invoker"='true') AS
 SELECT "raw_campaign_reports"."report_type",
    "max"("raw_campaign_reports"."data_date") AS "latest_date",
    "count"(*) AS "record_count"
   FROM "public"."raw_campaign_reports"
  GROUP BY "raw_campaign_reports"."report_type"
UNION ALL
 SELECT ('placement_'::"text" || "raw_placement_reports"."report_type") AS "report_type",
    "max"("raw_placement_reports"."data_date") AS "latest_date",
    "count"(*) AS "record_count"
   FROM "public"."raw_placement_reports"
  GROUP BY "raw_placement_reports"."report_type"
  ORDER BY 1;


ALTER VIEW "public"."view_latest_data_dates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_placement_30_days" WITH ("security_invoker"='true') AS
 SELECT "campaign_id" AS "Campaign Id",
    "campaign_status" AS "Campaign Status",
    "sum"("impressions") AS "Impressions",
    "sum"("clicks") AS "Clicks",
    "sum"("spend") AS "Spend",
    "sum"("purchases_30d") AS "Orders",
    "report_type" AS "Report Type",
    "placement_classification" AS "Placement Classification",
    "campaign_name" AS "Campaign Name",
    "sum"("sales_30d") AS "Sales"
   FROM "public"."raw_placement_reports" "rpr"
  WHERE (("report_type" = '30day'::"text") AND ("data_date" = ( SELECT "max"("raw_placement_reports"."data_date") AS "max"
           FROM "public"."raw_placement_reports"
          WHERE ("raw_placement_reports"."report_type" = '30day'::"text"))))
  GROUP BY "campaign_id", "campaign_name", "campaign_status", "placement_classification", "report_type"
  ORDER BY "campaign_name", "placement_classification";


ALTER VIEW "public"."view_placement_30_days" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_placement_7_days" WITH ("security_invoker"='true') AS
 SELECT "campaign_id" AS "Campaign Id",
    "campaign_name" AS "Campaign Name",
    "sum"("clicks") AS "Clicks",
    "sum"("spend") AS "Spend",
    "sum"("sales_7d") AS "Sales",
    "sum"("purchases_7d") AS "Orders",
    "report_type" AS "Report Type",
    "campaign_status" AS "Campaign Status",
    "placement_classification" AS "Placement Classification"
   FROM "public"."raw_placement_reports" "rpr"
  WHERE (("report_type" = '7day'::"text") AND ("data_date" = ( SELECT "max"("raw_placement_reports"."data_date") AS "max"
           FROM "public"."raw_placement_reports"
          WHERE ("raw_placement_reports"."report_type" = '7day'::"text"))))
  GROUP BY "campaign_id", "campaign_name", "campaign_status", "placement_classification", "report_type"
  ORDER BY "campaign_name", "placement_classification";


ALTER VIEW "public"."view_placement_7_days" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_placement_optimization_report" WITH ("security_invoker"='true') AS
 WITH "all_placements" AS (
         SELECT 'Top of Search on-Amazon'::"text" AS "original_name",
            'Placement Top'::"text" AS "normalized_name",
            1 AS "sort_order"
        UNION ALL
         SELECT 'Other on-Amazon'::"text" AS "text",
            'Placement Rest Of Search'::"text" AS "text",
            2
        UNION ALL
         SELECT 'Detail Page on-Amazon'::"text" AS "text",
            'Placement Product Page'::"text" AS "text",
            3
        ), "latest_campaign_reports" AS (
         SELECT "t"."id",
            "t"."report_id",
            "t"."report_name",
            "t"."report_type",
            "t"."data_date",
            "t"."campaign_id",
            "t"."campaign_name",
            "t"."campaign_status",
            "t"."campaign_budget_amount",
            "t"."portfolio_id",
            "t"."impressions",
            "t"."clicks",
            "t"."spend",
            "t"."purchases_1d",
            "t"."sales_1d",
            "t"."purchases_7d",
            "t"."sales_7d",
            "t"."purchases_14d",
            "t"."sales_14d",
            "t"."purchases_30d",
            "t"."sales_30d",
            "t"."top_of_search_impression_share",
            "t"."ctr",
            "t"."cpc",
            "t"."acos_1d",
            "t"."acos_7d",
            "t"."acos_14d",
            "t"."acos_30d",
            "t"."cvr_1d",
            "t"."cvr_7d",
            "t"."cvr_14d",
            "t"."cvr_30d",
            "t"."created_at",
            "t"."updated_at",
            "t"."tenant_id",
            "t"."campaign_budget_type",
            "t"."campaign_budget_currency_code",
            "t"."rn"
           FROM ( SELECT "raw_campaign_reports"."id",
                    "raw_campaign_reports"."report_id",
                    "raw_campaign_reports"."report_name",
                    "raw_campaign_reports"."report_type",
                    "raw_campaign_reports"."data_date",
                    "raw_campaign_reports"."campaign_id",
                    "raw_campaign_reports"."campaign_name",
                    "raw_campaign_reports"."campaign_status",
                    "raw_campaign_reports"."campaign_budget_amount",
                    "raw_campaign_reports"."portfolio_id",
                    "raw_campaign_reports"."impressions",
                    "raw_campaign_reports"."clicks",
                    "raw_campaign_reports"."spend",
                    "raw_campaign_reports"."purchases_1d",
                    "raw_campaign_reports"."sales_1d",
                    "raw_campaign_reports"."purchases_7d",
                    "raw_campaign_reports"."sales_7d",
                    "raw_campaign_reports"."purchases_14d",
                    "raw_campaign_reports"."sales_14d",
                    "raw_campaign_reports"."purchases_30d",
                    "raw_campaign_reports"."sales_30d",
                    "raw_campaign_reports"."top_of_search_impression_share",
                    "raw_campaign_reports"."ctr",
                    "raw_campaign_reports"."cpc",
                    "raw_campaign_reports"."acos_1d",
                    "raw_campaign_reports"."acos_7d",
                    "raw_campaign_reports"."acos_14d",
                    "raw_campaign_reports"."acos_30d",
                    "raw_campaign_reports"."cvr_1d",
                    "raw_campaign_reports"."cvr_7d",
                    "raw_campaign_reports"."cvr_14d",
                    "raw_campaign_reports"."cvr_30d",
                    "raw_campaign_reports"."created_at",
                    "raw_campaign_reports"."updated_at",
                    "raw_campaign_reports"."tenant_id",
                    "raw_campaign_reports"."campaign_budget_type",
                    "raw_campaign_reports"."campaign_budget_currency_code",
                    "row_number"() OVER (PARTITION BY "raw_campaign_reports"."tenant_id", "raw_campaign_reports"."campaign_id", "raw_campaign_reports"."report_type" ORDER BY "raw_campaign_reports"."data_date" DESC) AS "rn"
                   FROM "public"."raw_campaign_reports") "t"
          WHERE ("t"."rn" = 1)
        ), "latest_placement_reports" AS (
         SELECT "t"."id",
            "t"."report_name",
            "t"."report_type",
            "t"."data_date",
            "t"."campaign_id",
            "t"."campaign_name",
            "t"."campaign_status",
            "t"."placement_classification",
            "t"."placement_type",
            "t"."impressions",
            "t"."clicks",
            "t"."spend",
            "t"."purchases_7d",
            "t"."sales_7d",
            "t"."purchases_14d",
            "t"."sales_14d",
            "t"."purchases_30d",
            "t"."sales_30d",
            "t"."ctr",
            "t"."cpc",
            "t"."acos_7d",
            "t"."acos_14d",
            "t"."acos_30d",
            "t"."cvr_7d",
            "t"."cvr_14d",
            "t"."cvr_30d",
            "t"."created_at",
            "t"."updated_at",
            "t"."tenant_id",
            "t"."report_id",
            "t"."rn"
           FROM ( SELECT "raw_placement_reports"."id",
                    "raw_placement_reports"."report_name",
                    "raw_placement_reports"."report_type",
                    "raw_placement_reports"."data_date",
                    "raw_placement_reports"."campaign_id",
                    "raw_placement_reports"."campaign_name",
                    "raw_placement_reports"."campaign_status",
                    "raw_placement_reports"."placement_classification",
                    "raw_placement_reports"."placement_type",
                    "raw_placement_reports"."impressions",
                    "raw_placement_reports"."clicks",
                    "raw_placement_reports"."spend",
                    "raw_placement_reports"."purchases_7d",
                    "raw_placement_reports"."sales_7d",
                    "raw_placement_reports"."purchases_14d",
                    "raw_placement_reports"."sales_14d",
                    "raw_placement_reports"."purchases_30d",
                    "raw_placement_reports"."sales_30d",
                    "raw_placement_reports"."ctr",
                    "raw_placement_reports"."cpc",
                    "raw_placement_reports"."acos_7d",
                    "raw_placement_reports"."acos_14d",
                    "raw_placement_reports"."acos_30d",
                    "raw_placement_reports"."cvr_7d",
                    "raw_placement_reports"."cvr_14d",
                    "raw_placement_reports"."cvr_30d",
                    "raw_placement_reports"."created_at",
                    "raw_placement_reports"."updated_at",
                    "raw_placement_reports"."tenant_id",
                    "raw_placement_reports"."report_id",
                    "row_number"() OVER (PARTITION BY "raw_placement_reports"."tenant_id", "raw_placement_reports"."campaign_id", "raw_placement_reports"."placement_classification", "raw_placement_reports"."report_type" ORDER BY "raw_placement_reports"."data_date" DESC) AS "rn"
                   FROM "public"."raw_placement_reports") "t"
          WHERE ("t"."rn" = 1)
        ), "base_campaigns" AS (
         SELECT DISTINCT "p"."tenant_id",
            "p"."campaign_id",
            "p"."campaign_name"
           FROM "latest_placement_reports" "p"
          WHERE (("p"."report_type" = '30day'::"text") AND ("p"."placement_classification" <> ALL (ARRAY['Off Amazon'::"text", 'Rest of Search'::"text"])))
        ), "campaign_placement_matrix" AS (
         SELECT "bc"."tenant_id",
            "bc"."campaign_id",
            "bc"."campaign_name",
            "ap"."original_name" AS "placement_classification",
            "ap"."normalized_name" AS "placement_type",
            "ap"."sort_order"
           FROM ("base_campaigns" "bc"
             CROSS JOIN "all_placements" "ap")
        ), "cp_30d" AS (
         SELECT "latest_campaign_reports"."id",
            "latest_campaign_reports"."report_id",
            "latest_campaign_reports"."report_name",
            "latest_campaign_reports"."report_type",
            "latest_campaign_reports"."data_date",
            "latest_campaign_reports"."campaign_id",
            "latest_campaign_reports"."campaign_name",
            "latest_campaign_reports"."campaign_status",
            "latest_campaign_reports"."campaign_budget_amount",
            "latest_campaign_reports"."portfolio_id",
            "latest_campaign_reports"."impressions",
            "latest_campaign_reports"."clicks",
            "latest_campaign_reports"."spend",
            "latest_campaign_reports"."purchases_1d",
            "latest_campaign_reports"."sales_1d",
            "latest_campaign_reports"."purchases_7d",
            "latest_campaign_reports"."sales_7d",
            "latest_campaign_reports"."purchases_14d",
            "latest_campaign_reports"."sales_14d",
            "latest_campaign_reports"."purchases_30d",
            "latest_campaign_reports"."sales_30d",
            "latest_campaign_reports"."top_of_search_impression_share",
            "latest_campaign_reports"."ctr",
            "latest_campaign_reports"."cpc",
            "latest_campaign_reports"."acos_1d",
            "latest_campaign_reports"."acos_7d",
            "latest_campaign_reports"."acos_14d",
            "latest_campaign_reports"."acos_30d",
            "latest_campaign_reports"."cvr_1d",
            "latest_campaign_reports"."cvr_7d",
            "latest_campaign_reports"."cvr_14d",
            "latest_campaign_reports"."cvr_30d",
            "latest_campaign_reports"."created_at",
            "latest_campaign_reports"."updated_at",
            "latest_campaign_reports"."tenant_id",
            "latest_campaign_reports"."campaign_budget_type",
            "latest_campaign_reports"."campaign_budget_currency_code",
            "latest_campaign_reports"."rn"
           FROM "latest_campaign_reports"
          WHERE ("latest_campaign_reports"."report_type" = '30day'::"text")
        ), "cp_7d" AS (
         SELECT "latest_campaign_reports"."id",
            "latest_campaign_reports"."report_id",
            "latest_campaign_reports"."report_name",
            "latest_campaign_reports"."report_type",
            "latest_campaign_reports"."data_date",
            "latest_campaign_reports"."campaign_id",
            "latest_campaign_reports"."campaign_name",
            "latest_campaign_reports"."campaign_status",
            "latest_campaign_reports"."campaign_budget_amount",
            "latest_campaign_reports"."portfolio_id",
            "latest_campaign_reports"."impressions",
            "latest_campaign_reports"."clicks",
            "latest_campaign_reports"."spend",
            "latest_campaign_reports"."purchases_1d",
            "latest_campaign_reports"."sales_1d",
            "latest_campaign_reports"."purchases_7d",
            "latest_campaign_reports"."sales_7d",
            "latest_campaign_reports"."purchases_14d",
            "latest_campaign_reports"."sales_14d",
            "latest_campaign_reports"."purchases_30d",
            "latest_campaign_reports"."sales_30d",
            "latest_campaign_reports"."top_of_search_impression_share",
            "latest_campaign_reports"."ctr",
            "latest_campaign_reports"."cpc",
            "latest_campaign_reports"."acos_1d",
            "latest_campaign_reports"."acos_7d",
            "latest_campaign_reports"."acos_14d",
            "latest_campaign_reports"."acos_30d",
            "latest_campaign_reports"."cvr_1d",
            "latest_campaign_reports"."cvr_7d",
            "latest_campaign_reports"."cvr_14d",
            "latest_campaign_reports"."cvr_30d",
            "latest_campaign_reports"."created_at",
            "latest_campaign_reports"."updated_at",
            "latest_campaign_reports"."tenant_id",
            "latest_campaign_reports"."campaign_budget_type",
            "latest_campaign_reports"."campaign_budget_currency_code",
            "latest_campaign_reports"."rn"
           FROM "latest_campaign_reports"
          WHERE ("latest_campaign_reports"."report_type" = '7day'::"text")
        ), "cp_yst" AS (
         SELECT "latest_campaign_reports"."id",
            "latest_campaign_reports"."report_id",
            "latest_campaign_reports"."report_name",
            "latest_campaign_reports"."report_type",
            "latest_campaign_reports"."data_date",
            "latest_campaign_reports"."campaign_id",
            "latest_campaign_reports"."campaign_name",
            "latest_campaign_reports"."campaign_status",
            "latest_campaign_reports"."campaign_budget_amount",
            "latest_campaign_reports"."portfolio_id",
            "latest_campaign_reports"."impressions",
            "latest_campaign_reports"."clicks",
            "latest_campaign_reports"."spend",
            "latest_campaign_reports"."purchases_1d",
            "latest_campaign_reports"."sales_1d",
            "latest_campaign_reports"."purchases_7d",
            "latest_campaign_reports"."sales_7d",
            "latest_campaign_reports"."purchases_14d",
            "latest_campaign_reports"."sales_14d",
            "latest_campaign_reports"."purchases_30d",
            "latest_campaign_reports"."sales_30d",
            "latest_campaign_reports"."top_of_search_impression_share",
            "latest_campaign_reports"."ctr",
            "latest_campaign_reports"."cpc",
            "latest_campaign_reports"."acos_1d",
            "latest_campaign_reports"."acos_7d",
            "latest_campaign_reports"."acos_14d",
            "latest_campaign_reports"."acos_30d",
            "latest_campaign_reports"."cvr_1d",
            "latest_campaign_reports"."cvr_7d",
            "latest_campaign_reports"."cvr_14d",
            "latest_campaign_reports"."cvr_30d",
            "latest_campaign_reports"."created_at",
            "latest_campaign_reports"."updated_at",
            "latest_campaign_reports"."tenant_id",
            "latest_campaign_reports"."campaign_budget_type",
            "latest_campaign_reports"."campaign_budget_currency_code",
            "latest_campaign_reports"."rn"
           FROM "latest_campaign_reports"
          WHERE ("latest_campaign_reports"."report_type" = 'yesterday'::"text")
        ), "cp_db" AS (
         SELECT "latest_campaign_reports"."id",
            "latest_campaign_reports"."report_id",
            "latest_campaign_reports"."report_name",
            "latest_campaign_reports"."report_type",
            "latest_campaign_reports"."data_date",
            "latest_campaign_reports"."campaign_id",
            "latest_campaign_reports"."campaign_name",
            "latest_campaign_reports"."campaign_status",
            "latest_campaign_reports"."campaign_budget_amount",
            "latest_campaign_reports"."portfolio_id",
            "latest_campaign_reports"."impressions",
            "latest_campaign_reports"."clicks",
            "latest_campaign_reports"."spend",
            "latest_campaign_reports"."purchases_1d",
            "latest_campaign_reports"."sales_1d",
            "latest_campaign_reports"."purchases_7d",
            "latest_campaign_reports"."sales_7d",
            "latest_campaign_reports"."purchases_14d",
            "latest_campaign_reports"."sales_14d",
            "latest_campaign_reports"."purchases_30d",
            "latest_campaign_reports"."sales_30d",
            "latest_campaign_reports"."top_of_search_impression_share",
            "latest_campaign_reports"."ctr",
            "latest_campaign_reports"."cpc",
            "latest_campaign_reports"."acos_1d",
            "latest_campaign_reports"."acos_7d",
            "latest_campaign_reports"."acos_14d",
            "latest_campaign_reports"."acos_30d",
            "latest_campaign_reports"."cvr_1d",
            "latest_campaign_reports"."cvr_7d",
            "latest_campaign_reports"."cvr_14d",
            "latest_campaign_reports"."cvr_30d",
            "latest_campaign_reports"."created_at",
            "latest_campaign_reports"."updated_at",
            "latest_campaign_reports"."tenant_id",
            "latest_campaign_reports"."campaign_budget_type",
            "latest_campaign_reports"."campaign_budget_currency_code",
            "latest_campaign_reports"."rn"
           FROM "latest_campaign_reports"
          WHERE ("latest_campaign_reports"."report_type" = 'dayBefore'::"text")
        ), "pp_30d" AS (
         SELECT "latest_placement_reports"."id",
            "latest_placement_reports"."report_name",
            "latest_placement_reports"."report_type",
            "latest_placement_reports"."data_date",
            "latest_placement_reports"."campaign_id",
            "latest_placement_reports"."campaign_name",
            "latest_placement_reports"."campaign_status",
            "latest_placement_reports"."placement_classification",
            "latest_placement_reports"."placement_type",
            "latest_placement_reports"."impressions",
            "latest_placement_reports"."clicks",
            "latest_placement_reports"."spend",
            "latest_placement_reports"."purchases_7d",
            "latest_placement_reports"."sales_7d",
            "latest_placement_reports"."purchases_14d",
            "latest_placement_reports"."sales_14d",
            "latest_placement_reports"."purchases_30d",
            "latest_placement_reports"."sales_30d",
            "latest_placement_reports"."ctr",
            "latest_placement_reports"."cpc",
            "latest_placement_reports"."acos_7d",
            "latest_placement_reports"."acos_14d",
            "latest_placement_reports"."acos_30d",
            "latest_placement_reports"."cvr_7d",
            "latest_placement_reports"."cvr_14d",
            "latest_placement_reports"."cvr_30d",
            "latest_placement_reports"."created_at",
            "latest_placement_reports"."updated_at",
            "latest_placement_reports"."tenant_id",
            "latest_placement_reports"."report_id",
            "latest_placement_reports"."rn"
           FROM "latest_placement_reports"
          WHERE ("latest_placement_reports"."report_type" = '30day'::"text")
        ), "pp_7d" AS (
         SELECT "latest_placement_reports"."id",
            "latest_placement_reports"."report_name",
            "latest_placement_reports"."report_type",
            "latest_placement_reports"."data_date",
            "latest_placement_reports"."campaign_id",
            "latest_placement_reports"."campaign_name",
            "latest_placement_reports"."campaign_status",
            "latest_placement_reports"."placement_classification",
            "latest_placement_reports"."placement_type",
            "latest_placement_reports"."impressions",
            "latest_placement_reports"."clicks",
            "latest_placement_reports"."spend",
            "latest_placement_reports"."purchases_7d",
            "latest_placement_reports"."sales_7d",
            "latest_placement_reports"."purchases_14d",
            "latest_placement_reports"."sales_14d",
            "latest_placement_reports"."purchases_30d",
            "latest_placement_reports"."sales_30d",
            "latest_placement_reports"."ctr",
            "latest_placement_reports"."cpc",
            "latest_placement_reports"."acos_7d",
            "latest_placement_reports"."acos_14d",
            "latest_placement_reports"."acos_30d",
            "latest_placement_reports"."cvr_7d",
            "latest_placement_reports"."cvr_14d",
            "latest_placement_reports"."cvr_30d",
            "latest_placement_reports"."created_at",
            "latest_placement_reports"."updated_at",
            "latest_placement_reports"."tenant_id",
            "latest_placement_reports"."report_id",
            "latest_placement_reports"."rn"
           FROM "latest_placement_reports"
          WHERE ("latest_placement_reports"."report_type" = '7day'::"text")
        )
 SELECT "cpm"."campaign_name" AS "Campaign",
    COALESCE("po"."portfolio_name", 'Unknown'::"text") AS "Portfolio",
    COALESCE("pb"."campaign_budget", (0)::numeric) AS "Budget",
    COALESCE("p30"."clicks", 0) AS "Clicks",
    "round"(COALESCE("p30"."spend", (0)::numeric), 2) AS "Spend",
    COALESCE("p30"."purchases_30d", 0) AS "Orders",
        CASE
            WHEN (COALESCE("p30"."clicks", 0) > 0) THEN "round"((((COALESCE("p30"."purchases_30d", 0))::numeric / ("p30"."clicks")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "CVR",
        CASE
            WHEN (COALESCE("p30"."sales_30d", (0)::numeric) > (0)::numeric) THEN "round"(((COALESCE("p30"."spend", (0)::numeric) / ("p30"."sales_30d")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "ACoS",
    COALESCE("p7"."clicks", 0) AS "Clicks_7d",
    "round"(COALESCE("p7"."spend", (0)::numeric), 2) AS "Spend_7d",
    COALESCE("p7"."purchases_7d", 0) AS "Orders_7d",
        CASE
            WHEN (COALESCE("p7"."clicks", 0) > 0) THEN "round"((((COALESCE("p7"."purchases_7d", 0))::numeric / ("p7"."clicks")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "CVR_7d",
        CASE
            WHEN (COALESCE("p7"."sales_7d", (0)::numeric) > (0)::numeric) THEN "round"(((COALESCE("p7"."spend", (0)::numeric) / ("p7"."sales_7d")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "ACoS_7d",
    ('$'::"text" || COALESCE("round"("cdb"."spend", 2), (0)::numeric)) AS "Spent DB Yesterday",
    ('$'::"text" || COALESCE("round"("cy"."spend", 2), (0)::numeric)) AS "Spent Yesterday",
    COALESCE((("c30"."top_of_search_impression_share")::"text" || '%'::"text"), '0%'::"text") AS "Last 30 days",
    COALESCE((("c7"."top_of_search_impression_share")::"text" || '%'::"text"), '0%'::"text") AS "Last 7 days",
    COALESCE((("cy"."top_of_search_impression_share")::"text" || '%'::"text"), '0%'::"text") AS "Yesterday",
    "cpm"."placement_type" AS "Placement Type",
        CASE
            WHEN ("cpm"."placement_type" = 'Placement Top'::"text") THEN COALESCE("pb"."placement_top_of_search", 0)
            WHEN ("cpm"."placement_type" = 'Placement Rest Of Search'::"text") THEN COALESCE("pb"."placement_rest_of_search", 0)
            WHEN ("cpm"."placement_type" = 'Placement Product Page'::"text") THEN COALESCE("pb"."placement_product_page", 0)
            ELSE 0
        END AS "Increase bids by placement",
    0 AS "Changes in placement",
    ''::"text" AS "NOTES",
    ''::"text" AS "Empty1",
    ''::"text" AS "Empty2",
    "cpm"."tenant_id"
   FROM (((((((("campaign_placement_matrix" "cpm"
     LEFT JOIN "pp_30d" "p30" ON ((("cpm"."campaign_id" = "p30"."campaign_id") AND ("cpm"."tenant_id" = "p30"."tenant_id") AND ("cpm"."placement_classification" = "p30"."placement_classification"))))
     LEFT JOIN "pp_7d" "p7" ON ((("cpm"."campaign_id" = "p7"."campaign_id") AND ("cpm"."tenant_id" = "p7"."tenant_id") AND ("cpm"."placement_classification" = "p7"."placement_classification"))))
     LEFT JOIN "cp_30d" "c30" ON ((("cpm"."campaign_id" = "c30"."campaign_id") AND ("cpm"."tenant_id" = "c30"."tenant_id"))))
     LEFT JOIN "cp_7d" "c7" ON ((("cpm"."campaign_id" = "c7"."campaign_id") AND ("cpm"."tenant_id" = "c7"."tenant_id"))))
     LEFT JOIN "cp_yst" "cy" ON ((("cpm"."campaign_id" = "cy"."campaign_id") AND ("cpm"."tenant_id" = "cy"."tenant_id"))))
     LEFT JOIN "cp_db" "cdb" ON ((("cpm"."campaign_id" = "cdb"."campaign_id") AND ("cpm"."tenant_id" = "cdb"."tenant_id"))))
     LEFT JOIN "public"."placement_bids" "pb" ON ((("cpm"."campaign_id" = "pb"."campaign_id") AND ("cpm"."tenant_id" = "pb"."tenant_id"))))
     LEFT JOIN "public"."portfolios" "po" ON ((("pb"."portfolio_id" = "po"."portfolio_id") AND ("pb"."tenant_id" = "po"."tenant_id"))))
  ORDER BY "cpm"."campaign_name", "cpm"."sort_order";


ALTER VIEW "public"."view_placement_optimization_report" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_portfolio_lookup" WITH ("security_invoker"='true') AS
 SELECT "portfolio_id" AS " Portfolio Id",
    "portfolio_name" AS " Portfolio Name"
   FROM "public"."portfolios"
  WHERE ("portfolio_state" = 'ENABLED'::"text")
  ORDER BY "portfolio_name";


ALTER VIEW "public"."view_portfolio_lookup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_tos_impression_share" WITH ("security_invoker"='true') AS
 WITH "tos_30d" AS (
         SELECT "raw_campaign_reports"."campaign_name",
            "avg"("raw_campaign_reports"."top_of_search_impression_share") AS "tos_is_30d"
           FROM "public"."raw_campaign_reports"
          WHERE (("raw_campaign_reports"."report_type" = '30day'::"text") AND ("raw_campaign_reports"."data_date" = ( SELECT "max"("raw_campaign_reports_1"."data_date") AS "max"
                   FROM "public"."raw_campaign_reports" "raw_campaign_reports_1"
                  WHERE ("raw_campaign_reports_1"."report_type" = '30day'::"text"))))
          GROUP BY "raw_campaign_reports"."campaign_name"
        ), "tos_7d" AS (
         SELECT "raw_campaign_reports"."campaign_name",
            "avg"("raw_campaign_reports"."top_of_search_impression_share") AS "tos_is_7d"
           FROM "public"."raw_campaign_reports"
          WHERE (("raw_campaign_reports"."report_type" = '7day'::"text") AND ("raw_campaign_reports"."data_date" = ( SELECT "max"("raw_campaign_reports_1"."data_date") AS "max"
                   FROM "public"."raw_campaign_reports" "raw_campaign_reports_1"
                  WHERE ("raw_campaign_reports_1"."report_type" = '7day'::"text"))))
          GROUP BY "raw_campaign_reports"."campaign_name"
        ), "tos_yesterday" AS (
         SELECT "raw_campaign_reports"."campaign_name",
            "avg"("raw_campaign_reports"."top_of_search_impression_share") AS "tos_is_yesterday"
           FROM "public"."raw_campaign_reports"
          WHERE (("raw_campaign_reports"."report_type" = 'yesterday'::"text") AND ("raw_campaign_reports"."data_date" = ( SELECT "max"("raw_campaign_reports_1"."data_date") AS "max"
                   FROM "public"."raw_campaign_reports" "raw_campaign_reports_1"
                  WHERE ("raw_campaign_reports_1"."report_type" = 'yesterday'::"text"))))
          GROUP BY "raw_campaign_reports"."campaign_name"
        ), "all_campaigns" AS (
         SELECT "tos_30d"."campaign_name"
           FROM "tos_30d"
        UNION
         SELECT "tos_7d"."campaign_name"
           FROM "tos_7d"
        UNION
         SELECT "tos_yesterday"."campaign_name"
           FROM "tos_yesterday"
        )
 SELECT "ac"."campaign_name" AS "Campaigns 30",
    COALESCE("t30"."tos_is_30d", (0)::numeric) AS "Top-of-search IS 30",
    "ac"."campaign_name" AS "Campaigns 7",
    COALESCE("t7"."tos_is_7d", (0)::numeric) AS "Top-of-search IS 7",
    "ac"."campaign_name" AS "Campaigns Y",
    COALESCE("ty"."tos_is_yesterday", (0)::numeric) AS "Top-of-search IS Y"
   FROM ((("all_campaigns" "ac"
     LEFT JOIN "tos_30d" "t30" ON (("ac"."campaign_name" = "t30"."campaign_name")))
     LEFT JOIN "tos_7d" "t7" ON (("ac"."campaign_name" = "t7"."campaign_name")))
     LEFT JOIN "tos_yesterday" "ty" ON (("ac"."campaign_name" = "ty"."campaign_name")))
  ORDER BY "ac"."campaign_name";


ALTER VIEW "public"."view_tos_impression_share" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_usa_placement_data" WITH ("security_invoker"='true') AS
 WITH "placement_performance" AS (
         SELECT "rpr"."campaign_name",
                CASE
                    WHEN ("rpr"."placement_classification" = 'Top of Search on-Amazon'::"text") THEN 'Placement Top'::"text"
                    WHEN ("rpr"."placement_classification" = 'Other on-Amazon'::"text") THEN 'Placement Rest Of Search'::"text"
                    WHEN ("rpr"."placement_classification" = 'Detail Page on-Amazon'::"text") THEN 'Placement Product Page'::"text"
                    ELSE "rpr"."placement_classification"
                END AS "placement_type",
            "sum"("rpr"."clicks") AS "clicks_30d",
            "sum"("rpr"."spend") AS "spend_30d",
            "sum"("rpr"."purchases_30d") AS "orders_30d",
            "sum"("rpr"."sales_30d") AS "sales_30d"
           FROM "public"."raw_placement_reports" "rpr"
          WHERE (("rpr"."report_type" = '30day'::"text") AND ("rpr"."campaign_status" = 'ENABLED'::"text") AND ("rpr"."placement_classification" <> 'Off Amazon'::"text") AND ("rpr"."data_date" = ( SELECT "max"("raw_placement_reports"."data_date") AS "max"
                   FROM "public"."raw_placement_reports"
                  WHERE ("raw_placement_reports"."report_type" = '30day'::"text"))))
          GROUP BY "rpr"."campaign_name", "rpr"."placement_classification"
        ), "all_campaigns" AS (
         SELECT DISTINCT "placement_performance"."campaign_name"
           FROM "placement_performance"
        ), "all_placements" AS (
         SELECT "unnest"(ARRAY['Placement Top'::"text", 'Placement Rest Of Search'::"text", 'Placement Product Page'::"text"]) AS "placement_type"
        ), "campaign_placement_matrix" AS (
         SELECT "ac"."campaign_name",
            "ap"."placement_type"
           FROM ("all_campaigns" "ac"
             CROSS JOIN "all_placements" "ap")
        ), "complete_data" AS (
         SELECT "cpm"."campaign_name",
            "cpm"."placement_type",
            COALESCE("pp"."clicks_30d", (0)::bigint) AS "clicks_30d",
            COALESCE("pp"."spend_30d", (0)::numeric) AS "spend_30d",
            COALESCE("pp"."orders_30d", (0)::bigint) AS "orders_30d",
            COALESCE("pp"."sales_30d", (0)::numeric) AS "sales_30d"
           FROM ("campaign_placement_matrix" "cpm"
             LEFT JOIN "placement_performance" "pp" ON ((("cpm"."campaign_name" = "pp"."campaign_name") AND ("cpm"."placement_type" = "pp"."placement_type"))))
        )
 SELECT "campaign_name" AS "Campaign",
    "orders_30d" AS "Orders",
    "placement_type" AS "Placement Type",
    "clicks_30d" AS "Clicks",
    "spend_30d" AS "Spend",
        CASE
            WHEN ("sales_30d" > (0)::numeric) THEN "round"((("spend_30d" / "sales_30d") * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "ACoS"
   FROM "complete_data"
  ORDER BY "campaign_name",
        CASE "placement_type"
            WHEN 'Placement Top'::"text" THEN 1
            WHEN 'Placement Rest Of Search'::"text" THEN 2
            WHEN 'Placement Product Page'::"text" THEN 3
            ELSE 4
        END;


ALTER VIEW "public"."view_usa_placement_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_campaign_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "week_id" "text" NOT NULL,
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "campaign_status" "text",
    "portfolio_id" "text",
    "impressions_30d" bigint DEFAULT 0,
    "clicks_30d" bigint DEFAULT 0,
    "spend_30d" numeric(10,2) DEFAULT 0,
    "sales_30d" numeric(10,2) DEFAULT 0,
    "purchases_30d" integer DEFAULT 0,
    "acos_30d" numeric(5,2),
    "cvr_30d" numeric(5,4),
    "impressions_7d" bigint DEFAULT 0,
    "clicks_7d" bigint DEFAULT 0,
    "spend_7d" numeric(10,2) DEFAULT 0,
    "sales_7d" numeric(10,2) DEFAULT 0,
    "purchases_7d" integer DEFAULT 0,
    "acos_7d" numeric(5,2),
    "cvr_7d" numeric(5,4),
    "yesterday_impressions" bigint DEFAULT 0,
    "yesterday_clicks" bigint DEFAULT 0,
    "yesterday_spend" numeric(10,2) DEFAULT 0,
    "day_before_impressions" bigint DEFAULT 0,
    "day_before_clicks" bigint DEFAULT 0,
    "day_before_spend" numeric(10,2) DEFAULT 0,
    "campaign_budget" numeric(10,2),
    "top_of_search_impression_share" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_campaign_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_placement_bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "week_id" "text" NOT NULL,
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "campaign_status" "text",
    "portfolio_id" "text",
    "campaign_budget" numeric(10,2),
    "placement_top_of_search" integer DEFAULT 0,
    "placement_rest_of_search" integer DEFAULT 0,
    "placement_product_page" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_placement_bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_placement_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "week_id" "text" NOT NULL,
    "campaign_id" "text" NOT NULL,
    "campaign_name" "text",
    "placement_type" "text" NOT NULL,
    "impressions_30d" bigint DEFAULT 0,
    "clicks_30d" bigint DEFAULT 0,
    "spend_30d" numeric(10,2) DEFAULT 0,
    "sales_30d" numeric(10,2) DEFAULT 0,
    "purchases_30d" integer DEFAULT 0,
    "acos_30d" numeric(5,2),
    "cvr_30d" numeric(5,4),
    "impressions_7d" bigint DEFAULT 0,
    "clicks_7d" bigint DEFAULT 0,
    "spend_7d" numeric(10,2) DEFAULT 0,
    "sales_7d" numeric(10,2) DEFAULT 0,
    "purchases_7d" integer DEFAULT 0,
    "acos_7d" numeric(5,2),
    "cvr_7d" numeric(5,4),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "weekly_placement_type_check" CHECK (("placement_type" = ANY (ARRAY['Top of Search'::"text", 'Rest of Search'::"text", 'Product Page'::"text"])))
);


ALTER TABLE "public"."weekly_placement_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_portfolios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "week_id" "text" NOT NULL,
    "portfolio_id" "text" NOT NULL,
    "portfolio_name" "text",
    "budget_amount" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."weekly_portfolios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_weekly_placement_report" WITH ("security_invoker"='on') AS
 SELECT "pp"."id",
    "pp"."snapshot_id",
    "pp"."tenant_id",
    "pp"."week_id",
    "pp"."campaign_id",
    "pp"."campaign_name",
    "pp"."placement_type",
    "pp"."impressions_30d",
    "pp"."clicks_30d",
    "pp"."spend_30d",
    "pp"."sales_30d",
    "pp"."purchases_30d",
    "pp"."acos_30d",
    "pp"."cvr_30d",
    "pp"."impressions_7d",
    "pp"."clicks_7d",
    "pp"."spend_7d",
    "pp"."sales_7d",
    "pp"."purchases_7d",
    "pp"."acos_7d",
    "pp"."cvr_7d",
    "pp"."created_at",
    "cp"."top_of_search_impression_share",
    "cp"."yesterday_spend",
    "cp"."day_before_spend",
    "cp"."campaign_budget",
    "cp"."campaign_status",
    "cp"."portfolio_id",
    "pb"."placement_top_of_search",
    "pb"."placement_rest_of_search",
    "pb"."placement_product_page",
    "pf"."portfolio_name",
    "pf"."budget_amount" AS "portfolio_budget"
   FROM ((("public"."weekly_placement_performance" "pp"
     LEFT JOIN "public"."weekly_campaign_performance" "cp" ON ((("pp"."snapshot_id" = "cp"."snapshot_id") AND ("pp"."campaign_id" = "cp"."campaign_id"))))
     LEFT JOIN "public"."weekly_placement_bids" "pb" ON ((("pp"."snapshot_id" = "pb"."snapshot_id") AND ("pp"."campaign_id" = "pb"."campaign_id"))))
     LEFT JOIN "public"."weekly_portfolios" "pf" ON ((("pp"."snapshot_id" = "pf"."snapshot_id") AND ("cp"."portfolio_id" = "pf"."portfolio_id"))));


ALTER VIEW "public"."view_weekly_placement_report" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "week_id" "text" NOT NULL,
    "year" integer NOT NULL,
    "week_number" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'collecting'::"text" NOT NULL,
    "workflow_execution_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "weekly_snapshots_status_check" CHECK (("status" = ANY (ARRAY['collecting'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."weekly_snapshots" OWNER TO "postgres";


ALTER TABLE ONLY "public"."raw_campaign_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."raw_campaign_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."raw_placement_reports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."raw_placement_reports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."report_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."report_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."credentials"
    ADD CONSTRAINT "credentials_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."placement_bids"
    ADD CONSTRAINT "placement_bids_pkey" PRIMARY KEY ("tenant_id", "campaign_id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_pkey" PRIMARY KEY ("tenant_id", "portfolio_id");



ALTER TABLE ONLY "public"."raw_campaign_reports"
    ADD CONSTRAINT "raw_campaign_reports_campaign_id_report_type_data_date_key" UNIQUE ("campaign_id", "report_type", "data_date");



ALTER TABLE ONLY "public"."raw_campaign_reports"
    ADD CONSTRAINT "raw_campaign_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_campaign_reports"
    ADD CONSTRAINT "raw_campaign_reports_unique_record" UNIQUE ("tenant_id", "campaign_id", "report_type", "data_date");



ALTER TABLE ONLY "public"."raw_placement_reports"
    ADD CONSTRAINT "raw_placement_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."raw_placement_reports"
    ADD CONSTRAINT "raw_placement_reports_unique_placement_type" UNIQUE ("tenant_id", "campaign_id", "placement_type", "report_type", "data_date");



ALTER TABLE ONLY "public"."raw_placement_reports"
    ADD CONSTRAINT "raw_placement_reports_unique_record" UNIQUE ("tenant_id", "campaign_id", "placement_type", "report_type", "data_date");



ALTER TABLE ONLY "public"."report_ledger"
    ADD CONSTRAINT "report_ledger_pkey" PRIMARY KEY ("report_id", "tenant_id");



ALTER TABLE ONLY "public"."staging_campaign_reports"
    ADD CONSTRAINT "staging_campaign_reports_campaign_id_report_type_data_date_key" UNIQUE ("campaign_id", "report_type", "data_date");



ALTER TABLE ONLY "public"."staging_campaign_reports"
    ADD CONSTRAINT "staging_campaign_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_placement_bids"
    ADD CONSTRAINT "staging_placement_bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_placement_bids"
    ADD CONSTRAINT "staging_placement_bids_tenant_id_campaign_id_key" UNIQUE ("tenant_id", "campaign_id");



ALTER TABLE ONLY "public"."staging_placement_reports"
    ADD CONSTRAINT "staging_placement_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_portfolios"
    ADD CONSTRAINT "staging_portfolios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_portfolios"
    ADD CONSTRAINT "staging_portfolios_tenant_id_portfolio_id_key" UNIQUE ("tenant_id", "portfolio_id");



ALTER TABLE ONLY "public"."weekly_campaign_performance"
    ADD CONSTRAINT "weekly_campaign_perf_unique" UNIQUE ("tenant_id", "week_id", "campaign_id");



ALTER TABLE ONLY "public"."weekly_campaign_performance"
    ADD CONSTRAINT "weekly_campaign_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_placement_bids"
    ADD CONSTRAINT "weekly_placement_bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_placement_bids"
    ADD CONSTRAINT "weekly_placement_bids_unique" UNIQUE ("tenant_id", "week_id", "campaign_id");



ALTER TABLE ONLY "public"."weekly_placement_performance"
    ADD CONSTRAINT "weekly_placement_perf_unique" UNIQUE ("tenant_id", "week_id", "campaign_id", "placement_type");



ALTER TABLE ONLY "public"."weekly_placement_performance"
    ADD CONSTRAINT "weekly_placement_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_portfolios"
    ADD CONSTRAINT "weekly_portfolios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_portfolios"
    ADD CONSTRAINT "weekly_portfolios_unique" UNIQUE ("tenant_id", "week_id", "portfolio_id");



ALTER TABLE ONLY "public"."weekly_snapshots"
    ADD CONSTRAINT "weekly_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_snapshots"
    ADD CONSTRAINT "weekly_snapshots_tenant_week_unique" UNIQUE ("tenant_id", "week_id");



CREATE INDEX "idx_campaign_reports_campaign_id" ON "public"."raw_campaign_reports" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_reports_name" ON "public"."raw_campaign_reports" USING "btree" ("campaign_name");



CREATE INDEX "idx_campaign_reports_status" ON "public"."raw_campaign_reports" USING "btree" ("campaign_status");



CREATE INDEX "idx_campaign_reports_type_date" ON "public"."raw_campaign_reports" USING "btree" ("report_type", "data_date");



CREATE INDEX "idx_campaign_tenant_date" ON "public"."raw_campaign_reports" USING "btree" ("tenant_id", "data_date");



CREATE INDEX "idx_credentials_stripe_customer_id" ON "public"."credentials" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_credentials_subscription_status" ON "public"."credentials" USING "btree" ("subscription_status");



CREATE INDEX "idx_placement_bids_portfolio" ON "public"."placement_bids" USING "btree" ("portfolio_id");



CREATE INDEX "idx_placement_bids_status" ON "public"."placement_bids" USING "btree" ("campaign_status");



CREATE INDEX "idx_placement_reports_campaign_id" ON "public"."raw_placement_reports" USING "btree" ("campaign_id");



CREATE INDEX "idx_placement_reports_placement" ON "public"."raw_placement_reports" USING "btree" ("placement_classification");



CREATE INDEX "idx_placement_reports_status" ON "public"."raw_placement_reports" USING "btree" ("campaign_status");



CREATE INDEX "idx_placement_reports_type_date" ON "public"."raw_placement_reports" USING "btree" ("report_type", "data_date");



CREATE INDEX "idx_placement_tenant_date" ON "public"."raw_placement_reports" USING "btree" ("tenant_id", "data_date");



CREATE INDEX "idx_report_ledger_status" ON "public"."report_ledger" USING "btree" ("status");



CREATE INDEX "idx_weekly_campaign_perf_campaign" ON "public"."weekly_campaign_performance" USING "btree" ("campaign_id");



CREATE INDEX "idx_weekly_campaign_perf_snapshot" ON "public"."weekly_campaign_performance" USING "btree" ("snapshot_id");



CREATE INDEX "idx_weekly_campaign_perf_tenant" ON "public"."weekly_campaign_performance" USING "btree" ("tenant_id");



CREATE INDEX "idx_weekly_campaign_perf_tenant_week" ON "public"."weekly_campaign_performance" USING "btree" ("tenant_id", "week_id");



CREATE INDEX "idx_weekly_placement_bids_campaign" ON "public"."weekly_placement_bids" USING "btree" ("campaign_id");



CREATE INDEX "idx_weekly_placement_bids_snapshot" ON "public"."weekly_placement_bids" USING "btree" ("snapshot_id");



CREATE INDEX "idx_weekly_placement_bids_tenant" ON "public"."weekly_placement_bids" USING "btree" ("tenant_id");



CREATE INDEX "idx_weekly_placement_bids_tenant_week" ON "public"."weekly_placement_bids" USING "btree" ("tenant_id", "week_id");



CREATE INDEX "idx_weekly_placement_perf_campaign" ON "public"."weekly_placement_performance" USING "btree" ("campaign_id");



CREATE INDEX "idx_weekly_placement_perf_snapshot" ON "public"."weekly_placement_performance" USING "btree" ("snapshot_id");



CREATE INDEX "idx_weekly_placement_perf_tenant" ON "public"."weekly_placement_performance" USING "btree" ("tenant_id");



CREATE INDEX "idx_weekly_placement_perf_tenant_week" ON "public"."weekly_placement_performance" USING "btree" ("tenant_id", "week_id");



CREATE INDEX "idx_weekly_placement_perf_type" ON "public"."weekly_placement_performance" USING "btree" ("placement_type");



CREATE INDEX "idx_weekly_portfolios_portfolio" ON "public"."weekly_portfolios" USING "btree" ("portfolio_id");



CREATE INDEX "idx_weekly_portfolios_snapshot" ON "public"."weekly_portfolios" USING "btree" ("snapshot_id");



CREATE INDEX "idx_weekly_portfolios_tenant" ON "public"."weekly_portfolios" USING "btree" ("tenant_id");



CREATE INDEX "idx_weekly_portfolios_tenant_week" ON "public"."weekly_portfolios" USING "btree" ("tenant_id", "week_id");



CREATE INDEX "idx_weekly_snapshots_status" ON "public"."weekly_snapshots" USING "btree" ("status");



CREATE INDEX "idx_weekly_snapshots_tenant" ON "public"."weekly_snapshots" USING "btree" ("tenant_id");



CREATE INDEX "idx_weekly_snapshots_tenant_week" ON "public"."weekly_snapshots" USING "btree" ("tenant_id", "week_id");



CREATE INDEX "staging_campaign_reports_campaign_id_idx" ON "public"."staging_campaign_reports" USING "btree" ("campaign_id");



CREATE INDEX "staging_campaign_reports_campaign_name_idx" ON "public"."staging_campaign_reports" USING "btree" ("campaign_name");



CREATE INDEX "staging_campaign_reports_campaign_status_idx" ON "public"."staging_campaign_reports" USING "btree" ("campaign_status");



CREATE INDEX "staging_campaign_reports_report_type_data_date_idx" ON "public"."staging_campaign_reports" USING "btree" ("report_type", "data_date");



CREATE INDEX "staging_campaign_reports_tenant_id_data_date_idx" ON "public"."staging_campaign_reports" USING "btree" ("tenant_id", "data_date");



CREATE INDEX "staging_placement_reports_campaign_id_idx" ON "public"."staging_placement_reports" USING "btree" ("campaign_id");



CREATE INDEX "staging_placement_reports_campaign_status_idx" ON "public"."staging_placement_reports" USING "btree" ("campaign_status");



CREATE INDEX "staging_placement_reports_report_type_data_date_idx" ON "public"."staging_placement_reports" USING "btree" ("report_type", "data_date");



CREATE INDEX "staging_placement_reports_tenant_id_data_date_idx" ON "public"."staging_placement_reports" USING "btree" ("tenant_id", "data_date");



CREATE OR REPLACE TRIGGER "update_campaign_reports_updated_at" BEFORE UPDATE ON "public"."raw_campaign_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_placement_bids_updated_at" BEFORE UPDATE ON "public"."placement_bids" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_placement_reports_updated_at" BEFORE UPDATE ON "public"."raw_placement_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_portfolios_updated_at" BEFORE UPDATE ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."credentials"
    ADD CONSTRAINT "credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."staging_placement_bids"
    ADD CONSTRAINT "fk_bids_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_placement_bids"
    ADD CONSTRAINT "fk_bids_to_credentials" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raw_campaign_reports"
    ADD CONSTRAINT "fk_campaign_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placement_bids"
    ADD CONSTRAINT "fk_placement_reports_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raw_placement_reports"
    ADD CONSTRAINT "fk_placement_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raw_campaign_reports"
    ADD CONSTRAINT "fk_raw_campaign_reports_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."raw_placement_reports"
    ADD CONSTRAINT "fk_raw_placement_reports_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_campaign_reports"
    ADD CONSTRAINT "fk_staging_campaign_reports_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_placement_reports"
    ADD CONSTRAINT "fk_staging_placement_reports_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_portfolios"
    ADD CONSTRAINT "fk_staging_portfolios_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "fk_tenant_identity" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."placement_bids"
    ADD CONSTRAINT "placement_bids_portfolio_id_fkey" FOREIGN KEY ("tenant_id", "portfolio_id") REFERENCES "public"."portfolios"("tenant_id", "portfolio_id");



ALTER TABLE ONLY "public"."report_ledger"
    ADD CONSTRAINT "report_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."credentials"("tenant_id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_campaign_performance"
    ADD CONSTRAINT "weekly_campaign_performance_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."weekly_snapshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_placement_bids"
    ADD CONSTRAINT "weekly_placement_bids_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."weekly_snapshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_placement_performance"
    ADD CONSTRAINT "weekly_placement_performance_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."weekly_snapshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_portfolios"
    ADD CONSTRAINT "weekly_portfolios_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."weekly_snapshots"("id") ON DELETE CASCADE;



CREATE POLICY "Service role can manage all weekly campaign performance" ON "public"."weekly_campaign_performance" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all weekly placement bids" ON "public"."weekly_placement_bids" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all weekly placement performance" ON "public"."weekly_placement_performance" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all weekly portfolios" ON "public"."weekly_portfolios" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all weekly snapshots" ON "public"."weekly_snapshots" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."placement_bids" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."portfolios" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."raw_campaign_reports" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."raw_placement_reports" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."report_ledger" TO "authenticated" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can only see their own data" ON "public"."placement_bids" USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can only see their own data" ON "public"."portfolios" USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can see own data" ON "public"."raw_campaign_reports" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can see own data" ON "public"."raw_placement_reports" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can update own credentials" ON "public"."credentials" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "tenant_id")) WITH CHECK (("auth"."uid"() = "tenant_id"));



CREATE POLICY "Users can view own credentials" ON "public"."credentials" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "tenant_id"));



CREATE POLICY "Users can view their own credentials" ON "public"."credentials" FOR SELECT USING (("auth"."uid"() = "tenant_id"));



CREATE POLICY "Users can view their own weekly campaign performance" ON "public"."weekly_campaign_performance" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own weekly placement bids" ON "public"."weekly_placement_bids" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own weekly placement performance" ON "public"."weekly_placement_performance" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own weekly portfolios" ON "public"."weekly_portfolios" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own weekly snapshots" ON "public"."weekly_snapshots" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



ALTER TABLE "public"."credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."placement_bids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."raw_campaign_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."raw_placement_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_campaign_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_placement_bids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_placement_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_portfolios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_campaign_performance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_placement_bids" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_placement_performance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_portfolios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_snapshots" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."cleanup_old_report_ledger"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_report_ledger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_report_ledger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_tenant_secrets"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_tenant_secrets"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_tenant_secrets"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_week_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_week_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_week_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_token"("p_vault_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_token"("p_vault_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_token"("p_vault_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_week_metadata"("input_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_week_metadata"("input_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_week_metadata"("input_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_placement_type"("placement_classification" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_placement_type"("placement_classification" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_placement_type"("placement_classification" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_amazon_credentials"("p_client_id" "text", "p_client_secret" "text", "p_refresh_token" "text", "p_amazon_profile_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."store_amazon_credentials"("p_client_id" "text", "p_client_secret" "text", "p_refresh_token" "text", "p_amazon_profile_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_amazon_credentials"("p_client_id" "text", "p_client_secret" "text", "p_refresh_token" "text", "p_amazon_profile_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text", "p_secret_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text", "p_secret_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."store_tenant_secret"("p_tenant_id" "uuid", "p_secret" "text", "p_secret_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_staging_to_raw"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_staging_to_raw"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_staging_to_raw"() TO "service_role";



GRANT ALL ON FUNCTION "public"."truncate_performance_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."truncate_performance_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."truncate_performance_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."credentials" TO "anon";
GRANT ALL ON TABLE "public"."credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."credentials" TO "service_role";



GRANT ALL ON TABLE "public"."placement_bids" TO "anon";
GRANT ALL ON TABLE "public"."placement_bids" TO "authenticated";
GRANT ALL ON TABLE "public"."placement_bids" TO "service_role";



GRANT ALL ON TABLE "public"."portfolios" TO "anon";
GRANT ALL ON TABLE "public"."portfolios" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolios" TO "service_role";



GRANT ALL ON TABLE "public"."raw_campaign_reports" TO "anon";
GRANT ALL ON TABLE "public"."raw_campaign_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_campaign_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."raw_campaign_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."raw_campaign_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."raw_campaign_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."raw_placement_reports" TO "anon";
GRANT ALL ON TABLE "public"."raw_placement_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."raw_placement_reports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."raw_placement_reports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."raw_placement_reports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."raw_placement_reports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."report_ledger" TO "anon";
GRANT ALL ON TABLE "public"."report_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."report_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."report_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."report_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."report_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staging_campaign_reports" TO "anon";
GRANT ALL ON TABLE "public"."staging_campaign_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_campaign_reports" TO "service_role";



GRANT ALL ON TABLE "public"."staging_placement_bids" TO "anon";
GRANT ALL ON TABLE "public"."staging_placement_bids" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_placement_bids" TO "service_role";



GRANT ALL ON TABLE "public"."staging_placement_reports" TO "anon";
GRANT ALL ON TABLE "public"."staging_placement_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_placement_reports" TO "service_role";



GRANT ALL ON TABLE "public"."staging_portfolios" TO "anon";
GRANT ALL ON TABLE "public"."staging_portfolios" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_portfolios" TO "service_role";



GRANT ALL ON TABLE "public"."view_campaign_day_before" TO "anon";
GRANT ALL ON TABLE "public"."view_campaign_day_before" TO "authenticated";
GRANT ALL ON TABLE "public"."view_campaign_day_before" TO "service_role";



GRANT ALL ON TABLE "public"."view_campaign_summary" TO "anon";
GRANT ALL ON TABLE "public"."view_campaign_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."view_campaign_summary" TO "service_role";



GRANT ALL ON TABLE "public"."view_campaign_yesterday" TO "anon";
GRANT ALL ON TABLE "public"."view_campaign_yesterday" TO "authenticated";
GRANT ALL ON TABLE "public"."view_campaign_yesterday" TO "service_role";



GRANT ALL ON TABLE "public"."view_current_placement_bids" TO "anon";
GRANT ALL ON TABLE "public"."view_current_placement_bids" TO "authenticated";
GRANT ALL ON TABLE "public"."view_current_placement_bids" TO "service_role";



GRANT ALL ON TABLE "public"."view_data_update_7days" TO "anon";
GRANT ALL ON TABLE "public"."view_data_update_7days" TO "authenticated";
GRANT ALL ON TABLE "public"."view_data_update_7days" TO "service_role";



GRANT ALL ON TABLE "public"."view_data_update_day_before" TO "anon";
GRANT ALL ON TABLE "public"."view_data_update_day_before" TO "authenticated";
GRANT ALL ON TABLE "public"."view_data_update_day_before" TO "service_role";



GRANT ALL ON TABLE "public"."view_data_update_yesterday" TO "anon";
GRANT ALL ON TABLE "public"."view_data_update_yesterday" TO "authenticated";
GRANT ALL ON TABLE "public"."view_data_update_yesterday" TO "service_role";



GRANT ALL ON TABLE "public"."view_latest_data_dates" TO "anon";
GRANT ALL ON TABLE "public"."view_latest_data_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."view_latest_data_dates" TO "service_role";



GRANT ALL ON TABLE "public"."view_placement_30_days" TO "anon";
GRANT ALL ON TABLE "public"."view_placement_30_days" TO "authenticated";
GRANT ALL ON TABLE "public"."view_placement_30_days" TO "service_role";



GRANT ALL ON TABLE "public"."view_placement_7_days" TO "anon";
GRANT ALL ON TABLE "public"."view_placement_7_days" TO "authenticated";
GRANT ALL ON TABLE "public"."view_placement_7_days" TO "service_role";



GRANT ALL ON TABLE "public"."view_placement_optimization_report" TO "anon";
GRANT ALL ON TABLE "public"."view_placement_optimization_report" TO "authenticated";
GRANT ALL ON TABLE "public"."view_placement_optimization_report" TO "service_role";



GRANT ALL ON TABLE "public"."view_portfolio_lookup" TO "anon";
GRANT ALL ON TABLE "public"."view_portfolio_lookup" TO "authenticated";
GRANT ALL ON TABLE "public"."view_portfolio_lookup" TO "service_role";



GRANT ALL ON TABLE "public"."view_tos_impression_share" TO "anon";
GRANT ALL ON TABLE "public"."view_tos_impression_share" TO "authenticated";
GRANT ALL ON TABLE "public"."view_tos_impression_share" TO "service_role";



GRANT ALL ON TABLE "public"."view_usa_placement_data" TO "anon";
GRANT ALL ON TABLE "public"."view_usa_placement_data" TO "authenticated";
GRANT ALL ON TABLE "public"."view_usa_placement_data" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_campaign_performance" TO "anon";
GRANT ALL ON TABLE "public"."weekly_campaign_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_campaign_performance" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_placement_bids" TO "anon";
GRANT ALL ON TABLE "public"."weekly_placement_bids" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_placement_bids" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_placement_performance" TO "anon";
GRANT ALL ON TABLE "public"."weekly_placement_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_placement_performance" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_portfolios" TO "anon";
GRANT ALL ON TABLE "public"."weekly_portfolios" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_portfolios" TO "service_role";



GRANT ALL ON TABLE "public"."view_weekly_placement_report" TO "authenticated";
GRANT ALL ON TABLE "public"."view_weekly_placement_report" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."weekly_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_snapshots" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































