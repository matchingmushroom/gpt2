# Module: Debtors (Credit Sales)

## Purpose
Track customers who purchase on credit. When a credit sale is created, a debtor record is auto-created/updated. When the debtor pays later, the outstanding balance is reduced and the system auto-distributes the payment across their oldest open orders first (FIFO). Fully paid debtors are auto-archived.

---

## Firestore Collection: `debtors/{phone}`

```typescript
{
  id: string                       // Phone number (unique identifier)
  customerName: string
  customerPhone: string

  // Balances
  totalOutstanding: number         // Current total due across all open orders
  totalCreditLifetime: number      // Lifetime credit given
  totalPaidLifetime: number        // Lifetime payments received

  // Dates
  lastOrderDate: Timestamp
  lastPaymentDate: Timestamp | null
  openOrdersCount: number          // # of unpaid/partial orders

  // Status
  clearedAt: Timestamp | null      // Set when totalOutstanding == 0
  notes: string                    // Internal staff notes

  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Lifecycle

```
Credit Sale Created
       │
       ▼
  debtor.totalOutstanding += grandTotal
  debtor.totalCreditLifetime += grandTotal
  debtor.openOrdersCount++
  debtor.clearedAt = null (reactivate if archived)
       │
       ▼
  (time passes — customer pays)
       │
       ▼
  Receive Payment (staff, any amount)
       │
       ├── debtor.totalOutstanding -= amount
       ├── debtor.totalPaidLifetime += amount
       ├── debtor.lastPaymentDate = now
       │
       ├── Payment auto-distributed to oldest open orders (FIFO)
       │   Example:
       │     Order GPT-0043 (Jun 10) — NPR 500 unpaid → fully paid
       │     Order GPT-0051 (Jun 15) — NPR 700 unpaid → NPR 300 paid (partial)
       │     Order GPT-0052 (Jun 20) — NPR 0 (not reached)
       │
       └── If totalOutstanding == 0:
             ├── debtor.clearedAt = now
             ├── All associated orders → paymentStatus = 'paid'
             └── Debtor hidden from Active list, shown in Paid History
```

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **DebtorList** | `admin/src/pages/Debtors.tsx` | Two tabs: Active | Paid History. Table: Customer, Phone, Total Due, Last Order, Days Overdue badge, Receive Payment button. Search by name/phone. Sort by total due or overdue days |
| **ReceivePaymentModal** | `admin/src/components/ReceivePaymentModal.tsx` | Shows customer name, phone, outstanding balance. Fields: Amount (NPR), Method (Cash/Bank/eSewa/Khalti), Note (optional). Auto-fill amount = totalOutstanding button. Submit updates debtor + distributes to orders |
| **DebtorDetail** | `admin/src/components/DebtorDetail.tsx` | Full view: customer info, outstanding balance, order history (list of orders with status/amount), payment history, notes |
| **ActiveDebtorBadge** | `admin/src/components/ActiveDebtorBadge.tsx` | Red badge in sidebar: "NPR 8,450 outstanding" — shown to staff with `debtors:read` permission |

### DebtorList Layout

```
┌── Credit Customers ───────────────────────────────────┐
│                                                         │
│  [Active (12)]  [Paid History (8)]                     │
│                                                         │
│  Search: [____________________]                         │
│                                                         │
│  Total Outstanding: NPR 8,450                           │
│                                                         │
│  ┌─ Name ────────── Phone ─────── Due ───── Overdue ─┐ │
│  │  Ram Sharma     98XXXXXXXX  NPR 1,200   7d  🟠    │ │
│  │  Sita KC        97XXXXXXXX  NPR 3,500   14d 🔴    │ │
│  │  Hari Gurung    98XXXXXXXX  NPR 750     3d  🟢    │ │
│  │  Gopal Adhikari 98XXXXXXXX  NPR 3,000   21d 🔴    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│           [← Prev]  Page 1 of 3  [Next →]              │
└─────────────────────────────────────────────────────────┘
```

### Overdue Badge Colors

| Days Since Last Order | Color |
|:---------------------:|:-----:|
| 0–6 days | Green 🟢 |
| 7–13 days | Amber 🟠 |
| 14+ days | Red 🔴 |

Thresholds configurable in `/settings/credit` (see Settings module).

### ReceivePaymentModal

```
┌──────────────────────────────────────────────┐
│  Receive Payment                              │
│                                               │
│  Customer: Ram Sharma                         │
│  Phone:    98XXXXXXXX                         │
│                                               │
│  Outstanding Balance: NPR 1,200               │
│                                               │
│  Amount *     [1,200             ] [Full]    │
│  Method *     [Cash ▼]                       │
│  Note         [____________________]          │
│                                               │
│  ── Orders being paid ──────────────────      │
│  ✅ GPT-0043 (Jun 10) — NPR 500 → NPR 500    │
│  ⏳ GPT-0051 (Jun 15) — NPR 700 → NPR 700    │
│                                               │
│  Change: NPR 1,200 → NPR 0 (Fully cleared)   │
│                                               │
│  [Cancel]              [Submit Payment]       │
└──────────────────────────────────────────────┘
```

---

## Payment Distribution Logic (FIFO)

When staff submits a payment, the system:

1. Fetches all orders for this debtor phone where `paymentMethod == 'credit'` and `paymentStatus != 'paid'`, ordered by `createdAt ASC` (oldest first)
2. Iterates through orders, applying payment amount to oldest order first
3. Updates each order:
   - Pushes to `paymentHistory[]`
   - Updates `paymentStatus` to `'paid'` or `'partial'`
4. Updates debtor doc:
   - `totalOutstanding` reduced
   - If 0: sets `clearedAt = now`

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `debtors` | `clearedAt` ASC, `totalOutstanding` DESC | Active debtors (clearedAt == null) sorted by due amount |
| `orders` | `customerPhone` ASC, `paymentMethod` ASC, `paymentStatus` ASC, `createdAt` ASC | Fetch credit orders for FIFO distribution |
| `orders` | `paymentMethod` ASC, `paymentStatus` ASC, `createdAt` DESC | View all credit orders |

---

## Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| View debtors list | `debtors:read` | Super Admin, Manager, Staff |
| View debtor detail | `debtors:read` | Super Admin, Manager, Staff |
| Receive payment | `debtors:write` | Super Admin, Manager |
| Edit debtor notes | `debtors:write` | Super Admin, Manager |
| Delete debtor record | `debtors:write` | Super Admin |

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
match /debtors/{phone} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['debtors:read', 'admin:all']);

  allow write: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['debtors:write', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['debtors:write', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Credit sale created | `"Credit sale GPT-0043 — NPR 1,200 — debtor: Ram Sharma (98XXXXXXXX)"` |
| Payment received | `"Received NPR 500 from Ram Sharma — fully cleared Debtor"` |
| Payment received | `"Received NPR 300 from Ram Sharma — remaining NPR 400"` |
| Debtor archived | `"Ram Sharma fully cleared — archived (NPR 3,500 total paid)"` |
| Debtor reactivated | `"Ram Sharma reactivated — new credit sale GPT-0060"` |
| Notes edited | `"Updated notes for Ram Sharma"` |

---

## Integration with Other Modules

| Module | Integration |
|--------|-------------|
| **Orders & Checkout** | `paymentMethod: 'credit'` triggers debtor creation/update |
| **Quick Sale (POS)** | Credit payment option in POS creates debtor doc on complete |
| **Settings** | `/settings/credit` — enable/disable credit, set limits, overdue thresholds |
| **Dashboard** | "Outstanding Credit" KPI — sum of all `debtors.totalOutstanding` |
| **Staff Management** | `debtors:read`, `debtors:write` permissions |
| **Creditors** | Mirror module for supplier-side credit tracking (accounts payable) |

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — last order date, last payment date. Staff enters in AD picker; system converts. See `utils/nepaliDate.ts`.
- **Debtor identifier**: Phone number is the unique key. If a customer uses different phones, staff can merge manually or the system treats them as separate debtors
- **Client-side distribution**: Payment distribution across orders runs client-side. For MVP, this is fine — a small business has at most a few dozen open credit orders per debtor
- **Optimistic update**: On payment submission, optimistically update the debtor doc in local state. Rollback on Firestore write failure
- **Reactivation**: If an archived debtor (clearedAt != null) places a new credit order, set `clearedAt = null` and continue with the existing doc
- **Deletion**: Deleting a debtor doc does NOT delete associated orders. Orders remain with their original payment records
- **Badge refresh**: Sidebar badge count refreshes on page navigation (no real-time subscription for sidebar — use onSnapshot if needed)
