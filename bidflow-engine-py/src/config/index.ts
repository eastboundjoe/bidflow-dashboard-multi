import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

function getEnvVarInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
  nodeEnv: getEnvVar('NODE_ENV', false) || 'development',

  // Supabase
  supabase: {
    url: getEnvVar('SUPABASE_URL'),
    serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    encryptionKey: getEnvVar('ENCRYPTION_KEY'),
  },

  // Amazon Ads
  amazon: {
    clientId: getEnvVar('AMAZON_CLIENT_ID'),
    clientSecret: getEnvVar('AMAZON_CLIENT_SECRET'),
    oauthUrl: 'https://api.amazon.com/auth/o2/token',
    apiBaseUrl: 'https://advertising-api.amazon.com',
  },

  // Scheduling
  cron: {
    collection: getEnvVar('COLLECTION_CRON', false) || '0 3 * * *',
    processor: getEnvVar('PROCESSOR_CRON', false) || '*/5 * * * *',
  },

  // Discord Alerting
  discord: {
    webhookUrl: getEnvVar('DISCORD_WEBHOOK_URL', false),
  },

  // Logging
  logging: {
    level: getEnvVar('LOG_LEVEL', false) || 'info',
  },

  // Health Check
  healthCheck: {
    port: getEnvVarInt('HEALTH_CHECK_PORT', 8080),
  },

  // Retry Configuration
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },

  // Rate Limiting
  rateLimiting: {
    tenantDelay: 5000, // 5 seconds between tenants
    apiDelay: 500,     // 500ms between API calls
  },
} as const;

export type Config = typeof config;
