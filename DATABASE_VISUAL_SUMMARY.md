# Amazon Placement Optimization - Database Visual Summary

## Database Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   EXECUTION & REPORTING LAYER                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  workflow_executions                    report_requests          │
│  ┌──────────────────┐                  ┌──────────────────┐    │
│  │ execution_id (PK)│◄─────────────────│ execution_id (FK)│    │
│  │ status           │                  │ report_id        │    │
│  │ workflow_type    │                  │ report_type      │    │
│  │ started_at       │                  │ status           │    │
│  │ completed_at     │                  │ download_url     │    │
│  └──────────────────┘                  └──────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       MASTER DATA LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  portfolios                              campaigns               │
│  ┌──────────────────┐                  ┌──────────────────┐    │
│  │ portfolio_id (PK)│◄─────────────────│ portfolio_id (FK)│    │
│  │ portfolio_name   │                  │ campaign_id (PK) │    │
│  │ portfolio_state  │                  │ campaign_name    │    │
│  │ in_budget        │                  │ campaign_status  │    │
│  └──────────────────┘                  │ daily_budget     │    │
│                                         │ bid_top_of_search│    │
│                                         │ bid_rest_of_search│   │
│                                         │ bid_product_page │    │
│                                         └──────────────────┘    │
│                                                  │               │
└──────────────────────────────────────────────────┼───────────────┘
                                                   │
                                                   │ FK Reference
                                                   │
┌──────────────────────────────────────────────────┼───────────────┐
│                    PERFORMANCE DATA LAYER        │               │
├──────────────────────────────────────────────────┼───────────────┤
│                                                  ▼               │
│  campaign_performance              placement_performance         │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │ campaign_id (FK) │◄─────────────│ campaign_id (FK) │         │
│  │ period_type      │              │ placement        │         │
│  │ report_date      │              │ period_type      │         │
│  │ impressions      │              │ report_date      │         │
│  │ clicks           │              │ impressions      │         │
│  │ spend            │              │ clicks           │         │
│  │ orders_7d        │              │ spend            │         │
│  │ sales_7d         │              │ orders_7d        │         │
│  │ orders_14d       │              │ sales_7d         │         │
│  │ sales_14d        │              │ orders_30d       │         │
│  │ orders_30d       │              │ sales_30d        │         │
│  │ sales_30d        │              └──────────────────┘         │
│  │ tos_impression_share│                                         │
│  └──────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       REPORTING VIEW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  view_placement_optimization_report                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  25 Columns Aggregating All Data:                          │ │
│  │  - Campaign & Portfolio Info                               │ │
│  │  - 30-Day Metrics (Clicks, Spend, Orders, CVR, ACoS)       │ │
│  │  - 7-Day Metrics (Clicks, Spend, Orders, CVR, ACoS)        │ │
│  │  - Daily Spend (Yesterday, Day Before)                     │ │
│  │  - Top of Search Impression Share (30d, 7d, Yesterday)     │ │
│  │  - Placement Type & Bid Adjustments                        │ │
│  │  - Notes Fields                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
1. WORKFLOW STARTS
   ↓
   workflow_executions.execution_id created
   ↓
2. REPORTS REQUESTED
   ↓
   6 report_requests created (linked to execution_id)
   ↓
3. DATA COLLECTED
   ↓
   portfolios & campaigns tables populated (master data)
   ↓
4. PERFORMANCE DATA
   ↓
   campaign_performance & placement_performance populated
   ↓
5. VIEW AGGREGATION
   ↓
   view_placement_optimization_report generates 25-column report
   ↓
6. EXPORT TO GOOGLE SHEETS
```

## Table Relationships

### Primary Keys (PK)
| Table | Primary Key | Type |
|-------|-------------|------|
| workflow_executions | id | UUID |
| report_requests | id | UUID |
| portfolios | id | UUID |
| campaigns | id | UUID |
| campaign_performance | id | UUID |
| placement_performance | id | UUID |

### Foreign Keys (FK)
| From Table | From Column | To Table | To Column | On Delete |
|------------|-------------|----------|-----------|-----------|
| report_requests | execution_id | workflow_executions | execution_id | CASCADE |
| campaigns | portfolio_id | portfolios | portfolio_id | SET NULL |
| campaign_performance | campaign_id | campaigns | campaign_id | CASCADE |
| placement_performance | campaign_id | campaigns | campaign_id | CASCADE |

### Unique Constraints
| Table | Unique Columns |
|-------|----------------|
| workflow_executions | execution_id |
| report_requests | report_id |
| portfolios | portfolio_id |
| campaigns | campaign_id |
| campaign_performance | (campaign_id, period_type, report_date) |
| placement_performance | (campaign_id, placement, period_type, report_date) |

## Index Strategy

### Speed Optimizations
```
Foreign Key Indexes (for JOINs)
├── report_requests.execution_id
├── campaigns.portfolio_id
├── campaign_performance.campaign_id
└── placement_performance.campaign_id

Lookup Indexes (for WHERE clauses)
├── workflow_executions.execution_id, status
├── report_requests.report_type, status
├── portfolios.portfolio_id, portfolio_state
├── campaigns.campaign_id, campaign_status
├── campaign_performance.period_type, report_date
└── placement_performance.placement, period_type

Composite Indexes (for multi-column lookups)
├── campaign_performance (campaign_id, period_type)
└── placement_performance (campaign_id, placement, period_type)

Time-Series Indexes (for date ranges)
├── workflow_executions.started_at DESC
├── report_requests.requested_at DESC
└── campaign_performance.report_date DESC
```

## Data Volume Estimates

### Weekly Data Load
```
Assumptions:
- 50 campaigns
- 3 placements per campaign
- 6 report types

Expected Rows Per Week:
├── workflow_executions:     1 row
├── report_requests:         6 rows
├── portfolios:              ~5 rows (relatively stable)
├── campaigns:               50 rows (relatively stable)
├── campaign_performance:    200 rows (50 campaigns × 4 periods)
└── placement_performance:   300 rows (50 campaigns × 3 placements × 2 periods)

Total: ~562 rows/week
Yearly estimate: ~29,000 rows
```

### Storage Estimates (1 Year)
```
workflow_executions:     52 KB    (52 weeks)
report_requests:         312 KB   (312 reports)
portfolios:              5 KB     (mostly stable)
campaigns:               50 KB    (mostly stable, some changes)
campaign_performance:    10 MB    (~10,400 rows)
placement_performance:   15 MB    (~15,600 rows)

Total: ~25 MB/year (negligible)
```

## Security Configuration

### Row Level Security (RLS) Policies

```
All Tables:
┌─────────────────────────────────┐
│ Policy Name: Service role full  │
│ Applies To:  service_role       │
│ Operations:  ALL (SELECT,       │
│              INSERT, UPDATE,    │
│              DELETE)            │
│ Condition:   true (always)      │
└─────────────────────────────────┘

Edge Functions use service_role key
└─> Full read/write access to all tables

Anon key (public)
└─> No access (all blocked by RLS)
```

## Helper Functions

### truncate_performance_data()
```
Purpose: Clear all performance data before weekly run
Security: SECURITY DEFINER (runs as table owner)
Usage:    SELECT truncate_performance_data();

Operations:
1. TRUNCATE campaign_performance
2. TRUNCATE placement_performance
3. DELETE FROM campaigns
4. DELETE FROM portfolios

Note: workflow_executions and report_requests are preserved for audit trail
```

## Scheduled Jobs (pg_cron)

```
Job: cleanup-old-workflow-executions
Schedule: Monday 3:00 AM UTC (0 3 * * 1)
Action: DELETE workflow_executions older than 90 days
Purpose: Prevent unbounded growth of audit log
Cascades: Also deletes related report_requests
```

## View Logic: view_placement_optimization_report

### CTEs (Common Table Expressions)
```
placement_30d
├── Aggregates placement_performance for 30-day period
└── Groups by: campaign_id, placement

placement_7d
├── Aggregates placement_performance for 7-day period
└── Groups by: campaign_id, placement

campaign_tos_30d
├── Calculates Top of Search impression share (30-day)
└── Groups by: campaign_id

campaign_tos_7d
├── Calculates Top of Search impression share (7-day)
└── Groups by: campaign_id

campaign_yesterday
├── Gets yesterday's spend and impression share
└── Groups by: campaign_id

campaign_day_before
├── Gets day-before-yesterday's spend
└── Groups by: campaign_id
```

### Final SELECT
```
JOINs:
- placement_30d (base)
- LEFT JOIN placement_7d (matching campaign + placement)
- INNER JOIN campaigns (require campaign master data)
- LEFT JOIN portfolios (may be null)
- LEFT JOIN campaign_tos_30d, campaign_tos_7d
- LEFT JOIN campaign_yesterday, campaign_day_before

Filters:
- campaign_status = 'ENABLED'
- spend_30 > 0

Order:
- Portfolio name (nulls last)
- Campaign name
- Placement
```

## Column Mapping: Database → Google Sheets

| Sheet Column | Database Source | Calculation |
|--------------|-----------------|-------------|
| Campaign | campaigns.campaign_name | Direct |
| Portfolio | portfolios.portfolio_name | Direct |
| Budget | campaigns.daily_budget | Direct |
| Clicks-30 | placement_30d.clicks_30 | SUM(clicks) |
| Spend-30 | placement_30d.spend_30 | SUM(spend) |
| Orders-30 | placement_30d.orders_30 | SUM(orders_30d) |
| CVR-30 | Calculated | (Orders-30 / Clicks-30) × 100 |
| ACoS-30 | Calculated | (Spend-30 / Sales-30) × 100 |
| Clicks-7 | placement_7d.clicks_7 | SUM(clicks) |
| Spend-7 | placement_7d.spend_7 | SUM(spend) |
| Orders-7 | placement_7d.orders_7 | SUM(orders_7d) |
| CVR-7 | Calculated | (Orders-7 / Clicks-7) × 100 |
| ACoS-7 | Calculated | (Spend-7 / Sales-7) × 100 |
| Spent DB Yesterday | campaign_day_before.spent_day_before | SUM(spend) |
| Spent Yesterday | campaign_yesterday.spent_yesterday | SUM(spend) |
| Array Formula | NULL | Placeholder for Google Sheets formula |
| Last 30 days | campaign_tos_30d.tos_is_30 | AVG(impression_share) × 100 |
| Last 7 days | campaign_tos_7d.tos_is_7 | AVG(impression_share) × 100 |
| Yesterday | campaign_yesterday.tos_is_yesterday | impression_share × 100 |
| Placement Type | Formatted | CASE statement on placement |
| Increase bids by placement | campaigns.bid_* | Based on placement type |
| Changes in placement | Empty string | Manual entry field |
| NOTES | Empty string | Manual entry field |

## Check Constraints

| Table | Column | Constraint |
|-------|--------|-----------|
| workflow_executions | status | IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') |
| report_requests | report_type | IN (6 valid types) |
| report_requests | status | IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'TIMEOUT') |
| campaigns | bid_top_of_search | BETWEEN 0 AND 900 |
| campaigns | bid_rest_of_search | BETWEEN 0 AND 900 |
| campaigns | bid_product_page | BETWEEN 0 AND 900 |
| campaign_performance | period_type | IN ('30day', '7day', 'yesterday', 'day_before') |
| placement_performance | placement | IN (3 valid placement types) |
| placement_performance | period_type | IN ('30day', '7day') |

## Timestamps

All tables include:
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (where applicable)

These enable:
- Audit trails
- Data freshness checks
- Debugging data flow issues

