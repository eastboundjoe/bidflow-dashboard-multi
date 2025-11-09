// =====================================================
// Get User Context - Multi-Tenant User Info
// =====================================================
// Returns tenant, user, and Amazon Ads account info for authenticated user
// Called by frontend after login to display user context
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getUserContext } from '../_shared/supabase-client-multitenant.ts'
import { formatError } from '../_shared/errors.ts'

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    })
  }

  try {
    console.log('👤 Get User Context started')

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get user context (tenant, user, accounts)
    const context = await getUserContext(authHeader)

    console.log(`✅ User context retrieved for tenant: ${context.tenant.name}`)
    console.log(`   Amazon Ads Accounts: ${context.amazon_ads_accounts.length}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: context
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
