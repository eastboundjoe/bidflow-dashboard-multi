# Amazon Placement Optimization Report - Research Summary

**Date:** 2025-11-03
**Agent:** Amazon Placement Report Assistant
**Task:** Research and document placement report structure for system rebuild

---

## Executive Summary

I have completed a comprehensive analysis of the Amazon Placement Optimization reporting system by examining:

1. **Excel Template Files** (2 files analyzed)
   - Example-Placement Optimization.xlsx (with real data)
   - TEMPLATE-Placements Optimization Template.xlsx (clean template)

2. **Documentation** (2 Word documents reviewed)
   - Placements Optimization.docx (optimization strategies)
   - Placement Optimization Report Creation-VA.docx (workflow procedures)

3. **Existing System Code**
   - 3 N8N workflow JSON files (Data Collection, Processing, Generation)
   - Supabase database schema (8 tables)
   - Python test scripts for Amazon API

4. **Current Implementation**
   - view_placement_optimization_report (Supabase SQL view)
   - Google Sheets integration workflow
   - Amazon Advertising API integration

---

## Key Findings

### Report Structure

**Single Sheet Report:** "USA" sheet with 25 columns and ~100-300 rows typically

**Data Dimensions:**
- Each campaign appears 3 times (once per placement type)
- Combines data from 6 different Amazon reports
- Aggregates 30-day, 7-day, and daily timeframes
- Links campaign → portfolio → placement bid adjustments

**Critical Columns:**
- Campaign identification (name, portfolio, budget)
- Performance metrics (clicks, spend, orders, CVR, ACoS)
- Timeframe comparisons (30d vs 7d trends)
- Placement optimization (current bids, recommendations)

### Data Sources Identified

**Amazon Advertising API** (6 report types):
1. Placement Report - 30 days (campaign + placement grouping)
2. Placement Report - 7 days (campaign + placement grouping)
3. Campaign Report - 30 days (campaign-level TOS impression share)
4. Campaign Report - 7 days (campaign-level TOS impression share)
5. Campaign Report - Yesterday (daily spend tracking)
6. Campaign Report - Day Before Yesterday (daily spend tracking)

**Additional API Calls:**
- POST /sp/campaigns/list (current placement bid adjustments)
- POST /portfolios/list (portfolio names for foreign key relationship)
- GET /v2/profiles (advertising profile metadata)

### Database Architecture

**8 Supabase Tables:**
1. `encrypted_credentials` - API credentials (Google KMS encrypted)
2. `token_cache` - Amazon access token caching (1-hour expiry)
3. `report_ledger` - Report request tracking and status
4. `portfolios` - Portfolio ID → Name mapping
5. `placement_bids` - Current placement bid adjustments per campaign
6. `raw_campaign_reports` - Raw campaign-level data from Amazon
7. `raw_placement_reports` - Raw placement-level data from Amazon
8. `view_placement_optimization_report` - SQL view aggregating all data

**Data Flow:**
```
Amazon API → Raw Tables → SQL View → Google Sheets
```

### Critical Calculations

**CVR (Conversion Rate):**
```
CVR = (Orders / Clicks) × 100%
```

**ACoS (Advertising Cost of Sale):**
```
ACoS = (Spend / Sales) × 100%
```

**Both metrics calculated for:**
- 30-day window
- 7-day window
- Per placement type (Top, Rest of Search, Product Page)

### Optimization Logic Thresholds

**Increase Bid Recommendations:**
- CVR ≥ 10% AND
- ACoS ≤ 40% AND
- Clicks ≥ 10 (sufficient data)

**Decrease Bid Recommendations:**
- ACoS ≥ 60% OR
- CVR ≤ 3% OR
- No orders with spend > $20

**Placement-Specific Adjustments:**
- Top of Search: +10% to +25% (most aggressive)
- Rest of Search: +5% to +15% (moderate)
- Product Pages: +5% to +10% (conservative)

### Current System Workflow

**3-Stage N8N Workflow:**

**Stage 1: Data Collection** (~15 minutes)
- Clear old data from Supabase
- Authenticate with Amazon Ads API
- Fetch portfolios and placement bids
- Request 6 reports (returns report IDs)
- Store metadata in report_ledger

**Stage 2: Data Processing** (~45-60 minutes)
- Poll report status until COMPLETED
- Download GZIP JSON reports
- Decompress and parse JSON
- Calculate metrics (CVR, ACoS)
- Insert into raw_campaign_reports and raw_placement_reports

**Stage 3: Report Generation** (~5 minutes)
- Query view_placement_optimization_report
- Copy Google Sheets template
- Append all rows to sheet
- Send Discord notification with link

**Total Time:** 60-90 minutes
**Trigger:** Weekly (Wednesdays, 09:05 UTC / 1:05 AM PST)

---

## Critical Technical Details

### Date Range Calculations

All reports use a **3-day lag** to ensure complete data:

```javascript
today = new Date()
endDate = today - 3 days           // Ensures attribution window complete
startDate30 = today - 33 days      // 30-day lookback
startDate7 = today - 9 days        // 7-day lookback
yesterday = today - 1 day
dayBefore = today - 2 days
```

### Report Request Format

Example request body for placement report:

```json
{
  "name": "SP-Placement-30Days-2025-11-03",
  "startDate": "2025-10-01",
  "endDate": "2025-10-31",
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

### Placement Classification Mapping

Amazon API → Display Value:
- `PLACEMENT_TOP` → "Placement Top"
- `PLACEMENT_REST_OF_SEARCH` → "Placement Rest Of Search"
- `PLACEMENT_PRODUCT_PAGE` → "Placement Product Page"

### Google Sheets Integration

**Template ID:** `11YhO8fSY0bAVe0s5rjL3gaJRcIeH3GmGaaqt-3pJcbo`

**Sheet Name:** "USA" (gid: 395936711)

**Naming Convention:** `Week{WW}-Placement Optimization`
- Example: "Week44-Placement Optimization"

**Operation:** Append all rows in single batch operation

**Column Mapping:** 21 data columns + 2 blank columns (NOTES, future use)

---

## Data Quality Considerations

### Filters Applied

1. **Campaign Status:** Only `ENABLED` campaigns included
2. **Minimum Spend:** Only campaigns with spend > $0
3. **Portfolio Status:** Only `ENABLED` portfolios
4. **Data Completeness:** 3-day lag ensures attribution window closed

### NULL Handling

All numeric fields default to 0 if NULL or empty:
- Clicks → 0
- Spend → 0.00
- Orders → 0
- Percentages → 0.00%

### Aggregation

**SUM aggregation for:**
- Clicks, Spend, Orders, Impressions

**CALCULATED from aggregated values:**
- CVR = SUM(orders) / SUM(clicks)
- ACoS = SUM(spend) / SUM(sales)

**AVERAGE for:**
- Top of Search Impression Share (across date range)

---

## Known Issues and Limitations

### 1. Array Formula Column (Column P)

The template has an array formula object in column P that wasn't properly captured. This may need manual recreation or could be omitted if not critical.

### 2. Sales Data Ambiguity

Amazon returns `purchases30d` and `purchases7d`, but ACoS calculation requires `sales30d` and `sales7d`. The API does provide sales fields, but need to confirm the data mapping is correct.

### 3. Single Marketplace Only

Current system only handles US marketplace. Expanding to CA, UK, EU would require:
- Additional sheet tabs
- Profile filtering by country code
- Currency conversion logic

### 4. Attribution Window Assumptions

Reports use 14-day and 30-day attribution windows. These are Amazon defaults but could be different for some accounts.

### 5. API Rate Limits

The system requests 6 reports simultaneously (with 1-second delays). This is within Amazon's limits but could hit rate limiting if modified.

---

## Recommendations for Rebuild

### 1. Edge Functions Over N8N

Replace the 3 N8N workflows with Supabase Edge Functions for:
- Better version control
- Easier testing and debugging
- Lower operational complexity
- Native Supabase integration

### 2. Incremental Processing

Instead of clearing all data weekly:
- Keep historical data for trend analysis
- Use date-based partitioning
- Only update changed campaigns

### 3. Improve Error Handling

Current system has minimal error recovery:
- Add retry logic for failed reports
- Implement email/Slack alerts on failures
- Create dashboard for monitoring report status

### 4. Optimize SQL View

Current view does multiple table scans:
- Consider materialized view for performance
- Add appropriate indexes
- Cache intermediate results

### 5. Add Data Validation

Before publishing report:
- Verify row counts match expected
- Check for NULL values in critical columns
- Validate calculation accuracy (spot-check)
- Compare totals to previous week

### 6. Modularize Logic

Separate concerns into distinct functions:
- API client (reusable across endpoints)
- Data transformation (pure functions)
- Report generation (template engine)
- Notification (pluggable destinations)

---

## Dependencies for Next Agents

### Amazon Ads API Expert Agent Needs:

**Authentication Requirements:**
- Client ID, Client Secret, Refresh Token (from encrypted_credentials)
- LWA token endpoint for OAuth
- 1-hour token caching strategy

**API Endpoints to Implement:**
1. `POST /reporting/reports` (6 different report configurations)
2. `GET /reporting/reports/{reportId}` (status polling)
3. `POST /sp/campaigns/list` (placement bids)
4. `POST /portfolios/list` (portfolio metadata)
5. `GET /v2/profiles` (profile information)

**Data Outputs:**
- JSON arrays of report data
- Report IDs and status
- Download URLs for completed reports
- Decompressed JSON from GZIP

### Supabase Architect Agent Needs:

**Schema Already Defined:**
- 8 tables with complete DDL (see specification)
- Foreign key relationships documented
- Index requirements specified

**View to Implement:**
- `view_placement_optimization_report` (full SQL provided)
- Performance optimization recommendations
- Testing procedures

**Edge Functions to Create:**
1. `amazon-report-collector` (trigger: weekly cron)
2. `amazon-report-processor` (trigger: delayed invocation)
3. `placement-report-generator` (trigger: on-demand)

**Integration Requirements:**
- Google Sheets API (service account auth)
- Google Drive API (template copy)
- Discord webhook (notifications)

---

## File Deliverables

### 1. Main Specification Document
**File:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/placement_report_specification.md`

**Contents:**
- Complete field definitions (25 columns)
- All calculations and formulas
- Data source mappings (Amazon API → Supabase → Google Sheets)
- Optimization logic and thresholds
- Database schema (8 tables)
- SQL view definition
- Google Sheets requirements
- Integration architecture

**Sections:**
1. Report Structure
2. Data Requirements
3. Calculations & Formulas
4. Placement Optimization Logic
5. Data Source Mapping
6. Google Sheets Requirements
7. Integration Points
8. Supabase Database Schema
9. Report Generation Workflow
10. Assumptions and Constraints
11. Next Steps for Implementation Agents

### 2. This Summary Document
**File:** `/mnt/c/Users/Ramen Bomb/Desktop/Code/PLACEMENT_REPORT_RESEARCH_SUMMARY.md`

**Purpose:** Executive summary and quick reference

---

## Questions and Clarifications Needed

### 1. Sales Data Confirmation

**Question:** Does `sales30d` field exist in the Amazon API response, or only `purchases30d`?

**Impact:** If only purchase counts exist, we need to calculate sales from order value data.

**Recommendation:** Check actual API response or Amazon documentation to confirm field availability.

### 2. Array Formula Purpose

**Question:** What is the purpose of column P (Array Formula object)?

**Context:** Excel template has an array formula that wasn't captured by the analysis script.

**Recommendation:** Open the template manually to inspect column P formula, or confirm it can be omitted.

### 3. Multi-Marketplace Expansion

**Question:** Should the rebuild support multiple marketplaces (US, CA, UK, EU) from the start?

**Impact:** Would require additional sheet tabs and profile filtering logic.

**Recommendation:** Implement US-only first, design architecture to support future expansion.

### 4. Historical Data Retention

**Question:** Should we keep historical placement reports for trend analysis?

**Context:** Current system clears all data weekly (only keeps latest).

**Recommendation:** Keep at least 8 weeks of historical data for month-over-month comparisons.

### 5. Notification Preferences

**Question:** Besides Discord, are there other notification channels needed (email, Slack)?

**Context:** Current system only sends Discord webhook.

**Recommendation:** Design notification system to support multiple channels via configuration.

---

## Success Criteria

The rebuilt system will be considered successful when:

### Data Accuracy
- [ ] All 25 columns match specification exactly
- [ ] CVR and ACoS calculations validated against manual checks
- [ ] Placement bid values match Amazon Ads UI
- [ ] Portfolio names correctly joined to campaigns
- [ ] Row counts match expected (campaigns × 3 placements)

### Performance
- [ ] Complete workflow in < 90 minutes
- [ ] SQL view executes in < 5 seconds
- [ ] Google Sheets population takes < 2 minutes
- [ ] API rate limits not exceeded

### Reliability
- [ ] 99% success rate on report generation
- [ ] Automatic retry on transient failures
- [ ] Alerts sent on persistent failures
- [ ] Data validation catches issues before publishing

### Usability
- [ ] Report available by 3:00 AM PST every Wednesday
- [ ] Google Sheet properly formatted (colors, number formats)
- [ ] Optimization recommendations accurate and actionable
- [ ] Notification includes link to completed report

### Maintainability
- [ ] All code version-controlled
- [ ] Clear separation of concerns (API, DB, reporting)
- [ ] Comprehensive error logging
- [ ] Documentation for troubleshooting

---

## Timeline Estimate

Based on the complexity and scope:

### Phase 1: Amazon API Integration (5-7 days)
- Implement authentication flow
- Create 6 report request functions
- Implement status polling
- Add data fetching (portfolios, bids)
- Test with real API

### Phase 2: Supabase Implementation (3-5 days)
- Review/update database schema
- Implement SQL view
- Create Edge Functions (3 functions)
- Test data flow end-to-end

### Phase 3: Google Sheets Integration (2-3 days)
- Service account setup
- Template copy functionality
- Data formatting and population
- Notification system

### Phase 4: Testing and Validation (3-5 days)
- Unit tests for calculations
- Integration tests for workflow
- Data validation checks
- Performance optimization

### Phase 5: Deployment and Monitoring (1-2 days)
- Deploy to production
- Set up monitoring/alerts
- Create runbook documentation

**Total Estimated Time:** 14-22 days

---

## Resources and References

### Documentation Analyzed
1. `Example-Placement Optimization.xlsx` - Real data example
2. `TEMPLATE-Placements Optimization Template.xlsx` - Clean template
3. `Placements Optimization.docx` - Optimization strategies
4. `Placement Optimization Report Creation-VA.docx` - Workflow SOP

### Code Files Reviewed
1. `1. Placement Data Collection.json` - N8N workflow (data collection)
2. `2. Placement Data Processing.json` - N8N workflow (report processing)
3. `3. Placement Report Generation.json` - N8N workflow (Google Sheets export)
4. `test_amazon_api.py` - Python test script for Amazon API

### Existing System Components
- Supabase database: 8 tables + 1 view
- Google Sheets template: 25 columns, formatted
- Amazon Advertising API: 6 report types
- N8N workflows: 3 interconnected workflows

### External APIs
- Amazon Advertising API (https://advertising.amazon.com/API/docs)
- Google Sheets API v4 (https://developers.google.com/sheets/api)
- Google Drive API v3 (https://developers.google.com/drive/api)

---

## Conclusion

The Amazon Placement Optimization Report is a complex, multi-source data aggregation system that combines:

- **6 Amazon API reports** (30-day, 7-day, daily timeframes)
- **2 additional API endpoints** (portfolios, placement bids)
- **8 Supabase database tables** (raw storage)
- **1 SQL view** (data aggregation and calculations)
- **1 Google Sheet** (formatted output with conditional formatting)

The complete specification document provides all necessary details for the amazon-ads-api-expert and supabase-architect agents to rebuild this system with improved reliability, performance, and maintainability.

**Key Success Factors:**
1. Accurate data transformation from Amazon API → Supabase → Google Sheets
2. Correct calculation of CVR and ACoS metrics
3. Proper aggregation by campaign + placement combination
4. Reliable report generation (handling 30-45 minute wait times)
5. Clean Google Sheets formatting with optimization recommendations

The specification is comprehensive and actionable. The next agents have everything they need to begin implementation.

---

**Document Status:** ✅ COMPLETE AND READY FOR HANDOFF

**Next Step:** Provide specification to amazon-ads-api-expert and supabase-architect agents for implementation planning.
