// =====================================================
// Report Generator - Standalone Version for Dashboard Deployment
// =====================================================
// This version has all dependencies inlined for easy deployment
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface GeneratorRequest {
  execution_id: string
  dry_run?: boolean
  format?: 'json' | 'csv'
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
    console.log('📈 Report Generator started')

    const body: GeneratorRequest = req.method === 'POST'
      ? await req.json()
      : { execution_id: 'manual', dry_run: true }

    const { execution_id, dry_run = false, format = 'json' } = body

    if (!execution_id) {
      throw new Error('Missing execution_id')
    }

    console.log(`Execution ID: ${execution_id}`)
    console.log(`Dry Run: ${dry_run}`)
    console.log(`Format: ${format}`)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Query the placement optimization view
    console.log('🔍 Querying placement optimization report...')
    const { data, error } = await supabase
      .from('view_placement_optimization_report')
      .select('*')

    if (error) {
      throw new Error(`Failed to query report view: ${error.message}`)
    }

    if (!data || data.length === 0) {
      console.log('⚠️  No data found in report view')
      return new Response(
        JSON.stringify({
          success: true,
          execution_id,
          rows: 0,
          message: 'No data available to generate report'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    console.log(`✅ Retrieved ${data.length} rows from report view`)

    // Format data
    let formattedData: string | object

    if (format === 'csv') {
      console.log('📄 Formatting as CSV...')

      // Convert to CSV
      const headers = Object.keys(data[0])
      const csvHeaders = headers.join(',')
      const csvRows = data.map(row => {
        return headers.map(header => {
          const value = row[header]
          if (value === null || value === undefined) return ''
          if (typeof value === 'number') return value.toString()
          const stringValue = String(value)
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }).join(',')
      })
      formattedData = [csvHeaders, ...csvRows].join('\n')
    } else {
      console.log('📋 Formatting as JSON...')
      formattedData = data
    }

    console.log(`✅ Report generated with ${data.length} rows`)

    const response = {
      success: true,
      execution_id,
      rows: data.length,
      format,
      data: formattedData,
      generated_at: new Date().toISOString(),
      message: dry_run
        ? 'Report generated (dry run - not exported to Google Sheets)'
        : 'Report generated successfully'
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...(format === 'csv' && {
            'Content-Disposition': `attachment; filename="placement-report-${execution_id}.csv"`
          })
        }
      }
    )
  } catch (error) {
    console.error('❌ Report generation failed:', error)

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
