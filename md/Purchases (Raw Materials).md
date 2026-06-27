# Module 5: Purchases (Raw Materials)

## Purpose
Track raw material procurement from suppliers — ingredients, jars, lids, labels, packaging. Purchase records feed into batch production (Module 2) for full traceability and cost tracking. Maintains master lists for suppliers and material items to enable aggregation and reorder alerts.

---

## Traceability Chain

```
/materialItems/{id}        Master item list
       │
       ▼
/suppliers/{id}            Supplier list
       │
       ▼
/purchases/{id}            Purchase record (items[].remainingQty)
       │
       ▼
/batches/{id}              Consumes from purchase (rawMaterials[].quantityUsed)
       │
       ▼
/products/{id}/skus/{id}   Finished goods (inventory)
```

---

## Firestore Collections

### `/suppliers/{supplierId}`

```typescript
{
  id: string
  name: string                       // "ABC Meat Suppliers"
  phone: string
  address: string                    // Optional
  totalPurchased: number             // Computed: sum of all purchases from this supplier
  lastPurchaseAt: Timestamp | null
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `/materialItems/{materialItemId}`

```typescript
{
  id: string
  name: string                       // "Buff Meat", "Jar 300ml", "Mustard Oil"
  category: 'ingredient' | 'packaging' | 'label' | 'other'
  defaultUnit: string                // "kg", "liter", "piece"
  currentStock: number               // Computed: sum of remainingQty across all purchases
  lowStockThreshold: number          // Alert when stock falls below this
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `/purchases/{purchaseId}`

```typescript
{
  id: string
  purchaseNumber: string              // "P-2026-001" (sequential)

  // Supplier
  supplierId: string                  // Ref: /suppliers/{id}
  supplierName: string                // Denormalized

  // Items received
  items: [
    {
      materialItemId: string          // Ref: /materialItems/{id}
      itemName: string                // "Buff Meat" (denormalized)
      category: 'ingredient' | 'packaging' | 'label' | 'other'
      quantity: number                // Total received (e.g., 20)
      unit: string                    // "kg", "liter", "piece"
      rate: number                    // Cost per unit (e.g., 800)
      totalCost: number               // quantity × rate (computed)
      remainingQty: number            // Starts = quantity, decreased by batches
    }
  ]
  subtotal: number                    // Sum of all item totalCosts
  tax: number                         // Optional
  grandTotal: number                  // subtotal + tax

  // Payment
  paymentStatus: 'paid' | 'unpaid' | 'partial'
  paidAmount: number
  paymentDate: Timestamp | null
  paymentMethod: 'cash' | 'bank' | 'credit'
  paymentHistory: [                     // Track payments against this purchase
    {
      method: 'cash' | 'bank'
      amount: number
      paidBy: string                   // staffId
      paidByName: string
      paidAt: Timestamp
      note: string
    }
  ]

  // Meta
  notes: string
  invoiceImage: string | null         // Google Drive link to supplier invoice
  createdBy: string                   // staffId
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Purchase Numbering

```
Format: P-{YEAR}-{SEQUENTIAL}
Example: P-2026-001, P-2026-002, P-2026-003
```

A `counters/purchases` document stores the current sequence number, incremented atomically with `FieldValue.increment(1)`.

---

## Data Flow

### Creating a Purchase

```
Staff opens PurchaseForm
  → Select supplier (dropdown, searchable, from /suppliers)
  → Add items (select material item, enter qty, rate auto-fills default)
  → Enter payment info
  → Save
      → Creates purchase document
      → Updates supplier.totalPurchased
      → Updates materialItem.currentStock
      → Updates counters/purchases
```

### Consuming from a Purchase (in Module 2 — Batch)

```
Staff creates Batch
  → Adds raw material row
      → Selects purchase (dropdown showing P# + supplier + date)
      → Selects item from that purchase
      → Enters quantity used
      → Validates: quantity used ≤ remainingQty
  → Save batch
      → Decrements purchase.items[].remainingQty
      → Updates materialItem.currentStock
```

### Reorder Alerts

When `materialItem.currentStock` drops below `lowStockThreshold`:
- **Admin Dashboard**: Shows alert card with item name and current stock
- **Raw Material Inventory Page**: Item highlighted in yellow/red
- **Purchase Form**: Optional suggestion banner when creating a new purchase

### Credit Purchase & Creditor Flow

When a purchase is saved with `paymentMethod: 'credit'`:

1. Purchase doc created with `paymentStatus: 'unpaid'`
2. Creditor doc in `/creditors/{supplierId}` auto-created or updated:
   - `totalOutstanding` + grandTotal
   - `totalCreditLifetime` + grandTotal
   - `openPurchasesCount` + 1
   - `clearedAt` cleared (reactivates if archived)

When a payment is made later (via MakePaymentModal on Creditors page):

1. Staff enters amount → system distributes FIFO across oldest unpaid purchases for this supplier
2. Each purchase's `paidAmount` increased, `paymentStatus` updated
3. Creditor's `totalOutstanding` reduced
4. If fully paid → `clearedAt` set, archived

> See Module: Creditors for full details.

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **SupplierList** | `admin/src/pages/Suppliers.tsx` | Table: Name, Phone, Total Purchased, Last Purchase, Actions (Edit/Delete). Add supplier button. Desktop: table. Mobile: cards |
| **SupplierForm** | `admin/src/components/SupplierForm.tsx` | Name (required), phone, address. On save → creates document |
| **MaterialItemsList** | `admin/src/pages/MaterialItems.tsx` | Table: Item Name, Category, Default Unit, Current Stock, Low Stock Threshold, Active toggle. Add/edit/delete |
| **MaterialItemForm** | `admin/src/components/MaterialItemForm.tsx` | Name, category dropdown, default unit, low stock threshold |
| **PurchaseList** | `admin/src/pages/Purchases.tsx` | Table: P#, Supplier, Items count, Grand Total, Payment Status, Date. Filters: supplier, date range, payment status. Mobile: cards |
| **PurchaseForm** | `admin/src/components/PurchaseForm.tsx` | Scroll form with sections: |
| | | **Header**: Supplier dropdown (searchable), purchase# auto, date |
| | | **Items**: Dynamic rows. Each: material item dropdown (filtered by category option), qty input, rate input (auto-fills from last purchase or default), total auto-computed. "Add Item" button. Total summary at bottom |
| | | **Payment**: Status dropdown, amount, date, method |
| | | **Notes**: Textarea, invoice image URL |
| | | **Save** button |
| **PurchaseDetail** | `admin/src/components/PurchaseDetail.tsx` | Read-only view. Shows all sections. Edit/Delete buttons |
| **RawMaterialInventory** | `admin/src/pages/RawMaterialInventory.tsx` | Aggregated view of /materialItems with computed stock. Table: Item | Category | Current Stock | Unit | Threshold | Status badge (✅ ok / ⚠ low / 🔴 out) |
| **SupplierDetail** | `admin/src/pages/SupplierDetail.tsx` | Supplier info + list of all purchases from this supplier. Total purchased amount |

### Raw Material Inventory Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Raw Material Inventory                  [Refresh]  │
│                                                     │
│  Search: [___________________]   Category: [All ▼]  │
│                                                     │
│  Item                 Category   Remaining   Status │
│  ───────────────────────────────────────────────    │
│  Buff Meat           Ingredient   15 kg      ✅     │
│  Mustard Oil         Ingredient    8 L       ✅     │
│  Mixed Spices        Ingredient    2 kg      ⚠ Low  │
│  Jar 300ml           Packaging   200 pcs     ✅     │
│  Jar 500ml           Packaging    50 pcs     ⚠ Low  │
│  Label Small         Label      1,000 pcs    ✅     │
│  Lids                Packaging    0 pcs      🔴 Out │
└─────────────────────────────────────────────────────┘
```

### Purchase Form Layout

```
┌──────────────────────────────────────────────┐
│  New Purchase                                 │
│                                               │
│  Supplier *    [ABC Meat Suppliers        ▼] │
│  Purchase #    P-2026-005  (auto)            │
│  Date          [2026-06-21        📅]        │
│                                               │
│  ── Items ──────────────────────────────     │
│  ┌────────────────────────────────────────┐  │
│  │ Item *     [Buff Meat         ▼]   ×   │  │
│  │ Category: Ingredient   Unit: kg        │  │
│  │ Quantity*  [20]    Rate* [800]         │  │
│  │ Total: NPR 16,000          Remaining:  │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Item *     [Jar 300ml         ▼]   ×   │  │
│  │ Category: Packaging  Unit: piece       │  │
│  │ Quantity*  [500]   Rate* [15]          │  │
│  │ Total: NPR 7,500            Remaining:  │  │
│  └────────────────────────────────────────┘  │
│  [+ Add Item]                                │
│                                               │
│  Subtotal:              NPR 23,500           │
│  Tax:             [0]   NPR      0           │
│  Grand Total:            NPR 23,500          │
│                                               │
│  ── Payment ─────────────────────────────     │
│  Status:    [Paid ▼]   Method: [Cash ▼]      │
│  Amount:    [23500]    Date: [2026-06-21]    │
│                                               │
│  Invoice Image (GD Link):                     │
│  [__________________________________]         │
│                                               │
│  Notes:                                       │
│  [__________________________________]         │
│                                               │
│  [Cancel]                    [Save Purchase]  │
└──────────────────────────────────────────────┘
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `supplierId` | Required, must reference existing supplier |
| `items[]` | At least 1 item required |
| `items[].materialItemId` | Required, must reference existing material item |
| `items[].quantity` | > 0 required |
| `items[].rate` | > 0 required |
| `grandTotal` | > 0 required |
| `paymentStatus` | Required |
| `invoiceImage` | Optional, must be valid Google Drive URL if provided |

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `purchases` | `supplierId` ASC, `createdAt` DESC | Purchases by supplier |
| `purchases` | `paymentStatus` ASC, `createdAt` DESC | Unpaid purchases |
| `purchases` | `createdAt` DESC | Recent purchases |
| `materialItems` | `category` ASC, `name` ASC | Browse by category |
| `materialItems` | `currentStock` ASC | Low stock items |
| `suppliers` | `name` ASC | Alphabetical supplier list |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| Read suppliers | `purchases:read` |
| CRUD suppliers | `purchases:write` |
| Read material items | `purchases:read` |
| CRUD material items | `purchases:write` |
| Read purchases | `purchases:read` |
| Create purchase | `purchases:write` |
| Update purchase | `purchases:write` |
| Delete purchase | `purchases:delete` |

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
match /suppliers/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['purchases:read', 'admin:all']);
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['purchases:write', 'admin:all']);
}

match /materialItems/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['purchases:read', 'admin:all']);
  allow write: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['purchases:write', 'admin:all']);
}

match /purchases/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['purchases:read', 'admin:all']);
  allow create, update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['purchases:write', 'admin:all']);
  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['purchases:delete', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Create supplier | `"Created supplier 'ABC Meat Suppliers'"` |
| Update supplier | `"Updated supplier 'ABC Meat Suppliers'"` |
| Create material item | `"Created material item 'Buff Meat' (Ingredient)"` |
| Update material item | `"Updated material item 'Jar 300ml': threshold changed from 50 to 100"` |
| Create purchase | `"Recorded purchase P-2026-001 from ABC Meat Suppliers — NPR 23,500 (paid)"` |
| Update purchase | `"Updated purchase P-2026-001: added item 'Lids'"` |
| Mark payment | `"Purchase P-2026-001: marked paid — NPR 23,500"` |
| Delete purchase | `"Deleted purchase P-2026-001"` |

---

## Dependencies

| Module | Dependency |
|--------|-----------|
| **Module 2 (Batches)** | Consumes from purchase items. Decrements `remainingQty` |
| **Module 3 (Inventory)** | Finished goods inventory is separate from raw material inventory |
| **Dashboard** | Shows low stock alerts, total purchase spend this month |

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — purchase date, payment date. Staff enters in AD picker; system converts. See `utils/nepaliDate.ts`.
- **Purchase number uses BS year**: `PUR-{BS_YEAR}-{SEQUENCE}` (e.g., `PUR-2083-0008`). Rollover on Shrawan 1. See Module: Counters.
- **remainingQty**: Must be updated atomically when a batch is created/deleted. Use Firestore transactions to prevent race conditions when multiple batches consume from the same purchase item
- **currentStock on materialItems**: Computed by summing `remainingQty` across all purchases. Can be updated on purchase create/update or batch create/delete via client-side recompute
- **Supplier purchase total**: Computed by summing `grandTotal` across all purchases for that supplier. Update on purchase save
- **Master lists seeding**: On first launch, pre-populate common material items (various meats, oils, spices, jar sizes, lid types, label sizes) and common suppliers
- **Search**: Implement client-side search for suppliers and material items dropdowns (Firestore `orderBy` + `startAt` for prefix search if dataset grows)
