# Amazon Placement Optimization Report - Complete Specification

**Document Version:** 1.0
**Date:** 2025-11-03
**Purpose:** Foundation document for rebuilding the Amazon Placement Optimization reporting system

---

## Table of Contents

1. [Report Structure](#1-report-structure)
2. [Data Requirements](#2-data-requirements)
3. [Calculations & Formulas](#3-calculations--formulas)
4. [Placement Optimization Logic](#4-placement-optimization-logic)
5. [Data Source Mapping](#5-data-source-mapping)
6. [Google Sheets Requirements](#6-google-sheets-requirements)
7. [Integration Points](#7-integration-points)
8. [Supabase Database Schema](#8-supabase-database-schema)
9. [Report Generation Workflow](#9-report-generation-workflow)

---

## 1. Report Structure

### 1.1 Sheet Names and Purposes

The placement optimization report consists of a single primary sheet:

- **USA** - Main data sheet containing all placement performance data for US marketplace campaigns

### 1.2 Complete Field List with Data Types

| Column | Field Name | Data Type | Format | Description |
|--------|-----------|-----------|--------|-------------|
| A | Campaign | TEXT | General | Campaign name |
| B | Portfolio | TEXT | General | Portfolio name (foreign key relationship) |
| C | Budget | NUMBER | Currency ($) | Campaign daily budget amount |
| D | Clicks-30 | NUMBER | Integer | Total clicks in last 30 days |
| E | Spend-30 | NUMBER | Currency | Total spend in last 30 days |
| F | Orders-30 | NUMBER | Integer | Total orders in last 30 days |
| G | CVR-30 | NUMBER | Percentage | Conversion rate for 30 days (Orders/Clicks) |
| H | ACoS-30 | NUMBER | Percentage | Advertising Cost of Sale for 30 days (Spend/Sales) |
| I | Clicks-7 | NUMBER | Integer | Total clicks in last 7 days |
| J | Spend-7 | NUMBER | Currency | Total spend in last 7 days |
| K | Orders-7 | NUMBER | Integer | Total orders in last 7 days |
| L | CVR-7 | NUMBER | Percentage | Conversion rate for 7 days |
| M | ACOS-7 | NUMBER | Percentage | Advertising Cost of Sale for 7 days |
| N | Spent DB Yesterday | NUMBER | Currency | Spend from day before yesterday |
| O | Spent Yesterday | NUMBER | Currency | Spend from yesterday |
| P | (Array Formula) | FORMULA | N/A | Internal calculation column |
| Q | Last 30 days | NUMBER | Percentage | Top of Search Impression Share - 30 days |
| R | Last 7 days | NUMBER | Percentage | Top of Search Impression Share - 7 days |
| S | Yesterday | NUMBER | Percentage | Top of Search Impression Share - yesterday |
| T | Placement Type | TEXT | General | Type of placement (see section 2.3) |
| U | Increase bids by placement | NUMBER | Integer | Current placement bid adjustment percentage |
| V | Changes in placement | TEXT | General | Recommendations for bid adjustments |
| W | NOTES | TEXT | General | Manual notes field |

### 1.3 Row Structure

- **Row 1:** Column headers (bold, colored background)
- **Rows 2+:** Data rows - one row per campaign-placement combination
- Each campaign appears multiple times (once per placement type)

---

## 2. Data Requirements

### 2.1 Required Metrics

#### From 30-Day Placement Report
- `campaignId` - Unique campaign identifier
- `campaignName` - Campaign name
- `campaignStatus` - Must be "ENABLED"
- `campaignBudgetAmount` - Daily budget
- `placementClassification` - Placement type (see 2.3)
- `impressions` - Total impressions
- `clicks` - Total clicks
- `spend` - Total spend
- `purchases30d` - Orders with 30-day attribution
- `sales30d` - Sales revenue with 30-day attribution

#### From 7-Day Placement Report
- `clicks` - Total clicks in 7-day window
- `spend` - Total spend in 7-day window
- `purchases7d` - Orders with 7-day attribution
- `sales7d` - Sales revenue with 7-day attribution

#### From Campaign Reports (Yesterday & Day Before)
- `date` - Report date
- `spend` - Daily spend amount
- `topOfSearchImpressionShare` - Percentage of TOS impressions

#### From Current Placement Bids API
- `campaignId`
- `portfolioId` - Links to portfolio table
- `dynamicBidding.placementBidding[]` - Array of placement adjustments
  - `placement`: "PLACEMENT_TOP", "PLACEMENT_REST_OF_SEARCH", "PLACEMENT_PRODUCT_PAGE"
  - `percentage`: Bid adjustment percentage (0-900)

### 2.2 Timeframe Breakdowns

| Timeframe | Purpose | Start Date Calculation | End Date |
|-----------|---------|----------------------|----------|
| 30-Day | Long-term performance trends | Today - 33 days | Today - 3 days |
| 7-Day | Recent performance trends | Today - 9 days | Today - 3 days |
| Yesterday | Daily spend tracking | Today - 1 day | Today - 1 day |
| Day Before Yesterday | Comparative daily spend | Today - 2 days | Today - 2 days |

**Note:** All reports use a 3-day lag (end date = today - 3 days) to ensure data completeness from Amazon's attribution window.

### 2.3 Placement Types

Amazon provides three placement classifications:

1. **Placement Top** (or "PLACEMENT_TOP")
   - Top of Search results (first page, above organic)
   - Highest visibility, typically highest cost
   - Display value: "Placement Top"

2. **Placement Rest Of Search** (or "PLACEMENT_REST_OF_SEARCH")
   - Search results below the fold or on subsequent pages
   - Mid-range visibility and cost
   - Display value: "Placement Rest Of Search"

3. **Placement Product Page** (or "PLACEMENT_PRODUCT_PAGE")
   - Product detail pages
   - Lower visibility, typically lowest cost
   - Display value: "Placement Product Page"

### 2.4 Campaign and Portfolio Information

#### Portfolio Data
- `portfolio_id` - Unique identifier (string/numeric)
- `portfolio_name` - Display name
- `portfolio_state` - Must be "ENABLED"

**Relationship:** Each campaign belongs to one portfolio. Portfolio name appears in column B of the report.

#### Campaign Data
- Must have `campaignStatus` = "ENABLED"
- Must have non-zero spend in reporting period
- Grouped by placement type (each campaign = 3 rows in report)

---

## 3. Calculations & Formulas

### 3.1 Primary Calculations

#### Conversion Rate (CVR)
```
CVR = (Orders / Clicks) * 100
```
- **30-Day CVR:** `(Orders-30 / Clicks-30) * 100`
- **7-Day CVR:** `(Orders-7 / Clicks-7) * 100`
- **Format:** Percentage with 2 decimal places (e.g., "12.36%")
- **Handle Division by Zero:** Return 0.00% if Clicks = 0

#### Advertising Cost of Sale (ACoS)
```
ACoS = (Spend / Sales) * 100
```
- **30-Day ACoS:** `(Spend-30 / Sales-30) * 100`
- **7-Day ACoS:** `(Spend-7 / Sales-7) * 100`
- **Format:** Percentage with 2 decimal places (e.g., "36.61%")
- **Handle Division by Zero:** Return 0.00% if Sales = 0

#### Return on Ad Spend (ROAS)
```
ROAS = Sales / Spend
```
- **Inverse of ACoS:** `1 / (ACoS / 100)`
- **Format:** Decimal with 2 places (e.g., "2.73" means $2.73 revenue per $1 spend)

### 3.2 Aggregation Rules

#### By Placement Type
For each campaign + placement combination:
- **SUM:** clicks, spend, orders, impressions
- **CALCULATE:** CVR and ACoS from summed values
- **FIRST:** campaignBudgetAmount, portfolioName (same across placements)
- **SPECIFIC:** placementType (different per row)

#### Top of Search Impression Share
- **Direct from API:** `topOfSearchImpressionShare` field
- **Format:** Percentage with 2-4 decimal places
- **Separate values for:** Last 30 days, Last 7 days, Yesterday

#### Current Placement Bids
- **Source:** Campaign's `dynamicBidding.placementBidding` array
- **Match by:** `placement` field value
- **Display:** Integer percentage (e.g., "65" for 65% bid increase)
- **Default:** 0 if placement not found in bid array

### 3.3 Data Type Conversions

| Source Type | Target Type | Conversion Rules |
|-------------|-------------|------------------|
| String numbers | NUMBER | Parse to float, default to 0 on error |
| NULL values | 0 | All null numeric values become 0 |
| Empty strings | 0 | Empty strings become 0 for numeric fields |
| Percentages from API | Display % | Multiply by 100 if API returns decimal (0.1236 → 12.36%) |
| Currency | Currency | Round to 2 decimal places |

---

## 4. Placement Optimization Logic

### 4.1 Bid Adjustment Decision Framework

The optimization logic recommends bid adjustments based on performance thresholds:

#### Decision Rules for Bid Increases

**Criteria for "Increase Bid":**
1. **High CVR** (>= 10%) AND
2. **Acceptable ACoS** (<= 40%) AND
3. **Sufficient Volume** (clicks >= 10 in 7-day period)

**Recommended Increase:**
- Top of Search: +10-25%
- Rest of Search: +5-15%
- Product Pages: +5-10%

#### Decision Rules for Bid Decreases

**Criteria for "Decrease Bid":**
1. **High ACoS** (>= 60%) OR
2. **Low CVR** (<= 3%) OR
3. **No Orders** (orders = 0 AND spend > $20)

**Recommended Decrease:**
- All Placements: -10% to -25%

#### Decision Rules for "Maintain"

- Performance between increase/decrease thresholds
- New campaigns with < 7 days of data
- Insufficient data volume (clicks < 10)

### 4.2 Placement Type Recommendations

Based on performance patterns:

| Placement | Increase Bid When | Decrease Bid When | Notes |
|-----------|-------------------|-------------------|-------|
| **Placement Top** | CVR > 10%, ACoS < 40% | ACoS > 60% | Highest priority for profitable campaigns |
| **Rest of Search** | CVR > 8%, ACoS < 50% | ACoS > 70% | Good for scale at mid-tier cost |
| **Product Page** | CVR > 6%, ACoS < 60% | ACoS > 80% | Lower volume but can be efficient |

### 4.3 Threshold Values and Decision Rules

#### Performance Thresholds

```
EXCELLENT_CVR = 12%
GOOD_CVR = 8%
MINIMUM_CVR = 3%

TARGET_ACOS = 40%
ACCEPTABLE_ACOS = 50%
HIGH_ACOS = 60%

MINIMUM_CLICKS_THRESHOLD = 10
MINIMUM_SPEND_THRESHOLD = $20
```

#### Bid Adjustment Percentages

Current system uses these bid adjustment ranges (stored as integers):
- **0%** - No adjustment (base bid)
- **5-35%** - Typical Rest of Search adjustments
- **50-65%** - Typical Top of Search adjustments
- **0-10%** - Typical Product Page adjustments

### 4.4 Optimization Workflow

1. **Calculate Performance Metrics** (CVR, ACoS, ROAS)
2. **Identify Placement Type** for each row
3. **Apply Decision Rules** based on thresholds
4. **Generate Recommendation** in "Changes in placement" column
5. **Highlight for Review** (color coding - see section 6.2)

---

## 5. Data Source Mapping

### 5.1 Field-by-Field Source Mapping

| Report Field | Source | API Endpoint/Table | Transformation |
|--------------|--------|-------------------|----------------|
| Campaign | Amazon API | `spCampaigns` report | Direct: `campaignName` |
| Portfolio | Supabase Join | `portfolios` table | JOIN on `portfolio_id` |
| Budget | Amazon API | `spCampaigns` report | Direct: `campaignBudgetAmount` |
| Clicks-30 | Amazon API | `spCampaigns` (30d, placement grouping) | SUM by campaign+placement |
| Spend-30 | Amazon API | `spCampaigns` (30d, placement grouping) | SUM by campaign+placement |
| Orders-30 | Amazon API | `spCampaigns` (30d, placement grouping) | Direct: `purchases30d` |
| CVR-30 | Calculated | N/A | `(Orders-30 / Clicks-30) * 100` |
| ACoS-30 | Calculated | N/A | `(Spend-30 / Sales-30) * 100` |
| Clicks-7 | Amazon API | `spCampaigns` (7d, placement grouping) | SUM by campaign+placement |
| Spend-7 | Amazon API | `spCampaigns` (7d, placement grouping) | SUM by campaign+placement |
| Orders-7 | Amazon API | `spCampaigns` (7d, placement grouping) | Direct: `purchases7d` |
| CVR-7 | Calculated | N/A | `(Orders-7 / Clicks-7) * 100` |
| ACOS-7 | Calculated | N/A | `(Spend-7 / Sales-7) * 100` |
| Spent DB Yesterday | Amazon API | `spCampaigns` (dayBefore, daily) | Filter by date-2, `spend` |
| Spent Yesterday | Amazon API | `spCampaigns` (yesterday, daily) | Filter by date-1, `spend` |
| Last 30 days (TOS IS) | Amazon API | `spCampaigns` (30d) | Direct: `topOfSearchImpressionShare` |
| Last 7 days (TOS IS) | Amazon API | `spCampaigns` (7d) | Direct: `topOfSearchImpressionShare` |
| Yesterday (TOS IS) | Amazon API | `spCampaigns` (yesterday) | Direct: `topOfSearchImpressionShare` |
| Placement Type | Amazon API | `spCampaigns` (placement grouping) | Map `placementClassification` to display value |
| Increase bids by placement | Amazon API | `/sp/campaigns/list` | Extract from `dynamicBidding.placementBidding[]` |
| Changes in placement | Calculated | N/A | Apply optimization logic (section 4) |

### 5.2 Amazon API Endpoints

#### 1. Create Placement Report - 30 Days
- **Endpoint:** `POST /reporting/reports`
- **Report Type:** `spCampaigns`
- **Group By:** `["campaign", "campaignPlacement"]`
- **Columns:**
  ```json
  [
    "campaignId",
    "campaignName",
    "campaignStatus",
    "campaignBudgetAmount",
    "placementClassification",
    "impressions",
    "clicks",
    "spend",
    "purchases30d",
    "sales30d"
  ]
  ```
- **Time Unit:** `SUMMARY`
- **Date Range:** startDate30 to endDate (33 days ago to 3 days ago)

#### 2. Create Placement Report - 7 Days
- **Endpoint:** `POST /reporting/reports`
- **Report Type:** `spCampaigns`
- **Group By:** `["campaign", "campaignPlacement"]`
- **Columns:**
  ```json
  [
    "campaignId",
    "campaignName",
    "campaignStatus",
    "placementClassification",
    "clicks",
    "spend",
    "purchases7d",
    "sales7d"
  ]
  ```
- **Time Unit:** `SUMMARY`
- **Date Range:** startDate7 to endDate (9 days ago to 3 days ago)

#### 3. Create Campaign Report - Yesterday
- **Endpoint:** `POST /reporting/reports`
- **Report Type:** `spCampaigns`
- **Group By:** `["campaign"]`
- **Columns:**
  ```json
  [
    "campaignId",
    "campaignName",
    "campaignBudgetAmount",
    "topOfSearchImpressionShare",
    "date",
    "campaignStatus",
    "spend"
  ]
  ```
- **Time Unit:** `DAILY`
- **Date Range:** yesterday to yesterday

#### 4. Create Campaign Report - Day Before
- **Endpoint:** `POST /reporting/reports`
- **Report Type:** `spCampaigns`
- **Group By:** `["campaign"]`
- **Columns:**
  ```json
  [
    "campaignId",
    "campaignName",
    "campaignBudgetAmount",
    "campaignStatus",
    "date",
    "spend"
  ]
  ```
- **Time Unit:** `DAILY`
- **Date Range:** dayBefore to dayBefore

#### 5. Get Current Placement Bids
- **Endpoint:** `POST /sp/campaigns/list`
- **Method:** POST
- **Body:**
  ```json
  {
    "stateFilter": {
      "include": ["ENABLED"]
    },
    "includeExtendedDataFields": true
  }
  ```
- **Extract:** `dynamicBidding.placementBidding[]` array

#### 6. Get Portfolios
- **Endpoint:** `POST /portfolios/list`
- **Method:** POST
- **Body:**
  ```json
  {
    "stateFilter": {
      "include": ["ENABLED"]
    },
    "includeExtendedDataFields": true
  }
  ```

### 5.3 Report Status Flow

1. **Create Report:** Returns `reportId` and status `PENDING`
2. **Poll Status:** Check status via `GET /reporting/reports/{reportId}`
3. **Wait for COMPLETED:** Status changes from `PENDING` → `PROCESSING` → `COMPLETED`
4. **Download:** Extract `url` from completed report
5. **Decompress:** Reports are GZIP compressed JSON
6. **Process:** Parse JSON array and store to database

**Typical Wait Time:** 30-45 minutes for report generation

---

## 6. Google Sheets Requirements

### 6.1 Formatting Requirements

#### Header Row (Row 1)
- **Font:** Bold
- **Background Color:** Light blue/gray (RGB: varies by template)
- **Text Alignment:** Center horizontal, Middle vertical
- **Border:** All borders, medium weight
- **Font Size:** 10-11pt

#### Data Rows (Row 2+)
- **Font:** Regular (non-bold)
- **Text Alignment:**
  - Text fields: Left aligned
  - Number fields: Right aligned
  - Percentage fields: Center aligned
- **Number Formats:**
  - Currency: `$#,##0.00`
  - Integer: `#,##0`
  - Percentage: `0.00%`
- **Borders:** Light gridlines

### 6.2 Conditional Formatting / Color Coding

Based on the example file analysis, the following columns have color patterns:

#### Performance-Based Colors (Columns G, H, L, M)
- **Green Background:** Good performance (low ACoS, high CVR)
- **Yellow Background:** Moderate performance (needs attention)
- **Red/Orange Background:** Poor performance (high ACoS, low CVR)

#### Typical Color Rules:
- **CVR Columns (G, L):**
  - Green: >= 10%
  - Yellow: 5-10%
  - Red: < 5%

- **ACoS Columns (H, M):**
  - Green: <= 40%
  - Yellow: 40-60%
  - Red: > 60%

#### Spend Tracking (Columns N, O)
- Highlight cells where spend approaches budget

#### Recommendations (Column V)
- Color based on action type:
  - Green: "Increase bid"
  - Yellow: "Monitor"
  - Red: "Decrease bid"

### 6.3 Sheet Organization

#### Tab Structure
- **Single Tab:** "USA" (for US marketplace)
- **Future Expansion:** Add tabs for "CA", "UK", "EU" marketplaces

#### Column Grouping
- **Columns A-C:** Campaign identification
- **Columns D-H:** 30-day performance metrics
- **Columns I-M:** 7-day performance metrics
- **Columns N-O:** Daily spend tracking
- **Columns Q-S:** Top of Search impression share
- **Columns T-V:** Placement optimization
- **Column W:** Notes

### 6.4 Template Information

- **Template ID:** `11YhO8fSY0bAVe0s5rjL3gaJRcIeH3GmGaaqt-3pJcbo`
- **Template Name:** "TEMPLATE-Placements Optimization Template"
- **Copy Operation:** Google Drive API creates new copy with week-based naming
- **Naming Convention:** `Week{WW}-Placement Optimization` (e.g., "Week44-Placement Optimization")

### 6.5 Data Population Method

Using Google Sheets API v4:
- **Operation:** Append rows
- **Sheet Name:** "USA" (gid: 395936711)
- **Range:** Auto-detect (append to end of existing data)
- **Input Option:** `USER_ENTERED` (interprets formulas and formats)
- **Batch Size:** All rows in single append operation

---

## 7. Integration Points

### 7.1 Amazon Ads API Expert Agent

**Responsibilities:**
- Authenticate with Amazon Advertising API using LWA (Login with Amazon)
- Cache and refresh access tokens
- Request all required reports (6 total):
  - Placement 30-day
  - Placement 7-day
  - Campaign 30-day
  - Campaign 7-day
  - Campaign yesterday
  - Campaign day before
- Fetch current placement bids via campaigns list API
- Fetch portfolio list
- Poll report status until COMPLETED
- Download and decompress GZIP JSON reports
- Return structured data to processing layer

**Required Outputs:**
1. `raw_placement_reports` data (30d, 7d)
2. `raw_campaign_reports` data (30d, 7d, yesterday, dayBefore)
3. `placement_bids` data (current bid adjustments)
4. `portfolios` data (id-to-name mapping)

**Error Handling:**
- Retry logic for API rate limits (429 errors)
- Wait strategy for report generation (poll every 60 seconds)
- Graceful failure if reports take >2 hours

### 7.2 Supabase Architect Agent

**Responsibilities:**
- Design and implement database tables (see section 8)
- Create SQL view `view_placement_optimization_report`
- Implement data aggregation logic in SQL
- Create Edge Functions for:
  - Data transformation and calculations
  - Report generation trigger
  - Google Sheets integration
- Optimize query performance (indexes, materialized views if needed)

**Required Outputs:**
1. Database schema SQL migration files
2. View definition SQL
3. Edge Function for report compilation
4. Edge Function for Google Sheets export

**Data Quality:**
- Ensure ENABLED campaigns only
- Handle NULL values correctly
- Aggregate placement data properly
- Join portfolio names correctly

### 7.3 Dependencies Between Data Points

#### Sequential Dependencies:

```
1. Authentication
   ↓
2. Fetch Portfolios (required for names in report)
   ↓
3. Fetch Current Placement Bids (required for "Increase bids" column)
   ↓
4. Request Reports (can run in parallel):
   - Placement 30-day
   - Placement 7-day
   - Campaign 30-day
   - Campaign 7-day
   - Campaign yesterday
   - Campaign day before
   ↓
5. Poll Report Status (wait for all COMPLETED)
   ↓
6. Download & Store Reports
   ↓
7. Process & Calculate Metrics
   ↓
8. Generate Final Report
   ↓
9. Export to Google Sheets
```

#### Data Relationship Dependencies:

- **Portfolio Names:** Must fetch portfolios BEFORE campaigns
- **Placement Bids:** Must fetch BEFORE final report generation
- **30-Day Data:** Required for ACoS-30, CVR-30, Clicks-30, etc.
- **7-Day Data:** Required for ACoS-7, CVR-7, Clicks-7, etc.
- **Yesterday/DayBefore:** Required for daily spend tracking columns
- **Sales Data:** Required for ACoS calculations (from purchases * average order value)

### 7.4 Cross-Agent Communication

**Recommended Flow:**

```
API Expert Agent
  ↓ (writes to)
Supabase Raw Tables
  ↓ (processed by)
Supabase View Logic
  ↓ (queried by)
Edge Function
  ↓ (writes to)
Google Sheets via API
```

**Data Formats:**
- All agents use JSON for communication
- Timestamps in ISO 8601 format
- Currency as decimal numbers (not strings)
- Percentages as decimals (0.1236, not "12.36%")

---

## 8. Supabase Database Schema

### 8.1 Current Tables (Existing System)

#### Table: `encrypted_credentials`
```sql
CREATE TABLE encrypted_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_name TEXT UNIQUE NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Stores encrypted API credentials (encrypted with Google KMS)

**Key Credentials:**
- `sp_api_client_id`
- `sp_api_client_secret`
- `sp_api_refresh_token`
- `advertising_client_id`
- `marketplace_id`
- `region`

#### Table: `token_cache`
```sql
CREATE TABLE token_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Caches Amazon Ads API access tokens (valid for 1 hour)

**Service Values:**
- `amazon_ads` - Main access token entry

#### Table: `report_ledger`
```sql
CREATE TABLE report_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  report_type TEXT,
  time_period TEXT,
  url TEXT,
  url_expires_at TIMESTAMPTZ,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_timestamp TIMESTAMPTZ
);
```

**Purpose:** Tracks Amazon report requests and their status

**Status Values:**
- `PENDING` - Report requested, waiting for Amazon
- `PROCESSING` - Amazon is generating report
- `COMPLETED` - Report ready for download
- `FAILED` - Report generation failed

#### Table: `portfolios`
```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id TEXT UNIQUE NOT NULL,
  portfolio_name TEXT NOT NULL,
  portfolio_state TEXT DEFAULT 'ENABLED',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Stores portfolio metadata for linking to campaigns

**Notes:**
- `portfolio_id` is Amazon's identifier (can be numeric or string)
- Only ENABLED portfolios are stored
- Table is cleared and refreshed on each workflow run

#### Table: `placement_bids`
```sql
CREATE TABLE placement_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_status TEXT NOT NULL,
  campaign_budget DECIMAL(10,2),
  portfolio_id TEXT,
  placement_top_of_search INTEGER DEFAULT 0,
  placement_rest_of_search INTEGER DEFAULT 0,
  placement_product_page INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id)
);
```

**Purpose:** Stores current placement bid adjustments from campaigns

**Bid Adjustment Values:**
- Integer percentages (0-900)
- 0 = no adjustment (use base bid)
- 65 = 65% increase over base bid

#### Table: `raw_campaign_reports`
```sql
CREATE TABLE raw_campaign_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  data_date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  campaign_status TEXT,
  campaign_budget_amount DECIMAL(10,2),
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  top_of_search_impression_share DECIMAL(10,6),
  purchases_14d INTEGER DEFAULT 0,
  sales_14d DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Stores raw campaign-level data from Amazon reports

**Report Types:**
- `30day` - 30-day summary data
- `7day` - 7-day summary data
- `yesterday` - Daily data for yesterday
- `dayBefore` - Daily data for day before yesterday

**Indexes:**
```sql
CREATE INDEX idx_raw_campaign_campaign_id ON raw_campaign_reports(campaign_id);
CREATE INDEX idx_raw_campaign_report_type ON raw_campaign_reports(report_type);
CREATE INDEX idx_raw_campaign_date ON raw_campaign_reports(data_date);
```

#### Table: `raw_placement_reports`
```sql
CREATE TABLE raw_placement_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  data_date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  campaign_status TEXT,
  placement_classification TEXT NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  purchases_14d INTEGER DEFAULT 0,
  sales_14d DECIMAL(10,2) DEFAULT 0,
  purchases_30d INTEGER DEFAULT 0,
  sales_30d DECIMAL(10,2) DEFAULT 0,
  purchases_7d INTEGER DEFAULT 0,
  sales_7d DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:** Stores raw placement-level data from Amazon reports

**Placement Classification Values:**
- `PLACEMENT_TOP`
- `PLACEMENT_REST_OF_SEARCH`
- `PLACEMENT_PRODUCT_PAGE`

**Indexes:**
```sql
CREATE INDEX idx_raw_placement_campaign_id ON raw_placement_reports(campaign_id);
CREATE INDEX idx_raw_placement_report_type ON raw_placement_reports(report_type);
CREATE INDEX idx_raw_placement_classification ON raw_placement_reports(placement_classification);
```

### 8.2 Main View: `view_placement_optimization_report`

This view aggregates all data sources into the final report format:

```sql
CREATE OR REPLACE VIEW view_placement_optimization_report AS
WITH
-- Aggregate 30-day placement data
placement_30d AS (
  SELECT
    campaign_id,
    campaign_name,
    placement_classification,
    SUM(clicks) AS clicks_30,
    SUM(spend) AS spend_30,
    SUM(purchases_30d) AS orders_30,
    SUM(sales_30d) AS sales_30
  FROM raw_placement_reports
  WHERE report_type = '30day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id, campaign_name, placement_classification
),

-- Aggregate 7-day placement data
placement_7d AS (
  SELECT
    campaign_id,
    placement_classification,
    SUM(clicks) AS clicks_7,
    SUM(spend) AS spend_7,
    SUM(purchases_7d) AS orders_7,
    SUM(sales_7d) AS sales_7
  FROM raw_placement_reports
  WHERE report_type = '7day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id, placement_classification
),

-- Get yesterday's spend
campaign_yesterday AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_yesterday
  FROM raw_campaign_reports
  WHERE report_type = 'yesterday'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id
),

-- Get day before yesterday's spend
campaign_day_before AS (
  SELECT
    campaign_id,
    SUM(spend) AS spent_db_yesterday
  FROM raw_campaign_reports
  WHERE report_type = 'dayBefore'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id
),

-- Get TOS impression share data
campaign_30d AS (
  SELECT
    campaign_id,
    campaign_budget_amount,
    AVG(top_of_search_impression_share) AS tos_is_30
  FROM raw_campaign_reports
  WHERE report_type = '30day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id, campaign_budget_amount
),

campaign_7d AS (
  SELECT
    campaign_id,
    AVG(top_of_search_impression_share) AS tos_is_7
  FROM raw_campaign_reports
  WHERE report_type = '7day'
    AND campaign_status = 'ENABLED'
  GROUP BY campaign_id
),

campaign_yesterday_tos AS (
  SELECT
    campaign_id,
    top_of_search_impression_share AS tos_is_yesterday
  FROM raw_campaign_reports
  WHERE report_type = 'yesterday'
    AND campaign_status = 'ENABLED'
)

-- Main query joining all CTEs
SELECT
  p30.campaign_name AS "Campaign",
  port.portfolio_name AS "Portfolio",
  c30.campaign_budget_amount AS "Budget",
  p30.clicks_30 AS "Clicks",
  p30.spend_30 AS "Spend",
  p30.orders_30 AS "Orders",
  CASE
    WHEN p30.clicks_30 > 0 THEN (p30.orders_30::DECIMAL / p30.clicks_30) * 100
    ELSE 0
  END AS "CVR",
  CASE
    WHEN p30.sales_30 > 0 THEN (p30.spend_30 / p30.sales_30) * 100
    ELSE 0
  END AS "ACoS",
  p7.clicks_7 AS "Clicks_7d",
  p7.spend_7 AS "Spend_7d",
  p7.orders_7 AS "Orders_7d",
  CASE
    WHEN p7.clicks_7 > 0 THEN (p7.orders_7::DECIMAL / p7.clicks_7) * 100
    ELSE 0
  END AS "CVR_7d",
  CASE
    WHEN p7.sales_7 > 0 THEN (p7.spend_7 / p7.sales_7) * 100
    ELSE 0
  END AS "ACoS_7d",
  cdb.spent_db_yesterday AS "Spent DB Yesterday",
  cy.spent_yesterday AS "Spent Yesterday",
  c30.tos_is_30 AS "Last 30 days",
  c7.tos_is_7 AS "Last 7 days",
  cy_tos.tos_is_yesterday AS "Yesterday",
  CASE
    WHEN p30.placement_classification = 'PLACEMENT_TOP' THEN 'Placement Top'
    WHEN p30.placement_classification = 'PLACEMENT_REST_OF_SEARCH' THEN 'Placement Rest Of Search'
    WHEN p30.placement_classification = 'PLACEMENT_PRODUCT_PAGE' THEN 'Placement Product Page'
    ELSE p30.placement_classification
  END AS "Placement Type",
  CASE
    WHEN p30.placement_classification = 'PLACEMENT_TOP' THEN pb.placement_top_of_search
    WHEN p30.placement_classification = 'PLACEMENT_REST_OF_SEARCH' THEN pb.placement_rest_of_search
    WHEN p30.placement_classification = 'PLACEMENT_PRODUCT_PAGE' THEN pb.placement_product_page
    ELSE 0
  END AS "Increase bids by placement",
  '' AS "Changes in placement",  -- Populated by application logic
  '' AS "NOTES"  -- Left blank for manual input

FROM placement_30d p30
LEFT JOIN placement_7d p7
  ON p30.campaign_id = p7.campaign_id
  AND p30.placement_classification = p7.placement_classification
LEFT JOIN campaign_30d c30 ON p30.campaign_id = c30.campaign_id
LEFT JOIN campaign_7d c7 ON p30.campaign_id = c7.campaign_id
LEFT JOIN campaign_yesterday cy ON p30.campaign_id = cy.campaign_id
LEFT JOIN campaign_day_before cdb ON p30.campaign_id = cdb.campaign_id
LEFT JOIN campaign_yesterday_tos cy_tos ON p30.campaign_id = cy_tos.campaign_id
LEFT JOIN placement_bids pb ON p30.campaign_id = pb.campaign_id
LEFT JOIN portfolios port ON pb.portfolio_id = port.portfolio_id

WHERE p30.spend_30 > 0  -- Only include campaigns with spend

ORDER BY
  port.portfolio_name,
  p30.campaign_name,
  p30.placement_classification;
```

### 8.3 Data Lifecycle

1. **Clear Old Data:**
   - Delete all rows from `raw_campaign_reports`
   - Delete all rows from `raw_placement_reports`
   - Delete all rows from `placement_bids`
   - Delete all rows from `portfolios`

2. **Load Fresh Data:**
   - Insert portfolios
   - Insert placement bids (depends on portfolios)
   - Request reports via Amazon API
   - Poll until reports complete
   - Download and insert report data

3. **Generate Report:**
   - Query `view_placement_optimization_report`
   - Apply optimization logic
   - Export to Google Sheets

**Frequency:** Weekly (Wednesdays at 09:05 UTC = 1:05 AM PST)

---

## 9. Report Generation Workflow

### 9.1 Current N8N Workflow Architecture

The existing system uses three N8N workflows:

#### Workflow 1: Data Collection (ID: ycddFmmEWVANOot1)
**Trigger:** Schedule (Weekly, Wednesday 09:05 UTC)

**Steps:**
1. Clear Supabase tables (placement_bids, portfolios)
2. Decrypt credentials from Google KMS
3. Get/refresh Amazon Ads API access token
4. Set date variables (30-day, 7-day, yesterday, dayBefore)
5. Get Amazon advertising profiles
6. Request 6 reports in parallel (with rate limiting):
   - Campaign 30-day
   - Campaign 7-day
   - Placement 30-day
   - Placement 7-day
   - Campaign yesterday
   - Campaign day before
7. Store report metadata in `report_ledger`
8. Fetch portfolios and store in Supabase
9. Fetch current placement bids and store in Supabase
10. Trigger Workflow 2 (Placement Data Processing)

#### Workflow 2: Data Processing (ID: vKcoz8TDF55wHGPo)
**Trigger:** Executed by Workflow 1

**Steps:**
1. Clear raw data tables (raw_campaign_reports, raw_placement_reports)
2. Get access token
3. Find PENDING reports in report_ledger
4. Poll each report for COMPLETED status (wait up to 45 minutes)
5. Download completed reports (GZIP JSON)
6. Decompress reports
7. Parse JSON and identify report type
8. Calculate metrics (CVR, ACoS)
9. Route data to correct Supabase table based on report type:
   - Campaign reports → `raw_campaign_reports`
   - Placement reports → `raw_placement_reports`
10. Mark reports as processed
11. Trigger Workflow 3 (Report Generation)

#### Workflow 3: Report Generation (ID: IgW59w9NEA8vN5ku)
**Trigger:** Executed by Workflow 2

**Steps:**
1. Set date variables (week number for naming)
2. Copy Google Sheets template via Drive API
3. Query `view_placement_optimization_report` from Supabase
4. Append all rows to new Google Sheet
5. Send Discord notification with link

### 9.2 Recommended Edge Functions Architecture

For the rebuilt system, replace N8N workflows with Supabase Edge Functions:

#### Edge Function 1: `amazon-report-collector`
**Trigger:** Cron job (weekly)

**Responsibilities:**
- Clear old data
- Authenticate with Amazon
- Fetch portfolios and placement bids
- Request all 6 reports
- Store report IDs in ledger
- Schedule report processor

**Technology:** Deno/TypeScript

#### Edge Function 2: `amazon-report-processor`
**Trigger:** Invoked by collector after 45-minute delay

**Responsibilities:**
- Check report status
- Download completed reports
- Decompress and parse JSON
- Insert into raw tables
- Invoke report generator

**Technology:** Deno/TypeScript

#### Edge Function 3: `placement-report-generator`
**Trigger:** Invoked by processor

**Responsibilities:**
- Query view_placement_optimization_report
- Apply optimization logic (calculate recommendations)
- Create Google Sheet from template
- Populate sheet with data
- Send notification

**Technology:** Deno/TypeScript with Google Sheets API

### 9.3 Error Handling and Recovery

#### Report Generation Failures
- **Symptom:** Report status stuck at PROCESSING or PENDING
- **Recovery:** Retry once after 2-hour wait, then alert

#### API Rate Limits
- **Symptom:** 429 Too Many Requests error
- **Recovery:** Exponential backoff (1s, 2s, 4s, 8s, 16s)

#### Missing Data
- **Symptom:** View returns 0 rows or incomplete data
- **Recovery:** Check raw tables for data, verify joins

#### Google Sheets Quota
- **Symptom:** API quota exceeded error
- **Recovery:** Retry next day, increase quota if recurring

### 9.4 Testing and Validation

**Data Quality Checks:**
1. Verify row counts match expected (campaigns × 3 placements)
2. Validate all percentages are between 0-100%
3. Check no NULL values in critical columns
4. Verify portfolio names are joined correctly
5. Confirm placement bid values match API data
6. Test CVR and ACoS calculations manually

**Report Validation:**
1. Spot-check 5 campaigns against Amazon UI
2. Verify totals match source data
3. Check date ranges are correct (33-day and 9-day windows)
4. Confirm placement types are properly mapped
5. Validate optimization recommendations make sense

---

## 10. Assumptions and Constraints

### 10.1 Assumptions

1. **Single Marketplace:** Report currently only handles US marketplace (can expand to CA, UK, EU)
2. **Sponsored Products Only:** Does not include Sponsored Brands or Sponsored Display
3. **Enabled Campaigns:** Only ENABLED campaigns with spend > $0 are included
4. **Currency:** All amounts in USD
5. **Attribution Window:** Using Amazon's default attribution (14-day, 30-day windows)
6. **Data Freshness:** 3-day lag ensures complete data (Amazon's attribution window)
7. **Google Sheets Access:** Service account has write access to Google Drive folder

### 10.2 Constraints

1. **Amazon API Limits:**
   - Report generation takes 30-45 minutes
   - Rate limits: 1 request/second sustained
   - Maximum 6 simultaneous report generations

2. **Supabase Limits:**
   - Database size limits (plan dependent)
   - Edge Function execution time: 10 minutes max
   - Storage for report data (typically <100MB per week)

3. **Google Sheets Limits:**
   - 10 million cells per spreadsheet
   - 5000 rows typical for this report
   - API quota: 500 requests per 100 seconds per project

4. **Time Constraints:**
   - Full workflow takes ~60-90 minutes
   - Reports must complete before business hours

### 10.3 Known Issues

1. **Array Formula Column (P):** The template has an array formula object that isn't properly documented. May need to recreate manually or omit.

2. **Top of Search IS for 7-Day:** The 7-day campaign report should include topOfSearchImpressionShare but workflow JSON shows it might be missing from some reports.

3. **Sales Data:** The view uses `sales_30d` and `sales_7d` for ACoS calculations, but Amazon returns `purchases30d` and `purchases7d`. Need to confirm if these include sales amounts or just order counts.

4. **Placement Type Mapping:** Amazon's `placementClassification` values must exactly match the mapping logic (case-sensitive).

---

## 11. Next Steps for Implementation Agents

### For Amazon Ads API Expert Agent:

1. **Implement Authentication Flow**
   - LWA token exchange with refresh token
   - Token caching (1-hour expiry)
   - Automatic refresh on 401 errors

2. **Implement Report Request Functions**
   - All 6 report types as documented in section 5.2
   - Include proper error handling and retries
   - Return report IDs for status tracking

3. **Implement Report Status Polling**
   - Poll every 60 seconds
   - Maximum 60 attempts (1 hour)
   - Return download URL when COMPLETED

4. **Implement Data Fetching**
   - GET /portfolios/list
   - POST /sp/campaigns/list (for placement bids)
   - Extract nested data structures correctly

5. **Provide Clean JSON Output**
   - Normalize all numeric values
   - Handle NULL/empty values
   - Include metadata (report type, date range)

### For Supabase Architect Agent:

1. **Review Existing Schema**
   - Validate table structures match spec
   - Add missing indexes if needed
   - Verify foreign key constraints

2. **Implement/Update View**
   - Create `view_placement_optimization_report`
   - Test all JOIN logic
   - Validate calculations (CVR, ACoS)
   - Optimize performance (materialized view if needed)

3. **Create Edge Functions**
   - Report collector function
   - Report processor function
   - Report generator function
   - Shared utility modules (auth, API clients)

4. **Implement Google Sheets Integration**
   - Service account authentication
   - Template copy operation
   - Batch row append
   - Error handling for quota limits

5. **Set Up Cron Jobs**
   - Weekly trigger (Wednesday 09:05 UTC)
   - Status check jobs (for monitoring)

---

## Appendix A: Sample Data Structures

### Sample API Response: Placement Report (30-Day)

```json
[
  {
    "campaignId": "123456789",
    "campaignName": "RamenToppings-SP-\"Competitor Isolation\"-ASIN(Exact)-2025Q2",
    "campaignStatus": "ENABLED",
    "campaignBudgetAmount": 60.00,
    "placementClassification": "PLACEMENT_TOP",
    "impressions": 12543,
    "clicks": 833,
    "spend": 404.07,
    "purchases30d": 103,
    "sales30d": 1103.85
  },
  {
    "campaignId": "123456789",
    "campaignName": "RamenToppings-SP-\"Competitor Isolation\"-ASIN(Exact)-2025Q2",
    "campaignStatus": "ENABLED",
    "campaignBudgetAmount": 60.00,
    "placementClassification": "PLACEMENT_REST_OF_SEARCH",
    "impressions": 5234,
    "clicks": 382,
    "spend": 117.28,
    "purchases30d": 38,
    "sales30d": 423.26
  },
  {
    "campaignId": "123456789",
    "campaignName": "RamenToppings-SP-\"Competitor Isolation\"-ASIN(Exact)-2025Q2",
    "campaignStatus": "ENABLED",
    "campaignBudgetAmount": 60.00,
    "placementClassification": "PLACEMENT_PRODUCT_PAGE",
    "impressions": 2156,
    "clicks": 256,
    "spend": 73.82,
    "purchases30d": 14,
    "sales30d": 142.23
  }
]
```

### Sample View Output Row

```json
{
  "Campaign": "RamenToppings-SP-\"Competitor Isolation\"-ASIN(Exact)-2025Q2",
  "Portfolio": "Ramen Bomb",
  "Budget": 60.00,
  "Clicks": 833,
  "Spend": 404.07,
  "Orders": 103,
  "CVR": 12.36,
  "ACoS": 36.61,
  "Clicks_7d": 202,
  "Spend_7d": 96.82,
  "Orders_7d": 13,
  "CVR_7d": 6.44,
  "ACoS_7d": 81.46,
  "Spent DB Yesterday": 25.96,
  "Spent Yesterday": 13.90,
  "Last 30 days": 5.63,
  "Last 7 days": 5.69,
  "Yesterday": 8.33,
  "Placement Type": "Placement Top",
  "Increase bids by placement": 65,
  "Changes in placement": "",
  "NOTES": ""
}
```

---

## Appendix B: Glossary

- **ACoS (Advertising Cost of Sale):** Ratio of ad spend to attributed sales, expressed as percentage
- **Attribution Window:** Time period after click where conversions are counted (7d, 14d, 30d)
- **CVR (Conversion Rate):** Percentage of clicks that result in orders
- **ENABLED:** Amazon campaign/portfolio status indicating active state
- **LWA (Login with Amazon):** OAuth authentication system for Amazon APIs
- **Placement:** Where an ad appears (Top of Search, Rest of Search, Product Page)
- **Placement Bid Adjustment:** Percentage increase/decrease applied to bids for specific placements
- **ROAS (Return on Ad Spend):** Inverse of ACoS; revenue generated per dollar spent
- **Sponsored Products:** Amazon's keyword-targeted PPC ad type
- **TOS IS (Top of Search Impression Share):** Percentage of TOS impressions won vs. available
- **View:** Supabase/PostgreSQL database view (virtual table with query logic)

---

## Document Control

**Created By:** Amazon Placement Report Assistant Agent
**Created Date:** 2025-11-03
**Last Updated:** 2025-11-03
**Version:** 1.0
**Status:** Initial Specification

**Review Status:**
- [ ] Reviewed by Amazon Ads API Expert
- [ ] Reviewed by Supabase Architect
- [ ] Reviewed by Project Lead
- [ ] Approved for Implementation

**Change Log:**
- 2025-11-03: Initial specification created from analysis of existing system

---

**END OF SPECIFICATION**
