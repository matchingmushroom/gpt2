# Module 19: Financial Reports

## Purpose
Generate P&L (Profit & Loss), Balance Sheet, and Cash Flow reports with period selection. Reports read from **pre-computed cache documents** (see Cache Strategy.md) — 1 Firestore read per report instead of querying hundreds of source documents. Supports CSV/PDF export for business filing, tax compliance, and stakeholder review. Historical/finalized periods push archives to GAS + Sheets.

---

## Report Types

| Report | Purpose | Frequency | Export |
|--------|---------|:---------:|--------|
| **Profit & Loss** | Revenue − COGS − Expenses = Net Profit | Monthly / Fiscal Year | CSV, PDF |
| **Balance Sheet** | Assets = Liabilities + Equity | End of period | CSV, PDF |
| **Cash Flow** | Operating − Investing − Financing activities | Monthly | CSV |
| **COGS Detail** | Opening FG + Raw Mat. Consumed − Closing FG | Per period | CSV |
| **Expense Breakdown** | Expense by category vs budget | Per period | CSV |
| **Aging Summary** | Debtor & Creditor aging buckets | On demand | CSV |

---

## Data Sources

Reports read from **cache documents** (1 read each) rather than querying source collections directly. Cache documents are recalculated on every relevant write (see Cache Strategy.md). Data flows:

```
Source Collections (orders, batches, expenses, ...)
    │
    │ On write: recalculate
    ▼
Cache Documents (reports/cache/pnl, reports/cache/balanceSheet)
    │
    │ On page load: 1 read
    ▼
Report Page UI
```

| Report Page | Cache Document | Reads |
|-------------|---------------|:-----:|
| P&L | `reports/cache/pnl/{periodId}` | **1** |
| Balance Sheet | `reports/cache/balanceSheet/{periodId}` | **1** |
| Cash Flow | Computed on the fly (no cache — low usage, simple queries) | ~10 |
| COGS Detail | `reports/cache/pnl/{periodId}` + batch detail query | ~5 |
| Expense Breakdown | `reports/cache/pnl/{periodId}` (expensesByCategory) | **1** |
| Aging Summary | Queries debtors/creditors directly (small collections) | ~10 |

### Raw Data Mappings (for Cache Recalculation)

The cache is built from these source queries. These are **not** executed on page load — only during cache recalculation after a write:

| Data Point | Source Collection | Computation |
|------------|:----------------:|-------------|
| **Revenue (Gross Sales)** | `orders` | Σ `grandTotal` where status = 'delivered', filtered by `deliveredAt` in period |
| **Discounts** | `orders` | Σ `discount` (coupon amounts) for delivered orders in period |
| **Returns** | `orders` | Σ `grandTotal` * −1 where status = 'returned' and `returnedAt` in period |
| **Net Sales** | — | Gross Sales − Discounts − Returns |
| **Raw Materials Consumed** | `batches` | Σ `totalRawMaterialCost` where `productionDate` in period |
| **Opening FG (at cost)** | `balances` snapshot or computed | FG stock value at period start (see Opening/Closing Balances) |
| **Closing FG (at cost)** | computed | FG stock value at period end (same formula) |
| **Operating Expenses** | `expenses` | Σ `amount` where `date` in period, grouped by `category` |
| **Cash on Hand** | Not tracked in current schema | Manually entered opening balance / tracked via `balances.snapshots.cash` |
| **Bank Balance** | Not tracked in current schema | Manually entered opening balance / tracked via `balances.snapshots.bank` |
| **Accounts Receivable** | `debtors` | Σ `totalOutstanding` where `clearedAt == null` |
| **Accounts Payable** | `creditors` | Σ `totalOutstanding` where `clearedAt == null` |
| **Raw Material Stock (at cost)** | `purchases` | Σ(`remainingQty` × `rate`) for all purchase items |
| **Finished Goods Stock (at cost)** | computed | Σ(SKU stock × SKU unit cost). Unit cost from batch costing: `(totalRawMaterialCost × SKU pack weight ratio) / unitsProduced` |
| **Owner Capital** | `balances` | Manual entry via admin |
| **Retained Earnings** | `balances` | Cumulative prior period Net Profits − Drawings, manually updated at period close |
| **Drawings** | `balances` | Manual entry via admin |

---

## COGS Formula

```
COGS = Opening FG (at cost) + Raw Materials Consumed − Closing FG (at cost)
```

Where:

| Component | Source | Detail |
|-----------|--------|--------|
| **Opening FG (at cost)** | Period-start snapshot | FG stock valued at weighted-average batch cost |
| **Raw Materials Consumed** | `batches[].totalRawMaterialCost` | Sum of all batch costs in the period |
| **Closing FG (at cost)** | Period-end computed value | Same costing method as Opening FG, at period end |

### FG Unit Cost Calculation

```
For each batch:
  perUnitCost[SKU] = (batch.totalRawMaterialCost 
    × SKU.packWeightGrams / 1000 
    / batch.totalPackedWeightKg) 
  / SKU.unitsProduced

Total FG value at any point = Σ (SKU stock count × latest batch perUnitCost)
```

If multiple batches exist for the same SKU, use **weighted-average cost**: Σ(total cost of all batches for that SKU) / Σ(total units produced across all batches for that SKU).

---

## Opening & Closing Balances

Stored in a singleton document for periodic accounting:

### `/balances/current`

```typescript
{
  // Manually set — updated at period close
  opening: {
    cash: number,                 // NPR cash on hand at period start
    bank: number,                 // NPR bank balance at period start
    fgStockValue: number,         // Opening FG valuation (computed, can be overridden)
    rawMaterialStockValue: number,// Opening RM valuation (computed, can be overridden)
    ownerCapital: number,         // Owner's capital contribution
    retainedEarnings: number,     // Cumulative prior profits − drawings
    drawings: number              // Owner withdrawals in current period
  },

  // Period tracking
  currentPeriodStart: Timestamp,  // BS Shrawan 1 by default
  currentPeriodEnd: Timestamp,
  lastClosedAt: Timestamp | null, // When the last period was closed

  // Auto-computed at period close
  closing: {
    cash: number,
    bank: number,
    fgStockValue: number,
    rawMaterialStockValue: number,
    retainedEarnings: number,       // opening.retainedEarnings + netProfit − drawings
    netProfit: number               // from P&L computation
  },

  updatedAt: Timestamp,
  updatedBy: string                 // staffId
}
```

### Period Close Procedure

1. Admin clicks **"Close Period"** on the Balance Sheet page
2. System computes closing balances from live data
3. Writes `closing.*` fields to `/balances/current`
4. Sets `lastClosedAt = now`
5. Automatically copies `closing.*` to `opening.*` and sets new `currentPeriodStart`
6. Net Profit resets to 0 for the new period; retained earnings carry forward

---

## Profit & Loss Statement

### Layout

```
┌──────────────────────────────────────────────────┐
│  Profit & Loss          [Shrawan 2082 ─  ─ ▼]    │
│           ┌── Ashad 2083 ────────────────┐        │
├──────────────────────────────────────────────────┤
│  Revenue                                      │
│    Gross Sales                         451,200 │
│    Less: Discounts                     −12,450 │
│    Less: Returns                       −14,150 │
│    Net Sales                          424,600 │
│                                                  │
│  Cost of Goods Sold                             │
│    Opening FG Stock                      82,300 │
│    + Raw Materials Consumed            187,400 │
│    − Closing FG Stock                   91,200 │
│    COGS                               178,500 │
│                                                  │
│  Gross Profit                         246,100 │
│  Gross Margin %                          57.9% │
│                                                  │
│  Operating Expenses                             │
│    Rent                                25,000 │
│    Utilities                            8,400 │
│    Salaries                            62,000 │
│    Marketing                            5,200 │
│    Transport                           12,300 │
│    Packaging                            9,800 │
│    Maintenance                          3,100 │
│    Miscellaneous                        4,700 │
│    Total Expenses                     130,500 │
│                                                  │
│  Net Profit                           115,600 │
│  Net Margin %                           27.2% │
├──────────────────────────────────────────────────┤
│                        [Export CSV] [Export PDF] │
└──────────────────────────────────────────────────┘
```

### Data Query

```
// Page load: read cache document (1 Firestore read)
READ reports/cache/pnl/{periodId}  →  pnlData

// Display directly from cache
grossSales      = pnlData.grossSales
discounts       = pnlData.discounts
returns         = pnlData.returns
netSales        = pnlData.netSales
cogs            = pnlData.cogs
grossProfit     = pnlData.grossProfit
grossMargin     = pnlData.grossMargin
expenses        = pnlData.expensesByCategory
totalExpenses   = pnlData.totalExpenses
netProfit       = pnlData.netProfit
netMargin       = pnlData.netMargin
monthBreakdown  = pnlData.monthBreakdown
```

**Cache miss fallback**: If cache document does not exist (first period, or after schema migration), fall back to querying source collections directly and trigger a background cache rebuild.

### Month-by-Month Breakdown

Below the main P&L table, a bar chart or table showing monthly Net Profit for the selected fiscal year:

```
Month       Gross Sales   COGS    Expenses   Net Profit
Shrawan        82,000    35,200    24,500      22,300
Bhadra         74,500    31,800    22,100      20,600
...             ...        ...       ...         ...
Ashad          48,200    20,100    16,400      11,700
─────────────────────────────────────────────────────
Total         451,200   178,500   130,500     115,600
```

---

## Balance Sheet

### Layout

```
┌──────────────────────────────────────────────────┐
│  Balance Sheet       As of Ashad 32, 2083        │
├──────────────────────────────────────────────────┤
│  ASSETS                                  │       │
│  Current Assets                          │       │
│    Cash                              45,000 │
│    Bank                             120,000 │
│    Accounts Receivable               32,400 │
│    Raw Material Stock (at cost)      28,700 │
│    Finished Goods Stock (at cost)    91,200 │
│    Total Current Assets             317,300 │
│                                                  │
│  LIABILITIES & EQUITY                   │       │
│  Current Liabilities                    │       │
│    Accounts Payable                    65,200 │
│  Total Liabilities                     65,200 │
│                                                  │
│  Equity                                       │
│    Owner Capital                      150,000 │
│    Retained Earnings                   45,000 │
│    Drawings                           −58,500 │
│    Current Period Net Profit          115,600 │
│    Total Equity                       252,100 │
│                                                  │
│  Total Liabilities & Equity           317,300 │
├──────────────────────────────────────────────────┤
│  ✓ Assets = Liabilities + Equity    (Balanced)  │
│                        [Export CSV] [Export PDF] │
└──────────────────────────────────────────────────┘
```

### Data Query

```
// Page load: read cache document (1 Firestore read)
READ reports/cache/balanceSheet/{periodId}  →  bsData

// Display directly from cache
cash                = bsData.assets.cash
bank                = bsData.assets.bank
accountsReceivable  = bsData.assets.accountsReceivable
rawMaterialStock    = bsData.assets.rawMaterialStock
finishedGoodsStock  = bsData.assets.finishedGoodsStock
totalAssets         = bsData.assets.totalCurrentAssets

accountsPayable     = bsData.liabilities.accountsPayable
totalLiabilities    = bsData.liabilities.totalLiabilities

ownerCapital        = bsData.equity.ownerCapital
retainedEarnings    = bsData.equity.retainedEarnings
drawings            = bsData.equity.drawings
currentNetProfit    = bsData.equity.currentNetProfit
totalEquity         = bsData.equity.totalEquity

isBalanced          = bsData.isBalanced
```

**Cache miss fallback**: If cache document does not exist, fall back to querying source collections directly and trigger a background cache rebuild.

### Equity Calculation

```
Total Equity = Owner Capital + Retained Earnings − Drawings + Current Net Profit

Assets = Total Current Assets
Liabilities = Accounts Payable

Validation: Assets − Liabilities = Total Equity
```

If the balance check fails, show a warning banner with the discrepancy amount in NPR.

---

## Cash Flow Statement

### Layout

```
┌──────────────────────────────────────────────────┐
│  Cash Flow Statement    [Shrawan 2082 ─ Ashad 2083] │
├──────────────────────────────────────────────────┤
│  Operating Activities                            │
│    Cash from Customers                 410,200   │
│    Cash Paid to Suppliers              −152,300  │
│    Cash Paid for Expenses              −130,500  │
│    Net Operating Cash                  127,400   │
│                                                  │
│  Investing Activities                            │
│    (Equipment, assets, etc.)             -     │
│  Net Investing Cash                       -     │
│                                                  │
│  Financing Activities                            │
│    Owner Capital Injection                   0   │
│    Owner Drawings                             0   │
│  Net Financing Cash                         0   │
│                                                  │
│  Net Cash Change                       127,400   │
│  Opening Cash Balance                   45,000   │
│  Closing Cash Balance                  172,400   │
├──────────────────────────────────────────────────┤
│                        [Export CSV]               │
└──────────────────────────────────────────────────┘
```

### Data Queries

```
Cash from Customers:
  GET paymentHistory[] from orders WHERE
    (paymentMethod = 'cash' OR 'bank' OR 'esewa' OR 'khalti')
    AND receivedAt in period
  SUM(amount) → customerCashReceived

Cash Paid to Suppliers:
  GET purchases WHERE paymentMethod = 'cash' OR 'bank'
    AND createdAt in period
  SUM(paidAmount) → cashPaidToSuppliers

  GET creditors payments WHERE paymentMethod = 'cash' OR 'bank'
    AND paidAt in period
  SUM(amount) → creditorPayments

Cash Paid for Expenses:
  GET expenses WHERE paymentMethod = 'cash' OR 'bank'
    AND date in period
  SUM(amount) → cashExpenses

Net Cash Change = (customerCashReceived + any financing inflows)
  − (cashPaidToSuppliers + creditorPayments + cashExpenses + drawings)

Validation: Opening Cash + Net Cash Change ≈ Closing Cash
```

---

## COGS Detail Report

Shows the full COGS computation with drill-down:

```
COGS Detail        [Shrawan 2082 ─ Ashad 2083]

Opening FG Stock:                    82,300
  └ (value at Shrawan 1, 2082)

Raw Materials Consumed by Batch:
  B-2083-001   Buff Pickle (5kg)      32,500
  B-2083-002   Chicken Pickle (3kg)   21,800
  B-2083-003   Veg Mix (4kg)          28,400
  ...                                   ...
  Total Consumed:                    187,400

Closing FG Stock:                   −91,200
  └ (value at Ashad 32, 2083)

─────────────────────────────────────────
COGS:                                  178,500
```

Links to individual batch detail pages.

---

## Expense Breakdown Report

```
Expense Breakdown  [Shrawan 2082 ─ Ashad 2083]

Category        Spent    Budget    Remaining    %
─────────────────────────────────────────────────
Rent           25,000    30,000       5,000    83%
Utilities       8,400    10,000       1,600    84%
Salaries       62,000    70,000       8,000    89%
Marketing       5,200     8,000       2,800    65%
Transport      12,300    10,000      −2,300   123%
Packaging       9,800    10,000         200    98%
Maintenance     3,100     5,000       1,900    62%
Miscellaneous   4,700     5,000         300    94%
─────────────────────────────────────────────────
Total         130,500   148,000      17,500    88%

Red rows: Over budget. Amber rows: >90% used.
```

---

## Aging Summary

### Accounts Receivable Aging

```
Aging Summary — Debtors    As of Ashad 32, 2083

Customer         Current    31-60d    61d+    Total
Sita Gurung       8,000     5,000    2,000   15,000
Ram Thapa        12,000        —        —    12,000
Hari Poudel         —       5,400      —      5,400
───────────────────────────────────────────────────
Total            20,000    10,400    2,000   32,400
```

### Accounts Payable Aging

```
Aging Summary — Creditors  As of Ashad 32, 2083

Supplier         Current    31-60d    61d+    Total
Everest Supply   25,000    12,000    8,000   45,000
Himalayan Traders 10,200      —        —    10,200
Kathmandu Mart    5,000     5,000       —    10,000
───────────────────────────────────────────────────
Total            40,200    17,000    8,000   65,200
```

Aging buckets computed from `lastOrderDate` (debtors) / `lastPurchaseDate` (creditors) vs report date. Cross-references Module: Debtors and Module: Creditors for full detail.

---

## Admin Panel: UI Components

### Page Layout (`admin/src/pages/FinancialReports.tsx`)

```
┌─────────────────────────────────────────────────────────────┐
│  Financial Reports     [Shrawan 1 ─ Ashad 32 ▼] [Go]        │
│                                                              │
│  ┌────────────┬──────────┬──────────┬──────────┬──────────┐ │
│  │ P&L        │ Balance  │ Cash Flow│ COGS     │ Aging    │ │
│  │            │ Sheet    │          │ Detail   │ Summary  │ │
│  └────────────┴──────────┴──────────┴──────────┴──────────┘ │
│                                                              │
│  [Report content per selected tab — see layouts above]       │
│                                                              │
│                                   [Export CSV] [Export PDF]  │
└─────────────────────────────────────────────────────────────┘
```

### Period Selector

- **Preset buttons**: Today, This Week, This Month, This Fiscal Year, Last Fiscal Year
- **Custom**: From/To date pickers (Gregorian/AD input, displayed in BS)
- **Fiscal Year default**: Shrawan 1 of current BS year → current date
- On period change, all tabs re-query with new date range

### Balance Sheet Management

A separate **"Manage Balances"** button (visible with `settings:write` permission) opens a modal for entering/updating opening balances:

```
┌── Manage Opening Balances ──────────────────────────┐
│                                                      │
│  Cash (NPR):          [___________]                  │
│  Bank (NPR):          [___________]                  │
│  Owner Capital (NPR): [___________]                  │
│  Drawings (NPR):      [___________]                  │
│  Retained Earnings:   [___________]                  │
│                                                      │
│  ℹ FG Stock and Raw Material values are computed     │
│  automatically. Override below if needed:            │
│                                                      │
│  Override FG Value:   [___________] (optional)       │
│  Override RM Value:   [___________] (optional)       │
│                                                      │
│                       [Cancel]         [Save]        │
└──────────────────────────────────────────────────────┘
```

### Close Period Flow

1. On Balance Sheet tab, a **"Close Period"** button (visible to Super Admin only)
2. Click → confirmation dialog: "This will finalize all balances for {period} and start a new period. Continue?"
3. On confirm:
   - Compute all closing balances
   - Write `/balances/current` with `closing.*` fields
   - Copy `closing.*` to `opening.*`
   - Set new `currentPeriodStart`, clear `currentPeriodEnd`
   - `netProfit` resets to 0
   - Finalize P&L cache: set `isFinal = true`, `closedAt`, `closedBy`
   - Finalize Balance Sheet cache: set `isFinal = true`, `closedAt`, `closedBy`
   - **Push archives to GAS**: P&L → `archiveReport('pnl', ...)`, Balance Sheet → `archiveReport('balance_sheet', ...)`, KPI snapshot → `archiveKPI(...)`
4. Success toast: "Period closed. New period started from {BS date}."
5. All report tabs refresh

### Export

| Export Type | Format | Trigger | Content |
|-------------|:------:|--------|---------|
| CSV | `.csv` | Export CSV button | Current tab data as rows |
| PDF | `.pdf` | Export PDF button (P&L, Balance Sheet only) | Formatted report with header, date, table. Uses `html2canvas` + `jsPDF` |

Both exports use the utility in Module: Backup & Export. CSV files include BOM for Excel compatibility. Files named: `{reportType}-{BS_PERIOD}.csv` (e.g., `P&L-2082-83.csv`).

---

## Permissions

Defined in Staff Management module. Financial Reports uses existing permissions — no new ones needed:

| Action | Permission Required | Notes |
|--------|:-------------------:|-------|
| View any report | `dashboard:read` | Consistent with Dashboard |
| Export CSV | `dashboard:export` | Consistent with Dashboard |
| Export PDF | `dashboard:export` | Same as CSV |
| Manage opening balances | `settings:write` | Modifies `/balances/current` |
| Close period | `settings:write` + Super Admin check | Additional role guard |

---

## Integration Points

| Module | Connection |
|--------|-----------|
| **Cache Strategy** | Reports consume `reports/cache/pnl` and `reports/cache/balanceSheet`. Cache invalidation triggers defined in Cache Strategy.md |
| **Dashboard** | Links to Financial Reports page ("View Full Report" on KPI cards). Dashboard KPIs serve as period summaries |
| **Backup & Export** | CSV/PDF export utilities reused. P&L and Balance Sheet included in daily auto-backup as CSV. Period close pushes finalized reports to GAS archive |
| **Debtors** | AR balance feeds into Balance Sheet. Aging report cross-references debtor data |
| **Creditors** | AP balance feeds into Balance Sheet. Aging report cross-references creditor data |
| **Inventory** | FG stock valuation and RM stock valuation feed into Balance Sheet Assets |
| **Production Batches** | Batch costs feed into Raw Materials Consumed (COGS) |
| **Orders** | Revenue, discounts, returns feed into P&L |
| **Expenses** | Operating expenses feed into P&L and Cash Flow |
| **Purchases (Raw Materials)** | RM purchase costs + remaining quantities feed into Balance Sheet |
| **Settings** | Budget limits used in Expense Breakdown |

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — period labels, column headers, report headers. Querying uses AD timestamps (stored). Conversion via `utils/nepaliDate.ts` using `nepali-date` npm package.
- **Fiscal year default**: Shrawan 1 of current BS year. Compute via: `if current BS month >= 4 (Shrawan), year = current BS year, else year = current BS year - 1`.
- **Performance**: P&L and Balance Sheet read from cache documents (1 read each). No source collection queries on page load. Cache is recalculated on write — see Cache Strategy.md for the full invalidation matrix.
- **Cache freshness**: Cache is eagerly recalculated on every relevant write. Staleness is bounded by the time between a write and the cache recalculation (typically < 500ms). For final/closed periods, cache is archived to GAS and frozen.
- **Rounding**: All values displayed in NPR, rounded to nearest integer. CSV exports use raw values.
- **Balance sheet validation**: `Assets − Liabilities − Equity` should equal 0 (within ±NPR 1 rounding). If off by more than NPR 50, show warning: "Balance sheet is out of balance by NPR {amount}. Check opening balances and period closure."
- **Empty state**: "No data for this period. Select a different date range or add data to the system."
- **Error state**: "Failed to load report data. [Retry]" with specific collection name if identifiable.
- **COGS edge cases**:
  - If no batches in period, Raw Materials Consumed = 0
  - If no FG stock at period start, Opening FG = 0
  - If no data at all, show all zeros with "No production or sales in this period" note
  - If Closing FG > Opening FG + Consumed, COGS is negative — show as NPR 0 with info note
- **Cash Flow limitation**: Cash/Bank balances are manually entered. The statement estimates cash flow from payment methods but may not capture all cash movements. "Cash Flow is an estimate based on available transaction data" disclaimer shown below the report.
- **Period Close**: Only Super Admin can close a period. Recommended to close monthly or at fiscal year end. Once closed, the period's data is frozen for that period's report view (live data still changes — recomputed on each view).
