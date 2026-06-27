# Module: Creditors (Accounts Payable)

## Purpose
Track money the business owes to suppliers for raw materials purchased on credit. When a credit purchase is created, a creditor record is auto-created/updated. When the business pays the supplier later, the outstanding balance is reduced and the system auto-distributes the payment across their oldest unpaid purchases first (FIFO). Fully paid creditors are auto-archived.

Enables financial reports: balance sheet (liabilities), aging report, cash flow forecast.

---

## Firestore Collection: `creditors/{supplierId}`

```typescript
{
  id: string                       // supplierId (same as /suppliers/{id})
  supplierName: string
  supplierPhone: string

  // Balances
  totalOutstanding: number         // Current total due across all unpaid purchases
  totalCreditLifetime: number      // Lifetime credit from this supplier
  totalPaidLifetime: number        // Lifetime payments made

  // Dates
  lastPurchaseDate: Timestamp
  lastPaymentDate: Timestamp | null
  openPurchasesCount: number       // # of unpaid/partial purchases

  // Terms
  paymentTerms: string | null      // "Net 30", "Net 60" (optional, from purchase or supplier)

  // Status
  clearedAt: Timestamp | null      // Set when totalOutstanding == 0
  notes: string

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Lifecycle

```
Credit Purchase Created
       │
       ▼
  creditor.totalOutstanding += grandTotal
  creditor.totalCreditLifetime += grandTotal
  creditor.openPurchasesCount++
  creditor.clearedAt = null (reactivate if archived)
       │
       ▼
  (time passes — business pays supplier)
       │
       ▼
  Make Payment (staff, any amount)
       │
       ├── creditor.totalOutstanding -= amount
       ├── creditor.totalPaidLifetime += amount
       ├── creditor.lastPaymentDate = now
       │
       ├── Payment auto-distributed to oldest unpaid purchases (FIFO)
       │   Example:
       │     Purchase P-2026-001 (Jun 10) — NPR 5,000 unpaid → fully paid
       │     Purchase P-2026-003 (Jun 18) — NPR 3,000 unpaid → NPR 2,000 paid (partial)
       │     Purchase P-2026-004 (Jun 25) — NPR 0 (not reached)
       │
       └── If totalOutstanding == 0:
             ├── creditor.clearedAt = now
             ├── All associated purchases → paymentStatus = 'paid'
             └── Creditor hidden from Active list, shown in Paid History
```

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **CreditorList** | `admin/src/pages/Creditors.tsx` | Two tabs: Active / Paid History. Table: Supplier, Phone, Total Due, Last Purchase, Days Overdue badge, Make Payment button. Search by name/phone. Sort by total due or overdue days |
| **MakePaymentModal** | `admin/src/components/MakePaymentModal.tsx` | Shows supplier name, outstanding balance. Fields: Amount (NPR), Method (Cash/Bank), Note. Auto-fill total amount button. Shows FIFO preview of which purchases will be paid |
| **AgingReport** | `admin/src/components/AgingReport.tsx` | Table grouped by aging buckets: Current (0–30d), 31–60d, 61d+. Each supplier row with amounts per bucket. Total row at bottom |
| **CreditorDetail** | `admin/src/components/CreditorDetail.tsx` | Full view: supplier info, outstanding balance, purchase history with payment status, payment history, notes |

### CreditorList Layout

```
┌── Creditors (Accounts Payable) ──────────────────────────┐
│                                                           │
│  [Active (8)]  [Paid History (12)]                       │
│                                                           │
│  Search: [____________________]                           │
│                                                           │
│  Total Outstanding: NPR 45,800                            │
│                                                           │
│  ┌─ Supplier ─────── Phone ─────── Due ────── Overdue ─┐ │
│  │  ABC Meat        98XXXXXXXX  NPR 15,000   5d  🟢    │ │
│  │  Glass House     97XXXXXXXX  NPR 12,500   45d 🔴   │ │
│  │  Oil Traders     98XXXXXXXX  NPR 8,300    32d 🟠   │ │
│  │  Label Company   98XXXXXXXX  NPR 10,000   2d  🟢    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│           [← Prev]  Page 1 of 2  [Next →]                │
└───────────────────────────────────────────────────────────┘
```

### Overdue Badge Colors

| Days Since Last Purchase | Color |
|:-----------------------:|:-----:|
| 0–30 days | Green 🟢 |
| 31–60 days | Amber 🟠 |
| 61+ days | Red 🔴 |

### MakePaymentModal

```
┌──────────────────────────────────────────────┐
│  Make Payment                                 │
│                                               │
│  Supplier: ABC Meat Suppliers                 │
│  Phone:    98XXXXXXXX                         │
│                                               │
│  Outstanding Balance: NPR 15,000              │
│                                               │
│  Amount *     [15,000            ] [Full]    │
│  Method *     [Bank ▼]                       │
│  Note         [Payment for Jun batch    ]     │
│                                               │
│  ── Purchases being paid ────────────────     │
│  ✅ P-2026-005 (Jun 20) — NPR 8,000 → NPR 8K │
│  ✅ P-2026-006 (Jun 25) — NPR 7,000 → NPR 7K │
│                                               │
│  Change: NPR 15,000 → NPR 0 (Fully cleared)   │
│                                               │
│  [Cancel]              [Submit Payment]       │
└──────────────────────────────────────────────┘
```

### Aging Report Layout

```
┌── Aging Report ──────────────────────────────────────────┐
│                      Current   31-60d    61d+    Total   │
│  ─────────────────────────────────────────────────────── │
│  ABC Meat           15,000     0         0      15,000   │
│  Glass House        0          12,500    0      12,500   │
│  Oil Traders        0          8,300     0       8,300   │
│  Label Company      10,000     0         0      10,000   │
│  ─────────────────────────────────────────────────────── │
│  Total              25,000    20,800     0      45,800   │
└──────────────────────────────────────────────────────────┘
```

---

## Payment Distribution Logic (FIFO)

When staff submits a payment:

1. Fetches all purchases for this supplier where `paymentMethod == 'credit'` and `paymentStatus != 'paid'`, ordered by `createdAt ASC` (oldest first)
2. Iterates through purchases, applying payment amount to oldest first
3. Updates each purchase:
   - `paidAmount` increased
   - `paymentStatus` updated to `'paid'` or `'partial'`
   - `paymentDate` set
4. Updates creditor doc:
   - `totalOutstanding` reduced
   - If 0: sets `clearedAt = now`

---

## Financial Reports

| Report | Description | Data Source |
|--------|-------------|-------------|
| **Balance Sheet — Liabilities** | Total outstanding payables | Sum of `creditors.totalOutstanding` where `clearedAt == null` |
| **Aging Report** | Outstanding amounts by overdue bucket | `creditors` grouped by `lastPurchaseDate` |
| **Cash Flow Forecast** | Expected payments due next 7/30 days | Purchases with `paymentMethod == 'credit'` and `paymentStatus != 'paid'` |
| **Supplier P&L** | Total purchased vs total paid per supplier, per period | Purchases aggregated by `supplierId` |

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `creditors` | `clearedAt` ASC, `totalOutstanding` DESC | Active creditors sorted by due amount |
| `purchases` | `supplierId` ASC, `paymentMethod` ASC, `paymentStatus` ASC, `createdAt` ASC | Fetch credit purchases for FIFO distribution |
| `purchases` | `paymentMethod` ASC, `paymentStatus` ASC, `createdAt` DESC | View all credit purchases |

---

## Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| View creditors list | `creditors:read` | Super Admin, Manager, Staff |
| View creditor detail | `creditors:read` | Super Admin, Manager, Staff |
| Make payment | `creditors:write` | Super Admin, Manager |
| Edit creditor notes | `creditors:write` | Super Admin, Manager |
| Delete creditor record | `creditors:write` | Super Admin |
| View aging report | `creditors:read` | Super Admin, Manager |

### Role Mapping

| Role | Read | Write |
|------|:----:|:-----:|
| Super Admin | ✅ | ✅ |
| Manager | ✅ | ✅ |
| Staff | ✅ | ❌ |
| Viewer | ❌ | ❌ |

---

## Security Rules

```javascript
match /creditors/{supplierId} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['creditors:read', 'admin:all']);

  allow write: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['creditors:write', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['creditors:write', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Credit purchase created | `"Credit purchase P-2026-005 — NPR 8,000 — creditor: ABC Meat updated"` |
| Payment made | `"Paid NPR 15,000 to ABC Meat — fully cleared"` |
| Payment made | `"Paid NPR 5,000 to ABC Meat — remaining NPR 3,000"` |
| Creditor archived | `"ABC Meat fully cleared — archived"` |
| Creditor reactivated | `"ABC Meat reactivated — new credit purchase P-2026-007"` |

---

## Integration with Other Modules

| Module | Integration |
|--------|-------------|
| **Purchases (Raw Materials)** | Credit purchase save → creditor create/update. Payment → creditor reduced. `paymentMethod: 'credit'` triggers creditor flow |
| **Dashboard** | "Outstanding Payables" KPI — sum of all `creditors.totalOutstanding` |
| **Settings** | (Optional) Default payment terms per supplier config |
| **Staff Management** | `creditors:read`, `creditors:write` permissions |
| **Debtors** | Mirror module for customer-side credit tracking (accounts receivable) |

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — last purchase date, last payment date. Staff enters in AD picker; system converts. See `utils/nepaliDate.ts`.
- **Supplier identifier**: Uses `supplierId` from `/suppliers/{id}` as the unique key. One creditor record per supplier
- **Client-side FIFO**: Same pattern as Debtors. Payment distribution runs client-side. For a pickle business (at most a few dozen credit purchases per supplier), this is fast
- **Aging calculation**: `daysOverdue = today - lastPurchaseDate`. Uses `overdueWarningDays` (30) and `overdueDangerDays` (60) thresholds from `/settings/credit` — or add separate debtor/creditor thresholds later
- **Reactivation**: If an archived creditor places a new credit purchase, set `clearedAt = null` and continue
- **Payment terms**: Net terms (e.g., "Net 30") can be stored on the supplier doc (`/suppliers/{id}.paymentTerms`) and auto-copied to creditor doc on creation
