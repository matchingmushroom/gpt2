# Module 11: Settings

## Purpose
Central configuration for the entire store — payment gateways, store branding, delivery, notifications, budgets, and other global settings. Accessed by Super Admin from a single tabbed Settings page.

---

## Firestore Structure: `/settings/{key}`

Each setting category is a separate document in a `settings` collection:

| Document | Key | Purpose |
|----------|-----|---------|
| `/settings/store` | `store` | Store name, branding, contact, social links, domain |
| `/settings/payments` | `payments` | eSewa/Khalti/COD toggles + API credentials |
| `/settings/delivery` | `delivery` | Delivery charge, free threshold, service area |
| `/settings/notifications` | `notifications` | WhatsApp number, email alerts, low stock settings |
| `/settings/budgets` | `budgets` | Expense budget limits per category (from Module 6) |
| `/settings/credit` | `credit` | Credit sales toggle, max credit per customer, overdue thresholds |

---

## Document Schemas

### `/settings/store`

```typescript
{
  storeName: string                    // "Great Pickle Taste"
  tagline: string                      // "Incredible Taste for Incredible People"

  // Branding
  logoUrl: string | null               // Google Drive link to logo
  primaryColor: string                 // "#8B4513" (hex)
  secondaryColor: string               // "#FFD700" (hex)

  // Contact
  phone: string                        // "+977-98XXXXXXXX"
  email: string                        // "hello@greatpickle.com"
  address: string                      // "Kathmandu, Nepal"

  // Social
  socialLinks: {
    facebook: string | null
    instagram: string | null
    youtube: string | null
  }

  // Invoice / Tax
  panNumber: string | null               // "123456789" — displayed on invoice
  invoiceTerms: string                   // Default terms text for invoices (e.g., "Items once sold cannot be returned...")
  invoiceFooter: string                  // Footer text (e.g., "Great Pickle Taste — Incredible Taste for Incredible People")

  // Website
  domain: string                       // "greatpickle.com"
  whatsappNumber: string               // "97798XXXXXXXX" (for WhatsApp button)

  updatedAt: Timestamp
}
```

### `/settings/payments`

```typescript
{
  esewa: {
    enabled: boolean
    merchantId: string
  },
  khalti: {
    enabled: boolean
    publicKey: string
    secretKey: string
  },
  cod: {
    enabled: boolean
    maxOrderAmount: number             // Max NPR for COD orders
  }
  updatedAt: Timestamp
}
```

### `/settings/delivery`

```typescript
{
  deliveryCharge: number               // NPR (e.g., 50)
  freeDeliveryThreshold: number        // Order above this = free (0 = no free delivery)
  serviceArea: string[]                // ["Kathmandu", "Lalitpur", "Bhaktapur"]
  maxDeliveryDays: number              // Estimated delivery time (e.g., 3)
  updatedAt: Timestamp
}
```

### `/settings/notifications`

```typescript
{
  whatsappBusinessNumber: string       // Receives new order notifications
  emailNotifications: string[]         // Emails to notify on new orders
  notifyOnNewOrder: boolean
  notifyOnLowStock: boolean
  lowStockThreshold: number            // Default low stock alert level (e.g., 10)
  updatedAt: Timestamp
}
```

### `/settings/credit`

```typescript
{
  creditEnabled: boolean               // Master toggle for credit sales
  maxCreditPerCustomer: number         // NPR limit per customer (0 = no limit)
  overdueWarningDays: number           // Days before badge turns amber (default 7)
  overdueDangerDays: number            // Days before badge turns red (default 14)
  updatedAt: Timestamp
}
```

### `/settings/budgets`

```typescript
{
  categories: {
    rent:         { mode: 'limit' | 'track', limit: number | null },
    utilities:    { mode: 'limit' | 'track', limit: number | null },
    marketing:    { mode: 'limit' | 'track', limit: number | null },
    salary:       { mode: 'limit' | 'track', limit: number | null },
    transport:    { mode: 'limit' | 'track', limit: number | null },
    packaging:    { mode: 'limit' | 'track', limit: number | null },
    maintenance:  { mode: 'limit' | 'track', limit: number | null },
    miscellaneous:{ mode: 'limit' | 'track', limit: number | null }
  },
  updatedAt: Timestamp
}
```

---

## Settings Page Layout (Single Page, Tabbed)

```
┌──────────────────────────────────────────────┐
│  Settings              Last saved: Jun 21     │
│                                               │
│  [Store] [Payments] [Delivery] [Notifs] [Credit] [Budg]│
│                                               │
│  ┌── Store ─────────────────────────────────┐ │
│  │                                           │ │
│  │  ── Branding ──────────────────────────   │ │
│  │                                           │ │
│  │  Store Name *  [Great Pickle Taste     ]  │ │
│  │  Tagline       [Incredible Taste...    ]  │ │
│  │  Logo URL      [https://drive.google.. ]  │ │
│  │  Primary Color [#8B4513       ] [🎨]     │ │
│  │  Secondary     [#FFD700       ] [🎨]     │ │
│  │                                           │ │
│  │  ── Contact ───────────────────────────   │ │
│  │                                           │ │
│  │  Phone *       [+977-98XXXXXXXX        ]  │ │
│  │  Email         [hello@greatpickle.com  ]  │ │
│  │  Address       [Kathmandu, Nepal       ]  │ │
│  │  Domain        [greatpickle.com        ]  │ │
│  │  WhatsApp #    [97798XXXXXXXX          ]  │ │
│  │                                           │ │
│  │  ── Social ────────────────────────────   │ │
│  │                                           │ │
│  │  Facebook  [https://facebook.com/...   ]  │ │
│  │  Instagram [                          ]  │ │
│  │  YouTube   [                          ]  │ │
│  │                                           │ │
│  │  ── Invoice Settings ──────────────────   │ │
│  │                                           │ │
│  │  PAN Number  [123456789               ]  │ │
│  │  Footer text [Great Pickle Taste — ... ]  │ │
│  │  Terms         ┌────────────────────────┐ │ │
│  │               │ • Items once sold      │ │ │
│  │               │   cannot be returned   │ │ │
│  │               │ • Delivery within 2-3  │ │ │
│  │               │   business days.       │ │ │
│  │               └────────────────────────┘ │ │
│  │                                           │ │
│  │  [Cancel]              [Save Changes]     │ │
│  └───────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Other Tabs

| Tab | Key Fields |
|-----|-----------|
| **Payments** | eSewa: enabled toggle + merchant ID. Khalti: enabled toggle + public/secret keys. COD: enabled toggle + max amount |
| **Delivery** | Delivery charge (NPR), free delivery threshold, service area (multi-select or comma-separated), max delivery days |
| **Notifications** | WhatsApp business number, email list (comma-separated), notify on new order toggle, notify on low stock toggle, low stock threshold |
| **Budgets** | Table per category: Category name | Mode toggle (Track/Limit) | Budget limit input (visible only in Limit mode). Same as Module 6 budget settings |
| **Credit** | Enable credit toggle | Max credit per customer input (NPR) | Overdue warning days (amber) | Overdue danger days (red) |

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **SettingsPage** | `admin/src/pages/Settings.tsx` | Tabbed container. Loads all settings documents on mount. Each tab renders its own form section. Tabs are client-side only (no route changes) |
| **StoreSettingsTab** | `admin/src/components/StoreSettingsTab.tsx` | Form for store info. Logo URL preview (displays image thumbnail). Color picker inputs |
| **PaymentSettingsTab** | `admin/src/components/PaymentSettingsTab.tsx` | Toggle + credential fields per gateway. Password-type fields for secret keys (masked) |
| **DeliverySettingsTab** | `admin/src/components/DeliverySettingsTab.tsx` | Number inputs, service area multi-select or tag input |
| **NotificationSettingsTab** | `admin/src/components/NotificationSettingsTab.tsx` | Toggles, text inputs, email list |
| **BudgetSettingsTab** | `admin/src/components/BudgetSettingsTab.tsx` | Table of categories with mode toggle and limit input |
| **CreditSettingsTab** | `admin/src/components/CreditSettingsTab.tsx` | Enable toggle, max credit input, overdue day thresholds |

### Save Behavior

- Each tab has its own **Cancel** and **Save Changes** buttons
- Save writes only the document for the active tab (other tabs unchanged)
- Cancel resets the active tab's form to the last saved state
- Unsaved changes warning if admin tries to switch tabs with dirty fields

---

## Where Settings Are Used

| Setting | Consumed By |
|---------|------------|
| `store` | Public site: header logo, brand colors, footer contact, WhatsApp button, meta tags |
| `store` | Invoice (Module 12): PAN number, terms & conditions, footer text |
| `payments` | Checkout (Module 4): enabled payment methods, API credentials |
| `credit` | POS / Orders (Module 4, 13): credit sale toggle, max credit, overdue thresholds |
| `credit` | Debtors (Module): overdue badge color thresholds |
| `delivery` | Checkout (Module 4): delivery charge display, free delivery calculation |
| `notifications` | Order placement (Module 4): WhatsApp notification target |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| View settings | `settings:read` |
| Save settings | `settings:write` |

### Role Mapping

| Role | Read | Write |
|------|:----:|:-----:|
| Super Admin | ✅ | ✅ |
| Manager | ✅ | ❌ |
| Staff | ❌ | ❌ |
| Viewer | ❌ | ❌ |

---

## Security Rules

```javascript
match /settings/{key} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['settings:read', 'admin:all']);

  allow write: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['settings:write', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Update store | `"Updated store settings: store name, logo, colors, invoice terms"` |
| Update payments | `"Updated payment settings: enabled Khalti, disabled COD"` |
| Update delivery | `"Updated delivery settings: charge from 50 to 60"` |
| Update notifications | `"Updated notification settings: added email notification"` |
| Update credit | `"Updated credit settings: enabled credit with NPR 5,000 max per customer"` |
| Update budgets | `"Updated budgets: Marketing limit changed from 10,000 to 15,000"` |

---

## Implementation Notes

- **All dates displayed in Bikram Sambat (BS)** across the entire system. See `utils/nepaliDate.ts` for conversion utilities using the `nepali-date` npm package.
- **Color picker**: Use native `<input type="color">` for primary/secondary color fields with hex preview swatch
- **Logo preview**: Show a small thumbnail of the logo URL next to the input field. Handle broken links gracefully
- **Secret keys**: Payment API keys should show as masked password fields with a show/hide toggle. Never log or expose these client-side beyond the settings form
- **Form dirty state**: Track which fields have been modified. Show unsaved changes warning if admin attempts to switch tabs or navigate away
- **Validation on save**: URL fields (logo, social links, domain) validate format. Phone/WhatsApp validate digit count. Color fields validate hex format
- **Loading state**: On first load, show skeleton placeholders for each tab. Save button shows loading spinner during write
