# Module 9: Dashboard

## Purpose
At-a-glance business health overview. Shows KPIs, charts, recent activity, and alerts. Available to Super Admin, Manager, and Staff roles. Viewer role has no dashboard access.

---

## Access by Role

| Role | Dashboard Access |
|------|:----------------:|
| Super Admin | ✅ Full |
| Manager | ✅ Full |
| Staff | ✅ Full (dashboard only — no drill-down to financial pages) |
| Viewer | ❌ No dashboard |

---

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  Dashboard              [This Month ▼]  [↻] [Export ▼]  [🔄 Backup] │
│                                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │Sales │ │Orders│ │ Low  │ │ Net  │ │Expns │ │Credit│ │Payabl│          │
│  │Today │ │Pend. │ │Stock │ │Profit│ │/Budg │ │Outst │ │Outst │          │
│  │NPR 8k│ │  12  │ │  3   │ │NPR45k│ │ 75%  │ │NPR8k │ │NPR45k│          │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                            │
│  ┌── Sales Trend (30d) ──┐  ┌── Top Products ──────┐   │
│  │  ██                    │  │  Buff Achar    █████ │   │
│  │  ████  ██             │  │  Chicken Achar ████  │   │
│  │  ██████ █████   ████  │  │  Mula Achar    ██    │   │
│  │  ████████████████████ │  │  Mix Pickle    █     │   │
│  └──────────────────────┘  └────────────────────────┘   │
│                                                            │
│  ┌── Exp Breakdown ─────┐  ┌── Recent Activity ────┐    │
│  │  ╭─╮  Rent    40%   │  │  10:32 Created product│    │
│  │  │ │  Salary  30%   │  │  10:15 Order shipped  │    │
│  │  │ │  Mktg    15%   │  │  09:50 Batch recorded │    │
│  │  │ │  Other   15%   │  │  09:30 Purchase made  │    │
│  │  ╰─╯                │  └────────────────────────┘    │
│  └──────────────────────┘                                │
└──────────────────────────────────────────────────────────┘
```

---

## KPI Cards (Top Row)

All KPIs read from **`dashboard/cache/{cacheKey}`** — a pre-computed cache document (see Cache Strategy.md). Dashboard load = **1 Firestore read** instead of 7+ collection queries.

| Metric | Cache Field | Color |
|--------|-------------|-------|
| **Sales Today** | `salesToday` | Green |
| **Pending Orders** | `pendingOrders` | Amber |
| **Low Stock SKUs** | `lowStockCount` | Red |
| **Net Profit** | `netProfit` | Blue |
| **Expenses vs Budget** | `expensesVsBudget` | Green < 80%, Yellow < 100%, Red ≥ 100% |
| **Outstanding Credit** | `outstandingCredit` | Red if > NPR 10,000, else Amber |
| **Outstanding Payables** | `outstandingPayables` | Red if > NPR 50,000, else Amber |

### KPI Card Component

```
┌──────────────┐
│  Sales Today │
│              │
│    NPR 8,250 │  ← Large bold number
│              │
│  ▲ 12% vs   │  ← Trend indicator (up/down vs yesterday)
│  yesterday  │
│              │
│  [View All]  │  ← Link to relevant page
└──────────────┘
```

---

## Charts

### Sales Trend (Line Chart — Last 30 Days)

- X-axis: Date (last 30 days)
- Y-axis: Total sales amount (NPR)
- Data: Pre-computed in `dashboard/cache/{cacheKey}.salesTrend` (30 data points max)
- Features: Hover tooltip shows exact amount and order count for each day

### Top Products (Horizontal Bar Chart)

- Shows top 5 products by quantity sold this month
- Data: Pre-computed in `dashboard/cache/{cacheKey}.topProducts` (top 5)
- Each bar: Product name + quantity sold + revenue

### Expense Breakdown (Pie/Donut Chart)

- Shows expense distribution by category for current month
- Data: Pre-computed in `dashboard/cache/{cacheKey}.expenseBreakdown`
- Legend: Category name + percentage + amount
- Click on slice → filter expense list by that category

### Order Status (Donut Chart)

- Shows order distribution by status
- Data: Pre-computed in `dashboard/cache/{cacheKey}.orderStatus`
- Colors: Pending (gray), Confirmed (blue), Processing (yellow), Shipped (purple), Delivered (green), Cancelled (red), Returned (orange)

---

## Recent Activity Feed

- Shows last 10 entries from `activityLogs`
- Displays: timestamp, staff name, action icon, action details
- Each entry links to the relevant resource (if user has permission)
- Auto-truncates long descriptions

---

## Period Selector

Dropdown in the header to change the dashboard period. **All periods based on Bikram Sambat (BS) calendar** — months follow Nepali months (Baishakh, Jestha, Ashad, Shrawan, ...). Fiscal year = **Shrawan 1 → Ashad 32**.

| Option | Effect |
|--------|--------|
| **Today** | KPIs for today only. Charts show hourly breakdown |
| **This Week** | KPIs for the current BS week (Sun–Sat). Charts show daily breakdown |
| **This Month** | (Default) KPIs for current BS month (e.g., Ashad 1–32). Charts show daily breakdown |
| **This Fiscal Year** | KPIs from Shrawan 1 to today |
| **Last Fiscal Year** | Full previous BS fiscal year |
| **Custom Range** | Date picker — user selects start and end (displayed in BS) |

---

## Export

| Format | Content | Files |
|--------|---------|-------|
| **PDF** | Full dashboard snapshot — KPIs + charts + activity feed | `GPT-Dashboard-Jun2026.pdf` |
| **CSV — Sales by Day** | Date, Orders Count, Total Sales | `GPT-Sales-Jun2026.csv` |
| **CSV — Top Products** | Product, SKU, Qty Sold, Revenue | `GPT-TopProducts-Jun2026.csv` |
| **CSV — Expenses** | Category, Amount, % of Total | `GPT-Expenses-Jun2026.csv` |

### Export Flow

```
[Export ▼]
  ├── PDF Report
  │     → Capture DOM with html2canvas (charts + KPIs)
  │     → Generate PDF with jsPDF
  │     → Include: period, generated date, brand name
  │     → Download
  │
  └── CSV Data
        ├── Sales by Day
        │     → Query orders for period → group by date → format CSV
        │
        ├── Top Products
        │     → Query orders items → aggregate → format CSV
        │
        └── Expenses
              → Query expenses for period → group by category → format CSV
```

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **Dashboard** | `admin/src/pages/Dashboard.tsx` | Main dashboard page. Period selector, refresh button, export dropdown. Grid layout with all widgets |
| **KPICard** | `admin/src/components/KPICard.tsx` | Reusable card. Props: title, value, trend, color, link |
| **SalesTrendChart** | `admin/src/components/SalesTrendChart.tsx` | Line chart using Chart.js or Recharts. 30/7 day range |
| **TopProductsChart** | `admin/src/components/TopProductsChart.tsx` | Horizontal bar chart. Top 5 products |
| **ExpensePieChart** | `admin/src/components/ExpensePieChart.tsx` | Donut/pie chart. Clickable slices |
| **OrderStatusChart** | `admin/src/components/OrderStatusChart.tsx` | Donut chart. Color-coded by status |
| **RecentActivity** | `admin/src/components/RecentActivity.tsx` | Last 10 activity logs. Links to resources |
| **PeriodSelector** | `admin/src/components/PeriodSelector.tsx` | Dropdown + custom date range. Updates all widgets |

---

## Firestore Reads on Dashboard Load

| Read | Purpose |
|------|---------|
| `dashboard/cache/{cacheKey}` | All KPIs + chart data + activity feed — **1 read** |
| `settings/budgets` | Budget limits for expense % calculation (only if cache missing) |

**Total: 1 read** (with cache) vs **~250 reads** (without cache).

### Cache Fallback

If `dashboard/cache/{cacheKey}` does not exist (first page load, schema migration):
1. Fall back to querying source collections directly
2. Trigger background cache recalculation
3. Show loading skeleton while fallback queries run

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| View dashboard | `dashboard:read` (auto-included for Super Admin, Manager, Staff) |
| View KPIs with financial data | `dashboard:read` (Staff sees all KPIs) |
| Export PDF/CSV | `dashboard:export` |
| Change period | `dashboard:read` |

### Role Mapping

| Role | Dashboard | Export |
|------|:---------:|:------:|
| Super Admin | ✅ | ✅ |
| Manager | ✅ | ✅ |
| Staff | ✅ | ❌ |
| Viewer | ❌ | ❌ |

---

## Data Refresh

- **On page load**: Read cache document (1 read). Cache recalculated on each relevant write — no refresh needed for fresh data
- **Manual**: Refresh button (↻) in header — re-reads cache doc + triggers background recalculation if user suspects stale cache
- **Auto-refresh**: None (manual only)
- **Auto-backup**: On page load, checks `/settings/backup.nextBackupAt`. If backup is due, runs daily CSV backup silently in background. See Module: Backup & Export.

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — chart axis labels, KPI date references, period selector. See `utils/nepaliDate.ts`.
- **Chart library**: Use Recharts (React-native charting library) or Chart.js with react-chartjs-2. Recharts preferred for React integration
- **PDF export**: Use `html2canvas` to capture dashboard DOM, then `jsPDF` to generate PDF. Charts must render as images
- **CSV export**: Generate CSV string from query results, trigger download via Blob + URL.createObjectURL
- **Loading state**: Show skeleton placeholders for each widget while data loads
- **Empty state**: If no orders/expenses in period, show "No data for this period" with illustration
- **Error state**: If queries fail, show error widget with retry button
- **Performance**: 1 Firestore read per dashboard load (cache doc). Cache recalculated on write via Cache Strategy.md. Chart data capped at 30 points in cache.
- **Cache invalidation**: Dashboard cache recalculated when: order shipped/delivered/returned/cancelled, batch created, expense added, purchase made, payment received, debtor/creditor updated. See Cache Strategy.md for full matrix.
- **Click-through**: KPI cards link to their respective pages (e.g., "Sales Today" → `/admin/orders?status=delivered&date=today`). Backup button in header → `/admin/backup`.
