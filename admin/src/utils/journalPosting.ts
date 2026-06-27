import { Timestamp } from "firebase/firestore";
import { getCollection } from "../lib/firestore";
import { postJournalEntry } from "./accountingEngine";
import type { Invoice, Expense, Purchase, Account } from "../types";

const EXPENSE_CATEGORY_MAP: Record<string, string> = {
  rent: "50500",
  utilities: "50600",
  marketing: "50700",
  salary: "50800",
  transport: "50900",
  packaging: "51000",
  maintenance: "51100",
  miscellaneous: "51300",
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: "10100",
  bank: "10200",
  esewa: "10100",
  khalti: "10100",
  cod: "10100",
  credit: "10300",
};

async function findAccountCode(accountCode: string): Promise<boolean> {
  const accounts = await getCollection<Account>("accounts");
  return accounts.some((a) => a.code === accountCode);
}

export async function postSale(invoice: Invoice, createdBy: string): Promise<string | null> {
  const existing = await getCollection<import("../types").JournalEntry>(
    "journalEntries",
    { field: "referenceType", op: "==", value: "sale" },
    { field: "referenceId", op: "==", value: invoice.invoiceNumber }
  );
  if (existing.length > 0) return null;

  const cashAccount = PAYMENT_METHOD_MAP[invoice.paymentMethod] || "10100";
  const salesRevenueCode = "40100";

  const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
  lines.push({ accountCode: cashAccount, accountName: "", debit: invoice.grandTotal, credit: 0 });
  lines.push({ accountCode: salesRevenueCode, accountName: "", debit: 0, credit: invoice.grandTotal });

  return postJournalEntry({
    entryDate: invoice.paidAt ? new Date(invoice.paidAt.seconds * 1000) : new Date(),
    description: `Sale — ${invoice.invoiceNumber} (${invoice.customerName})`,
    lines,
    referenceType: "sale",
    referenceId: invoice.invoiceNumber,
    createdBy,
  });
}

export async function postExpense(expense: Expense, createdBy: string): Promise<string | null> {
  const existing = await getCollection<import("../types").JournalEntry>(
    "journalEntries",
    { field: "referenceType", op: "==", value: "expense" },
    { field: "referenceId", op: "==", value: expense.id }
  );
  if (existing.length > 0) return null;

  const expenseAccount = EXPENSE_CATEGORY_MAP[expense.category] || "51300";
  const cashAccount = "10100";

  const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
  lines.push({ accountCode: expenseAccount, accountName: "", debit: expense.amount, credit: 0 });
  lines.push({ accountCode: cashAccount, accountName: "", debit: 0, credit: expense.amount });

  return postJournalEntry({
    entryDate: new Date(expense.date.seconds * 1000),
    description: `Expense — ${expense.description} (${expense.category})`,
    lines,
    referenceType: "expense",
    referenceId: expense.id,
    createdBy,
  });
}

export async function postPurchase(purchase: Purchase, createdBy: string): Promise<string | null> {
  const existing = await getCollection<import("../types").JournalEntry>(
    "journalEntries",
    { field: "referenceType", op: "==", value: "purchase" },
    { field: "referenceId", op: "==", value: purchase.purchaseNumber }
  );
  if (existing.length > 0) return null;

  const purchasesAccount = "50300";
  const cashAccount = "10100";
  const creditorsAccount = "20100";

  const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
  lines.push({ accountCode: purchasesAccount, accountName: "", debit: purchase.grandTotal, credit: 0 });
  if (purchase.cashPaid > 0) {
    lines.push({ accountCode: cashAccount, accountName: "", debit: 0, credit: purchase.cashPaid });
  }
  if (purchase.due > 0) {
    lines.push({ accountCode: creditorsAccount, accountName: "", debit: 0, credit: purchase.due });
  }

  return postJournalEntry({
    entryDate: new Date(purchase.createdAt.seconds * 1000),
    description: `Purchase — ${purchase.purchaseNumber} from ${purchase.supplierName}`,
    lines,
    referenceType: "purchase",
    referenceId: purchase.purchaseNumber,
    createdBy,
  });
}

export async function postCouponRedemption(
  invoiceNumber: string,
  couponDiscount: number,
  createdBy: string,
): Promise<string | null> {
  if (couponDiscount <= 0) return null;

  const existing = await getCollection<import("../types").JournalEntry>(
    "journalEntries",
    { field: "referenceType", op: "==", value: "coupon" },
    { field: "referenceId", op: "==", value: `coupon-${invoiceNumber}` }
  );
  if (existing.length > 0) return null;

  const marketingAccount = "50700";
  const discountAccount = "40200";

  const lines: { accountCode: string; accountName: string; debit: number; credit: number }[] = [];
  lines.push({ accountCode: marketingAccount, accountName: "", debit: couponDiscount, credit: 0 });
  lines.push({ accountCode: discountAccount, accountName: "", debit: 0, credit: couponDiscount });

  return postJournalEntry({
    entryDate: new Date(),
    description: `Coupon discount — ${invoiceNumber} (NPR ${couponDiscount})`,
    lines,
    referenceType: "coupon",
    referenceId: `coupon-${invoiceNumber}`,
    createdBy,
  });
}
