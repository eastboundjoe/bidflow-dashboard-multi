import cron from 'node-cron';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { runDailyCollection } from './services/tenant-scheduler.js';
import { processReports } from './services/report-processor.js';

let collectionJob: cron.ScheduledTask | null = null;
let processorJob: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  logger.info('Starting scheduler', {
    collectionCron: config.cron.collection,
    processorCron: config.cron.processor,
  });

  // Daily collection job (default: 3 AM UTC)
  collectionJob = cron.schedule(
    config.cron.collection,
    async () => {
      logger.info('Collection job triggered');
      try {
        await runDailyCollection();
      } catch (error) {
        logger.error('Collection job failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      timezone: 'UTC',
    }
  );

  // Report processor job (default: every 5 minutes)
  processorJob = cron.schedule(
    config.cron.processor,
    async () => {
      logger.info('Processor job triggered');
      try {
        await processReports();
      } catch (error) {
        logger.error('Processor job failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      timezone: 'UTC',
    }
  );

  logger.info('Scheduler started');
}

export function stopScheduler(): void {
  logger.info('Stopping scheduler');

  if (collectionJob) {
    collectionJob.stop();
    collectionJob = null;
  }

  if (processorJob) {
    processorJob.stop();
    processorJob = null;
  }

  logger.info('Scheduler stopped');
}

// Manual trigger functions (for testing or manual runs)
export async function triggerCollection(): Promise<void> {
  logger.info('Manual collection triggered');
  await runDailyCollection();
}

export async function triggerProcessor(): Promise<void> {
  logger.info('Manual processor triggered');
  await processReports();
}
