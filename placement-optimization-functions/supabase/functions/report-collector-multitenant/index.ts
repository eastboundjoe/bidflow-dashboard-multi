// =====================================================
// Report Collector - Multi-Tenant Version
// =====================================================
// Collects data from Amazon Ads API for a specific tenant
// 1. Fetches portfolios
// 2. Fetches campaigns with placement bids
// 3. Requests campaign and placement reports
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient, getAmazonAdsCredentials } from '../_shared/supabase-client-multitenant.ts'
import { AmazonAdsClient } from '../_shared/amazon-ads-client-multitenant.ts'
import { formatError, WorkflowError } from '../_shared/errors.ts'

interface CollectorRequest {
  execution_id: string
  tenant_id: string
  amazon_ads_account_id: string
  dry_run?: boolean
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    })
  }

  try {
    console.log('📊 Report Collector (Multi-Tenant) started')

    // Parse request
    const body: CollectorRequest = await req.json()
    const { execution_id, tenant_id, amazon_ads_account_id, dry_run = false } = body

    if (!execution_id || !tenant_id || !amazon_ads_account_id) {
      throw new WorkflowError(
        'Missing required parameters: execution_id, tenant_id, amazon_ads_account_id',
        'MISSING_PARAMS'
      )
    }

    console.log(`Execution ID: ${execution_id}`)
    console.log(`Tenant ID: ${tenant_id}`)
    console.log(`Account ID: ${amazon_ads_account_id}`)
    console.log(`Dry Run: ${dry_run}`)

    const supabase = createSupabaseClient()

    // Get Amazon Ads credentials for this account
    console.log('🔐 Retrieving encrypted credentials...')
    const credentials = await getAmazonAdsCredentials(amazon_ads_account_id)

    // Get account details (profile_id)
    const { data: account, error: accountError } = await supabase
      .from('amazon_ads_accounts')
      .select('profile_id, account_name')
      .eq('id', amazon_ads_account_id)
      .single()

    if (accountError || !account) {
      throw new WorkflowError(
        `Failed to get account details: ${accountError?.message}`,
        'ACCOUNT_NOT_FOUND'
      )
    }

    const profileId = account.profile_id
    console.log(`Profile ID: ${profileId} (${account.account_name})`)

    // Initialize Amazon Ads API client
    const amazonClient = new AmazonAdsClient(
      credentials.client_id,
      credentials.client_secret,
      credentials.refresh_token
    )

    // Step 1: Fetch portfolios
    console.log('📂 Fetching portfolios...')
    const portfolios = await amazonClient.post(
      'https://advertising-api.amazon.com/portfolios/list',
      {
        stateFilter: { include: ['ENABLED'] },
        includeExtendedDataFields: true
      },
      {
        'Amazon-Advertising-API-Scope': profileId,
        'Accept': 'application/vnd.spcampaign.v3+json',
        'Content-Type': 'application/vnd.spcampaign.v3+json'
      }
    )

    const portfolioList = portfolios.portfolios || []
    const enabledPortfolios = portfolioList.filter((p: any) => p.state === 'ENABLED')

    console.log(`Found ${portfolioList.length} total portfolios (${enabledPortfolios.length} enabled)`)

    // Insert portfolios
    if (!dry_run && enabledPortfolios.length > 0) {
      const { error: portfolioError } = await supabase
        .from('portfolios')
        .upsert(
          enabledPortfolios.map((p: any) => ({
            tenant_id,
            amazon_ads_account_id,
            portfolio_id: String(p.portfolioId),
            portfolio_name: p.name,
            portfolio_state: p.state,
            in_budget: p.inBudget
          })),
          { onConflict: 'tenant_id,portfolio_id' }
        )

      if (portfolioError) {
        throw new WorkflowError(
          `Failed to insert portfolios: ${portfolioError.message}`,
          'PORTFOLIO_INSERT_FAILED'
        )
      }

      console.log(`✅ Inserted ${enabledPortfolios.length} portfolios`)
    }

    // Step 2: Fetch campaigns with placement bids
    console.log('📋 Fetching campaigns...')
    const campaignsResponse = await amazonClient.post(
      'https://advertising-api.amazon.com/sp/campaigns/list',
      {
        stateFilter: { include: ['ENABLED'] },
        includeExtendedDataFields: true
      },
      {
        'Amazon-Advertising-API-Scope': profileId,
        'Accept': 'application/vnd.spcampaign.v3+json',
        'Content-Type': 'application/vnd.spcampaign.v3+json'
      }
    )

    const campaignsList = campaignsResponse.campaigns || []
    console.log(`Found ${campaignsList.length} enabled campaigns`)

    // Insert campaigns
    if (!dry_run && campaignsList.length > 0) {
      const campaignRecords = campaignsList.map((c: any) => {
        // Extract placement bid adjustments
        let bidTop = 0
        let bidRest = 0
        let bidProduct = 0

        if (c.dynamicBidding?.placementBidding) {
          for (const pb of c.dynamicBidding.placementBidding) {
            if (pb.placement === 'PLACEMENT_TOP') bidTop = pb.percentage || 0
            if (pb.placement === 'PLACEMENT_REST_OF_SEARCH') bidRest = pb.percentage || 0
            if (pb.placement === 'PLACEMENT_PRODUCT_PAGE') bidProduct = pb.percentage || 0
          }
        }

        return {
          tenant_id,
          amazon_ads_account_id,
          campaign_id: String(c.campaignId),
          campaign_name: c.name || `Campaign ${c.campaignId}`,
          campaign_status: c.state || 'UNKNOWN',
          portfolio_id: c.portfolioId ? String(c.portfolioId) : null,
          daily_budget: c.budget?.budget || 0,
          bid_top_of_search: bidTop,
          bid_rest_of_search: bidRest,
          bid_product_page: bidProduct,
          targeting_type: c.targetingType || null,
          start_date: c.startDate || null
        }
      })

      const { error: campaignError } = await supabase
        .from('campaigns')
        .upsert(campaignRecords, { onConflict: 'tenant_id,campaign_id' })

      if (campaignError) {
        throw new WorkflowError(
          `Failed to insert campaigns: ${campaignError.message}`,
          'CAMPAIGN_INSERT_FAILED'
        )
      }

      console.log(`✅ Inserted ${campaignRecords.length} campaigns`)
    }

    // Step 3: Request reports
    console.log('📊 Requesting reports...')

    const today = new Date().toISOString().split('T')[0]
    const startDate30 = new Date(Date.now() - 33 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const startDate7 = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const reportRequests = [
      {
        name: 'Campaign Performance - 30 Day',
        period_type: '30day',
        report_type: 'campaigns',
        metrics: 'impressions,clicks,cost,purchases30d,sales30d,kindleEditionNormalizedPagesRead14d,kindleEditionNormalizedPagesRoyalties14d,topOfSearchImpressionShare',
        start_date: startDate30,
        end_date: today
      },
      {
        name: 'Campaign Performance - 7 Day',
        period_type: '7day',
        report_type: 'campaigns',
        metrics: 'impressions,clicks,cost,purchases7d,sales7d,kindleEditionNormalizedPagesRead14d,kindleEditionNormalizedPagesRoyalties14d,topOfSearchImpressionShare',
        start_date: startDate7,
        end_date: today
      },
      {
        name: 'Campaign Performance - Yesterday',
        period_type: 'yesterday',
        report_type: 'campaigns',
        metrics: 'impressions,clicks,cost,topOfSearchImpressionShare',
        start_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      },
      {
        name: 'Placement Report - 30 Day',
        period_type: '30day',
        report_type: 'placements',
        metrics: 'impressions,clicks,cost,purchases30d,sales30d',
        start_date: startDate30,
        end_date: today
      },
      {
        name: 'Placement Report - 7 Day',
        period_type: '7day',
        report_type: 'placements',
        metrics: 'impressions,clicks,cost,purchases7d,sales7d',
        start_date: startDate7,
        end_date: today
      }
    ]

    const reportIds: string[] = []

    for (const reportConfig of reportRequests) {
      console.log(`Requesting: ${reportConfig.name}`)

      if (dry_run) {
        console.log(`  [DRY RUN] Would request ${reportConfig.report_type} report`)
        continue
      }

      try {
        const reportResponse = await amazonClient.post(
          'https://advertising-api.amazon.com/reporting/reports',
          {
            name: reportConfig.name,
            startDate: reportConfig.start_date,
            endDate: reportConfig.end_date,
            configuration: {
              adProduct: 'SPONSORED_PRODUCTS',
              groupBy: reportConfig.report_type === 'placements' ? ['placement'] : ['campaign'],
              columns: reportConfig.metrics.split(','),
              reportTypeId: reportConfig.report_type === 'placements'
                ? 'spPlacement'
                : 'spCampaigns',
              timeUnit: 'SUMMARY',
              format: 'GZIP_JSON'
            }
          },
          {
            'Amazon-Advertising-API-Scope': profileId,
            'Accept': 'application/vnd.createasyncreportrequest.v3+json',
            'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
          }
        )

        const reportId = reportResponse.reportId

        if (!reportId) {
          console.error(`  ❌ No reportId returned for ${reportConfig.name}`)
          continue
        }

        console.log(`  ✅ Report requested: ${reportId}`)
        reportIds.push(reportId)

        // Insert report_requests record
        const { error: reportError } = await supabase
          .from('report_requests')
          .insert({
            tenant_id,
            amazon_ads_account_id,
            workflow_id: execution_id,
            report_request_id: reportId,
            report_type: reportConfig.report_type,
            period_type: reportConfig.period_type,
            start_date: reportConfig.start_date,
            end_date: reportConfig.end_date,
            status: 'PENDING'
          })

        if (reportError) {
          console.error(`  ❌ Failed to insert report_requests: ${reportError.message}`)
        }

      } catch (reportError) {
        console.error(`  ❌ Failed to request ${reportConfig.name}:`, reportError)
      }
    }

    console.log(`✅ Requested ${reportIds.length} reports`)

    // Update last_sync_at for account
    if (!dry_run) {
      await supabase
        .from('amazon_ads_accounts')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', amazon_ads_account_id)
    }

    console.log('🎉 Data collection completed!')

    return new Response(
      JSON.stringify({
        success: true,
        execution_id,
        tenant_id,
        amazon_ads_account_id,
        portfolios_collected: enabledPortfolios.length,
        campaigns_collected: campaignsList.length,
        reports_requested: reportIds.length,
        report_ids: reportIds
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('❌ Collection failed:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: formatError(error)
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
