# Module: Reviews

## Purpose
Allow customers to leave product reviews using Facebook or Google login. Reviews are displayed on the public product detail page. Ratings 4–5 stars are auto-approved; 1–3 stars require admin moderation.

---

## Auth Flow

```
Customer clicks "Leave a Review"
       │
       ▼
  ┌──────────────────┐
  │  Sign in to       │
  │  leave a review   │
  │                    │
  │  [f] Facebook     │
  │  [G] Google       │
  └──────────────────┘
       │
       ▼ (Firebase Auth — OAuth)
  ┌──────────────────────────┐
  │  Ram Sharma              │  ← name from Google/Facebook
  │  [profile picture]       │  ← photo from provider
  │                           │
  │  Rating: ★★★★☆           │
  │  Review: [______________] │
  │                           │
  │  [Submit Review]          │
  └──────────────────────────┘
       │
       ▼
  ┌──────────────────────────────┐
  │  Rating = 4–5 ★ → Auto-approved ✅ │
  │  Rating = 1–3 ★ → Pending moderation ⏳ │
  └──────────────────────────────┘
```

---

## Firestore Collection: `reviews/{reviewId}`

```typescript
{
  id: string
  productId: string                     // Ref: /products/{id}

  // From Firebase Auth (social login)
  userId: string                        // Firebase Auth UID
  userName: string                      // "Ram Sharma" — from Google/Facebook
  userPhotoUrl: string                  // Profile picture from provider
  userEmail: string                     // From auth provider

  // Review content
  rating: number                        // 1–5 (stars)
  comment: string                       // Review text, max 1000 chars

  // Moderation
  isApproved: boolean                   // false = hidden until approved
  approvedAt: Timestamp | null
  isFeatured: boolean                   // Show on homepage carousel
  moderatedBy: string | null            // staffId who approved/rejected

  // Meta
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

---

## Auto-Approval Logic

```typescript
function submitReview(review) {
  const autoApproved = review.rating >= 4;
  
  await firestore.collection('reviews').add({
    ...review,
    isApproved: autoApproved,
    approvedAt: autoApproved ? now : null,
    isFeatured: false,
    createdAt: now
  });

  // If not auto-approved, notify admin
  if (!autoApproved) {
    notifyAdmin(`${review.userName} left a ${review.rating}★ review on ${productName} — pending moderation`);
  }
}
```

| Rating | Auto-approve? | Public Visibility |
|:------:|:-------------:|-------------------|
| ★★★★★ | ✅ Immediate | Shows instantly |
| ★★★★☆ | ✅ Immediate | Shows instantly |
| ★★★☆☆ | ❌ Pending | Hidden until admin approves |
| ★★☆☆☆ | ❌ Pending | Hidden until admin approves |
| ★☆☆☆☆ | ❌ Pending | Hidden until admin approves |

---

## Public Site Display (Product Detail Page)

```
┌── Customer Reviews ──────────────────────────┐
│                                               │
│  ★★★★½  4.5 out of 5  —  23 reviews          │
│  ████████████████████░░░░  90% recommend     │
│                                               │
│  ┌──────────────────────────────────────────┐ │
│  │  [🖼]  Ram Sharma        ★★★★☆          │ │
│  │        Jun 21, 2026                       │ │
│  │        "Amazing taste! Reminds me of      │ │
│  │         my grandmother's recipe."         │ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────┐ │
│  │  [🖼]  Sita KC           ★★★★★          │ │
│  │        Jun 19, 2026                       │ │
│  │        "Best pickle in Kathmandu!"        │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ── 2 more reviews ──                         │
│                                               │
│  [★ Leave a Review →]                         │
└──────────────────────────────────────────────┘
```

### Homepage Featured Reviews

On the homepage, show up to 4 `isFeatured: true` reviews in a carousel:

```
┌── What Our Customers Say ──────────────────┐
│                                             │
│  "Best pickle in Kathmandu!"                │
│  — Sita KC ★★★★★                            │
│                                             │
│  [←]  ● ● ○ ○  [→]                         │
└─────────────────────────────────────────────┘
```

---

## Admin Panel: UI Components

| Component | File | Behavior |
|-----------|------|----------|
| **ReviewList** | `admin/src/pages/Reviews.tsx` | Table: Product, Customer, Rating stars, Review excerpt, Date, Status badge (Approved / Pending / Rejected). Filters: status, product, rating. Mobile: cards. Sort by newest |
| **ReviewDetail** | `admin/src/components/ReviewDetail.tsx` | Full review with user info, photo, rating, comment. Action buttons: Approve, Reject (with reason), Mark as Featured, Delete |
| **PendingBadge** | `admin/src/components/PendingBadge.tsx` | Badge in sidebar: "3 pending reviews" — visible to Manager and Super Admin |

### Review Detail Page

```
┌──────────────────────────────────────────────┐
│  Review Detail                                │
│                                              │
│  [🖼]  Ram Sharma                             │
│  ram.sharma@gmail.com                         │
│                                              │
│  Product: Buff Achar 300gm                   │
│  Rating:  ★★★☆☆                              │
│  Status:  ⏳ Pending Moderation              │
│                                              │
│  Comment:                                     │
│  "It was okay but a bit too salty for my     │
│   taste. Could use less salt."              │
│                                              │
│  Submitted: Jun 21, 2026 3:45 PM             │
│                                              │
│  [Approve]  [Reject]  [Mark Featured]  [Del] │
└──────────────────────────────────────────────┘
```

---

## Firestore Indexes

| Collection | Fields | Use |
|-----------|--------|-----|
| `reviews` | `productId` ASC, `isApproved` ASC, `createdAt` DESC | Approved reviews for a product |
| `reviews` | `isApproved` ASC, `createdAt` ASC | Pending reviews (moderation queue) |
| `reviews` | `isFeatured` ASC, `createdAt` DESC | Featured reviews for homepage |
| `reviews` | `userId` ASC, `createdAt` DESC | Reviews by a user |

---

## Permissions

| Action | Required Permission | Roles |
|--------|-------------------|-------|
| Submit review (public) | None (Firebase Auth required, not staff) | Any logged-in user |
| View pending reviews (admin) | `reviews:moderate` | Manager, Super Admin |
| Approve / reject review | `reviews:moderate` | Manager, Super Admin |
| Mark as featured | `reviews:moderate` | Manager, Super Admin |
| Delete review | `reviews:delete` | Super Admin |

### Role Mapping

| Role | View All | Moderate | Featured | Delete |
|------|:--------:|:--------:|:--------:|:------:|
| Super Admin | ✅ | ✅ | ✅ | ✅ |
| Manager | ✅ | ✅ | ✅ | ❌ |
| Staff | ❌ | ❌ | ❌ | ❌ |
| Viewer | ❌ | ❌ | ❌ | ❌ |

---

## Security Rules

```javascript
match /reviews/{reviewId} {
  // Authenticated users can create reviews
  allow create: if request.auth != null;

  // Public can read only approved reviews
  allow read: if request.resource.data.isApproved == true
    || (request.auth != null
      && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['reviews:moderate', 'admin:all']));

  // Admin only
  allow update: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['reviews:moderate', 'admin:all']);

  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.permissions.hasAny(['reviews:delete', 'admin:all']);
}
```

---

## Activity Logs

| Action | Log Entry |
|--------|-----------|
| Submit review | `"New review: Ram Sharma rated Buff Achar 300gm — ★★★☆☆ (pending)"` |
| Approve review | `"Approved review by Ram Sharma on Buff Achar 300gm"` |
| Reject review | `"Rejected review by Ram Sharma — inappropriate content"` |
| Mark featured | `"Featured review by Ram Sharma on homepage"` |
| Delete review | `"Deleted review by Ram Sharma"` |

---

## Integration with Module 1 (Products & SKUs)

Update `ProductDetail` to show:
- Average rating (rounded to ½ star)
- Review count
- Approved reviews list
- "Leave a Review" button (Firebase Auth gated)

---

## Implementation Notes

- **Review dates displayed in Bikram Sambat (BS)** — review submission date, approval date. See `utils/nepaliDate.ts`.
- **Firebase Auth OAuth**: Use Firebase Authentication with Google and Facebook sign-in providers. Trigger sign-in popup when user clicks "Leave a Review"
- **One review per user per product**: Check if user has already submitted a review for this product. If yes, show "You already reviewed this product" with option to edit
- **Average rating**: Computed client-side by querying approved reviews and averaging ratings. Cache on product detail page load
- **Notification for moderation**: Simple badge counter on admin sidebar — count of `reviews` where `isApproved == false`
- **Report review (future)**: Add a "Report" flag for inappropriate reviews
