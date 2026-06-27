import { useState, useEffect } from "react";
import UpdateStatusModal from "./UpdateStatusModal";
import MarkPaidModal from "./MarkPaidModal";
import { getDocument } from "../lib/firestore";
import { notifyStatusUpdate } from "../utils/whatsapp";
import { useStaff } from "../hooks/useStaff";
import type { Order, StoreSettings, NotificationSettings } from "../types";

interface OrderDetailProps {
  order: Order;
  staffId: string;
  staffName: string;
  onUpdate: (orderId: string, updates: Partial<Order>) => Promise<void>;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  confirmed: "bg-info/10 text-info",
  processing: "bg-forest-green/10 text-forest-green",
  shipped: "bg-mustard-gold/10 text-mustard-gold",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-error/10 text-error",
  returned: "bg-brown/10 text-brown",
};

export default function OrderDetail({ order, staffId, staffName, onUpdate, onBack }: OrderDetailProps) {
  const { staff } = useStaff();
  const isAdmin = staff?.role === "super_admin" || staff?.role === "manager";
  const [statusModal, setStatusModal] = useState(false);
  const [paidModal, setPaidModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [notif, setNotif] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    Promise.all([
      getDocument<StoreSettings>("settings/store"),
      getDocument<NotificationSettings>("settings/notifications"),
    ]).then(([s, n]) => { setStore(s); setNotif(n); });
  }, []);

  const handleStatusUpdate = async (status: string, note: string) => {
    setSaving(true);
    try {
      const history = order.statusHistory ?? [];
      await onUpdate(order.id, {
        status: status as Order["status"],
        statusHistory: [...history, { status, changedBy: staffId, changedByName: staffName, timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, note }],
        ...(status === "shipped" ? { deliveredAt: null } : {}),
        ...(status === "delivered" ? { deliveredAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any } : {}),
        ...(status === "returned" ? { returnedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any } : {}),
      });
      setStatusModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (method: string, amount: number, note: string) => {
    setSaving(true);
    try {
      const history = order.paymentHistory ?? [];
      const totalPaid = history.reduce((s, p) => s + p.amount, 0) + amount;
      const paymentStatus = totalPaid >= order.grandTotal ? "paid" : "partial";
      await onUpdate(order.id, {
        paymentStatus,
        paymentHistory: [...history, { method: method as any, amount, receivedBy: staffId, receivedByName: staffName, receivedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any, note }],
        paidAt: paymentStatus === "paid" ? { seconds: Date.now() / 1000, nanoseconds: 0 } as any : order.paidAt,
      });
      setPaidModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-info transition-colors hover:text-info/80">← Back to Orders</button>

      <div className="rounded-card bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-text">{order.orderNumber}</h2>
            <p className="text-sm text-text-muted">{new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[order.status] || "bg-light-gray text-text-muted"}`}>
            {order.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <button onClick={() => setStatusModal(true)} className="rounded-btn bg-forest-green px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-forest-green-dark">
            Update Status{isAdmin ? " (Admin)" : ""}
          </button>
          {order.paymentStatus !== "paid" && order.paymentMethod !== "credit" && (
            <button onClick={() => setPaidModal(true)} className="rounded-btn border border-forest-green px-4 py-1.5 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green/5">Mark Paid</button>
          )}
          {store && (
            <>
            </>
          )}
          {notif && order.customerPhone && (
            <a href={notifyStatusUpdate(order, notif, store || { storeName: "Great Pickle Taste" } as StoreSettings)} target="_blank" rel="noopener noreferrer" className="rounded-btn border border-green-600 px-4 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-success/5">Notify Customer</a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-card bg-white p-5 shadow-card">
          <h3 className="mb-3 font-heading font-semibold text-text">Customer</h3>
          <div className="space-y-1 text-sm text-text-light">
            <p><span className="font-medium text-text">Name:</span> {order.customerName}</p>
            <p><span className="font-medium text-text">Phone:</span> {order.customerPhone}</p>
            {order.customerEmail && <p><span className="font-medium text-text">Email:</span> {order.customerEmail}</p>}
            <p><span className="font-medium text-text">Address:</span> {order.shippingAddress}</p>
            {order.deliveryNotes && <p><span className="font-medium text-text">Notes:</span> {order.deliveryNotes}</p>}
          </div>
        </div>

        <div className="rounded-card bg-white p-5 shadow-card">
          <h3 className="mb-3 font-heading font-semibold text-text">Items</h3>
          <div className="divide-y divide-border text-sm">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between py-2">
                <span className="text-text-light">{item.productName} — {item.skuLabel} <span className="text-text-muted">×{item.quantity}</span></span>
                <span className="font-medium">NPR {item.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <div className="space-y-1 pt-3">
              <div className="flex justify-between text-text-light"><span>Subtotal</span><span>NPR {order.subtotal.toLocaleString()}</span></div>
              {order.discount > 0 && <div className="flex justify-between text-text-light"><span>Discount</span><span className="text-error">−NPR {order.discount.toLocaleString()}</span></div>}
              <div className="flex justify-between text-text-light"><span>Delivery</span><span>NPR {order.deliveryCharge.toLocaleString()}</span></div>
              <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span className="text-forest-green">NPR {order.grandTotal.toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        <div className="rounded-card bg-white p-5 shadow-card">
          <h3 className="mb-3 font-heading font-semibold text-text">Payment</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-light">Method</span><span className="font-medium capitalize">{order.paymentMethod}</span></div>
            <div className="flex justify-between">
              <span className="text-text-light">Status</span>
              <span className={`font-medium ${order.paymentStatus === "paid" ? "text-success" : order.paymentStatus === "unpaid" ? "text-error" : "text-warning"}`}>{order.paymentStatus}</span>
            </div>
            {order.paymentHistory.length > 0 && (
              <div className="border-t border-border pt-2">
                <p className="mb-1 text-xs font-medium text-text-muted">History</p>
                {order.paymentHistory.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs text-text-light">
                    <span className="capitalize">{p.method} — {new Date(p.receivedAt?.seconds * 1000).toLocaleDateString()}</span>
                    <span>NPR {p.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-card bg-white p-5 shadow-card">
        <h3 className="mb-3 font-heading font-semibold text-text">Status Timeline</h3>
        <div className="space-y-2">
          {order.statusHistory.map((h, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${i === order.statusHistory.length - 1 ? "bg-forest-green" : "bg-border"}`} />
              <span className="text-xs text-text-muted">{new Date(h.timestamp?.seconds * 1000).toLocaleString()}</span>
              <span className="font-medium capitalize text-text">{h.status}</span>
              <span className="text-xs text-text-muted">— {h.changedByName}</span>
              {h.note && <span className="text-xs text-text-light">({h.note})</span>}
            </div>
          ))}
        </div>
      </div>

      <UpdateStatusModal open={statusModal} onClose={() => setStatusModal(false)} order={order} onUpdate={handleStatusUpdate} saving={saving} isAdmin={isAdmin} />
      <MarkPaidModal open={paidModal} onClose={() => setPaidModal(false)} order={order} onMark={handleMarkPaid} saving={saving} />
    </div>
  );
}
