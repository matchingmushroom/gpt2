# Module 8: Activity Logs

## Purpose
Record every significant action taken in the admin panel — who did what, when, and on which resource. Provides an audit trail for accountability, debugging, and **undo capability** for reversible actions.

---

## Firestore Collection: `activityLogs/{logId}`

```typescript
{
  id: string
  staffId: string                       // Who performed the action
  staffName: string                     // Denormalized: "Sita Sharma"
  staffRole: string                     // Denormalized: "Manager"

  action: string                        // "product.created", "order.status_updated"
  resourceType: string                  // "product", "order", "batch", "staff", "purchase", "expense", "coupon"
  resourceId: string                    // Document ID of the affected resource
  resourceIdentifier: string            // Human-readable: "Buff Achar", "GPT-2026-0001"

  details: string                       // "Created product 'Buff Achar' with 3 SKUs"
  metadata: object | null               // { previousStatus: "shipped", newStatus: "delivered" } — used for undo

  undoable: boolean                     // Can this action be undone?
  undoneAt: Timestamp | null            // If undone, when

  ipAddress: string
  timestamp: Timestamp
}
```

---

## What Gets Logged

Every **create, update, delete** action across all modules. Read/view actions are NOT logged.

| Module | Actions Logged | Undoable? |
|--------|---------------|:---------:|
| Products | create, update, **toggle active**, **toggle featured**, delete | Toggles only |
| SKUs | create, update, **toggle active**, delete | Toggles only |
| Batches | create, update, **deactivate**, **reactivate**, delete | Deactivate/reactivate |
| Orders | create (auto), **status update**, **mark payment**, return, cancel, delete | Status updates |
| Purchases | create, update, mark payment, delete | ❌ |
| Suppliers | create, update, delete | ❌ |
| Material Items | create, update, delete | ❌ |
| Expenses | create, update, delete | ❌ |
| Staff | create, update, **deactivate**, **reactivate**, reset password, delete | Deactivate/reactivate |
| Coupons | create, update, delete | ❌ |
| Inventory | **adjust stock** | ❌ |
| Settings | update budgets, update payment config | ❌ |

---

## Undo Support

### Which Actions Can Be Undone

| Log Entry | Metadata Stored | Undo Action |
|-----------|----------------|-------------|
| `order.status_updated` | `{ previousStatus, newStatus }` | Reverts to `previousStatus` |
| `batch.deactivated` | `{ previousIsActive: true }` | Sets `isActive = true` |
| `batch.reactivated` | `{ previousIsActive: false }` | Sets `isActive = false` |
| `product.toggle_active` | `{ previousIsActive }` | Reverts to `previousIsActive` |
| `product.toggle_featured` | `{ previousIsFeatured }` | Reverts to `previousIsFeatured` |
| `sku.toggle_active` | `{ previousIsActive }` | Reverts to `previousIsActive` |
| `staff.deactivated` | `{ previousIsActive: true }` | Re-activates |
| `staff.reactivated` | `{ previousIsActive: false }` | Deactivates |

### Undo Flow

```
Staff clicks "Undo" button on an activity log entry
  → Confirmation modal:
      "Undo this action?
       'Order GPT-2026-0001: shipped → delivered'
       This will revert the status back to 'shipped'."
  → [Cancel]  [Confirm Undo]
      │
      ▼ (if confirmed)
  → Performs reverse action:
      - Updates the resource (order status, batch isActive, etc.)
      - Creates a NEW activity log entry:
        action: "order.status_undone"
        details: "Undid: status changed on GPT-2026-0001 (delivered → shipped)"
        undoable: false
      - Marks the original log: undoneAt = now
```

### Undo Button Visibility

- Only shown for `undoable: true` entries
- Only shown if `undoneAt: null` (hasn't already been undone)
- Only shown to staff with appropriate write permission for the resource type
- Hidden after 24 hours from the original action (window closes)

---

## UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **ActivityPage** | `admin/src/pages/ActivityLogs.tsx` | Reverse-chronological feed. Filters: action type, staff, date range, resource type. Search by keyword. Desktop: table. Mobile: timeline cards |
| **ActivityCard** | `admin/src/components/ActivityCard.tsx` | Single log entry. Shows icon (based on resource type), staff name, action, timestamp. Undo button if applicable |
| **UndoConfirmModal** | `admin/src/components/UndoConfirmModal.tsx` | Shows original action details + what will happen. Confirm/Cancel buttons |
| **CleanupButton** | `admin/src/components/CleanupButton.tsx` | "Cleanup Old Logs" — deletes logs older than 6 months. Requires confirmation |

### Activity Page Layout

```
┌──────────────────────────────────────────────┐
│  Activity Logs                                │
│                                              │
│  [All Actions ▼]  [All Staff ▼]  [Last 7d ▼]│
│                                              │
│  Search: [_________________________]         │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ 10:32 AM  Sita (Admin)                   ││
│  │ ✅ Created product 'Buff Achar'          ││
│  │    with 3 SKUs                           ││
│  └──────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────┐│
│  │ 10:15 AM  Ram (Manager)                  ││
│  │ 🔄 Order GPT-2026-0001:                  ││
│  │    shipped → delivered              [↩]  ││
│  └──────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────┐│
│  │ 09:50 AM  Gita (Staff)                   ││
│  │ ⛔ Deactivated batch B-2026-001      [↩] ││
│  └──────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────┐│
│  │ 09:30 AM  Ram (Manager)                  ││
│  │ 💰 Recorded purchase P-2026-001          ││
│  │    from ABC Meat — NPR 23,500            ││
│  └──────────────────────────────────────────┘│
│                                              │
│  [Export CSV]  [Cleanup Logs (>6 months)]    │
└──────────────────────────────────────────────┘
```

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `activityLogs` | `timestamp` DESC | Main feed, newest first |
| `activityLogs` | `staffId` ASC, `timestamp` DESC | Filter by staff |
| `activityLogs` | `action` ASC, `timestamp` DESC | Filter by action type |
| `activityLogs` | `resourceType` ASC, `resourceId` ASC | Find all actions on a resource |
| `activityLogs` | `timestamp` ASC | Old logs for cleanup query |

---

## Log Retention: 6 Months

Logs older than 6 months are **permanently deleted**.

### Cleanup Methods

| Method | How |
|--------|-----|
| **Manual** | "Cleanup Old Logs" button on Activity page. Admin clicks → confirms → deletes all logs where `timestamp < 6 months ago` |
| **Automatic** | Optional: a simple check on page load or a once-a-day trigger (can be added later) |

### Cleanup Flow

```
Admin clicks "Cleanup Logs (>6 months)"
  → "This will permanently delete 1,247 logs older than January 21, 2026."
  → [Cancel]  [Delete 1,247 Logs]
      → Batch delete in chunks of 500
      → Show progress
      → "Cleanup complete. 1,247 logs deleted."
```

---

## Permissions

| Action | Required Permission |
|--------|-------------------|
| View activity logs | `activity:read` |
| Perform undo | Same permission required as the original action |
| Cleanup old logs | `admin:all` (Super Admin only) |

### Role Mapping

| Role | Read | Undo | Cleanup |
|------|:----:|:----:|:-------:|
| Super Admin | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ❌ |
| Staff | ❌ | ❌ | ❌ |
| Viewer | ❌ | ❌ | ❌ |

---

## Security Rules

```javascript
match /activityLogs/{id} {
  allow read: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['activity:read', 'admin:all']);

  // System writes logs via client-side after mutations
  allow create: if request.auth != null;  // Any authenticated staff can create logs

  // Only cleanup operation — no individual deletes
  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['admin:all']);
}
```

---

## Integration Points

### Logging from Other Modules

Every mutation in other modules must call a logging function:

```typescript
// Reusable helper
async function logActivity(params: {
  action: string,
  resourceType: string,
  resourceId: string,
  resourceIdentifier: string,
  details: string,
  metadata?: object,
  undoable?: boolean
}) {
  const staff = getCurrentStaff();
  await firestore.collection('activityLogs').add({
    staffId: staff.id,
    staffName: staff.name,
    staffRole: staff.role,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    resourceIdentifier: params.resourceIdentifier,
    details: params.details,
    metadata: params.metadata || null,
    undoable: params.undoable || false,
    undoneAt: null,
    ipAddress: '',  // Collected from client if available
    timestamp: firestore.FieldValue.serverTimestamp()
  });
}
```

### Example Usage in Other Modules

```typescript
// After creating a product in Module 1
await logActivity({
  action: 'product.created',
  resourceType: 'product',
  resourceId: newDocId,
  resourceIdentifier: 'Buff Achar',
  details: `Created product 'Buff Achar' with 3 SKUs`,
  undoable: false
});

// After updating order status in Module 4
await logActivity({
  action: 'order.status_updated',
  resourceType: 'order',
  resourceId: orderId,
  resourceIdentifier: 'GPT-2026-0001',
  details: `Order GPT-2026-0001: ${previousStatus} → ${newStatus}`,
  metadata: { previousStatus, newStatus },
  undoable: true
});
```

---

## Implementation Notes

- **All timestamps displayed in Bikram Sambat (BS)** — activity logs show date in BS. See `utils/nepaliDate.ts`.
- **Batch cleanup**: Use Firestore batched writes (max 500 per batch) to delete old logs. Show progress for large cleanups
- **Undo window**: Only allow undo within 24 hours of the original action. Check `timestamp` against current time
- **Undo chaining**: If an action was already undone, don't allow undoing it again. The `undoneAt` field prevents double-undo
- **Metadata for undo**: Always store enough context in `metadata` to reverse the action. For order status, store `previousStatus` and `newStatus`
- **Performance warning**: For large businesses, activity logs can grow quickly. The 6-month cleanup is essential. Consider pagination (load 50 at a time) for the activity page
