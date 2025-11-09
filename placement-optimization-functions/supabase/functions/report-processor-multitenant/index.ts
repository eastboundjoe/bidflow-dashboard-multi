// =====================================================
// Report Processor - Multi-Tenant Version
// =====================================================
// Downloads and processes completed Amazon Ads reports for a specific tenant
// Runs periodically (e.g., every 5 minutes via pg_cron or manual trigger)
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { gunzip } from 'https://deno.land/x/denoflate@1.2.1/mod.ts'
import { createSupabaseClient, getAmazonAdsCredentials } from '../_shared/supabase-client-multitenant.ts'
import { AmazonAdsClient } from '../_shared/amazon-ads-client.ts'
import { formatError, WorkflowError } from '../_shared/errors.ts'

interface ProcessorRequest {
  tenant_id?: string  // Optional - processes all tenants if not specified
  amazon_ads_account_id?: string  // Optional - processes all accounts for tenant if not specified
  max_reports?: number  // Optional - max reports to process per execution (default: 100)
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
    console.log('⚙️  Report Processor (Multi-Tenant) started')

    // Parse request (optional filtering)
    const body: ProcessorRequest = await req.json().catch(() => ({}))
    const { tenant_id, amazon_ads_account_id, max_reports = 100 } = body

    console.log(`Filters - Tenant: ${tenant_id || 'ALL'}, Account: ${amazon_ads_account_id || 'ALL'}, Max Reports: ${max_reports}`)

    const supabase = createSupabaseClient()

    // Query pending report requests
    let query = supabase
      .from('report_requests')
      .select('id, tenant_id, amazon_ads_account_id, report_request_id, report_type, period_type, start_date, end_date, status')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(max_reports)

    if (tenant_id) {
      query = query.eq('tenant_id', tenant_id)
    }

    if (amazon_ads_account_id) {
      query = query.eq('amazon_ads_account_id', amazon_ads_account_id)
    }

    const { data: pendingReports, error: queryError } = await query

    if (queryError) {
      throw new WorkflowError(
        `Failed to query pending reports: ${queryError.message}`,
        'QUERY_FAILED'
      )
    }

    if (!pendingReports || pendingReports.length === 0) {
      console.log('✅ No pending reports to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending reports',
          processed_count: 0
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Found ${pendingReports.length} pending reports`)

    let processedCount = 0
    let completedCount = 0
    let failedCount = 0

    // Group reports by amazon_ads_account_id to minimize credential fetches
    const reportsByAccount = new Map<string, typeof pendingReports>()
    for (const report of pendingReports) {
      const accountReports = reportsByAccount.get(report.amazon_ads_account_id) || []
      accountReports.push(report)
      reportsByAccount.set(report.amazon_ads_account_id, accountReports)
    }

    // Process each account's reports
    for (const [accountId, reports] of reportsByAccount) {
      console.log(`\n📂 Processing ${reports.length} reports for account: ${accountId}`)

      try {
        // Get credentials for this account
        const credentials = await getAmazonAdsCredentials(accountId)

        // Get account details
        const { data: account } = await supabase
          .from('amazon_ads_accounts')
          .select('profile_id, account_name')
          .eq('id', accountId)
          .single()

        if (!account) {
          console.error(`  ❌ Account not found: ${accountId}`)
          continue
        }

        // Initialize Amazon Ads client for this account
        const amazonClient = new AmazonAdsClient(
          credentials.client_id,
          credentials.client_secret,
          credentials.refresh_token
        )

        // Process each report
        for (const report of reports) {
          try {
            console.log(`  📊 Processing report: ${report.report_request_id} (${report.report_type}, ${report.period_type})`)

            // Check report status
            const reportStatus = await amazonClient.get(
              `https://advertising-api.amazon.com/reporting/reports/${report.report_request_id}`,
              {
                'Amazon-Advertising-API-Scope': account.profile_id,
                'Accept': 'application/vnd.createasyncreportrequest.v3+json'
              }
            )

            console.log(`    Status: ${reportStatus.status}`)

            if (reportStatus.status === 'COMPLETED') {
              // Download report
              const downloadUrl = reportStatus.url

              if (!downloadUrl) {
                throw new Error('No download URL in completed report')
              }

              console.log(`    Downloading from: ${downloadUrl}`)
              const reportData = await fetch(downloadUrl)

              if (!reportData.ok) {
                throw new Error(`Download failed: ${reportData.status}`)
              }

              // Decompress GZIP
              const compressedData = new Uint8Array(await reportData.arrayBuffer())
              const decompressed = gunzip(compressedData)
              const reportJson = JSON.parse(new TextDecoder().decode(decompressed))

              console.log(`    Downloaded ${reportJson.length} rows`)

              // Process based on report type
              if (report.report_type === 'campaigns') {
                await processCampaignReport(
                  supabase,
                  reportJson,
                  report.tenant_id,
                  report.amazon_ads_account_id,
                  report.period_type,
                  report.start_date,
                  report.end_date
                )
              } else if (report.report_type === 'placements') {
                await processPlacementReport(
                  supabase,
                  reportJson,
                  report.tenant_id,
                  report.amazon_ads_account_id,
                  report.period_type,
                  report.start_date,
                  report.end_date
                )
              }

              // Mark report as completed
              await supabase
                .from('report_requests')
                .update({
                  status: 'COMPLETED',
                  processed_at: new Date().toISOString()
                })
                .eq('id', report.id)

              console.log(`    ✅ Processed successfully`)
              completedCount++

            } else if (reportStatus.status === 'FAILED' || reportStatus.status === 'FATAL') {
              // Mark as failed
              await supabase
                .from('report_requests')
                .update({
                  status: 'FAILED',
                  processed_at: new Date().toISOString()
                })
                .eq('id', report.id)

              console.log(`    ❌ Report failed: ${reportStatus.status}`)
              failedCount++

            } else {
              // Still IN_PROGRESS, skip for now
              console.log(`    ⏳ Still processing...`)
            }

            processedCount++

          } catch (reportError) {
            console.error(`    ❌ Error processing report: ${reportError}`)
            failedCount++

            // Mark as failed
            await supabase
              .from('report_requests')
              .update({
                status: 'FAILED',
                processed_at: new Date().toISOString(),
                error_message: reportError.message?.substring(0, 500)
              })
              .eq('id', report.id)
          }
        }

      } catch (accountError) {
        console.error(`  ❌ Error processing account ${accountId}:`, accountError)
        failedCount += reports.length
      }
    }

    console.log(`\n✅ Processing complete`)
    console.log(`   Processed: ${processedCount}`)
    console.log(`   Completed: ${completedCount}`)
    console.log(`   Failed: ${failedCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        completed_count: completedCount,
        failed_count: failedCount
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
    console.error('❌ Processor failed:', error)

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

// =====================================================
// HELPER: Process Campaign Report
// =====================================================
async function processCampaignReport(
  supabase: any,
  reportData: any[],
  tenantId: string,
  accountId: string,
  periodType: string,
  startDate: string,
  endDate: string
) {
  if (!reportData || reportData.length === 0) {
    console.log('      No campaign data to process')
    return
  }

  const performanceRecords = reportData.map((row: any) => ({
    tenant_id: tenantId,
    amazon_ads_account_id: accountId,
    campaign_id: String(row.campaignId),
    period_type: periodType,
    report_date: startDate,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    spend: row.cost || 0,
    orders_7d: row.purchases7d || 0,
    sales_7d: row.sales7d || 0,
    orders_30d: row.purchases30d || 0,
    sales_30d: row.sales30d || 0,
    top_of_search_impression_share: row.topOfSearchImpressionShare || 0
  }))

  const { error } = await supabase
    .from('campaign_performance')
    .upsert(performanceRecords, {
      onConflict: 'tenant_id,campaign_id,period_type,report_date'
    })

  if (error) {
    throw new Error(`Failed to insert campaign performance: ${error.message}`)
  }

  console.log(`      ✅ Inserted ${performanceRecords.length} campaign performance rows`)
}

// =====================================================
// HELPER: Process Placement Report
// =====================================================
async function processPlacementReport(
  supabase: any,
  reportData: any[],
  tenantId: string,
  accountId: string,
  periodType: string,
  startDate: string,
  endDate: string
) {
  if (!reportData || reportData.length === 0) {
    console.log('      No placement data to process')
    return
  }

  const performanceRecords = reportData.map((row: any) => ({
    tenant_id: tenantId,
    amazon_ads_account_id: accountId,
    campaign_id: String(row.campaignId),
    placement: row.placement,
    period_type: periodType,
    report_date: startDate,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    spend: row.cost || 0,
    orders_7d: row.purchases7d || 0,
    sales_7d: row.sales7d || 0,
    orders_30d: row.purchases30d || 0,
    sales_30d: row.sales30d || 0
  }))

  const { error } = await supabase
    .from('placement_performance')
    .upsert(performanceRecords, {
      onConflict: 'tenant_id,campaign_id,placement,period_type,report_date'
    })

  if (error) {
    throw new Error(`Failed to insert placement performance: ${error.message}`)
  }

  console.log(`      ✅ Inserted ${performanceRecords.length} placement performance rows`)
}
