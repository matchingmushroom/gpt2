import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, removeDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import type { Coupon, Category, Product } from "../types";

export default function CouponsPage() {
  const { staff, can } = useStaff();
  const { data: coupons, loading } = useCollection<Coupon>("coupons");
  const { data: categories } = useCollection<Category>("categories");
  const { data: products } = useCollection<Product>("products");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"regular" | "repurchase">("regular");
  const [historyModal, setHistoryModal] = useState<Coupon | null>(null);

  const regularCoupons = coupons.filter((c) => !c.description?.toLowerCase().includes("repurchase coupon"));
  const repurchaseCoupons = coupons.filter((c) => c.description?.toLowerCase().includes("repurchase coupon"));

  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"percentage" | "fixed" | "full_discount" | "variable_percentage" | "variable_fixed">("percentage");
  const [formValue, setFormValue] = useState(0);
  const [formMinValue, setFormMinValue] = useState(0);
  const [formMaxValue, setFormMaxValue] = useState(0);
  const [formMinOrder, setFormMinOrder] = useState(0);
  const [formMaxUses, setFormMaxUses] = useState(100);
  const [formAppliesTo, setFormAppliesTo] = useState<"all" | "category" | "product">("all");
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([]);
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formExpiry, setFormExpiry] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().split("T")[0];
  });

  const activeProducts = products.filter((p) => p.isActive);
  const isVariable = formType === "variable_percentage" || formType === "variable_fixed";

  const openNew = () => {
    setEditing(null);
    setFormCode("");
    setFormType("percentage");
    setFormValue(0);
    setFormMinValue(0);
    setFormMaxValue(0);
    setFormMinOrder(0);
    setFormMaxUses(100);
    setFormAppliesTo("all");
    setFormCategoryIds([]);
    setFormProductIds([]);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setFormCode(c.code);
    setFormType(c.type);
    setFormValue(c.value);
    setFormMinValue(c.minValue ?? 0);
    setFormMaxValue(c.maxValue ?? 0);
    setFormMinOrder(c.minOrderAmount);
    setFormMaxUses(c.maxUses);
    setFormAppliesTo(c.appliesTo || "all");
    setFormCategoryIds(c.applicableCategoryIds || []);
    setFormProductIds(c.applicableProductIds || []);
    setFormExpiry(new Date(c.validUntil?.seconds * 1000).toISOString().split("T")[0]);
    setError(null);
    setModalOpen(true);
  };

  const toggleCategory = (id: string) => {
    setFormCategoryIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const toggleProduct = (id: string) => {
    setFormProductIds((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!staff || !can("coupons.write")) return;
    if (!formCode.trim() || (!isVariable && formValue <= 0)) { setError("Code and value required"); return; }
    if (isVariable && (formMinValue <= 0 || formMaxValue <= 0)) { setError("Min and max values required for variable type"); return; }
    if (isVariable && formMinValue > formMaxValue) { setError("Min value cannot exceed max value"); return; }
    if (formAppliesTo === "category" && formCategoryIds.length === 0) { setError("Select at least one category"); return; }
    if (formAppliesTo === "product" && formProductIds.length === 0) { setError("Select at least one product"); return; }
    setSaving(true); setError(null);
    try {
      const base = {
        code: formCode.trim().toUpperCase(), type: formType, value: formValue,
        minOrderAmount: formMinOrder, maxUses: formMaxUses,
        validFrom: new Date(), validUntil: new Date(formExpiry),
        appliesTo: formAppliesTo,
        applicableCategoryIds: formAppliesTo === "category" ? formCategoryIds : [],
        applicableProductIds: formAppliesTo === "product" ? formProductIds : [],
        applicableSkuIds: [],
        isActive: true, createdBy: staff.id,
      };
      const data: Record<string, any> = editing
        ? { ...base }
        : { ...base, currentUses: 0, totalDiscountGiven: 0, usageHistory: [] };
      if (isVariable) {
        data.minValue = formMinValue;
        data.maxValue = formMaxValue;
        data.value = formMaxValue;
      }
      if (editing) {
        await setDocument(`coupons/${editing.id}`, data);
        logActivity({ action: "Updated coupon", details: `Updated coupon '${formCode}'`, module: "Coupons", staffId: staff.id, staffName: staff.name, relatedDocId: editing.id });
      } else {
        const id = await addDocument("coupons", data);
        logActivity({ action: "Created coupon", details: `Created coupon '${formCode}' (${formType}: ${formValue})`, module: "Coupons", staffId: staff.id, staffName: staff.name, relatedDocId: id });
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (c: Coupon) => {
    if (!staff || !can("coupons.write")) return;
    if (!confirm(`Delete coupon "${c.code}"? This cannot be undone.`)) return;
    try {
      await removeDocument(`coupons/${c.id}`);
      logActivity({ action: "Deleted coupon", details: `Deleted coupon '${c.code}'`, module: "Coupons", staffId: staff.id, staffName: staff.name, relatedDocId: c.id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Coupons</h1>
            <p className="text-sm text-text-light">Promotional codes and discounts</p>
          </div>
          {can("coupons.write") && activeTab === "regular" && <button onClick={openNew} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ New Coupon</button>}
          {activeTab === "repurchase" && <p className="text-xs text-text-muted">Repurchase coupons are issued automatically via POS</p>}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        {/* Pill tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-light-gray p-1">
          <button
            onClick={() => setActiveTab("regular")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "regular" ? "bg-white text-text shadow-sm" : "text-text-muted hover:text-text"}`}
          >
            Regular Coupons
          </button>
          <button
            onClick={() => setActiveTab("repurchase")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "repurchase" ? "bg-white text-text shadow-sm" : "text-text-muted hover:text-text"}`}
          >
            Repurchase Coupons
          </button>
        </div>

        {activeTab === "regular" ? (
            <DataTable
              columns={[
                { key: "code", header: "Code", render: (c: Coupon) => <span className="font-mono text-sm font-bold text-text">{c.code}</span>, sortable: true },
                { key: "discount", header: "Discount", render: (c: Coupon) => {
                  if (c.type === "variable_percentage") return <span className="text-text-light">{c.minValue ?? 5}%–{c.maxValue ?? c.value}% (variable)</span>;
                  if (c.type === "variable_fixed") return <span className="text-text-light">NPR {c.minValue ?? 10}–{c.maxValue ?? c.value} (variable)</span>;
                  return <span className="text-text-light">{c.type === "percentage" ? `${c.value}%` : c.type === "full_discount" ? "100%" : `NPR ${c.value}`}</span>;
                }},
                { key: "appliesTo", header: "Applies To", render: (c: Coupon) => {
                  if (c.appliesTo === "category") return <span className="text-xs text-text-light">Categories ({c.applicableCategoryIds?.length || 0})</span>;
                  if (c.appliesTo === "product") return <span className="text-xs text-text-light">Products ({c.applicableProductIds?.length || 0})</span>;
                  return <span className="text-xs text-text-muted">All Products</span>;
                }},
                { key: "uses", header: "Uses", render: (c: Coupon) => <span className="text-text-light">{c.currentUses}/{c.maxUses}</span> },
                { key: "totalGiven", header: "Total Discount", render: (c: Coupon) => <span className="text-text-light">NPR {(c.totalDiscountGiven ?? 0).toLocaleString()}</span> },
                { key: "expiry", header: "Expires", render: (c: Coupon) => <span className="text-text-light">{new Date(c.validUntil?.seconds * 1000).toLocaleDateString()}</span> },
                { key: "status", header: "Status", render: (c: Coupon) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"}`}>{c.isActive ? "Active" : "Inactive"}</span> },
                { key: "actions", header: "", render: (c: Coupon) => (
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setHistoryModal(c); }} className="text-xs text-text-muted hover:text-text">{(c.usageHistory?.length ?? 0) > 0 ? `History (${c.usageHistory.length})` : "History"}</button>
                    {can("coupons.write") && <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="text-xs text-info">Edit</button>}
                    {can("coupons.write") && <button onClick={(e) => { e.stopPropagation(); handleDelete(c); }} className="text-xs text-error">Delete</button>}
                  </div>
                ), width: "140px" },
              ]}
              data={regularCoupons}
              keyExtractor={(c) => c.id}
              loading={loading}
              emptyMessage="No regular coupons yet"
              emptyIcon="🎫"
              pageSize={20}
            />
        ) : (
          <DataTable
            columns={[
              { key: "code", header: "Code", render: (c: Coupon) => <span className="font-mono text-sm font-bold text-text">{c.code}</span>, sortable: true },
              { key: "discount", header: "Discount", render: (c: Coupon) => <span className="text-text-light">{c.type === "percentage" ? `${c.value}%` : c.type === "full_discount" ? "100%" : `NPR ${c.value}`}</span> },
              { key: "order", header: "Issued With", render: (c: Coupon) => {
                const match = c.description?.match(/issued with order (\S+)/);
                return match ? <span className="text-xs text-text-light">{match[1]}</span> : <span className="text-xs text-text-muted">—</span>;
              }},
              { key: "uses", header: "Uses", render: (c: Coupon) => <span className="text-text-light">{c.currentUses}/{c.maxUses}</span> },
              { key: "totalGiven", header: "Total Discount", render: (c: Coupon) => <span className="text-text-light">NPR {(c.totalDiscountGiven ?? 0).toLocaleString()}</span> },
              { key: "expiry", header: "Expires", render: (c: Coupon) => <span className="text-text-light">{new Date(c.validUntil?.seconds * 1000).toLocaleDateString()}</span> },
              { key: "status", header: "Status", render: (c: Coupon) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"}`}>{c.isActive ? "Active" : "Inactive"}</span> },
            ]}
            data={repurchaseCoupons}
            keyExtractor={(c) => c.id}
            loading={loading}
            emptyMessage="No repurchase coupons issued yet"
            emptyIcon="🔄"
            pageSize={20}
          />
        )}

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Coupon" : "New Coupon"} onSave={handleSave} saving={saving} size={formAppliesTo !== "all" ? "md" : "sm"}>
          <div className="space-y-4">
            <div><label className="mb-1 block text-sm font-medium text-text">Code *</label><input value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())} className="w-full rounded-input border border-border px-4 py-2 text-sm font-mono uppercase outline-none focus:border-forest-green" /></div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                  <option value="percentage">Percentage</option><option value="fixed">Fixed (NPR)</option><option value="full_discount">Full Discount</option>
                  <option value="variable_percentage">Variable % (random)</option><option value="variable_fixed">Variable NPR (random)</option>
                </select>
              </div>
              {!isVariable && <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Value *</label><input value={formValue || ""} onChange={(e) => setFormValue(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>}
            </div>

            {isVariable && (
              <div className="flex gap-4">
                <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Min {formType === "variable_percentage" ? "%" : "NPR"} *</label><input value={formMinValue || ""} onChange={(e) => setFormMinValue(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
                <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Max {formType === "variable_percentage" ? "%" : "NPR"} *</label><input value={formMaxValue || ""} onChange={(e) => setFormMaxValue(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              </div>
            )}

            <div><label className="mb-1 block text-sm font-medium text-text">Coupon Applies To</label>
              <select value={formAppliesTo} onChange={(e) => setFormAppliesTo(e.target.value as any)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
                <option value="all">All Products</option>
                <option value="category">Category Specific</option>
                <option value="product">Product Specific</option>
              </select>
            </div>

            {formAppliesTo === "category" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Select Categories</label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                  {categories.filter((c) => !c.parentId).length === 0 ? (
                    <p className="p-2 text-xs text-text-muted">No categories found</p>
                  ) : (
                    categories.filter((c) => !c.parentId).map((cat) => (
                      <div key={cat.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-beige/50">
                          <input type="checkbox" checked={formCategoryIds.includes(cat.id)} onChange={() => toggleCategory(cat.id)} className="accent-forest-green" />
                          <span className="font-medium text-text">{cat.name}</span>
                        </label>
                        {categories.filter((c) => c.parentId === cat.id).map((sub) => (
                          <label key={sub.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 pl-8 text-sm transition-colors hover:bg-beige/50">
                            <input type="checkbox" checked={formCategoryIds.includes(sub.id)} onChange={() => toggleCategory(sub.id)} className="accent-forest-green" />
                            <span className="text-text-light">{sub.name}</span>
                          </label>
                        ))}
                      </div>
                    ))
                  )}
                </div>
                {formCategoryIds.length > 0 && <p className="mt-1 text-xs text-text-muted">{formCategoryIds.length} selected</p>}
              </div>
            )}

            {formAppliesTo === "product" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Select Products</label>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                  {activeProducts.length === 0 ? (
                    <p className="p-2 text-xs text-text-muted">No products found</p>
                  ) : (
                    activeProducts.map((p) => (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-beige/50">
                        <input type="checkbox" checked={formProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="accent-forest-green" />
                        <span className="text-text-light">{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
                {formProductIds.length > 0 && <p className="mt-1 text-xs text-text-muted">{formProductIds.length} selected</p>}
              </div>
            )}

            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Min Order (NPR)</label><input value={formMinOrder || ""} onChange={(e) => setFormMinOrder(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Max Uses</label><input value={formMaxUses || ""} onChange={(e) => setFormMaxUses(Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-text">Expiry Date</label><input value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} type="date" className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
          </div>
        </FormModal>

        {historyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHistoryModal(null)}>
            <div className="w-full max-w-lg rounded-card bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-base font-bold text-text">Usage History — {historyModal.code}</h3>
                <button onClick={() => setHistoryModal(null)} className="text-xl text-text-muted hover:text-text">&times;</button>
              </div>
              {(historyModal.usageHistory ?? []).length === 0 ? (
                <p className="py-4 text-center text-sm text-text-muted">No usage history</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs text-text-light">
                    <thead><tr className="border-b border-border"><th className="py-1 text-left">Order</th><th className="py-1 text-left">Rolled</th><th className="py-1 text-left text-success">Disc.</th><th className="py-1 text-left">Subtotal</th><th className="py-1 text-left">Date</th></tr></thead>
                    <tbody>
                      {historyModal.usageHistory.map((e, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 font-mono">{e.orderNumber}</td>
                          <td className="py-1.5">{e.rolledValue}{historyModal.type === "variable_percentage" ? "%" : ""}</td>
                          <td className="py-1.5 text-success">-NPR {e.discountApplied.toLocaleString()}</td>
                          <td className="py-1.5">NPR {e.subtotalAtUse.toLocaleString()}</td>
                          <td className="py-1.5">{new Date(e.usedAt.seconds * 1000).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      <tr className="font-medium text-text">
                        <td className="py-2" colSpan={2}>Total</td>
                        <td className="py-2 text-success">-NPR {(historyModal.totalDiscountGiven ?? 0).toLocaleString()}</td>
                        <td className="py-2" colSpan={2}>{historyModal.currentUses} uses</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
