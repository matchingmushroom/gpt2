"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCart } from "@/lib/cart";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, updateDoc, increment, arrayUnion, Timestamp, runTransaction } from "firebase/firestore";
import { getCurrentBSYear } from "@/utils/nepaliDate";
import { COUNTRY_CODES, DEFAULT_CODE, combinePhone, parsePhone } from "@/lib/phone";

interface PlacedOrder {
  id: string;
  orderNumber: string;
  date: string;
  customer: { name: string; phone: string; address: string; notes: string };
  items: { product: string; sku: string; qty: number; price: number; total: number }[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  status: string;
  location: "inside" | "outside";
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [form, setForm] = useState({ name: "", phone: "", countryCode: DEFAULT_CODE, address: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: string; value: number; discount: number; rolledValue: number } | null>(null);
  const [location, setLocation] = useState<"inside" | "outside">("inside");
  const [deliveryRates, setDeliveryRates] = useState<{ inside: number; outside: number; freeThreshold: number }>({ inside: 50, outside: 150, freeThreshold: 500 });
  const [paymentSettings, setPaymentSettings] = useState<{ esewa: { merchantId: string }; khalti: { publicKey: string } } | null>(null);
  const [qrMode, setQrMode] = useState<"image" | "generate">("image");

  useEffect(() => {
    getDoc(doc(db, "settings", "delivery")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        setDeliveryRates({
          inside: d.deliveryChargeInside ?? 50,
          outside: d.deliveryChargeOutside ?? 150,
          freeThreshold: d.freeDeliveryThreshold ?? 500,
        });
      }
    }).catch(() => {});
    getDoc(doc(db, "settings", "payments")).then((snap) => {
      if (snap.exists()) setPaymentSettings(snap.data() as any);
    }).catch(() => {});
  }, []);

  const baseDelivery = location === "inside" ? deliveryRates.inside : deliveryRates.outside;
  const delivery = subtotal >= deliveryRates.freeThreshold ? 0 : baseDelivery;
  const couponDiscount = appliedCoupon?.discount ?? 0;

  const comboMap = new Map<string, { name: string; totalItemPrice: number; comboPrice: number }>();
  for (const item of items) {
    if (item.comboId) {
      if (!comboMap.has(item.comboId)) {
        comboMap.set(item.comboId, { name: item.comboName || "", totalItemPrice: 0, comboPrice: 0 });
      }
      comboMap.get(item.comboId)!.totalItemPrice += item.price * item.quantity;
    }
  }
  const [comboPrices, setComboPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchComboPrices = async () => {
      const prices: Record<string, number> = {};
      for (const [comboId] of comboMap) {
        try {
          const snap = await getDoc(doc(db, "combos", comboId));
          if (snap.exists()) prices[comboId] = (snap.data() as any).price || 0;
        } catch {}
      }
      setComboPrices(prices);
    };
    if (comboMap.size > 0) fetchComboPrices();
  }, [items]);

  let comboSavings = 0;
  for (const [comboId, info] of comboMap) {
    const cp = comboPrices[comboId] || 0;
    if (cp > 0 && info.totalItemPrice > cp) {
      comboSavings += info.totalItemPrice - cp;
    }
  }

  const discount = couponDiscount + comboSavings;
  const total = subtotal - discount + delivery;

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponMsg(null);
    try {
      const q = query(collection(db, "coupons"), where("code", "==", code));
      const snap = await getDocs(q);
      if (snap.empty) { setCouponMsg({ text: "Invalid coupon code", type: "error" }); return; }
      const c = snap.docs[0].data() as any;
      if (!c.isActive) { setCouponMsg({ text: "This coupon is no longer active", type: "error" }); return; }
      const now = Date.now();
      if (c.validFrom?.seconds && now < c.validFrom.seconds * 1000) { setCouponMsg({ text: "Coupon not yet valid", type: "error" }); return; }
      if (c.validUntil?.seconds && now > c.validUntil.seconds * 1000) { setCouponMsg({ text: "Coupon has expired", type: "error" }); return; }
      if (c.minOrderAmount && subtotal < c.minOrderAmount) { setCouponMsg({ text: `Minimum order NPR ${c.minOrderAmount.toLocaleString()} required`, type: "error" }); return; }
      if (c.maxUses && c.currentUses >= c.maxUses) { setCouponMsg({ text: "Coupon usage limit reached", type: "error" }); return; }
      if (c.appliesTo === "category" && c.applicableCategoryIds?.length > 0) {
        const catIds = await Promise.all(
          items.map(async (item) => {
            try {
              const snap = await getDoc(doc(db, "products", item.productId));
              return snap.exists() ? (snap.data() as any).categoryIds || [] : [];
            } catch { return []; }
          })
        );
        const matched = catIds.some((ids) => ids.some((id: string) => c.applicableCategoryIds.includes(id)));
        if (!matched) { setCouponMsg({ text: "Coupon not applicable to items in your cart", type: "error" }); return; }
      }
      if (c.appliesTo === "product" && c.applicableProductIds?.length > 0) {
        const matched = items.some((item) => c.applicableProductIds.includes(item.productId));
        if (!matched) { setCouponMsg({ text: "Coupon not applicable to items in your cart", type: "error" }); return; }
      }
      let disc = 0;
      let rolledValue = 0;
      if (c.type === "percentage") disc = Math.round(subtotal * c.value / 100);
      else if (c.type === "fixed") disc = c.value;
      else if (c.type === "full_discount") disc = subtotal;
      else if (c.type === "variable_percentage") {
        const min = Math.max(1, c.minValue || 5);
        const max = Math.max(min, c.maxValue || c.value || 5);
        rolledValue = Math.floor(Math.random() * (max - min + 1)) + min;
        disc = Math.round(subtotal * rolledValue / 100);
      } else if (c.type === "variable_fixed") {
        const min = Math.max(1, c.minValue || 10);
        const max = Math.max(min, c.maxValue || c.value || 10);
        rolledValue = Math.floor(Math.random() * (max - min + 1)) + min;
        disc = rolledValue;
      }
      if (disc > subtotal) disc = subtotal;
      setAppliedCoupon({ code, type: c.type, value: c.value, discount: disc, rolledValue });
      setCouponMsg({ text: `Coupon applied! You save NPR ${disc.toLocaleString()}`, type: "success" });
    } catch { setCouponMsg({ text: "Failed to validate coupon", type: "error" }); }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponMsg(null);
    setCouponCode("");
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.phone.trim()) errs.phone = "Phone is required";
    else { const d = form.phone.replace(/\D/g, ""); if (d.length !== 10) errs.phone = "Enter a valid 10-digit mobile number"; }
    if (!form.address.trim()) errs.address = "Address is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const ts = Date.now();
    const bsYear = getCurrentBSYear();
    const orderNumber = `${bsYear}${ts}`;
    const orderItems = items.map((i) => ({
      productId: i.productId,
      skuId: i.skuId || "",
      productName: i.productName,
      skuLabel: i.skuLabel,
      quantity: i.quantity,
      unitPrice: i.price,
      subtotal: i.price * i.quantity,
      comboId: i.comboId || null,
      comboName: i.comboName || null,
    }));

    const orderData = {
      orderNumber,
      customerName: form.name.trim(),
      customerPhone: combinePhone(form.countryCode, form.phone),
      customerEmail: "",
      shippingAddress: form.address.trim(),
      deliveryNotes: form.notes.trim(),
      deliveryLocation: location === "inside" ? "Inside Valley" : "Outside Valley",
      items: orderItems,
      subtotal,
      discount,
      comboDiscount: comboSavings,
      deliveryCharge: delivery,
      grandTotal: total,
      coupon: appliedCoupon ? { code: appliedCoupon.code, type: appliedCoupon.type, discountAmount: couponDiscount, appliedBy: "customer", appliedByName: form.name.trim() } : { code: null, type: null, discountAmount: 0, appliedBy: null, appliedByName: null },
      issuedCoupon: null,
      paymentMethod,
      paymentStatus: "unpaid",
      paymentId: null,
      paidAt: null,
      paymentHistory: [],
      status: "pending",
      statusHistory: [{ status: "pending", changedBy: "customer", changedByName: form.name.trim(), timestamp: new Date(), note: "Order placed online" }],
      deliveredAt: null,
      returnedAt: null,
      returnReason: null,
      deliveryPartner: null,
      trackingUrl: null,
      notes: "",
      createdBy: "customer",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (appliedCoupon) {
        const q = query(collection(db, "coupons"), where("code", "==", appliedCoupon.code));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, {
            currentUses: increment(1),
            totalDiscountGiven: increment(couponDiscount),
            usageHistory: arrayUnion({ orderNumber, discountApplied: couponDiscount, subtotalAtUse: subtotal, rolledValue: appliedCoupon.rolledValue, usedAt: Timestamp.now() }),
          });
        }
      }

      await runTransaction(db, async (transaction) => {
        for (const item of orderItems) {
          if (!item.productId) continue;
          const prodRef = doc(db, "products", item.productId);
          const snap = await transaction.get(prodRef);
          if (!snap.exists()) continue;
          const data = snap.data() as any;
          const skus = data.skus || [];
          let skuIdx = -1;
          if (item.skuId) {
            skuIdx = skus.findIndex((s: any) => s.id === item.skuId);
          }
          if (skuIdx < 0) {
            const cartItem = items.find((ci) => ci.productId === item.productId);
            if (cartItem) skuIdx = Math.min(cartItem.skuIndex, skus.length - 1);
          }
          if (skuIdx < 0) continue;
          const currentStock = skus[skuIdx].stock ?? 0;
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.productName} (${skus[skuIdx].label})`);
          }
          transaction.update(prodRef, { [`skus.${skuIdx}.stock`]: currentStock - item.quantity });
        }
      });

      const orderRef = await addDoc(collection(db, "orders"), orderData);

      await addDoc(collection(db, "invoices"), {
        invoiceNumber: orderNumber,
        orderNumber,
        customerName: form.name.trim(),
      customerPhone: combinePhone(form.countryCode, form.phone),
        customerEmail: "",
        shippingAddress: form.address.trim(),
        deliveryNotes: form.notes.trim(),
        items: orderItems,
        subtotal,
        discount,
        comboDiscount: comboSavings,
        deliveryCharge: delivery,
        grandTotal: total,
        coupon: appliedCoupon
          ? { code: appliedCoupon.code, type: appliedCoupon.type, discountAmount: couponDiscount, appliedBy: "customer", appliedByName: form.name.trim() }
          : { code: null, type: null, discountAmount: 0, appliedBy: null, appliedByName: null },
        issuedCoupon: null,
        paymentMethod,
        paymentStatus: "unpaid",
        paymentId: null,
        paidAt: null,
        paymentHistory: [],
        status: "pending",
        statusHistory: [{ status: "pending", changedBy: "customer", changedByName: form.name.trim(), timestamp: new Date(), note: "Order placed online" }],
        deliveredAt: null,
        returnedAt: null,
        notes: "",
        source: "online",
        createdBy: "customer",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to place order:", err);
      setSubmitting(false);
      setErrors({ form: err instanceof Error ? err.message : "Failed to place order. Please try again." });
      return;
    }

    const newOrder: PlacedOrder = {
      id: orderNumber,
      orderNumber,
      date: new Date().toISOString(),
      customer: form,
      items: items.map((i) => ({ product: i.productName, sku: i.skuLabel, qty: i.quantity, price: i.price, total: i.price * i.quantity })),
      subtotal,
      delivery,
      discount,
      total,
      status: "Pending",
      location,
    };

    const existing = JSON.parse(localStorage.getItem("gpt-orders") || "[]");
    existing.unshift(newOrder);
    localStorage.setItem("gpt-orders", JSON.stringify(existing));
    clearCart();
    setOrder(newOrder);
  };

  if (order) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-card bg-white p-6 text-center shadow-card sm:p-8">
            <p className="text-5xl">🎉</p>
            <h1 className="mt-4 font-heading text-2xl font-bold text-text">Order Placed!</h1>
            <p className="mt-2 text-text-light">Thank you, {order.customer.name}.</p>
            <div className="mx-auto mt-2 inline-block rounded-full bg-beige px-4 py-1">
              <span className="font-mono text-sm font-semibold text-forest-green">{order.orderNumber}</span>
            </div>
          </div>

          {(paymentMethod === "esewa" || paymentMethod === "khalti") && (
            <div className="mt-6 rounded-card border-2 border-dashed border-mustard-gold bg-mustard-gold/5 p-4 text-center shadow-card sm:p-6">
              <p className="mb-3 text-3xl">{paymentMethod === "esewa" ? "📱" : "📱"}</p>
              <h2 className="font-heading text-lg font-bold text-text">Complete Your Payment</h2>
              <p className="mt-1 text-sm text-text-light">
                Send <strong className="text-forest-green">NPR {order.total.toLocaleString()}</strong> to the {paymentMethod === "esewa" ? "eSewa" : "Khalti"} account below
              </p>
              <p className="text-sm text-text-light">
                and mention order <strong className="text-forest-green">{order.orderNumber}</strong> in the remarks.
              </p>
              {qrMode === "image" ? (
                <img
                  src={paymentMethod === "esewa" ? "/images/esewa-qr.png" : "/images/khalti-qr.png"}
                  alt={`${paymentMethod === "esewa" ? "eSewa" : "Khalti"} QR`}
                  className="mx-auto my-4 h-44 w-44 rounded-lg border border-border bg-white object-contain p-2"
                  onError={() => setQrMode("generate")}
                />
              ) : (
                <div className="mx-auto my-4 flex h-44 w-44 items-center justify-center rounded-lg border border-border bg-white p-2">
                  <QRCodeSVG
                    value={paymentMethod === "esewa"
                      ? (paymentSettings?.esewa?.merchantId || "9851234567")
                      : (paymentSettings?.khalti?.publicKey || "9801234567")}
                    size={160}
                    level="M"
                  />
                </div>
              )}
              <div className="inline-block rounded-lg bg-white px-5 py-2 shadow-sm">
                <p className="text-xs text-text-muted">{paymentMethod === "esewa" ? "eSewa ID" : "Khalti ID"}</p>
                <p className="font-mono text-sm font-bold text-forest-green">{paymentMethod === "esewa"
                  ? (paymentSettings?.esewa?.merchantId || "9851234567")
                  : (paymentSettings?.khalti?.publicKey || "9801234567")}</p>
              </div>
              <p className="mt-4 text-xs text-text-muted">
                Your order will be confirmed after payment verification. This usually takes a few minutes.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-card bg-white p-4 shadow-card sm:mt-6 sm:p-6">
            <h2 className="mb-3 font-heading text-base font-semibold text-text sm:text-lg">Delivery Details</h2>
            <div className="space-y-1 text-sm text-text-light">
              <p><span className="font-medium text-text">Name:</span> {order.customer.name}</p>
              <p><span className="font-medium text-text">Phone:</span> {order.customer.phone}</p>
              <p><span className="font-medium text-text">Address:</span> {order.customer.address}</p>
              {order.customer.notes && <p><span className="font-medium text-text">Notes:</span> {order.customer.notes}</p>}
            </div>
          </div>
          <div className="mt-4 rounded-card bg-white p-4 shadow-card sm:p-6">
            <h2 className="mb-3 font-heading text-base font-semibold text-text sm:text-lg">Order Summary</h2>
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between py-1 text-sm">
                <span className="text-text-light">{item.product} — {item.sku} <span className="text-text-muted">×{item.qty}</span></span>
                <span className="font-medium">NPR {item.total.toLocaleString()}</span>
              </div>
            ))}
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-text-light"><span>Subtotal</span><span>NPR {order.subtotal.toLocaleString()}</span></div>
              {discount > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>−NPR {discount.toLocaleString()}</span></div>}
              <div className="flex justify-between text-text-light"><span>Delivery ({order.location === "outside" ? "Outside Valley" : "Inside Valley"})</span><span>{order.delivery === 0 ? <span className="text-success">Free</span> : `NPR ${order.delivery}`}</span></div>
              <div className="flex justify-between pt-1 text-lg font-bold"><span>Total</span><span className="text-forest-green">NPR {order.total.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Link href="/" className="inline-block rounded-btn bg-forest-green px-8 py-2.5 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">Continue Shopping</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="text-5xl">🛒</p>
          <p className="mt-4 text-text-light">Your cart is empty</p>
          <Link href="/#products" className="mt-4 inline-block rounded-btn bg-forest-green px-6 py-2 text-sm font-medium text-white">Browse Products</Link>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-8 font-heading text-2xl font-bold text-text">Checkout</h1>

        <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <section className="rounded-card bg-white p-4 shadow-card sm:p-6">
              <h2 className="mb-4 font-heading text-base font-semibold text-text sm:text-lg">Contact & Delivery</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Full Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-input border border-border px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-forest-green" placeholder="Your name" />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Phone *</label>
                  <div className="flex gap-2">
                    <select value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} className="w-28 shrink-0 rounded-input border border-border px-2 py-2.5 text-sm text-text outline-none transition-colors focus:border-forest-green">
                      {COUNTRY_CODES.map((cc) => (
                        <option key={cc.code} value={cc.code}>{cc.label}</option>
                      ))}
                    </select>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="flex-1 rounded-input border border-border px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-forest-green" placeholder="98XXXXXXXX" />
                  </div>
                  {errors.phone && <p className="mt-1 text-xs text-error">{errors.phone}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Location *</label>
                  <div className="flex gap-3">
                    {[{ value: "inside" as const, label: "Inside Valley" }, { value: "outside" as const, label: "Outside Valley" }].map((opt) => (
                      <label key={opt.value} className={`flex cursor-pointer items-center gap-2 rounded-btn border px-4 py-2.5 text-sm transition-colors ${location === opt.value ? "border-forest-green bg-forest-green/5 text-forest-green font-medium" : "border-border text-text-light hover:border-forest-green"}`}>
                        <input type="radio" name="location" value={opt.value} checked={location === opt.value} onChange={() => setLocation(opt.value)} className="h-4 w-4 accent-forest-green" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Delivery Address *</label>
                  <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-input border border-border px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-forest-green" rows={3} placeholder="Street, city, area..." />
                  {errors.address && <p className="mt-1 text-xs text-error">{errors.address}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Order Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-input border border-border px-4 py-2.5 text-sm text-text outline-none transition-colors focus:border-forest-green" rows={2} placeholder="Any special instructions..." />
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-card bg-white p-4 shadow-card sm:p-6">
              <h2 className="mb-4 font-heading text-base font-semibold text-text sm:text-lg">Order Summary</h2>
              <div className="space-y-3 divide-y divide-border text-sm">
                <div className="space-y-2 pb-3">
                  {items.map((item) => (
                    <div key={`${item.productId}-${item.skuIndex}`} className="flex justify-between">
                      <span className="text-text-light">{item.productName} <span className="text-text-muted">×{item.quantity}</span></span>
                      <span className="font-medium">NPR {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-3">
                  <div className="flex justify-between text-text-light">
                    <span>Subtotal</span>
                    <span>NPR {subtotal.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>−NPR {discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-text-light">
                    <span>Delivery</span>
                    <span>{delivery === 0 ? <span className="text-success">Free</span> : `NPR ${delivery}`}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-lg font-bold">
                    <span>Total</span>
                    <span className="text-forest-green">NPR {total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-text">Coupon Code</h3>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between rounded-btn bg-success/10 px-3 py-2 text-sm">
                      <span className="font-medium text-success">{appliedCoupon.code}</span>
                      <button onClick={removeCoupon} className="text-xs text-error hover:underline">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter code" className="flex-1 rounded-input border border-border px-3 py-2 text-sm outline-none transition-colors focus:border-forest-green" />
                      <button onClick={applyCoupon} type="button" className="rounded-btn bg-forest-green px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-forest-green-dark">Apply</button>
                    </div>
                  )}
                  {couponMsg && <p className={`mt-1 text-xs ${couponMsg.type === "success" ? "text-success" : "text-error"}`}>{couponMsg.text}</p>}
                </div>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-3 text-sm font-semibold text-text">Payment Method</h3>
                <div className="space-y-2">
                  {[
                    { value: "cod", label: "Cash on Delivery", icon: "💵" },
                    { value: "esewa", label: "eSewa", icon: "📱" },
                    { value: "khalti", label: "Khalti", icon: "📱" },
                  ].map((opt) => (
                    <label key={opt.value} className={`flex cursor-pointer items-center gap-3 rounded-btn border px-4 py-3 text-sm transition-colors ${paymentMethod === opt.value ? "border-forest-green bg-forest-green/5" : "border-border hover:border-forest-green"}`}>
                      <input type="radio" name="payment" value={opt.value} checked={paymentMethod === opt.value} onChange={(e) => setPaymentMethod(e.target.value)} className="h-4 w-4 accent-forest-green" />
                      <span className="text-lg">{opt.icon}</span>
                      <span className="font-medium text-text">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {paymentMethod === "esewa" && <p className="mt-2 text-xs text-text-muted">You will pay via eSewa after placing the order.</p>}
                {paymentMethod === "khalti" && <p className="mt-2 text-xs text-text-muted">You will pay via Khalti after placing the order.</p>}
              </div>
              <button type="submit" disabled={submitting} className="mt-4 w-full rounded-btn bg-forest-green py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">
                {submitting ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}
