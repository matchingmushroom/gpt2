import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

type CacheKind = "dashboard" | "pnl" | "balance_sheet";
type PeriodId = string;

const CACHE_PATHS: Record<CacheKind, string> = {
  dashboard: "dashboard/cache",
  pnl: "reports/pnlCache",
  balance_sheet: "reports/balanceSheetCache",
};

function cacheRef(kind: CacheKind, periodId: PeriodId) {
  return doc(db, CACHE_PATHS[kind], periodId);
}

/** Read from cache with live query fallback */
export async function getCached<T>(kind: CacheKind, periodId: PeriodId): Promise<T | null> {
  try {
    const snap = await getDoc(cacheRef(kind, periodId));
    if (snap.exists()) return snap.data() as T;
  } catch {}
  return null;
}

/** Write cache document */
export async function setCache<T>(kind: CacheKind, periodId: PeriodId, data: T): Promise<void> {
  await setDoc(cacheRef(kind, periodId), {
    ...data,
    computedAt: Timestamp.now(),
  });
}

/** Determine if an action should trigger archive push to GAS */
export function shouldArchive(action: string, cacheKey: string, isFinal?: boolean): boolean {
  if (action === "closePeriod") return true;
  if (cacheKey === "today" && isFinal) return true;
  return false;
}
