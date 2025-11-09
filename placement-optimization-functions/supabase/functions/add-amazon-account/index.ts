// =====================================================
// Add Amazon Account - Multi-Tenant Account Management
// =====================================================
// Stores encrypted Amazon Ads API credentials for a tenant
// Called by frontend when user connects their Amazon Ads account
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient, setAmazonAdsCredentials, getUserContext } from '../_shared/supabase-client-multitenant.ts'
import { formatError } from '../_shared/errors.ts'

interface AddAccountRequest {
  profile_id: string
  account_name: string
  marketplace?: string
  client_id: string
  client_secret: string
  refresh_token: string
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
    console.log('➕ Add Amazon Account started')

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get user context to determine tenant
    const context = await getUserContext(authHeader)
    const tenantId = context.tenant.id

    console.log(`Tenant: ${context.tenant.name} (${tenantId})`)

    // Parse request body
    const body: AddAccountRequest = await req.json()

    if (!body.profile_id || !body.account_name || !body.client_id || !body.client_secret || !body.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: profile_id, account_name, client_id, client_secret, refresh_token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createSupabaseClient()

    // Check if account already exists for this tenant
    const { data: existingAccount } = await supabase
      .from('amazon_ads_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('profile_id', body.profile_id)
      .single()

    let accountId: string

    if (existingAccount) {
      // Update existing account
      accountId = existingAccount.id
      console.log(`Updating existing account: ${accountId}`)

      const { error: updateError } = await supabase
        .from('amazon_ads_accounts')
        .update({
          account_name: body.account_name,
          marketplace: body.marketplace || 'US',
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)

      if (updateError) {
        throw new Error(`Failed to update account: ${updateError.message}`)
      }

    } else {
      // Create new account
      console.log(`Creating new account for profile: ${body.profile_id}`)

      const { data: newAccount, error: insertError } = await supabase
        .from('amazon_ads_accounts')
        .insert({
          tenant_id: tenantId,
          profile_id: body.profile_id,
          account_name: body.account_name,
          marketplace: body.marketplace || 'US',
          is_active: true
        })
        .select('id')
        .single()

      if (insertError || !newAccount) {
        throw new Error(`Failed to create account: ${insertError?.message}`)
      }

      accountId = newAccount.id
    }

    // Encrypt and store credentials
    console.log(`Encrypting credentials for account: ${accountId}`)
    await setAmazonAdsCredentials(
      accountId,
      body.client_id,
      body.client_secret,
      body.refresh_token
    )

    console.log(`✅ Amazon Ads account added/updated successfully`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          account_id: accountId,
          profile_id: body.profile_id,
          account_name: body.account_name,
          marketplace: body.marketplace || 'US'
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: formatError(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
