# Module: Backup & Export

## Purpose
Centralized backup, archive, and data export system. Product images and purchase bills stored in organized Google Drive folders. Database snapshots auto-backed up daily as CSV. **Cache archives** (KPI snapshots, finalized P&L, balance sheets) pushed to GAS on period close. Admin can manually export any report as CSV on demand.

---

## Google Drive Folder Structure

```
/Great Pickle Taste Backup/
  ├── Products/
  │   └── Images/
  │       ├── {product-slug}/
  │       │   ├── {timestamp}-{filename}.jpg
  │       │   └── {timestamp}-{filename}.jpg
  │       └── ...
  ├── Purchases/
  │   └── Bills/
  │       ├── {purchase-number}-bill.jpg
  │       └── ...
  ├── Database Backups/
  │   ├── orders-{BS_DATE}.csv
  │   ├── batches-{BS_DATE}.csv
  │   ├── expenses-{BS_DATE}.csv
  │   ├── purchases-{BS_DATE}.csv
  │   ├── products-{BS_DATE}.csv
  │   ├── inventory-{BS_DATE}.csv
  │   ├── debtors-{BS_DATE}.csv
  │   └── creditors-{BS_DATE}.csv
   └── Reports/                         ← Manual exports from admin
       ├── sales-report-{BS_DATE}.csv
       ├── pnl-report-{BS_DATE}.csv
       ├── balance-sheet-{BS_DATE}.csv
       ├── aging-report-{BS_DATE}.csv
       └── inventory-report-{BS_DATE}.csv
   └── Archives/                       ← Cache archive (pushed on period close)
       ├── kpi-{BS_DATE}.csv
       ├── pnl-{BS_YEAR}.csv
       └── balance-sheet-{BS_YEAR}.csv
```

---

## Architecture

```
┌──────────────────────┐     HTTP POST (fetch)      ┌────────────────────────┐
│  Admin Panel         │ ──────────────────────────▶ │  Google Apps Script    │
│  (React + Vite)      │                             │  Web App               │
│                       │ ◀────────────────────────  │                        │
│  Backup & Export:     │     JSON response           │  - uploadImage()       │
│  - Upload image       │                             │  - uploadBill()        │
│  - Upload bill        │                             │  - backupCSV()         │
│  - Export CSV         │                             │  - exportReport()      │
│  - Trigger backup     │                             │  - migrateImages()     │
│  - Run migration      │                             │  - archiveKPI()        │  ← NEW
│                       │                             │  - archiveReport()     │  ← NEW
│  Cache Archive:       │                             │  - readArchive()       │  ← NEW
│  - Period close       │                             │  - dailyBackup()       │
│  - Daily KPI snapshot │                             │  (time-based trigger)  │
│  - Push to GAS        │                             └────────────────────────┘
└──────────────────────┘                                         │
                                                                  ▼
                                                         ┌────────────────────────┐
                                                         │  Google Drive          │
                                                         │  + Google Sheets       │
                                                         │  (organized folders)   │
                                                         └────────────────────────┘
```

---

## Google Apps Script — Web App

### Deployment

1. Create a new Google Apps Script project at `script.google.com`
2. Paste the code from `gas/Backup.gs`
3. Deploy as **Web App** → Execute as "Me" → Access "Anyone"
4. Copy the deployment URL → store in `/settings/backup.gasUrl`

### Configuration in Settings

Add to `/settings/store` or new `/settings/backup`:

```typescript
// /settings/backup
{
  gasUrl: string                        // Google Apps Script Web App URL
  driveRootFolderId: string             // ID of "Great Pickle Taste Backup" folder
  autoBackupEnabled: boolean            // Daily backup toggle
  autoBackupTime: string                // "23:30" (NPT)
  lastBackupAt: Timestamp | null
  nextBackupAt: Timestamp | null
}
```

---

## Product Image Upload Flow

### Dual-Input Component (per image slot)

```
┌─────────────────────────────────────────────┐
│  Image 1                                     │
│                                             │
│  [📁 Choose File]  OR  [https://drive...]   │
│                                             │
│  ┌──────────────┐                           │
│  │  🖼 Preview   │                           │
│  │              │                           │
│  └──────────────┘                           │
│                                             │
│  [✕ Remove]    [↕ Drag to reorder]         │
└─────────────────────────────────────────────┘
```

### Mode 1 — Upload File

| Step | Action |
|------|--------|
| 1 | Staff clicks "Choose File" → selects image (jpg/png/webp, max 5MB) |
| 2 | Client reads file as base64 data URL |
| 3 | Shows local preview immediately |
| 4 | Client sends `POST` to GAS Web App: `{ action: "uploadImage", productSlug, fileName, base64Data }` |
| 5 | GAS saves to Drive: `/Products/Images/{productSlug}/{timestamp}-{filename}` |
| 6 | GAS sets file sharing to `ANYONE_WITH_LINK`, `VIEW` |
| 7 | GAS returns `{ url: "https://drive.google.com/..." }` |
| 8 | Client auto-fills the URL input with the returned Drive link |
| 9 | Form saves `images[]` as Drive URLs (existing schema) |

### Mode 2 — Manual URL

| Step | Action |
|------|--------|
| 1 | Staff pastes existing Google Drive share link |
| 2 | Client validates URL format (must be `drive.google.com`) |
| 3 | Client shows preview using the URL |
| 4 | URL saved directly to `images[]` — no GAS call needed |

### Multi-Image Rules

| Rule | Detail |
|------|--------|
| Max images | 5 per product |
| Min images | 1 per product |
| Reorder | Drag to reorder — `images[]` order determines display order on product page |
| First image | Primary image shown on ProductCard, product listing |
| Remove | ✕ button removes the slot. If all removed, show empty slot with upload prompt |

### ProductForm Image Section (updated)

```
  ┌── Images (max 5) ──────────────────────────────┐
  │                                                  │
  │  [Image 1]  [📁 Choose] [URL: ________________] │
  │             ┌────────────┐                       │
  │             │ 🖼 Preview  │  [✕]  [↕]           │
  │             └────────────┘                       │
  │                                                  │
  │  [Image 2]  [📁 Choose] [URL: ________________] │
  │             ┌────────────┐                       │
  │             │ 🖼 Preview  │  [✕]  [↕]           │
  │             └────────────┘                       │
  │                                                  │
  │  [+ Add Image]  (max 5 reached)                  │
  └──────────────────────────────────────────────────┘
```

---

## Purchase Bill Upload Flow

When creating/editing a purchase with `invoiceImage`:

| Step | Action |
|------|--------|
| 1 | Staff selects bill file (PDF or image) — or pastes Drive URL |
| 2 | If file: upload to GAS → saves to `/Purchases/Bills/` → returns URL |
| 3 | If URL: validated and saved directly |
| 4 | URL stored in `purchase.invoiceImage` |

---

## CSV Export Flow

### Column Definitions per Export

| Export | Columns |
|--------|---------|
| **Orders** | Order#, Customer, Phone, Items (count), Subtotal, Discount, Delivery, Grand Total, Payment Method, Payment Status, Status, Created Date (BS) |
| **Sales Report** | Date (BS), Order#, Customer, Phone, Grand Total, Payment Method, Status |
| **Purchases** | Purchase#, Supplier, Phone, Items (count), Grand Total, Payment Method, Payment Status, Date (BS) |
| **Inventory** | Product, SKU, Stock Quantity, Stock Status, Cost Price (NPR), Last Updated |
| **Batches** | Batch#, Product, Raw Material Cost, Units Produced, Packing Variance, Date (BS) |
| **Expenses** | Date (BS), Title, Category, Amount, Payment Method, Batch Link |
| **Products** | Name, Slug, Categories, SKU Count, Price Range, Featured, Active |
| **Debtors** | Customer, Phone, Outstanding (NPR), Open Orders, Last Order (BS), Days Overdue |
| **Creditors** | Supplier, Phone, Outstanding (NPR), Open Purchases, Last Purchase (BS), Days Overdue |
| **P&L** | Revenue, COGS, Gross Profit, Expenses, Net Profit |
| **Balance Sheet** | Assets (Cash, Bank, Debtors, Raw Mat Stock, FG Stock), Liabilities (Creditors), Equity (Capital, Retained Earnings, Drawings, Net Profit) |

### Generation

```typescript
function generateCSV(rows: any[], columns: ColumnDef[]): string {
  const escape = (val: any) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const header = columns.map(c => escape(c.label)).join(',');
  const data = rows.map(row =>
    columns.map(c => escape(formatValue(row[c.key], c.type))).join(',')
  );

  return [header, ...data].join('\n');
}
```

### Storage

After generating CSV client-side, send to GAS to store in Drive:

```typescript
async function exportToDrive(exportType: string, csvContent: string) {
  const bsDate = toBSDateString();
  const folder = exportType === 'backup' ? 'Database Backups' : 'Reports';
  const fileName = `${exportType}-${bsDate}.csv`;

  await fetch(gasUrl, {
    method: 'POST',
    body: JSON.stringify({
      action: exportType === 'backup' ? 'backupCSV' : 'exportReport',
      folder,
      fileName,
      csvContent
    })
  });
}
```

Alternatively, trigger a **browser download** as a fallback if GAS is unreachable:

```typescript
function downloadCSV(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
```

---

## Cache Archive Push Flow

Cache archives are **frozen snapshots** of pre-computed cache documents pushed to GAS on period close and daily midnight. See Cache Strategy.md for the full architecture.

### Archived Data

| Archive | Trigger | Drive File | Sheet Tab |
|---------|---------|-----------|-----------|
| **KPI Snapshot** | Daily at midnight NPT + Period close | `Archives/kpi-{BS_DATE}.csv` | `kpi_history` |
| **P&L Report** | Period close (isFinal=true) | `Archives/pnl-{BS_YEAR}.csv` | `reports_pnl` |
| **Balance Sheet** | Period close (isFinal=true) | `Archives/balance-sheet-{BS_YEAR}.csv` | `reports_bs` |

### Push Flow

```
Period Close (or midnight NPT trigger):
  1. Admin panel finalizes cache doc (sets isFinal=true)
  2. Client calls GAS → archiveKPI({ date, salesToday, ... })
  3. Client calls GAS → archiveReport({ reportType: 'pnl', periodId, data })
  4. Client calls GAS → archiveReport({ reportType: 'balance_sheet', periodId, data })
```

### GAS Archive Endpoints

| Action | Method | Payload | Writes To |
|--------|--------|---------|-----------|
| `archiveKPI` | POST | `{ date, salesToday, pendingOrders, ... }` | `Archives/kpi-{BS_DATE}.csv` + `kpi_history` sheet tab |
| `archiveReport` | POST | `{ reportType: 'pnl'|'balance_sheet', periodId, data, generatedAt }` | `Archives/{type}-{periodId}.csv` + `reports_pnl`/`reports_bs` sheet tab |
| `readArchive` | GET | `?type=kpi|pnl|bs&periodId=...` | Returns sheet rows as JSON |

### Client-Side Archive Trigger

```typescript
// In cacheManager.ts, after cache recalculation:
if (shouldArchive(action, cacheKey, cacheDoc)) {
  if (isKPISnapshot) {
    await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'archiveKPI',
        date: toBSDateString(),
        salesToday: cacheDoc.salesToday,
        pendingOrders: cacheDoc.pendingOrders,
        netProfit: cacheDoc.netProfit,
        expensesVsBudget: cacheDoc.expensesVsBudget,
        outstandingCredit: cacheDoc.outstandingCredit,
        outstandingPayables: cacheDoc.outstandingPayables,
        lowStockCount: cacheDoc.lowStockCount
      })
    });
  }
  if (isPeriodClose) {
    await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'archiveReport',
        reportType: 'pnl',
        periodId,
        data: pnlCache,
        generatedAt: new Date().toISOString()
      })
    });
    await fetch(gasUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'archiveReport',
        reportType: 'balance_sheet',
        periodId,
        data: bsCache,
        generatedAt: new Date().toISOString()
      })
    });
  }
}
```

---

## Daily Auto Backup

### Apps Script Time-Based Trigger

```
Trigger: Time-driven → Day timer → 11:30 PM to 12:30 AM
Function: dailyBackup()
```

The `dailyBackup()` function calls back to the Firebase client or directly queries the admin panel to fetch all collections. Since GAS can't query Firestore directly, the approach is:

**Option A: Admin panel polls GAS daily**
- Admin panel has a `setTimeout` / `setInterval` that checks `nextBackupAt` from `/settings/backup`
- When time matches, admin panel fetches all data, generates CSVs, sends to GAS

**Option B: GAS cron fires HTTP to an endpoint**
- Since this is a static site, there's no server endpoint to call
- Use Firebase Extensions (Scheduler + Firestore export) or a simple client-side check on dashboard load

**Recommended (Option A — client-side):**
```
Dashboard loads → check if backup is due (nextBackupAt < now)
  → If yes: silently fetch all collections → generate CSVs → POST to GAS
  → Update nextBackupAt in settings
```

### Backup Checklist (Daily)

| Collection | Priority | Query |
|------------|----------|-------|
| Orders | Required | All orders (no filter — full backup) |
| Batches | Required | All batches |
| Expenses | Required | All expenses |
| Purchases | Required | All purchases |
| Products | Required | All products + SKUs |
| Debtors | Required | All debtors where clearedAt == null |
| Creditors | Required | All creditors where clearedAt == null |
| Inventory | Nice-to-have | Computed stock snapshot |

---

## Admin Panel: Backup & Export Page

| Component | File | Behavior |
|-----------|------|----------|
| **BackupPage** | `admin/src/pages/Backup.tsx` | Main backup page. Shows Drive status, last backup time, next backup time. Three sections: Manual Export, Auto Backup, Image Migration |
| **ExportForm** | `admin/src/components/ExportForm.tsx` | Multi-select checkboxes for which reports to export. Date range picker (BS). Export button → generates CSVs → sends to Drive + downloads locally |
| **BackupStatusCard** | `admin/src/components/BackupStatusCard.tsx` | Card showing: Drive connection status, last backup, next backup, storage used. Refresh button |
| **ImageMigrationPanel** | `admin/src/components/ImageMigrationPanel.tsx` | One-time migration UI: "Migrate Existing Images" button. Progress bar showing current/total. Log of migrated images |

### Backup Page Layout

```
┌── Backup & Export ────────────────────────────────────────┐
│                                                            │
│  ┌── Google Drive Status ───────────────────────────────┐ │
│  │                                                       │ │
│  │  ✅ Connected — Great Pickle Taste Backup             │ │
│  │  Last backup: Ashad 32, 2083 11:30 PM                │ │
│  │  Next backup: Shrawan 01, 2083 11:30 PM              │ │
│  │  Drive used: 45 MB / 15 GB      [↻ Refresh]         │ │
│  │                                                       │ │
│  │  [Run Auto Backup Now]   [⛔ Disable Auto Backup]     │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌── Manual Export ──────────────────────────────────────┐ │
│  │                                                       │ │
│  │  Select data to export:              Period:          │ │
│  │                                                       │ │
│  │  ☑ Orders                    [Shrawan 01 ▼]─[Now]    │ │
│  │  ☐ Sales Report              [Custom Range ▼]        │ │
│  │  ☐ Purchases                 ┌─────────┬─────────┐   │ │
│  │  ☐ Inventory                 │  From   │   To    │   │ │
│  │  ☐ Batches                   │ [picker]│ [picker]│   │ │
│  │  ☐ Expenses                  └─────────┴─────────┘   │ │
│  │  ☐ Products                                           │ │
│  │  ☑ Debtors                                            │ │
│  │  ☑ Creditors                                          │ │
│  │  ☑ P&L Report                                         │ │
│  │  ☑ Balance Sheet                                      │ │
│  │                                                       │ │
│  │  [📥 Export Selected to Drive]  [💾 Download CSV]     │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌── Image Migration ────────────────────────────────────┐ │
│  │                                                       │ │
│  │  Existing product images: 45                          │ │
│  │  Already migrated: 0                                  │ │
│  │                                                       │ │
│  │  ████████░░░░░░░░░░░░░░░░░░░░  32%                   │ │
│  │                                                       │ │
│  │  [▶ Start Migration]  (one-time — copies all existing │ │
│  │   product images from Drive links to organized folder) │ │
│  │                                                       │ │
│  │  Last migrated file: buff-achar-1.jpg → Done          │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

## GAS Endpoints Summary

| Action | Endpoint | Payload | Response |
|--------|----------|---------|----------|
| `uploadImage` | POST | `{ productSlug, fileName, base64Data }` | `{ url }` |
| `uploadBill` | POST | `{ purchaseNumber, fileName, base64Data }` | `{ url }` |
| `backupCSV` | POST | `{ folder, fileName, csvContent }` | `{ success: true }` |
| `exportReport` | POST | `{ folder, fileName, csvContent }` | `{ success: true }` |
| `migrateImages` | POST | `{ images: [{ productSlug, existingUrl }] }` | `{ migrated: number, results: [{ oldUrl, newUrl }] }` |
| `archiveKPI` | POST | `{ date, salesToday, pendingOrders, ... }` | `{ success: true }` |
| `archiveReport` | POST | `{ reportType, periodId, data, generatedAt }` | `{ success: true }` |
| `readArchive` | GET | `?type=kpi\|pnl\|bs&periodId=...` | `{ rows: [...] }` |
| `getStatus` | GET | — | `{ usedStorage, totalStorage, lastBackup }` |

---

## Firestore Indexes

(None — backup data is stored in Drive, not Firestore. Only `/settings/backup` config doc.)

---

## Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| View backup page | `backup:read` | Super Admin, Manager, Staff |
| Export data to Drive | `backup:export` | Super Admin, Manager |
| Download CSV locally | `backup:export` | Super Admin, Manager, Staff |
| Run auto backup | `backup:schedule` | Super Admin, Manager |
| Toggle auto backup | `backup:schedule` | Super Admin |
| Run image migration | `backup:write` | Super Admin |

### Role Mapping

| Role | Read | Export | Schedule | Migration |
|------|:----:|:------:|:--------:|:---------:|
| Super Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ❌ |
| Staff | ✅ | ✅ | ❌ | ❌ |
| Viewer | ❌ | ❌ | ❌ | ❌ |

---

## Implementation Notes

- **GAS Web App URL**: Stored in `/settings/backup.gasUrl`. Must be configured once during setup.
- **Daily backup check**: On admin dashboard page load, check if backup is due (`nextBackupAt < now`). If yes, run backup in background (non-blocking).
- **Cache archive push**: On period close + daily midnight, cache snapshots are pushed to GAS. See Cache Strategy.md.
- **CSV encoding**: UTF-8 with BOM for Excel compatibility. Use `\ufeff` prefix.
- **Large datasets**: For collections with 1000+ records, paginate CSV generation (500 rows per batch, then concatenate).
- **Image migration**: Run once. Tracks progress in `/settings/backup.migrationStatus`. If interrupted, resumes from last migrated image.
- **File size limit**: GAS has 50 MB response limit. Keep individual images under 5 MB. CSVs are typically small (< 1 MB).
- **GAS quota**: Daily email recipients: 100. Execution time: 6 min/execution. Daily triggers: 1 hr total. For a pickle shop, CSV generation takes < 30 seconds.
- **Fallback download**: If GAS is unreachable, still offer browser download of CSV. The user can manually upload to Drive later.
- **Drive folder naming**: Use BS date for backup files: `orders-2083-04-01.csv`. For monthly cleanup, GAS can archive files older than 1 BS year.

---

## Integration Points

| Module | Connection |
|--------|-----------|
| **Cache Strategy** | Archive endpoints receive finalized cache snapshots (KPI, P&L, Balance Sheet) on period close + daily midnight |
| **Financial Reports** | Period close triggers archiveReport push; readArchive serves historical report data |
| **Dashboard** | Daily KPI snapshot pushed via archiveKPI on midnight trigger |
