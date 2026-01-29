import { logger, logReportStatus } from '../utils/logger.js';
import { incrementReportsProcessed, alertError } from '../utils/metrics.js';
import { sleep } from '../utils/retry.js';
import { config } from '../config/index.js';
import {
  getPendingReports,
  updateReportStatus,
  insertCampaignReports,
  insertPlacementReports,
  getCredentialById,
  getTenantVaultCredentials,
} from '../clients/supabase.js';
import {
  AmazonAdsClient,
  normalizeMetrics,
  calculateAcos,
  calculateCvr,
} from '../clients/amazon-ads.js';
import { syncStagingToRaw } from './data-sync.js';
import type {
  ReportLedgerEntry,
  StagingCampaignReport,
  StagingPlacementReport,
} from '../types/index.js';

// Client cache by tenant ID
const clientCache: Map<string, AmazonAdsClient> = new Map();

async function getAmazonClient(tenantId: string): Promise<AmazonAdsClient> {
  let client = clientCache.get(tenantId);

  if (!client) {
    const credential = await getCredentialById(tenantId);
    if (!credential) {
      throw new Error(`Credential not found: ${tenantId}`);
    }

    if (!credential.vault_id_refresh_token) {
      throw new Error(`No vault reference for refresh token: ${tenantId}`);
    }

    // Get credentials from Vault
    const vaultCreds = await getTenantVaultCredentials(
      credential.vault_id_refresh_token,
      credential.vault_id_client_id || '',
      credential.vault_id_client_secret || ''
    );

    if (!vaultCreds.refreshToken) {
      throw new Error(`Failed to get refresh token from Vault: ${tenantId}`);
    }

    client = new AmazonAdsClient(
      credential.profile_id,
      vaultCreds.refreshToken,
      vaultCreds.clientId || undefined,
      vaultCreds.clientSecret || undefined
    );
    await client.initialize();
    clientCache.set(tenantId, client);
  }

  return client;
}

export async function processReports(): Promise<void> {
  logger.info('Starting report processing');

  const pendingReports = await getPendingReports();
  logger.info('Found pending reports', { count: pendingReports.length });

  if (pendingReports.length === 0) {
    logger.info('No pending reports to process');
    return;
  }

  // Group reports by tenant for efficient client reuse
  const reportsByTenant = new Map<string, ReportLedgerEntry[]>();
  for (const report of pendingReports) {
    const existing = reportsByTenant.get(report.tenant_id) || [];
    existing.push(report);
    reportsByTenant.set(report.tenant_id, existing);
  }

  let processedCount = 0;
  let failedCount = 0;

  for (const [tenantId, reports] of reportsByTenant) {
    let amazonClient: AmazonAdsClient;

    try {
      amazonClient = await getAmazonClient(tenantId);
    } catch (error) {
      logger.error('Failed to initialize Amazon client', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const report of reports) {
      try {
        const result = await processReport(amazonClient, report);

        if (result === 'completed') {
          processedCount++;
          incrementReportsProcessed(1);
        } else if (result === 'failed') {
          failedCount++;
        }

        // Rate limiting between reports
        await sleep(config.rateLimiting.apiDelay);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error processing report', {
          reportId: report.id,
          reportName: report.name,
          error: errorMessage,
        });

        await updateReportStatus(report.report_id, 'failed');

        failedCount++;

        await alertError(`Report processing failed: ${report.name}`, {
          reportId: report.report_id,
          tenantId,
          error: errorMessage,
        });
      }
    }

    // Check if all reports for this tenant are complete
    try {
      await checkSnapshotCompletion(tenantId, reports);
    } catch (error) {
      logger.error('Error checking snapshot completion', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Report processing complete', {
    processed: processedCount,
    failed: failedCount,
    pending: pendingReports.length - processedCount - failedCount,
  });
}

async function processReport(
  amazonClient: AmazonAdsClient,
  report: ReportLedgerEntry
): Promise<'completed' | 'pending' | 'failed'> {
  // Check report status with Amazon
  const status = await amazonClient.getReportStatus(report.report_id);
  logReportStatus(report.report_id, status.status);

  if (status.status === 'PENDING' || status.status === 'PROCESSING') {
    // Update our status to processing if it was pending
    if (report.status === 'pending') {
      await updateReportStatus(report.report_id, 'processing');
    }
    return 'pending';
  }

  if (status.status === 'FAILURE') {
    await updateReportStatus(report.report_id, 'failed');
    return 'failed';
  }

  if (status.status === 'COMPLETED' && status.url) {
    // Download and process the report
    const reportData = await amazonClient.downloadReport(status.url);

    // Determine report type and process accordingly
    const isPlacementReport = report.name.includes('Placement') || report.report_type === 'placement';

    if (isPlacementReport) {
      await processPlacementReport(report, reportData);
    } else {
      await processCampaignReport(report, reportData);
    }

    // Mark as completed
    await updateReportStatus(report.report_id, 'completed', {
      url: status.url,
    });

    logger.info('Report processed successfully', {
      reportId: report.id,
      reportName: report.name,
      rowCount: reportData.length,
    });

    return 'completed';
  }

  return 'pending';
}

async function processCampaignReport(
  report: ReportLedgerEntry,
  data: any[]
): Promise<void> {
  const reportType = getReportType(report.name);

  const stagingReports: StagingCampaignReport[] = data.map((row) => {
    const metrics = normalizeMetrics(row);
    const acos = calculateAcos(metrics.spend, metrics.sales);
    const cvr = calculateCvr(metrics.clicks, metrics.purchases);

    return {
      tenant_id: report.tenant_id,
      campaign_id: String(row.campaignId),
      campaign_name: row.campaignName || '',
      report_type: reportType,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      spend: metrics.spend,
      sales: metrics.sales,
      purchases: metrics.purchases,
      acos,
      cvr,
    };
  });

  if (stagingReports.length > 0) {
    await insertCampaignReports(stagingReports);
  }
}

async function processPlacementReport(
  report: ReportLedgerEntry,
  data: any[]
): Promise<void> {
  const reportType = getReportType(report.name);

  const stagingReports: StagingPlacementReport[] = data.map((row) => {
    const metrics = normalizeMetrics(row);
    const acos = calculateAcos(metrics.spend, metrics.sales);
    const cvr = calculateCvr(metrics.clicks, metrics.purchases);

    // Normalize placement name
    const placement = normalizePlacement(row.placementClassification);

    return {
      tenant_id: report.tenant_id,
      campaign_id: String(row.campaignId),
      campaign_name: row.campaignName || '',
      placement,
      report_type: reportType,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      spend: metrics.spend,
      sales: metrics.sales,
      purchases: metrics.purchases,
      acos,
      cvr,
    };
  });

  if (stagingReports.length > 0) {
    await insertPlacementReports(stagingReports);
  }
}

function getReportType(reportName: string): string {
  if (reportName.includes('30 Days')) return '30_day';
  if (reportName.includes('7 Days')) return '7_day';
  if (reportName.includes('Yesterday')) return 'yesterday';
  if (reportName.includes('DayBefore')) return 'day_before';
  return 'unknown';
}

function normalizePlacement(placementClassification: string): string {
  // Amazon API returns various formats, normalize them
  const normalized = (placementClassification || '').toUpperCase();

  if (normalized.includes('TOP') || normalized === 'PLACEMENT_TOP') {
    return 'Top of Search';
  }
  if (normalized.includes('REST') || normalized === 'PLACEMENT_REST_OF_SEARCH') {
    return 'Rest of Search';
  }
  if (normalized.includes('PRODUCT') || normalized.includes('DETAIL') || normalized === 'PLACEMENT_PRODUCT_PAGE') {
    return 'Product Pages';
  }

  return placementClassification || 'Unknown';
}

async function checkSnapshotCompletion(
  tenantId: string,
  reports: ReportLedgerEntry[]
): Promise<void> {
  // Check if all reports for this tenant are now complete
  // Note: This is a simplified check - in a full implementation you'd track snapshot_id
  const allComplete = reports.every(r => r.status === 'completed');

  if (allComplete && reports.length > 0) {
    logger.info('All reports complete for tenant, syncing to raw', {
      tenantId,
      reportCount: reports.length
    });

    try {
      // Sync staging data to raw tables
      await syncStagingToRaw(tenantId);
      logger.info('Staging data synced to raw', { tenantId });
    } catch (error) {
      logger.error('Failed to sync staging to raw', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
