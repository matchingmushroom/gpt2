import { Timestamp } from "firebase/firestore";
import { getCollection, getDocument } from "../lib/firestore";
import { postJournalEntry } from "./accountingEngine";
import type { DailyRegister, Invoice, Expense, Purchase } from "../types";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function computeDailyRegister(date: Date): Promise<{
  openingCash: number;
  openingBank: number;
  openingEsewa: number;
  openingKhalti: number;
  cashSales: number;
  bankSales: number;
  esewaSales: number;
  khaltiSales: number;
  creditSales: number;
  totalExpenses: number;
  totalPurchases: number;
}> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const startTs = Math.floor(dayStart.getTime() / 1000);
  const endTs = Math.floor(dayEnd.getTime() / 1000);

  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayStart = startOfDay(prevDay);

  const prevRegister = await getDocument<DailyRegister>(`dailyRegisters/${date.toISOString().split("T")[0]}`);
  const prevRegisterDate = prevDay.toISOString().split("T")[0];
  const yesterdayRegister = await getDocument<DailyRegister>(`dailyRegisters/${prevRegisterDate}`);

  let openingCash = 0;
  let openingBank = 0;
  let openingEsewa = 0;
  let openingKhalti = 0;

  if (yesterdayRegister) {
    openingCash = yesterdayRegister.closingCash;
    openingBank = yesterdayRegister.closingBank;
    openingEsewa = yesterdayRegister.closingEsewa;
    openingKhalti = yesterdayRegister.closingKhalti;
  }

  const [invoices, expenses, purchases] = await Promise.all([
    getCollection<Invoice>("invoices"),
    getCollection<Expense>("expenses"),
    getCollection<Purchase>("purchases"),
  ]);

  const dayInvoices = invoices.filter((inv) => {
    const t = inv.createdAt;
    return t && t.seconds >= startTs && t.seconds <= endTs && inv.paymentStatus === "paid";
  });

  let cashSales = 0, bankSales = 0, esewaSales = 0, khaltiSales = 0, creditSales = 0;
  for (const inv of dayInvoices) {
    switch (inv.paymentMethod) {
      case "cash": cashSales += inv.grandTotal; break;
      case "bank": bankSales += inv.grandTotal; break;
      case "esewa": esewaSales += inv.grandTotal; break;
      case "khalti": khaltiSales += inv.grandTotal; break;
      case "cod": cashSales += inv.grandTotal; break;
      case "credit": creditSales += inv.grandTotal; break;
    }
  }

  const dayExpenses = expenses.filter((exp) => {
    const t = exp.date;
    return t && t.seconds >= startTs && t.seconds <= endTs;
  });
  const totalExpenses = dayExpenses.reduce((s, e) => s + e.amount, 0);

  const dayPurchases = purchases.filter((pur) => {
    const t = pur.createdAt;
    return t && t.seconds >= startTs && t.seconds <= endTs;
  });
  const totalPurchases = dayPurchases.reduce((s, p) => s + p.grandTotal, 0);

  return {
    openingCash, openingBank, openingEsewa, openingKhalti,
    cashSales: Math.round(cashSales * 100) / 100,
    bankSales: Math.round(bankSales * 100) / 100,
    esewaSales: Math.round(esewaSales * 100) / 100,
    khaltiSales: Math.round(khaltiSales * 100) / 100,
    creditSales: Math.round(creditSales * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalPurchases: Math.round(totalPurchases * 100) / 100,
  };
}

export function computeClosingBalances(register: {
  openingCash: number; openingBank: number; openingEsewa: number; openingKhalti: number;
  cashSales: number; bankSales: number; esewaSales: number; khaltiSales: number;
  totalExpenses: number; totalPurchases: number;
  cashIn: number; cashOut: number;
}): {
  expectedClosingCash: number;
  closingCash: number;
  closingBank: number;
  closingEsewa: number;
  closingKhalti: number;
  cashDifference: number;
} {
  const expectedClosingCash = Math.round((
    register.openingCash + register.cashSales - register.totalExpenses - register.totalPurchases + register.cashIn - register.cashOut
  ) * 100) / 100;

  const closingBank = Math.round((register.openingBank + register.bankSales) * 100) / 100;
  const closingEsewa = Math.round((register.openingEsewa + register.esewaSales) * 100) / 100;
  const closingKhalti = Math.round((register.openingKhalti + register.khaltiSales) * 100) / 100;

  return {
    expectedClosingCash,
    closingCash: expectedClosingCash,
    closingBank,
    closingEsewa,
    closingKhalti,
    cashDifference: 0,
  };
}

export async function closeRegister(
  register: DailyRegister,
  adjustedClosingCash: number,
  closedBy: string,
): Promise<void> {
  const cashDifference = Math.round((adjustedClosingCash - register.expectedClosingCash) * 100) / 100;

  const { setDocument } = await import("../lib/firestore");

  await setDocument(`dailyRegisters/${register.id}`, {
    closingCash: adjustedClosingCash,
    cashDifference,
    status: "closed",
    closedBy,
    closedAt: Timestamp.now(),
  });

  const expensesAccount = "51300";

  await postJournalEntry({
    entryDate: new Date(register.date.seconds * 1000),
    description: `Daily register close — ${new Date(register.date.seconds * 1000).toLocaleDateString()}`,
    lines: [
      { accountCode: "10100", accountName: "", debit: register.closingCash, credit: 0 },
      { accountCode: "10100", accountName: "", debit: 0, credit: register.openingCash },
      { accountCode: "40100", accountName: "", debit: 0, credit: register.cashSales },
      { accountCode: expensesAccount, accountName: "", debit: register.totalExpenses, credit: 0 },
      { accountCode: "50300", accountName: "", debit: register.totalPurchases, credit: 0 },
    ].filter((l) => l.debit !== 0 || l.credit !== 0),
    referenceType: "daily_register",
    referenceId: register.id,
    createdBy: closedBy,
  });
}
