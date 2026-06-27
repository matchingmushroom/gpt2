# Cache Strategy — Firestore Read Optimization

## Purpose

Reduce Firestore read consumption to stay within the 50K reads/day free tier. Achieved through **pre-computed cache documents** in Firestore (Tier 1) and **Google Sheets archive** (Tier 2). Public site serves a **static JSON** file — zero Firestore reads.

---

## Architecture Overview

```
                                    ┌──────────────────────────┐
                                    │   Firebase Firestore     │
                                    │   (Source of Truth)      │
                                    └──┬────┬────┬────┬────┬──┘
                                       │    │    │    │    │
                  ┌────────────────────┘    │    │    └──────────────┐
                  │                         │    │                   │
          ┌───────▼────────┐      ┌────────▼────▼───┐     ┌─────────▼────────┐
          │  Dashboard/    │      │  Orders/Staff/  │     │  Public Site     │
          │  Reports       │      │  Single Doc     │     │  (GitHub Pages)  │
          │  (cache doc)   │      │  Lookups        │     │  (static JSON)   │
          │  1 read        │      │  1-3 reads      │     │  → 0 reads       │
          └───────┬────────┘      └────────┬────────┘     └──────────────────┘
                  │                        │
                  │  On write:             │
                  │  recalculate cache     │
                  ▼  + push archive to GAS ▼
          ┌──────────────────────────────────────────────────┐
          │  Google Apps Script Web App                      │
          │  ┌─────────────────────────────────────────────┐ │
          │  │ uploadImage, uploadBill, backupCSV,         │ │
          │  │ exportReport, migrateImages,                │ │
          │  │ archiveKPI, archiveReport, readArchive       │ │
          │  └─────────────────────────────────────────────┘ │
          │                     │                             │
          │                     ▼                             │
          │  ┌─────────────────────────────────────────────┐ │
          │  │  Google Drive + Sheets (Archive Layer)      │ │
          │  │  kpi_history.csv, reports_pnl.csv,          │ │
          │  │  reports_bs.csv, Database Backups/          │ │
          │  └─────────────────────────────────────────────┘ │
          └──────────────────────────────────────────────────┘
```

### Read Decision Tree

```
Client needs data
    │
    ├── Public catalog?
    │   └── Fetch /data/products.json (0 reads)
    │       Fallback: read products/publicCatalog (1 read)
    │
    ├── Dashboard / Reports / Aggregates?
    │   ├── Current period → cache doc (1 read)
    │   └── Historical period → cache doc or GAS readArchive (0-1 read)
    │
    ├── Single doc lookup? (order#, phone, auth, staff)
    │   └── Firebase direct (1-3 reads)
    │
    └── Write operation?
        └── Firebase direct + trigger cache recalculation
```

---

## Tier 1: In-Firestore Cache Documents

### Cache Documents Overview

| Cache Document | Replaces | Reads Saved |
|----------------|----------|:-----------:|
| `dashboard/cache/{periodId}` | 7 KPI queries + 4 chart queries | ~250 → **1** |
| `reports/cache/pnl/{periodId}` | Orders + batches + expenses aggregate | ~300 → **1** |
| `reports/cache/balanceSheet/{periodId}` | Debtors + creditors + batches + purchases | ~300 → **1** |
| `products/publicCatalog` | All products + SKUs | ~80 → **0** |
| `counters/stockSummary` | Per-SKU stock computation | ~50 → **1** |

### 1.1 Dashboard Cache

**Document ID**: `dashboard/cache/{cacheKey}` where `cacheKey = {bsYear}_{bsMonth}` or `today`

```typescript
{
  cacheKey: string,                    // "2083_04" for Shrawan 2083, "2083_0" for fiscal year
  periodType: 'today' | 'this_week' | 'this_month' | 'this_fiscal_year',
  bsYear: number,
  bsMonth?: number,
  computedAt: Timestamp,

  // ── KPI Values ──
  salesToday: number,                  // Σ grandTotal where status=delivered, today
  pendingOrders: number,               // count where status in [pending, confirmed]
  lowStockCount: number,               // SKUs with stock ≤ threshold
  netProfit: number,                   // sales − expenses − batch costs
  expensesVsBudget: number,            // (total expenses / budget limit) × 100
  outstandingCredit: number,           // Σ debtors.totalOutstanding (uncleared)
  outstandingPayables: number,         // Σ creditors.totalOutstanding (uncleared)

  // ── Chart Data (capped at 30 points each) ──
  salesTrend: Array<{
    date: string,                      // BS date
    amount: number,                    // daily sales
    orderCount: number
  }>,
  topProducts: Array<{
    productName: string,
    sku: string,
    qtySold: number,
    revenue: number
  }>,
  expenseBreakdown: Array<{
    category: string,
    amount: number,
    budget: number,
    percentage: number
  }>,
  orderStatus: Array<{
    status: string,
    count: number
  }>,
  recentActivity: Array<{
    action: string,
    timestamp: Timestamp,
    staffName: string
  }>,

  // ── Trend Comparison ──
  previousPeriodSales: number,
  previousPeriodNetProfit: number,

  // ── Metadata ──
  cacheVersion: number,
  sourceCollections: string[]
}
```

**Estimated size**: ~2 KB per period. Stored per BS month + a `today` variant. 13 documents total at any time.

### 1.2 P&L Report Cache

**Document ID**: `reports/cache/pnl/{periodId}` where `periodId = {bsYearStart}_{bsYearEnd}` (e.g., `2082_83`)

```typescript
{
  periodId: string,
  periodStart: Timestamp,
  periodEnd: Timestamp,
  computedAt: Timestamp,

  // ── Revenue ──
  grossSales: number,
  discounts: number,
  returns: number,
  netSales: number,

  // ── COGS ──
  openingFG: number,
  rawMaterialsConsumed: number,
  closingFG: number,
  cogs: number,

  // ── Gross Profit ──
  grossProfit: number,
  grossMargin: number,                 // (grossProfit / netSales) × 100

  // ── Expenses ──
  expensesByCategory: Record<ExpenseCategory, number>,
  totalExpenses: number,

  // ── Net Profit ──
  netProfit: number,
  netMargin: number,                   // (netProfit / netSales) × 100

  // ── Monthly Breakdown ──
  monthBreakdown: Array<{
    bsMonth: string,                   // "Shrawan", "Bhadra", etc.
    grossSales: number,
    cogs: number,
    expenses: number,
    netProfit: number
  }>,

  // ── Status ──
  isFinal: boolean,                    // true = period closed
  closedAt?: Timestamp,
  closedBy?: string
}
```

### 1.3 Balance Sheet Cache

**Document ID**: `reports/cache/balanceSheet/{periodId}`

```typescript
{
  periodId: string,
  asOfDate: Timestamp,
  computedAt: Timestamp,

  assets: {
    cash: number,                      // from /balances/current
    bank: number,
    accountsReceivable: number,        // Σ debtors.totalOutstanding
    rawMaterialStock: number,          // Σ(purchases.items[].remainingQty × rate)
    finishedGoodsStock: number,        // Σ(SKU stock × weighted avg cost)
    totalCurrentAssets: number
  },
  liabilities: {
    accountsPayable: number,           // Σ creditors.totalOutstanding
    totalLiabilities: number
  },
  equity: {
    ownerCapital: number,
    retainedEarnings: number,
    drawings: number,
    currentNetProfit: number,
    totalEquity: number
  },

  isBalanced: boolean,
  discrepancy: number,                 // assets − (liabilities + equity), ~0

  isFinal: boolean,
  closedAt?: Timestamp,
  closedBy?: string
}
```

### 1.4 Public Product Catalog

**Document ID**: `products/publicCatalog`

```typescript
{
  updatedAt: Timestamp,
  version: number,

  products: Array<{
    id: string,
    name: string,
    slug: string,
    description: string,
    images: string[],                  // Drive URLs
    categoryIds: string[],
    categoryNames: string[],
    tags: string[],
    isFeatured: boolean,
    isActive: boolean,
    skus: Array<{
      id: string,
      skuCode: string,
      label: string,
      weightInGrams: number,
      price: number,
      stock: number,                   // computed from batches + orders + adjustments
      isActive: boolean,
      isAvailable: boolean             // stock > 0 && isActive
    }>,
    minPrice: number,
    maxPrice: number,
    isInStock: boolean
  }>
}
```

This document is used for **two purposes**:
1. **Build-time**: Script reads this doc, writes `public/data/products.json`
2. **Runtime fallback**: If static JSON fails to load, public site reads this doc directly (1 read)

### 1.5 Stock Summary Cache

**Document ID**: `counters/stockSummary`

```typescript
{
  updatedAt: Timestamp,
  totalSKUCount: number,
  lowStockCount: number,               // stock ≤ 10
  outOfStockCount: number,             // stock = 0

  lowStockSKUs: Array<{
    productId: string,
    productName: string,
    skuId: string,
    skuCode: string,
    label: string,
    stock: number,
    threshold: number
  }>,

  outOfStockSKUs: Array<{
    productId: string,
    productName: string,
    skuId: string,
    skuCode: string,
    label: string
  }>
}
```

---

## Cache Invalidation & Recalculation

### Write-to-Cache Mapping

Every write that affects source data triggers immediate cache recalculation for the affected period(s).

| Write Action | Cache(s) Recalculated | Archive Push |
|-------------|----------------------|:------------:|
| Order placed | Dashboard (pendingOrders) | — |
| Order shipped | Dashboard (pendingOrders), Stock Summary | — |
| Order delivered | Dashboard (all KPIs, salesTrend, topProducts), P&L (if current period) | — |
| Order returned | Dashboard (netProfit, salesTrend), P&L, Stock Summary | — |
| Order cancelled | Dashboard (pendingOrders), Stock Summary | — |
| Batch created/completed | Dashboard (netProfit), P&L, Balance Sheet, Stock Summary | — |
| Batch recalled | Dashboard (netProfit), P&L, Balance Sheet, Stock Summary | — |
| Expense created/updated/deleted | Dashboard (expenses, netProfit), P&L | — |
| Purchase created | Dashboard (outstandingPayables), Balance Sheet | — |
| Payment to creditor | Dashboard (outstandingPayables), Balance Sheet | — |
| Payment from debtor | Dashboard (outstandingCredit), Balance Sheet | — |
| Product/SKU created/updated/deleted | Public Catalog, Stock Summary | — |
| Product/SKU active toggle | Public Catalog, Stock Summary | — |
| Inventory adjustment | Stock Summary | — |
| Budget changed | Dashboard (expensesVsBudget) | — |
| Opening balances changed | Balance Sheet | — |
| Period closed | P&L (isFinal=true), Balance Sheet (isFinal=true) | ✅ Archive P&L + BS to GAS |
| Daily midnight | Dashboard (today cache refreshed) | ✅ Archive KPI snapshot to GAS |

### Recalculation Flow

```
User Action → Write to Firebase
                   │
                   ▼
        cacheManager.recalculate(affected period)
                   │
           ┌───────┴────────┐
           ▼                ▼
    Query source       Write cache
    collections        document
    (aggregates)       (1 doc)
           │                │
           └───────┬────────┘
                   ▼
          If period is closed
          or daily snapshot:
                   │
                   ▼
          Push to GAS → Sheets archive
          (archiveKPI / archiveReport)
```

### Cache Versioning

Each cache document has a `cacheVersion: number` field. Incremented when the cache schema changes. Client reads a cache only if `cacheVersion` matches the expected version. Mismatch triggers a fresh calculation.

---

## Tier 2: GAS + Sheets Archive Layer

### Purpose

Frozen snapshots of cache data for historical reference, period-end reporting, and disaster recovery. Not used for live reads.

### Archived Data

| Archive | Trigger | Sheet Tab | Columns |
|---------|---------|-----------|---------|
| **KPI Snapshot** | Daily (midnight NPT) + Period close | `kpi_history` | date (BS), salesToday, pendingOrders, netProfit, expensesVsBudget, outstandingCredit, outstandingPayables, lowStockCount |
| **P&L Report** | Period close (isFinal=true) | `reports_pnl` | reportId, period, grossSales, discounts, returns, netSales, cogs, grossProfit, grossMargin, totalExpenses, netProfit, netMargin, generatedAt |
| **Balance Sheet** | Period close (isFinal=true) | `reports_bs` | reportId, asOfDate, totalAssets, totalLiabilities, totalEquity, isBalanced, generatedAt |

### GAS Endpoints

| Endpoint | Method | Payload | Writes To |
|----------|--------|---------|-----------|
| `archiveKPI` | POST | `{ date, salesToday, pendingOrders, ... }` | `kpi_history` sheet tab |
| `archiveReport` | POST | `{ reportType: 'pnl'|'balance_sheet', periodId, data }` | `reports_pnl` / `reports_bs` sheet tab |
| `readArchive` | GET | `?type=kpi|pnl|bs&from=...&to=...` | Returns sheet rows as JSON |

These are appended as files in Drive under `Reports/` plus optionally maintained as sheet tabs in the existing spreadsheet for structured querying.

### Client-Side Push

The client pushes archive data to GAS **after** a successful cache recalculation when:

```typescript
const shouldArchive =
  action === 'closePeriod' ||                                      // Period close
  (cacheKey === 'today' && isMidnightNPT()) ||                     // Daily snapshot
  (cacheKey.startsWith(currentBsYear) && cacheDoc.isFinal);        // Finalized report
```

---

## Public Site: Static JSON

### Build-Time Generation

At `npm run build` in the client project:

1. `scripts/fetchPublicProducts.js` runs
2. Reads `products/publicCatalog` from Firestore (using Admin SDK or Firebase REST API)
3. Writes to `public/data/products.json`

```json
// public/data/products.json
{
  "version": 42,
  "updatedAt": "2083-04-15",
  "products": [
    {
      "id": "abc123",
      "name": "Buff Achar",
      "slug": "buff-achar",
      "images": ["https://drive.google.com/..."],
      "categoryNames": ["Non-Veg", "Spicy"],
      "isFeatured": true,
      "isInStock": true,
      "minPrice": 120,
      "maxPrice": 350,
      "skus": [
        { "skuCode": "BUFF-300", "label": "300gm", "price": 120, "stock": 45, "isAvailable": true },
        { "skuCode": "BUFF-500", "label": "500gm", "price": 200, "stock": 30, "isAvailable": true },
        { "skuCode": "BUFF-1000", "label": "1kg", "price": 350, "stock": 0, "isAvailable": false }
      ]
    }
  ]
}
```

### Runtime Behavior

```typescript
// client/src/utils/getPublicProducts.ts
async function getPublicProducts() {
  // 1. Try static JSON (0 reads)
  try {
    const res = await fetch('/data/products.json');
    if (res.ok) return await res.json();
  } catch {}

  // 2. Fallback: Firestore cache doc (1 read)
  try {
    const doc = await getDoc(doc(db, 'products', 'publicCatalog'));
    if (doc.exists()) return doc.data();
  } catch {}

  // 3. Last resort: empty catalog
  return { products: [] };
}
```

### Deployment

- **Automatic**: GitHub Action rebuilds client site daily (cron) + on push to `main`
- **Manual**: Admin clicks "Publish Site" button → calls webhook URL → triggers rebuild
- **Between rebuilds**: Public site serves the last-built `products.json` — products can be managed in admin without affecting the live public view until republish

---

## Projected Read Consumption

| Scenario | Before Cache | After Cache |
|----------|:-----------:|:-----------:|
| Dashboard load (1 period) | ~250 reads | **1** read |
| P&L report view | ~300 reads | **1** read |
| Balance sheet view | ~300 reads | **1** read |
| Product listing (public) | ~80 reads | **0** reads |
| Order list (admin, 50 orders) | ~50 reads | ~50 reads (unchanged) |
| Single order lookup | ~2 reads | ~2 reads (unchanged) |
| Auth check per session | ~1 read | ~1 read (unchanged) |

**Daily total estimate:**

| Source | Sessions | Per Session | Total Reads |
|--------|:--------:|:-----------:|:-----------:|
| Admin dashboard | 30 | 1 | 30 |
| Admin reports | 5 | 1 | 5 |
| Admin order mgmt | 30 | 30 | 900 |
| Admin product mgmt | 10 | 10 | 100 |
| Admin staff/settings | 5 | 5 | 25 |
| Public visitors (catalog) | 150 | 0 | 0 |
| Public order tracking | 30 | 2 | 60 |
| Writes (do not count) | 500 | — | 0 |
| **Total** | | | **~1,120** |

**Headroom**: 50,000 − 1,120 = **48,880 reads/day free** (97.8% remaining)

---

## Implementation Order

1. Create cache documents in code (`admin/src/utils/cacheManager.ts`)
2. Update admin pages to read from cache (Dashboard → cache doc, Reports → cache doc)
3. Create public catalog build script (`client/scripts/fetchPublicProducts.js`)
4. Add GAS archive endpoints + client-side push
5. Add period close flow (cache finalization → GAS archive)

---

## Cache Utility (`admin/src/utils/cacheManager.ts`)

```typescript
// Signature design
interface CacheManager {
  // Read from cache with fallback
  getDashboard(period: PeriodId): Promise<DashboardCache>
  getPnLReport(periodId: string): Promise<PnLCache>
  getBalanceSheet(periodId: string): Promise<BalanceSheetCache>
  getStockSummary(): Promise<StockSummary>
  getPublicCatalog(): Promise<PublicCatalog>

  // Recalculate cache after write
  recalculate(kind: CacheKind, period: PeriodId): Promise<void>

  // Push finalized data to GAS archive
  pushToArchive(kind: 'kpi' | 'pnl' | 'balance_sheet', data: object): Promise<void>
}
```

---

## Cross-Module References

| Module | Connection |
|--------|-----------|
| **Dashboard** | Primary consumer of `dashboard/cache/{periodId}` |
| **Financial Reports** | Primary consumer of `reports/cache/pnl`, `reports/cache/balanceSheet` |
| **Products & SKUs** | Feeds `products/publicCatalog` via recalculation trigger |
| **Inventory** | Feeds `counters/stockSummary` via recalculation trigger |
| **Orders** | Triggers Dashboard + P&L cache recalculation |
| **Production Batches** | Triggers Dashboard + P&L + Balance Sheet cache recalculation |
| **Expenses** | Triggers Dashboard + P&L cache recalculation |
| **Debtors** | Feeds Balance Sheet assets + Dashboard KPI |
| **Creditors** | Feeds Balance Sheet liabilities + Dashboard KPI |
| **Purchases** | Feeds Balance Sheet RM stock valuation |
| **Settings** | Budget changes trigger Dashboard cache recalculation |
| **Backup & Export** | Archive layer receives finalized cache data via GAS |
