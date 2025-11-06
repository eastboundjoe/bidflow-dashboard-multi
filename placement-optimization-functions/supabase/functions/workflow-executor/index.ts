// =====================================================
// Workflow Executor - Main Orchestrator
// =====================================================
// Coordinates the entire placement optimization workflow
// 1. Creates execution record
// 2. Triggers data collection from Amazon Ads API
// 3. Monitors report generation
// 4. Exports results to Google Sheets
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../_shared/supabase-client.ts'
import { formatError, WorkflowError } from '../_shared/errors.ts'

interface WorkflowRequest {
  execution_id?: string
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
    console.log('🚀 Workflow Executor started')

    // Parse request
    const body: WorkflowRequest = await req.json()
    const executionId = body.execution_id || `exec_${Date.now()}`
    const dryRun = body.dry_run || false

    console.log(`Execution ID: ${executionId}`)
    console.log(`Dry Run: ${dryRun}`)

    const supabase = createSupabaseClient()

    // Step 1: Create workflow execution record
    console.log('📝 Creating workflow execution record...')
    const { error: executionError } = await supabase
      .from('workflow_executions')
      .insert({
        execution_id: executionId,
        status: 'RUNNING',
        workflow_type: 'placement_optimization',
        started_at: new Date().toISOString(),
        metadata: { dry_run: dryRun }
      })

    if (executionError) {
      throw new WorkflowError(
        'Failed to create execution record',
        'EXECUTION_CREATE_FAILED',
        executionError
      )
    }

    console.log('✅ Execution record created')

    // Step 2: Clear existing data
    if (!dryRun) {
      console.log('🗑️  Clearing existing performance data...')
      const { error: truncateError } = await supabase.rpc('truncate_performance_data')

      if (truncateError) {
        throw new WorkflowError(
          'Failed to clear existing data',
          'TRUNCATE_FAILED',
          truncateError
        )
      }

      console.log('✅ Data cleared')
    }

    // Step 3: Trigger data collection
    console.log('📊 Triggering data collection...')
    const collectorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/report-collector`
    const collectorResponse = await fetch(collectorUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        execution_id: executionId,
        dry_run: dryRun
      })
    })

    if (!collectorResponse.ok) {
      const errorText = await collectorResponse.text()
      throw new WorkflowError(
        `Data collection failed: ${errorText}`,
        'COLLECTOR_FAILED'
      )
    }

    const collectorResult = await collectorResponse.json()
    console.log('✅ Data collection completed:', collectorResult)

    // Step 4: Generate report (export to Google Sheets)
    console.log('📈 Generating report...')
    const generatorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/report-generator`
    const generatorResponse = await fetch(generatorUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        execution_id: executionId,
        dry_run: dryRun
      })
    })

    if (!generatorResponse.ok) {
      const errorText = await generatorResponse.text()
      throw new WorkflowError(
        `Report generation failed: ${errorText}`,
        'GENERATOR_FAILED'
      )
    }

    const generatorResult = await generatorResponse.json()
    console.log('✅ Report generated:', generatorResult)

    // Step 5: Mark execution as completed
    console.log('✅ Updating execution status to COMPLETED...')
    const { error: updateError } = await supabase
      .from('workflow_executions')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString()
      })
      .eq('execution_id', executionId)

    if (updateError) {
      console.error('Failed to update execution status:', updateError)
    }

    console.log('🎉 Workflow completed successfully!')

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: executionId,
        status: 'COMPLETED',
        collector_result: collectorResult,
        generator_result: generatorResult,
        completed_at: new Date().toISOString()
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
    console.error('❌ Workflow failed:', error)

    const formattedError = formatError(error)

    // Try to update execution status to FAILED
    try {
      const body: WorkflowRequest = await req.json()
      const executionId = body.execution_id || `exec_${Date.now()}`

      const supabase = createSupabaseClient()
      await supabase
        .from('workflow_executions')
        .update({
          status: 'FAILED',
          completed_at: new Date().toISOString(),
          error_message: formattedError.message
        })
        .eq('execution_id', executionId)
    } catch (updateError) {
      console.error('Failed to update execution status:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: formattedError
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
