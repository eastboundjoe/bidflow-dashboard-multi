import http from 'http';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { startScheduler, stopScheduler, triggerCollection, triggerProcessor } from './scheduler.js';

// Track startup time for health check
const startTime = Date.now();

// Graceful shutdown handling
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, initiating graceful shutdown`);

  try {
    // Stop scheduler
    stopScheduler();

    // Close health check server if running
    if (healthServer) {
      await new Promise<void>((resolve) => {
        healthServer!.close(() => resolve());
      });
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Health check server
let healthServer: http.Server | null = null;

function startHealthCheck(): void {
  healthServer = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'healthy',
          uptime,
          uptimeFormatted: formatUptime(uptime),
          environment: config.nodeEnv,
          timestamp: new Date().toISOString(),
        })
      );
    } else if (req.url === '/ready' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: true }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  healthServer.listen(config.healthCheck.port, () => {
    logger.info(`Health check server listening on port ${config.healthCheck.port}`);
  });
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

// Parse command line arguments
function parseArgs(): { test?: boolean; collect?: boolean; process?: boolean } {
  const args = process.argv.slice(2);
  return {
    test: args.includes('--test'),
    collect: args.includes('--collect'),
    process: args.includes('--process'),
  };
}

// Main entry point
async function main(): Promise<void> {
  logger.info('BidFlow Engine starting', {
    nodeEnv: config.nodeEnv,
    nodeVersion: process.version,
  });

  const args = parseArgs();

  // Handle manual triggers
  if (args.test) {
    logger.info('Running in test mode');
    console.log('Configuration loaded successfully');
    console.log('Supabase URL:', config.supabase.url);
    console.log('Collection cron:', config.cron.collection);
    console.log('Processor cron:', config.cron.processor);
    console.log('Discord webhook configured:', !!config.discord.webhookUrl);
    process.exit(0);
  }

  if (args.collect) {
    logger.info('Running manual collection');
    await triggerCollection();
    process.exit(0);
  }

  if (args.process) {
    logger.info('Running manual report processing');
    await triggerProcessor();
    process.exit(0);
  }

  // Normal operation: start scheduler and health check
  try {
    // Start health check server
    startHealthCheck();

    // Start scheduler
    startScheduler();

    // Signal that we're ready (for PM2)
    if (process.send) {
      process.send('ready');
    }

    logger.info('BidFlow Engine running');
  } catch (error) {
    logger.error('Failed to start BidFlow Engine', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

// Start the application
main().catch((error) => {
  logger.error('Fatal error', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
