import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, json, printf, colorize, simple } = winston.format;

// Custom format for console in development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Create transports based on environment
const transports: winston.transport[] = [];

// Console transport
transports.push(
  new winston.transports.Console({
    format: config.nodeEnv === 'development'
      ? combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), devFormat)
      : combine(timestamp(), json()),
  })
);

// File transports for production
if (config.nodeEnv === 'production') {
  transports.push(
    new winston.transports.File({
      filename: '/var/log/bidflow/error.log',
      level: 'error',
      format: combine(timestamp(), json()),
    }),
    new winston.transports.File({
      filename: '/var/log/bidflow/combined.log',
      format: combine(timestamp(), json()),
    })
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'bidflow-engine' },
  transports,
});

// Helper functions for structured logging
export function logTenantStart(tenantId: string, accountName: string): void {
  logger.info('Starting tenant processing', { tenantId, accountName });
}

export function logTenantComplete(tenantId: string, duration: number): void {
  logger.info('Tenant processing complete', { tenantId, durationMs: duration });
}

export function logTenantError(tenantId: string, error: Error): void {
  logger.error('Tenant processing failed', {
    tenantId,
    error: error.message,
    stack: error.stack,
  });
}

export function logApiCall(endpoint: string, method: string, status: number, duration: number): void {
  logger.debug('API call', { endpoint, method, status, durationMs: duration });
}

export function logReportStatus(reportId: string, status: string): void {
  logger.info('Report status update', { reportId, status });
}

export function logSchedulerRun(tenantCount: number, successCount: number, failureCount: number): void {
  logger.info('Scheduler run complete', { tenantCount, successCount, failureCount });
}
