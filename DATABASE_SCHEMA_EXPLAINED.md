# 📊 Database Schema Walkthrough - Plain English Guide

**Purpose:** Easy-to-understand explanation of the Amazon Placement Optimization database schema
**Audience:** Non-technical reference guide
**Date:** 2025-11-03

---

## 🎯 The Big Picture

You have **6 tables** organized into **3 layers**, plus **1 view** that brings it all together:

```
Layer 1: Tracking (Did the job run?)
Layer 2: Master Data (What campaigns do we have?)
Layer 3: Performance Data (How are campaigns doing?)
View: The Final Report (Combine everything into 25 columns)
```

---

## 📁 Layer 1: Execution Tracking (The Job Tracker)

### Table 1: `workflow_executions`
**What it does:** Keeps track of each weekly run

**Think of it like:** A logbook that records "Did we run the report this week?"

**Example:**
| Execution ID | Status | Started | Completed |
|--------------|--------|---------|-----------|
| 2025-11-03T09:05:00Z | COMPLETED | Nov 3, 9:05 AM | Nov 3, 10:30 AM |
| 2025-11-10T09:05:00Z | RUNNING | Nov 10, 9:05 AM | (still running) |

**Why we need it:** Prevents running the same report twice by accident

**Typical data:**
- ~52 rows per year (one per week)
- Shows execution time (usually 60-90 minutes)
- Tracks any errors that occurred

---

### Table 2: `report_requests`
**What it does:** Tracks the 6 Amazon API reports we request each week

**Think of it like:** A package tracking system - "Where's my Amazon report?"

**Example:**
| Report ID | Type | Status | Download URL |
|-----------|------|--------|--------------|
| amzn1.sd...001 | placement_30day | COMPLETED | https://... |
| amzn1.sd...002 | placement_7day | PROCESSING | (not ready yet) |
| amzn1.sd...003 | campaign_yesterday | COMPLETED | https://... |

**Why we need it:** Amazon takes 30-45 minutes to generate reports. We need to track which ones are ready to download.

**Typical data:**
- 6 rows per week (one per report type)
- Status goes: PENDING → PROCESSING → COMPLETED
- Stores download URLs that expire after a few hours

---

## 📋 Layer 2: Master Data (The Reference Tables)

### Table 3: `portfolios`
**What it does:** Maps portfolio IDs to names

**Think of it like:** A contact list that says "Portfolio #123456 = Ramen Bomb"

**Example:**
| Portfolio ID | Portfolio Name |
|--------------|----------------|
| 123456789 | Ramen Bomb |
| 987654321 | Premium Products |

**Why we need it:** Amazon returns portfolio IDs (just numbers). We need to show readable names in the report.

**Typical data:**
- 10-20 rows
- Refreshed every week (deleted and reloaded)
- Only stores ENABLED portfolios

---

### Table 4: `campaigns`
**What it does:** Stores campaign information + current bid adjustments

**Think of it like:** A master list of all your campaigns with their settings

**Example:**
| Campaign ID | Campaign Name | Budget | Bid: Top of Search | Bid: Rest of Search | Bid: Product Pages |
|-------------|---------------|--------|--------------------|---------------------|--------------------|
| 123456789 | RamenToppings-SP | $60.00 | 65% | 35% | 20% |
| 987654321 | PremiumSoup-SP | $45.00 | 50% | 25% | 15% |

**Why we need it:**
- Provides campaign names and budgets for the report
- Stores current bid adjustments (how much extra you're bidding for top placements)
- Links campaigns to portfolios

**Typical data:**
- 100-300 rows (one per campaign)
- Refreshed every week
- Bid adjustments range from 0% to 900%

---

## 📈 Layer 3: Performance Data (The Metrics)

### Table 5: `campaign_performance`
**What it does:** Stores campaign-level metrics for different time periods

**Think of it like:** A scorecard showing how each campaign performed

**One campaign gets 4 rows** (one for each time period):

| Campaign | Period | Clicks | Spend | Orders | Sales | TOS IS* |
|----------|--------|--------|-------|--------|-------|---------|
| RamenToppings | 30day | 1,471 | $595.17 | 155 | $1,669.94 | 5.63% |
| RamenToppings | 7day | 382 | $124.50 | 42 | $487.23 | 5.69% |
| RamenToppings | yesterday | 45 | $13.90 | 0 | $0 | 8.33% |
| RamenToppings | day_before | 52 | $25.96 | 0 | $0 | -- |

*TOS IS = Top of Search Impression Share (what % of top-of-search auctions you won)

**Why we need it:**
- Shows overall campaign performance
- Includes "Top of Search Impression Share" data
- Needed for the daily spend comparison in the report (yesterday vs day before)

**Typical data:**
- 400-1,200 rows per week (100-300 campaigns × 4 periods)
- "yesterday" and "day_before" rows often have 0 orders (attribution lag)
- Includes multiple attribution windows (7d, 14d, 30d)

---

### Table 6: `placement_performance`
**What it does:** Breaks down performance by WHERE your ads showed up

**Think of it like:** Same scorecard, but split by placement type

**One campaign gets 6 rows** (3 placements × 2 time periods):

| Campaign | Placement | Period | Clicks | Spend | Orders | Sales |
|----------|-----------|--------|--------|-------|--------|-------|
| RamenToppings | Top of Search | 30day | 833 | $404.07 | 103 | $1,103.85 |
| RamenToppings | Rest of Search | 30day | 382 | $117.28 | 38 | $423.26 |
| RamenToppings | Product Pages | 30day | 256 | $73.82 | 14 | $142.83 |
| RamenToppings | Top of Search | 7day | 202 | $96.82 | 13 | $118.86 |
| RamenToppings | Rest of Search | 7day | 98 | $19.57 | 21 | $291.58 |
| RamenToppings | Product Pages | 7day | 82 | $8.11 | 8 | $76.79 |

**Why we need it:**
- Shows which placements perform best
- This is the core data for optimization recommendations
- Each placement has its own clicks, spend, orders

**Typical data:**
- 600-1,800 rows per week (100-300 campaigns × 3 placements × 2 periods)
- Only includes 30day and 7day periods (no daily data)
- This table is the foundation of the final report

---

## 🎨 The View: Putting It All Together

### `view_placement_optimization_report`
**What it does:** Combines all 6 tables into your final 25-column Google Sheet format

**Think of it like:** A SQL recipe that:
1. Takes placement data (table 6)
2. Joins campaign info (table 4)
3. Joins portfolio names (table 3)
4. Adds campaign-level metrics (table 5)
5. Calculates CVR and ACoS on the fly
6. Outputs exactly 25 columns

**The Magic:** One SQL query that does all the joins, calculations, and formatting

**Output:** ~900 rows (300 campaigns × 3 placements)

---

## 🔄 How Data Flows Through the System

Let me walk you through a real example:

### Wednesday Morning, 9:05 AM (Weekly Report Day)

#### **Step 1: Collect Data (Edge Function 1) - Takes ~5-10 minutes**

```
What happens:
1. Create workflow_execution record: "2025-11-03T09:05:00Z - RUNNING"
2. Fetch portfolios from Amazon → Store in portfolios table
3. Fetch campaigns + bid adjustments → Store in campaigns table
4. Request 6 reports from Amazon:
   - Placement 30-day
   - Placement 7-day
   - Campaign 30-day
   - Campaign 7-day
   - Campaign yesterday
   - Campaign day-before
5. Store report IDs in report_requests table with status "PENDING"
6. Edge Function completes
```

**Database state after Step 1:**
- portfolios: 10-20 rows (refreshed)
- campaigns: 100-300 rows (refreshed)
- report_requests: 6 rows (all PENDING)
- workflow_executions: 1 row (RUNNING)

---

#### **Step 2: Wait & Process (Edge Function 2) - Runs 60 minutes later, takes ~15-30 minutes**

```
What happens:
1. Check report_requests for PENDING reports
2. Poll Amazon every 60 seconds: "Are they ready yet?"
3. When each report shows COMPLETED:
   - Download the gzip file from Amazon
   - Decompress it (reports can be 5-50 MB compressed)
   - Parse the JSON (thousands of rows)
   - Transform to our schema
   - Insert into campaign_performance table (~400-1200 rows)
   - Insert into placement_performance table (~600-1800 rows)
4. Update report_requests: "COMPLETED"
5. Mark workflow_execution: "COMPLETED"
```

**Database state after Step 2:**
- campaign_performance: 400-1,200 rows (new data)
- placement_performance: 600-1,800 rows (new data)
- report_requests: 6 rows (all COMPLETED)
- workflow_executions: 1 row (COMPLETED)

---

#### **Step 3: Generate Report (Edge Function 3) - Runs 15 minutes after Step 2, takes ~5-10 minutes**

```
What happens:
1. Query the view: SELECT * FROM view_placement_optimization_report
2. The view automatically:
   - Joins all 6 tables
   - Calculates CVR = (Orders / Clicks) × 100
   - Calculates ACoS = (Spend / Sales) × 100
   - Maps placement codes to readable names
   - Returns 25 columns × ~900 rows
3. Take that data and populate Google Sheet
4. Apply formatting (colors, borders, conditional formatting)
5. Send Discord notification: "Report ready! [link]"
6. Done!
```

**Final output:**
- Google Sheet with 25 columns × ~900 rows
- Discord notification sent
- Total time: ~80-100 minutes from start to finish

---

## 💡 Key Design Choices Explained

### Why separate campaign_performance and placement_performance?

**Answer:** Different granularity of data

- **Campaign level:** Overall campaign stats, Top of Search impression share
- **Placement level:** Broken down by where ads appeared

Amazon provides both views in separate reports, so we store them separately.

**Example:**
- Campaign level: "RamenToppings had 1,471 clicks total"
- Placement level: "RamenToppings had 833 clicks from Top of Search, 382 from Rest of Search, 256 from Product Pages"

---

### Why store multiple time periods in the same table?

**Answer:** Cleaner queries

**Bad approach (separate tables):**
```sql
SELECT * FROM campaign_performance_30day
UNION ALL
SELECT * FROM campaign_performance_7day
UNION ALL
SELECT * FROM campaign_performance_yesterday
UNION ALL
SELECT * FROM campaign_performance_day_before
```

**Good approach (one table with period_type column):**
```sql
SELECT * FROM campaign_performance
WHERE period_type IN ('30day', '7day', 'yesterday', 'day_before')
```

Much simpler! Plus you can easily filter to just what you need:
```sql
SELECT * FROM campaign_performance WHERE period_type = '30day'
```

---

### Why calculate CVR and ACoS in the view instead of storing them?

**Answer:** Always accurate

**If you stored CVR as a column:**
- Day 1: CVR = 10.5% (calculated from 50 clicks, 5 orders)
- Day 2: Someone manually updates orders to 6 in the database
- CVR column still shows 10.5% ❌ (WRONG! Should be 12%)

**By calculating in the view:**
- Day 1: View calculates CVR = (5 / 50) × 100 = 10.5%
- Day 2: Orders updated to 6
- View automatically calculates CVR = (6 / 50) × 100 = 12% ✅ (CORRECT!)

The calculation is always based on current data, never stale.

---

### Why have report_requests AND workflow_executions?

**Answer:** Different purposes and different granularity

**workflow_executions (1 row per week):**
- "Did the entire job run this week?"
- "How long did it take?"
- "Did it succeed or fail?"
- Used for: Preventing duplicate runs, monitoring overall health

**report_requests (6 rows per week):**
- "Which specific reports were requested?"
- "Are they ready to download yet?"
- "Did any individual report fail?"
- Used for: Polling Amazon, tracking individual report status, debugging

**Example scenario:**
```
workflow_executions shows: RUNNING (job in progress)
report_requests shows:
  - placement_30day: COMPLETED ✓
  - placement_7day: COMPLETED ✓
  - campaign_30day: PROCESSING ⏳ (still waiting on this one)
  - campaign_7day: FAILED ❌ (need to retry)
  - campaign_yesterday: COMPLETED ✓
  - campaign_day_before: COMPLETED ✓
```

You can see the job is running, but you can also see exactly which report is holding things up!

---

### Why doesn't placement_performance have "yesterday" and "day_before" periods?

**Answer:** Amazon doesn't provide that data

Amazon only provides placement-level breakdowns for longer time periods (7 days, 30 days). Daily data is only available at the campaign level, not split by placement.

**Available:**
- Campaign-level daily data ✓
- Placement-level 30-day data ✓
- Placement-level 7-day data ✓

**Not available:**
- Placement-level daily data ❌

This is a limitation of the Amazon Ads API, not our system.

---

## 📊 Final Output Structure

When you query the view, you get exactly this:

| Column | Source | Calculation | Example Value |
|--------|--------|-------------|---------------|
| A: Campaign | campaigns.campaign_name | Direct | "RamenToppings-SP" |
| B: Portfolio | portfolios.portfolio_name | Direct | "Ramen Bomb" |
| C: Budget | campaigns.daily_budget | Direct | $60.00 |
| D: Clicks-30 | placement_performance (30day) | SUM(clicks) | 833 |
| E: Spend-30 | placement_performance (30day) | SUM(spend) | $404.07 |
| F: Orders-30 | placement_performance (30day) | SUM(orders_30d) | 103 |
| G: CVR-30 | **Calculated** | (Orders / Clicks) × 100 | 12.37% |
| H: ACoS-30 | **Calculated** | (Spend / Sales) × 100 | 36.61% |
| I: Clicks-7 | placement_performance (7day) | SUM(clicks) | 202 |
| J: Spend-7 | placement_performance (7day) | SUM(spend) | $96.82 |
| K: Orders-7 | placement_performance (7day) | SUM(orders_7d) | 13 |
| L: CVR-7 | **Calculated** | (Orders / Clicks) × 100 | 6.44% |
| M: ACoS-7 | **Calculated** | (Spend / Sales) × 100 | 81.47% |
| N: Spent DB Yesterday | campaign_performance (day_before) | SUM(spend) | $25.96 |
| O: Spent Yesterday | campaign_performance (yesterday) | SUM(spend) | $13.90 |
| P: Array Formula | (placeholder) | Google Sheets formula | NULL |
| Q: Last 30 days | campaign_performance (30day) | AVG(tos_is) × 100 | 5.63% |
| R: Last 7 days | campaign_performance (7day) | AVG(tos_is) × 100 | 5.69% |
| S: Yesterday | campaign_performance (yesterday) | AVG(tos_is) × 100 | 8.33% |
| T: Placement Type | placement_performance.placement | Mapped value | "Placement Top" |
| U: Current Bid | campaigns.bid_* | Conditional lookup | 65% |
| V: Changes | (application logic) | Based on optimization | "Increase by 10%" |
| W: NOTES | (manual entry) | Empty for user input | "" |

---

## 📖 Glossary of Terms

### CVR (Conversion Rate)
**Formula:** (Orders ÷ Clicks) × 100
**Meaning:** What percentage of people who clicked your ad actually bought something
**Example:** 100 clicks, 12 orders = 12% CVR
**Good vs Bad:** Higher is better. 10-15% is typical for good campaigns.

### ACoS (Advertising Cost of Sale)
**Formula:** (Spend ÷ Sales) × 100
**Meaning:** What percentage of your sales you spent on advertising
**Example:** Spent $50, made $200 in sales = 25% ACoS
**Good vs Bad:** Lower is better. Under 30% is typically profitable.

### TOS IS (Top of Search Impression Share)
**Formula:** Provided by Amazon
**Meaning:** What percentage of top-of-search ad auctions you won
**Example:** 5.63% means you won about 5-6 out of every 100 auctions
**Good vs Bad:** Higher means more visibility, but also costs more

### Placement Types
- **Top of Search:** Your ad shows at the very top of search results (most expensive, highest conversion)
- **Rest of Search:** Your ad shows elsewhere in search results (mid-price, medium conversion)
- **Product Pages:** Your ad shows on competitor product pages (cheapest, lower conversion)

### Attribution Windows
- **7-day attribution:** Orders that happened within 7 days of clicking the ad
- **14-day attribution:** Orders within 14 days of clicking
- **30-day attribution:** Orders within 30 days of clicking

Amazon tracks all three, so a single click might generate orders counted in all three windows.

### Bid Adjustments
**What:** Percentage increase on your base bid for specific placements
**Example:** Base bid = $1.00, Top of Search adjustment = +65%, Final bid = $1.65
**Range:** 0% to 900% (Amazon's limit)

---

## 🎓 Common Questions

### Q: Why do we delete and reload portfolios/campaigns every week?
**A:** Because settings change! Campaigns get paused, budgets change, portfolios get created. It's easier to just reload fresh data than try to track changes.

### Q: What happens if a report fails?
**A:** The `report_requests` table will show status = "FAILED" and store the error message. The system can retry failed reports without re-running successful ones.

### Q: How much disk space does this use?
**A:** Not much! With 300 campaigns:
- Raw data: ~2,000-3,000 rows per week (~2 MB)
- After 52 weeks: ~100,000 rows (~100 MB)
- The view doesn't store data, it just calculates on demand

### Q: Can I query historical data?
**A:** Yes! The performance tables keep all historical data. You can query:
```sql
SELECT * FROM campaign_performance
WHERE campaign_id = '123456789'
  AND period_type = '30day'
ORDER BY report_date DESC
```

This shows you how that campaign performed over time.

### Q: What happens if we run the report twice in one week?
**A:** The `workflow_executions` table prevents this. The system checks for existing RUNNING or COMPLETED executions for the current week and refuses to start a duplicate.

### Q: Why is the view query fast with 2,000+ rows?
**A:** Because of **indexes**! Every foreign key and commonly-queried column has an index, so PostgreSQL can find data quickly instead of scanning every row.

---

## 🔧 For Developers: Technical Notes

### Indexes Explained
Every table has strategic indexes:
- **Foreign keys:** Speeds up JOINs
- **Status columns:** Speeds up filtering (WHERE status = 'PENDING')
- **Date columns:** Speeds up time-based queries
- **Composite indexes:** Speeds up multi-column lookups (campaign_id + period_type)

### RLS (Row Level Security)
All tables have RLS enabled with a simple policy:
```sql
CREATE POLICY "Service role full access"
  ON table_name
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

This means:
- Only the service role (Edge Functions) can access data
- Regular authenticated users cannot query these tables directly
- Data is protected from unauthorized access

### UNIQUE Constraints
Critical for preventing duplicates:
```sql
UNIQUE(campaign_id, period_type, report_date)
```

This means you can't accidentally insert the same campaign's 30-day data twice for the same date.

### Foreign Key Cascades
When a campaign is deleted, what happens to its performance data?

```sql
FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
```

The `ON DELETE CASCADE` means: "If you delete a campaign, automatically delete all its performance data too." This prevents orphaned records.

### View Performance
The view query uses Common Table Expressions (CTEs):
```sql
WITH placement_30d AS (...),
     placement_7d AS (...),
     campaign_tos_30d AS (...)
SELECT ...
FROM placement_30d
JOIN placement_7d ...
```

PostgreSQL optimizes CTEs, so they're not slower than subqueries. The query plan is efficient.

---

## 📚 Related Documentation

- **Technical Specification:** `new_database_schema_design.md` (complete SQL DDL)
- **API Integration:** `api_integration_plan.md` (how data comes from Amazon)
- **Report Specification:** `placement_report_specification.md` (what the final report looks like)
- **Implementation Plan:** `IMPLEMENTATION_PLAN.md` (step-by-step setup guide)

---

## 🎯 Summary

**6 tables in 3 layers:**
1. **Execution:** workflow_executions, report_requests (track jobs)
2. **Master Data:** portfolios, campaigns (reference info)
3. **Performance:** campaign_performance, placement_performance (metrics)

**1 view:**
- Combines all 6 tables into 25-column report
- Calculates CVR and ACoS on the fly
- Returns ~900 rows ready for Google Sheets

**Data flow:**
1. Collect: Fetch portfolios, campaigns, request 6 reports
2. Process: Download reports, parse, insert ~2,000 rows
3. Generate: Query view, create Google Sheet, send notification

**Key benefits:**
- Fast queries (2-5 seconds) with proper indexes
- Always-accurate calculations (CVR, ACoS)
- Clear audit trail (every execution tracked)
- No duplicate runs (idempotency built-in)
- Easy to debug (detailed status tracking)

---

*Last updated: 2025-11-03*
*For questions or clarifications, refer to the technical documentation or ask the development team.*
