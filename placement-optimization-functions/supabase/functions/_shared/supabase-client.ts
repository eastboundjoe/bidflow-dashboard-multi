// =====================================================
// Supabase Client - Shared Utility
// =====================================================
// Creates authenticated Supabase client with service role
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
 * Retrieves Amazon Ads API credentials from vault
 */
export async function getAmazonAdsCredentials() {
  const supabase = createSupabaseClient()

  const { data, error } = await supabase.rpc('get_amazon_ads_credentials')

  if (error) {
    throw new Error(`Failed to retrieve Amazon Ads credentials: ${error.message}`)
  }

  if (!data || data.length === 0) {
    throw new Error('No Amazon Ads credentials found in vault')
  }

  return data[0]
}
