import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, getDocument, listenCollection, getCollection } from "../lib/firestore";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, getDoc, Timestamp, updateDoc, increment, arrayUnion, runTransaction, doc } from "firebase/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import { getNextCounter } from "../utils/counters";
import { deductStock } from "../utils/deductStock";
import { earnLoyaltyPoints, deductLoyaltyPoints } from "../utils/loyalty";
import { postCouponRedemption } from "../utils/journalPosting";
import { COUNTRY_CODES, DEFAULT_CODE, combinePhone, parsePhone } from "../utils/phone";
import type { Product, SKU, Invoice, StoreSettings, Combo, Category } from "../types";

interface CartItem {
  productId: string;
  skuId: string;
  productName: string;
  skuLabel: string;
  unitPrice: number;
  quantity: number;
}

export default function POS() {
  const { staff, can } = useStaff();
  const { data: products } = useCollection<Product>("products");
  const { data: allCategories } = useCollection<Category>("categories");
  const { data: combos } = useCollection<Combo>("combos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<"products" | "combos">("products");
  const [saving, setSaving] = useState(false);
  const [skus, setSkus] = useState<Record<string, SKU[]>>({});
  const [saleMsg, setSaleMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [lastOrder, setLastOrder] = useState<Invoice | null>(null);
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [isWalkin, setIsWalkin] = useState(true);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custCountryCode, setCustCountryCode] = useState(DEFAULT_CODE);
  const [custAddress, setCustAddress] = useState("In-store");
  const [phoneErr, setPhoneErr] = useState("");

  // issue coupon state
  const [showIssueCoupon, setShowIssueCoupon] = useState(false);
  const [issueType, setIssueType] = useState<"percentage" | "fixed">("percentage");
  const [issueValue, setIssueValue] = useState(10);
  const [issueExpiryDays, setIssueExpiryDays] = useState(30);
  const [issueMinOrder, setIssueMinOrder] = useState(0);
  const [issueRecipientName, setIssueRecipientName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  useEffect(() => {
    getDocument<StoreSettings>("settings/store").then(setStore).catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      const map: Record<string, SKU[]> = {};
      for (const p of products) {
        if (!p.isActive) continue;
        try {
          map[p.id] = await getCollection<SKU>(`products/${p.id}/skus`);
        } catch { map[p.id] = []; }
      }
      setSkus(map);
    };
    if (products.length > 0) load();
  }, [products]);

  const addToCart = (productId: string, skuId: string, productName: string, skuLabel: string, price: number) => {
    setLastOrder(null);
    setSaleMsg(null);
    setShowIssueCoupon(false);
    setIssuedCode(null);
    const existing = cart.find((c) => c.skuId === skuId && c.productId === productId);
    if (existing) {
      setCart(cart.map((c) => c.skuId === skuId && c.productId === productId ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId, skuId, productName, skuLabel, unitPrice: price, quantity: 1 }]);
    }
  };

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: string; value: number; discount: number; rolledValue: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [loyaltyAcc, setLoyaltyAcc] = useState<{ phone: string; name: string; pointsBalance: number; totalEarned: number; totalRedeemed: number } | null>(null);
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(0);
  const [loyaltyRedeemMax, setLoyaltyRedeemMax] = useState(0);
  const [loyaltyRate, setLoyaltyRate] = useState(1);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyMsg, setLoyaltyMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const couponDiscount = appliedCoupon?.discount ?? 0;

  const comboSkuMap = new Map<string, { productId: string; name: string; price: number }>();
  for (const combo of combos.filter((c) => c.isActive)) {
    for (const item of combo.items) {
      comboSkuMap.set(item.skuId, { productId: item.productId, name: combo.name, price: combo.price });
    }
  }
  let comboSavings = 0;
  const comboGroups = new Map<string, { items: CartItem[]; comboPrice: number }>();
  for (const c of cart) {
    const comboInfo = comboSkuMap.get(c.skuId);
    if (comboInfo) {
      if (!comboGroups.has(comboInfo.name)) {
        comboGroups.set(comboInfo.name, { items: [], comboPrice: comboInfo.price });
      }
      comboGroups.get(comboInfo.name)!.items.push(c);
    }
  }
  for (const [, group] of comboGroups) {
    const itemSum = group.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    if (itemSum > group.comboPrice) comboSavings += itemSum - group.comboPrice;
  }

  const discount = couponDiscount + comboSavings + loyaltyDiscount;
  const grandTotal = Math.max(0, subtotal - discount);

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponMsg(null);
    try {
      const q = query(collection(db, "coupons"), where("code", "==", code));
      const snap = await getDocs(q);
      if (snap.empty) { setCouponMsg({ text: "Invalid coupon code", type: "error" }); return; }
      const c = snap.docs[0].data() as any;
      if (!c.isActive) { setCouponMsg({ text: "Coupon no longer active", type: "error" }); return; }
      const now = Date.now();
      if (c.validFrom?.seconds && now < c.validFrom.seconds * 1000) { setCouponMsg({ text: "Coupon not yet valid", type: "error" }); return; }
      if (c.validUntil?.seconds && now > c.validUntil.seconds * 1000) { setCouponMsg({ text: "Coupon expired", type: "error" }); return; }
      if (c.minOrderAmount && subtotal < c.minOrderAmount) { setCouponMsg({ text: `Minimum NPR ${c.minOrderAmount.toLocaleString()} required`, type: "error" }); return; }
      if (c.maxUses && c.currentUses >= c.maxUses) { setCouponMsg({ text: "Usage limit reached", type: "error" }); return; }
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
      setCouponMsg({ text: `Coupon applied! -NPR ${disc.toLocaleString()}`, type: "success" });
    } catch { setCouponMsg({ text: "Failed to validate coupon", type: "error" }); }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponMsg(null);
    setCouponCode("");
  };

  const lookupLoyalty = async () => {
    setLoyaltyMsg(null);
    setShowLoyalty(true);
    setLoyaltyRedeemPoints(0);
    setLoyaltyDiscount(0);
    const phone = combinePhone(custCountryCode, custPhone);
    const docRef = doc(db, "loyaltyAccounts", phone);
    let acc: { phone: string; name: string; pointsBalance: number; totalEarned: number; totalRedeemed: number } | null = null;
    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        setLoyaltyMsg({ text: "No loyalty points found for this number", type: "error" });
        setLoyaltyAcc(null);
        return;
      }
      const data = snap.data() as any;
      acc = { phone: data.phone, name: data.name, pointsBalance: data.pointsBalance || 0, totalEarned: data.totalEarned || 0, totalRedeemed: data.totalRedeemed || 0 };
      if (acc.pointsBalance <= 0) {
        setLoyaltyMsg({ text: "No loyalty points found for this number", type: "error" });
        setLoyaltyAcc(null);
        return;
      }
      setLoyaltyAcc(acc);
    } catch (e) {
      setLoyaltyMsg({ text: "Failed to check loyalty account", type: "error" });
      console.error("loyalty lookup error:", e);
      return;
    }
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "loyalty"));
      let rate = 1, maxPct = 100;
      if (settingsDoc.exists()) {
        const sd = settingsDoc.data() as any;
        rate = sd.redemptionRate || 1;
        maxPct = sd.maxRedemptionPercent || 100;
      }
      setLoyaltyRate(rate);
      const maxByBalance = acc.pointsBalance;
      const maxByPercent = Math.floor(grandTotal * (maxPct / 100) / rate);
      const maxPoints = Math.min(maxByBalance, maxByPercent);
      if (maxPoints <= 0) {
        setLoyaltyMsg({ text: "No points available to redeem on this order", type: "error" });
        return;
      }
      setLoyaltyRedeemMax(maxPoints);
    } catch {
      setLoyaltyMsg({ text: "Failed to load loyalty settings", type: "error" });
    }
  };

  const applyLoyaltyRedemption = () => {
    const pts = loyaltyRedeemPoints;
    if (pts < 100) { setLoyaltyMsg({ text: "Minimum 100 points required", type: "error" }); return; }
    if (pts > loyaltyRedeemMax) { setLoyaltyMsg({ text: `Max ${loyaltyRedeemMax} points can be redeemed`, type: "error" }); return; }
    const disc = pts * loyaltyRate;
    const payable = grandTotal - couponDiscount - comboSavings;
    if (disc > payable) {
      setLoyaltyMsg({ text: "Discount exceeds payable amount", type: "error" });
      return;
    }
    setLoyaltyDiscount(disc);
    setLoyaltyMsg({ text: `-NPR ${disc.toLocaleString()} from ${pts} points`, type: "success" });
  };

  const removeLoyalty = () => {
    setLoyaltyDiscount(0);
    setLoyaltyRedeemPoints(0);
    setLoyaltyMsg(null);
    setShowLoyalty(false);
    setLoyaltyAcc(null);
  };

  const handleIssueCoupon = async () => {
    if (!staff || !lastOrder) return;
    setIssuing(true);
    try {
      const code = `REPURCHASE-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${lastOrder.invoiceNumber}`;
      const now = new Date();
      const validUntil = new Date(now.getTime() + issueExpiryDays * 24 * 60 * 60 * 1000);
      const couponData = {
        code,
        type: issueType,
        value: issueValue,
        minOrderAmount: issueMinOrder,
        maxUses: 1,
        currentUses: 0,
        validFrom: now,
        validUntil,
        appliesTo: "all" as const,
        applicableCategoryIds: [],
        applicableProductIds: [],
        applicableSkuIds: [],
        isActive: true,
        createdBy: staff.id,
        description: `Repurchase coupon${issueRecipientName ? " for " + issueRecipientName : ""} issued with invoice ${lastOrder.invoiceNumber}`,
      };
      await addDocument("coupons", couponData);
      const issuedCoupon = {
        code,
        type: issueType,
        value: issueValue,
        validFrom: Timestamp.fromDate(now),
        validUntil: Timestamp.fromDate(validUntil),
        minOrderAmount: issueMinOrder,
        description: `Get ${issueType === "percentage" ? issueValue + "% off" : "NPR " + issueValue.toLocaleString() + " off"} on your next purchase${issueRecipientName ? ", " + issueRecipientName : ""}!`,
        issuedBy: staff.id,
        issuedByName: staff.name,
      };
      await setDocument(`invoices/${lastOrder.id}`, { issuedCoupon });
      logActivity({ action: "Issue coupon", details: `Repurchase coupon ${code} issued with invoice ${lastOrder.invoiceNumber}`, module: "Coupons", staffId: staff.id, staffName: staff.name });
      setLastOrder({ ...lastOrder, issuedCoupon });
      setIssuedCode(code);
      setShowIssueCoupon(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to issue coupon");
    } finally { setIssuing(false); }
  };

  const handlePay = async () => {
    if (!staff || !can("orders.write") || cart.length === 0) return;
    if (!isWalkin && custPhone.replace(/\D/g, "").length !== 10) { setPhoneErr("Enter a valid 10-digit mobile number"); return; }
    setPhoneErr("");
    setSaving(true);
    setSaleMsg(null);
    setLastOrder(null);
    try {
      const invoiceNumber = await getNextCounter("invoices");
      const items = cart.map((c) => {
        const comboInfo = comboSkuMap.get(c.skuId);
        return {
          productId: c.productId, skuId: c.skuId, productName: c.productName, skuLabel: c.skuLabel,
          quantity: c.quantity, unitPrice: c.unitPrice, subtotal: c.unitPrice * c.quantity,
          comboId: comboInfo ? c.skuId : null, comboName: comboInfo ? comboInfo.name : null,
        };
      });
      const now = Timestamp.now();

      const stockResult = await deductStock(cart.map((c) => ({ productId: c.productId, skuId: c.skuId, quantity: c.quantity })));
      if (!stockResult.ok) {
        setSaleMsg({ text: `Stock insufficient: ${stockResult.errors.map((e) => `${e.skuLabel} (have ${e.available}, need ${e.requested})`).join(", ")}`, type: "error" });
        setSaving(false);
        return;
      }

      if (appliedCoupon) {
        const q = query(collection(db, "coupons"), where("code", "==", appliedCoupon.code));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, {
            currentUses: increment(1),
            totalDiscountGiven: increment(couponDiscount),
            usageHistory: arrayUnion({ orderNumber: invoiceNumber, discountApplied: couponDiscount, subtotalAtUse: subtotal, rolledValue: appliedCoupon.rolledValue, usedAt: Timestamp.now() }),
          });
        }
      }

      const invoiceId = await addDocument("invoices", {
        invoiceNumber, orderNumber: invoiceNumber,
        customerName: isWalkin ? "Walk-in" : custName, customerPhone: combinePhone(custCountryCode, custPhone), customerEmail: "", shippingAddress: isWalkin ? "In-store" : custAddress,
        deliveryNotes: "", items, subtotal, discount, comboDiscount: comboSavings, deliveryCharge: 0, grandTotal,
        coupon: appliedCoupon ? { code: appliedCoupon.code, type: appliedCoupon.type, discountAmount: couponDiscount, appliedBy: staff.id, appliedByName: staff.name } : { code: null, type: null, discountAmount: 0, appliedBy: null, appliedByName: null },
        issuedCoupon: null, paymentMethod: "cash", paymentStatus: "paid", paymentId: null, paidAt: now,
        paymentHistory: [{ method: "cash" as const, amount: grandTotal, receivedBy: staff.id, receivedByName: staff.name, receivedAt: now, note: "POS sale" }],
        status: "delivered", statusHistory: [{ status: "delivered", changedBy: staff.id, changedByName: staff.name, timestamp: now, note: "POS sale" }],
        deliveredAt: now, returnedAt: null, notes: "", source: "pos", createdBy: staff.id,
        loyaltyPointsEarned: 0, loyaltyPointsRedeemed: loyaltyRedeemPoints || 0, loyaltyDiscount: loyaltyDiscount || 0,
      });
      logActivity({ action: "POS sale", details: `POS sale — ${cart.length} items, NPR ${grandTotal}${discount > 0 ? ` (discount: ${discount})` : ""}`, module: "POS", staffId: staff.id, staffName: staff.name });
      invalidateCache(["dashboard", "pnl", "stock"]);

      if (loyaltyDiscount > 0) {
        deductLoyaltyPoints({ phone: combinePhone(custCountryCode, custPhone), points: loyaltyRedeemPoints, referenceType: "invoice", referenceId: invoiceId, referenceNumber: invoiceNumber, description: `Redeemed ${loyaltyRedeemPoints} points for NPR ${loyaltyDiscount} discount at POS` }).catch(() => {});
      }

      earnLoyaltyPoints({ phone: combinePhone(custCountryCode, custPhone), name: custName, grandTotal, referenceType: "invoice", referenceId: invoiceId, referenceNumber: invoiceNumber }).catch(() => {});

      if (couponDiscount > 0) {
        postCouponRedemption(invoiceNumber, couponDiscount, staff.id).catch(() => {});
      }

      setCart([]);
      setSaleMsg({ text: `Sale complete! Invoice #${invoiceNumber}`, type: "success" });
      const saved = await getDocument<Invoice>(`invoices/${invoiceId}`);
      if (saved) setLastOrder(saved);
    } catch (err) {
      setSaleMsg({ text: err instanceof Error ? err.message : "Payment failed", type: "error" });
    } finally { setSaving(false); }
  };

  const activeCombos = combos.filter((c) => c.isActive);
  const mainCategories = (allCategories || []).filter((c) => !c.parentId && c.isActive);
  const subCategoryIds = selectedCategory
    ? (allCategories || []).filter((c) => c.parentId === selectedCategory && c.isActive).map((c) => c.id)
    : [];
  const activeCategoryIds = selectedCategory ? [selectedCategory, ...subCategoryIds] : [];

  const hasStock = (p: Product) => (skus[p.id] || []).some((s) => (s.stock ?? 0) > 0);

  const displayProducts = products
    .filter((p) => p.isActive && hasStock(p))
    .filter((p) => !selectedProduct || p.id === selectedProduct.id)
    .filter((p) => !selectedCategory || p.categoryIds.some((cid) => activeCategoryIds.includes(cid)));

  const InvoicePanel = () => lastOrder && store ? (
    <div className="rounded-card bg-white p-4 shadow-card">
      <h3 className="mb-3 font-heading text-sm font-semibold text-text">Invoice</h3>
      <div className="flex flex-col gap-2">
        {issuedCode ? (
          <div className="rounded-btn bg-success/10 px-3 py-2 text-center text-xs font-medium text-success">
            Coupon <strong>{issuedCode}</strong> issued!
          </div>
        ) : showIssueCoupon ? (
          <div className="space-y-2 rounded-btn border border-beige bg-beige/20 p-3">
            <p className="text-xs font-medium text-text">Issue Repurchase Coupon</p>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-xs text-text">
                <input type="radio" name="issueType" checked={issueType === "percentage"} onChange={() => setIssueType("percentage")} className="accent-forest-green" /> %
              </label>
              <label className="flex items-center gap-1 text-xs text-text">
                <input type="radio" name="issueType" checked={issueType === "fixed"} onChange={() => setIssueType("fixed")} className="accent-forest-green" /> Fixed
              </label>
            </div>
            <label className="text-xs font-medium text-text">Recipient Name</label>
            <input value={issueRecipientName} onChange={(e) => setIssueRecipientName(e.target.value)} className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="e.g. Ram" />
            <label className="text-xs font-medium text-text">Discount Value</label>
            <input type="number" value={issueValue} onChange={(e) => setIssueValue(Number(e.target.value))} className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="e.g. 10" />
            <label className="text-xs font-medium text-text">Valid Days</label>
            <input type="number" value={issueExpiryDays} onChange={(e) => setIssueExpiryDays(Number(e.target.value))} className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="e.g. 30" />
            <label className="text-xs font-medium text-text">Minimum Order Amount</label>
            <input type="number" value={issueMinOrder} onChange={(e) => setIssueMinOrder(Number(e.target.value))} className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="e.g. 500" />
            <div className="flex gap-2">
              <button onClick={() => setShowIssueCoupon(false)} className="flex-1 rounded-btn border border-border py-1.5 text-xs text-text-light transition-colors hover:border-chili-red hover:text-chili-red">Cancel</button>
              <button onClick={handleIssueCoupon} disabled={issuing} className="flex-1 rounded-btn border border-forest-green bg-forest-green py-1.5 text-xs font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">{issuing ? "..." : "Issue Coupon"}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setShowIssueCoupon(true); setIssueRecipientName(custName); }} className="w-full rounded-btn border border-mustard-gold px-3 py-2 text-xs font-medium text-mustard-gold transition-colors hover:bg-mustard-gold/5">
            🎫 Issue Coupon for Repurchase
          </button>
        )}
        <a
          href="/invoices"
          className="block w-full rounded-btn border border-info px-3 py-2 text-center text-xs font-medium text-info transition-colors hover:bg-info/5"
        >
          View Invoices →
        </a>
      </div>
    </div>
  ) : null;
  const visibleMainCategories = selectedCategory
    ? mainCategories.filter((c) => c.id === selectedCategory)
    : mainCategories.filter((c) => {
        const subIds = (allCategories || []).filter((sc) => sc.parentId === c.id && sc.isActive).map((sc) => sc.id);
        const allCatIds = [c.id, ...subIds];
        return displayProducts.some((p) => p.categoryIds.some((cid) => allCatIds.includes(cid)));
      });

  const CartPanel = () => (
    <div className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-3 font-heading font-semibold text-text">Cart</h2>
      {saleMsg && (
        <div className={`mb-3 rounded-btn px-3 py-2 text-center text-xs font-medium ${saleMsg.type === "success" ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
          {saleMsg.text}
        </div>
      )}
      {cart.length === 0 && !lastOrder ? (
        <p className="text-sm text-text-muted">Select a product above</p>
      ) : cart.length > 0 ? (
        <div className="space-y-2">
          {cart.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex-1 truncate">
                <span className="text-text">{c.productName}</span>
                <span className="text-text-muted"> — {c.skuLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-forest-green">NPR {(c.unitPrice * c.quantity).toLocaleString()}</span>
                <button onClick={() => {
                  if (c.quantity <= 1) {
                    setCart(cart.filter((_, idx) => idx !== i));
                  } else {
                    const next = [...cart];
                    next[i] = { ...next[i], quantity: next[i].quantity - 1 };
                    setCart(next);
                  }
                }} className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs text-text-muted transition-colors hover:border-chili-red hover:text-chili-red">−</button>
                <span className="min-w-[16px] text-center text-xs text-text-muted">{c.quantity}</span>
                <button onClick={() => addToCart(c.productId, c.skuId, c.productName, c.skuLabel, c.unitPrice)} className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs text-text-muted transition-colors hover:border-forest-green hover:text-forest-green">+</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {cart.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text">Customer</h3>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input type="checkbox" checked={isWalkin} onChange={() => {
                if (!isWalkin) { setCustName(""); setCustPhone(""); setCustCountryCode(DEFAULT_CODE); setCustAddress(""); }
                setIsWalkin(!isWalkin);
              }} className="accent-forest-green" />
              Walk-in
            </label>
          </div>
          {isWalkin ? (
            <div className="space-y-1 text-xs text-text-muted">
              <p>Name: Walk-in</p>
              <p>Address: In-store</p>
            </div>
          ) : (
            <div className="space-y-2">
              <input value={custName} onChange={(e) => setCustName(e.target.value)} className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="Customer name" />
              <div className="flex gap-2">
                <select value={custCountryCode} onChange={(e) => setCustCountryCode(e.target.value)} className="w-20 shrink-0 rounded-input border border-border px-1 py-1.5 text-xs outline-none focus:border-forest-green">
                  {COUNTRY_CODES.map((cc) => (
                    <option key={cc.code} value={cc.code}>{cc.code}</option>
                  ))}
                </select>
                <input value={custPhone} onChange={(e) => { setCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setPhoneErr(""); }} className="flex-1 rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="Phone (10 digits)" />
                <input value={custAddress} onChange={(e) => setCustAddress(e.target.value)} className="flex-1 rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="Address" />
                {phoneErr && <p className="col-span-2 text-xs text-error">{phoneErr}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {cart.length > 0 && !isWalkin && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text">Loyalty Points</h3>
            {loyaltyAcc && <button onClick={removeLoyalty} className="text-xs text-error hover:underline">Remove</button>}
          </div>
          {loyaltyDiscount > 0 ? (
            <p className="mt-1 text-xs font-medium text-success">-NPR {loyaltyDiscount.toLocaleString()} ({loyaltyRedeemPoints} pts)</p>
          ) : showLoyalty && loyaltyAcc ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-text-muted">Balance: <strong>{loyaltyAcc.pointsBalance}</strong> pts (max redeem: {loyaltyRedeemMax})</p>
              <div className="flex gap-1">
                <input type="number" min={100} max={loyaltyRedeemMax} value={loyaltyRedeemPoints} onChange={(e) => setLoyaltyRedeemPoints(Number(e.target.value))} className="w-20 rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" placeholder="Pts" />
                <button onClick={applyLoyaltyRedemption} className="rounded-btn border border-forest-green px-2 py-1.5 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green hover:text-white">Apply</button>
              </div>
            </div>
          ) : (
            <button onClick={lookupLoyalty} className="mt-1 w-full rounded-btn border border-beige bg-beige/30 px-2 py-1.5 text-xs font-medium text-text transition-colors hover:border-forest-green">Redeem Points</button>
          )}
          {loyaltyMsg && <p className={`mt-1 text-xs ${loyaltyMsg.type === "success" ? "text-success" : "text-error"}`}>{loyaltyMsg.text}</p>}
        </div>
      )}

      {cart.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text">Coupon</h3>
            {appliedCoupon && <button onClick={removeCoupon} className="text-xs text-error hover:underline">Remove</button>}
          </div>
          {appliedCoupon ? (
            <p className="mt-1 text-xs font-medium text-success">-NPR {discount.toLocaleString()} ({appliedCoupon.code})</p>
          ) : (
            <div className="mt-1 flex gap-1">
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Code" className="flex-1 rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" />
              <button onClick={applyCoupon} className="rounded-btn border border-forest-green px-2 py-1.5 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green hover:text-white">Apply</button>
            </div>
          )}
          {couponMsg && <p className={`mt-1 text-xs ${couponMsg.type === "success" ? "text-success" : "text-error"}`}>{couponMsg.text}</p>}
        </div>
      )}

      <div className="mt-4 flex justify-between border-t border-border pt-3 font-heading text-lg font-bold">
        <span>Total</span>
        <span className="text-forest-green">NPR {(lastOrder ? lastOrder.grandTotal : grandTotal).toLocaleString()}</span>
      </div>
      {cart.length > 0 && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => { setCart([]); setShowIssueCoupon(false); setIssuedCode(null); }} className="flex-1 rounded-btn border border-border py-2 text-sm font-medium text-text-light transition-colors hover:border-chili-red hover:text-chili-red">Clear</button>
          <button onClick={handlePay} disabled={saving} className="flex-1 rounded-btn bg-forest-green py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">{saving ? "..." : "Pay (Cash)"}</button>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout>
      <div className="flex flex-col gap-0 sm:flex-row sm:gap-6 sm:p-6 lg:h-[calc(100vh-80px)]">
        {/* Products panel */}
        <div className="flex-1 overflow-y-auto p-3 pb-20 sm:pb-3">
          <h1 className="mb-4 font-heading text-xl font-bold text-text">Quick Sale (POS)</h1>
          <div className="mb-4 flex gap-2">
            <button onClick={() => setTab("products")} className={`rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors ${tab === "products" ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}>Products</button>
            {activeCombos.length > 0 && (
              <button onClick={() => setTab("combos")} className={`rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors ${tab === "combos" ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}>Combos</button>
            )}
          </div>
          {tab === "combos" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeCombos.map((combo) => (
                <div key={combo.id} className="rounded-card bg-white p-4 shadow-card">
                  <h3 className="mb-2 font-heading font-semibold text-text">{combo.name}</h3>
                  {combo.description && <p className="mb-2 text-xs text-text-muted">{combo.description}</p>}
                  <div className="mb-3 space-y-1">
                    {combo.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-text-light">
                        <span className="h-1 w-1 rounded-full bg-forest-green" />
                        <span>{item.productName} — {item.skuLabel} <span className="text-text-muted">×{item.quantity}</span></span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-forest-green">NPR {combo.price.toLocaleString()}</span>
                    <button
                      onClick={() => {
                        setLastOrder(null); setSaleMsg(null); setShowIssueCoupon(false); setIssuedCode(null);
                        for (const item of combo.items) {
                          setCart((prev) => {
                            const existing = prev.find((c) => c.skuId === item.skuId && c.productId === item.productId);
                            if (existing) return prev.map((c) => c.skuId === item.skuId && c.productId === item.productId ? { ...c, quantity: c.quantity + item.quantity } : c);
                            return [...prev, { productId: item.productId, skuId: item.skuId, productName: item.productName, skuLabel: item.skuLabel, unitPrice: 0, quantity: item.quantity }];
                          });
                        }
                      }}
                      className="rounded-btn bg-forest-green px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-green-dark"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <><div className="mb-4 flex flex-wrap gap-2">
            {visibleMainCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id === selectedCategory ? null : cat.id); setSelectedProduct(null); }}
                className={`rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors ${selectedCategory === cat.id ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}
              >
                {cat.name}
              </button>
            ))}
            {selectedCategory && (
              <button onClick={() => { setSelectedCategory(null); setSelectedProduct(null); }} className="rounded-btn border border-border px-3 py-1.5 text-xs font-medium text-text-light hover:border-chili-red hover:text-chili-red">All</button>
            )}
          </div>
          {selectedCategory && subCategoryIds.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {subCategoryIds.map((scId) => {
                const sc = allCategories?.find((c) => c.id === scId);
                return sc ? (
                  <span key={scId} className="rounded-btn bg-beige/50 px-3 py-1.5 text-xs font-medium text-text-muted">{sc.name}</span>
                ) : null;
              })}
            </div>
          )}
          {displayProducts.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button onClick={() => setSelectedProduct(null)} className={`rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors ${!selectedProduct ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}>All</button>
              {displayProducts.map((p) => (
                <button key={p.id} onClick={() => setSelectedProduct(p)} className={`rounded-btn border px-3 py-1.5 text-xs font-medium transition-colors ${selectedProduct?.id === p.id ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}>{p.name}</button>
              ))}
            </div>
          )}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {displayProducts.map((p) => {
              const productSkus = skus[p.id] || [];
              return (
                <div key={p.id} className="rounded-card bg-white p-4 shadow-card">
                  <h3 className="mb-3 font-heading font-semibold text-text">{p.name}</h3>
                  {productSkus.length === 0 ? (
                    <p className="text-xs text-text-muted">No SKUs</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {productSkus.filter((s) => s.isActive !== false && (s.stock ?? 0) > 0).map((sku) => (
                        <button
                          key={sku.id}
                          onClick={() => { addToCart(p.id, sku.id, p.name, sku.label, sku.price); setShowCart(true); }}
                          className="rounded-btn border border-beige bg-beige/30 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-forest-green hover:bg-forest-green hover:text-white"
                        >
                          {sku.label} — NPR {sku.price.toLocaleString()} <span className="text-text-muted">Stock: {sku.stock ?? 0}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div></>
          )}
        </div>

        {/* Cart sidebar — desktop */}
        <div className="hidden sm:flex w-80 shrink-0 flex-col gap-4">
          <CartPanel />
          <InvoicePanel />
        </div>

        {/* Mobile cart drawer */}
        {showCart && (
          <div className="fixed inset-0 z-50 flex sm:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
            <div className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-heading font-semibold text-text">Cart</h2>
                <button onClick={() => setShowCart(false)} className="text-xl text-text-light hover:text-text">&times;</button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <CartPanel />
                <div className="mt-4"><InvoicePanel /></div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile floating cart button */}
        {cart.length > 0 && (
          <button onClick={() => setShowCart(true)} className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-forest-green text-white shadow-lg sm:hidden">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-chili-red text-[10px] font-bold text-white">{cart.length}</span>
          </button>
        )}
      </div>
    </AdminLayout>
  );
}
