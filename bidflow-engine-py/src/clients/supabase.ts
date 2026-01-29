import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type {
  TenantCredentials,
  Portfolio,
  Campaign,
  ReportLedgerEntry,
  WeeklySnapshot,
  SchedulerLogEntry,
  StagingCampaignReport,
  StagingPlacementReport,
} from '../types/index.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseClient;
}

// Day name mapping
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Credential Operations - Updated for actual schema
export async function getActiveCredentials(dayOfWeek: number): Promise<TenantCredentials[]> {
  const client = getSupabaseClient();
  const dayName = DAY_NAMES[dayOfWeek];

  const { data, error } = await client
    .from('credentials')
    .select('*')
    .eq('status', 'active')
    .eq('report_day', dayName)
    .is('deleted_at', null);

  if (error) {
    logger.error('Failed to fetch active credentials', { error: error.message });
    throw error;
  }

  // Map to expected format
  return (data || []).map(row => ({
    id: row.tenant_id,
    tenant_id: row.tenant_id,
    profile_id: row.amazon_profile_id,
    refresh_token: '', // Will be fetched from Vault
    vault_id_refresh_token: row.vault_id_refresh_token,
    vault_id_client_id: row.vault_id_client_id,
    vault_id_client_secret: row.vault_id_client_secret,
    marketplace: row.marketplace_id,
    account_name: `Tenant ${row.tenant_id.substring(0, 8)}`,
    is_active: row.status === 'active',
    schedule_days: [dayOfWeek],
    report_hour: row.report_hour,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function getCredentialByTenantId(tenantId: string): Promise<TenantCredentials | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to fetch credential', { tenantId, error: error.message });
    throw error;
  }

  return {
    id: data.tenant_id,
    tenant_id: data.tenant_id,
    profile_id: data.amazon_profile_id,
    refresh_token: '',
    vault_id_refresh_token: data.vault_id_refresh_token,
    vault_id_client_id: data.vault_id_client_id,
    vault_id_client_secret: data.vault_id_client_secret,
    marketplace: data.marketplace_id,
    account_name: `Tenant ${data.tenant_id.substring(0, 8)}`,
    is_active: data.status === 'active',
    schedule_days: [],
    report_hour: data.report_hour,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// Alias for backward compatibility
export const getCredentialById = getCredentialByTenantId;

export async function getRefreshTokenFromVault(vaultId: string): Promise<string> {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('get_tenant_token', {
    p_vault_id: vaultId,
  });

  if (error) {
    logger.error('Failed to get refresh token from Vault', { vaultId, error: error.message });
    throw error;
  }

  return data || '';
}

// Legacy function name for compatibility
export async function decryptRefreshToken(tenantId: string): Promise<string> {
  const credential = await getCredentialByTenantId(tenantId);
  if (!credential || !credential.vault_id_refresh_token) {
    throw new Error(`No vault reference found for tenant: ${tenantId}`);
  }
  return getRefreshTokenFromVault(credential.vault_id_refresh_token);
}

// Get all credentials from Vault for a tenant
export interface TenantVaultCredentials {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

export async function getTenantVaultCredentials(
  vaultIdRefreshToken: string,
  vaultIdClientId: string,
  vaultIdClientSecret: string
): Promise<TenantVaultCredentials> {
  // Only fetch from Vault if we have a valid vault ID
  const refreshToken = await getRefreshTokenFromVault(vaultIdRefreshToken);
  const clientId = vaultIdClientId ? await getRefreshTokenFromVault(vaultIdClientId) : '';
  const clientSecret = vaultIdClientSecret ? await getRefreshTokenFromVault(vaultIdClientSecret) : '';

  return { refreshToken, clientId, clientSecret };
}

// Portfolio Operations
export async function upsertPortfolios(
  tenantId: string,
  portfolios: Portfolio[]
): Promise<void> {
  const client = getSupabaseClient();

  const rows = portfolios.map(p => ({
    tenant_id: tenantId,
    portfolio_id: p.portfolio_id,
    portfolio_name: p.name,
    budget_amount: p.budget_amount,
    currency: 'USD',
    portfolio_state: p.state,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from('staging_portfolios')
    .upsert(rows, { onConflict: 'tenant_id,portfolio_id' });

  if (error) {
    logger.error('Failed to upsert portfolios', { tenantId, error: error.message });
    throw error;
  }

  logger.info('Upserted portfolios', { tenantId, count: portfolios.length });
}

// Campaign/Bid Operations
export async function upsertCampaignBids(
  tenantId: string,
  campaigns: Campaign[]
): Promise<void> {
  const client = getSupabaseClient();

  const rows = campaigns.map(c => ({
    tenant_id: tenantId,
    campaign_id: c.campaign_id,
    portfolio_id: c.portfolio_id,
    campaign_name: c.name,
    campaign_status: c.state,
    campaign_budget: c.budget,
    placement_top_of_search: c.bid_top_of_search,
    placement_rest_of_search: c.bid_rest_of_search,
    placement_product_page: c.bid_product_page,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from('staging_placement_bids')
    .upsert(rows, { onConflict: 'tenant_id,campaign_id' });

  if (error) {
    logger.error('Failed to upsert campaign bids', { tenantId, error: error.message });
    throw error;
  }

  logger.info('Upserted campaign bids', { tenantId, count: campaigns.length });
}

// Weekly Snapshot Operations
export async function createWeeklySnapshot(
  tenantId: string,
  weekLabel: string
): Promise<string> {
  const client = getSupabaseClient();

  // Get week metadata using the database function
  const { data: weekData, error: weekError } = await client.rpc('get_week_metadata', {
    input_date: new Date().toISOString().split('T')[0]
  });

  if (weekError || !weekData || weekData.length === 0) {
    logger.error('Failed to get week metadata', { error: weekError?.message });
    throw weekError || new Error('No week metadata returned');
  }

  const week = weekData[0];

  // Check if snapshot already exists for this tenant+week
  const { data: existing } = await client
    .from('weekly_snapshots')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('week_id', week.week_id)
    .single();

  if (existing) {
    logger.info('Using existing weekly snapshot', { snapshotId: existing.id, weekId: week.week_id });
    // Reset status to collecting for re-run
    await client
      .from('weekly_snapshots')
      .update({ status: 'COLLECTING' })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await client
    .from('weekly_snapshots')
    .insert({
      tenant_id: tenantId,
      week_id: week.week_id,
      year: week.year,
      week_number: week.week_number,
      start_date: week.start_date,
      end_date: week.end_date,
      status: 'COLLECTING',
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Failed to create weekly snapshot', { tenantId, error: error.message });
    throw error;
  }

  return data.id;
}

export async function updateSnapshotStatus(
  snapshotId: string,
  status: WeeklySnapshot['status'],
  updates?: Partial<WeeklySnapshot>
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from('weekly_snapshots')
    .update({
      status,
      ...updates,
      ...(status === 'COMPLETED' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', snapshotId);

  if (error) {
    logger.error('Failed to update snapshot status', { snapshotId, error: error.message });
    throw error;
  }
}

// Report Ledger Operations
export async function insertReportLedgerEntries(
  entries: ReportLedgerEntry[]
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client.from('report_ledger').insert(entries);

  if (error) {
    logger.error('Failed to insert report ledger entries', { error: error.message });
    throw error;
  }

  logger.info('Inserted report ledger entries', { count: entries.length });
}

export async function getPendingReports(): Promise<ReportLedgerEntry[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('report_ledger')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to fetch pending reports', { error: error.message });
    throw error;
  }

  return data || [];
}

export async function updateReportStatus(
  reportId: string,
  status: ReportLedgerEntry['status'],
  updates?: Partial<ReportLedgerEntry>
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from('report_ledger')
    .update({
      status,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('report_id', reportId);

  if (error) {
    logger.error('Failed to update report status', { reportId, error: error.message });
    throw error;
  }
}

// Staging Report Data Operations
export async function insertCampaignReports(
  reports: StagingCampaignReport[]
): Promise<void> {
  const client = getSupabaseClient();

  // Use upsert to handle duplicates (unique on campaign_id, report_type, data_date)
  const { error } = await client
    .from('staging_campaign_reports')
    .upsert(reports, { onConflict: 'campaign_id,report_type,data_date' });

  if (error) {
    logger.error('Failed to insert campaign reports', { error: error.message });
    throw error;
  }

  logger.info('Upserted campaign reports', { count: reports.length });
}

export async function insertPlacementReports(
  reports: StagingPlacementReport[]
): Promise<void> {
  const client = getSupabaseClient();

  // Use upsert to handle duplicates
  const { error } = await client
    .from('staging_placement_reports')
    .upsert(reports, { onConflict: 'campaign_id,placement_type,report_type,data_date' });

  if (error) {
    logger.error('Failed to insert placement reports', { error: error.message });
    throw error;
  }

  logger.info('Upserted placement reports', { count: reports.length });
}

// Sync Operation
export async function syncStagingToRaw(tenantId: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client.rpc('sync_staging_to_raw', {
    p_tenant_id: tenantId,
  });

  if (error) {
    logger.error('Failed to sync staging to raw', { tenantId, error: error.message });
    throw error;
  }

  logger.info('Synced staging to raw', { tenantId });
}

// Scheduler Log Operations
export async function logSchedulerRun(entry: SchedulerLogEntry): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client.from('scheduler_log').insert(entry);

  if (error) {
    logger.error('Failed to log scheduler run', { error: error.message });
    throw error;
  }
}

// Check if all reports for a snapshot are complete
export async function areAllReportsComplete(snapshotId: string): Promise<boolean> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('report_ledger')
    .select('status')
    .eq('snapshot_id', snapshotId);

  if (error) {
    logger.error('Failed to check report completion', { snapshotId, error: error.message });
    throw error;
  }

  if (!data || data.length === 0) return false;

  return data.every(r => r.status === 'COMPLETED');
}

// Get snapshot by ID
export async function getSnapshotById(snapshotId: string): Promise<WeeklySnapshot | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('weekly_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to fetch snapshot', { snapshotId, error: error.message });
    throw error;
  }

  return data;
}
