import { useState, useEffect, useMemo } from "react";
import { orderBy, collection, getDocs, query, where, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, deleteDoc, Timestamp } from "firebase/firestore";
import AdminLayout from "../components/AdminLayout";
import DataTable from "../components/DataTable";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { getDocument, addDocument, setDocument, updateDocument } from "../lib/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../hooks/useCollection";
import { useStaff } from "../hooks/useStaff";
import { downloadInvoice, previewInvoice, shareInvoiceWhatsApp } from "../utils/invoice";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import { earnLoyaltyPoints } from "../utils/loyalty";
import { postCouponRedemption } from "../utils/journalPosting";
import { combinePhone, parsePhone } from "../utils/phone";
import type { Invoice, StoreSettings } from "../types";

const tabs = ["All", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Reverted"];

const statusMeta: Record<string, { bg: string; dot: string }> = {
  pending:    { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  confirmed:  { bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-400" },
  processing: { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-400" },
  shipped:    { bg: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-400" },
  delivered:  { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  cancelled:  { bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-400" },
  returned:   { bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-400" },
  reverted:   { bg: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-500" },
};

const paymentBadges: Record<string, string> = {
  paid:     "bg-emerald-100 text-emerald-700",
  unpaid:   "bg-rose-100 text-rose-700",
  partial:  "bg-amber-100 text-amber-700",
  refunded: "bg-slate-100 text-slate-600",
};

const sourceBadge: Record<string, string> = {
  online: "bg-sky-100 text-sky-700",
  pos:    "bg-violet-100 text-violet-700",
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-xs transition-all hover:shadow-md hover:-translate-y-0.5">
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function fmts(ts?: { seconds: number }) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Invoices() {
  const { staff } = useStaff();
  const { data: invoices, loading } = useCollection<Invoice>("invoices", orderBy("createdAt", "desc"));
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [printPreview, setPrintPreview] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null);
  const [couponTarget, setCouponTarget] = useState<Invoice | null>(null);
  const [issueType, setIssueType] = useState<"percentage" | "fixed">("percentage");
  const [issueValue, setIssueValue] = useState(10);
  const [issueExpiryDays, setIssueExpiryDays] = useState(30);
  const [issueMinOrder, setIssueMinOrder] = useState(0);
  const [issueRecipientName, setIssueRecipientName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [detailModal, setDetailModal] = useState<Invoice | null>(null);

  useEffect(() => {
    getDocument<StoreSettings>("settings/store").then(setStore).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let list = invoices;
    if (tab !== "All") list = list.filter((o) => o.status === tab.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.invoiceNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q)
      );
    }
    return list;
  }, [invoices, tab, search]);

  const stats = useMemo(() => {
    const total = invoices.length;
    const totalRevenue = invoices.reduce((s, o) => s + o.grandTotal, 0);
    const paidCount = invoices.filter((o) => o.paymentStatus === "paid").length;
    const paidRevenue = invoices.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.grandTotal, 0);
    const unpaidCount = invoices.filter((o) => o.paymentStatus === "unpaid").length;
    const pendingOrders = invoices.filter((o) => o.status === "pending").length;
    return { total, totalRevenue, paidCount, paidRevenue, unpaidCount, pendingOrders };
  }, [invoices]);

  const tabCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tabs) {
      m[t] = t === "All" ? invoices.length : invoices.filter((o) => o.status === t.toLowerCase()).length;
    }
    return m;
  }, [invoices]);

  const handleMigrate = async () => {
    if (!confirm("Create invoices for existing orders and remove walk-in orders from Orders tab?")) return;
    setMigrating(true);
    setMigrateMsg(null);
    try {
      const ordersSnap = await getDocs(collection(db, "orders"));
      let created = 0, removed = 0;
      for (const orderDoc of ordersSnap.docs) {
        const o = orderDoc.data();
        const existing = await getDocs(query(collection(db, "invoices"), where("orderNumber", "==", o.orderNumber)));
        if (existing.empty) {
          await addDoc(collection(db, "invoices"), {
            invoiceNumber: o.orderNumber, orderNumber: o.orderNumber,
            customerName: o.customerName, customerPhone: o.customerPhone, customerEmail: o.customerEmail || "",
            shippingAddress: o.shippingAddress, deliveryNotes: o.deliveryNotes || "",
            items: (o.items || []).map((item: any) => ({ ...item, skuId: item.skuId || "" })),
            subtotal: o.subtotal, discount: o.discount, deliveryCharge: o.deliveryCharge, grandTotal: o.grandTotal,
            coupon: o.coupon || { code: null, type: null, discountAmount: 0, appliedBy: null, appliedByName: null },
            issuedCoupon: o.issuedCoupon || null, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus,
            paymentId: o.paymentId || null, paidAt: o.paidAt || null, paymentHistory: o.paymentHistory || [],
            status: o.status, statusHistory: o.statusHistory || [],
            deliveredAt: o.deliveredAt || null, returnedAt: o.returnedAt || null, notes: o.notes || "",
            source: o.createdBy && o.createdBy !== "customer" ? "pos" : "online", createdBy: o.createdBy || "customer",
            createdAt: o.createdAt || serverTimestamp(), updatedAt: o.updatedAt || serverTimestamp(),
          });
          created++;
        }
        if (o.createdBy && o.createdBy !== "customer") {
          await deleteDoc(doc(db, "orders", orderDoc.id));
          removed++;
        }
      }
      // Fix already-migrated invoices where source should be "pos" (staff-created orders)
      const invoicesSnap = await getDocs(query(collection(db, "invoices"), where("source", "==", "online")));
      let fixed = 0;
      for (const invDoc of invoicesSnap.docs) {
        const inv = invDoc.data();
        if (inv.createdBy && inv.createdBy !== "customer") {
          await setDocument(`invoices/${invDoc.id}`, { source: "pos" });
          fixed++;
        }
      }
      // Normalize phone numbers: ensure +977 prefix
      let phoneFixed = 0;
      for (const coll of ["invoices", "orders"]) {
        const snap = await getDocs(collection(db, coll));
        for (const doc_ of snap.docs) {
          const d = doc_.data() as any;
          const raw = d.customerPhone || "";
          if (raw && !raw.startsWith("+")) {
            const { number } = parsePhone(raw);
            const normalized = combinePhone("+977", number);
            await setDocument(`${coll}/${doc_.id}`, { customerPhone: normalized });
            phoneFixed++;
          }
        }
      }

      const parts = [];
      if (created > 0) parts.push(`Created ${created} invoices`);
      if (removed > 0) parts.push(`Removed ${removed} walk-in orders from Orders tab`);
      if (fixed > 0) parts.push(`Fixed ${fixed} invoices to Store source`);
      if (phoneFixed > 0) parts.push(`Normalized ${phoneFixed} phone numbers`);
      setMigrateMsg(parts.length > 0 ? parts.join(". ") + "." : "Nothing to migrate — all up to date.");
    } catch (err) {
      setMigrateMsg(`Migration failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally { setMigrating(false); }
  };

  const handleIssueCoupon = async () => {
    if (!staff || !couponTarget) return;
    setIssuing(true);
    try {
      const code = `REPURCHASE-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${couponTarget.invoiceNumber}`;
      const now = new Date();
      const validUntil = new Date(now.getTime() + issueExpiryDays * 24 * 60 * 60 * 1000);
      await addDocument("coupons", {
        code, type: issueType, value: issueValue, minOrderAmount: issueMinOrder,
        maxUses: 1, currentUses: 0, validFrom: now, validUntil,
        appliesTo: "all", applicableCategoryIds: [], applicableProductIds: [], applicableSkuIds: [],
        isActive: true, createdBy: staff.id,
        description: `Repurchase coupon${issueRecipientName ? " for " + issueRecipientName : ""} issued with invoice ${couponTarget.invoiceNumber}`,
      });
      const ic = {
        code, type: issueType, value: issueValue,
        validFrom: Timestamp.fromDate(now), validUntil: Timestamp.fromDate(validUntil),
        minOrderAmount: issueMinOrder,
        description: `Get ${issueType === "percentage" ? issueValue + "% off" : "NPR " + issueValue.toLocaleString() + " off"} on your next purchase${issueRecipientName ? ", " + issueRecipientName : ""}!`,
        issuedBy: staff.id, issuedByName: staff.name,
      };
      await setDocument(`invoices/${couponTarget.id}`, { issuedCoupon: ic });
      logActivity({ action: "Issue coupon", details: `Repurchase coupon ${code} issued with invoice ${couponTarget.invoiceNumber}`, module: "Coupons", staffId: staff.id, staffName: staff.name });
      setCouponTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to issue coupon");
    } finally { setIssuing(false); }
  };

  const handleDownload = async (doc: Invoice) => {
    if (!store) return;
    setDownloading(doc.id);
    try { await downloadInvoice(doc as any, store); } finally { setDownloading(null); }
  };

  const handlePreview = async (doc: Invoice) => {
    if (!store) return;
    try { setPrintPreview(await previewInvoice(doc as any, store)); } catch (e) { console.error("Preview failed:", e); }
  };

  const handleShare = async (doc: Invoice) => {
    if (!store) return;
    setSharing(doc.id);
    try { await shareInvoiceWhatsApp(doc as any, store); } finally { setSharing(null); }
  };

  const handleRecordPayment = async (o: Invoice) => {
    if (!staff) return;
    if (o.paymentStatus === "paid") return;
    if (!confirm(`Record payment for ${o.invoiceNumber} (NPR ${o.grandTotal.toLocaleString()})?`)) return;
    try {
      const now = Timestamp.now();
      const history = o.paymentHistory || [];
      await updateDocument(`invoices/${o.id}`, {
        paymentStatus: "paid",
        paidAt: now,
        paymentHistory: [...history, { method: o.paymentMethod as "cash" | "cod" | "bank", amount: o.grandTotal, receivedBy: staff.id, receivedByName: staff.name, receivedAt: now, note: "Payment recorded" }],
      });
      if (o.customerPhone) {
        earnLoyaltyPoints({ phone: o.customerPhone, name: o.customerName, grandTotal: o.grandTotal, referenceType: "invoice", referenceId: o.id, referenceNumber: o.invoiceNumber }).catch(() => {});
      }
      if (o.coupon?.discountAmount && o.coupon.discountAmount > 0) {
        postCouponRedemption(o.invoiceNumber, o.coupon.discountAmount, staff.id).catch(() => {});
      }
      logActivity({ action: "Record payment", details: `Payment recorded for ${o.invoiceNumber}`, module: "Invoices", staffId: staff.id, staffName: staff.name, relatedDocId: o.id });
      invalidateCache(["dashboard", "pnl"]);
      setDetailModal(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const handleRevert = async (o: Invoice) => {
    if (!staff) return;
    const created = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0;
    if (Date.now() - created > 24 * 60 * 60 * 1000) { alert("Invoice can only be reverted within 24 hours of creation."); return; }
    if (!confirm(`Revert invoice ${o.invoiceNumber}? This will mark it as reverted and restore stock.`)) return;
    try {
      for (const item of o.items) {
        if (!item.productId || !item.skuId) continue;
        const skuRef = doc(db, "products", item.productId, "skus", item.skuId);
        const skuSnap = await getDoc(skuRef);
        if (skuSnap.exists()) {
          await updateDoc(skuRef, { stock: increment(item.quantity) });
        }
      }

      if (o.loyaltyPointsEarned > 0 && o.customerPhone) {
        const { revertLoyaltyPoints } = await import("../utils/loyalty");
        revertLoyaltyPoints({ phone: o.customerPhone, points: o.loyaltyPointsEarned, referenceType: "invoice", referenceId: o.id, referenceNumber: o.invoiceNumber }).catch(() => {});
      }

      const history = o.statusHistory || [];
      const now = Timestamp.now();
      await updateDocument(`invoices/${o.id}`, {
        status: "reverted",
        statusHistory: [...history, { status: "reverted", changedBy: staff.id, changedByName: staff.name, timestamp: now, note: "Invoice reverted" }],
      });
      if (o.orderNumber) {
        const orderSnap = await getDocs(query(collection(db, "orders"), where("orderNumber", "==", o.orderNumber)));
        orderSnap.forEach((doc) => {
          updateDocument(`orders/${doc.id}`, {
            status: "reverted",
            statusHistory: [...(doc.data().statusHistory || []), { status: "reverted", changedBy: staff.id, changedByName: staff.name, timestamp: now, note: "Invoice reverted" }],
          });
        });
      }
      logActivity({ action: "Revert invoice", details: `Invoice ${o.invoiceNumber} reverted (stock restored)`, module: "Invoices", staffId: staff.id, staffName: staff.name, relatedDocId: o.id });
      invalidateCache(["dashboard", "pnl", "stock"]);
      setDetailModal(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revert invoice");
    }
  };

  const openDetail = (o: Invoice) => setDetailModal(o);

  /* ── Detail Modal ── */
  if (detailModal) {
    const o = detailModal;
    const sm = statusMeta[o.status] || { bg: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" };
    return (
      <AdminLayout>
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDetailModal(null)}>
          <div className="mt-8 w-full max-w-3xl animate-in slide-in-from-bottom-2 rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
            onClick={(e) => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-xl font-bold text-text tracking-tight">{o.invoiceNumber}</h2>
                  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${sourceBadge[o.source] || "bg-slate-100 text-slate-600"}`}>
                    {o.source === "online" ? "Online" : "Store"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-text-muted">{fmts(o.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium ${sm.bg}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} />
                  {o.status}
                </span>
                <button onClick={() => setDetailModal(null)}
                  className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-light-gray hover:text-text">
                  x
                </button>
              </div>
            </div>

            {/* ── Actions ── */}
            <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-4">
              <button onClick={() => handlePreview(o)} disabled={!store}
                className="rounded-xl border border-mustard-gold/40 px-3 py-1.5 text-xs font-semibold text-mustard-gold transition-all hover:bg-mustard-gold/10 hover:border-mustard-gold disabled:opacity-40">
                Preview
              </button>
              <button onClick={() => handleDownload(o)} disabled={!store || downloading === o.id}
                className="rounded-xl border border-blue-400/40 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-50 hover:border-blue-400 disabled:opacity-40">
                {downloading === o.id ? "..." : "Download PDF"}
              </button>
              <button onClick={() => handleShare(o)} disabled={!store || sharing === o.id}
                className="rounded-xl border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-50 hover:border-emerald-400 disabled:opacity-40">
                {sharing === o.id ? "..." : "Share"}
              </button>
              {(o.paymentStatus === "unpaid" || o.paymentStatus === "partial") && (
                <button onClick={() => handleRecordPayment(o)}
                  className="rounded-xl border border-forest-green/40 px-3 py-1.5 text-xs font-semibold text-forest-green transition-all hover:bg-forest-green/10 hover:border-forest-green">
                  Record Payment
                </button>
              )}
              {o.issuedCoupon ? (
                <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600">
                  Coupon Issued
                </span>
              ) : (
                <button onClick={() => { setCouponTarget(o); setIssueRecipientName(o.customerName); setDetailModal(null); }} disabled={issuing}
                  className="rounded-xl border border-mustard-gold/40 px-3 py-1.5 text-xs font-semibold text-mustard-gold transition-all hover:bg-mustard-gold/10 hover:border-mustard-gold disabled:opacity-40">
                  Issue Coupon
                </button>
              )}
              {!["cancelled", "returned", "reverted"].includes(o.status) && o.createdAt?.seconds && Date.now() - o.createdAt.seconds * 1000 < 24 * 60 * 60 * 1000 && (
                <button onClick={() => handleRevert(o)}
                  className="rounded-xl border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-50 hover:border-rose-400">
                  Revert Invoice
                </button>
              )}
            </div>

            {/* ── 3-column info ── */}
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {/* Customer */}
              <div className="rounded-xl border border-border bg-light-gray/30 p-4">
                <h4 className="mb-2 text-xs font-bold tracking-wide text-text-muted uppercase">Customer</h4>
                <div className="space-y-1 text-sm text-text">
                  <p><span className="font-medium">Name:</span> {o.customerName}</p>
                  <p><span className="font-medium">Phone:</span> {(() => { const p = parsePhone(o.customerPhone); return `${p.countryCode} ${p.number}`; })()}</p>
                  {o.customerEmail && <p><span className="font-medium">Email:</span> {o.customerEmail}</p>}
                  <p><span className="font-medium">Address:</span> {o.shippingAddress}</p>
                  {o.deliveryNotes && <p><span className="font-medium">Notes:</span> {o.deliveryNotes}</p>}
                </div>
              </div>

              {/* Items */}
              <div className="rounded-xl border border-border bg-light-gray/30 p-4">
                <h4 className="mb-2 text-xs font-bold tracking-wide text-text-muted uppercase">Items</h4>
                <div className="divide-y divide-border text-sm">
                  {o.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-1.5">
                      <span className="text-text-light">{item.productName} — {item.skuLabel} <span className="text-text-muted">x{item.quantity}</span></span>
                      <span className="font-medium">NPR {item.subtotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 space-y-1 border-t border-border pt-2 text-sm">
                  <div className="flex justify-between text-text-light"><span>Subtotal</span><span>NPR {o.subtotal.toLocaleString()}</span></div>
                  {o.discount > 0 && <div className="flex justify-between text-text-light"><span>Discount</span><span className="text-rose-600">-NPR {o.discount.toLocaleString()}</span></div>}
                  <div className="flex justify-between text-text-light"><span>Delivery</span><span>NPR {o.deliveryCharge.toLocaleString()}</span></div>
                  <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span className="text-forest-green">NPR {o.grandTotal.toLocaleString()}</span></div>
                </div>
              </div>

              {/* Payment */}
              <div className="rounded-xl border border-border bg-light-gray/30 p-4">
                <h4 className="mb-2 text-xs font-bold tracking-wide text-text-muted uppercase">Payment</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-text-light">Method</span><span className="font-medium capitalize">{o.paymentMethod}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-light">Status</span>
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${paymentBadges[o.paymentStatus] || "bg-slate-100 text-slate-600"}`}>
                      {o.paymentStatus}
                    </span>
                  </div>
                  {o.paymentHistory.length > 0 && (
                    <div className="border-t border-border pt-2">
                      <p className="mb-1 text-xs font-medium text-text-muted">History</p>
                      {o.paymentHistory.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs text-text-light">
                          <span className="capitalize">{p.method} — {fmts(p.receivedAt)}</span>
                          <span>NPR {p.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.issuedCoupon && (
                    <div className="border-t border-border pt-2">
                      <p className="text-xs font-medium text-violet-600">Coupon issued: {o.issuedCoupon.code}</p>
                    </div>
                  )}
                  {(o.loyaltyPointsEarned > 0 || o.loyaltyPointsRedeemed > 0) && (
                    <div className="border-t border-border pt-2">
                      {o.loyaltyPointsEarned > 0 && <p className="text-xs text-emerald-600">+{o.loyaltyPointsEarned} points earned</p>}
                      {o.loyaltyPointsRedeemed > 0 && <p className="text-xs text-rose-600">-{o.loyaltyPointsRedeemed} points redeemed</p>}
                      {o.loyaltyDiscount > 0 && <p className="text-xs text-text-light">Loyalty discount: -NPR {o.loyaltyDiscount.toLocaleString()}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Status Timeline ── */}
            {o.statusHistory.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-light-gray/30 p-4">
                <h4 className="mb-3 text-xs font-bold tracking-wide text-text-muted uppercase">Status Timeline</h4>
                <div className="space-y-2">
                  {o.statusHistory.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${i === o.statusHistory.length - 1 ? "bg-forest-green" : "bg-border"}`} />
                      <span className="text-xs text-text-muted">{fmts(h.timestamp)} {h.timestamp?.seconds ? new Date(h.timestamp.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      <span className="font-medium capitalize text-text">{h.status}</span>
                      <span className="text-xs text-text-muted">— {h.changedByName}</span>
                      {h.note && <span className="text-xs text-text-light">({h.note})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Close button ── */}
            <div className="mt-5 text-center">
              <button onClick={() => setDetailModal(null)}
                className="rounded-xl border border-border px-6 py-2 text-sm font-medium text-text-light transition-colors hover:border-forest-green hover:text-forest-green hover:bg-forest-green/5">
                Close
              </button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  /* ── Main List View ── */
  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-text tracking-tight">Invoices</h1>
            <p className="mt-0.5 text-sm text-text-muted">Manage, preview, download and share invoices</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleMigrate} disabled={migrating}
              className="rounded-xl border border-mustard-gold/50 px-4 py-2 text-xs font-semibold text-mustard-gold transition-all hover:bg-mustard-gold/10 hover:border-mustard-gold disabled:opacity-40">
              {migrating ? "Syncing..." : "Sync Orders"}
            </button>
            <div className="relative">
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-56 rounded-xl border border-border bg-white py-2 pl-3 pr-8 text-sm outline-none transition-all focus:border-forest-green focus:ring-2 focus:ring-forest-green/10"
                placeholder="Search invoices..." />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-muted hover:text-text">&times;</button>}
            </div>
          </div>
        </div>

        {migrateMsg && (
          <div className="mb-4 rounded-xl bg-info/10 px-4 py-3 text-sm text-info border border-info/20">
            {migrateMsg}
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total" value={stats.total.toLocaleString()} sub={`NPR ${stats.totalRevenue.toLocaleString()}`} color="text-text" />
          <StatCard label="Paid" value={stats.paidCount.toLocaleString()} sub={`NPR ${stats.paidRevenue.toLocaleString()}`} color="text-emerald-600" />
          <StatCard label="Unpaid" value={stats.unpaidCount.toLocaleString()} sub="Awaiting payment" color="text-rose-600" />
          <StatCard label="Pending" value={stats.pendingOrders.toLocaleString()} sub="Awaiting action" color="text-amber-600" />
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const active = tab === t;
            const count = tabCounts[t];
            if (count === 0 && !active) return null;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`group relative rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-forest-green text-white shadow-sm shadow-forest-green/30"
                    : "bg-white text-text-light border border-border hover:border-forest-green/40 hover:text-text hover:bg-forest-green/5"
                }`}>
                {t}
                <span className={`ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  active ? "bg-white/20 text-white" : "bg-light-gray text-text-muted"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <LoadingSkeleton type="table" />
        ) : (
          <DataTable
            columns={[
              {
                key: "invoice",
                header: "Invoice",
                render: (o: any) => (
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-semibold text-text">{o.invoiceNumber}</span>
                    {o.createdAt?.seconds && (
                      <span className="text-[10px] text-text-muted">{fmts(o.createdAt)}</span>
                    )}
                  </div>
                ),
                sortable: true,
              },
              {
                key: "customer",
                header: "Customer",
                render: (o: any) => (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-text">{o.customerName}</span>
                    <span className="text-xs text-text-muted">{o.customerPhone}</span>
                  </div>
                ),
              },
              {
                key: "source",
                header: "Source",
                render: (o: any) => (
                  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${sourceBadge[o.source] || "bg-slate-100 text-slate-600"}`}>
                    {o.source === "online" ? "Online" : "Store"}
                  </span>
                ),
              },
              {
                key: "total",
                header: "Amount",
                render: (o: any) => (
                  <span className="font-semibold text-text">NPR {o.grandTotal.toLocaleString()}</span>
                ),
                sortable: true,
              },
              {
                key: "status",
                header: "Status",
                render: (o: any) => {
                  const m = statusMeta[o.status] || { bg: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" };
                  return (
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-medium ${m.bg}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{o.status}
                    </span>
                  );
                },
              },
              {
                key: "payment",
                header: "Payment",
                render: (o: any) => (
                  <div className="flex flex-col gap-0.5">
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${paymentBadges[o.paymentStatus] || "bg-slate-100 text-slate-600"}`}>
                      {o.paymentStatus}
                    </span>
                    <span className="text-[10px] capitalize text-text-muted">{o.paymentMethod}</span>
                  </div>
                ),
              },
              {
                key: "actions",
                header: "",
                render: (o: any) => (
                  <div className="flex items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); handlePreview(o); }} disabled={!store}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-mustard-gold/15 text-sm text-mustard-gold transition-all hover:bg-mustard-gold/25 disabled:opacity-30"
                      title="Preview">&#x1F441;</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDownload(o); }} disabled={!store || downloading === o.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm text-blue-600 transition-all hover:bg-blue-200 disabled:opacity-30"
                      title="Download">{downloading === o.id ? <span className="text-[9px]">...</span> : "\u2B07"}</button>
                    <button onClick={(e) => { e.stopPropagation(); handleShare(o); }} disabled={!store || sharing === o.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm text-emerald-600 transition-all hover:bg-emerald-200 disabled:opacity-30"
                      title="Share">{sharing === o.id ? <span className="text-[9px]">...</span> : "\u2197"}</button>
                    {o.issuedCoupon ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600"
                        title="Coupon issued">&#x1F3AB;</span>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setCouponTarget(o); setIssueRecipientName(o.customerName); }} disabled={issuing}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-mustard-gold/15 text-sm text-mustard-gold transition-all hover:bg-mustard-gold/25 disabled:opacity-30"
                        title="Issue coupon">&#x1F3AB;</button>
                    )}
                  </div>
                ),
              },
            ]}
            data={filtered}
            keyExtractor={(o: any) => o.id}
            loading={false}
            emptyMessage="No invoices found"
            emptyIcon=""
            onRowClick={openDetail}
          />
        )}

        {printPreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => { setPrintPreview(null); URL.revokeObjectURL(printPreview); }}>
            <div className="max-h-[90vh] max-w-[90vw] overflow-auto rounded-2xl bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-text tracking-tight">Invoice Preview</h3>
                <button onClick={() => { setPrintPreview(null); URL.revokeObjectURL(printPreview); }}
                  className="rounded-lg px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-light-gray hover:text-text">Close</button>
              </div>
              <iframe src={printPreview} className="h-[80vh] w-[210mm] rounded-lg border border-border" title="Invoice Preview" />
            </div>
          </div>
        )}

        {couponTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => { if (!issuing) setCouponTarget(null); }}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-1 font-heading text-lg font-bold text-text tracking-tight">Issue Repurchase Coupon</h3>
              <p className="mb-5 text-sm text-text-muted">
                Invoice <span className="font-mono font-medium text-text">{couponTarget.invoiceNumber}</span> — {couponTarget.customerName}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-text uppercase tracking-wide">Discount Type</label>
                  <div className="flex gap-3">
                    {(["percentage", "fixed"] as const).map((t) => (
                      <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                        issueType === t ? "border-forest-green bg-forest-green/5 text-forest-green font-medium" : "border-border text-text-light hover:border-forest-green/40"
                      }`}>
                        <input type="radio" name="issueType" checked={issueType === t} onChange={() => setIssueType(t)} className="h-4 w-4 accent-forest-green" />
                        {t === "percentage" ? "% Percentage" : "Fixed NPR"}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text uppercase tracking-wide">Value</label>
                    <input type="number" value={issueValue} onChange={(e) => setIssueValue(Number(e.target.value))}
                      className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition-all focus:border-forest-green focus:ring-2 focus:ring-forest-green/10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text uppercase tracking-wide">Valid Days</label>
                    <input type="number" value={issueExpiryDays} onChange={(e) => setIssueExpiryDays(Number(e.target.value))}
                      className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition-all focus:border-forest-green focus:ring-2 focus:ring-forest-green/10" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text uppercase tracking-wide">Min Order (NPR)</label>
                  <input type="number" value={issueMinOrder} onChange={(e) => setIssueMinOrder(Number(e.target.value))}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition-all focus:border-forest-green focus:ring-2 focus:ring-forest-green/10" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text uppercase tracking-wide">Recipient Name</label>
                  <input value={issueRecipientName} onChange={(e) => setIssueRecipientName(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none transition-all focus:border-forest-green focus:ring-2 focus:ring-forest-green/10" placeholder="Customer name" />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setCouponTarget(null)} disabled={issuing}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-text-light transition-all hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40">Cancel</button>
                <button onClick={handleIssueCoupon} disabled={issuing}
                  className="flex-1 rounded-xl bg-forest-green py-2.5 text-sm font-bold text-white transition-all hover:bg-forest-green-dark shadow-sm shadow-forest-green/30 disabled:opacity-60">
                  {issuing ? "Issuing..." : "Issue Coupon"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
