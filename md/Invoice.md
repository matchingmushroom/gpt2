# Module 12: Invoice

## Purpose
Generate branded, printable invoices for completed orders. Auto-created when an order is delivered, or manually by staff. Includes store branding (logo, colors), itemized breakdown, coupon details, WhatsApp sharing, and editable terms.

---

## Invoice Lifecycle

```
Order → delivered (auto)
  OR
Staff clicks "Generate Invoice" on order detail
       │
       ▼
Create invoice document with snapshot of order + store settings
       │
       ▼
Invoice available in admin (view/print/PDF/share/void)
       │
       ▼
Staff can edit notes anytime after generation
```

---

## Firestore Collection: `invoices/{invoiceId}`

```typescript
{
  id: string
  invoiceNumber: string                    // "INV-2026-0001" (sequential)
  orderId: string
  orderNumber: string                      // "GPT-2026-0001"

  // ── Brand Snapshot (at time of generation) ──
  storeName: string
  storeAddress: string
  storePhone: string
  storeEmail: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  panNumber: string | null

  // ── Customer ──
  customerName: string
  customerPhone: string
  customerAddress: string
  customerPan: string | null

  // ── Items ──
  items: [{
    productName: string
    skuLabel: string
    quantity: number
    unitPrice: number
    subtotal: number
  }]
  subtotal: number
  discount: number
  deliveryCharge: number
  grandTotal: number

  // ── Payment ──
  paymentMethod: string
  paymentStatus: string
  paidAt: Timestamp | null

  // ── Coupon Applied (shown as line item below subtotal) ──
  couponApplied: {
    code: string | null
    discountAmount: number
  }

  // ── Coupon Issued for Future Use (OTC promotion) ──
  couponIssued: {
    code: string | null
    type: string | null
    value: number | null
    validUntil: Timestamp | null
    minOrderAmount: number
    description: string | null
  }

  // ── Terms ──
  terms: string                            // Snapshot from settings at time of generation

  // ── Editable ──
  notes: string                            // Staff-editable memo
  isVoid: boolean
  voidReason: string | null

  // ── Meta ──
  generatedAt: Timestamp
  generatedBy: string                      // "system" or staffId
}
```

---

## Invoice Numbering

```
Format: INV-{YEAR}-{SEQUENTIAL}
Example: INV-2026-0001, INV-2026-0002, INV-2026-0003
```

Stored in `counters/invoices` — atomic increment via `FieldValue.increment(1)`.

---

## Invoice Layout (Branded)

```
┌──────────────────────────────────────────────────────┐
│  ┌── Brand Header (primaryColor bg) ───────────────┐ │
│  │                                                  │ │
│  │  [LOGO]          Great Pickle Taste              │ │
│  │  logoUrl           INV-2026-0001                 │ │
│  │                    PAN: 123456789                │ │
│  │                                                  │ │
│  │  font: white text on primaryColor background     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ── Divider (secondaryColor) ──────────────────────  │
│                                                       │
│  Bill To:                    Date: Ashad 07, 2083       │
│  Ram Sharma                                           │
│  +977-98XXXXXXXX                                      │
│  Kathmandu, Nepal                                     │
│                                                       │
│  ┌── Items Table ─────────────────────────────────┐  │
│  │  (Table header: primaryColor bg, white text)    │  │
│  │                                                 │  │
│  │  Item                    Qty   Rate    Total    │  │
│  │  ────────────────────────────────────────────  │  │
│  │  Buff Achar 300gm        2    150      300     │  │
│  │  Buff Achar 500gm        1    300      300     │  │
│  │  ────────────────────────────────────────────  │  │
│  │  Subtotal                        NPR 600       │  │
│  │  Coupon: *WELCOME10*           –NPR  60        │  │
│  │  Delivery                        NPR  50       │  │
│  │  ────────────────────────────────────────────  │  │
│  │  Grand Total                     NPR 590       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                       │
│  ┌── Coupon Issued for Future Use ─────────────────┐  │
│  │  *OTC-20260621-001* — NPR 50 off                │  │
│  │  Valid until: Jun 28, 2026                       │  │
│  │  • Min. purchase: NPR 500                       │  │  ← Only if > 0
│  │  Share this code on your next order!             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                       │
│  Payment: eSewa                          Status: Paid │
│                                                       │
│  ┌── Terms & Conditions ──────────────────────────┐  │
│  │  • Items once sold cannot be exchanged or      │  │
│  │    returned unless damaged during delivery.    │  │
│  │  • Delivery within 2-3 business days.          │  │
│  │  • For queries, contact +977-98XXXXXXXX        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                       │
│  Notes: Thank you for your order, Ram!                │
│  [Edit Note]                                          │
│                                                       │
│  ── Footer (secondaryColor bg) ────────────────────  │
│  Great Pickle Taste — Incredible Taste for Incredible │
│  People                                               │
│                                                       │
│  [📄 Print] [⬇ PDF] [💬 Share] [⛔ Void]            │
└──────────────────────────────────────────────────────┘
```

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **InvoiceList** | `admin/src/pages/Invoices.tsx` | Table: Invoice#, Order#, Customer, Grand Total, Status, Date. Filters: date range, status. Desktop: table. Mobile: cards |
| **InvoiceDetail** | `admin/src/components/InvoiceDetail.tsx` | Full branded invoice view. Action buttons: Print, PDF, Share WhatsApp, Void, Edit Note |
| **InvoicePrintView** | `admin/src/components/InvoicePrintView.tsx` | Clean print-optimized layout. Triggered by `window.print()` with `@media print` CSS |
| **EditNoteModal** | `admin/src/components/EditNoteModal.tsx` | Textarea to edit invoice notes. Saved to `notes` field |
| **VoidConfirmModal** | `admin/src/components/VoidConfirmModal.tsx` | "Mark invoice INV-2026-0001 as void? This cannot be undone." Reason input |

---

## Invoice Generation

### Auto (on order delivered)

Triggered when order status changes to `delivered`:

```typescript
async function onOrderDelivered(order) {
  const store = await getSettings('store');
  const invoice = {
    invoiceNumber: await generateInvoiceNumber(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    // Snapshot store branding
    storeName: store.storeName,
    storeAddress: store.address,
    storePhone: store.phone,
    storeEmail: store.email,
    logoUrl: store.logoUrl,
    primaryColor: store.primaryColor,
    secondaryColor: store.secondaryColor,
    panNumber: store.panNumber,
    terms: store.invoiceTerms,
    // Customer
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.shippingAddress,
    // Items
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryCharge: order.deliveryCharge,
    grandTotal: order.grandTotal,
    // Payment
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt,
    // Coupon applied
    couponApplied: {
      code: order.coupon?.code || null,
      discountAmount: order.coupon?.discountAmount || 0
    },
    // Coupon issued (OTC)
    couponIssued: order.issuedCoupon || null,
    // Meta
    notes: '',
    isVoid: false,
    voidReason: null,
    generatedAt: firestore.FieldValue.serverTimestamp(),
    generatedBy: 'system'
  };
  await firestore.collection('invoices').add(invoice);
}
```

### Manual (from order detail)

Button on order detail page: **"Generate Invoice"**. Same logic as auto, but `generatedBy` = staffId. If invoice already exists, button is disabled and shows "View Invoice" link.

---

## WhatsApp Share

```
Invoice Detail Page
       │
       ├── [📄 Print]
       ├── [⬇ Download PDF]
       └── [💬 Share via WhatsApp]
                │
                ▼
        Opens wa.me with pre-filled invoice summary
```

### Message Preview

```
📄 *Great Pickle Taste*
Invoice: INV-2026-0001
Date: Jun 21, 2026

*Items:*
Buff Achar 300gm × 2 — NPR 300
Buff Achar 500gm × 1 — NPR 300

Subtotal:        NPR 600
Coupon: *WELCOME10* —NPR 60
Delivery:        NPR  50
*Total:         NPR 590*

Payment: eSewa ✅ Paid

*Coupon Issued for Future Use:*
OTC-20260621-001 — NPR 50 off
Valid until: Jun 28, 2026
Min. purchase: NPR 500

Thank you for your order!
```

Customer phone auto-filled from order. Staff can edit before sending.

---

## PDF Download

Using client-side libraries:

```
[⬇ Download PDF]
       │
       ▼
  html2canvas(invoiceElement)
       │
       ▼
  Generate PDF via jsPDF
       │
       ▼
  Download: "INV-2026-0001.pdf"
```

---

## Settings Additions

Add to `/settings/store`:

```typescript
panNumber: string | null                // "123456789"
invoiceTerms: string                    // Default terms text
invoiceFooter: string                   // "Great Pickle Taste — ..."
```

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `invoices` | `invoiceNumber` ASC | Lookup by number |
| `invoices` | `orderId` ASC | Find invoice for order |
| `invoices` | `generatedAt` DESC | Recent invoices |
| `invoices` | `isVoid` ASC, `generatedAt` DESC | Active vs void invoices |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| View invoice list | `orders:read` |
| View invoice detail | `orders:read` |
| Generate invoice | `orders:write` |
| Edit notes | `orders:write` |
| Void invoice | `orders:delete` |
| Download PDF | `orders:read` |
| Share WhatsApp | `orders:read` |

### Role Mapping

| Role | View | Generate | Edit Notes | Void | Export/Share |
|------|:----:|:--------:|:----------:|:----:|:------------:|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| Staff | ✅ | ✅ | ✅ | ❌ | ✅ |
| Viewer | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## Security Rules

```javascript
match /invoices/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['orders:read', 'admin:all']);

  allow create: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['orders:write', 'admin:all']);

  allow update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['orders:write', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['orders:delete', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Auto-generate | `"Invoice INV-2026-0001 auto-generated for order GPT-2026-0001"` |
| Manual generate | `"Generated invoice INV-2026-0001 for order GPT-2026-0001"` |
| Edit notes | `"Updated invoice INV-2026-0001 notes"` |
| Void invoice | `"Voided invoice INV-2026-0001 — damaged goods"` |
| Download PDF | `"Downloaded invoice INV-2026-0001 as PDF"` |
| Share WhatsApp | `"Shared invoice INV-2026-0001 via WhatsApp"` |

---

## Implementation Notes

- **Brand snapshot**: Store settings are copied into the invoice at generation time so historical invoices always display correctly even if branding changes later
- **All dates displayed in Bikram Sambat (BS)** — invoice date, valid until dates. Invoice number uses BS year: `INV-{BS_YEAR}-{SEQUENCE}` (e.g., `INV-2083-0042`). See `utils/nepaliDate.ts`.
- **Print CSS**: Use `@media print` rules to hide navigation, sidebar, buttons; show only the invoice content. Header/footer repeat on multi-page invoices
- **PDF library**: html2canvas + jsPDF for client-side PDF generation. For large invoices with many items, consider pagination
- **WhatsApp**: Opens `wa.me` URL in new tab. No backend API needed. Ensure phone number includes country code without `+` sign
- **Coupon Issued section**: Rendered only if `couponIssued.code` is not null. Min purchase line rendered only if `couponIssued.minOrderAmount > 0`
- **Regeneration**: Staff cannot regenerate an invoice if one already exists. Button shows "View Invoice" instead. To regenerate, void the existing one first
- **Void flow**: Voided invoices remain in the list with strikethrough styling. A new invoice can be generated after voiding the old one
