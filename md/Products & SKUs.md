# Module 1: Products & SKUs

## Purpose
Define what you sell. A **Product** is the base item (e.g., "Buff Achar"), and **SKUs** are the specific pack-size variants you actually stock and sell (e.g., 300gm, 500gm, 1kg). Stock is NOT stored here — it's computed from production batches + orders + adjustments (see Module 3: Inventory).

---

## Firestore Collections

### `products/{productId}`

```typescript
{
  id: string                // Auto-generated Firestore doc ID
  name: string              // "Buff Achar" (max 100 chars)
  slug: string              // "buff-achar" (URL-friendly, unique)
  description: string       // Rich text, max 2000 chars
  categoryIds: string[]     // References to /categories/{id} (supports multiple, hierarchical)
  images: string[]          // Google Drive share links (max 5)
  tags: string[]            // ["spicy", "organic", "non-veg"]
  isActive: boolean         // Show/hide entire product and its SKUs
  isFeatured: boolean       // Show on homepage carousel
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `products/{productId}/skus/{skuId}` (subcollection)

```typescript
{
  id: string                // Auto-generated
  skuCode: string           // "BUFF-300", "BUFF-500", "BUFF-1K"
  label: string             // "300 gm", "500 gm", "1 kg" (display text)
  weightInGrams: number     // 300, 500, 1000 (for sorting/filtering)
  price: number             // NPR — e.g., 150, 300, 550
  unit: string              // "gm" — same across all SKUs of a product
  isActive: boolean         // Can this variant be sold?
  createdAt: Timestamp
}
```

---

## Indexes Required (Firestore Composite Indexes)

| Collection | Fields | Use Case |
|-----------|--------|----------|
| `products` | `isActive` ASC, `categoryIds` ASC, `createdAt` DESC | Filter active products by category (array_contains) |
| `products` | `isFeatured` ASC, `isActive` ASC | Homepage featured products |
| `skus` | `isActive` ASC | Filter active SKUs |

---

## Public Site (client/) — UI & Logic

### Components

| Component | File | Behavior |
|-----------|------|----------|
| **ProductCard** | `client/components/ProductCard.tsx` | Shows first product image, name, price range ("NPR 150 – 550"), first category badge + "+N more" pill. Click → product detail page |
| **ProductGrid** | `client/components/ProductGrid.tsx` | Responsive grid (2 cols mobile, 4 cols desktop). Receives filtered product array |
| **ProductFilters** | `client/components/ProductFilters.tsx` | Hierarchical category tree dropdown (parent → child optgroup style), price range slider, sort dropdown (newest, price low/high, name) |
| **ProductDetail** | `client/pages/products/[slug].tsx` | Image gallery, description, SKU selector, quantity input, "Add to Cart" button, customer reviews section |
| **SKUSelector** | `client/components/SKUSelector.tsx` | Radio/button group of pack sizes. Each option shows weight, price, stock status (In Stock / Low Stock / Out of Stock). Selected SKU highlighted |
| **FeaturedProducts** | `client/components/FeaturedProducts.tsx` | Horizontal scroll carousel on homepage. Shows up to 8 featured products |
| **SearchBar** | `client/components/SearchBar.tsx` | Text input that filters products by name/tags client-side |

### Data Flow

```
Page Load
  → Firestore query: products where isActive == true
  → Subscribe with onSnapshot (real-time) or getDocs (static)
  → Client-side filter/sort (products + SKUs are small enough)
  → Render ProductGrid or ProductDetail

Product Detail Page
  → Fetch product doc by slug
  → Fetch all SKUs in subcollection where isActive == true
  → Display SKUSelector with computed stock from Inventory
```

### Price Range Display
On ProductCard, show min and max SKU prices: **"NPR 150 – 550"**
If all SKUs have the same price, show single price: **"NPR 300"**

---

## Admin Panel (admin/) — UI & Logic

### Pages & Components

| Component | File | Behavior |
|-----------|------|----------|
| **ProductList** | `admin/src/pages/Products.tsx` | Table: Image thumbnail, Name, Category badges (up to 3 + "+N"), SKU count, Stock indicator, Featured toggle, Active toggle, Edit/Delete buttons. Search bar + hierarchical multi-select category filter |
| **ProductForm** | `admin/src/components/ProductForm.tsx` | Full-page or modal form. Sections: |
| | | — **Basic Info**: name, slug (auto-generated from name, editable), description (rich textarea) |
| | | — **Categories**: **CategoryTreePicker** — expandable tree with checkboxes (multi-select, at least 1 required) |
| | | — **Media**: Image slots with dual input mode per slot — [Choose File] to upload (file → base64 → GAS Web App → Drive URL auto-populated) OR paste existing Google Drive URL directly. Live preview thumbnails shown inline. Drag to reorder. Add/remove slots (max 5, min 1). Upload shows loading spinner during GAS call |
| | | — **Tags**: comma-separated or chip input |
| | | — **Settings**: isFeatured checkbox, isActive toggle |
| **SKUManager** | `admin/src/components/SKUManager.tsx` | Embedded in ProductForm. Dynamic list of SKU rows: |
| | | — skuCode (auto-generated: {PRODUCT_CODE}-{WEIGHT}) |
| | | — label text input |
| | | — weightInGrams (number) |
| | | — price (number, NPR) |
| | | — isActive toggle |
| | | — Remove button (with confirmation if SKU has orders) |
| | | — "Add SKU" button at bottom |
| | | **Validation**: at least 1 SKU required, weightInGrams must be unique per product |

### Form Validation Rules

| Field | Rule |
|-------|------|
| `name` | Required, 3–100 characters |
| `slug` | Required, unique across products. Auto-generated from name, manually editable |
| `description` | Optional, max 2000 characters |
| `categoryIds` | Required, at least 1, all must reference existing categories |
| `images` | At least 1 required, max 5. Must be valid Google Drive URL format |
| `sku.label` | Required, max 50 chars |
| `sku.weightInGrams` | Required, must be > 0, integer, unique per product |
| `sku.price` | Required, > 0, max 5 digits |

### Deletion Logic

| Action | Behavior |
|--------|----------|
| **Delete SKU** | Soft-verify SKU has no pending orders. If it does, warn: "This SKU appears in {N} existing orders. Deleting will not affect past orders." |
| **Delete Product** | Confirmation: "This will permanently delete '{ProductName}' and its {N} SKUs. This action cannot be undone. Past orders will remain intact." |
| **Toggle isActive** | No confirmation. Instant show/hide on storefront |

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| Read products (public) | `None` (unauthenticated) |
| Read products (admin) | `products:read` |
| Create product | `products:write` |
| Update product | `products:write` |
| Delete product | `products:write` (or separate `products:delete`) |
| Create/Update SKU | `products:write` |
| Delete SKU | `products:write` |

---

## Firestore Security Rules

```javascript
match /products/{productId} {
  allow read: if true;  // Public read access
  
  allow create: if request.auth != null 
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['products:write', 'admin:all']);
  
  allow update: if request.auth != null 
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['products:write', 'admin:all']);
  
  allow delete: if request.auth != null 
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['products:write', 'admin:all']);
  
  match /skus/{skuId} {
    allow read: if true;
    allow write: if request.auth != null 
      && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['products:write', 'admin:all']);
  }
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Create product | `"Created product 'Buff Achar' with 3 SKUs (300gm, 500gm, 1kg)"` |
| Update product | `"Updated product 'Buff Achar': changed description"` |
| Update SKU price | `"Updated SKU 'BUFF-500' price from 250 to 300"` |
| Add SKU | `"Added SKU 'BUFF-1K' (1 kg) to 'Buff Achar'"` |
| Remove SKU | `"Removed SKU 'BUFF-300' from 'Buff Achar'"` |
| Toggle product active | `"Activated product 'Chicken Achar'"` / `"Deactivated product 'Chicken Achar'"` |
| Delete product | `"Deleted product 'Mula ko Achar' and its 2 SKUs"` |

---

## Relationships

```
categories ◀──M:N──▶  products  ──1:N──▶  skus  ──1:N──▶  batches.items (Module 2)
    │                                              ▶  orders.items (Module 4)
    │                                              ▶  inventory (Module 3)
    ▼
  reviews
```

## Public Catalog Cache

### `products/publicCatalog`

Pre-computed cache of all active products with SKUs and stock levels for the **public site**. Recalculated every time a product/SKU is created, updated, deleted, or toggled (see Cache Strategy.md). Public site serves this as a **static JSON file** — zero Firestore reads per visitor.

```typescript
{
  updatedAt: Timestamp,
  version: number,

  products: Array<{
    id: string,
    name: string,
    slug: string,
    description: string,
    images: string[],
    categoryIds: string[],
    categoryNames: string[],
    tags: string[],
    isFeatured: boolean,
    isActive: boolean,
    skus: Array<{
      id: string,
      skuCode: string,
      label: string,
      weightInGrams: number,
      price: number,
      stock: number,
      isActive: boolean,
      isAvailable: boolean
    }>,
    minPrice: number,
    maxPrice: number,
    isInStock: boolean
  }>
}
```

### Build-Time Static JSON

During `npm run build` in the client project, a script reads `products/publicCatalog` and writes `public/data/products.json`. Page loads fetch the static file — **0 Firestore reads**. See Cache Strategy.md for fallback logic.

---

## Implementation Notes

- **SKU code convention**: `{PRODUCT_CODE}-{WEIGHT}`
  - Product code derived from first 4 chars of product name, uppercased.
  - Example: "Buff Achar" → `BUFF`, SKUs → `BUFF-300`, `BUFF-500`, `BUFF-1K`
  - Admin can override manually.
- **Static JSON for public site**: At build time, `scripts/fetchPublicProducts.js` reads `products/publicCatalog` and writes `public/data/products.json`. Page loads fetch the static file (0 reads). Fallback to Firestore cache doc if static file fails to load.
- **Real-time admin panel**: Use Firestore `onSnapshot` for live updates on product list.

## Integration Points

| Module | Connection |
|--------|-----------|
| **Cache Strategy** | `products/publicCatalog` cache doc recalculated on product/SKU writes. Static JSON build process |
| **Inventory** | Stock levels in publicCatalog populated from inventory computation
