# Module 4: Orders & Checkout

## Purpose
Handle the complete order lifecycle — from cart to checkout to fulfillment. Supports eSewa, Khalti, and COD payment methods (toggled by admin via Settings). Includes coupon discounts, public order tracking, and automatic WhatsApp notifications.

---

## Order Lifecycle & Inventory Impact

```
                    Auto-notify staff (WhatsApp)
                           │
pending ────► confirmed ──► processing ──► shipped ──► delivered
  │                                               │           │
  │ (auto +stock)                                 │           │
  └──► cancelled ◄────────────────────────────────┘           │
                                                               │
                                                          returned
                                                     (auto +stock)
```

| Status Change | Inventory | Payment (COD) | Debtor / Notification |
|--------------|-----------|---------------|----------------------|
| `pending` → `confirmed` | — | — | — |
| `confirmed` → `processing` | — | — | — |
| `processing` → `shipped` | **–** stock per SKU | — | — |
| `shipped` → `delivered` | — | if COD → mark paid via `paymentHistory` | If `paymentMethod=credit`: debtor doc updated (`totalOutstanding` + grandTotal) |
| `delivered` → `returned` | **+** stock per SKU | refund tracking | If credit: debtor doc reduced |
| any → `cancelled` | **+** stock per SKU (auto) | — | If credit: debtor doc reduced |

---

## Firestore Collection: `orders/{orderId}`

```typescript
{
  id: string
  orderNumber: string                    // "GPT-2026-0001" (sequential)

  // ── Customer Info ──
  customerName: string
  customerPhone: string
  customerEmail: string                  // Optional
  shippingAddress: string
  deliveryNotes: string                  // Optional

  // ── Items ──
  items: [
    {
      skuId: string                     // Ref: /products/{id}/skus/{skuId}
      productName: string               // "Buff Achar" (denormalized)
      skuLabel: string                  // "300 gm" (denormalized)
      quantity: number
      unitPrice: number
      subtotal: number                  // quantity × unitPrice
    }
  ]
  subtotal: number                      // Sum of all item subtotals
  discount: number                      // Coupon discount amount (0 if none)
  deliveryCharge: number
  grandTotal: number                    // subtotal - discount + deliveryCharge

  // ── Coupon ──
  coupon: {
    code: string | null                 // Coupon code used (null if none)
    type: 'percentage' | 'fixed' | 'full_discount' | null
    discountAmount: number
    appliedBy: string | null            // staffId (null = customer self-applied)
    appliedByName: string | null        // Denormalized staff name
  }

  // ── Coupon Issued (OTC for future use) ──
  issuedCoupon: {
    code: string | null                 // "OTC-20260621-001" (null = none issued)
    type: 'percentage' | 'fixed' | null
    value: number                       // Discount value (NPR or %)
    validFrom: Timestamp
    validUntil: Timestamp
    minOrderAmount: number
    description: string | null
    issuedBy: string | null             // staffId
    issuedByName: string | null         // Denormalized
  } | null

  // ── Payment ──
  paymentMethod: 'esewa' | 'khalti' | 'cod' | 'cash' | 'bank' | 'credit'
  paymentStatus: 'unpaid' | 'paid' | 'refunded' | 'partial'
  paymentId: string | null              // Gateway transaction ID
  paidAt: Timestamp | null
  paymentHistory: [                     // Track all payments against this order
    {
      method: 'cash' | 'bank' | 'esewa' | 'khalti'
      amount: number
      receivedBy: string               // staffId
      receivedByName: string
      receivedAt: Timestamp
      note: string
    }
  ]

  // ── Fulfillment ──
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
  statusHistory: [
    {
      status: string
      changedBy: string                 // staffId
      changedByName: string             // Denormalized
      timestamp: Timestamp
      note: string                      // Optional
    }
  ]
  deliveredAt: Timestamp | null
  returnedAt: Timestamp | null
  returnReason: string | null

  // ── Delivery Partner (future) ──
  deliveryPartner: string | null        // "Pathao", "Foodmandu"
  trackingUrl: string | null

  // ── Meta ──
  notes: string                         // Internal admin notes
  createdBy: 'customer' | string        // staffId if staff created order manually
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Checkout Flow

```
Cart ──► Customer Info Form ──► Coupon Code ──► Payment Selection ──► Place Order
                                          │              │
                                     Apply coupon    Read enabled methods
                                     (validate)      from /settings/payments
                                          │              │
                                     Show discount    eSewa ✅ Khalti ✅ COD ✅
                                          │              │
                                          ▼              ▼
                                          └──────┬──────┘
                                                 ▼
                                          Place Order
                                            │
                                    ┌───────┴────────┐
                                    ▼                 ▼
                              Online (eSewa/Khalti)   COD
                                    │                 │
                              Redirect to gateway   Save order
                                    │               paymentStatus: unpaid
                              Success callback       │
                                    │                 │
                              Save order             │
                              paymentStatus: paid    │
                                    │                 │
                              ┌─────┴─────────────────┘
                              ▼
                    Order Confirmation Page
                              │
                              ▼
                    WhatsApp notification to staff
```

### Customer Info Form Fields
- Full name (required)
- Phone number (required, validated: 10 digits)
- Email (optional)
- Delivery address (required, textarea)
- Delivery notes (optional)

### Coupon Application
```
User enters coupon code → clicks "Apply"
  → Client validates:
      • Document exists in /coupons/{code}
      • isActive == true
      • current date between validFrom and validUntil
      • usageLimit not reached (if reusable)
      • coupon not already used (if single_use)
      • minOrderAmount ≤ subtotal
      • SKU restrictions pass (if applicable)
  → If valid: show discount amount, update grandTotal
  → If invalid: show specific error message
```

### Payment Selection

The checkout reads from `/settings/payments` to determine which payment methods are enabled. Only enabled methods are shown as selectable options.

| Setting | Effect |
|---------|--------|
| `esewa.enabled = true` | Show eSewa button |
| `khalti.enabled = true` | Show Khalti button |
| `cod.enabled = true` | Show COD button |
| `cod.maxOrderAmount` | Hide COD if grandTotal exceeds this |
| All disabled | "Payments temporarily unavailable — please try again later" |

### COD Flow Details

| Step | What Happens |
|------|-------------|
| Order placed | `paymentStatus: 'unpaid'`, `status: 'pending'` |
| Staff delivers | Staff updates status to `delivered` |
| Cash collected | Staff marks `paymentStatus: 'paid'`, pushes to `paymentHistory[]` |
| Inventory | Deducted on `shipped` (same as online) |

### Credit Flow Details

| Step | What Happens |
|------|-------------|
| Order created (by staff) | `paymentMethod: 'credit'`, `paymentStatus: 'unpaid'` |
| Order delivered | Debtor doc auto-created/updated: `totalOutstanding` + grandTotal |
| Staff receives payment | Opens ReceivePaymentModal in Debtors page → amount distributed FIFO across oldest orders. Each order's `paymentHistory[]` appended, `paymentStatus` updated to `'paid'` or `'partial'` |
| Full clearance | Debtor doc `totalOutstanding` = 0, `clearedAt` set, auto-archived |

---

## Public Order Tracking (`/track`)

### Page
A standalone page accessible without login:

```
URL: /track?order=GPT-2026-0001&phone=98XXXXXXXX
```

### Form (if no query params)

```
┌─────────────────────────────────┐
│  Track Your Order               │
│                                 │
│  Order Number                   │
│  [____________________]         │
│                                 │
│  Phone Number                   │
│  [____________________]         │
│                                 │
│  [ Track Order ]                │
└─────────────────────────────────┘
```

### Result (on success)

```
┌─────────────────────────────────────┐
│  Order GPT-2026-0001                │
│                                     │
│  Status: ● Shipped                  │
│                                     │
│  Timeline:                          │
│  ✅ Jun 21, 10:30 AM — Placed      │
│  ✅ Jun 21, 11:00 AM — Confirmed   │
│  ✅ Jun 22, 09:00 AM — Processing  │
│  🔵 Jun 23, 02:00 PM — Shipped     │
│  ⭕ Pending — Delivered             │
│                                     │
│  ─────────────────────────────      │
│  Items                              │
│  Buff Achar 300gm  × 2   NPR 300    │
│  Buff Achar 500gm  × 1   NPR 300    │
│  Delivery Charge          NPR  50    │
│  Total                   NPR 650    │
│                                     │
│  ─────────────────────────────      │
│  📞 Call: +977-98XXXXXXXX           │
│  💬 WhatsApp: +977-98XXXXXXXX       │
└─────────────────────────────────────┘
```

### Error States
- Invalid order number → "Order not found. Please check your order number."
- Phone mismatch → "Phone number does not match this order."
- Network error → "Unable to load order details. Please try again."

---

## WhatsApp Notification

When a new order is placed (any payment method), the system sends a WhatsApp message to the business number configured in `/settings/notifications`.

### Message Format
```
🛵 *New Order Received!*
Order: GPT-2026-0001
Customer: Ram Sharma
Phone: +977-98XXXXXXXX
Items: Buff Achar 300gm × 2, Buff Achar 500gm × 1
Total: NPR 650
Payment: eSewa (Paid) / COD (Unpaid)
```

### Implementation
Since this is a static site (no backend server), the WhatsApp notification will use a **wa.me deep link** or a configured **WhatsApp Business API** call from the client side after order placement. Alternatively, a simple Firebase extensibility integration could be added later.

---

## Accounting Impact (Per Order)

| Metric | Online Payment | COD | Cancelled | Returned |
|--------|---------------|-----|-----------|----------|
| Gross Sales | +subtotal | +subtotal | 0 | 0 |
| Discounts | +discount | +discount | 0 | 0 |
| Net Sales | +grandTotal | +grandTotal | 0 | –grandTotal (reversal) |
| Inventory | –qty (on shipped) | –qty (on shipped) | +qty (on cancel) | +qty (on return) |

> Net Sales = Gross Sales − Discounts − Returns

---

## Admin Panel: Orders Page

| Component | File | Behavior |
|-----------|------|----------|
| **OrderList** | `admin/src/pages/Orders.tsx` | Table: Order# | Customer | Items summary | Total | Status badge | Payment badge | Date. Filters: status, date range, payment method, search by order#/phone |
| **OrderDetail** | `admin/src/components/OrderDetail.tsx` | Full order view. Sections: Customer Info, Items, Coupon (if applied), Payment Info, Status Timeline with who-changed-what. Actions: Update Status dropdown with note input, Mark Payment Paid (for COD) |
| **UpdateStatusModal** | `admin/src/components/UpdateStatusModal.tsx` | Status dropdown, note textarea, "Update" button. Logs to `statusHistory` |
| **MarkPaidModal** | `admin/src/components/MarkPaidModal.tsx` | For COD: mark as paid, enter collected amount (in case of partial), date |
| **BulkActions** | Select multiple orders → "Mark as Confirmed" / "Mark as Shipped" / "Print Packing Slip" |

### Order Detail Layout

```
┌──────────────────────────────────────────────────┐
│  Order #GPT-2026-0001       Status: ● Shipped   │
│  Placed: Jun 21, 2026                            │
│                                                   │
│  ┌─── Customer ──────────────────────────────┐   │
│  │  Ram Sharma                               │   │
│  │  +977-98XXXXXXXX                          │   │
│  │  Kathmandu, Nepal                         │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─── Items ────────────────────────────────┐   │
│  │  Buff Achar 300gm  × 2     NPR 300       │   │
│  │  Buff Achar 500gm  × 1     NPR 300       │   │
│  │  Subtotal                  NPR 600       │   │
│  │  Discount (WELCOME10)     –NPR  60       │   │
│  │  Delivery                  NPR  50       │   │
│  │  Grand Total               NPR 590       │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─── Payment ──────────────────────────────┐   │
│  │  Method: eSewa        Status: Paid ✅    │   │
│  │  Transaction ID: ES-20260621-XXXX        │   │
│  │  Paid: Jun 21, 2026 10:32 AM            │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─── Status History ────────────────────────┐   │
│  │  ✅ Placed     — Jun 21 10:30 — Customer  │   │
│  │  ✅ Confirmed  — Jun 21 11:00 — Sita (M)  │   │
│  │  ✅ Processed  — Jun 22 09:00 — Sita (M)  │   │
│  │  🔵 Shipped    — Jun 23 14:00 — Ram (A)   │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  [Update Status ▼]  [Mark as Paid]  [Print]      │
└──────────────────────────────────────────────────┘
```

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `orders` | `status` ASC, `createdAt` DESC | Filter by status, newest first |
| `orders` | `customerPhone` ASC, `createdAt` DESC | Lookup by customer phone |
| `orders` | `paymentStatus` ASC, `createdAt` DESC | Unpaid COD orders |
| `orders` | `orderNumber` ASC | Lookup by order number |
| `orders` | `createdAt` DESC | Dashboard: recent orders |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| Read orders | `orders:read` |
| Update order status | `orders:write` |
| Mark payment (COD) | `orders:write` |
| Delete order | `orders:delete` |
| Cancel order | `orders:write` |
| Process return | `orders:write` |

### Role Mapping

| Role | Read | Write | Delete |
|------|:----:|:-----:|:------:|
| Super Admin | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ❌ |
| Staff | ✅ | ✅ | ❌ |
| Viewer | ✅ | ❌ | ❌ |

---

## Security Rules

```javascript
match /orders/{orderId} {
  // Public can create orders (checkout)
  allow create: if true;

  // Public can read their own order (tracking) — validated by orderNumber + phone
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['orders:read', 'admin:all']);

  allow update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['orders:write', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['orders:delete', 'admin:all']);
}
```

> **Note:** Public read for tracking is handled via a separate Cloud Function or a callable Firebase function that validates order# + phone before returning data. The direct Firestore rule blocks public read.

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Order placed | `"Order GPT-2026-0001 placed — NPR 590 (eSewa)"` |
| Status updated | `"Order GPT-2026-0001: pending → confirmed"` |
| Status updated | `"Order GPT-2026-0001: shipped → delivered"` |
| Order cancelled | `"Order GPT-2026-0001 cancelled — customer request"` |
| Order returned | `"Order GPT-2026-0001 returned — damaged in transit"` |
| COD marked paid | `"Order GPT-2026-0001: COD marked paid — NPR 590"` |
| Order deleted | `"Order GPT-2026-0001 deleted"` |

---

## Dependencies

| Module | Dependency |
|--------|-----------|
| **Settings** | `/settings/payments` — enabled payment methods |
| **Coupons** | `/coupons/{code}` — coupon validation and discount |
| **Module 2 (Batches)** | Batch production creates stock |
| **Module 3 (Inventory)** | Stock deducted/restored on status changes |
| **WhatsApp** | `/settings/notifications` — business WhatsApp number |

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** throughout the UI. Staff enters dates in AD picker; system converts to BS for display. See `utils/nepaliDate.ts`.
- **Order number counter**: Use BS year from `nepali-date` via `toBSYear()`. Format: `GPT-{BS_YEAR}-{SEQUENCE}` (e.g., `GPT-2083-0042`). Rollover on Shrawan 1. Use `counters/orders` document with `FieldValue.increment(1)`. See Module: Counters.
- **Public tracking**: The `/track` page queries Firestore with `orderNumber` and validates `customerPhone` client-side. For security, only return basic order info (not payment/transaction IDs)
- **Public tracking**: The `/track` page queries Firestore with `orderNumber` and validates `customerPhone` client-side. For security, only return basic order info (not payment/transaction IDs)
- **WhatsApp notification**: Use a simple `window.open('https://wa.me/...')` or a Firebase Extensions integration. For MVP, a clickable wa.me link on the confirmation page works
- **Coupon validation**: Must validate both client-side (UX) and via Firestore rules to prevent abuse
- **COD risk**: Consider a `cod.maxOrderAmount` setting to limit high-value COD orders
