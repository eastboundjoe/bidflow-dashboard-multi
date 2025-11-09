// =====================================================
// Workflow Executor - Multi-Tenant Version
// =====================================================
// Coordinates the entire placement optimization workflow for a specific tenant
// 1. Creates execution record
// 2. Triggers data collection from Amazon Ads API
// 3. Monitors report generation
// 4. Exports results to Google Sheets
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient, getUserContext } from '../_shared/supabase-client-multitenant.ts'
import { formatError, WorkflowError } from '../_shared/errors.ts'

interface WorkflowRequest {
  execution_id?: string
  tenant_id?: string  // Optional if using auth header
  amazon_ads_account_id?: string  // Optional - uses first active account if not specified
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
    console.log('🚀 Workflow Executor (Multi-Tenant) started')

    // Parse request
    const body: WorkflowRequest = await req.json()
    const executionId = body.execution_id || `exec_${Date.now()}`
    const dryRun = body.dry_run || false

    console.log(`Execution ID: ${executionId}`)
    console.log(`Dry Run: ${dryRun}`)

    const supabase = createSupabaseClient()

    // Determine tenant_id and amazon_ads_account_id
    let tenantId: string
    let accountId: string

    if (body.tenant_id && body.amazon_ads_account_id) {
      // Explicit tenant and account provided (service role call)
      tenantId = body.tenant_id
      accountId = body.amazon_ads_account_id
      console.log(`Using provided tenant: ${tenantId}, account: ${accountId}`)

    } else {
      // Get from user context (authenticated user call)
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new WorkflowError(
          'Must provide either (tenant_id + amazon_ads_account_id) or Authorization header',
          'MISSING_AUTH'
        )
      }

      const context = await getUserContext(authHeader)
      tenantId = context.tenant.id

      // Use specified account or first active account
      if (body.amazon_ads_account_id) {
        accountId = body.amazon_ads_account_id
      } else {
        const activeAccount = context.amazon_ads_accounts.find(acc => acc.is_active)
        if (!activeAccount) {
          throw new WorkflowError(
            'No active Amazon Ads accounts found for this tenant',
            'NO_ACTIVE_ACCOUNT'
          )
        }
        accountId = activeAccount.id
      }

      console.log(`Using tenant: ${context.tenant.name} (${tenantId})`)
      console.log(`Using account: ${accountId}`)
    }

    // Verify account belongs to tenant
    const { data: account, error: accountError } = await supabase
      .from('amazon_ads_accounts')
      .select('id, tenant_id, account_name, is_active')
      .eq('id', accountId)
      .single()

    if (accountError || !account) {
      throw new WorkflowError(
        `Amazon Ads account not found: ${accountId}`,
        'ACCOUNT_NOT_FOUND'
      )
    }

    if (account.tenant_id !== tenantId) {
      throw new WorkflowError(
        'Account does not belong to specified tenant',
        'TENANT_MISMATCH'
      )
    }

    if (!account.is_active) {
      throw new WorkflowError(
        `Amazon Ads account is inactive: ${account.account_name}`,
        'ACCOUNT_INACTIVE'
      )
    }

    console.log(`✅ Account verified: ${account.account_name}`)

    // Step 1: Create workflow execution record
    console.log('📝 Creating workflow execution record...')
    const { error: executionError } = await supabase
      .from('workflow_executions')
      .insert({
        execution_id: executionId,
        tenant_id: tenantId,
        amazon_ads_account_id: accountId,
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

    // Step 2: Clear existing data for this tenant
    if (!dryRun) {
      console.log('🗑️  Clearing existing performance data for tenant...')

      // Delete campaign_performance
      const { error: deleteCampaignPerfError } = await supabase
        .from('campaign_performance')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('amazon_ads_account_id', accountId)

      if (deleteCampaignPerfError) {
        throw new WorkflowError(
          'Failed to clear campaign performance data',
          'DELETE_FAILED',
          deleteCampaignPerfError
        )
      }

      // Delete placement_performance
      const { error: deletePlacementPerfError } = await supabase
        .from('placement_performance')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('amazon_ads_account_id', accountId)

      if (deletePlacementPerfError) {
        throw new WorkflowError(
          'Failed to clear placement performance data',
          'DELETE_FAILED',
          deletePlacementPerfError
        )
      }

      console.log('✅ Data cleared for tenant')
    }

    // Step 3: Trigger data collection
    console.log('📊 Triggering data collection...')
    const collectorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/report-collector-multitenant`
    const collectorResponse = await fetch(collectorUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        execution_id: executionId,
        tenant_id: tenantId,
        amazon_ads_account_id: accountId,
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
    const generatorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/report-generator-multitenant`
    const generatorResponse = await fetch(generatorUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        execution_id: executionId,
        tenant_id: tenantId,
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
      .eq('tenant_id', tenantId)

    if (updateError) {
      console.error('Failed to update execution status:', updateError)
    }

    console.log('🎉 Workflow completed successfully!')

    return new Response(
      JSON.stringify({
        success: true,
        execution_id: executionId,
        tenant_id: tenantId,
        amazon_ads_account_id: accountId,
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
      const bodyText = await req.text()
      const body: WorkflowRequest = JSON.parse(bodyText)
      const executionId = body.execution_id || `exec_${Date.now()}`
      const tenantId = body.tenant_id

      if (tenantId) {
        const supabase = createSupabaseClient()
        await supabase
          .from('workflow_executions')
          .update({
            status: 'FAILED',
            completed_at: new Date().toISOString(),
            error_message: formattedError.message
          })
          .eq('execution_id', executionId)
          .eq('tenant_id', tenantId)
      }
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
