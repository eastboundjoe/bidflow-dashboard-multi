import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { gunzip } from 'https://deno.land/x/denoflate@1.2.1/mod.ts';

// =====================================================
// SECTION 1: CREDENTIALS HELPER
// =====================================================
function getAmazonAdsCredentials() {
  const clientId = Deno.env.get('AMAZON_ADS_CLIENT_ID');
  const clientSecret = Deno.env.get('AMAZON_ADS_CLIENT_SECRET');
  const refreshToken = Deno.env.get('AMAZON_ADS_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Amazon Ads credentials in environment');
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  };
}

// =====================================================
// SECTION 2: SUPABASE CLIENT
// =====================================================
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// =====================================================
// SECTION 3: AMAZON ADS API CLIENT
// =====================================================
class AmazonAdsClient {
  accessToken = null;
  tokenExpiresAt = null;
  config;

  constructor() {
    const credentials = getAmazonAdsCredentials();
    this.config = {
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      refreshToken: credentials.refresh_token
    };
  }

  async refreshAccessToken() {
    console.log("Refreshing access token...");
    const tokenUrl = 'https://api.amazon.com/auth/o2/token';
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
    console.log('Access token refreshed successfully');
  }

  async getAccessToken() {
    const now = Date.now();
    if (!this.accessToken || !this.tokenExpiresAt || this.tokenExpiresAt <= now) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }

  async get(url, headers = {}) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Amazon-Advertising-API-ClientId': this.config.clientId,
        'Content-Type': 'application/json',
        ...headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API GET failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  async downloadReport(url) {
    // Amazon report URLs are pre-signed S3 URLs - do NOT add Authorization headers
    const response = await fetch(url, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Report download failed: ${response.status} - ${errorText}`);
    }

    return await response.arrayBuffer();
  }
}

// =====================================================
// SECTION 4: REPORT PROCESSING LOGIC
// =====================================================

async function processPlacementReport(reportData: any[], reportType: string, supabase: any) {
  // Note: Campaigns should already exist from report-collector
  // If they don't, the foreign key constraint will fail, which is correct behavior

  const records = [];
  const today = new Date().toISOString().split('T')[0];

  // Map Amazon placement values to database values
  // Amazon uses "on-Amazon" suffix in their reporting API
  const placementMap = {
    'Top of Search on-Amazon': 'PLACEMENT_TOP',
    'Detail Page on-Amazon': 'PLACEMENT_PRODUCT_PAGE',
    'Other on-Amazon': 'PLACEMENT_REST_OF_SEARCH'
  };

  console.log(`Processing ${reportData.length} placement report rows`);

  for (const row of reportData) {
    if (!row.campaignId) {
      console.log('Skipping row: no campaignId');
      continue;
    }

    console.log(`Campaign ${row.campaignId}: placement="${row.placementClassification}"`);

    const placementValue = placementMap[row.placementClassification] || row.placementClassification;

    // Skip if placement value is not valid
    if (!['PLACEMENT_TOP', 'PLACEMENT_REST_OF_SEARCH', 'PLACEMENT_PRODUCT_PAGE'].includes(placementValue)) {
      console.log(`Skipping invalid placement: "${row.placementClassification}" (mapped to "${placementValue}")`);
      continue;
    }

    const record = {
      campaign_id: String(row.campaignId),
      placement: placementValue,
      period_type: reportType.includes('30day') ? '30day' : '7day',
      report_date: today,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      spend: row.spend || 0,
      orders_7d: row.purchases7d || 0,
      sales_7d: row.sales7d || 0,
      orders_30d: row.purchases30d || 0,
      sales_30d: row.sales30d || 0
    };

    records.push(record);
  }

  if (records.length > 0) {
    const { error } = await supabase
      .from('placement_performance')
      .upsert(records, {
        onConflict: 'campaign_id,placement,period_type,report_date'
      });

    if (error) {
      throw new Error(`Failed to insert placement data: ${error.message}`);
    }
  }

  return records.length;
}

async function processCampaignReport(reportData: any[], reportType: string, supabase: any) {
  // Note: Campaigns should already exist from report-collector
  // If they don't, the foreign key constraint will fail, which is correct behavior

  const records = [];

  for (const row of reportData) {
    if (!row.campaignId) continue;

    const record = {
      campaign_id: String(row.campaignId),
      period_type: reportType.includes('30day') ? '30day' :
                   reportType.includes('7day') ? '7day' :
                   reportType.includes('yesterday') ? 'yesterday' : 'day_before',
      report_date: row.date || new Date().toISOString().split('T')[0],
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      spend: row.spend || 0,
      orders_7d: row.purchases7d || 0,
      sales_7d: row.sales7d || 0,
      orders_14d: row.purchases14d || 0,
      sales_14d: row.sales14d || 0,
      orders_30d: row.purchases30d || 0,
      sales_30d: row.sales30d || 0,
      top_of_search_impression_share: row.topOfSearchImpressionShare || 0
    };

    records.push(record);
  }

  if (records.length > 0) {
    const { error } = await supabase
      .from('campaign_performance')
      .upsert(records, {
        onConflict: 'campaign_id,period_type,report_date'
      });

    if (error) {
      throw new Error(`Failed to insert campaign data: ${error.message}`);
    }
  }

  return records.length;
}

// =====================================================
// SECTION 5: MAIN REPORT-PROCESSOR LOGIC
// =====================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  try {
    console.log("Report Processor started");

    const body = await req.json();
    const { execution_id, profile_id = '1279339718510959' } = body;

    const supabase = createSupabaseClient();
    const amazonClient = new AmazonAdsClient();

    // Fetch pending reports
    let query = supabase
      .from('report_requests')
      .select('*')
      .eq('status', 'PENDING');

    if (execution_id) {
      query = query.eq('execution_id', execution_id);
    }

    const { data: pendingReports, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch pending reports: ${fetchError.message}`);
    }

    console.log(`Found ${pendingReports?.length || 0} pending reports`);

    const results = {
      checked: 0,
      downloaded: 0,
      processed: 0,
      still_pending: 0,
      failed: 0,
      details: []
    };

    for (const report of pendingReports || []) {
      try {
        results.checked++;
        console.log(`Checking report: ${report.report_name} (${report.report_id})`);

        // Check report status
        const reportStatus = await amazonClient.get(
          `https://advertising-api.amazon.com/reporting/reports/${report.report_id}`,
          { 'Amazon-Advertising-API-Scope': profile_id }
        );

        console.log(`Report status: ${reportStatus.status}`);

        if (reportStatus.status === 'COMPLETED') {
          // Download the report
          console.log(`Downloading report from: ${reportStatus.url}`);
          const gzipData = await amazonClient.downloadReport(reportStatus.url);
          results.downloaded++;

          // Decompress GZIP
          const decompressed = gunzip(new Uint8Array(gzipData));
          const jsonText = new TextDecoder().decode(decompressed);
          const reportData = JSON.parse(jsonText);

          console.log(`Report contains ${reportData.length} records`);

          // Process based on report type
          let rowsProcessed = 0;
          if (report.report_type.includes('placement')) {
            rowsProcessed = await processPlacementReport(reportData, report.report_type, supabase);
          } else {
            rowsProcessed = await processCampaignReport(reportData, report.report_type, supabase);
          }

          // Update report status to COMPLETED
          await supabase
            .from('report_requests')
            .update({
              status: 'COMPLETED',
              rows_processed: rowsProcessed,
              completed_at: new Date().toISOString()
            })
            .eq('id', report.id);

          results.processed++;
          results.details.push({
            report_name: report.report_name,
            status: 'SUCCESS',
            rows: rowsProcessed
          });

        } else if (reportStatus.status === 'FAILED') {
          // Mark as failed
          await supabase
            .from('report_requests')
            .update({
              status: 'FAILED',
              completed_at: new Date().toISOString()
            })
            .eq('id', report.id);

          results.failed++;
          results.details.push({
            report_name: report.report_name,
            status: 'FAILED'
          });

        } else {
          // Still pending
          results.still_pending++;
          results.details.push({
            report_name: report.report_name,
            status: reportStatus.status
          });
        }

        // Small delay between reports
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`Error processing report ${report.report_name}:`, err);
        results.failed++;
        results.details.push({
          report_name: report.report_name,
          status: 'ERROR',
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          checked: results.checked,
          downloaded: results.downloaded,
          processed: results.processed,
          still_pending: results.still_pending,
          failed: results.failed
        },
        details: results.details
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );

  } catch (err) {
    console.error("Report processing failed:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: err instanceof Error ? err.message : String(err)
        }
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
});
