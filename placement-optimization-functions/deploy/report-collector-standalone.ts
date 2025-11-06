// =====================================================
// Report Collector - Standalone Version for Dashboard Deployment
// =====================================================
// Amazon Ads API integration with OAuth token management
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface CollectorRequest {
  execution_id: string
  dry_run?: boolean
  profile_id?: string
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
    console.log('📊 Report Collector started')

    const body: CollectorRequest = await req.json()
    const { execution_id, dry_run = false, profile_id } = body

    if (!execution_id) {
      throw new Error('Missing execution_id')
    }

    console.log(`Execution ID: ${execution_id}`)
    console.log(`Dry Run: ${dry_run}`)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get Amazon Ads credentials from vault
    console.log('🔐 Retrieving credentials from vault...')
    const { data: credentials, error: vaultError } = await supabase.rpc('get_amazon_ads_credentials')

    if (vaultError || !credentials || credentials.length === 0) {
      throw new Error(`Failed to retrieve credentials: ${vaultError?.message || 'No credentials found'}`)
    }

    const { client_id, client_secret, refresh_token } = credentials[0]
    console.log('✅ Credentials retrieved')

    // Get access token
    console.log('🔑 Refreshing access token...')
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: client_id,
        client_secret: client_secret
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Token refresh failed: ${tokenResponse.status} - ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    console.log('✅ Access token obtained')

    // Get profile ID
    let targetProfileId = profile_id

    if (!targetProfileId) {
      console.log('🔍 Fetching profiles...')
      const profilesResponse = await fetch('https://advertising-api.amazon.com/v2/profiles', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Amazon-Advertising-API-ClientId': client_id,
          'Content-Type': 'application/json'
        }
      })

      if (!profilesResponse.ok) {
        throw new Error(`Failed to fetch profiles: ${profilesResponse.status}`)
      }

      const profiles = await profilesResponse.json()

      if (!profiles || profiles.length === 0) {
        throw new Error('No profiles found')
      }

      targetProfileId = String(profiles[0].profileId)
      console.log(`✅ Using profile: ${targetProfileId} (${profiles[0].accountInfo?.name || 'Unknown'})`)
    }

    // Fetch portfolios
    console.log('📁 Fetching portfolios...')
    const portfoliosResponse = await fetch('https://advertising-api.amazon.com/v2/portfolios/extended', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Amazon-Advertising-API-ClientId': client_id,
        'Amazon-Advertising-API-Scope': targetProfileId,
        'Content-Type': 'application/json'
      }
    })

    if (!portfoliosResponse.ok) {
      throw new Error(`Failed to fetch portfolios: ${portfoliosResponse.status}`)
    }

    const portfolios = await portfoliosResponse.json()
    console.log(`✅ Found ${portfolios.length} portfolios`)

    // Insert portfolios into database
    if (!dry_run && portfolios.length > 0) {
      const { error: portfolioError } = await supabase
        .from('portfolios')
        .upsert(
          portfolios.map((p: any) => ({
            portfolio_id: String(p.portfolioId),
            portfolio_name: p.name,
            portfolio_state: p.state,
            in_budget: p.inBudget
          })),
          { onConflict: 'portfolio_id' }
        )

      if (portfolioError) {
        throw new Error(`Failed to insert portfolios: ${portfolioError.message}`)
      }

      console.log(`✅ Inserted ${portfolios.length} portfolios`)
    }

    // Request reports
    console.log('📋 Requesting reports from Amazon Ads API...')

    const today = new Date().toISOString().split('T')[0]

    const reportRequests = [
      { type: 'placement_30day', name: 'Placement Performance - 30 Day', segment: 'placement' },
      { type: 'placement_7day', name: 'Placement Performance - 7 Day', segment: 'placement' },
      { type: 'campaign_30day', name: 'Campaign Performance - 30 Day', segment: null },
      { type: 'campaign_7day', name: 'Campaign Performance - 7 Day', segment: null },
      { type: 'campaign_yesterday', name: 'Campaign Performance - Yesterday', segment: null },
      { type: 'campaign_day_before', name: 'Campaign Performance - Day Before', segment: null }
    ]

    const reportIds = []

    for (const report of reportRequests) {
      console.log(`📊 Requesting ${report.name}...`)

      const reportBody: any = {
        reportDate: today,
        metrics: [
          'campaignId',
          'campaignName',
          'impressions',
          'clicks',
          'cost',
          'purchases7d',
          'sales7d',
          'purchases14d',
          'sales14d',
          'purchases30d',
          'sales30d'
        ],
        timeUnit: 'SUMMARY'
      }

      if (report.segment === 'placement') {
        reportBody.segment = 'placement'
        reportBody.metrics.push('placement')
        reportBody.groupBy = ['placement']
      } else {
        reportBody.metrics.push('topOfSearchImpressionShare')
      }

      const reportResponse = await fetch('https://advertising-api.amazon.com/v2/sp/reports', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Amazon-Advertising-API-ClientId': client_id,
          'Amazon-Advertising-API-Scope': targetProfileId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportBody)
      })

      if (!reportResponse.ok) {
        const errorText = await reportResponse.text()
        throw new Error(`Failed to request ${report.name}: ${reportResponse.status} - ${errorText}`)
      }

      const reportData = await reportResponse.json()
      reportIds.push({
        type: report.type,
        id: reportData.reportId,
        name: report.name
      })

      console.log(`✅ ${report.name} requested: ${reportData.reportId}`)

      // Store report request in database
      if (!dry_run) {
        await supabase.from('report_requests').insert({
          execution_id,
          report_id: reportData.reportId,
          report_name: report.name,
          report_type: report.type,
          status: 'PENDING'
        })
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log('✅ All reports requested successfully')

    return new Response(
      JSON.stringify({
        success: true,
        execution_id,
        profile_id: targetProfileId,
        portfolios_count: portfolios.length,
        reports_requested: reportIds.length,
        report_ids: reportIds,
        message: 'Reports requested successfully. Download and processing will happen in background.'
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
    console.error('❌ Report collection failed:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error)
        }
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
