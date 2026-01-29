import { logger } from '../utils/logger.js';
import { syncStagingToRaw as syncDb } from '../clients/supabase.js';

export async function syncStagingToRaw(tenantId: string): Promise<void> {
  logger.info('Starting sync from staging to raw tables', { tenantId });

  try {
    await syncDb(tenantId);
    logger.info('Sync completed successfully', { tenantId });
  } catch (error) {
    logger.error('Sync failed', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
