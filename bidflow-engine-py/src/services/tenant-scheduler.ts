import { config } from '../config/index.js';
import { logger, logTenantStart, logTenantComplete, logTenantError, logSchedulerRun } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';
import {
  startExecution,
  finishExecution,
  incrementTenantCount,
  incrementSuccessCount,
  incrementFailureCount,
  getDurationMs,
  alertCritical,
  alertError,
} from '../utils/metrics.js';
import { getActiveCredentials, logSchedulerRun as logSchedulerRunDb, decryptRefreshToken } from '../clients/supabase.js';
import { collectDataForTenant } from './data-collector.js';
import type { TenantCredentials } from '../types/index.js';

export async function runDailyCollection(): Promise<void> {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  logger.info('Starting daily collection', { dayOfWeek, date: today.toISOString().split('T')[0] });
  startExecution();

  let credentials: TenantCredentials[] = [];

  try {
    credentials = await getActiveCredentials(dayOfWeek);
    logger.info('Found active credentials', { count: credentials.length });

    if (credentials.length === 0) {
      logger.info('No active credentials scheduled for today');
      return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to fetch active credentials', { error: errorMessage });
    await alertCritical('Failed to fetch active credentials', { error: errorMessage });
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  for (const credential of credentials) {
    incrementTenantCount();
    const startTime = Date.now();

    try {
      logTenantStart(credential.id, credential.account_name);

      // Decrypt the refresh token
      const refreshToken = await decryptRefreshToken(credential.id);
      if (!refreshToken) {
        throw new Error('Failed to decrypt refresh token');
      }

      // Run collection for this tenant
      await collectDataForTenant(credential, refreshToken);

      const duration = Date.now() - startTime;
      logTenantComplete(credential.id, duration);
      incrementSuccessCount();
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logTenantError(credential.id, error instanceof Error ? error : new Error(errorMessage));
      incrementFailureCount(errorMessage);
      failureCount++;
      errors.push(`${credential.account_name}: ${errorMessage}`);

      // Send error alert for individual tenant failure
      await alertError(`Tenant collection failed: ${credential.account_name}`, {
        credentialId: credential.id,
        error: errorMessage,
      });
    }

    // Rate limiting between tenants
    if (credentials.indexOf(credential) < credentials.length - 1) {
      await sleep(config.rateLimiting.tenantDelay);
    }
  }

  const metrics = finishExecution();
  logSchedulerRun(credentials.length, successCount, failureCount);

  // Log to database
  try {
    await logSchedulerRunDb({
      run_date: today.toISOString().split('T')[0],
      tenant_count: credentials.length,
      success_count: successCount,
      failure_count: failureCount,
      duration_ms: metrics ? getDurationMs() : 0,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Failed to log scheduler run to database', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Alert if all tenants failed
  if (successCount === 0 && credentials.length > 0) {
    await alertCritical('All tenants failed during collection', {
      tenantCount: String(credentials.length),
      errors: errors.join('; '),
    });
  }

  logger.info('Daily collection complete', {
    total: credentials.length,
    success: successCount,
    failure: failureCount,
    durationMs: metrics ? getDurationMs() : 0,
  });
}

// Generate week label (e.g., "Week01", "Week02", etc.)
export function getWeekLabel(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekNumber = Math.ceil(diff / oneWeek);
  return `Week${weekNumber.toString().padStart(2, '0')}`;
}
