# Module 10: Coupons

## Purpose
Create and manage discount coupons for customer orders. Supports promotional discounts (reusable with max redemptions), single-use codes, and OTC (over-the-counter) coupons issued directly from the order page for walk-in customers or sales negotiations.

---

## Coupon Types

| Type | `usageType` | `usageLimit` | Example | Use Case |
|------|:-----------:|:------------:|---------|----------|
| Promotional | `reusable` | 500 | `WELCOME10` — 10% off | Public promo code |
| Flash sale | `reusable` | 50 | `FLASH50` — NPR 50 off | Limited time offer |
| Customer-specific | `single_use` | 1 | `SAMP-BUFF-001` | Free sample distribution |
| OTC order discount | `single_use` or `reusable` | Admin chooses | `OTC-20260621-001` | Issued during order creation |

---

## Firestore Collection: `coupons/{couponId}`

```typescript
{
  id: string
  code: string                            // "WELCOME10", "SAMP-BUFF-001", "OTC-20260621-001"

  // ── Discount Type ──
  type: 'percentage' | 'fixed' | 'full_discount'
  value: number | null                    // 10 (10%), 50 (NPR 50), null for full_discount

  // ── Usage Pattern ──
  usageType: 'reusable' | 'single_use'
  usageLimit: number | null              // Max total redemptions. null = unlimited (reusable only)
  usedCount: number                      // Auto-incremented on each use
  perCustomerLimit: number | null        // Times per phone number. null = unlimited

  // ── Eligibility ──
  minOrderAmount: number                 // Minimum cart subtotal to apply (default 0)
  applicableSkus: string[]               // [] = all SKUs, or specific SKU IDs
  maxDiscountAmount: number              // Cap for percentage coupons

  // ── Schedule ──
  isActive: boolean
  validFrom: Timestamp
  validUntil: Timestamp

  // ── Metadata ──
  description: string                    // "Free sample — Buff Achar 300gm"
  isSampleCoupon: boolean                // true = staff-distributed sample
  issuanceType: 'admin_created' | 'otc_issued'
  createdBy: string                      // staffId
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## `couponUsage/{id}` (tracks each redemption)

```typescript
{
  id: string
  couponId: string
  couponCode: string
  orderId: string
  orderNumber: string                    // "GPT-2026-0001"
  discountAmount: number                 // Actual NPR amount discounted

  appliedBy: string | null               // staffId (null = customer self-applied at checkout)
  appliedByName: string | null           // "Sita Sharma"

  customerPhone: string
  customerName: string

  createdAt: Timestamp
}
```

---

## Validation at Checkout

```
User enters code → clicks Apply
  │
  ├── Does coupon exist?                    ❌ "Invalid coupon code"
  │
  ├── Is isActive = true?                   ❌ "This coupon is no longer available"
  │
  ├── Is now between validFrom & validUntil? ❌ "Coupon expired" / "Not yet valid"
  │
  ├── Is usageType = reusable?
  │     ├── Yes → usedCount < usageLimit?   ❌ "Coupon fully redeemed (N/N uses)"
  │     └── No (single_use) → exists in
  │         couponUsage with this code?      ❌ "This coupon code has already been used"
  │
  ├── Does subtotal ≥ minOrderAmount?       ❌ "Minimum order of NPR 500 required"
  │
  ├── Has this phone already used it
  │     ≥ perCustomerLimit times?            ❌ "You've already used this coupon"
  │
  ├── Are all cart SKUs in applicableSkus
  │     (if applicableSkus non-empty)?       ❌ "Coupon not applicable to items in cart"
  │
  └── ✅ Valid → Apply discount
```

---

## OTC Coupon Issuance (from Order Page)

Admins can issue a coupon on-the-fly directly from the order creation/edit page, without navigating to the Coupons module.

### Order Form — Coupon Section

```
Coupon Code: [________________]  [Apply]  [Issue New Coupon ▼]
                                              │
                                     ┌────────┴────────┐
                                     │  Fixed Amount    │
                                     │  Percentage      │
                                     │  Full Discount   │
                                     └─────────────────┘
```

### OTC Issue Modal

```
┌──────────────────────────────────┐
│  Issue New Coupon & Apply        │
│                                  │
│  Type        [Fixed Amount ▼]   │
│  Value       [500]               │
│  Usage       [Single Use ▼]     │
│  Max Uses    [_____]             │  ← Only for Reusable
│  Valid For   [7] days            │
│  Description [Walk-in discount]  │
│                                  │
│  Coupon code: OTC-20260621-001   │
│                                  │
│  [Cancel]     [Issue & Apply]    │
└──────────────────────────────────┘
```

### Auto-Generated Code Format

```
OTC-{YYYYMMDD}-{SEQUENTIAL}
Example: OTC-20830321-001, OTC-20830321-002
(YYYYMMDD is Bikram Sambat date — e.g., 2083 for BS year, 03 for month, 21 for day)
```

Stored in `counters/otcCoupons/{date}` — daily sequence resets each day.

### Created Coupon (auto)

```typescript
{
  code: "OTC-20260621-001",
  type: "fixed",
  value: 500,
  usageType: "single_use",
  usageLimit: 1,
  usedCount: 0,
  minOrderAmount: 0,
  isActive: true,
  validFrom: now,
  validUntil: now + 7 days,           // Configurable validity
  description: "Walk-in discount — Ram",
  isSampleCoupon: false,
  issuanceType: "otc_issued",
  createdBy: "staffId"
}
```

On confirm, the coupon is created in `/coupons/` and automatically applied to the current order. The order's `coupon` field records `appliedBy: staffId`.

---

## Sample Coupons (Full Discount to NPR 0)

Used for free sample distribution tracked per staff member.

### How It Works

| Order Field | Value |
|------------|-------|
| `subtotal` | NPR 300 (full price) |
| `discount` | NPR 300 (full_discount coupon) |
| `grandTotal` | NPR 0 |
| `coupon.appliedBy` | Staff ID who gave the sample |

### Accounting

```
Gross Sales: +NPR 300
Discounts:   –NPR 300
Net Sales:   NPR 0     ← Properly zero for samples
```

### Sample Coupon Creation

```
Admin creates coupon:
  Code: SAMP-BUFF-001
  Type: full_discount
  Usage: single_use
  isSampleCoupon: true
  Valid for: 30 days
```

When staff applies it at checkout, `appliedBy` records who distributed the sample. Analytics can show samples given per staff member.

---

## Coupon Analytics Page

```
┌──────────────────────────────────────────────────────┐
│  Coupon Analytics                        [This Month] │
│                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │Total     │ │ Total    │ │ Avg Disc │              │
│  │Discount  │ │ Coupons  │ │ Per Order│              │
│  │NPR 15,200│ │ Used: 45 │ │ NPR 338  │              │
│  └──────────┘ └──────────┘ └──────────┘              │
│                                                        │
│  ┌── Coupon Usage ──────────────────────────────┐    │
│  │  Coupon          Uses   Total Disc  Avg Disc │    │
│  │  ─────────────────────────────────────────── │    │
│  │  WELCOME10        20     NPR 5,200   NPR 260 │    │
│  │  SAMP-BUFF-001    12     NPR 3,600   NPR 300 │    │
│  │  FESTIVE50        8      NPR 400     NPR 50  │    │
│  │  OTC-20260621-001 5      NPR 2,500   NPR 500 │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  ┌── Sample Distribution by Staff ─────────────┐     │
│  │  Staff          Samples   Total Value       │     │
│  │  ───────────────────────────────────────── │     │
│  │  Sita Sharma      20       NPR 6,000        │     │
│  │  Ram KC           15       NPR 4,500        │     │
│  │  Gita Poudel      10       NPR 3,000        │     │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  [Export CSV]                                           │
└──────────────────────────────────────────────────────┘
```

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **CouponList** | `admin/src/pages/Coupons.tsx` | Table: Code, Type, Value, Usage (used/limit), Active, Valid Until, Actions. Filters: type, status, date range |
| **CouponForm** | `admin/src/components/CouponForm.tsx` | Code (auto or manual), type selector, value, usage type toggle, limits, date range, SKU restrictions, sample checkbox. Create/Save |
| **CouponDetail** | `admin/src/components/CouponDetail.tsx` | Coupon info + usage history (which orders, customer, staff). Deactivate/Delete buttons |
| **OTCIssueModal** | `admin/src/components/OTCIssueModal.tsx` | Quick-create coupon from order page. Type, value, usage, validity days. Auto-generates code. Creates + applies in one step |
| **CouponAnalytics** | `admin/src/pages/CouponAnalytics.tsx` | Overview cards, coupon usage table, sample distribution by staff. Period selector, CSV export |

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `coupons` | `code` ASC | Lookup by code (checkout validation) |
| `coupons` | `isActive` ASC, `validUntil` ASC | Active coupons expiring soon |
| `coupons` | `issuanceType` ASC, `createdAt` DESC | OTC vs admin-created |
| `couponUsage` | `couponCode` ASC, `createdAt` DESC | Usage history per coupon |
| `couponUsage` | `customerPhone` ASC, `couponId` ASC | Per-customer usage check |
| `couponUsage` | `appliedBy` ASC, `createdAt` DESC | Sample distribution by staff |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| View coupons list | `coupons:read` |
| Create/edit coupon (admin) | `coupons:write` |
| Issue OTC coupon (from order) | `coupons:write` + `orders:write` |
| Delete coupon | `coupons:delete` |
| View analytics | `coupons:read` |

### Role Mapping

| Role | Read | Write/Issue | Delete | Analytics |
|------|:----:|:-----------:|:------:|:---------:|
| Super Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ |
| Staff | ❌ | ❌ | ❌ | ❌ |
| Viewer | ❌ | ❌ | ❌ | ❌ |

---

## Security Rules

```javascript
match /coupons/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['coupons:read', 'admin:all']);

  allow create, update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['coupons:write', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['coupons:delete', 'admin:all']);
}

match /couponUsage/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['coupons:read', 'admin:all']);

  // Created by system during checkout or OTC issuance
  allow create: if request.auth != null;
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Create coupon | `"Created coupon 'WELCOME10' — 10% off, reusable, max 500 uses"` |
| Update coupon | `"Updated coupon 'WELCOME10': usageLimit from 200 to 500"` |
| OTC issue | `"Issued OTC coupon 'OTC-20260621-001' (NPR 500 fixed) for order GPT-2026-0001"` |
| Deactivate coupon | `"Deactivated coupon 'FLASH50'"` |
| Delete coupon | `"Deleted coupon 'OLD-PROMO-2025'"` |
| Apply coupon | `"Coupon 'WELCOME10' applied to order GPT-2026-0001 — NPR 260 discount"` |

---

## Cross-Reference: Module 4 (Orders)

The Order form includes a **Coupon Section** with:

| Element | Behavior |
|---------|----------|
| Coupon code input + Apply button | Validates and applies existing coupon |
| "Issue New Coupon" dropdown | Fixed / Percentage / Full Discount |
| OTC Issue Modal | Creates coupon + applies to order in one step |
| Applied coupon display | Shows code, discount amount, who applied (if staff) |

> Full coupon creation logic lives in Module 10. Module 4 references it.

---

## Implementation Notes

- **OTC code uniqueness**: Use `counters/otcCoupons/{YYYYMMDD}` document with `FieldValue.increment(1)` to get daily sequential numbers
- **Validation at checkout**: Must validate both client-side (UX) and in Firestore rules / callable function to prevent abuse
- **usedCount update**: Increment atomically with `FieldValue.increment(1)` when coupon is applied to prevent race conditions
- **perCustomerLimit check**: Query `couponUsage` where `couponId == X && customerPhone == Y` and count results
- **Expired coupons at checkout**: On page load, client-side filter out expired coupons before displaying. If coupon expires while in cart, invalidate on next "Apply" click
- **Full_discount for samples**: The `isSampleCoupon` flag is purely for analytics/reporting. The discount logic treats `full_discount` same as any other type
