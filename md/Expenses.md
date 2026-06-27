# Module 6: Expenses

## Purpose
Track all business expenses that are NOT raw material purchases — rent, utilities, marketing, salaries, transport, packaging (standalone), maintenance, and miscellaneous costs. Can optionally link expenses to specific production batches.

---

## Firestore Collections

### `/expenses/{expenseId}`

```typescript
{
  id: string
  title: string                         // "March Rent", "Facebook Ads"
  category: 'rent' | 'utilities' | 'marketing' | 'salary' | 'transport' | 'packaging' | 'maintenance' | 'miscellaneous'
  amount: number
  description: string
  date: Timestamp

  // Optional — link to a specific batch
  batchId: string | null                // If tied to a batch
  batchNumber: string | null            // Denormalized: "B-2026-001"

  paymentMethod: 'cash' | 'bank' | 'credit'
  receiptImage: string | null           // Google Drive link

  isRecurring: boolean
  recurringInterval: 'monthly' | 'yearly' | null

  createdBy: string                     // staffId
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `/settings/budgets` (budget configuration)

```typescript
{
  categories: {
    rent: {
      mode: 'limit' | 'track',         // 'limit' = has budget cap, 'track' = just track
      limit: number | null              // Monthly budget amount (only if mode='limit')
    },
    utilities: { mode: 'track', limit: null },
    marketing: { mode: 'limit', limit: 10000 },
    salary: { mode: 'limit', limit: 50000 },
    transport: { mode: 'track', limit: null },
    packaging: { mode: 'limit', limit: 8000 },
    maintenance: { mode: 'track', limit: null },
    miscellaneous: { mode: 'limit', limit: 2000 }
  },
  updatedAt: Timestamp,
  updatedBy: string
}
```

| Mode | Display | Alert |
|------|---------|-------|
| `track` | "Spent: NPR 8,000 this month" | None |
| `limit` | "NPR 8,000 / NPR 10,000" with progress bar | Yellow at >80%, Red at >100% |

Budgets reset at the start of each month. The dashboard compares current month actuals against budgets.

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **ExpenseList** | `admin/src/pages/Expenses.tsx` | Table: Date | Title | Category badge | Amount | Batch link | Receipt icon | Actions. Filters: category, date range, batch-linked toggle. Desktop: table. Mobile: cards |
| **ExpenseForm** | `admin/src/components/ExpenseForm.tsx` | Title, category dropdown, amount, date picker, description, payment method. Optional: "Link to Batch" checkbox → batch number selector. Receipt image URL. Recurring toggle + interval |
| **ExpenseDetail** | `admin/src/components/ExpenseDetail.tsx` | Read-only view with all fields. Edit/Delete buttons |
| **BudgetSettings** | `admin/src/pages/BudgetSettings.tsx` | Table of all categories. Each row: Category name, Mode toggle (Track / Limit), Limit input (visible only if Limit mode). Save button. Part of main Settings page |
| **ExpenseChart** | `admin/src/components/ExpenseChart.tsx` | Pie chart by category for selected month. Bar chart comparing current month vs previous month |

### Expense Page Layout

```
┌──────────────────────────────────────────────┐
│  Expenses                         [+ Add]    │
│                                               │
│  [All Categories ▼]  [This Month ▼]          │
│                                               │
│  ┌──────────────────────────────────────────┐│
│  │ Date       Title          Cat      Amt   ││
│  │──────────────────────────────────────────││
│  │ Jun 21     Office Rent   Rent   15,000  ││
│  │ Jun 20     FB Ads        Mktg    5,000  ││
│  │ Jun 18     Staff Salary  Salary 50,000  ││
│  │ Jun 15     Transport     Trans   1,200  ││
│  │ Jun 10     Jars (B-001)  Pkg     3,500  ││
│  └──────────────────────────────────────────┘│
│                                               │
│  ── This Month Summary ──────────────────────│
│  Total: NPR 74,700                           │
│                                               │
│  ┌── Budget Overview ──────────────────────┐ │
│  │ Rent:     ████████████████████░░  90%   │ │
│  │           NPR 15,000 / NPR 15,000  ⚠    │ │
│  │ Marketing:████████████░░░░░░░░░  50%    │ │
│  │           NPR 5,000 / NPR 10,000        │ │
│  │ Salary:   ██████████████████████ 100%   │ │
│  │           NPR 50,000 / NPR 50,000  🔴   │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Expense Form Layout

```
┌──────────────────────────────────────────────┐
│  New Expense                                  │
│                                               │
│  Title *       [____________________]         │
│  Category *    [Rent                     ▼]  │
│  Amount *      [________] NPR                │
│  Date *        [2026-06-21        📅]        │
│                                               │
│  Description:                                 │
│  [____________________________________]       │
│                                               │
│  Payment:  [Cash ▼]                          │
│                                               │
│  Link to Batch?  [☐]  Batch# [________]      │
│                                               │
│  Recurring?      [☐]  Interval [Monthly ▼]   │
│                                               │
│  Receipt Image (GD Link):                     │
│  [____________________________________]       │
│                                               │
│  [Cancel]                    [Save Expense]   │
└──────────────────────────────────────────────┘
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `title` | Required, 3–200 characters |
| `category` | Required, must be valid category |
| `amount` | Required, > 0 |
| `date` | Required, cannot be future date |
| `batchId` | Optional, must reference existing batch if provided |
| `receiptImage` | Optional, must be valid Google Drive URL if provided |

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `expenses` | `category` ASC, `date` DESC | Filter by category |
| `expenses` | `date` DESC | Recent expenses |
| `expenses` | `batchId` ASC | Expenses linked to a batch |
| `expenses` | `createdBy` ASC, `date` DESC | Expenses by staff member |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| Read expenses | `expenses:read` |
| Create expense | `expenses:write` |
| Update expense | `expenses:write` |
| Delete expense | `expenses:delete` |

### Role Mapping

| Role | Read | Write | Delete |
|------|:----:|:-----:|:------:|
| Super Admin | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ |
| Staff | ❌ | ❌ | ❌ |
| Viewer | ❌ | ❌ | ❌ |

---

## Security Rules

```javascript
match /expenses/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['expenses:read', 'admin:all']);
  allow create, update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['expenses:write', 'admin:all']);
  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['expenses:delete', 'admin:all']);
}

match /settings/budgets {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['expenses:read', 'admin:all']);
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Create expense | `"Recorded expense: Office Rent — NPR 15,000"` |
| Update expense | `"Updated expense: Office Rent — amount changed from 14,000 to 15,000"` |
| Link to batch | `"Linked expense 'Jars' to batch B-2026-001"` |
| Delete expense | `"Deleted expense: Office Rent"` |
| Update budget | `"Updated budgets: Marketing limit changed from 8,000 to 10,000"` |

---

## Dashboard Integration

The dashboard shows:
- **Expense by Category**: Pie chart for current month
- **Budget vs Actual**: Cards per category with progress bars, color-coded
- **Monthly Trend**: Bar chart of last 6 months total expenses
- **Recurring Reminder**: List of recurring expenses due this month

---

## Relationships

```
Settings (Budgets) ───► controls budget limits per category
                          │
                          ▼
Module 6 (Expenses)  ───► Dashboard (comparison + alerts)
     │
     └── optional: batchId ──► Module 2 (Batches)
```

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — expense date, recurring due date. Staff enters in AD picker; system converts. See `utils/nepaliDate.ts`.
- **Budget spent calculation**: On ExpensePage load, query all expenses for current month, group by category, sum amounts. Compare to budget limits from `/settings/budgets`
- **Recurring expenses**: Auto-created on the 1st of each month if `isRecurring = true`. Staff can remove or edit the auto-created copy
- **Currency**: All amounts in NPR. currency formatting with commas: "NPR 15,000"
- **Batch linking**: The batch dropdown should only show batches from the current month (most relevant), with a "Show all" option
