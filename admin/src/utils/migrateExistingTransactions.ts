import { getCollection } from "../lib/firestore";
import { postSale, postExpense, postPurchase, postCouponRedemption } from "./journalPosting";
import type { Invoice, Expense, Purchase } from "../types";

interface MigrationResult {
  salesCreated: number;
  expensesCreated: number;
  purchasesCreated: number;
  couponsCreated: number;
  errors: string[];
}

export async function migrateExistingTransactions(staffId: string): Promise<MigrationResult> {
  const result: MigrationResult = { salesCreated: 0, expensesCreated: 0, purchasesCreated: 0, couponsCreated: 0, errors: [] };

  try {
    const invoices = await getCollection<Invoice>("invoices");
    for (const inv of invoices) {
      if (inv.paymentStatus !== "paid") continue;
      try {
        const id = await postSale(inv, staffId);
        if (id) result.salesCreated++;

        if (inv.coupon?.discountAmount && inv.coupon.discountAmount > 0) {
          const cid = await postCouponRedemption(inv.invoiceNumber, inv.coupon.discountAmount, staffId);
          if (cid) result.couponsCreated++;
        }
      } catch (err) {
        result.errors.push(`Invoice ${inv.invoiceNumber}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }
  } catch (err) {
    result.errors.push(`Failed to read invoices: ${err instanceof Error ? err.message : "Unknown"}`);
  }

  try {
    const expenses = await getCollection<Expense>("expenses");
    for (const exp of expenses) {
      try {
        const id = await postExpense(exp, staffId);
        if (id) result.expensesCreated++;
      } catch (err) {
        result.errors.push(`Expense ${exp.id}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }
  } catch (err) {
    result.errors.push(`Failed to read expenses: ${err instanceof Error ? err.message : "Unknown"}`);
  }

  try {
    const purchases = await getCollection<Purchase>("purchases");
    for (const pur of purchases) {
      try {
        const id = await postPurchase(pur, staffId);
        if (id) result.purchasesCreated++;
      } catch (err) {
        result.errors.push(`Purchase ${pur.purchaseNumber}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }
  } catch (err) {
    result.errors.push(`Failed to read purchases: ${err instanceof Error ? err.message : "Unknown"}`);
  }

  return result;
}
