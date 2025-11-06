// =====================================================
// Workflow Executor - Standalone Version for Dashboard Deployment
// =====================================================
// Main orchestrator that coordinates the entire workflow
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

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
      throw new Error(`Failed to create execution record: ${executionError.message}`)
    }

    console.log('✅ Execution record created')

    // Step 2: Clear existing data
    if (!dryRun) {
      console.log('🗑️  Clearing existing performance data...')
      const { error: truncateError } = await supabase.rpc('truncate_performance_data')

      if (truncateError) {
        throw new Error(`Failed to clear existing data: ${truncateError.message}`)
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
      throw new Error(`Data collection failed: ${errorText}`)
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
      throw new Error(`Report generation failed: ${errorText}`)
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

    const errorMessage = error instanceof Error ? error.message : String(error)

    // Try to update execution status to FAILED
    try {
      const body: WorkflowRequest = await req.json().catch(() => ({}))
      const executionId = body.execution_id || `exec_${Date.now()}`

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })

      await supabase
        .from('workflow_executions')
        .update({
          status: 'FAILED',
          completed_at: new Date().toISOString(),
          error_message: errorMessage
        })
        .eq('execution_id', executionId)
    } catch (updateError) {
      console.error('Failed to update execution status:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: errorMessage
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
