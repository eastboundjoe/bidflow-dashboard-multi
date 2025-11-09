# Exact Working Amazon Ads Report Configurations from n8n

## Important Discovery: All Reports Use reportTypeId: "spCampaigns"

Even placement reports use `reportTypeId: "spCampaigns"` - the difference is in the `groupBy` parameter!

---

## 1. Placement Report - 30 Days (WORKING)

**Endpoint:** `POST https://advertising-api.amazon.com/reporting/reports`

**Headers:**
```json
{
  "Authorization": "Bearer {access_token}",
  "Amazon-Advertising-API-ClientId": "{client_id}",
  "Amazon-Advertising-API-Scope": "{profile_id}",
  "Accept": "application/json",
  "Content-Type": "application/json"
}
```

**Request Body:**
```json
{
  "name": "SP-Placement-30Days-2025-11-09",
  "startDate": "2025-10-07",
  "endDate": "2025-11-06",
  "configuration": {
    "adProduct": "SPONSORED_PRODUCTS",
    "reportTypeId": "spCampaigns",
    "timeUnit": "SUMMARY",
    "format": "GZIP_JSON",
    "groupBy": ["campaign", "campaignPlacement"],
    "columns": [
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
  }
}
```

**Key Points:**
- Uses `reportTypeId: "spCampaigns"` even for placement reports
- `groupBy: ["campaign", "campaignPlacement"]` enables placement breakdown
- `placementClassification` column provides placement type

---

## 2. Placement Report - 7 Days (WORKING)

**Request Body:**
```json
{
  "name": "SP-Placement-7Days-2025-11-09",
  "startDate": "2025-10-31",
  "endDate": "2025-11-06",
  "configuration": {
    "adProduct": "SPONSORED_PRODUCTS",
    "reportTypeId": "spCampaigns",
    "timeUnit": "SUMMARY",
    "format": "GZIP_JSON",
    "groupBy": ["campaign", "campaignPlacement"],
    "columns": [
      "campaignId",
      "campaignName",
      "campaignStatus",
      "placementClassification",
      "clicks",
      "spend",
      "purchases7d",
      "sales7d"
    ]
  }
}
```

---

## 3. Campaign Report - 30 Days (WORKING)

**Request Body:**
```json
{
  "name": "SP-Campaign-30Days",
  "startDate": "2025-10-07",
  "endDate": "2025-11-06",
  "configuration": {
    "adProduct": "SPONSORED_PRODUCTS",
    "reportTypeId": "spCampaigns",
    "timeUnit": "SUMMARY",
    "format": "GZIP_JSON",
    "groupBy": ["campaign"],
    "columns": [
      "campaignId",
      "campaignName",
      "campaignBudgetAmount",
      "impressions",
      "clicks",
      "spend",
      "purchases30d",
      "sales30d",
      "purchases14d",
      "sales14d",
      "purchases7d",
      "sales7d",
      "topOfSearchImpressionShare",
      "campaignStatus"
    ]
  }
}
```

**Key Points:**
- `groupBy: ["campaign"]` for campaign-level reports (no placement breakdown)
- More comprehensive column list including multiple attribution windows

---

## 4. Campaign Report - 7 Days (WORKING)

**Request Body:**
```json
{
  "name": "SP-Campaign-7Days",
  "startDate": "2025-10-31",
  "endDate": "2025-11-06",
  "configuration": {
    "adProduct": "SPONSORED_PRODUCTS",
    "reportTypeId": "spCampaigns",
    "timeUnit": "SUMMARY",
    "format": "GZIP_JSON",
    "groupBy": ["campaign"],
    "columns": [
      "campaignId",
      "campaignName",
      "campaignBudgetAmount",
      "impressions",
      "clicks",
      "spend",
      "purchases7d",
      "sales7d",
      "purchases14d",
      "sales14d",
      "purchases30d",
      "sales30d",
      "topOfSearchImpressionShare",
      "campaignStatus"
    ]
  }
}
```

---

## 5. Campaign Report - Yesterday (WORKING)

**Request Body:**
```json
{
  "name": "SP-Campaign-Yesterday-2025-11-09",
  "startDate": "2025-11-08",
  "endDate": "2025-11-08",
  "configuration": {
    "adProduct": "SPONSORED_PRODUCTS",
    "reportTypeId": "spCampaigns",
    "timeUnit": "DAILY",
    "format": "GZIP_JSON",
    "groupBy": ["campaign"],
    "columns": [
      "campaignId",
      "campaignName",
      "campaignBudgetAmount",
      "topOfSearchImpressionShare",
      "date",
      "campaignStatus",
      "spend"
    ]
  }
}
```

**Key Points:**
- `timeUnit: "DAILY"` for daily reports (not SUMMARY)
- `date` column included when using DAILY timeUnit

---

## 6. Campaign Report - Day Before Yesterday (WORKING)

**Request Body:**
```json
{
  "name": "SP-Campaign-DayBefore-2025-11-09",
  "startDate": "2025-11-07",
  "endDate": "2025-11-07",
  "configuration": {
    "adProduct": "SPONSORED_PRODUCTS",
    "reportTypeId": "spCampaigns",
    "timeUnit": "DAILY",
    "format": "GZIP_JSON",
    "groupBy": ["campaign"],
    "columns": [
      "campaignId",
      "campaignName",
      "campaignBudgetAmount",
      "campaignStatus",
      "date",
      "spend"
    ]
  }
}
```

---

## Summary of Differences from Your TypeScript Implementation

### ❌ What You're Missing:

1. **`reportTypeId: "spCampaigns"`** - REQUIRED in all report requests
2. **Correct `groupBy` for placements:** `["campaign", "campaignPlacement"]` not `["placement"]`
3. **Essential columns:** Always include `campaignId`, `campaignName`, `campaignStatus`
4. **Placement column:** Use `placementClassification` (not some other field)

### ✅ What You Need to Fix:

```typescript
// WRONG (current):
{
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS',
    groupBy: ['placement'],  // ❌
    columns: ['impressions', 'clicks', 'cost'],  // ❌ missing essentials
    timeUnit: 'SUMMARY',
    format: 'GZIP_JSON'
  }
}

// RIGHT (from n8n):
{
  configuration: {
    adProduct: 'SPONSORED_PRODUCTS',
    reportTypeId: 'spCampaigns',  // ✅ REQUIRED
    groupBy: ['campaign', 'campaignPlacement'],  // ✅ Correct for placements
    columns: [
      'campaignId',           // ✅ Essential
      'campaignName',         // ✅ Essential
      'campaignStatus',       // ✅ Essential
      'placementClassification',  // ✅ For placement type
      'impressions',
      'clicks',
      'spend'
    ],
    timeUnit: 'SUMMARY',
    format: 'GZIP_JSON'
  }
}
```

---

## Testing Note

The n8n workflow successfully creates reports and stores them in the `report_ledger` table with:
- `reportId` from Amazon's response
- `status` starting as "PENDING"
- `createdAt` and `updatedAt` timestamps
- Download `url` (populated when report completes)

This configuration has been tested and works in production.
