import { config } from '../config/index.js';
import { logger } from './logger.js';
import type { RetryConfig } from '../types/index.js';

const defaultConfig: RetryConfig = config.retry;

// Errors that should be retried
const TRANSIENT_ERROR_CODES = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
];

const TRANSIENT_HTTP_STATUSES = [429, 500, 502, 503, 504];

export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const axiosError = error as { code?: string; response?: { status: number } };

    // Check for network errors
    if (axiosError.code && TRANSIENT_ERROR_CODES.includes(axiosError.code)) {
      return true;
    }

    // Check for HTTP status codes
    if (axiosError.response && TRANSIENT_HTTP_STATUSES.includes(axiosError.response.status)) {
      return true;
    }
  }

  return false;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function calculateDelay(attempt: number, retryConfig: RetryConfig = defaultConfig): number {
  const delay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt);
  return Math.min(delay, retryConfig.maxDelay);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  retryConfig: RetryConfig = defaultConfig
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isTransientError(error) || attempt === retryConfig.maxRetries) {
        logger.error(`${operationName} failed permanently`, {
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries,
          error: lastError.message,
        });
        throw lastError;
      }

      const delay = calculateDelay(attempt, retryConfig);
      logger.warn(`${operationName} failed, retrying`, {
        attempt: attempt + 1,
        maxRetries: retryConfig.maxRetries,
        nextRetryMs: delay,
        error: lastError.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}
