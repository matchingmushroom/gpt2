import { runTransaction, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface StockItem {
  productId: string;
  skuId: string;
  quantity: number;
}

export interface StockError {
  skuLabel: string;
  available: number;
  requested: number;
}

export async function deductStock(items: StockItem[]): Promise<{ ok: true } | { ok: false; errors: StockError[] }> {
  try {
    await runTransaction(db, async (transaction) => {
      const errors: StockError[] = [];

      for (const item of items) {
        const skuRef = doc(db, "products", item.productId, "skus", item.skuId);
        const snap = await transaction.get(skuRef);
        if (!snap.exists()) {
          errors.push({ skuLabel: "Unknown SKU", available: 0, requested: item.quantity });
          continue;
        }
        const sku = snap.data() as any;
        const available = sku.stock ?? 0;
        if (available < item.quantity) {
          errors.push({ skuLabel: sku.label || "Unknown", available, requested: item.quantity });
          continue;
        }
        transaction.update(skuRef, { stock: available - item.quantity });
      }

      if (errors.length > 0) throw errors;
    });
    return { ok: true };
  } catch (e: any) {
    if (Array.isArray(e) && e[0]?.skuLabel) {
      return { ok: false, errors: e as StockError[] };
    }
    return { ok: false, errors: [{ skuLabel: "Transaction failed", available: 0, requested: 0 }] };
  }
}
