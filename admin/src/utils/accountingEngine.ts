import { Timestamp, runTransaction, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getDocument, getCollection, addDocument } from "../lib/firestore";
import NepaliDate from "nepali-date";
import type {
  Account, JournalEntry, JournalLine, TrialBalanceRow,
  AccountType, NormalBalance, ReferenceType,
} from "../types";

function getBSYear(): number {
  const nd = new NepaliDate(new Date());
  return nd.getYear();
}

function formatNumber(num: number, digits: number): string {
  return String(num).padStart(digits, "0");
}

async function getNextJournalNumber(): Promise<string> {
  const counterPath = "counters/journalEntries";
  const counterRef = doc(db, counterPath);
  const now = Timestamp.now();
  const year = getBSYear();

  const newSeq = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    if (!snap.exists()) {
      transaction.set(counterRef, { sequence: 1, year, updatedAt: now });
      return 1;
    }
    const data = snap.data() as { sequence: number; year: number };
    const seq = data.year === year ? data.sequence + 1 : 1;
    transaction.update(counterRef, {
      sequence: data.year === year ? data.sequence + 1 : 1,
      year,
      updatedAt: now,
    });
    return seq;
  });

  return `JE-${year}-${formatNumber(newSeq, 4)}`;
}

export async function postJournalEntry(params: {
  entryDate: Date;
  description: string;
  lines: JournalLine[];
  referenceType: ReferenceType;
  referenceId?: string;
  createdBy: string;
}): Promise<string> {
  const { entryDate, description, lines, referenceType, referenceId, createdBy } = params;

  if (lines.length === 0) throw new Error("Journal entry must have at least one line");

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    totalDebit += line.debit || 0;
    totalCredit += line.credit || 0;
  }

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Debits (${totalDebit}) must equal credits (${totalCredit})`);
  }

  const entryNumber = await getNextJournalNumber();

  const id = await addDocument("journalEntries", {
    entryNumber,
    entryDate,
    description,
    lines,
    totalDebit,
    totalCredit,
    referenceType,
    referenceId: referenceId || null,
    posted: true,
    postedAt: Timestamp.now(),
    createdBy,
  });

  return id;
}

async function loadAccounts(): Promise<Map<string, Account>> {
  const accounts = await getCollection<Account>("accounts");
  const map = new Map<string, Account>();
  for (const acc of accounts) {
    map.set(acc.code, acc);
  }
  return map;
}

export async function getTrialBalance(asOfDate?: Date): Promise<TrialBalanceRow[]> {
  const accounts = await loadAccounts();
  const entries = await getCollection<JournalEntry>("journalEntries");

  const filtered = asOfDate
    ? entries.filter((e) => e.entryDate.seconds <= Math.floor(asOfDate.getTime() / 1000))
    : entries;

  const balanceMap = new Map<string, { totalDebit: number; totalCredit: number }>();

  for (const entry of filtered) {
    for (const line of entry.lines) {
      const code = line.accountCode;
      if (!balanceMap.has(code)) {
        balanceMap.set(code, { totalDebit: 0, totalCredit: 0 });
      }
      const current = balanceMap.get(code)!;
      current.totalDebit += line.debit || 0;
      current.totalCredit += line.credit || 0;
    }
  }

  const rows: TrialBalanceRow[] = [];
  for (const [code, totals] of balanceMap) {
    const account = accounts.get(code);
    if (!account) continue;
    const debit = Math.round(totals.totalDebit * 100) / 100;
    const credit = Math.round(totals.totalCredit * 100) / 100;
    const balance = account.normalBalance === "debit"
      ? debit - credit
      : credit - debit;

    rows.push({
      accountCode: code,
      accountName: account.name,
      type: account.type,
      totalDebit: debit,
      totalCredit: credit,
      balance: Math.round(balance * 100) / 100,
      normalBalance: account.normalBalance,
    });
  }

  for (const [code, account] of accounts) {
    if (!balanceMap.has(code)) {
      rows.push({
        accountCode: code,
        accountName: account.name,
        type: account.type,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
        normalBalance: account.normalBalance,
      });
    }
  }

  rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  return rows;
}

export async function getLedger(accountCode: string): Promise<{
  account: Account | null;
  entries: { entryNumber: string; date: Date; description: string; debit: number; credit: number; runningBalance: number }[];
}> {
  const account = await getDocument<Account>(`accounts/${accountCode}`);
  const entries = await getCollection<JournalEntry>("journalEntries");

  const lines: { entryNumber: string; date: Date; description: string; debit: number; credit: number; runningBalance: number }[] = [];
  let runningBalance = 0;

  const sorted = entries
    .filter((e) => e.lines.some((l) => l.accountCode === accountCode))
    .sort((a, b) => a.entryDate.seconds - b.entryDate.seconds);

  for (const entry of sorted) {
    const line = entry.lines.find((l) => l.accountCode === accountCode);
    if (!line) continue;

    const debit = line.debit || 0;
    const credit = line.credit || 0;

    if (account && account.normalBalance === "debit") {
      runningBalance += debit - credit;
    } else {
      runningBalance += credit - debit;
    }

    lines.push({
      entryNumber: entry.entryNumber,
      date: new Date(entry.entryDate.seconds * 1000),
      description: entry.description,
      debit,
      credit,
      runningBalance: Math.round(runningBalance * 100) / 100,
    });
  }

  return { account, entries: lines };
}

export async function getProfitAndLoss(
  periodStart: Date,
  periodEnd: Date,
): Promise<{
  incomeAccounts: TrialBalanceRow[];
  expenseAccounts: TrialBalanceRow[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}> {
  const trialBalance = await getTrialBalance(periodEnd);

  const startTs = Math.floor(periodStart.getTime() / 1000);
  const endTs = Math.floor(periodEnd.getTime() / 1000);

  const entries = await getCollection<JournalEntry>("journalEntries");
  const periodEntries = entries.filter((e) => {
    const ts = e.entryDate.seconds;
    return ts >= startTs && ts <= endTs;
  });

  const periodIncome = new Map<string, number>();
  const periodExpenses = new Map<string, number>();

  for (const entry of periodEntries) {
    for (const line of entry.lines) {
      const acc = trialBalance.find((r) => r.accountCode === line.accountCode);
      if (!acc) continue;

      if (acc.type === "income") {
        const current = periodIncome.get(line.accountCode) || 0;
        periodIncome.set(line.accountCode, current + (line.credit || 0) - (line.debit || 0));
      } else if (acc.type === "expense") {
        const current = periodExpenses.get(line.accountCode) || 0;
        periodExpenses.set(line.accountCode, current + (line.debit || 0) - (line.credit || 0));
      }
    }
  }

  const incomeAccounts: TrialBalanceRow[] = [];
  const expenseAccounts: TrialBalanceRow[] = [];

  for (const row of trialBalance) {
    if (row.type === "income" && periodIncome.has(row.accountCode)) {
      incomeAccounts.push({ ...row, balance: Math.round((periodIncome.get(row.accountCode) || 0) * 100) / 100 });
    }
    if (row.type === "expense" && periodExpenses.has(row.accountCode)) {
      expenseAccounts.push({ ...row, balance: Math.round((periodExpenses.get(row.accountCode) || 0) * 100) / 100 });
    }
  }

  const totalIncome = incomeAccounts.reduce((s, r) => s + r.balance, 0);
  const totalExpenses = expenseAccounts.reduce((s, r) => s + r.balance, 0);

  return {
    incomeAccounts,
    expenseAccounts,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round((totalIncome - totalExpenses) * 100) / 100,
  };
}

export async function getBalanceSheet(
  asOfDate: Date,
): Promise<{
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}> {
  const trialBalance = await getTrialBalance(asOfDate);

  const assets = trialBalance.filter((r) => r.type === "asset" && r.balance !== 0);
  const liabilities = trialBalance.filter((r) => r.type === "liability" && r.balance !== 0);
  const equity = trialBalance.filter((r) => r.type === "equity" && r.balance !== 0);

  const totalAssets = assets.reduce((s, r) => s + Math.abs(r.balance), 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + Math.abs(r.balance), 0);
  const totalEquity = equity.reduce((s, r) => s + Math.abs(r.balance), 0);

  return {
    assets,
    liabilities,
    equity,
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    totalEquity: Math.round(totalEquity * 100) / 100,
  };
}

