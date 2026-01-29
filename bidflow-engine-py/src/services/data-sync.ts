import { logger } from '../utils/logger.js';
import { syncStagingToRaw as syncDb } from '../clients/supabase.js';

export async function syncStagingToRaw(snapshotId: string): Promise<void> {
  logger.info('Starting sync from staging to raw tables', { snapshotId });

  try {
    await syncDb(snapshotId);
    logger.info('Sync completed successfully', { snapshotId });
  } catch (error) {
    logger.error('Sync failed', {
      snapshotId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
