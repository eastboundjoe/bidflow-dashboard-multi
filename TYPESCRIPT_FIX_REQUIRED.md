# TypeScript Implementation Fix - Report Request Configuration

## Problem Summary

Your TypeScript report requests are failing with 400 errors because they're missing the required `reportTypeId` parameter and using incorrect `groupBy` values.

---

## Current Broken Code (Lines 262-281)

**File:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/placement-optimization-functions/supabase/functions/report-collector-multitenant/index.ts`

```typescript
const reportResponse = await amazonClient.post(
  'https://advertising-api.amazon.com/reporting/reports',
  {
    name: reportConfig.name,
    startDate: reportConfig.start_date,
    endDate: reportConfig.end_date,
    configuration: {
      adProduct: 'SPONSORED_PRODUCTS',
      groupBy: reportConfig.api_report_type === 'placements' ? ['placement'] : ['campaign'],  // ❌ WRONG
      columns: reportConfig.metrics.split(','),  // ❌ INSUFFICIENT
      timeUnit: 'SUMMARY',
      format: 'GZIP_JSON'
      // ❌ MISSING: reportTypeId
    }
  },
  {
    'Amazon-Advertising-API-Scope': profileId,
    'Accept': 'application/vnd.createasyncreportrequest.v3+json',
    'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
  }
)
```

---

## Required Fix

### 1. Update the Report Configuration (Lines 200-249)

**Current (BROKEN):**
```typescript
const reportRequests = [
  {
    name: 'Campaign Performance - 30 Day',
    db_report_type: 'campaign_30day',
    api_report_type: 'campaigns',
    metrics: 'impressions,clicks,cost',
    start_date: startDate30,
    end_date: today
  },
  // ... more configs
  {
    name: 'Placement Report - 30 Day',
    db_report_type: 'placement_30day',
    api_report_type: 'placements',  // ❌ This is misleading
    metrics: 'impressions,clicks,cost',  // ❌ Insufficient
    start_date: startDate30,
    end_date: today
  }
]
```

**Fixed (WORKING):**
```typescript
const reportRequests = [
  {
    name: 'Campaign Performance - 30 Day',
    db_report_type: 'campaign_30day',
    report_type_id: 'spCampaigns',  // ✅ REQUIRED
    group_by: ['campaign'],  // ✅ Campaign-level only
    columns: [
      'campaignId',
      'campaignName',
      'campaignStatus',
      'campaignBudgetAmount',
      'impressions',
      'clicks',
      'spend',
      'purchases30d',
      'sales30d',
      'topOfSearchImpressionShare'
    ],
    start_date: startDate30,
    end_date: today
  },
  {
    name: 'Campaign Performance - 7 Day',
    db_report_type: 'campaign_7day',
    report_type_id: 'spCampaigns',  // ✅ REQUIRED
    group_by: ['campaign'],
    columns: [
      'campaignId',
      'campaignName',
      'campaignStatus',
      'impressions',
      'clicks',
      'spend'
    ],
    start_date: startDate7,
    end_date: today
  },
  {
    name: 'Campaign Performance - Yesterday',
    db_report_type: 'campaign_yesterday',
    report_type_id: 'spCampaigns',
    group_by: ['campaign'],
    columns: [
      'campaignId',
      'campaignName',
      'campaignStatus',
      'date',
      'spend'
    ],
    time_unit: 'DAILY',  // ✅ Use DAILY for single-day reports
    start_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    name: 'Campaign Performance - Day Before Yesterday',
    db_report_type: 'campaign_day_before',
    report_type_id: 'spCampaigns',
    group_by: ['campaign'],
    columns: ['campaignId', 'campaignName', 'date', 'spend'],
    time_unit: 'DAILY',
    start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  {
    name: 'Placement Report - 30 Day',
    db_report_type: 'placement_30day',
    report_type_id: 'spCampaigns',  // ✅ Still spCampaigns!
    group_by: ['campaign', 'campaignPlacement'],  // ✅ THIS is what makes it a placement report
    columns: [
      'campaignId',
      'campaignName',
      'campaignStatus',
      'campaignBudgetAmount',
      'placementClassification',  // ✅ This column provides placement type
      'impressions',
      'clicks',
      'spend',
      'purchases30d',
      'sales30d'
    ],
    start_date: startDate30,
    end_date: today
  },
  {
    name: 'Placement Report - 7 Day',
    db_report_type: 'placement_7day',
    report_type_id: 'spCampaigns',  // ✅ Still spCampaigns!
    group_by: ['campaign', 'campaignPlacement'],  // ✅ Placement breakdown
    columns: [
      'campaignId',
      'campaignName',
      'campaignStatus',
      'placementClassification',
      'impressions',
      'clicks',
      'spend'
    ],
    start_date: startDate7,
    end_date: today
  }
]
```

### 2. Update the API Call (Lines 262-281)

**Fixed:**
```typescript
try {
  const reportResponse = await amazonClient.post(
    'https://advertising-api.amazon.com/reporting/reports',
    {
      name: reportConfig.name,
      startDate: reportConfig.start_date,
      endDate: reportConfig.end_date,
      configuration: {
        adProduct: 'SPONSORED_PRODUCTS',
        reportTypeId: reportConfig.report_type_id,  // ✅ REQUIRED - always 'spCampaigns'
        groupBy: reportConfig.group_by,  // ✅ Either ['campaign'] or ['campaign', 'campaignPlacement']
        columns: reportConfig.columns,  // ✅ Full column list
        timeUnit: reportConfig.time_unit || 'SUMMARY',  // ✅ Default to SUMMARY, use DAILY for single-day
        format: 'GZIP_JSON'
      }
    },
    {
      'Amazon-Advertising-API-Scope': profileId,
      'Accept': 'application/vnd.createasyncreportrequest.v3+json',
      'Content-Type': 'application/vnd.createasyncreportrequest.v3+json'
    }
  )

  // ... rest of your code
```

---

## Key Insights from n8n Flow

### 1. All Reports Use `reportTypeId: "spCampaigns"`
Even placement reports use the `spCampaigns` report type. The difference is in the `groupBy` parameter:
- Campaign reports: `groupBy: ["campaign"]`
- Placement reports: `groupBy: ["campaign", "campaignPlacement"]`

### 2. Required Columns
Always include these essential columns:
- `campaignId` - Required for identification
- `campaignName` - Required for display
- `campaignStatus` - Required for filtering

For placement reports, add:
- `placementClassification` - This provides the placement type (Top, Rest of Search, Product Page)

### 3. TimeUnit Selection
- Use `timeUnit: "SUMMARY"` for multi-day date ranges
- Use `timeUnit: "DAILY"` for single-day reports
- When using DAILY, include `date` column

### 4. Column Name: `spend` not `cost`
Amazon's API uses `spend` not `cost`:
- ✅ Correct: `"spend"`
- ❌ Wrong: `"cost"`

---

## Testing Strategy

After making these changes:

1. **Test with dry_run=false** to request real reports
2. **Check the database** for report_requests with status='PENDING'
3. **Wait 30-45 minutes** for Amazon to generate reports
4. **Run report-processor** to download completed reports
5. **Verify data** appears in placement_performance table

---

## Why This Was Hard to Debug

1. **Amazon's API doesn't clearly document** that placement reports still use `reportTypeId: "spCampaigns"`
2. **The error messages are vague** - just "400 Bad Request" without details
3. **The groupBy difference is subtle** - easy to assume there's a separate placement report type
4. **Column names changed** - `cost` → `spend` in newer API versions

The only way to discover this was to analyze a working implementation (the n8n flow).

---

## Expected Result After Fix

When you make these changes, you should see:

1. **Successful report requests** - `reportId` returned from Amazon
2. **Database records created** in `report_requests` table
3. **No 400 errors** - API accepts the configuration
4. **Reports complete** after 30-45 minutes
5. **Data flows correctly** through report-processor into placement_performance

The n8n workflow has proven these configurations work in production for months.
