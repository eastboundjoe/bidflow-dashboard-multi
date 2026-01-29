import { logger, logReportStatus } from '../utils/logger.js';
import { incrementReportsProcessed, alertError } from '../utils/metrics.js';
import { sleep } from '../utils/retry.js';
import { config } from '../config/index.js';
import {
  getPendingReports,
  updateReportStatus,
  insertCampaignReports,
  insertPlacementReports,
  areAllReportsComplete,
  updateSnapshotStatus,
  getCredentialById,
  decryptRefreshToken,
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

// Client cache by credential ID
const clientCache: Map<string, AmazonAdsClient> = new Map();

async function getAmazonClient(credentialId: string): Promise<AmazonAdsClient> {
  let client = clientCache.get(credentialId);

  if (!client) {
    const credential = await getCredentialById(credentialId);
    if (!credential) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    const refreshToken = await decryptRefreshToken(credentialId);
    if (!refreshToken) {
      throw new Error(`Failed to decrypt refresh token for: ${credentialId}`);
    }

    client = new AmazonAdsClient(credential.profile_id, refreshToken);
    await client.initialize();
    clientCache.set(credentialId, client);
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

  // Group reports by credential for efficient client reuse
  const reportsByCredential = new Map<string, ReportLedgerEntry[]>();
  for (const report of pendingReports) {
    const existing = reportsByCredential.get(report.credential_id) || [];
    existing.push(report);
    reportsByCredential.set(report.credential_id, existing);
  }

  let processedCount = 0;
  let failedCount = 0;

  for (const [credentialId, reports] of reportsByCredential) {
    let amazonClient: AmazonAdsClient;

    try {
      amazonClient = await getAmazonClient(credentialId);
    } catch (error) {
      logger.error('Failed to initialize Amazon client', {
        credentialId,
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
          reportName: report.report_name,
          error: errorMessage,
        });

        await updateReportStatus(report.id!, 'FAILED', {
          error_message: errorMessage,
        });

        failedCount++;

        await alertError(`Report processing failed: ${report.report_name}`, {
          reportId: report.report_request_id,
          credentialId,
          error: errorMessage,
        });
      }
    }

    // Check if all reports for this credential's snapshot are complete
    try {
      await checkSnapshotCompletion(credentialId, reports);
    } catch (error) {
      logger.error('Error checking snapshot completion', {
        credentialId,
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
  const status = await amazonClient.getReportStatus(report.report_request_id);
  logReportStatus(report.report_request_id, status.status);

  if (status.status === 'PENDING' || status.status === 'PROCESSING') {
    // Update our status to PROCESSING if it was PENDING
    if (report.status === 'PENDING') {
      await updateReportStatus(report.id!, 'PROCESSING');
    }
    return 'pending';
  }

  if (status.status === 'FAILURE') {
    await updateReportStatus(report.id!, 'FAILED', {
      error_message: status.statusDetails || 'Report generation failed',
    });
    return 'failed';
  }

  if (status.status === 'COMPLETED' && status.url) {
    // Download and process the report
    const reportData = await amazonClient.downloadReport(status.url);

    // Determine report type and process accordingly
    const isPlacementReport = report.report_name.includes('Placement');

    if (isPlacementReport) {
      await processPlacementReport(report, reportData);
    } else {
      await processCampaignReport(report, reportData);
    }

    // Mark as completed
    await updateReportStatus(report.id!, 'COMPLETED', {
      download_url: status.url,
    });

    logger.info('Report processed successfully', {
      reportId: report.id,
      reportName: report.report_name,
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
  const reportType = getReportType(report.report_name);

  const stagingReports: StagingCampaignReport[] = data.map((row) => {
    const metrics = normalizeMetrics(row);
    const acos = calculateAcos(metrics.spend, metrics.sales);
    const cvr = calculateCvr(metrics.clicks, metrics.purchases);

    return {
      credential_id: report.credential_id,
      snapshot_id: report.snapshot_id,
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
  const reportType = getReportType(report.report_name);

  const stagingReports: StagingPlacementReport[] = data.map((row) => {
    const metrics = normalizeMetrics(row);
    const acos = calculateAcos(metrics.spend, metrics.sales);
    const cvr = calculateCvr(metrics.clicks, metrics.purchases);

    // Normalize placement name
    const placement = normalizePlacement(row.placementClassification);

    return {
      credential_id: report.credential_id,
      snapshot_id: report.snapshot_id,
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
  credentialId: string,
  reports: ReportLedgerEntry[]
): Promise<void> {
  // Get unique snapshot IDs
  const snapshotIds = [...new Set(reports.map((r) => r.snapshot_id))];

  for (const snapshotId of snapshotIds) {
    const allComplete = await areAllReportsComplete(snapshotId);

    if (allComplete) {
      logger.info('All reports complete for snapshot, syncing to raw', { snapshotId });

      try {
        await syncStagingToRaw(snapshotId);
        await updateSnapshotStatus(snapshotId, 'COMPLETED', {
          reports_completed: reports.filter((r) => r.snapshot_id === snapshotId).length,
        });

        logger.info('Snapshot complete and synced', { snapshotId });
      } catch (error) {
        logger.error('Failed to sync snapshot', {
          snapshotId,
          error: error instanceof Error ? error.message : String(error),
        });

        await updateSnapshotStatus(snapshotId, 'FAILED');
      }
    }
  }
}
