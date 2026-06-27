# Module 3: Inventory View

## Purpose
Track current stock levels for every SKU. Stock is **computed on the fly** from three sources — no Cloud Functions, no extra infrastructure.

---

## Core Concept

Stock is never stored as a static field. It's derived from production, sales, and adjustments:

```
stock[SKU] = 
    Σ(activeBatches.items.unitsProduced)    — Produced
  - Σ(shippedOrders.items.quantity)        — Sold (deducted when shipped, not delivered)
  + Σ(returnsOrders.items.quantity)         — Returned (auto add-back)
  ± Σ(manualAdjustments.quantity)           — Breakage/correction/sample
```

For a typical pickle business (50–200 batches/year, few hundred orders), this computation is fast and fine to run client-side.

---

## Stock Adjustment Rules

### Automatic (system-driven — no staff action needed)

| Event | Inventory Effect | Trigger |
|-------|-----------------|---------|
| Batch created (`isActive=true`) | **+** stock per SKU | Staff saves batch in Module 2 |
| Order shipped (`status=shipped`) | **–** stock per SKU | Order status updated in Module 4 |
| Order returned (`status=returned`) | **+** stock per SKU back | Order status updated in Module 4 |

Returns **automatically restore stock** and also create a negative sales entry for net sales calculation (see Module 4).

### Manual (Manager / Super Admin only — requires `inventory:adjust` permission)

| Reason | Effect | Allowed Roles |
|--------|--------|---------------|
| Breakage | **–** stock | Manager, Super Admin |
| Count correction | **±** stock | Manager, Super Admin |
| Sample distribution | **–** stock | Manager, Super Admin |
| Other | **±** stock | Super Admin only |

**Regular Staff have no access to manual adjustments.** These are restricted to senior roles only.

---

## Stock Status Thresholds (Public Site)

Displayed on **ProductCard** and **SKUSelector** as color-coded badges:

| Status | Stock Range | Badge Color | Text |
|--------|------------|-------------|------|
| `in_stock` | ≥ 11 | Green | "In Stock" |
| `low_stock` | 1 – 10 | Amber/Yellow | "Only few left" |
| `out_of_stock` | 0 | Red/Gray | "Out of Stock" |

**On ProductCard**: Shows the **worst** status across all SKUs of a product.

**On SKUSelector**: Shows individual status per SKU. Out-of-stock SKUs are grayed out and not selectable.

---

## Firestore Collections

### `inventoryAdjustments/{id}` (manual corrections only)

```typescript
{
  id: string
  skuId: string                     // Ref: /products/{id}/skus/{skuId}
  skuLabel: string                  // "Buff Achar 300 gm" (denormalized)
  type: 'addition' | 'deduction'
  reason: 'breakage' | 'count_correction' | 'sample' | 'other'
  quantity: number                  // Positive integer
  note: string                      // e.g., "2 jars broke during storage"
  createdBy: string                 // staffId (must be Manager or Super Admin)
  createdAt: Timestamp
}
```

There is no dedicated `inventory/` collection. Stock is computed live. (See Optimization section below for caching.)

---

## Computation (Client-Side)

```typescript
async function computeStock(skuId: string) {
  // 1. Produced from active batches
  const batchesSnap = await firestore
    .collection('batches')
    .where('isActive', '==', true)
    .get();

  let produced = 0;
  batchesSnap.forEach(doc => {
    doc.data().items.forEach((item: any) => {
      if (item.skuId === skuId) produced += item.unitsProduced;
    });
  });

  // 2. Sold from shipped orders (deducted on shipped, not delivered)
  const ordersSnap = await firestore
    .collection('orders')
    .where('status', 'in', ['delivered', 'shipped'])
    .get();

  let sold = 0;
  ordersSnap.forEach(doc => {
    doc.data().items.forEach((item: any) => {
      if (item.skuId === skuId) sold += item.quantity;
    });
  });

  // 3. Returned — adds stock back
  const returnedSnap = await firestore
    .collection('orders')
    .where('status', '==', 'returned')
    .get();

  let returned = 0;
  returnedSnap.forEach(doc => {
    doc.data().items.forEach((item: any) => {
      if (item.skuId === skuId) returned += item.quantity;
    });
  });

  // 4. Manual adjustments
  const adjSnap = await firestore
    .collection('inventoryAdjustments')
    .where('skuId', '==', skuId)
    .get();

  let adjusted = 0;
  adjSnap.forEach(doc => {
    const d = doc.data();
    adjusted += d.type === 'addition' ? d.quantity : -d.quantity;
  });

  const stock = produced - sold + returned + adjusted;

  return {
    currentStock: stock,
    status: stock <= 0 ? 'out_of_stock' : stock <= 10 ? 'low_stock' : 'in_stock'
  };
}
```

## Optimization — Caching

To avoid re-querying on every render:

- **Admin Inventory Page**: Compute once on page load, store in Zustand/React context. Re-compute on manual refresh or after creating a batch/order/adjustment.
- **Public Site**: Compute per-SKU on product detail page load. Cache in component state for the session. Re-fetch on page reload.

**Bulk compute**: Query all batches and orders once, aggregate per SKU in a single pass — don't query per-SKU individually.

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **InventoryPage** | `admin/src/pages/Inventory.tsx` | Table grouped by product. Columns: Product | SKU | Current Stock | Produced | Sold | Adjusted | Status badge. Search by product/SKU |
| **StockBadge** | Color badge with exact count: "12 (In Stock)", "4 (Low Stock)", "0 (Out of Stock)" |
| **RefreshButton** | Re-computes all SKUs. Shows "Last refreshed: 2 min ago" |
| **AdjustStockModal** | Form: SKU selector, type toggle (Addition/Deduction), reason dropdown, quantity, note. **Only visible to Manager and Super Admin roles**. Regular staff see no button |
| **SKUHistoryDrawer** | Slide-out panel showing stock timeline for a single SKU: |
| | — **Production**: Batches that produced this SKU (batch#, date, qty) |
| | — **Sales**: Orders that sold this SKU (order#, date, qty) |
| | — **Returns**: Orders that returned this SKU (order#, date, qty) |
| | — **Adjustments**: All manual adjustments for this SKU |

### AdjustStockModal Access Control

```typescript
function AdjustStockModal({ skuId }: { skuId: string }) {
  const { staff } = useAuth();
  const canAdjust = staff?.permissions?.includes('inventory:adjust');
  
  if (!canAdjust) return null; // Not rendered at all for Staff
  return ( /* form */ );
}
```

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `batches` | `isActive` ASC | All active batches |
| `orders` | `status` ASC | Orders by delivery status |
| `inventoryAdjustments` | `skuId` ASC | Adjustments for a specific SKU |
| `inventoryAdjustments` | `createdAt` DESC | Recent adjustments |
| `inventoryAdjustments` | `createdBy` ASC | Adjustments by staff member |

---

## Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| Read stock (public site) | `None` | Anyone |
| Read stock (admin page) | `products:read` | All staff roles |
| Create manual adjustment | `inventory:adjust` | Manager, Super Admin only |
| Delete manual adjustment | `inventory:adjust` | Manager, Super Admin only |

### Permission Mapping

| Role | `inventory:adjust` |
|------|:------------------:|
| Super Admin | ✅ |
| Manager | ✅ |
| Staff | ❌ |
| Viewer | ❌ |

---

## Security Rules

```javascript
match /inventoryAdjustments/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['products:read', 'admin:all']);

  allow create, update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['inventory:adjust', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['inventory:adjust', 'admin:all']);
}
```

---

## Activity Logs

| Action | Entry | Logged By |
|--------|-------|-----------|
| System auto-update | *(no log — stock is computed, not stored)* | — |
| Manual adjust | `"Adjusted BUFF-300: +5 (count_correction — physical count showed extra)"` | Manager/Admin |
| Manual adjust | `"Adjusted BUFF-1K: -2 (breakage — jar broke in storage)"` | Manager/Admin |
| Manual adjust | `"Adjusted BUFF-500: -1 (sample — given to Kathmandu Mart)"` | Manager/Admin |

---

## Accounting Impact

| Flow | Gross Sales | Discounts | Net Sales | Inventory |
|------|:-----------:|:---------:|:---------:|:---------:|
| Customer buys & (shipped then delivered) | **+** full price | 0 | **+** full price | **–** qty sold (on shipped) |
| Customer returns | 0 | 0 | **–** full price (adjustment) | **+** qty returned |
| Sample via coupon (full_discount) | **+** full price | **–** full price | **0** | **–** qty sampled |

> Net Sales = Gross Sales − Discounts − Returns adjustment

This is handled in Module 4 (Orders) where coupon and return data flows into accounting.

---

## Relationships with Other Modules

```
Module 2 (Batches) ──produces──▶ +stock
Module 4 (Orders)   ──sells────▶ –stock (shipped)
                    ──returns──▶ +stock (returned)
Module 3 (Inventory) ◀──adjust── inventoryAdjustments (manual, restricted)
```

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — adjustment date, stock history entries. See `utils/nepaliDate.ts`.
- **Bulk compute**: On InventoryPage load, query all batches and orders once, then aggregate per SKU. Don't query per-SKU individually.
- **Debounce public site**: On product listing page, compute stock for all visible products in one batch, not per card.
- **Cold start**: On first load, the public site may briefly show "Loading..." for stock badges. Acceptable — data arrives within 1–2 seconds for typical datasets.
- **Adjustment permission**: Must be checked both in UI (hide button) and in Firestore security rules (block write).
