# Module 13: Quick Sale (POS)

## Purpose
Streamlined interface for recording **in-store/walk-in sales** — minimal fields, instant completion, auto-invoice generation. Separate from the online order flow.

---

## Quick Sale Flow

```
Staff opens Quick Sale page
       │
       ▼
  Enter customer name + phone (address optional)
       │
       ▼
  Search & add products (typeahead search)
     └── Select product → choose SKU → enter qty
     └── Shows stock badge while adding
       │
       ▼
  [Issue Coupon?] — Optional OTC coupon for future use
       │
       ▼
   Select payment method (Cash / Bank / eSewa / Khalti / Credit)
       │
       ▼
  [Complete Sale]
       │
       ├── Creates order (status: delivered, payment: paid)
       ├── Auto-generates invoice
       ├── Option: [🖨 Print Invoice] [💬 Share WhatsApp]
       └── Shows success with invoice number
```

---

## Quick Sale Page Layout

```
┌── Quick Sale ─────────────────────────────────────┐
│                                                     │
│  ── Customer ────────────────────────────────────  │
│  Name *       [Ram Sharma           ]              │
│  Phone *      [98XXXXXXXX           ]              │
│  Address      [_____________________]  ← Optional  │
│                                                     │
│  ── Items ───────────────────────────────────────  │
│                                                     │
│  Search product: [Buff Achar           🔍]         │
│                                                     │
│  ┌── Added Items ───────────────────────────────┐  │
│  │  #  Product          SKU    Qty  Price  Total │  │
│  │  ─────────────────────────────────────────── │  │
│  │  1  Buff Achar      300gm   2    150    300  ✕│  │
│  │  2  Chicken Achar   500gm   1    300    300  ✕│  │
│  │  3  Mula Achar      300gm   3    100    300  ✕│  │
│  │                                     ──────── │  │
│  │  Total                           NPR 900     │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  [➕ Issue Coupon for Customer]                     │
│                                                     │
│  ── Payment ─────────────────────────────────────  │
│  Method: [Cash ▼]  [Bank]  [eSewa]  [Khalti]  [Credit]      │
│                                                     │
│  ────────────────────────────────────────────────  │
│  [Cancel]                    [Complete Sale ✅]     │
└─────────────────────────────────────────────────────┘
```

---

## Product Search Behavior

```
Type in search box:
  → Client-side filter from cached products list
  → Shows dropdown: Product Name + SKU options + Stock badge + Price
  → Click product + SKU → adds to items list
  → Default qty = 1, editable (min 1, max = stock available)
  → Stock shows "In Stock (15)" or "Out of Stock" (grayed out, not selectable)
  → Remove item with ✕ button
```

---

## After Sale Complete

```
✅ Sale Complete
────────────────────────
Invoice: INV-2026-0042
Order:   GPT-2026-0042
Total:   NPR 900
Payment: Cash (Paid) / Credit (Unpaid — outstanding: NPR 1,200)
Coupon Issued: OTC-20260621-001 — NPR 50 off

────────────────────────
[🖨 Print Invoice]  [💬 Share WhatsApp]  [🆕 New Sale]
```

---

## How It Maps to Existing Data

| Quick Sale Action | Creates / Updates |
|------------------|-------------------|
| Complete sale (Cash/Bank/eSewa/Khalti) | **Order**: `status=delivered`, `paymentStatus=paid`, `createdBy=staffId`, address optional, no delivery charge |
| Complete sale (Credit) | **Order**: `status=delivered`, `paymentMethod=credit`, `paymentStatus=unpaid`. **Debtor doc**: created/updated in `debtors/{phone}` — `totalOutstanding` + grandTotal |
| Coupon issued | **Coupon** in `/coupons/` + `order.issuedCoupon` set |
| Auto on complete | **Invoice** in `/invoices/` — generated immediately |
| Inventory | Stock deducted automatically (POS creates order as delivered, counted in shipped+delivered inventory query) |

### Order Documents Created

#### Cash/Bank/eSewa/Khalti (Paid Immediately)

```typescript
{
  orderNumber: "GPT-2026-0043",
  customerName: "Ram Sharma",
  customerPhone: "98XXXXXXXX",
  shippingAddress: "",              // Optional for walk-in
  items: [/* ... */],
  subtotal: 900,
  discount: 0,
  deliveryCharge: 0,                // No delivery for walk-in
  grandTotal: 900,
  paymentMethod: "cash",
  paymentStatus: "paid",
  paidAt: now,
  paymentHistory: [{
    method: "cash",
    amount: 900,
    receivedBy: staffId,
    receivedByName: "Ram (Staff)",
    receivedAt: now,
    note: "Walk-in sale"
  }],
  status: "delivered",              // Instant delivered
  statusHistory: [{
    status: "delivered",
    changedBy: staffId,
    note: "Walk-in sale (Quick Sale)"
  }],
  createdBy: staffId,
  issuedCoupon: { /* ... */ }
}
```

#### Credit (Unpaid — Debtor Created)

```typescript
{
  // ... same fields as above ...
  paymentMethod: "credit",
  paymentStatus: "unpaid",
  paidAt: null,
  paymentHistory: [],
  // ^ No paymentHistory entries until staff receives payment later
}
// Also creates/updates /debtors/98XXXXXXXX:
{
  customerName: "Ram Sharma",
  customerPhone: "98XXXXXXXX",
  totalOutstanding: 900,
  totalCreditLifetime: 900,
  totalPaidLifetime: 0,
  openOrdersCount: 1,
  clearedAt: null
}
```

---

## Key Differences from Online Order

| Feature | Online Order | Quick Sale |
|---------|-------------|------------|
| Address | Required | Optional |
| Status flow | pending → confirmed → ... → delivered | Instant `delivered` |
| Payment | eSewa/Khalti/COD | Cash / Bank / eSewa / Khalti / Credit |
| Delivery charge | Applied | None (0) |
| Invoice | Auto on `delivered` | Generated on sale complete |
| Coupon issue | During checkout | Optional before completing |
| Created by | Customer (or staff) | Always staff |

---

## Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| Access Quick Sale page | `orders:write` | Super Admin, Manager, Staff |
| Complete sale | `orders:write` | Super Admin, Manager, Staff |
| Issue OTC coupon | `coupons:write` | Super Admin, Manager |

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Quick sale | `"Quick sale: GPT-2026-0042 — NPR 900 (Cash) — Staff: Ram"` |
| Quick sale + coupon | `"Quick sale: GPT-2026-0042 + issued coupon OTC-20260621-001"` |

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** — sale date, invoice date. Staff enters in AD picker; system converts. See `utils/nepaliDate.ts`.
- **Order numbers use BS year**: `GPT-{BS_YEAR}-{SEQUENCE}`. See Module: Counters.
- **Product cache**: Load all active products + SKUs on page mount and cache in memory for instant search. No Firestore queries on each keystroke
- **Stock check**: Before completing sale, verify stock is still available (re-check from inventory). If stock changed since adding to cart, show warning
- **Barcode support (future)**: Search input can later support barcode scanner input (scan SKU code → auto-add)
- **Keyboard shortcuts**: F1 = focus search, F2 = complete sale, Escape = cancel
- **Offline resilience**: If Firestore write fails, save sale to localStorage queue and retry
- **Print after sale**: Auto-open print dialog for invoice after successful sale (configurable in Settings)
