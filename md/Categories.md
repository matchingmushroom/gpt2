# Module: Categories

## Purpose
Organize products into a hierarchical, multi-category system. A product can belong to multiple categories simultaneously (e.g., "Buff Achar" in both "Non-Veg" and "Spicy").

---

## Firestore Collection: `categories/{id}`

```typescript
{
  id: string                // Auto-generated Firestore doc ID
  name: string              // "Chicken", "Non-Veg", "Spicy" (max 50 chars)
  slug: string              // URL-friendly, unique (e.g., "non-veg", "chicken")
  parentId: string | null   // null = top-level category, otherwise /categories/{parentId}
  description: string       // Max 500 chars
  image: string             // Google Drive link (category thumbnail)
  isActive: boolean         // Show/hide on storefront
  sortOrder: number         // Manual ordering within same parent
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Constraints
- Max depth: 2 levels (top-level + children). Deeper nesting creates poor UX.
- A category cannot be its own ancestor (enforced in admin UI — parent dropdown excludes the category itself and its descendants).

---

## Public Site: Navigation & Filtering

### Sidebar / Product Filters

```
┌── Shop by Category ──────────────────────┐
│                                           │
│  ▶ Non-Veg (12)                           │
│     └── ▶ Chicken (5)                     │
│     └── ▶ Buff (4)                        │
│     └── ▶ Pork (3)                        │
│  ▶ Veg (8)                                │
│     └── ▶ Radish (2)                      │
│     └── ▶ Mixed (6)                       │
│  ▶ Spicy (7)                              │
│  ▶ Organic (4)                            │
│                                           │
└───────────────────────────────────────────┘
```

- **(N)** = product count (number of active products in that category)
- Each link → `/products?category=slug`
- Clicking a parent shows all products in parent + child categories

### Product Cards

```
┌──────────────────────┐
│  [product image]      │
│  Buff Achar           │
│  [Non-Veg] +2 more   │
│  NPR 150 – 550        │
└──────────────────────┘
```

- First category badge shown
- If product has more than 1 category, show "+N more" pill
- On hover: tooltip listing all categories

---

## Admin Panel: UI Components

### Pages & Components

| Component | File | Behavior |
|-----------|------|----------|
| **CategoryList** | `admin/src/pages/Categories.tsx` | Tree view with indentation levels, expand/collapse arrows. Columns: Name, Slug, Active toggle, Product count (live count), Sort arrows (up/down), Edit/Delete buttons. Drag handle for reorder |
| **CategoryForm** | `admin/src/components/CategoryForm.tsx` | Modal or page form. Fields: Name, Slug (auto from name, editable), Parent dropdown (hierarchical with indented labels: `─ Non-Veg`, `── Chicken`, `── Buff`; excludes self + descendants; "None" for top-level), Description, Image URL (Google Drive), isActive toggle, Sort Order (number) |
| **CategoryTreePicker** | `admin/src/components/CategoryTreePicker.tsx` | Embedded in ProductForm. Expandable tree with checkboxes. Shows category name + count. At least 1 selection required. "Select All Children" option appears when a parent is checked |
| **CategoryBadge** | `admin/src/components/CategoryBadge.tsx` | Reusable chip component: colored badge with category name, optional X button to remove. Color assigned automatically based on category index |

### CategoryList Tree View

```
┌──────────────────────────────────────────────────────┐
│  Categories                    [+ Add Category]      │
│                                                      │
│  ▼ Non-Veg        Active  (8)  [↑][↓]  [✏️] [🗑]    │
│     ▼ Chicken     Active  (3)  [↑][↓]  [✏️] [🗑]    │
│        Chicken Achar  ...                             │
│     ▶ Buff         Active  (5)  [↑][↓]  [✏️] [🗑]    │
│     ▶ Pork         Active  (2)  [↑][↓]  [✏️] [🗑]    │
│  ▶ Veg             Active  (6)  [↑][↓]  [✏️] [🗑]    │
│  ▶ Spicy           Active  (4)  [↑][↓]  [✏️] [🗑]    │
│  ❌ Organic        Inactive(1)  [↑][↓]  [✏️] [🗑]    │
└──────────────────────────────────────────────────────┘
```

### CategoryTreePicker (in ProductForm)

```
┌── Categories ────────────────────────────────────┐
│  ☐ ▶ Non-Veg             (select all children)   │
│      ☑ Chicken                                    │
│      ☐ Buff                                       │
│      ☐ Pork                                       │
│  ☑ ▶ Veg                                          │
│      ☐ Radish                                     │
│      ☐ Mixed                                      │
│  ☐ ▶ Spicy                                        │
│  ☐ ▶ Organic                                      │
│                                                   │
│  Selected: [Veg ✕] [Chicken ✕]                   │
│  (1 required, {N} selected)                       │
└───────────────────────────────────────────────────┘
```

---

## Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| Read categories (public) | None | Unauthenticated |
| Read categories (admin) | `categories:read` | Staff, Manager, Super Admin, Viewer |
| Create category | `categories:write` | Manager, Super Admin |
| Update category | `categories:write` | Manager, Super Admin |
| Delete category | `categories:write` | Super Admin |
| Reorder categories | `categories:write` | Manager, Super Admin |

### Role Mapping

| Role | View | Create | Update | Delete | Reorder |
|------|:----:|:------:|:------:|:------:|:-------:|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ❌ | ✅ |
| Staff | ✅ | ❌ | ❌ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Firestore Security Rules

```javascript
match /categories/{categoryId} {
  allow read: if true;  // Public

  allow create: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['categories:write', 'admin:all']);

  allow update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['categories:write', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['categories:write', 'admin:all']);
}
```

---

## Indexes Required

| Collection | Fields | Use |
|-----------|--------|-----|
| `categories` | `parentId` ASC, `sortOrder` ASC | Tree display ordered by sortOrder |
| `categories` | `slug` ASC | Lookup by URL |
| `categories` | `isActive` ASC, `parentId` ASC, `sortOrder` ASC | Active categories for public nav |
| `products` | `isActive` ASC, `categoryIds` ASC, `createdAt` DESC | Filter products by category (array_contains) |

---

## Deletion Logic

| Scenario | Behavior |
|----------|----------|
| **Delete category with children** | Blocked: "Cannot delete 'Non-Veg'. It has 3 child categories. Move or delete children first." |
| **Delete category with products** | Warning: "Deleting 'Spicy' will remove it from {N} products. Products will not be deleted." If no products remain in any category, product becomes uncategorized — show alert: "Some products will have no categories." |
| **Deactivate category** | No confirmation. Products remain but are hidden from category filter |

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Create category | `"Created category 'Spicy' under 'Non-Veg'"` |
| Update category | `"Updated category 'Chicken': renamed from 'Chicken Items'"` |
| Delete category | `"Deleted category 'Pork' (removed from 3 products)"` |
| Reorder categories | `"Reordered categories: moved 'Spicy' above 'Organic'"` |
| Toggle category active | `"Activated category 'Organic'"` / `"Deactivated category 'Organic'"` |

---

## Cross-Module Dependencies

```
Settings
  └── (none — no category-specific settings)

Products & SKUs (Module 1)
  └── product.categoryIds references categories/{id}
  └── CategoryTreePicker embedded in ProductForm

Dashboard
  └── (none — dashboard uses expense categories, not product categories)

Staff Management
  └── permissions: categories:read, categories:write
```

---

## Implementation Notes

- **Slug uniqueness**: Validate on create/update. Slugs are globally unique across all categories, not just siblings.
- **Product count**: Displayed in CategoryList. Query `products where categoryIds array_contains categoryRef`. For performance, cache count or compute on admin panel load.
- **URL structure**: `/products?category=chicken` filters products whose `categoryIds` includes the "chicken" category doc ID. For parent categories (e.g., `/products?category=non-veg`), show products in "non-veg" OR any of its children.
- **Parent reference validation**: On category create/update, verify `parentId` is not self and not a descendant (to prevent circular references).
- **Static generation**: For the public site, fetch all active categories at build time (`getStaticProps`) for sidebar navigation and product pages.
