import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useDoc } from "../hooks/useDoc";
import { computeAllCaches } from "../utils/cacheCompute";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { DashboardCache, Invoice, Debtor, Creditor } from "../types";

type ModalKey = "todayOrders" | "pendingOrders" | "revenueThisMonth" | "lowStockItems" | "activeProducts" | "dueDebtors" | "dueCreditors" | "cashInHand" | null;

const KPI_CONFIG = [
  { key: "todayOrders", label: "Today's Orders", icon: "📦", color: "text-forest-green" },
  { key: "pendingOrders", label: "Pending Orders", icon: "⏳", color: "text-warning" },
  { key: "revenueThisMonth", label: "Revenue (Month)", icon: "💰", color: "text-success" },
  { key: "lowStockItems", label: "Low Stock Items", icon: "⚠️", color: "text-chili-red" },
  { key: "activeProducts", label: "Active Products", icon: "🥫", color: "text-info" },
  { key: "dueDebtors", label: "Due Debtors", icon: "👤", color: "text-error" },
  { key: "dueCreditors", label: "Due Creditors", icon: "🤝", color: "text-mustard-gold" },
  { key: "cashInHand", label: "Cash", icon: "💵", color: "text-emerald-600" },
];

function formatNpr(n: number) {
  return `NPR ${(n || 0).toLocaleString()}`;
}

function InvoiceTable({ data, compact }: { data: Invoice[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-text-muted">
            <th className="py-2 pr-2 font-medium">#</th>
            <th className="py-2 pr-2 font-medium">Customer</th>
            <th className="py-2 pr-2 font-medium">Status</th>
            {!compact && <th className="py-2 pr-2 font-medium">Method</th>}
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((inv) => (
            <tr key={inv.id} className="border-b border-border/50 text-text-light">
              <td className="py-2 pr-2 text-xs text-text-muted">{inv.invoiceNumber || inv.id.slice(0, 6)}</td>
              <td className="py-2 pr-2">{inv.customerName || "—"}</td>
              <td className="py-2 pr-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  inv.paymentStatus === "paid" ? "bg-green-100 text-green-700" :
                  inv.paymentStatus === "refunded" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {inv.status}
                </span>
              </td>
              {!compact && <td className="py-2 pr-2 text-xs capitalize">{inv.paymentMethod}</td>}
              <td className="py-2 text-right font-medium">{formatNpr(inv.grandTotal)}</td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={compact ? 4 : 5} className="py-6 text-center text-text-muted">No invoices</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RevenueModal({ data }: { data: Invoice[] }) {
  const total = data.reduce((s, i) => s + (i.grandTotal || 0), 0);
  const byMethod: Record<string, number> = {};
  for (const inv of data) {
    const m = inv.paymentMethod || "other";
    byMethod[m] = (byMethod[m] || 0) + (inv.grandTotal || 0);
  }
  return (
    <div>
      <p className="mb-4 text-lg font-semibold text-text">Total: {formatNpr(total)}</p>
      <div className="space-y-2">
        {Object.entries(byMethod).map(([method, amount]) => (
          <div key={method} className="flex items-center justify-between rounded-btn bg-light-gray px-4 py-2">
            <span className="text-sm capitalize text-text-light">{method}</span>
            <span className="font-medium text-text">{formatNpr(amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-text-light">Recent Paid Invoices</p>
        <InvoiceTable data={data.slice(0, 50)} compact />
      </div>
    </div>
  );
}

function LowStockTable({ data }: { data: { productName: string; skuLabel: string; stock: number; price: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-text-muted">
            <th className="py-2 pr-2 font-medium">Product</th>
            <th className="py-2 pr-2 font-medium">Variant</th>
            <th className="py-2 pr-2 font-medium">Stock</th>
            <th className="py-2 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={4} className="py-6 text-center text-text-muted">No low stock items</td></tr>
          ) : data.map((item, i) => (
            <tr key={i} className="border-b border-border/50 text-text-light">
              <td className="py-2 pr-2">{item.productName}</td>
              <td className="py-2 pr-2">{item.skuLabel}</td>
              <td className="py-2 pr-2">
                <span className={`font-medium ${item.stock === 0 ? "text-chili-red" : "text-warning"}`}>
                  {item.stock}
                </span>
              </td>
              <td className="py-2 text-right">{formatNpr(item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActiveProductsTable({ data }: { data: { id: string; name: string; skus: any[] }[] }) {
  return (
    <div>
      <p className="mb-3 text-sm text-text-muted">Total: {data.length} products</p>
      <div className="divide-y divide-border/50">
        {data.slice(0, 100).map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2">
            <span className="text-sm text-text-light">{p.name}</span>
            <span className="text-xs text-text-muted">{p.skus?.length || 0} variants</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DebtorTable({ data }: { data: Debtor[] }) {
  const total = data.reduce((s, d) => s + (d.totalOutstanding || 0), 0);
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-text-muted">Total Outstanding: {formatNpr(total)}</p>
      <div className="divide-y divide-border/50">
        {data.length === 0 ? (
          <p className="py-4 text-center text-text-muted">No debtors</p>
        ) : data.map((d) => (
          <div key={d.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-text-light">{d.customerName || "Unknown"}</p>
              {d.customerPhone && <p className="text-xs text-text-muted">{d.customerPhone}</p>}
            </div>
            <span className="font-medium text-chili-red">{formatNpr(d.totalOutstanding || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreditorTable({ data }: { data: Creditor[] }) {
  const total = data.reduce((s, d) => s + (d.totalOutstanding || 0), 0);
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-text-muted">Total Outstanding: {formatNpr(total)}</p>
      <div className="divide-y divide-border/50">
        {data.length === 0 ? (
          <p className="py-4 text-center text-text-muted">No creditors</p>
        ) : data.map((d) => (
          <div key={d.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-text-light">{d.supplierName || "Unknown"}</p>
              {d.supplierPhone && <p className="text-xs text-text-muted">{d.supplierPhone}</p>}
            </div>
            <span className="font-medium text-mustard-gold">{formatNpr(d.totalOutstanding || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashBreakdown({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const methodLabels: Record<string, string> = { cash: "Cash", bank: "Bank", esewa: "eSewa", khalti: "Khalti", cod: "COD", credit: "Credit" };
  const methodColors: Record<string, string> = { cash: "text-emerald-600", bank: "text-blue-600", esewa: "text-purple-600", khalti: "text-violet-600", cod: "text-orange-500", credit: "text-red-500" };
  return (
    <div>
      <p className="mb-4 text-lg font-semibold text-text">Total Cash: {formatNpr(total)}</p>
      <div className="space-y-3">
        {Object.entries(data).filter(([, v]) => v > 0).map(([method, amount]) => (
          <div key={method} className="flex items-center justify-between rounded-btn bg-light-gray px-4 py-3">
            <span className={`text-sm font-medium capitalize ${methodColors[method] || "text-text-light"}`}>
              {methodLabels[method] || method}
            </span>
            <span className="font-medium text-text">{formatNpr(amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: cache, loading } = useDoc<DashboardCache>("dashboard/cache");
  const [refreshing, setRefreshing] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [modalData, setModalData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const closeModal = () => { setActiveModal(null); setModalData(null); setModalError(null); };

  useEffect(() => {
    if (!activeModal) return;
    setModalData(null);
    setModalLoading(true);
    setModalError(null);

    const fetchData = async () => {
      try {
        const now = new Date();
        const todayStart = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
        const monthStart = Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), 1));

        switch (activeModal) {
          case "todayOrders": {
            const snap = await getDocs(query(collection(db, "invoices"), where("createdAt", ">=", todayStart)));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setModalData(list);
            break;
          }
          case "pendingOrders": {
            const snap = await getDocs(collection(db, "invoices"));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
            const pending = list.filter(o => o.status === "pending" || o.status === "confirmed" || o.status === "processing");
            pending.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setModalData(pending);
            break;
          }
          case "revenueThisMonth": {
            const snap = await getDocs(query(collection(db, "invoices"), where("createdAt", ">=", monthStart)));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
            const paid = list.filter(o => o.paymentStatus === "paid");
            paid.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setModalData(paid);
            break;
          }
          case "lowStockItems": {
            const snap = await getDocs(collection(db, "products"));
            const threshold = 10;
            const low: { productName: string; skuLabel: string; stock: number; price: number }[] = [];
            for (const doc of snap.docs) {
              const d = doc.data();
              const skus = d.skus || [];
              for (const sku of skus) {
                if ((sku.stock ?? 0) < threshold) {
                  low.push({ productName: d.name, skuLabel: sku.label, stock: sku.stock ?? 0, price: sku.price });
                }
              }
            }
            setModalData(low);
            break;
          }
          case "activeProducts": {
            const snap = await getDocs(collection(db, "products"));
            const list = snap.docs.map(d => ({ id: d.id, name: d.data().name, skus: d.data().skus || [] }));
            setModalData(list);
            break;
          }
          case "dueDebtors": {
            const snap = await getDocs(collection(db, "debtors"));
            setModalData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Debtor)));
            break;
          }
          case "dueCreditors": {
            const snap = await getDocs(collection(db, "creditors"));
            setModalData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Creditor)));
            break;
          }
          case "cashInHand": {
            const snap = await getDocs(collection(db, "invoices"));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
            const breakdown: Record<string, number> = { cash: 0, bank: 0, esewa: 0, khalti: 0, cod: 0, credit: 0 };
            for (const inv of list) {
              if (inv.paymentStatus !== "paid") continue;
              const m = inv.paymentMethod || "other";
              breakdown[m] = (breakdown[m] || 0) + (inv.grandTotal || 0);
            }
            setModalData(breakdown);
            break;
          }
        }
      } catch (e: any) {
        setModalError(e.message || "Failed to load data");
      } finally {
        setModalLoading(false);
      }
    };
    fetchData();
  }, [activeModal]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await computeAllCaches(); } catch (e) { console.error("Cache refresh failed", e); }
    setRefreshing(false);
  };

  const isAmount = (key: string) => ["revenueThisMonth", "dueDebtors", "dueCreditors", "cashInHand"].includes(key);

  const getDisplayValue = (key: string) => {
    if (!cache) return "—";
    const val = cache[key as keyof DashboardCache] as number;
    if (val === undefined || val === null) return "—";
    return isAmount(key) ? formatNpr(val) : String(val);
  };

  const modalKpi = KPI_CONFIG.find(k => k.key === activeModal);

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-lg font-bold text-text sm:text-xl">Dashboard</h1>
            <p className="text-xs text-text-light sm:text-sm">
              Business overview
              {cache?.computedAt && (
                <span className="ml-2 text-xs text-text-muted">
                  (Updated {new Date(cache.computedAt.seconds * 1000).toLocaleString()})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="self-start rounded-btn border border-forest-green px-3 py-1.5 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green hover:text-white disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
          >
            {refreshing ? "Refreshing..." : "Refresh Cache"}
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton type="card" rows={7} />
        ) : cache ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {KPI_CONFIG.map((kpi) => (
                <button
                  key={kpi.key}
                  onClick={() => setActiveModal(kpi.key as ModalKey)}
                  className="rounded-card bg-white p-5 shadow-card text-left transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{kpi.icon}</span>
                    <span className={`font-heading text-2xl font-bold ${kpi.color}`}>
                      {getDisplayValue(kpi.key)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-light">{kpi.label}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-card bg-white p-4 shadow-card sm:mt-8 sm:p-6">
              <h2 className="mb-3 font-heading text-base font-semibold text-text sm:mb-4 sm:text-lg">Recent Activity</h2>
              {cache.recentActivity?.length > 0 ? (
                <div className="space-y-2 sm:space-y-3">
                  {cache.recentActivity.map((a, i) => (
                    <div key={i} className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:gap-3 sm:text-sm">
                      <span className="shrink-0 text-text-muted">{a.time}</span>
                      <span className="text-text-light">{a.action}</span>
                      {a.user && <span className="text-xs text-text-muted sm:ml-auto">{a.user}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">No recent activity</p>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-card bg-white p-10 text-center shadow-card">
            <p className="text-4xl">📊</p>
            <p className="mt-3 font-heading text-lg font-semibold text-text">No cache data yet</p>
            <p className="text-sm text-text-muted">Dashboard cache will populate once you start using the system.</p>
          </div>
        )}

        {activeModal && <div className="fixed inset-0 z-[100] bg-black/40" onClick={closeModal} />}

        {activeModal && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
            <div className="relative z-10 w-full max-w-3xl rounded-t-2xl bg-white shadow-xl sm:mx-4 sm:rounded-2xl max-sm:max-h-[90vh] max-sm:overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
                <h2 className="font-heading text-base font-semibold text-text sm:text-lg">
                  {modalKpi?.icon} {modalKpi?.label || activeModal}
                </h2>
                <button onClick={closeModal} className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-text-muted transition-colors hover:bg-light-gray hover:text-text sm:text-2xl">✕</button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto overscroll-contain px-4 py-4 sm:max-h-[70vh] sm:px-6">
                {modalLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest-green border-t-transparent" />
                  </div>
                ) : modalError ? (
                  <p className="text-sm text-error">{modalError}</p>
                ) : !modalData ? (
                  <p className="text-sm text-text-muted">No data</p>
                ) : activeModal === "todayOrders" || activeModal === "pendingOrders" ? (
                  <InvoiceTable data={modalData as Invoice[]} />
                ) : activeModal === "revenueThisMonth" ? (
                  <RevenueModal data={modalData as Invoice[]} />
                ) : activeModal === "lowStockItems" ? (
                  <LowStockTable data={modalData as any[]} />
                ) : activeModal === "activeProducts" ? (
                  <ActiveProductsTable data={modalData as any[]} />
                ) : activeModal === "dueDebtors" ? (
                  <DebtorTable data={modalData as Debtor[]} />
                ) : activeModal === "dueCreditors" ? (
                  <CreditorTable data={modalData as Creditor[]} />
                ) : activeModal === "cashInHand" ? (
                  <CashBreakdown data={modalData as Record<string, number>} />
                ) : null}
              </div>

              <div className="flex justify-end border-t border-border px-4 py-3 sm:px-6 sm:py-4">
                <button onClick={closeModal} className="rounded-btn border border-border px-6 py-2.5 text-sm font-medium text-text-light transition-colors hover:border-text-muted">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
