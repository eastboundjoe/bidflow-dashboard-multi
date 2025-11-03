# Amazon Placement Report - Quick Reference Data Points

This document provides the most critical data points in a concise format for quick lookup during implementation.

---

## Report Column Structure (25 Columns)

| # | Column | Type | Source | Calculation |
|---|--------|------|--------|-------------|
| A | Campaign | TEXT | API: campaignName | Direct |
| B | Portfolio | TEXT | JOIN portfolios table | portfolio_name |
| C | Budget | $ | API: campaignBudgetAmount | Direct |
| D | Clicks-30 | INT | API: placement report 30d | SUM(clicks) |
| E | Spend-30 | $ | API: placement report 30d | SUM(spend) |
| F | Orders-30 | INT | API: placement report 30d | purchases30d |
| G | CVR-30 | % | Calculated | (Orders-30 / Clicks-30) * 100 |
| H | ACoS-30 | % | Calculated | (Spend-30 / Sales-30) * 100 |
| I | Clicks-7 | INT | API: placement report 7d | SUM(clicks) |
| J | Spend-7 | $ | API: placement report 7d | SUM(spend) |
| K | Orders-7 | INT | API: placement report 7d | purchases7d |
| L | CVR-7 | % | Calculated | (Orders-7 / Clicks-7) * 100 |
| M | ACOS-7 | % | Calculated | (Spend-7 / Sales-7) * 100 |
| N | Spent DB Yesterday | $ | API: campaign report dayBefore | spend |
| O | Spent Yesterday | $ | API: campaign report yesterday | spend |
| P | (Array Formula) | FORMULA | Template | Internal |
| Q | Last 30 days | % | API: campaign report 30d | topOfSearchImpressionShare |
| R | Last 7 days | % | API: campaign report 7d | topOfSearchImpressionShare |
| S | Yesterday | % | API: campaign report yesterday | topOfSearchImpressionShare |
| T | Placement Type | TEXT | API: placementClassification | Map to display value |
| U | Increase bids by placement | INT | API: /sp/campaigns/list | Extract from dynamicBidding |
| V | Changes in placement | TEXT | Calculated | Apply optimization rules |
| W | NOTES | TEXT | Manual | Left blank |
| X | (Empty) | - | - | - |
| Y | (Empty) | - | - | - |

---

## 6 Amazon API Reports Required

### 1. Placement Report - 30 Days
```
POST /reporting/reports
reportTypeId: "spCampaigns"
timeUnit: "SUMMARY"
groupBy: ["campaign", "campaignPlacement"]
startDate: today - 33 days
endDate: today - 3 days
columns: [campaignId, campaignName, campaignStatus, campaignBudgetAmount,
          placementClassification, impressions, clicks, spend,
          purchases30d, sales30d]
```

### 2. Placement Report - 7 Days
```
POST /reporting/reports
reportTypeId: "spCampaigns"
timeUnit: "SUMMARY"
groupBy: ["campaign", "campaignPlacement"]
startDate: today - 9 days
endDate: today - 3 days
columns: [campaignId, campaignName, campaignStatus, placementClassification,
          clicks, spend, purchases7d, sales7d]
```

### 3. Campaign Report - 30 Days
```
POST /reporting/reports
reportTypeId: "spCampaigns"
timeUnit: "SUMMARY"
groupBy: ["campaign"]
startDate: today - 33 days
endDate: today - 3 days
columns: [campaignId, campaignName, campaignBudgetAmount, impressions, clicks,
          spend, purchases30d, sales30d, purchases14d, sales14d, purchases7d,
          sales7d, topOfSearchImpressionShare, campaignStatus]
```

### 4. Campaign Report - 7 Days
```
POST /reporting/reports
reportTypeId: "spCampaigns"
timeUnit: "SUMMARY"
groupBy: ["campaign"]
startDate: today - 9 days
endDate: today - 3 days
columns: [campaignId, campaignName, campaignBudgetAmount, impressions, clicks,
          spend, purchases7d, sales7d, purchases14d, sales14d, purchases30d,
          sales30d, topOfSearchImpressionShare, campaignStatus]
```

### 5. Campaign Report - Yesterday
```
POST /reporting/reports
reportTypeId: "spCampaigns"
timeUnit: "DAILY"
groupBy: ["campaign"]
startDate: today - 1 day
endDate: today - 1 day
columns: [campaignId, campaignName, campaignBudgetAmount,
          topOfSearchImpressionShare, date, campaignStatus, spend]
```

### 6. Campaign Report - Day Before
```
POST /reporting/reports
reportTypeId: "spCampaigns"
timeUnit: "DAILY"
groupBy: ["campaign"]
startDate: today - 2 days
endDate: today - 2 days
columns: [campaignId, campaignName, campaignBudgetAmount, campaignStatus,
          date, spend]
```

---

## Additional API Endpoints

### Get Portfolios
```
POST /portfolios/list
Body: {
  "stateFilter": { "include": ["ENABLED"] },
  "includeExtendedDataFields": true
}
Returns: { portfolios: [{ portfolioId, name, state }] }
```

### Get Current Placement Bids
```
POST /sp/campaigns/list
Body: {
  "stateFilter": { "include": ["ENABLED"] },
  "includeExtendedDataFields": true
}
Returns: { campaigns: [{
  campaignId, name, state, budget,
  dynamicBidding: {
    placementBidding: [
      { placement: "PLACEMENT_TOP", percentage: 65 },
      { placement: "PLACEMENT_REST_OF_SEARCH", percentage: 35 },
      { placement: "PLACEMENT_PRODUCT_PAGE", percentage: 0 }
    ]
  }
}]}
```

---

## Placement Type Mapping

| Amazon API Value | Display Value |
|-----------------|---------------|
| PLACEMENT_TOP | Placement Top |
| PLACEMENT_REST_OF_SEARCH | Placement Rest Of Search |
| PLACEMENT_PRODUCT_PAGE | Placement Product Page |

---

## Date Calculations

```javascript
const today = new Date();

// All reports end 3 days ago (attribution window buffer)
const endDate = new Date(today - 3 * 24 * 60 * 60 * 1000);

// 30-day window starts 33 days ago
const startDate30 = new Date(today - 33 * 24 * 60 * 60 * 1000);

// 7-day window starts 9 days ago
const startDate7 = new Date(today - 9 * 24 * 60 * 60 * 1000);

// Daily reports
const yesterday = new Date(today - 1 * 24 * 60 * 60 * 1000);
const dayBefore = new Date(today - 2 * 24 * 60 * 60 * 1000);

// Format: YYYY-MM-DD
const formatDate = (date) => date.toISOString().split('T')[0];
```

---

## Key Formulas

### Conversion Rate (CVR)
```
CVR = (Orders / Clicks) × 100

Handle division by zero: if Clicks = 0, return 0.00
Format: Two decimal places (e.g., "12.36")
```

### Advertising Cost of Sale (ACoS)
```
ACoS = (Spend / Sales) × 100

Handle division by zero: if Sales = 0, return 0.00
Format: Two decimal places (e.g., "36.61")
```

### Return on Ad Spend (ROAS)
```
ROAS = Sales / Spend

Alternative: 1 / (ACoS / 100)
Format: Two decimal places (e.g., "2.73")
```

---

## Optimization Thresholds

### Increase Bid
- CVR ≥ 10%
- AND ACoS ≤ 40%
- AND Clicks ≥ 10

**Recommended Increases:**
- Top of Search: +10% to +25%
- Rest of Search: +5% to +15%
- Product Pages: +5% to +10%

### Decrease Bid
- ACoS ≥ 60%
- OR CVR ≤ 3%
- OR (Orders = 0 AND Spend > $20)

**Recommended Decreases:**
- All Placements: -10% to -25%

### Maintain Bid
- Performance between thresholds
- New campaigns (< 7 days data)
- Insufficient volume (clicks < 10)

---

## Supabase Tables (8 Total)

### 1. encrypted_credentials
- credential_name (unique)
- encrypted_value (Google KMS)

### 2. token_cache
- service = "amazon_ads"
- access_token (1-hour expiry)
- expires_at

### 3. report_ledger
- report_id (Amazon's ID)
- status (PENDING → PROCESSING → COMPLETED)
- url (download link)
- processed (boolean flag)

### 4. portfolios
- portfolio_id (Amazon's ID)
- portfolio_name
- portfolio_state = "ENABLED"

### 5. placement_bids
- campaign_id
- campaign_name
- portfolio_id (foreign key)
- placement_top_of_search (0-900)
- placement_rest_of_search (0-900)
- placement_product_page (0-900)

### 6. raw_campaign_reports
- report_type (30day, 7day, yesterday, dayBefore)
- campaign_id
- data_date
- spend, clicks, impressions
- top_of_search_impression_share
- purchases_14d, sales_14d

### 7. raw_placement_reports
- report_type (30day, 7day)
- campaign_id
- placement_classification
- data_date
- spend, clicks, impressions
- purchases_7d, sales_7d
- purchases_14d, sales_14d
- purchases_30d, sales_30d

### 8. view_placement_optimization_report
SQL view that joins all tables and calculates metrics

---

## SQL View Logic (Simplified)

```sql
-- Aggregate 30-day placement data
WITH placement_30d AS (
  SELECT campaign_id, placement_classification,
         SUM(clicks) AS clicks_30,
         SUM(spend) AS spend_30,
         SUM(purchases_30d) AS orders_30,
         SUM(sales_30d) AS sales_30
  FROM raw_placement_reports
  WHERE report_type = '30day' AND campaign_status = 'ENABLED'
  GROUP BY campaign_id, placement_classification
),

-- Aggregate 7-day placement data
placement_7d AS (
  SELECT campaign_id, placement_classification,
         SUM(clicks) AS clicks_7,
         SUM(spend) AS spend_7,
         SUM(purchases_7d) AS orders_7,
         SUM(sales_7d) AS sales_7
  FROM raw_placement_reports
  WHERE report_type = '7day' AND campaign_status = 'ENABLED'
  GROUP BY campaign_id, placement_classification
),

-- Get campaign-level data (budget, TOS IS)
-- Get daily spend data
-- Get portfolio names

-- JOIN all CTEs
-- CALCULATE CVR and ACoS
-- MAP placement types to display values
-- EXTRACT placement bid adjustments
```

---

## Google Sheets Details

**Template ID:** 11YhO8fSY0bAVe0s5rjL3gaJRcIeH3GmGaaqt-3pJcbo

**Sheet Name:** USA (gid: 395936711)

**Naming:** Week{WW}-Placement Optimization

**Operation:** Google Sheets API v4 append operation

**Format Requirements:**
- Currency: $#,##0.00
- Percentages: 0.00%
- Integers: #,##0

**Conditional Formatting:**
- Green: Good performance (low ACoS, high CVR)
- Yellow: Moderate performance
- Red: Poor performance (high ACoS, low CVR)

---

## API Authentication Flow

1. **Get Refresh Token** (from encrypted_credentials)
   - sp_api_client_id
   - sp_api_client_secret
   - sp_api_refresh_token

2. **Request Access Token**
   ```
   POST https://api.amazon.com/auth/o2/token
   Body: {
     grant_type: "refresh_token",
     client_id: "...",
     client_secret: "...",
     refresh_token: "..."
   }
   Returns: { access_token, expires_in: 3600 }
   ```

3. **Cache Token** (store in token_cache)
   - Service: "amazon_ads"
   - Expires: now + 3600 seconds
   - Reuse until 5 minutes before expiry

4. **Use Token in Headers**
   ```
   Authorization: Bearer {access_token}
   Amazon-Advertising-API-ClientId: {advertising_client_id}
   Amazon-Advertising-API-Scope: {profileId}
   ```

---

## Report Status Polling

```javascript
// After requesting report, you get reportId
const reportId = response.reportId;

// Poll every 60 seconds, max 60 attempts (1 hour)
let attempts = 0;
const maxAttempts = 60;

while (attempts < maxAttempts) {
  const status = await checkReportStatus(profileId, reportId);

  if (status === 'COMPLETED') {
    const url = response.url;
    // Download and process report
    break;
  } else if (status === 'FAILED') {
    // Handle failure
    break;
  }

  // Wait 60 seconds before next check
  await sleep(60000);
  attempts++;
}

// Typical wait time: 30-45 minutes
```

---

## Data Types and NULL Handling

| Field Type | NULL Handling | Default |
|------------|---------------|---------|
| Numeric | Convert to 0 | 0 or 0.00 |
| Percentage | Convert to 0 | 0.00% |
| Currency | Convert to 0 | $0.00 |
| Text | Keep empty | "" |
| Division by 0 | Return 0 | 0.00% |

---

## Workflow Timing

| Stage | Duration | Notes |
|-------|----------|-------|
| Data Collection | 5-10 min | Fetch portfolios, bids, request reports |
| Report Wait | 30-45 min | Amazon generates reports |
| Data Processing | 10-15 min | Download, decompress, insert to DB |
| Report Generation | 2-5 min | Query view, create Google Sheet |
| **TOTAL** | **60-90 min** | Full workflow end-to-end |

**Schedule:** Wednesdays, 09:05 UTC (1:05 AM PST)

**Result:** Report available by ~3:00 AM PST

---

## Error Handling Checklist

- [ ] API rate limits (429 errors) → Exponential backoff
- [ ] Report generation timeout (>2 hours) → Alert and retry
- [ ] Missing data in view → Check raw tables, verify joins
- [ ] Division by zero → Return 0.00%
- [ ] NULL values → Convert to appropriate defaults
- [ ] Google Sheets quota exceeded → Retry next day
- [ ] Token expired → Refresh token automatically

---

## Testing Validation Points

### Data Accuracy
- [ ] Row count = campaigns × 3 placements
- [ ] CVR calculation matches manual check
- [ ] ACoS calculation matches manual check
- [ ] Placement bids match Amazon UI
- [ ] Portfolio names correctly joined

### Performance
- [ ] View query < 5 seconds
- [ ] Report generation < 90 minutes total
- [ ] No API rate limit errors

### Data Quality
- [ ] No NULL in critical columns (Campaign, Spend, Clicks)
- [ ] All percentages 0-100%
- [ ] All currency values ≥ 0
- [ ] Placement types mapped correctly

---

## Critical File Paths

### Generated Specification
`/mnt/c/Users/Ramen Bomb/Desktop/Code/placement_report_specification.md`

### Research Summary
`/mnt/c/Users/Ramen Bomb/Desktop/Code/PLACEMENT_REPORT_RESEARCH_SUMMARY.md`

### This Quick Reference
`/mnt/c/Users/Ramen Bomb/Desktop/Code/QUICK_REFERENCE_DATA_POINTS.md`

### Original Files Analyzed
- `/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow/project-docs/placement-optimization-guide/Example-Placement Optimization.xlsx`
- `/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow/project-docs/placement-optimization-guide/TEMPLATE-Placements Optimization Template.xlsx`
- `/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow/project-docs/1. Placement Data Collection.json`
- `/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow/project-docs/2. Placement Data Processing.json`
- `/mnt/c/Users/Ramen Bomb/Desktop/Code/bidflow/project-docs/3. Placement Report Generation.json`

---

**END OF QUICK REFERENCE**
