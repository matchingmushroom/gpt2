import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

const TRIGGER_KEYS: Record<string, string> = {
  dashboard: "cacheTriggers/dashboard",
  products: "cacheTriggers/publicCatalog",
  pnl: "cacheTriggers/pnl",
  balanceSheet: "cacheTriggers/balanceSheet",
  stock: "cacheTriggers/stockSummary",
  financePnl: "cacheTriggers/financePnl",
  financeBs: "cacheTriggers/financeBalanceSheet",
};

export async function invalidateCache(affected: string[]): Promise<void> {
  const writes = affected.map((key) => {
    const path = TRIGGER_KEYS[key];
    if (!path) return Promise.resolve();
    return setDoc(doc(db, path), { needsUpdate: true, updatedAt: serverTimestamp() });
  });

  await Promise.all(writes);
}
