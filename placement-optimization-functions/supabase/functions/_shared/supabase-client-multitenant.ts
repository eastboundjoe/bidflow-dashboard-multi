// =====================================================
// Supabase Client - Multi-Tenant Version
// =====================================================
// Creates authenticated Supabase client with multi-tenant support
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import type { Database } from '../../../database.types.ts'

/**
 * Creates Supabase client with service role key for Edge Functions
 * This client has full access to bypass RLS policies
 */
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Creates Supabase client authenticated as a specific user
 * Used for RLS-aware operations (e.g., frontend calls)
 */
export function createSupabaseClientWithAuth(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const token = authHeader.replace('Bearer ', '')

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Retrieves Amazon Ads API credentials for a specific account
 * Uses pgcrypto encryption functions
 */
export async function getAmazonAdsCredentials(accountId: string) {
  const supabase = createSupabaseClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable not set')
  }

  const { data, error } = await supabase.rpc('get_amazon_ads_credentials', {
    p_account_id: accountId,
    p_encryption_key: encryptionKey
  })

  if (error) {
    throw new Error(`Failed to retrieve Amazon Ads credentials: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error(`No credentials found for account: ${accountId}`)
  }

  return data[0]
}

/**
 * Stores encrypted Amazon Ads API credentials for an account
 */
export async function setAmazonAdsCredentials(
  accountId: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const supabase = createSupabaseClient()
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable not set')
  }

  const { data, error } = await supabase.rpc('set_amazon_ads_credentials', {
    p_account_id: accountId,
    p_client_id: clientId,
    p_client_secret: clientSecret,
    p_refresh_token: refreshToken,
    p_encryption_key: encryptionKey
  })

  if (error) {
    throw new Error(`Failed to store Amazon Ads credentials: ${error.message}`)
  }

  return data
}

/**
 * Gets tenant and account info for the currently authenticated user
 */
export async function getUserContext(authHeader: string) {
  const supabase = createSupabaseClientWithAuth(authHeader)

  // Get user's tenant_id
  const { data: tenantData, error: tenantError } = await supabase.rpc('get_user_tenant_id')

  if (tenantError) {
    throw new Error(`Failed to get user tenant: ${tenantError.message}`)
  }

  if (!tenantData) {
    throw new Error('User not associated with any tenant')
  }

  const tenantId = tenantData

  // Get tenant details
  const { data: tenant, error: tenantDetailError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  if (tenantDetailError) {
    throw new Error(`Failed to get tenant details: ${tenantDetailError.message}`)
  }

  // Get user details
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Failed to get user details')
  }

  const { data: userData, error: userDataError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (userDataError) {
    throw new Error(`Failed to get user data: ${userDataError.message}`)
  }

  // Get Amazon Ads accounts for this tenant
  const { data: accounts, error: accountsError } = await supabase
    .from('amazon_ads_accounts')
    .select('id, profile_id, account_name, marketplace, is_active, last_sync_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (accountsError) {
    throw new Error(`Failed to get Amazon Ads accounts: ${accountsError.message}`)
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: userData.role,
      permissions: userData.permissions
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      settings: tenant.settings
    },
    amazon_ads_accounts: accounts || []
  }
}
