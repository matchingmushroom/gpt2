import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, getCollection } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { deductStock } from "../utils/deductStock";
import type { Product, SKU } from "../types";

export default function StockAdjustmentsPage() {
  const { staff, can } = useStaff();
  const { data: products } = useCollection<Product>("products");
  const [skuMap, setSkuMap] = useState<Record<string, SKU[]>>({});
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<"loss" | "damage">("loss");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const activeProducts = products.filter((p) => p.isActive);
  const getSkus = (id: string) => skuMap[id] || [];
  const selectedProduct = activeProducts.find((p) => p.id === selectedProductId);
  const selectedSku = getSkus(selectedProductId).find((s) => s.id === selectedSkuId);
  const costAmount = selectedSku ? selectedSku.price * quantity : 0;

  useEffect(() => {
    const load = async () => {
      const map: Record<string, SKU[]> = {};
      for (const p of activeProducts) {
        try { map[p.id] = await getCollection<SKU>(`products/${p.id}/skus`); } catch { map[p.id] = []; }
      }
      setSkuMap(map);
    };
    if (activeProducts.length > 0) load();
  }, [activeProducts.length]);

  const handleSubmit = async () => {
    if (!selectedProductId || !selectedSkuId || quantity <= 0) { setMsg({ text: "Select product, SKU, and valid quantity", type: "error" }); return; }
    if (!description.trim()) { setMsg({ text: "Describe the reason for adjustment", type: "error" }); return; }
    setSubmitting(true);
    setMsg(null);
    try {
    const result = await deductStock([{ productId: selectedProductId, skuId: selectedSkuId, quantity }]);
    if (!result.ok) {
      setMsg({ text: `Insufficient stock: ${result.errors[0].skuLabel} (available: ${result.errors[0].available}, requested: ${result.errors[0].requested})`, type: "error" });
      setSubmitting(false);
      return;
    }

    if (!staff) { setSubmitting(false); return; }

    await addDocument("expenses", {
        category: `Stock ${reason === "loss" ? "Loss" : "Damage"}`,
        description: `${reason === "loss" ? "Loss" : "Damage"}: ${quantity}× ${selectedSku?.label} of ${selectedProduct?.name} — ${description.trim()}`,
        amount: costAmount,
        date: new Date(),
        paidBy: staff.id,
        paidByName: staff.name,
        billImage: "",
        notes: description.trim(),
      });

      logActivity({
        action: `Stock ${reason}`,
        details: `${reason === "loss" ? "Loss" : "Damage"}: ${quantity}× ${selectedSku?.label} (${selectedProduct?.name}) — NPR ${costAmount}`,
        module: "StockAdjustments",
        staffId: staff.id,
        staffName: staff.name,
      });

      setMsg({ text: `Adjusted: -${quantity} ${selectedSku?.label} (${reason})`, type: "success" });
      setSelectedSkuId("");
      setQuantity(1);
      setDescription("");
    } catch (e: any) {
      setMsg({ text: e.message || "Failed", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!can("products.write") || !staff) {
    return (
      <AdminLayout>
        <div className="p-6"><p className="text-sm text-text-muted">You don't have permission to adjust stock.</p></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <h1 className="mb-6 font-heading text-lg font-bold text-text sm:text-xl">Stock Adjustments</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-4 font-heading text-base font-semibold text-text">Record Loss / Damage</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Product *</label>
                <select value={selectedProductId} onChange={(e) => { setSelectedProductId(e.target.value); setSelectedSkuId(""); }} className="w-full rounded-input border border-border px-3 py-2 text-sm text-text outline-none focus:border-forest-green">
                  <option value="">Select product</option>
                  {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">SKU *</label>
                <select value={selectedSkuId} onChange={(e) => setSelectedSkuId(e.target.value)} className="w-full rounded-input border border-border px-3 py-2 text-sm text-text outline-none focus:border-forest-green" disabled={!selectedProductId}>
                  <option value="">Select SKU</option>
                  {getSkus(selectedProductId).filter((s) => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.label} — Stock: {s.stock ?? 0} — NPR {s.price}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Quantity *</label>
                <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="w-full rounded-input border border-border px-3 py-2 text-sm text-text outline-none focus:border-forest-green" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Type</label>
                <div className="flex gap-3">
                  {[{ value: "loss" as const, label: "Loss" }, { value: "damage" as const, label: "Damage" }].map((opt) => (
                    <label key={opt.value} className={`flex cursor-pointer items-center gap-2 rounded-btn border px-4 py-2 text-sm transition-colors ${reason === opt.value ? "border-forest-green bg-forest-green/5 text-forest-green font-medium" : "border-border text-text-light"}`}>
                      <input type="radio" name="reason" value={opt.value} checked={reason === opt.value} onChange={() => setReason(opt.value)} className="h-4 w-4 accent-forest-green" />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Description *</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-input border border-border px-3 py-2 text-sm text-text outline-none focus:border-forest-green" rows={2} placeholder="e.g. Spilled during transport, expired batch..." />
              </div>
              {selectedSku && (
                <div className="rounded-btn bg-light-gray px-4 py-3 text-sm">
                  <div className="flex justify-between text-text-muted"><span>Cost impact:</span><span>NPR {costAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between text-text-muted"><span>Current stock:</span><span>{selectedSku.stock ?? 0}</span></div>
                </div>
              )}
              <button onClick={handleSubmit} disabled={submitting} className="w-full rounded-btn bg-chili-red px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60">
                {submitting ? "Recording..." : `Record ${reason === "loss" ? "Loss" : "Damage"}`}
              </button>
              {msg && <p className={`text-sm ${msg.type === "success" ? "text-success" : "text-error"}`}>{msg.text}</p>}
            </div>
          </div>

          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-4 font-heading text-base font-semibold text-text">SKU Stock Overview</h2>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {activeProducts.length === 0 ? (
                <p className="text-sm text-text-muted">No products found</p>
              ) : activeProducts.map((p) => (
                <div key={p.id}>
                  <p className="mb-1 text-sm font-medium text-text">{p.name}</p>
                  {getSkus(p.id).filter((s) => s.isActive).map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-btn bg-light-gray px-3 py-1.5 text-xs">
                      <span className="text-text-light">{s.label}</span>
                      <span className={`font-medium ${(s.stock ?? 0) <= 0 ? "text-chili-red" : (s.stock ?? 0) < 10 ? "text-warning" : "text-text"}`}>
                        {s.stock ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
