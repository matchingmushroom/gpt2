import { Timestamp, doc, collection, getDocs, setDoc, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import NepaliDate from "nepali-date";
import { getTrialBalance, getProfitAndLoss, getBalanceSheet } from "./accountingEngine";
import type { Invoice, Order, Expense, DashboardCache, PnlCache, BalanceSheetCache, FinancePnLCache, FinanceBalanceSheetCache, CashFlowCache } from "../types";

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfBSMonth(): Date {
  const nd = new NepaliDate(new Date());
  const year = nd.getYear();
  const month = nd.getMonth();
  return new NepaliDate(year, month, 1).getEnglishDate();
}

function startOfBSYear(): Date {
  const nd = new NepaliDate(new Date());
  const year = nd.getMonth() >= 3 ? nd.getYear() : nd.getYear() - 1;
  return new NepaliDate(year, 3, 1).getEnglishDate();
}

function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

export async function computeDashboardCache(): Promise<DashboardCache> {
  const todayStart = toTimestamp(startOfDay());
  const monthStart = toTimestamp(startOfBSMonth());
  const now = Timestamp.now();

  const [allInvoices, products, debtors, creditors, activityLogs] = await Promise.all([
    getDocs(collection(db, "invoices")),
    getDocs(collection(db, "products")),
    getDocs(collection(db, "debtors")),
    getDocs(collection(db, "creditors")),
    getDocs(query(collection(db, "activityLog"), where("__name__", ">=", "_"))),
  ]);

  const invoiceList = allInvoices.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));

  const todayOrders = invoiceList.filter((o) => {
    const t = o.createdAt;
    return t && t.seconds >= todayStart.seconds;
  }).length;

  const pendingOrders = invoiceList.filter((o) =>
    o.status === "pending" || o.status === "confirmed" || o.status === "processing"
  ).length;

  const revenueThisMonth = invoiceList
    .filter((o) => {
      const t = o.createdAt;
      return t && t.seconds >= monthStart.seconds && (o.status === "delivered" || o.paymentStatus === "paid");
    })
    .reduce((sum, o) => sum + (o.grandTotal || 0), 0);

  const activeProducts = products.docs.filter((d) => d.data().isActive !== false).length;

  const lowStockThreshold = 10;
  const lowStockItems = products.docs.reduce((count, d) => {
    const data = d.data();
    const skus = data.skus || [];
    return count + skus.filter((s: { stock?: number }) => (s.stock ?? 0) < lowStockThreshold).length;
  }, 0);

  const dueDebtors = debtors.docs.reduce((sum, d) => sum + (d.data().totalOutstanding || 0), 0);
  const dueCreditors = creditors.docs.reduce((sum, d) => sum + (d.data().totalOutstanding || 0), 0);

  const recentActivity = activityLogs.docs
    .map((d) => d.data() as { timestamp?: Timestamp; action?: string; performedByName?: string })
    .sort((a, b) => {
      const ta = a.timestamp;
      const tb = b.timestamp;
      return tb && ta ? tb.seconds - ta.seconds : 0;
    })
    .slice(0, 10)
    .map((a) => ({
      time: a.timestamp ? new Date(a.timestamp.seconds * 1000).toLocaleString() : "",
      action: a.action || "",
      user: a.performedByName || "",
    }));

  const paidInvoices = invoiceList.filter((o) => o.paymentStatus === "paid");
  const cashBreakdown = { cash: 0, bank: 0, esewa: 0, khalti: 0 };
  for (const inv of paidInvoices) {
    const method = inv.paymentMethod;
    const amount = inv.grandTotal || 0;
    if (method === "cash") cashBreakdown.cash += amount;
    else if (method === "bank") cashBreakdown.bank += amount;
    else if (method === "esewa") cashBreakdown.esewa += amount;
    else if (method === "khalti") cashBreakdown.khalti += amount;
  }
  const cashInHand = cashBreakdown.cash + cashBreakdown.bank + cashBreakdown.esewa + cashBreakdown.khalti;

  const cache: DashboardCache = {
    todayOrders,
    pendingOrders,
    revenueThisMonth,
    lowStockItems,
    activeProducts,
    dueDebtors,
    dueCreditors,
    cashInHand,
    cashBreakdown,
    recentActivity,
    computedAt: now,
  };

  await setDoc(doc(db, "dashboard/cache"), cache);
  return cache;
}

export async function computePnlCache(): Promise<PnlCache> {
  const periodStart = toTimestamp(startOfBSYear());
  const periodEnd = Timestamp.now();

  const [orders, expenses, batches] = await Promise.all([
    getDocs(collection(db, "orders")),
    getDocs(collection(db, "expenses")),
    getDocs(collection(db, "batches")),
  ]);

  const orderList = orders.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
  const expenseList = expenses.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));

  const periodOrders = orderList.filter((o) => {
    const t = o.createdAt;
    return t && t.seconds >= periodStart.seconds && t.seconds <= periodEnd.seconds;
  });

  const deliveredOrders = periodOrders.filter((o) => o.status === "delivered");
  const returnedOrders = periodOrders.filter((o) => o.status === "returned" || o.status === "cancelled");

  const grossSales = deliveredOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const discounts = periodOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const returns = returnedOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const netSales = grossSales - discounts - returns;

  const batchList = batches.docs.map((d) => d.data());
  const openingStock = 0;
  const purchases = 0;
  const closingStock = batchList.reduce((sum, b: { items?: { quantity: number; unitCost: number }[] }) => {
    return sum + (b.items || []).reduce((s, i) => s + (i.quantity || 0) * (i.unitCost || 0), 0);
  }, 0);

  const cogs = openingStock + purchases - closingStock;
  const grossProfit = netSales - cogs;

  const expensesMap: Record<string, number> = {};
  let totalExpenses = 0;
  for (const exp of expenseList) {
    const cat = exp.category || "Other";
    expensesMap[cat] = (expensesMap[cat] || 0) + (exp.amount || 0);
    totalExpenses += exp.amount || 0;
  }

  const netProfit = grossProfit - totalExpenses;

  const cache: PnlCache = {
    periodStart,
    periodEnd,
    grossSales,
    discounts,
    returns,
    netSales,
    openingStock,
    purchases,
    closingStock,
    cogs: Math.max(0, cogs),
    grossProfit,
    expenses: expensesMap,
    totalExpenses,
    netProfit,
    computedAt: periodEnd,
  };

  await setDoc(doc(db, "reports/pnlCache"), cache);
  return cache;
}

export async function computeBalanceSheetCache(): Promise<BalanceSheetCache> {
  const now = Timestamp.now();

  const [debtors, creditors, batches] = await Promise.all([
    getDocs(collection(db, "debtors")),
    getDocs(collection(db, "creditors")),
    getDocs(collection(db, "batches")),
  ]);

  const debtorsTotal = debtors.docs.reduce((sum, d) => sum + (d.data().outstandingBalance || 0), 0);
  const creditorsTotal = creditors.docs.reduce((sum, d) => sum + (d.data().outstandingBalance || 0), 0);

  const inventory = batches.docs.reduce((sum, b) => {
    const items = b.data().items || [];
    return sum + items.reduce((s: number, i: { quantity: number; unitCost: number }) => s + (i.quantity || 0) * (i.unitCost || 0), 0);
  }, 0);

  const totalAssets = debtorsTotal + inventory;
  const totalLiabilities = creditorsTotal;
  const retainedEarnings = totalAssets - totalLiabilities;

  const cache: BalanceSheetCache = {
    assets: { cash: 0, debtors: debtorsTotal, inventory, total: totalAssets },
    liabilities: { creditors: creditorsTotal, total: totalLiabilities },
    equity: { retainedEarnings: Math.max(0, retainedEarnings), total: Math.max(0, retainedEarnings) },
    computedAt: now,
  };

  await setDoc(doc(db, "reports/balanceSheetCache"), cache);
  return cache;
}

export async function computeFinanceCache(): Promise<void> {
  const now = Timestamp.now();
  const periodStart = toTimestamp(startOfBSYear());
  const periodEnd = Timestamp.now();
  const asOfDate = new Date();

  const [pnl, bs] = await Promise.all([
    getProfitAndLoss(periodStart.toDate(), periodEnd.toDate()),
    getBalanceSheet(asOfDate),
  ]);

  const pnlCache: FinancePnLCache = {
    periodStart,
    periodEnd,
    incomeAccounts: pnl.incomeAccounts.map((r) => ({ code: r.accountCode, name: r.accountName, balance: r.balance })),
    expenseAccounts: pnl.expenseAccounts.map((r) => ({ code: r.accountCode, name: r.accountName, balance: r.balance })),
    totalIncome: pnl.totalIncome,
    totalExpenses: pnl.totalExpenses,
    netProfit: pnl.netProfit,
    computedAt: now,
  };

  const bsCache: FinanceBalanceSheetCache = {
    asOfDate: Timestamp.fromDate(asOfDate),
    assets: bs.assets.map((r) => ({ code: r.accountCode, name: r.accountName, balance: Math.abs(r.balance) })),
    liabilities: bs.liabilities.map((r) => ({ code: r.accountCode, name: r.accountName, balance: Math.abs(r.balance) })),
    equity: bs.equity.map((r) => ({ code: r.accountCode, name: r.accountName, balance: Math.abs(r.balance) })),
    totalAssets: bs.totalAssets,
    totalLiabilities: bs.totalLiabilities,
    totalEquity: bs.totalEquity,
    computedAt: now,
  };

  await Promise.all([
    setDoc(doc(db, "reports/financePnlCache"), pnlCache),
    setDoc(doc(db, "reports/financeBalanceSheetCache"), bsCache),
  ]);
}

export async function computeCashFlowCache(): Promise<CashFlowCache> {
  const now = Timestamp.now();
  const tb = await getTrialBalance();
  const map = new Map(tb.map((r) => [r.accountCode, r.balance]));

  const get = (code: string) => map.get(code) ?? 0;

  const closingCash = get("10100") + get("10200");

  const revenue = tb.filter((r) => r.accountCode.startsWith("4"))
    .reduce((s, r) => s - r.balance, 0);
  const expenses = tb.filter((r) => r.accountCode.startsWith("5"))
    .reduce((s, r) => s + r.balance, 0);
  const netProfit = revenue - expenses;
  const depreciation = get("51200");

  const debtorsBal = get("10300");
  const creditorsBal = get("20100");
  const inventoryBal = get("10400");

  const netOperating = netProfit + depreciation - debtorsBal - creditorsBal - inventoryBal;

  const fixedAssets = get("10500");
  const netInvesting = -fixedAssets;

  const shortLoan = get("20200");
  const longLoan = get("20300");
  const netFinancing = -(shortLoan + longLoan);

  const netCashChange = netOperating + netInvesting + netFinancing;
  const openingCash = Math.max(0, closingCash - netCashChange);

  const cache: CashFlowCache = {
    netProfit,
    addBackDepreciation: depreciation,
    debtorsBalance: debtorsBal,
    creditorsBalance: creditorsBal,
    inventoryBalance: inventoryBal,
    netOperatingCashFlow: netOperating,
    fixedAssetCost: fixedAssets,
    netInvestingCashFlow: netInvesting,
    shortLoanBalance: shortLoan,
    longLoanBalance: longLoan,
    netFinancingCashFlow: netFinancing,
    netCashChange,
    openingCash,
    closingCash,
    computedAt: now,
  };

  await setDoc(doc(db, "reports/cashFlowCache"), cache);
  return cache;
}

export async function computeAllCaches(): Promise<void> {
  await Promise.all([
    computeDashboardCache(),
    computePnlCache(),
    computeBalanceSheetCache(),
    computeCashFlowCache(),
    computeFinanceCache(),
  ]);
}
