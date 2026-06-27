# Module: Counters

## Purpose
Centralized sequential numbering for orders, invoices, batches, purchases, and OTC coupons. All counters use Firestore's `FieldValue.increment(1)` for atomic, collision-safe increments.

**All years in Bikram Sambat (BS).** Fiscal year: **Shrawan 1 → Ashad 32**.

---

## Bikram Sambat Year Utility

```typescript
// utils/nepaliDate.ts
import NepaliDate from 'nepali-date';

export function toBSYear(date: Date = new Date()): number {
  return new NepaliDate(date).getYear();  // e.g., 2083
}

export function toBSDateString(date: Date = new Date()): string {
  const nd = new NepaliDate(date);
  const y = nd.getYear();
  const m = String(nd.getMonth()).padStart(2, '0');
  const d = String(nd.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;  // e.g., "20830312" for Jestha 12, 2083
}

export function isShrawanFirst(date: Date): boolean {
  const nd = new NepaliDate(date);
  return nd.getMonth() === 4 && nd.getDate() === 1;  // Shrawan 1 = fiscal year start
}
```

---

## Collection: `counters/{counterName}`

### Standard Counters (yearly — BS year, rolls over on Shrawan 1)

```typescript
// /counters/orders
{
  prefix: string          // "GPT"
  currentYear: number     // 2083 — Bikram Sambat year
  sequence: number        // 42 — next number to assign
  updatedAt: Timestamp
}

// /counters/invoices
{
  prefix: string          // "INV"
  currentYear: number     // 2083
  sequence: number        // 42
  updatedAt: Timestamp
}

// /counters/batches
{
  prefix: string          // "BATCH"
  currentYear: number     // 2083
  sequence: number        // 15
  updatedAt: Timestamp
}

// /counters/purchases
{
  prefix: string          // "PUR"
  currentYear: number     // 2083
  sequence: number        // 8
  updatedAt: Timestamp
}
```

### Daily Counters (OTC Coupons — BS date)

```typescript
// /counters/otcCoupons/20830321  (BS date-based key)
{
  date: string            // "20830321" — BS YYYYMMDD
  sequence: number        // 3 — next number to assign today
  updatedAt: Timestamp
}
```

---

## Usage by Module

| Counter Doc | Used By | Number Format |
|------------|---------|---------------|
| `counters/orders` | Orders & Checkout | `GPT-{BS_YEAR}-{SEQUENCE}` → `GPT-2083-0042` |
| `counters/invoices` | Invoice | `INV-{BS_YEAR}-{SEQUENCE}` → `INV-2083-0042` |
| `counters/batches` | Production Batches | `BATCH-{BS_YEAR}-{SEQUENCE}` → `BATCH-2083-0015` |
| `counters/purchases` | Purchases | `PUR-{BS_YEAR}-{SEQUENCE}` → `PUR-2083-0008` |
| `counters/otcCoupons/{BS_YYYYMMDD}` | Coupons | `OTC-{BS_YYYYMMDD}-{SEQUENCE}` → `OTC-20830321-003` |

---

## Format Patterns

### Standard (yearly rollover on Shrawan 1)

```
{PREFIX}-{BS_YEAR}-{SEQUENCE}
Example: GPT-2083-0042
```

| Component | Rules |
|-----------|-------|
| `PREFIX` | Fixed per doc. E.g., `GPT`, `INV`, `BATCH`, `PUR` |
| `BS_YEAR` | Current Bikram Sambat year (e.g., 2083). Resets `sequence` to 1 on Shrawan 1 |
| `SEQUENCE` | Zero-padded to 4 digits. Max 9999 per BS year |

### Daily (OTC Coupons)

```
OTC-{BS_YYYYMMDD}-{SEQUENCE}
Example: OTC-20830321-003
```

| Component | Rules |
|-----------|-------|
| `BS_YYYYMMDD` | Current BS date. Resets `sequence` to 1 each day |
| `SEQUENCE` | Zero-padded to 3 digits. Max 999 per day |

---

## Increment Logic (Client-Side)

```typescript
async function generateOrderNumber(): Promise<string> {
  const bsYear = toBSYear();              // Uses nepali-date library
  const counterPath = `counters/orders`;
  const ref = firestore.doc(counterPath);

  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      prefix: 'GPT',
      currentYear: bsYear,
      sequence: 1
    });
    return `GPT-${bsYear}-0001`;
  }

  // Reset sequence on Shrawan 1 (BS year rollover)
  if (snap.data().currentYear < bsYear) {
    await ref.update({ currentYear: bsYear, sequence: 1 });
    return `GPT-${bsYear}-0001`;
  }

  // Atomic increment
  const seq = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const nextSeq = snap.data().sequence + 1;
    tx.update(ref, { sequence: nextSeq });
    return nextSeq;
  });

  return `GPT-${bsYear}-${String(seq).padStart(4, '0')}`;
}
```

For OTC counters (daily):

```typescript
async function generateOTCCode(): Promise<string> {
  const bsDate = toBSDateString();         // "20830321"
  const counterPath = `counters/otcCoupons/${bsDate}`;
  const ref = firestore.doc(counterPath);

  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ date: bsDate, sequence: 1 });
    return `OTC-${bsDate}-001`;
  }

  const seq = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const nextSeq = snap.data().sequence + 1;
    tx.update(ref, { sequence: nextSeq });
    return nextSeq;
  });

  return `OTC-${bsDate}-${String(seq).padStart(3, '0')}`;
}
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| **Counter doc doesn't exist** | First call creates doc with `sequence: 1` |
| **BS year rollover** | Detect `currentYear < current BS year` on Shrawan 1, reset `sequence` to 1 |
| **Day rollover (OTC)** | OTC counter keyed by BS date, so a new day = new doc with `sequence: 1` |
| **Sequence overflow** | Standard counters max 9999/BS year (~27/day). Realistic: a pickle shop will never hit this |
| **Concurrent increments** | Transaction ensures atomicity — two staff creating orders simultaneously each get a unique number |
| **Offline / retry** | If increment fails (network), retry. Store last known number in local state as fallback |

---

## Implementation Notes

- **nepali-date library**: Install `nepali-date` npm package in both `client/` and `admin/`. Provides BS ↔ AD conversion
- **Shrawan 1 detection**: The nepali-date library returns month=4 for Shrawan, date=1 for the 1st. This is checked on every counter increment
- **No Cloud Functions**: All counter logic runs client-side. Firestore transaction ensures atomicity
- **Daily OTC cleanup**: Old OTC counter docs accumulate. No auto-cleanup needed at this scale (365 docs/BS year = negligible)
- **Admin override**: If a counter needs manual reset, Super Admin can edit the counter doc directly in Firestore console
- **Legacy counters**: Existing counters using AD year (e.g., `currentYear: 2026`) will be detected as < BS 2083 and reset automatically on first use
