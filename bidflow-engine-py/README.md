# BidFlow Engine

A standalone Node.js/TypeScript application that replaces the n8n workflows for Amazon Ads data collection and processing. Designed to run on a Google Cloud VM for improved reliability and control.

## Overview

BidFlow Engine automates the collection and processing of Amazon Advertising placement reports for the BidFlow SaaS platform. It:

1. **Daily Collection (3 AM UTC)**: Fetches portfolios, campaigns, and requests 6 report types from Amazon Ads API
2. **Report Processing (Every 5 mins)**: Downloads completed reports, calculates metrics, and syncs to raw tables

## Features

- Multi-tenant support with per-tenant credential encryption
- Automatic OAuth token refresh and caching
- Retry logic with exponential backoff for transient errors
- Discord webhook alerts for critical failures
- Health check endpoint for monitoring
- Graceful shutdown handling
- PM2 process management ready

## Prerequisites

- Node.js 20 LTS
- PM2 (for production deployment)
- Supabase project with required tables
- Amazon Ads API credentials

## Installation

### Local Development

```bash
# Clone the repository
cd bidflow-engine

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Build TypeScript
npm run build

# Run in development mode
npm run dev
```

### Google Cloud VM Deployment

```bash
# 1. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install PM2 globally
sudo npm install -g pm2

# 3. Clone repository
git clone https://github.com/eastboundjoe/bidflow-engine.git
cd bidflow-engine

# 4. Install dependencies
npm install

# 5. Build TypeScript
npm run build

# 6. Create .env file
cp .env.example .env
nano .env  # Add your secrets

# 7. Create log directory
sudo mkdir -p /var/log/bidflow
sudo chown $USER:$USER /var/log/bidflow

# 8. Start with PM2
pm2 start ecosystem.config.js

# 9. Enable PM2 startup on reboot
pm2 startup
pm2 save
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `ENCRYPTION_KEY` | Yes | 32-byte key for credential encryption |
| `AMAZON_CLIENT_ID` | Yes | Amazon Ads API client ID |
| `AMAZON_CLIENT_SECRET` | Yes | Amazon Ads API client secret |
| `COLLECTION_CRON` | No | Cron expression for collection (default: `0 3 * * *`) |
| `PROCESSOR_CRON` | No | Cron expression for processor (default: `*/5 * * * *`) |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook for alerts |
| `LOG_LEVEL` | No | Logging level (default: `info`) |
| `HEALTH_CHECK_PORT` | No | Health check port (default: `8080`) |

## Usage

### Normal Operation

```bash
# Start with PM2 (recommended for production)
pm2 start ecosystem.config.js

# Or run directly
npm start
```

### Manual Triggers

```bash
# Test configuration
npm run test

# Run collection manually
node dist/index.js --collect

# Run report processing manually
node dist/index.js --process
```

### PM2 Commands

```bash
# View logs
pm2 logs bidflow-engine

# Restart
pm2 restart bidflow-engine

# Stop
pm2 stop bidflow-engine

# View status
pm2 status
```

## Report Types

The engine requests 6 reports per tenant:

| Report | Grouping | Time Period |
|--------|----------|-------------|
| Campaign-30 Days | Campaign | 30-day summary |
| Campaign-7 Days | Campaign | 7-day summary |
| Placement-30 Days | Campaign + Placement | 30-day summary |
| Placement-7 Days | Campaign + Placement | 7-day summary |
| Campaign-Yesterday | Campaign | Daily (yesterday) |
| Campaign-DayBefore | Campaign | Daily (day before) |

## Database Tables

The engine interacts with these Supabase tables:

### Credentials & Configuration
- `credentials` - Tenant credentials (encrypted refresh tokens)

### Staging Tables (temporary processing)
- `staging_portfolios` - Fetched portfolio data
- `staging_placement_bids` - Campaign bid adjustments
- `staging_campaign_reports` - Campaign-level report data
- `staging_placement_reports` - Placement-level report data

### Tracking Tables
- `weekly_snapshots` - Weekly execution records
- `report_ledger` - Individual report request tracking
- `scheduler_log` - Scheduler execution history

### Raw Tables (final data)
- `raw_portfolios`, `raw_placement_bids`, `raw_campaign_reports`, `raw_placement_reports`

## Monitoring

### Health Check

```bash
# Check health
curl http://localhost:8080/health

# Response:
{
  "status": "healthy",
  "uptime": 3600,
  "uptimeFormatted": "1h 0m 0s",
  "environment": "production",
  "timestamp": "2024-01-15T03:00:00.000Z"
}
```

### Discord Alerts

Configure `DISCORD_WEBHOOK_URL` to receive alerts for:
- Database connection failures
- All tenants failing collection
- Individual tenant errors
- Report download failures

### Log Files (Production)

- `/var/log/bidflow/error.log` - Error-level logs only
- `/var/log/bidflow/combined.log` - All logs
- `/var/log/bidflow/out.log` - PM2 stdout
- `/var/log/bidflow/error.log` - PM2 stderr

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BidFlow Engine                          │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐    ┌───────────────────┐            │
│  │   Scheduler       │    │   Health Check    │            │
│  │ (node-cron)       │    │   (HTTP :8080)    │            │
│  └─────────┬─────────┘    └───────────────────┘            │
│            │                                                │
│  ┌─────────▼─────────┐                                     │
│  │ Tenant Scheduler  │ ─── Iterates active tenants         │
│  └─────────┬─────────┘                                     │
│            │                                                │
│  ┌─────────▼─────────┐    ┌───────────────────┐            │
│  │ Data Collector    │───▶│  Amazon Ads API   │            │
│  └─────────┬─────────┘    └───────────────────┘            │
│            │                                                │
│  ┌─────────▼─────────┐    ┌───────────────────┐            │
│  │ Report Processor  │───▶│    Supabase       │            │
│  └─────────┬─────────┘    └───────────────────┘            │
│            │                                                │
│  ┌─────────▼─────────┐                                     │
│  │   Data Sync       │ ─── sync_staging_to_raw()           │
│  └───────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling

### Retry Strategy

- **Transient errors** (network, 429, 5xx): Retry up to 3 times with exponential backoff
- **Permanent errors** (401, 400): Log and skip
- **Critical errors** (database down): Alert and continue with other tenants

### Tenant Isolation

If one tenant fails, others continue processing. Failed tenants are logged and alerted but don't block the scheduler.

## Migration from n8n

This engine replaces three n8n workflows:
1. `_Multi__0__Daily_Scheduler`
2. `_Multi__1__Placement_Data_Collection`
3. `_Multi__2__Placement_Data_Processing`

### Migration Steps

1. Deploy this engine to the VM
2. Run in parallel with n8n for 3-5 days
3. Compare outputs for consistency
4. Disable n8n workflows
5. Monitor for 24 hours
6. Remove n8n dependency from frontend

## License

Proprietary - Ramen Bomb LLC
