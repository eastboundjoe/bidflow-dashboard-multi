// =====================================================
// Report Generator - Multi-Tenant Version
// =====================================================
// Generates placement optimization report for a specific tenant
// Queries the view and optionally exports to Google Sheets
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../_shared/supabase-client-multitenant.ts'
import { formatError, WorkflowError } from '../_shared/errors.ts'

interface GeneratorRequest {
  execution_id?: string
  tenant_id: string
  amazon_ads_account_id?: string  // Optional - includes all accounts if not specified
  format?: 'json' | 'csv' | 'google_sheets'
  dry_run?: boolean
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    })
  }

  try {
    console.log('📈 Report Generator (Multi-Tenant) started')

    // Parse request
    const body: GeneratorRequest = await req.json()
    const { execution_id, tenant_id, amazon_ads_account_id, format = 'json', dry_run = false } = body

    if (!tenant_id) {
      throw new WorkflowError(
        'Missing required parameter: tenant_id',
        'MISSING_PARAMS'
      )
    }

    console.log(`Execution ID: ${execution_id || 'N/A'}`)
    console.log(`Tenant ID: ${tenant_id}`)
    console.log(`Account ID: ${amazon_ads_account_id || 'ALL'}`)
    console.log(`Format: ${format}`)
    console.log(`Dry Run: ${dry_run}`)

    const supabase = createSupabaseClient()

    // Get tenant details
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('name, slug')
      .eq('id', tenant_id)
      .single()

    if (tenantError || !tenant) {
      throw new WorkflowError(
        `Tenant not found: ${tenant_id}`,
        'TENANT_NOT_FOUND'
      )
    }

    console.log(`Tenant: ${tenant.name}`)

    // Query the view
    console.log('📊 Querying placement optimization report view...')

    let query = supabase
      .from('view_placement_optimization_report')
      .select('*')
      .eq('Tenant ID', tenant_id)

    if (amazon_ads_account_id) {
      // Filter by specific Amazon Ads account
      const { data: account } = await supabase
        .from('amazon_ads_accounts')
        .select('account_name')
        .eq('id', amazon_ads_account_id)
        .single()

      if (account) {
        query = query.eq('Amazon Account', account.account_name)
      }
    }

    const { data: reportData, error: queryError } = await query

    if (queryError) {
      throw new WorkflowError(
        `Failed to query report view: ${queryError.message}`,
        'QUERY_FAILED'
      )
    }

    if (!reportData || reportData.length === 0) {
      console.log('⚠️  No data found for this tenant')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No data available',
          tenant_id: tenant_id,
          row_count: 0,
          data: []
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`✅ Retrieved ${reportData.length} rows`)

    // Format response based on requested format
    if (format === 'json') {
      return new Response(
        JSON.stringify({
          success: true,
          tenant_id: tenant_id,
          tenant_name: tenant.name,
          row_count: reportData.length,
          data: reportData,
          generated_at: new Date().toISOString()
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (format === 'csv') {
      const csv = convertToCSV(reportData)
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="placement_optimization_${tenant.slug}_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    if (format === 'google_sheets') {
      // TODO: Implement Google Sheets export
      // For now, return JSON with instructions
      console.log('⚠️  Google Sheets export not yet implemented')

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Google Sheets export not yet implemented. Use CSV export and manually upload to Google Sheets.',
          tenant_id: tenant_id,
          row_count: reportData.length,
          csv_download_url: `/functions/v1/report-generator-multitenant?tenant_id=${tenant_id}&format=csv`
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    throw new WorkflowError(
      `Unsupported format: ${format}`,
      'INVALID_FORMAT'
    )

  } catch (error) {
    console.error('❌ Report generation failed:', error)

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
// HELPER: Convert JSON to CSV
// =====================================================
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return ''
  }

  // Get headers from first row
  const headers = Object.keys(data[0])

  // Create CSV header row
  const csvHeaders = headers.join(',')

  // Create CSV data rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]

      // Handle null/undefined
      if (value === null || value === undefined) {
        return ''
      }

      // Handle strings with commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }

      return value
    }).join(',')
  })

  return [csvHeaders, ...csvRows].join('\n')
}
