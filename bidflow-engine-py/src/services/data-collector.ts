import { logger } from '../utils/logger.js';
import { incrementReportsRequested } from '../utils/metrics.js';
import {
  upsertPortfolios,
  upsertCampaignBids,
  createWeeklySnapshot,
  updateSnapshotStatus,
  insertReportLedgerEntries,
  TenantVaultCredentials,
} from '../clients/supabase.js';
import { AmazonAdsClient, REPORT_CONFIGS } from '../clients/amazon-ads.js';
import { getWeekLabel } from './tenant-scheduler.js';
import type { TenantCredentials, ReportLedgerEntry } from '../types/index.js';

export async function collectDataForTenant(
  credential: TenantCredentials,
  vaultCreds: TenantVaultCredentials
): Promise<void> {
  logger.info('Starting data collection', {
    credentialId: credential.id,
    accountName: credential.account_name,
    profileId: credential.profile_id,
  });

  // Initialize Amazon Ads client with per-tenant credentials
  const amazonClient = new AmazonAdsClient(
    credential.profile_id,
    vaultCreds.refreshToken,
    vaultCreds.clientId,
    vaultCreds.clientSecret
  );
  await amazonClient.initialize();

  // Create weekly snapshot
  const weekLabel = getWeekLabel();
  const snapshotId = await createWeeklySnapshot(credential.id, weekLabel);
  logger.info('Created weekly snapshot', { snapshotId, weekLabel });

  try {
    // Step 1: Fetch and store portfolios
    const portfolios = await amazonClient.getPortfolios();
    await upsertPortfolios(credential.id, portfolios);
    logger.info('Stored portfolios', { count: portfolios.length });

    // Step 2: Fetch and store campaigns with bid adjustments
    const campaigns = await amazonClient.getCampaigns();
    await upsertCampaignBids(credential.id, campaigns);
    logger.info('Stored campaigns', { count: campaigns.length });

    // Step 3: Request reports
    const reportEntries: ReportLedgerEntry[] = [];

    for (const reportConfig of REPORT_CONFIGS) {
      try {
        const reportRequestId = await amazonClient.createReport(reportConfig);

        reportEntries.push({
          credential_id: credential.id,
          snapshot_id: snapshotId,
          report_name: reportConfig.name,
          report_request_id: reportRequestId,
          status: 'PENDING',
        });

        logger.info('Requested report', {
          reportName: reportConfig.name,
          reportRequestId,
        });
      } catch (error) {
        logger.error('Failed to request report', {
          reportName: reportConfig.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other reports even if one fails
      }
    }

    // Store report ledger entries
    if (reportEntries.length > 0) {
      await insertReportLedgerEntries(reportEntries);
      incrementReportsRequested(reportEntries.length);
    }

    // Update snapshot with counts
    await updateSnapshotStatus(snapshotId, 'PROCESSING', {
      portfolios_count: portfolios.length,
      campaigns_count: campaigns.length,
      reports_requested: reportEntries.length,
    });

    logger.info('Data collection complete for tenant', {
      credentialId: credential.id,
      portfolios: portfolios.length,
      campaigns: campaigns.length,
      reportsRequested: reportEntries.length,
    });
  } catch (error) {
    // Mark snapshot as failed
    await updateSnapshotStatus(snapshotId, 'FAILED');
    throw error;
  }
}
