# Module 2: Production Batches

## Purpose
Record each production run. A batch starts with raw materials that are cooked into a bulk quantity of finished product (e.g., 10 kg of Buff Achar). That bulk is then packed into multiple SKU pack sizes (e.g., 10 × 300gm + 10 × 500gm + 2 × 1kg). All units from the same cook share one batch number.

This is the primary driver of inventory — each SKU unit produced adds to stock.

---

## Flow

```
RAW MATERIALS              BULK PRODUCTION              PACKING
─────────────────     ──────────────────────     ──────────────────────
Buff Meat  5 kg  ──▶                         ──▶  BUFF-300  × 10 units
Mustard Oil 3 L  ──▶   10 kg Buff Achar      ──▶  BUFF-500  × 10 units
Spices 1 kg      ──▶   (finished product)    ──▶  BUFF-1K   ×  2 units
Jars + Lids      ──▶                         ──▶  Total: 10.0 kg packed
─────────────────     ──────────────────────     ──────────────────────
                                                            │
                                                      ▼  ▼  ▼
                                               All share batch# B-2026-001
```

---

## Firestore Collection: `batches/{batchId}`

```typescript
{
  id: string
  batchNumber: string              // "B-2026-001" (auto-generated, sequential)
  productId: string                // Ref: /products/{id}

  productionDate: Timestamp        // Date of cooking
  notes: string                    // Quality notes, issues, special instructions

  // ── BULK PRODUCTION ──
  bulkQuantityKg: number           // Total kg of finished achar produced (e.g., 10)

  // ── PACKING BREAKDOWN ──
  items: [
    {
      skuId: string                // Ref: /products/{id}/skus/{skuId}
      skuLabel: string             // "300 gm" (denormalized)
      unitsProduced: number        // How many packs of this size (e.g., 10)
      packWeightGrams: number      // Weight per pack from SKU (e.g., 300)
      totalWeightKg: number        // computed: unitsProduced × packWeightGrams ÷ 1000
    }
  ]

  totalPackedWeightKg: number      // Sum of all items[].totalWeightKg
  packingVarianceKg: number        // bulkQuantityKg - totalPackedWeightKg
                                   // Can be positive (some bulk not packed) or negative (overpacked)

  // ── RAW MATERIALS CONSUMED ──
  rawMaterials: [
    {
      purchaseItemId: string       // Ref: /purchases/{purchaseId}/items/{index}
      purchaseNumber: string       // "P-2026-001" (denormalized)
      category: 'ingredient' | 'packaging'
      itemName: string             // "Buff Meat", "Jar 300ml"
      quantityUsed: number         // Amount consumed (e.g., 5)
      unit: string                 // "kg", "liter", "piece"
      costAtTime: number           // Cost per unit from the purchase record
      totalCost: number            // quantityUsed × costAtTime (computed)
    }
  ]

  totalRawMaterialCost: number     // Sum of all rawMaterials[].totalCost
  grandTotalCost: number           // totalRawMaterialCost (expandable later)

  isActive: boolean                // false = recall/spoiled (reverses inventory)
  createdBy: string                // staffId
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Batch Numbering

```
Format: B-{YEAR}-{SEQUENTIAL}
Example: B-2026-001, B-2026-002, B-2026-003
```

A `counters/batches` document stores the current sequence number. It increments atomically using `FieldValue.increment(1)`. **Number uses BS year**: `BATCH-{BS_YEAR}-{SEQUENCE}` (e.g., `BATCH-2083-0015`). Rollover on Shrawan 1.

---

## Validation Rules

| Rule | Error / Warning |
|------|----------------|
| `bulkQuantityKg` > 0 | "Enter total bulk quantity produced" |
| At least 1 item in `items[]` | "Add at least one SKU pack" |
| Each `unitsProduced` > 0 | "Quantity must be at least 1" |
| `totalPackedWeightKg` ≤ `bulkQuantityKg` × 1.05 | "Packed weight exceeds bulk by more than 5% — check entries" |
| `totalPackedWeightKg` ≥ `bulkQuantityKg` × 0.95 | "Packed weight is less than bulk by more than 5% — check entries" |
| Each `rawMaterials[].quantityUsed` ≤ remaining qty from linked purchase | "Only 3 kg of Buff Meat remaining in purchase P-2026-001" |
| Unique SKUs in `items[]` | "Duplicate SKU 'BUFF-300' — combine into one row" |

### Packing Variance

`packingVarianceKg` shows the difference between what was cooked and what was packed:

| Variance | Meaning |
|----------|---------|
| ~0 kg | All bulk was packed — normal |
| +0.5 kg | 500g of achar remains unpacked (left in pot, testing, etc.) |
| -0.3 kg | More packed than bulk (previously cooked achar added to this batch's packing) |

A variance outside ±5% shows a warning but does not block saving — it alerts staff to double-check.

---

## Inventory Impact

| Action | Effect on Stock |
|--------|----------------|
| **Create batch** (`isActive=true`) | **+** Adds `unitsProduced` to stock for each SKU in `items[]` |
| **Deactivate batch** (`isActive=false`) | **−** Removes `unitsProduced` from stock for each SKU (recall/spoilage) |
| **Reactivate batch** (`isActive=true`) | **+** Adds stock back |
| **Hard delete batch** | **−** Removes stock, irreversible |

**Per-SKU stock addition from this example:**
| SKU | Units Added |
|-----|------------|
| BUFF-300 | +10 |
| BUFF-500 | +10 |
| BUFF-1K | +2 |

---

## Mobile-First Design for Batch Entry

Staff enters from phones/tablets on the production floor:

- **Single scrollable column** — no side-by-side layouts
- **Large tap targets** — inputs and buttons minimum 44 px
- **Clear section headers**: "Product", "Bulk Quantity", "Packing Breakdown", "Raw Materials", "Summary"
- **Numeric keypad** on quantity/price fields (`inputmode="numeric"`)
- **Auto-calculations** update in real-time:
  - `totalWeightKg` per SKU as user types `unitsProduced`
  - `totalPackedWeightKg` — sum of all SKU rows
  - `packingVarianceKg` — bulk minus packed
  - `totalCost` per raw material row
  - `grandTotalCost`
- **Color-coded variance indicator**: Green (within ±5%), Yellow (warning zone), Red (error)
- **Big "Save Batch" button** at bottom with loading spinner
- **Remaining quantity indicator** next to each raw material purchase item

---

## Linking to Purchase Records (Traceability)

```
Purchase Entry (Module 5)
  └── item: "Buff Meat", qty: 20 kg, rate: 800/kg, supplier: "ABC Meat"
        │
        ▼
Batch Production (Module 2)
  └── rawMaterials[0].purchaseItemId → links to purchase item
  └── quantityUsed: 5 kg → consumes 5 of 20 kg
  └── costAtTime: 800 → from purchase record (auto-filled)
        │
        ▼
Raw Material Inventory (computed)
  └── "Buff Meat" remaining = 20 kg – Σ(quantityUsed across all batches)
```

When adding a raw material row:
1. Select **Purchase** (dropdown: purchase number + supplier + date)
2. Select **Item** from that purchase (filtered by selected purchase)
3. Enter **quantity used** (validated against remaining)
4. `unit` and `costAtTime` auto-fill from purchase record
5. `totalCost` auto-computes

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **BatchList** | `admin/src/pages/Batches.tsx` | Desktop: table with Batch# / Product / Bulk Qty / Date / Total Cost / Status. Mobile: card layout. Filter by product, date range, search batch# |
| **BatchForm** | `admin/src/components/BatchForm.tsx` | Scroll form with sections: |
| | | **Header** — Product dropdown, date picker, batch# auto-displayed (read-only) |
| | | **Bulk** — `bulkQuantityKg` input (large, prominent) |
| | | **Packing** — Dynamic SKU rows. Each: SKU dropdown (filtered by product), `unitsProduced` input. Auto-shows `totalWeightKg`. Variance indicator. "Add SKU" button |
| | | **Raw Materials** — Dynamic rows. Each: Purchase → Item dropdowns, quantity used, auto-cost. Remaining qty shown. "Add Material" button |
| | | **Summary** — bulk vs packed comparison, variance, total costs |
| | | **Save** button |
| **BatchDetail** | `admin/src/components/BatchDetail.tsx` | Read-only view with all sections. "Deactivate" button for recall |
| **DeactivateConfirm** | `admin/src/components/DeactivateConfirm.tsx` | "Deactivating B-2026-001 will remove its items from inventory. This can be reversed by reactivating." |

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `batches` | `productId` ASC, `productionDate` DESC | Filter by product, newest first |
| `batches` | `isActive` ASC, `createdAt` DESC | Active/inactive filtering |
| `batches` | `createdBy` ASC, `createdAt` DESC | Staff's recent batches |
| `batches` | `batchNumber` ASC | Lookup by batch number |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| Read batches | `batches:read` |
| Create batch | `batches:write` |
| Update batch (edit) | `batches:write` |
| Deactivate / reactivate | `batches:delete` |
| Hard delete | `batches:delete` (or `admin:all`) |

### Role Mapping

| Role | Access |
|------|--------|
| Super Admin | Full |
| Manager | CRUD batches |
| Staff | Read only |
| Viewer | No access |

---

## Security Rules

```javascript
match /batches/{batchId} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['batches:read', 'admin:all']);

  allow create: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['batches:write', 'admin:all']);

  allow update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['batches:write', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['batches:delete', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Create batch | `"Recorded batch B-2026-001: 10 kg Buff Achar → 10×300gm + 10×500gm + 2×1kg. Cost: NPR 5,200"` |
| Edit batch | `"Updated batch B-2026-001: adjusted raw material quantities"` |
| Deactivate batch | `"Deactivated batch B-2026-001 — recalled/spoiled"` |
| Reactivate batch | `"Reactivated batch B-2026-001"` |
| Hard delete batch | `"Deleted batch B-2026-001"` |

---

## Relationships

```
products  ──1:N──▶  skus
                      ▲
                      │ (skuId)
batches ──────────────┘
  ├── rawMaterials[].purchaseItemId ──▶ purchases.items
  └── items[].unitsProduced ──▶ inventory (+stock per SKU)
                                orders.items (–stock per SKU)
```

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — production date, batch creation date. Staff enters in AD picker; system converts. See `utils/nepaliDate.ts`.
- **Packing variance** is informational/warning only — does not block saving
- **Real-time calculations** in the form must update as the user types (use `useMemo` or derived state)
- **Offline persistence** — form data should survive connection drops (local Storage draft or Firestore offline)
- **Large batch warning** — if `items[]` exceeds 10 rows or `rawMaterials[]` exceeds 20 rows, consider a performance note (unlikely for pickle batches, but worth noting)
