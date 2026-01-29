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

// Credential Operations
export async function getActiveCredentials(dayOfWeek: number): Promise<TenantCredentials[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('credentials')
    .select('*')
    .eq('is_active', true)
    .contains('schedule_days', [dayOfWeek]);

  if (error) {
    logger.error('Failed to fetch active credentials', { error: error.message });
    throw error;
  }

  return data || [];
}

export async function getCredentialById(id: string): Promise<TenantCredentials | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('credentials')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to fetch credential', { id, error: error.message });
    throw error;
  }

  return data;
}

export async function decryptRefreshToken(credentialId: string): Promise<string> {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('get_credentials', {
    p_credential_id: credentialId,
  });

  if (error) {
    logger.error('Failed to decrypt refresh token', { credentialId, error: error.message });
    throw error;
  }

  return data?.refresh_token || '';
}

// Portfolio Operations
export async function upsertPortfolios(
  credentialId: string,
  portfolios: Portfolio[]
): Promise<void> {
  const client = getSupabaseClient();

  const rows = portfolios.map(p => ({
    credential_id: credentialId,
    portfolio_id: p.portfolio_id,
    name: p.name,
    budget_amount: p.budget_amount,
    budget_policy: p.budget_policy,
    state: p.state,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from('staging_portfolios')
    .upsert(rows, { onConflict: 'credential_id,portfolio_id' });

  if (error) {
    logger.error('Failed to upsert portfolios', { credentialId, error: error.message });
    throw error;
  }

  logger.info('Upserted portfolios', { credentialId, count: portfolios.length });
}

// Campaign/Bid Operations
export async function upsertCampaignBids(
  credentialId: string,
  campaigns: Campaign[]
): Promise<void> {
  const client = getSupabaseClient();

  const rows = campaigns.map(c => ({
    credential_id: credentialId,
    campaign_id: c.campaign_id,
    portfolio_id: c.portfolio_id,
    campaign_name: c.name,
    state: c.state,
    budget: c.budget,
    budget_type: c.budget_type,
    bidding_strategy: c.bidding_strategy,
    bid_top_of_search: c.bid_top_of_search,
    bid_rest_of_search: c.bid_rest_of_search,
    bid_product_page: c.bid_product_page,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from('staging_placement_bids')
    .upsert(rows, { onConflict: 'credential_id,campaign_id' });

  if (error) {
    logger.error('Failed to upsert campaign bids', { credentialId, error: error.message });
    throw error;
  }

  logger.info('Upserted campaign bids', { credentialId, count: campaigns.length });
}

// Weekly Snapshot Operations
export async function createWeeklySnapshot(
  credentialId: string,
  weekLabel: string
): Promise<string> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('weekly_snapshots')
    .insert({
      credential_id: credentialId,
      week_label: weekLabel,
      snapshot_date: new Date().toISOString().split('T')[0],
      status: 'COLLECTING',
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Failed to create weekly snapshot', { credentialId, error: error.message });
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
    .in('status', ['PENDING', 'PROCESSING'])
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
      ...(status === 'COMPLETED' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', reportId);

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

  const { error } = await client.from('staging_campaign_reports').insert(reports);

  if (error) {
    logger.error('Failed to insert campaign reports', { error: error.message });
    throw error;
  }

  logger.info('Inserted campaign reports', { count: reports.length });
}

export async function insertPlacementReports(
  reports: StagingPlacementReport[]
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client.from('staging_placement_reports').insert(reports);

  if (error) {
    logger.error('Failed to insert placement reports', { error: error.message });
    throw error;
  }

  logger.info('Inserted placement reports', { count: reports.length });
}

// Sync Operation
export async function syncStagingToRaw(snapshotId: string): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client.rpc('sync_staging_to_raw', {
    p_snapshot_id: snapshotId,
  });

  if (error) {
    logger.error('Failed to sync staging to raw', { snapshotId, error: error.message });
    throw error;
  }

  logger.info('Synced staging to raw', { snapshotId });
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
