# BidFlow Dashboard Fix Instructions for Gemini

## Problem Summary

The `bidflow-2.0-multi` Next.js project has a broken Placement Performance dashboard. It needs to match the working reference file `index(multi-tenant).html`.

**Issues:**
1. Portfolio filter dropdown doesn't work (portfolio_id hardcoded to null)
2. Table only shows 10 columns instead of 21+ columns
3. Missing editable "Changes" column for bid adjustments
4. Missing "Submit to Amazon" button

---

## Files That Need to Be Fixed

### 1. `src/components/dashboard/dashboard-content.tsx`
**Problem:** Line 114 hardcodes `portfolio_id: null` - this breaks the portfolio filter.

**Fix needed:** Extract portfolio_id from the view data. The view returns a `Portfolio` column name, need to find a way to get portfolio_id or use portfolio name for filtering.

### 2. `src/components/dashboard/placement-data-table.tsx`
**Problem:** Only has 10 columns, needs 21+ columns to match reference.

### 3. `src/types/index.ts`
**Problem:** PlacementData interface missing fields for all the columns.

---

## Reference: Working Column Structure from index(multi-tenant).html

The table headers from the working reference (lines 3145-3165):

```html
<th onClick={() => handleSort('Campaign')}>Campaign</th>
<th onClick={() => handleSort('Budget')}>Budget</th>
<th onClick={() => handleSort('Clicks-30')}>Clicks<br/>30d</th>
<th onClick={() => handleSort('Spend-30')}>Spend<br/>30d</th>
<th onClick={() => handleSort('Orders-30')}>Orders<br/>30d</th>
<th onClick={() => handleSort('CVR-30')}>CVR<br/>30d</th>
<th className="acos-header" onClick={() => handleSort('ACoS-30')}>ACoS<br/>30d</th>
<th onClick={() => handleSort('Clicks-7')}>Clicks<br/>7d</th>
<th onClick={() => handleSort('Spend-7')}>Spend<br/>7d</th>
<th onClick={() => handleSort('Orders-7')}>Orders<br/>7d</th>
<th onClick={() => handleSort('CVR-7')}>CVR<br/>7d</th>
<th className="acos-header" onClick={() => handleSort('ACOS-7')}>ACoS<br/>7d</th>
<th onClick={() => handleSort('Spent DB Yesterday')}>DB<br/>Yest</th>
<th onClick={() => handleSort('Spent Yesterday')}>Spent<br/>Yest</th>
<th onClick={() => handleSort('Budget Check')}>Budget<br/>Check</th>
<th className="metric-percent-group" onClick={() => handleSort('Last 30 days')}>LAST<br/>30D</th>
<th className="metric-percent-group" onClick={() => handleSort('Last 7 days')}>LAST<br/>7D</th>
<th className="metric-percent-group" onClick={() => handleSort('Yesterday')}>YEST</th>
<th onClick={() => handleSort('Placement Type')}>Place</th>
<th onClick={() => handleSort('Increase bids by placement')}>Multi<br/>plier</th>
<th className="changes-column" onClick={() => handleSort('Changes in placement')}>Changes</th>
```

---

## Reference: Data Mapping from index(multi-tenant).html

This is how the working file maps Supabase view data to table columns (lines 2518-2543):

```javascript
return {
    'Campaign': p.campaign_name,
    'Portfolio': portfolioName,
    'Budget': p.campaign_budget ? `$${p.campaign_budget}` : '-',
    'Clicks-30': p.clicks_30d || 0,
    'Spend-30': p.spend_30d || 0,
    'Orders-30': p.purchases_30d || 0,
    'CVR-30': (p.cvr_30d || 0).toString(),
    'ACoS-30': (p.acos_30d || 0).toString(),
    'Clicks-7': p.clicks_7d || 0,
    'Spend-7': p.spend_7d || 0,
    'Orders-7': p.purchases_7d || 0,
    'CVR-7': (p.cvr_7d || 0).toString(),
    'ACOS-7': (p.acos_7d || 0).toString(),
    'Spent DB Yesterday': p.day_before_spend || 0,
    'Spent Yesterday': p.yesterday_spend || 0,
    'Budget Check': '-',
    'Last 30 days': p.top_of_search_impression_share ? `${p.top_of_search_impression_share}%` : '0%',
    'Last 7 days': '0%',
    'Yesterday': '0%',
    'Placement Type': placementTypeMap[p.placement_type] || p.placement_type,
    'Increase bids by placement': multiplier.toString(),
    'Changes in placement': '0',
    'campaign_id': campaignId,
    'snapshot_id': snapshotId
};
```

---

## Reference: Supabase View Columns

The `view_placement_optimization_report` returns these columns (query the view to confirm):

| Column Name | Description |
|-------------|-------------|
| Campaign | Campaign name |
| Portfolio | Portfolio name |
| Budget | Campaign budget |
| Clicks | 30-day clicks |
| Spend | 30-day spend |
| Orders | 30-day orders |
| CVR | 30-day conversion rate |
| ACoS | 30-day ACoS |
| Clicks_7d | 7-day clicks |
| Spend_7d | 7-day spend |
| Orders_7d | 7-day orders |
| CVR_7d | 7-day conversion rate |
| ACoS_7d | 7-day ACoS |
| Spent DB Yesterday | Day before yesterday spend |
| Spent Yesterday | Yesterday spend |
| Last 30 days | 30-day impression share % |
| Last 7 days | 7-day impression share % |
| Yesterday | Yesterday impression share % |
| Placement Type | Placement Top, Placement Rest Of Search, Placement Product Page |
| Increase bids by placement | Current bid multiplier % |
| Changes in placement | For user edits (starts as 0) |
| tenant_id | Tenant UUID |

---

## Reference: Portfolio Filter Logic from index(multi-tenant).html

How portfolios are extracted and filtered (lines 2575-2579):

```javascript
if (portfolioFilter !== 'all') {
    filtered = filtered.filter(row => {
        return row.Portfolio === portfolioFilter;
    });
}
```

The portfolio dropdown gets populated from unique Portfolio values in the data.

---

## Reference: Editable Changes Column from index(personal).html

The Changes column allows users to type in new bid multiplier values:

```javascript
// Handle editing (line 1953)
const handleChangeEdit = (index, newValue) => {
    const updatedReports = [...reports];
    const dataIndex = reports.findIndex((item) =>
        item.Campaign === filteredData[index].Campaign &&
        item['Placement Type'] === filteredData[index]['Placement Type']
    );
    if (dataIndex !== -1) {
        updatedReports[dataIndex]['Changes in placement'] = newValue;
        setReports(updatedReports);
    }
};
```

The cell renders as an input when clicked:
```jsx
<input
    type="text"
    defaultValue={row['Changes in placement'] || '0'}
    onBlur={(e) => handleChangeEdit(index, e.target.value)}
    onKeyDown={(e) => {
        if (e.key === 'Enter') handleChangeEdit(index, e.target.value);
    }}
/>
```

---

## Reference: Submit to Amazon Button from index(personal).html

```jsx
<button
    onClick={handleSubmitChanges}
    disabled={submitting}
    className="btn"
>
    {submitting ? '⏳ Submitting...' : '🚀 Submit Changes to Amazon'}
</button>
```

The submit function (lines 2012-2071):
```javascript
const handleSubmitChanges = async () => {
    const changesData = reports.filter(row =>
        row['Changes in placement'] &&
        row['Changes in placement'] !== '0' &&
        row['Changes in placement'] !== '0%' &&
        row['Changes in placement'].trim() !== ''
    ).map(row => ({
        campaign: row.Campaign,
        portfolio: row.Portfolio,
        placement: row['Placement Type'],
        currentMultiplier: row['Increase bids by placement'],
        newMultiplier: row['Changes in placement'],
        week: currentSheet?.weekNumber || 'Unknown'
    }));

    if (changesData.length === 0) {
        alert('No changes to submit. Add multiplier percentages in the Changes column first.');
        return;
    }

    // POST to webhook endpoint
    const response = await fetch(CONFIG.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            changes: changesData,
            timestamp: new Date().toISOString()
        })
    });
};
```

---

## Current Broken Code: placement-data-table.tsx

This file only has 10 columns. Here are the current columns:

```typescript
export const placementColumns: ColumnDef<PlacementData>[] = [
  { accessorKey: "campaign_name", header: "Campaign" },
  { accessorKey: "portfolio_name", header: "Portfolio" },
  { accessorKey: "placement_type", header: "Placement" },
  { accessorKey: "impressions", header: "Impr." },
  { accessorKey: "clicks", header: "Clicks" },
  { accessorKey: "spend", header: "Spend" },
  { accessorKey: "sales", header: "Sales" },
  { accessorKey: "acos", header: "ACOS" },
  { accessorKey: "roas", header: "ROAS" },
  { accessorKey: "bid_adjustment", header: "Bid Adj." },
];
```

**NEEDS TO BE EXPANDED** to include all 21 columns matching the reference.

---

## Current Broken Code: dashboard-content.tsx Data Mapping

Lines 75-122 map the view data. The problem is line 114:

```typescript
portfolio_id: null,  // THIS IS WRONG - breaks filter
```

The mapping also doesn't extract all columns from the view.

---

## What Gemini Needs To Do

### Step 1: Update `src/types/index.ts`

Add all missing fields to PlacementData interface:
- budget
- clicks_30d, spend_30d, orders_30d, cvr_30d, acos_30d
- clicks_7d, spend_7d, orders_7d, cvr_7d, acos_7d
- spent_db_yesterday, spent_yesterday
- impression_share_30d, impression_share_7d, impression_share_yesterday
- changes_in_placement (string, editable)

### Step 2: Update `src/components/dashboard/dashboard-content.tsx`

Fix the data mapping to:
1. Extract portfolio name properly for filtering (use Portfolio column)
2. Map ALL columns from the view
3. Add state for tracking changes (`changesData`)
4. Add `handleSubmitChanges` function

### Step 3: Update `src/components/dashboard/placement-data-table.tsx`

Expand from 10 columns to 21 columns:
1. Add all missing columns with proper headers (use `<br/>` for two-line headers)
2. Add color coding for ACoS columns (green < 20%, yellow < 35%, red >= 35%)
3. Make "Changes" column editable (input field)
4. Add "Submit to Amazon" button

### Step 4: Update `src/components/dashboard/portfolio-filter.tsx`

Ensure `extractPortfolios` works with the portfolio_name field (not portfolio_id if that's null).

---

## Testing

After fixes, the dashboard should:
1. Show all 21 columns in the table
2. Portfolio dropdown should populate with unique portfolio names
3. Portfolio filter should filter the table when selected
4. Changes column should be editable
5. Submit button should collect all non-zero changes

---

## File Locations

- Types: `src/types/index.ts`
- Dashboard: `src/components/dashboard/dashboard-content.tsx`
- Table: `src/components/dashboard/placement-data-table.tsx`
- Portfolio Filter: `src/components/dashboard/portfolio-filter.tsx`
- Reference HTML: `C:\Users\Ramen Bomb\Desktop\Code\bidflow\index(multi-tenant).html`

---

## Supabase Connection

The project uses Supabase client from `@/lib/supabase/client`. The view being queried is `view_placement_optimization_report`.

Query example:
```typescript
const { data, error } = await supabase
  .from("view_placement_optimization_report")
  .select("*")
  .order("Spend", { ascending: false });
```
