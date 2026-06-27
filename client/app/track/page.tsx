"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, onSnapshot, limit } from "firebase/firestore";

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  customer: { name: string; phone: string; address: string };
  items: { product: string; sku: string; qty: number; price: number; total: number }[];
  subtotal: number;
  delivery: number;
  total: number;
  status: string;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mapOrder(data: Record<string, unknown>, id: string): Order {
  return {
    id,
    orderNumber: data.orderNumber as string,
    date: (data.createdAt as any)?.toDate?.()?.toISOString() || new Date().toISOString(),
    customer: {
      name: (data.customerName as string) || "",
      phone: (data.customerPhone as string) || "",
      address: (data.shippingAddress as string) || "",
    },
    items: ((data.items || []) as Record<string, unknown>[]).map((i) => ({
      product: i.productName as string,
      sku: i.skuLabel as string,
      qty: i.quantity as number,
      price: i.unitPrice as number,
      total: i.subtotal as number,
    })),
    subtotal: (data.subtotal as number) || 0,
    delivery: (data.deliveryCharge as number) || 0,
    total: (data.grandTotal as number) || 0,
    status: capitalize((data.status as string) || "pending"),
  };
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  confirmed: "bg-info/10 text-info",
  processing: "bg-info/10 text-info",
  shipped: "bg-forest-green/10 text-forest-green",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-error/10 text-error",
  returned: "bg-error/10 text-error",
};

export default function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveTracking, setLiveTracking] = useState(false);

  const [phoneErr, setPhoneErr] = useState("");

  // Real-time listener — updates order status live when admin changes it
  const [trackDocId, setTrackDocId] = useState<string | null>(null);
  useEffect(() => {
    if (!trackDocId) return;
    const unsub = onSnapshot(doc(db, "orders", trackDocId), (snap) => {
      if (snap.exists()) {
        setOrder(mapOrder(snap.data() as Record<string, unknown>, snap.id));
        setLiveTracking(true);
      }
    }, (err) => {
      console.error("Live tracking listener failed:", err);
      setLiveTracking(false);
    });
    return unsub;
  }, [trackDocId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/[\s\-+]/g, "");
    if (!/^\d{10}$/.test(clean)) { setPhoneErr("Enter a valid 10-digit mobile number"); return; }
    setPhoneErr("");
    setSearched(true);
    setLoading(true);
    setTrackDocId(null);
    setLiveTracking(false);

    try {
      const q = query(
        collection(db, "orders"),
        where("orderNumber", "==", orderId.trim()),
        where("customerPhone", "==", phone.replace(/\D/g, "")),
        limit(1)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const data = snap.docs[0].data();
        setOrder(mapOrder(data as Record<string, unknown>, snap.docs[0].id));
        setTrackDocId(snap.docs[0].id);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("Firestore lookup failed, trying localStorage:", err);
    }

    // Fallback to localStorage if Firestore unavailable
    const stored: Order[] = JSON.parse(localStorage.getItem("gpt-orders") || "[]");
    const found = stored.find(
      (o) => o.orderNumber.toLowerCase() === orderId.trim().toLowerCase()
        && o.customer.phone.replace(/[\s\-+]/g, "") === clean
    );
    setOrder(found || null);
    setLoading(false);
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 font-heading text-2xl font-bold text-text">Track Your Order</h1>
        <p className="mb-6 text-sm text-text-light">Enter your order number and phone number to check status.</p>

        <form onSubmit={handleSearch} className="rounded-card bg-white p-4 shadow-card sm:p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Order Number</label>
              <input value={orderId} onChange={(e) => setOrderId(e.target.value)} className="w-full rounded-input border border-border px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest-green" placeholder="e.g. ORD-..." required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Phone Number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full rounded-input border border-border px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest-green" placeholder="98XXXXXXXX" required />
              {phoneErr && <p className="mt-1 text-xs text-error">{phoneErr}</p>}
            </div>
            <button type="submit" className="w-full rounded-btn bg-forest-green py-2.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-forest-green-dark">
              {loading ? "Searching..." : "Track Order"}
            </button>
          </div>
        </form>

        {searched && !loading && !order && (
          <div className="mt-6 rounded-card bg-white p-4 text-center shadow-card sm:p-6">
            <p className="text-4xl">🔍</p>
            <p className="mt-3 text-text-light">No order found. Please check your order number and phone.</p>
          </div>
        )}

        {order && (
          <div className="mt-6 space-y-4">
            <div className="rounded-card bg-white p-4 shadow-card sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-heading text-lg font-semibold text-text">Order {order.orderNumber}</h2>
                  <p className="text-sm text-text-muted">{new Date(order.date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {liveTracking && (
                    <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                      Live
                    </span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[order.status.toLowerCase()] || "bg-light-gray text-text-muted"}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-card bg-white p-4 shadow-card sm:p-6">
              <h3 className="mb-3 font-heading font-semibold text-text">Items</h3>
              <div className="divide-y divide-border text-sm">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-2">
                    <span className="text-text-light">{item.product} — {item.sku} <span className="text-text-muted">×{item.qty}</span></span>
                    <span className="font-medium">NPR {item.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between text-text-light"><span>Subtotal</span><span>NPR {order.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-text-light"><span>Delivery</span><span>{order.delivery === 0 ? <span className="text-success">Free</span> : `NPR ${order.delivery}`}</span></div>
                <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span className="text-forest-green">NPR {order.total.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="rounded-card bg-white p-4 shadow-card sm:p-6">
              <h3 className="mb-2 font-heading font-semibold text-text">Delivery</h3>
              <p className="text-sm text-text-light">{order.customer.name} — {order.customer.phone}</p>
              <p className="text-sm text-text-light">{order.customer.address}</p>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
