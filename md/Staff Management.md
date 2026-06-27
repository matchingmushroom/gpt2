# Module 7: Staff Management

## Purpose
Manage who can access the admin panel and what they can do. Create/disable staff accounts, assign roles with customizable permissions, track logins and activity.

---

## Core Concept: Roles as Presets, Permissions as Source of Truth

When creating a staff member:
1. Admin selects a **role** → auto-fills default permissions
2. Admin can **override any permission** individually via checkboxes
3. The saved `permissions` array is the **actual source of truth** — the role is just a convenience label

All UI elements and Firestore security rules check against the `permissions` array, not the `role` field.

---

## Firestore Collection: `staff/{staffId}`

```typescript
{
  id: string                        // Firebase Auth UID
  name: string
  email: string                     // Firebase Auth email (used for login)
  phone: string
  role: 'super_admin' | 'manager' | 'staff' | 'viewer'
  permissions: string[]             // EXACT set of granted permissions
  photoUrl: string | null           // Google Drive link
  isActive: boolean                 // false = cannot log in (Auth disabled)

  lastLoginAt: Timestamp | null
  loginHistory: [                   // Last 5 logins
    { timestamp: Timestamp, ip: string }
  ]

  createdBy: string                 // staffId of who created this account
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Role Permission Matrix (Defaults)

When a role is selected, these defaults are auto-checked. Admin can then toggle any permission.

| Permission | Super Admin | Manager | Staff | Viewer |
|-----------|:-----------:|:-------:|:-----:|:------:|
| `admin:all` | ✅ | ❌ | ❌ | ❌ |
| `categories:read` | ✅ | ✅ | ✅ | ✅ |
| `categories:write` | ✅ | ✅ | ❌ | ❌ |
| `products:read` | ✅ | ✅ | ✅ | ✅ |
| `products:write` | ✅ | ✅ | ❌ | ❌ |
| `products:delete` | ✅ | ✅ | ❌ | ❌ |
| `batches:read` | ✅ | ✅ | ✅ | ❌ |
| `batches:write` | ✅ | ✅ | ❌ | ❌ |
| `batches:delete` | ✅ | ✅ | ❌ | ❌ |
| `orders:read` | ✅ | ✅ | ✅ | ✅ |
| `orders:write` | ✅ | ✅ | ✅ | ❌ |
| `orders:delete` | ✅ | ❌ | ❌ | ❌ |
| `purchases:read` | ✅ | ✅ | ❌ | ❌ |
| `purchases:write` | ✅ | ✅ | ❌ | ❌ |
| `purchases:delete` | ✅ | ✅ | ❌ | ❌ |
| `expenses:read` | ✅ | ✅ | ❌ | ❌ |
| `expenses:write` | ✅ | ✅ | ❌ | ❌ |
| `expenses:delete` | ✅ | ✅ | ❌ | ❌ |
| `inventory:adjust` | ✅ | ✅ | ❌ | ❌ |
| `debtors:read` | ✅ | ✅ | ✅ | ❌ |
| `debtors:write` | ✅ | ✅ | ❌ | ❌ |
| `creditors:read` | ✅ | ✅ | ✅ | ❌ |
| `creditors:write` | ✅ | ✅ | ❌ | ❌ |
| `staff:manage` | ✅ | ❌ | ❌ | ❌ |
| `activity:read` | ✅ | ✅ | ❌ | ❌ |
| `coupons:read` | ✅ | ✅ | ✅ | ❌ |
| `coupons:write` | ✅ | ✅ | ❌ | ❌ |
| `coupons:delete` | ✅ | ✅ | ❌ | ❌ |
| `reviews:moderate` | ✅ | ✅ | ❌ | ❌ |
| `reviews:delete` | ✅ | ❌ | ❌ | ❌ |
| `settings:read` | ✅ | ✅ | ❌ | ❌ |
| `settings:write` | ✅ | ❌ | ❌ | ❌ |
| `dashboard:read` | ✅ | ✅ | ✅ | ❌ |
| `dashboard:export` | ✅ | ✅ | ❌ | ❌ |
| `backup:read` | ✅ | ✅ | ✅ | ❌ |
| `backup:export` | ✅ | ✅ | ✅ | ❌ |
| `backup:schedule` | ✅ | ✅ | ❌ | ❌ |
| `backup:write` | ✅ | ❌ | ❌ | ❌ |

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **StaffList** | `admin/src/pages/Staff.tsx` | Table: Name, Email, Role badge, Last Login, Active toggle, Actions. Search by name/email. Desktop: table. Mobile: cards |
| **StaffForm** | `admin/src/components/StaffForm.tsx` | Two sections: |
| | | **Basic Info**: Name, email, phone, role dropdown, photo URL, active toggle |
| | | **Password**: Admin types a password (show/hide toggle, strength indicator) |
| | | **Permissions**: Full permission checklist grouped by module |
| **StaffDetail** | `admin/src/components/StaffDetail.tsx` | Read-only view. Shows staff info, all granted permissions, login history (last 5). Edit/Deactivate/Reset Password buttons |
| **ResetPasswordModal** | `admin/src/components/ResetPasswordModal.tsx` | Admin types new password + confirm. Updates Firebase Auth + resets `loginHistory` |

### Staff Form — Permissions Section Layout

```
Role: [Manager ▼]    ← Selecting a role auto-checks defaults below
                           │
▼ ── Permissions ──────────────────────────
  ┌── Products ──────────────────────┐
  │  ☑ products:read                 │
  │  ☑ products:write                │
  │  ☐ products:delete               │  ← Admin can override any checkbox
  └──────────────────────────────────┘
  ┌── Categories ────────────────────┐
  │  ☑ categories:read               │
  │  ☐ categories:write              │
  └──────────────────────────────────┘
  ┌── Batches ───────────────────────┐
  │  ☑ batches:read                  │
  │  ☑ batches:write                 │
  │  ☐ batches:delete                │
  └──────────────────────────────────┘
  ┌── Orders ────────────────────────┐
  │  ☑ orders:read                   │
  │  ☑ orders:write                  │
  │  ☐ orders:delete                 │
  └──────────────────────────────────┘
  ┌── Purchases ─────────────────────┐
  │  ☐ purchases:read                │
  │  ☐ purchases:write               │
  │  ☐ purchases:delete              │
  └──────────────────────────────────┘
  ┌── Expenses ──────────────────────┐
  │  ☐ expenses:read                 │
  │  ☐ expenses:write                │
  │  ☐ expenses:delete               │
  └──────────────────────────────────┘
  ┌── Inventory ─────────────────────┐
  │  ☐ inventory:adjust              │
  └──────────────────────────────────┘
  ┌── Debtors ───────────────────────┐
  │  ☑ debtors:read                  │
  │  ☐ debtors:write                 │
  └──────────────────────────────────┘
  ┌── Creditors ─────────────────────┐
  │  ☑ creditors:read                │
  │  ☐ creditors:write               │
  └──────────────────────────────────┘
  ┌── Staff ─────────────────────────┐
  │  ☐ staff:manage                  │
  └──────────────────────────────────┘
  ┌── Activity ──────────────────────┐
  │  ☐ activity:read                 │
  └──────────────────────────────────┘
  ┌── Coupons ───────────────────────┐
  │  ☑ coupons:read                  │
  │  ☐ coupons:write                 │
  │  ☐ coupons:delete                │
  └──────────────────────────────────┘
  ┌── Reviews ───────────────────────┐
  │  ☐ reviews:moderate              │
  │  ☐ reviews:delete                │
  └──────────────────────────────────┘
  ┌── Settings ──────────────────────┐
  │  ☐ settings:read                 │
  │  ☐ settings:write                │
  └──────────────────────────────────┘
  ┌── Dashboard ─────────────────────┐
  │  ☑ dashboard:read                │
  │  ☐ dashboard:export              │
  └──────────────────────────────────┘
  ┌── Backup & Export ───────────────┐
  │  ☑ backup:read                   │
  │  ☑ backup:export                 │
  │  ☐ backup:schedule               │
  │  ☐ backup:write                  │
  └──────────────────────────────────┘

[Cancel]                          [Save Staff]
```

### Behavior Rules

| Interaction | Action |
|-------------|--------|
| Select role | All checkboxes reset to role defaults |
| Toggle any checkbox | Override saved. Permission array stored exactly as-is |
| Change role after toggling | Warning modal: "Changing role will reset permissions to defaults. Continue?" |
| Save | Creates Firebase Auth account + writes staff document with exact `permissions` array |

---

## Onboarding Flow

```
Admin clicks "Add Staff"
  → Fills: name, email, phone, role, photo URL
  → Permission checkboxes auto-populate from role → admin adjusts as needed
  → Types password (with show/hide, strength indicator)
  → Submits
      → Creates Firebase Auth account (email + password)
      → Creates staff document in Firestore
      → Shows success message
  → Admin shares credentials manually with the staff member
```

---

## Staff List Page Layout

```
┌──────────────────────────────────────────────┐
│  Staff Management                  [+ Add]   │
│                                              │
│  Search: [____________________]              │
│                                              │
│  Name           Role         Last Login   Act│
│  ──────────────────────────────────────────  │
│  Sita Sharma    Super Admin  Jun 21 8am   ✅│
│  Ram KC         Manager      Jun 20 5pm   ✅│
│  Gita Poudel    Staff        Jun 19 9am   ✅│
│  Hari Adhikari  Viewer       Never        ⛔│
│  (deactivated)  Staff        Jun 10       🔴│
│                                              │
│  ── Quick Stats ──────────────────────────  │
│  Total: 5    Active: 4    Inactive: 1       │
└──────────────────────────────────────────────┘
```

---

## Staff Detail Page Layout

```
┌──────────────────────────────────────────────┐
│  Staff Detail                          [Edit]│
│                                              │
│  Name:  Sita Sharma                          │
│  Email: sita@gptpickle.com                   │
│  Phone: +977-98XXXXXXXX                      │
│  Role:  Super Admin                          │
│  Status: ✅ Active                           │
│                                              │
│  ── Permissions Granted ──────────────────   │
  │  ✅ admin:all                                │
  │  ✅ categories:read, categories:write        │
  │  ✅ products:read, products:write            │
  │  ✅ orders:read, orders:write                │
  │  ✅ batches:read, batches:write              │
  │  ✅ backup:read, backup:export               │
  │  ...and 20 more                              │
│                                              │
│  ── Login History ────────────────────────   │
│  #  Date & Time           IP Address         │
│  1  Jun 21, 2026 8:15 AM  192.168.1.5       │
│  2  Jun 20, 2026 5:30 PM  192.168.1.5       │
│  3  Jun 19, 2026 9:00 AM  192.168.1.10      │
│  4  Jun 18, 2026 10:00 PM 192.168.1.5       │
│  5  Jun 17, 2026 8:45 AM  192.168.1.5       │
│                                              │
│  [Deactivate]  [Reset Password]              │
└──────────────────────────────────────────────┘
```

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `staff` | `role` ASC, `name` ASC | Filter by role |
| `staff` | `isActive` ASC, `name` ASC | Active vs inactive |
| `staff` | `email` ASC | Lookup by email |

---

## Security Rules

```javascript
match /staff/{staffId} {
  // Staff can read their own document
  allow read: if request.auth != null
    && (request.auth.uid == staffId
    || get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['staff:manage', 'admin:all']));

  // Only Super Admin can manage staff
  allow create, update, delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['staff:manage', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Create staff | `"Created staff account: Sita Sharma (Manager)"` |
| Update staff | `"Updated staff: Sita Sharma — role changed from Staff to Manager"` |
| Toggle permission | `"Updated staff: Sita Sharma — granted 'expenses:write'"` |
| Deactivate staff | `"Deactivated staff: Ram KC"` |
| Reactivate staff | `"Reactivated staff: Ram KC"` |
| Reset password | `"Reset password for: Gita Poudel"` |
| Delete staff | `"Deleted staff account: Hari Adhikari"` |

---

## Relationships

| Module | Dependency |
|--------|-----------|
| **All admin modules** | Every page checks `staff.permissions` to show/hide UI and allow/deny actions |
| **Module 8 (Activity Logs)** | Staff actions logged with `staffId` reference |
| **Firebase Auth** | Staff `id` = Firebase Auth UID. `isActive` controls Auth account state |

---

## Implementation Notes

- **Permission helper**: Create a reusable `usePermission()` hook that accepts a permission string and returns boolean. Used across all admin pages to gate UI elements
- **Role change warning**: When admin changes role after customizing permissions, show a confirmation modal. On confirm → reset to role defaults. On cancel → keep current settings
- **Password strength**: Show a visual strength indicator (weak/medium/strong) when admin types password. Minimum 8 characters, at least one number and one special character
- **Firebase Auth sync**: When `isActive` toggled to false, disable the Firebase Auth account. When toggled back to true, re-enable it
- **Login history**: Update on each Firebase Auth sign-in via a Cloud Function or client-side trigger after successful login
- **Deletion safety**: If Firebase Auth deletion fails (network error), roll back the Firestore document creation. Use try-catch with cleanup
