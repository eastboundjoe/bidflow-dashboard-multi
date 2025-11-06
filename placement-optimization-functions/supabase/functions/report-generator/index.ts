// =====================================================
// Report Generator - Google Sheets Export
// =====================================================
// 1. Queries view_placement_optimization_report
// 2. Formats data for Google Sheets
// 3. Exports to Google Sheets (or returns formatted data)
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'
import { formatError, WorkflowError } from '../_shared/errors.ts'

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
      throw new WorkflowError('Missing execution_id', 'INVALID_REQUEST')
    }

    console.log(`Execution ID: ${execution_id}`)
    console.log(`Dry Run: ${dry_run}`)
    console.log(`Format: ${format}`)

    const supabase = createSupabaseClient()

    // Step 1: Query the placement optimization view
    console.log('🔍 Querying placement optimization report...')
    const { data, error } = await supabase
      .from('view_placement_optimization_report')
      .select('*')

    if (error) {
      throw new WorkflowError('Failed to query report view', 'QUERY_FAILED', error)
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

    // Step 2: Format data based on requested format
    let formattedData: string | object

    if (format === 'csv') {
      console.log('📄 Formatting as CSV...')
      formattedData = convertToCSV(data)
    } else {
      console.log('📋 Formatting as JSON...')
      formattedData = data
    }

    // Step 3: Log report generation
    console.log(`✅ Report generated with ${data.length} rows`)

    // Step 4: Return formatted data
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

/**
 * Convert JSON data to CSV format
 */
function convertToCSV(data: Array<Record<string, unknown>>): string {
  if (data.length === 0) return ''

  // Get headers from first row
  const headers = Object.keys(data[0])

  // Create CSV header row
  const csvHeaders = headers.join(',')

  // Create CSV data rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]

      // Handle null/undefined
      if (value === null || value === undefined) return ''

      // Handle numbers
      if (typeof value === 'number') return value.toString()

      // Handle strings (escape quotes and wrap in quotes if contains comma)
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }

      return stringValue
    }).join(',')
  })

  return [csvHeaders, ...csvRows].join('\n')
}
