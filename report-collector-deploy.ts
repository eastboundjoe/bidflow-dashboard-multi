import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

  async post(url, body, headers = {}) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Amazon-Advertising-API-ClientId': this.config.clientId,
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API POST failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}

// =====================================================
// SECTION 4: MAIN REPORT-COLLECTOR LOGIC
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
    console.log("Report Collector started");

    const body = await req.json();
    const { execution_id, dry_run = false, profile_id } = body;

    if (!execution_id) {
      throw new Error('Missing execution_id');
    }

    console.log(`Execution ID: ${execution_id}`);
    console.log(`Dry Run: ${dry_run}`);

    const supabase = createSupabaseClient();
    const amazonClient = new AmazonAdsClient();

    // Create workflow execution record
    if (!dry_run) {
      const { error: workflowError } = await supabase
        .from('workflow_executions')
        .insert({
          execution_id,
          status: 'RUNNING',
          started_at: new Date().toISOString()
        });

      if (workflowError) {
        throw new Error(`Failed to create workflow execution: ${workflowError.message}`);
      }
    }

    let targetProfileId = profile_id;

    if (!targetProfileId) {
      console.log('Fetching profiles...');
      const profiles = await amazonClient.get('https://advertising-api.amazon.com/v2/profiles');

      if (!profiles || profiles.length === 0) {
        throw new Error('No profiles found');
      }

      targetProfileId = String(profiles[0].profileId);
      console.log(`Using profile: ${targetProfileId} (${profiles[0].accountInfo?.name || 'Unknown'})`);
    }

    console.log('Fetching portfolios...');
    const portfolios = await amazonClient.post(
      'https://advertising-api.amazon.com/portfolios/list',
      {
        stateFilter: { include: ['ENABLED'] },
        includeExtendedDataFields: true
      },
      {
        'Amazon-Advertising-API-Scope': targetProfileId,
        'Accept': 'application/vnd.spcampaign.v3+json',
        'Content-Type': 'application/vnd.spcampaign.v3+json'
      }
    );

    const portfolioList = portfolios.portfolios || [];
    const enabledPortfolios = portfolioList.filter((p: any) => p.state === 'ENABLED');

    console.log(`Found ${portfolioList.length} total portfolios (${enabledPortfolios.length} enabled)`);

    if (!dry_run && enabledPortfolios.length > 0) {
      const { error: portfolioError } = await supabase
        .from('portfolios')
        .upsert(
          enabledPortfolios.map((p: any) => ({
            portfolio_id: String(p.portfolioId),
            portfolio_name: p.name,
            portfolio_state: p.state,
            in_budget: p.inBudget
          })),
          { onConflict: 'portfolio_id' }
        );

      if (portfolioError) {
        throw new Error(`Failed to insert portfolios: ${portfolioError.message}`);
      }

      console.log(`Inserted ${enabledPortfolios.length} enabled portfolios`);
    }

    console.log('Requesting reports...');

    const today = new Date().toISOString().split('T')[0];
    const startDate30 = new Date(Date.now() - 33 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate7 = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dayBefore = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reportRequests = [
      {
        type: 'placement_30day',
        name: `SP-Placement-30Days-${today}`,
        startDate: startDate30,
        endDate: endDate,
        groupBy: ['campaign', 'campaignPlacement'],
        columns: ['campaignId', 'campaignName', 'campaignStatus', 'campaignBudgetAmount', 'placementClassification', 'impressions', 'clicks', 'spend', 'purchases30d', 'sales30d']
      },
      {
        type: 'placement_7day',
        name: `SP-Placement-7Days-${today}`,
        startDate: startDate7,
        endDate: endDate,
        groupBy: ['campaign', 'campaignPlacement'],
        columns: ['campaignId', 'campaignName', 'campaignStatus', 'placementClassification', 'clicks', 'spend', 'purchases7d', 'sales7d']
      },
      {
        type: 'campaign_30day',
        name: `SP-Campaign-30Days`,
        startDate: startDate30,
        endDate: endDate,
        groupBy: ['campaign'],
        columns: ['campaignId', 'campaignName', 'campaignBudgetAmount', 'impressions', 'clicks', 'spend', 'purchases30d', 'sales30d', 'purchases14d', 'sales14d', 'purchases7d', 'sales7d', 'topOfSearchImpressionShare', 'campaignStatus']
      },
      {
        type: 'campaign_7day',
        name: `SP-Campaign-7Days`,
        startDate: startDate7,
        endDate: endDate,
        groupBy: ['campaign'],
        columns: ['campaignId', 'campaignName', 'campaignBudgetAmount', 'impressions', 'clicks', 'spend', 'purchases7d', 'sales7d', 'purchases14d', 'sales14d', 'purchases30d', 'sales30d', 'topOfSearchImpressionShare', 'campaignStatus']
      },
      {
        type: 'campaign_yesterday',
        name: `SP-Campaign-Yesterday-${today}`,
        startDate: yesterday,
        endDate: yesterday,
        groupBy: ['campaign'],
        columns: ['campaignId', 'campaignName', 'campaignBudgetAmount', 'topOfSearchImpressionShare', 'date', 'campaignStatus', 'spend']
      },
      {
        type: 'campaign_day_before',
        name: `SP-Campaign-DayBefore-${today}`,
        startDate: dayBefore,
        endDate: dayBefore,
        groupBy: ['campaign'],
        columns: ['campaignId', 'campaignName', 'campaignBudgetAmount', 'campaignStatus', 'date', 'spend']
      }
    ];

    const reportIds = [];

    for (const report of reportRequests) {
      console.log(`Requesting ${report.name}...`);

      const reportBody = {
        name: report.name,
        startDate: report.startDate,
        endDate: report.endDate,
        configuration: {
          adProduct: 'SPONSORED_PRODUCTS',
          reportTypeId: 'spCampaigns',
          timeUnit: report.startDate === report.endDate ? 'DAILY' : 'SUMMARY',
          format: 'GZIP_JSON',
          groupBy: report.groupBy,
          columns: report.columns
        }
      };

      const reportResponse = await amazonClient.post(
        'https://advertising-api.amazon.com/reporting/reports',
        reportBody,
        {
          'Amazon-Advertising-API-Scope': targetProfileId,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      );

      reportIds.push({
        type: report.type,
        id: reportResponse.reportId,
        name: report.name
      });

      console.log(`${report.name} requested: ${reportResponse.reportId}`);

      if (!dry_run) {
        const { error: insertError } = await supabase.from('report_requests').insert({
          execution_id,
          report_id: reportResponse.reportId,
          report_name: report.name,
          report_type: report.type,
          status: 'PENDING'
        });

        if (insertError) {
          console.error(`Failed to insert report request: ${insertError.message}`);
          throw new Error(`Database insert failed: ${insertError.message}`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('All reports requested successfully');

    // Update workflow execution status
    if (!dry_run) {
      await supabase
        .from('workflow_executions')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('execution_id', execution_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        execution_id,
        profile_id: targetProfileId,
        portfolios_count: enabledPortfolios.length,
        reports_requested: reportIds.length,
        report_ids: reportIds,
        message: 'Reports requested successfully. Download and processing will happen in background.'
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
    console.error("Report collection failed:", err);

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
