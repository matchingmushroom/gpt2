import { useState, useEffect, useRef } from "react";
import { orderBy, collection, query, where, getDocs, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import AdminLayout from "../components/AdminLayout";
import DataTable from "../components/DataTable";
import OrderDetail from "../components/OrderDetail";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { db } from "../lib/firebase";
import { getDocument, updateDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import { notifyNewOrder, notifyStatusUpdate } from "../utils/whatsapp";
import { combinePhone, parsePhone } from "../utils/phone";
import type { Order, NotificationSettings, StoreSettings } from "../types";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  confirmed: "bg-info/10 text-info",
  processing: "bg-forest-green/10 text-forest-green",
  shipped: "bg-mustard-gold/10 text-mustard-gold",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-error/10 text-error",
  returned: "bg-brown/10 text-brown",
};

const tabs = ["All", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"];

export default function Orders() {
  const { staff, can } = useStaff();
  const { data: orders, loading } = useCollection<Order>("orders", orderBy("createdAt", "desc"));
  const [tab, setTab] = useState("All");
  const [selected, setSelected] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [notif, setNotif] = useState<NotificationSettings | null>(null);
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    Promise.all([
      getDocument<NotificationSettings>("settings/notifications"),
      getDocument<StoreSettings>("settings/store"),
    ]).then(([n, s]) => { setNotif(n); setStore(s); });
  }, []);

  useEffect(() => {
    if (orders.length > prevCount.current && prevCount.current > 0) {
      const newest = orders[0];
      if (newest.status === "pending") {
        setNewOrderAlert(newest);
        setTimeout(() => setNewOrderAlert(null), 15000);
      }
    }
    prevCount.current = orders.length;
  }, [orders.length]);

  const filtered = orders
    .filter((o) => tab === "All" || o.status === tab.toLowerCase())
    .filter((o) => !search || o.orderNumber.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase()) || o.customerPhone.includes(search));

  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>) => {
    if (!staff || !can("orders.write")) return;
    await updateDocument(`orders/${orderId}`, updates as Record<string, unknown>);
    const updated = orders.find((o) => o.id === orderId);
    if (updated && updates.status) {
      logActivity({ action: "Updated order status", details: `Order ${updated.orderNumber}: status changed to ${updates.status}`, module: "Orders", staffId: staff.id, staffName: staff.name, relatedDocId: orderId });
      if (updates.status === "cancelled" || updates.status === "returned") {
        for (const item of updated.items) {
          if (!item.productId || !item.skuId) continue;
          try {
            const skuRef = doc(db, "products", item.productId, "skus", item.skuId);
            const snap = await getDoc(skuRef);
            if (snap.exists()) await updateDoc(skuRef, { stock: increment(item.quantity) });
          } catch (e) { console.warn("Stock restore failed", e); }
        }
        if (updated.loyaltyPointsEarned > 0 && updated.customerPhone) {
          import("../utils/loyalty").then((m) =>
            m.revertLoyaltyPoints({ phone: updated.customerPhone, points: updated.loyaltyPointsEarned, referenceType: "order", referenceId: orderId, referenceNumber: updated.orderNumber })
          ).catch(() => {});
        }
      }
    }
    invalidateCache(["dashboard", "pnl", "stock"]);
    if (selected?.id === orderId) {
      setSelected({ ...selected, ...updates } as Order);
    }
    // Sync status/payment update to the linked invoice
    if (updated?.orderNumber) {
      try {
        const invSnap = await getDocs(query(collection(db, "invoices"), where("orderNumber", "==", updated.orderNumber)));
        invSnap.forEach((invDoc) => {
          updateDocument(`invoices/${invDoc.id}`, updates as Record<string, unknown>);
        });
      } catch (err) {
        console.warn("Failed to sync invoice:", err);
      }
    }
  };

  if (selected) {
    return (
      <AdminLayout>
        <div className="p-3 sm:p-6">
          <OrderDetail
            order={selected}
            staffId={staff?.id ?? ""}
            staffName={staff?.name ?? ""}
            onUpdate={handleUpdateOrder}
            onBack={() => setSelected(null)}
          />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-lg font-bold text-text sm:text-xl">Orders</h1>
            <p className="text-xs text-text-light sm:text-sm">Manage customer orders</p>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-input border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-forest-green sm:max-w-xs" placeholder="Search order#, name, phone..." />
        </div>

        {newOrderAlert && notif && store && (
          <div className="mb-4 flex flex-col gap-2 rounded-card bg-success/10 px-3 py-3 text-xs sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:text-sm">
            <span className="text-lg">🆕</span>
            <span className="flex-1 text-text">
              New order <strong>{newOrderAlert.orderNumber}</strong> from <strong>{newOrderAlert.customerName}</strong> — NPR {newOrderAlert.grandTotal.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <a href={notifyNewOrder(newOrderAlert, notif, store)} target="_blank" rel="noopener noreferrer" className="rounded-btn bg-success px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-success/80">Notify WhatsApp</a>
              <button onClick={() => setNewOrderAlert(null)} className="text-sm text-text-muted hover:text-text">Dismiss</button>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-btn border px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 ${
              tab === t ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"
            }`}>{t}</button>
          ))}
        </div>

        <DataTable
          columns={[
            { key: "orderNumber", header: "Order #", render: (o: Order) => <span className="font-mono text-xs font-medium text-text">{o.orderNumber}</span>, sortable: true },
            { key: "customer", header: "Customer", render: (o: Order) => <div><span className="text-text-light">{o.customerName}</span><br /><span className="text-xs text-text-muted">{o.customerPhone}</span></div> },
            { key: "items", header: "Items", render: (o: Order) => <span className="text-text-light">{o.items.length}</span>, hideOnMobile: true },
            { key: "total", header: "Total", render: (o: Order) => <span className="font-medium text-forest-green">NPR {o.grandTotal.toLocaleString()}</span> },
            { key: "status", header: "Status", render: (o: Order) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[o.status] || "bg-light-gray text-text-muted"}`}>{o.status}</span> },
            { key: "payment", header: "Payment", render: (o: Order) => (
              <div>
                <span className="text-xs capitalize text-text-light">{o.paymentMethod}</span>
                <span className={`ml-1 text-xs font-medium ${o.paymentStatus === "paid" ? "text-success" : o.paymentStatus === "unpaid" ? "text-error" : "text-warning"}`}>• {o.paymentStatus}</span>
              </div>
            ), hideOnMobile: true },
            { key: "whatsapp", header: "", render: (o: Order) => (
              notif && o.customerPhone ? (
                <a
                  href={notifyStatusUpdate(o, notif, store || { storeName: "Great Pickle Taste" } as StoreSettings)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm text-success transition-colors hover:text-success/60"
                  title="Notify customer via WhatsApp"
                >💬</a>
              ) : <span className="text-text-muted">—</span>
            ), hideOnMobile: true },
          ]}
          data={filtered}
          keyExtractor={(o) => o.id}
          loading={loading}
          emptyMessage="No orders found"
          emptyIcon="📦"
          onRowClick={(o) => setSelected(o)}
        />
      </div>
    </AdminLayout>
  );
}
