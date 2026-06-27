import { getCollection, getDocument, setDocument } from "../lib/firestore";
import { getTrialBalance } from "./accountingEngine";
import type { Account, JournalEntry, FixedAsset, PayrollRun, DailyRegister, FinanceSheetSettings } from "../types";

export async function fetchSheetUrl(): Promise<FinanceSheetSettings | null> {
  const doc = await getDocument<FinanceSheetSettings>("settings/financeSheet");
  return doc || null;
}

export async function pushFinanceToSheets(gasUrl: string, staffId: string): Promise<{ sheetUrl: string; sheetId: string }> {
  const [accounts, journalEntries, fixedAssets, payrollRuns, dailyRegisters, existingSheet] = await Promise.all([
    getCollection<Account>("accounts"),
    getCollection<JournalEntry>("journalEntries"),
    getCollection<FixedAsset>("fixedAssets"),
    getCollection<PayrollRun>("payrollRuns"),
    getCollection<DailyRegister>("dailyRegisters"),
    fetchSheetUrl(),
  ]);

  const trialBalance = await getTrialBalance();

  const payload = {
    action: "pushToSheets",
    sheetId: existingSheet?.sheetId || null,
    data: {
      accounts: accounts.map((a) => ({ code: a.code, name: a.name, type: a.type, normalBalance: a.normalBalance, description: a.description, isActive: a.isActive })),
      journalEntries: journalEntries.map((e) => ({
        entryNumber: e.entryNumber,
        entryDate: e.entryDate,
        description: e.description,
        totalDebit: e.totalDebit,
        totalCredit: e.totalCredit,
        referenceType: e.referenceType,
        referenceId: e.referenceId,
        posted: e.posted,
      })),
      trialBalance: trialBalance.map((r) => ({
        accountCode: r.accountCode,
        accountName: r.accountName,
        type: r.type,
        totalDebit: r.totalDebit,
        totalCredit: r.totalCredit,
        balance: r.balance,
        normalBalance: r.normalBalance,
      })),
      fixedAssets: fixedAssets.map((a) => ({
        name: a.name,
        assetType: a.assetType,
        purchaseDate: a.purchaseDate,
        cost: a.cost,
        salvageValue: a.salvageValue,
        usefulLifeYears: a.usefulLifeYears,
        depreciationMethod: a.depreciationMethod,
        accumulatedDepreciation: a.accumulatedDepreciation,
        currentBookValue: a.currentBookValue,
        isActive: a.isActive,
      })),
      payrollRuns: payrollRuns.map((r) => ({
        periodLabel: r.periodLabel,
        totalGrossPay: r.totalGrossPay,
        totalDeductions: r.totalDeductions,
        totalNetPay: r.totalNetPay,
        status: r.status,
        disbursedAt: r.disbursedAt,
      })),
      dailyRegisters: dailyRegisters.map((r) => ({
        date: r.date,
        openingCash: r.openingCash,
        cashSales: r.cashSales,
        totalExpenses: r.totalExpenses,
        totalPurchases: r.totalPurchases,
        closingCash: r.closingCash,
        cashDifference: r.cashDifference,
        status: r.status,
      })),
    },
  };

  // GAS requires no-cors (no OPTIONS preflight support).
  // With no-cors the response is opaque, so we can't read it.
  // We store the sheet metadata from a prior push or first-creation.
  await fetch(gasUrl, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });

  const now = new Date();
  const sheetId = existingSheet?.sheetId || null;
  const sheetUrl = existingSheet?.sheetUrl || null;

  await setDocument("settings/financeSheet", {
    sheetId,
    sheetUrl,
    lastPushAt: now,
    updatedAt: now,
  });

  return { sheetUrl: sheetUrl || "", sheetId: sheetId || "" };
}
