import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from './logger.js';
import type { AlertSeverity, DiscordEmbed } from '../types/index.js';

// Execution metrics tracking
interface ExecutionMetrics {
  startTime: number;
  tenantCount: number;
  successCount: number;
  failureCount: number;
  reportsRequested: number;
  reportsProcessed: number;
  errors: string[];
}

let currentMetrics: ExecutionMetrics | null = null;

export function startExecution(): void {
  currentMetrics = {
    startTime: Date.now(),
    tenantCount: 0,
    successCount: 0,
    failureCount: 0,
    reportsRequested: 0,
    reportsProcessed: 0,
    errors: [],
  };
}

export function incrementTenantCount(): void {
  if (currentMetrics) currentMetrics.tenantCount++;
}

export function incrementSuccessCount(): void {
  if (currentMetrics) currentMetrics.successCount++;
}

export function incrementFailureCount(error: string): void {
  if (currentMetrics) {
    currentMetrics.failureCount++;
    currentMetrics.errors.push(error);
  }
}

export function incrementReportsRequested(count: number): void {
  if (currentMetrics) currentMetrics.reportsRequested += count;
}

export function incrementReportsProcessed(count: number): void {
  if (currentMetrics) currentMetrics.reportsProcessed += count;
}

export function getMetrics(): ExecutionMetrics | null {
  return currentMetrics;
}

export function finishExecution(): ExecutionMetrics | null {
  const metrics = currentMetrics;
  currentMetrics = null;
  return metrics;
}

export function getDurationMs(): number {
  if (!currentMetrics) return 0;
  return Date.now() - currentMetrics.startTime;
}

// Discord Alerting
export async function sendDiscordAlert(
  message: string,
  severity: AlertSeverity,
  details?: Record<string, string>
): Promise<void> {
  const webhookUrl = config.discord.webhookUrl;
  if (!webhookUrl) {
    logger.warn('Discord webhook not configured, skipping alert');
    return;
  }

  const color = severity === 'critical' ? 0xff0000 : 0xffa500;
  const title = severity === 'critical' ? '🚨 CRITICAL ALERT' : '⚠️ Error Alert';

  const embed: DiscordEmbed = {
    title,
    description: message,
    color,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    embed.fields = Object.entries(details).map(([name, value]) => ({
      name,
      value,
      inline: true,
    }));
  }

  try {
    await axios.post(webhookUrl, {
      embeds: [embed],
    });
    logger.info('Discord alert sent', { severity, message });
  } catch (error) {
    logger.error('Failed to send Discord alert', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Alert helpers
export async function alertCritical(message: string, details?: Record<string, string>): Promise<void> {
  await sendDiscordAlert(message, 'critical', details);
}

export async function alertError(message: string, details?: Record<string, string>): Promise<void> {
  await sendDiscordAlert(message, 'error', details);
}
