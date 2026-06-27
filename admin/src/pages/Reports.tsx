import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useDoc } from "../hooks/useDoc";
import { useStaff } from "../hooks/useStaff";
import { logActivity } from "../utils/activityLog";
import { computeAllCaches } from "../utils/cacheCompute";
import DetailedReportView from "../components/DetailedReportView";
import type { PnlCache, BalanceSheetCache, DashboardCache, CashFlowCache } from "../types";

const reportTypes = [
  { id: "pnl", icon: "📊", label: "Profit & Loss", desc: "Revenue, COGS, gross profit, expenses, net profit" },
  { id: "balance", icon: "📋", label: "Balance Sheet", desc: "Assets, liabilities, and equity snapshot" },
  { id: "cogs", icon: "🏭", label: "COGS Detail", desc: "Opening stock, raw materials, closing stock, COGS" },
  { id: "expenses", icon: "💰", label: "Expenses", desc: "Expenses grouped by category with totals" },
  { id: "aging", icon: "⏰", label: "Aging Summary", desc: "Overdue debtors and creditors by aging buckets" },
  { id: "dashboard", icon: "📈", label: "KPI Snapshot", desc: "Current dashboard KPI values" },
  { id: "cashflow", icon: "💵", label: "Cash Flow", desc: "Operating, investing, and financing cash flows" },
  { id: "detailed", icon: "📑", label: "Detailed Report", desc: "Sales, purchases, and inventory transactions with search and download" },
];

export default function ReportsPage() {
  const { staff, can } = useStaff();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: pnl, loading: pnlLoading } = useDoc<PnlCache>(selected === "pnl" ? "reports/pnlCache" : null);
  const { data: balance, loading: balLoading } = useDoc<BalanceSheetCache>(selected === "balance" ? "reports/balanceSheetCache" : null);
  const { data: dashCache, loading: dashLoading } = useDoc<DashboardCache>(selected === "dashboard" ? "dashboard/cache" : null);
  const { data: cashFlow, loading: cfLoading } = useDoc<CashFlowCache>(selected === "cashflow" ? "reports/cashFlowCache" : null);

  const loading = pnlLoading || balLoading || dashLoading || cfLoading;

  const handleClosePeriod = async () => {
    if (!staff || !can("reports.write")) return;
    try {
      await computeAllCaches();
      logActivity({ action: "Period close", details: "Period close — caches recomputed", module: "Reports", staffId: staff.id, staffName: staff.name });
      alert("Cache recomputed successfully.");
    } catch (e) {
      alert("Cache recompute failed: " + (e instanceof Error ? e.message : "Unknown error"));
    }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Financial Reports</h1>
            <p className="text-sm text-text-light">Business performance and analysis</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can("reports.write") && (
              <button onClick={handleClosePeriod} className="rounded-btn bg-mustard-gold px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-mustard-gold-light">
                Trigger Period Close
              </button>
            )}
          </div>
        </div>

        {!selected ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reportTypes.map((r) => (
              <button key={r.id} onClick={() => setSelected(r.id)} className="group rounded-card bg-white p-5 text-left shadow-card transition-shadow hover:shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{r.icon}</span>
                  <div>
                    <h3 className="font-heading font-semibold text-text group-hover:text-forest-green">{r.label}</h3>
                    <p className="mt-1 text-xs text-text-light">{r.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button onClick={() => setSelected(null)} className="mb-4 text-sm text-info transition-colors hover:text-info/80">← All Reports</button>
            {loading ? <LoadingSkeleton type="detail" /> : renderReport(selected, { pnl, balance, dashCache, cashFlow })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function renderReport(type: string, data: {
  pnl: PnlCache | null; balance: BalanceSheetCache | null; dashCache: DashboardCache | null;
  cashFlow: CashFlowCache | null;
}) {
  switch (type) {
    case "pnl":
      return data.pnl ? (
        <div className="rounded-card bg-white p-8 shadow-card max-w-2xl mx-auto">
          <div className="text-center border-b-2 border-border pb-4 mb-6">
            <p className="text-xs text-text-light uppercase tracking-widest font-semibold">Great Pickle Taste</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-text">Profit &amp; Loss Statement</h2>
            <p className="text-xs text-text-muted mt-0.5">
              For the period {new Date(data.pnl.periodStart.seconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} — {new Date(data.pnl.periodEnd.seconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="space-y-0.5 text-sm">
            <Section label="Income" />
            <Line label="Gross Sales" value={data.pnl.grossSales} />
            <Line label="Less: Discounts" value={-data.pnl.discounts} indent />
            <Line label="Less: Returns" value={-data.pnl.returns} indent />
            <Line label="Net Sales" value={data.pnl.netSales} total />

            <Section label="Cost of Goods Sold" />
            <Line label="Opening Stock" value={data.pnl.openingStock} />
            <Line label="Add: Purchases" value={data.pnl.purchases} indent />
            <Line label="Less: Closing Stock" value={-data.pnl.closingStock} indent />
            <Line label="Cost of Goods Sold" value={data.pnl.cogs} total />

            <Line label="Gross Profit" value={data.pnl.grossProfit} net />

            <Section label="Expenses" />
            {Object.entries(data.pnl.expenses).map(([cat, amt]) => (
              <Line key={cat} label={cat} value={amt} indent />
            ))}
            <Line label="Total Expenses" value={data.pnl.totalExpenses} total />

            <Line label="Net Profit / (Loss)" value={data.pnl.netProfit} net />
          </div>
          <div className="mt-4 text-center text-xs text-text-muted">Amounts in NPR</div>
        </div>
      ) : <EmptyReport name="P&amp;L" />;

    case "balance":
      return data.balance ? (
        <div className="rounded-card bg-white p-8 shadow-card max-w-2xl mx-auto">
          <div className="text-center border-b-2 border-border pb-4 mb-6">
            <p className="text-xs text-text-light uppercase tracking-widest font-semibold">Great Pickle Taste</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-text">Balance Sheet</h2>
            <p className="text-xs text-text-muted mt-0.5">
              As at {new Date(data.balance.computedAt.seconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <Section label="Assets" />
              <Line label="Cash" value={data.balance.assets.cash} />
              <Line label="Debtors" value={data.balance.assets.debtors} />
              <Line label="Inventory" value={data.balance.assets.inventory} />
              <Line label="Total Assets" value={data.balance.assets.total} net />
            </div>
            <div>
              <Section label="Liabilities" />
              <Line label="Creditors" value={data.balance.liabilities.creditors} />
              <Line label="Total Liabilities" value={data.balance.liabilities.total} total />
              <div className="mt-4" />
              <Section label="Equity" />
              <Line label="Retained Earnings" value={data.balance.equity.retainedEarnings} />
              <Line label="Total Equity" value={data.balance.equity.total} total />
              <div className="border-t-2 border-text pt-1 mt-2 font-bold flex justify-between text-sm">
                <span>Total Liabilities &amp; Equity</span>
                <span className="font-mono">{(data.balance.liabilities.total + data.balance.equity.total).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-text-muted">Amounts in NPR</div>
        </div>
      ) : <EmptyReport name="Balance Sheet" />;

    case "cashflow":
      return data.cashFlow ? (
        <div className="rounded-card bg-white p-8 shadow-card max-w-2xl mx-auto">
          <div className="text-center border-b-2 border-border pb-4 mb-6">
            <p className="text-xs text-text-light uppercase tracking-widest font-semibold">Great Pickle Taste</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-text">Cash Flow Statement</h2>
            <p className="text-xs text-text-muted mt-0.5">Indirect Method</p>
          </div>
          <div className="space-y-0.5 text-sm">
            <Section label="Operating Activities" />
            <Line label="Net Profit" value={data.cashFlow.netProfit} />
            <Line label="Add: Depreciation" value={data.cashFlow.addBackDepreciation} indent />
            <Line label="Change in Debtors" value={-data.cashFlow.debtorsBalance} indent />
            <Line label="Change in Creditors" value={-data.cashFlow.creditorsBalance} indent />
            <Line label="Change in Inventory" value={-data.cashFlow.inventoryBalance} indent />
            <Line label="Net Cash from Operations" value={data.cashFlow.netOperatingCashFlow} total />

            <Section label="Investing Activities" />
            <Line label="Purchase of Fixed Assets" value={-data.cashFlow.fixedAssetCost} indent />
            <Line label="Net Cash used in Investing" value={data.cashFlow.netInvestingCashFlow} total />

            <Section label="Financing Activities" />
            <Line label="Proceeds from Loans" value={-(data.cashFlow.shortLoanBalance + data.cashFlow.longLoanBalance)} indent />
            <Line label="Net Cash from Financing" value={data.cashFlow.netFinancingCashFlow} total />

            <div className="border-t-2 border-text pt-1 mt-2 font-bold flex justify-between text-sm">
              <span>Net Change in Cash</span>
              <span className={`font-mono ${data.cashFlow.netCashChange >= 0 ? "text-forest-green" : "text-error"}`}>
                {data.cashFlow.netCashChange >= 0 ? data.cashFlow.netCashChange.toLocaleString() : `(${Math.abs(data.cashFlow.netCashChange).toLocaleString()})`}
              </span>
            </div>
            <Line label="Cash at Beginning" value={data.cashFlow.openingCash} />
            <Line label="Cash at End" value={data.cashFlow.closingCash} net />
          </div>
          <div className="mt-4 text-center text-xs text-text-muted">Amounts in NPR</div>
        </div>
      ) : <EmptyReport name="Cash Flow" />;

    case "dashboard":
      return data.dashCache ? (
        <div className="rounded-card bg-white p-6 shadow-card">
          <h2 className="mb-4 font-heading text-xl font-bold text-text">KPI Snapshot</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard label="Today's Orders" value={String(data.dashCache.todayOrders)} icon="📦" />
            <KPICard label="Pending Orders" value={String(data.dashCache.pendingOrders)} icon="⏳" />
            <KPICard label="Revenue (Month)" value={`NPR ${data.dashCache.revenueThisMonth.toLocaleString()}`} icon="💰" />
            <KPICard label="Active Products" value={String(data.dashCache.activeProducts)} icon="🥫" />
            <KPICard label="Low Stock" value={String(data.dashCache.lowStockItems)} icon="⚠️" />
            <KPICard label="Due Debtors" value={`NPR ${data.dashCache.dueDebtors.toLocaleString()}`} icon="👤" />
            <KPICard label="Due Creditors" value={`NPR ${data.dashCache.dueCreditors.toLocaleString()}`} icon="🤝" />
          </div>
        </div>
      ) : <EmptyReport name="KPI" />;

    case "detailed":
      return <DetailedReportView />;

    default:
      return <div className="rounded-card bg-white p-6 text-center text-text-muted shadow-card">Report data not available yet. Use the system to populate data.</div>;
  }
}

function Line({ label, value, indent, total, net }: { label: string; value: number; indent?: boolean; total?: boolean; net?: boolean }) {
  const isNeg = value < 0;
  const display = isNeg ? `(${Math.abs(value).toLocaleString()})` : value.toLocaleString();
  return (
    <div className={`flex justify-between py-0.5 ${indent ? "pl-5" : ""} ${total ? "border-t border-border pt-1 mt-1 font-bold" : ""} ${net ? "border-t-2 border-text pt-1 mt-1 font-bold" : ""} text-sm ${isNeg ? "text-error" : "text-text"}`}>
      <span>{label}</span>
      <span className="font-mono">{display}</span>
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="border-b border-border pb-0.5 mb-1 mt-4 first:mt-0">
      <span className="text-xs font-bold uppercase tracking-wider text-text-light">{label}</span>
    </div>
  );
}

function KPICard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-card bg-beige/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        <span className="font-heading text-lg font-bold text-forest-green">{value}</span>
      </div>
      <p className="mt-1 text-xs text-text-light">{label}</p>
    </div>
  );
}

function EmptyReport({ name }: { name: string }) {
  return (
    <div className="rounded-card bg-white p-10 text-center shadow-card">
      <p className="text-4xl">📈</p>
      <p className="mt-3 font-heading text-lg font-semibold text-text">No {name} data yet</p>
      <p className="text-sm text-text-muted">Data not yet available.</p>
    </div>
  );
}
