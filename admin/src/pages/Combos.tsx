import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import ImageUploader from "../components/ImageUploader";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, removeDocument, getCollection, getDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import type { Combo, Product, SKU } from "../types";

interface ComboFormItem {
  productId: string;
  productName: string;
  skuId: string;
  skuLabel: string;
  quantity: number;
}

const emptyItem = (): ComboFormItem => ({ productId: "", productName: "", skuId: "", skuLabel: "", quantity: 1 });

export default function CombosPage() {
  const { staff, can } = useStaff();
  const { data: combos, loading } = useCollection<Combo>("combos");
  const { data: products } = useCollection<Product>("products");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Combo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuMap, setSkuMap] = useState<Record<string, SKU[]>>({});
  const [gasUrl, setGasUrl] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formPrice, setFormPrice] = useState(0);
  const [formItems, setFormItems] = useState<ComboFormItem[]>([emptyItem()]);

  const activeProducts = products.filter((p) => p.isActive);

  useEffect(() => {
    if (!modalOpen) return;
    const loadSkus = async () => {
      const map: Record<string, SKU[]> = {};
      for (const p of activeProducts) {
        try { map[p.id] = await getCollection<SKU>(`products/${p.id}/skus`); } catch { map[p.id] = []; }
      }
      setSkuMap(map);
    };
    loadSkus();
  }, [modalOpen, activeProducts.length]);

  useEffect(() => {
    getDocument<any>("settings/backup").then((doc) => {
      if (doc?.gasUrl) setGasUrl(doc.gasUrl);
      if (doc?.driveFolderId) setDriveFolderId(doc.driveFolderId);
    }).catch(() => {});
  }, []);

  const getSkus = (productId: string) => skuMap[productId] || [];

  const openNew = () => {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setFormImages([]);
    setFormPrice(0);
    setFormItems([emptyItem()]);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (c: Combo) => {
    setEditing(c);
    setFormName(c.name);
    setFormDesc(c.description || "");
    setFormImages(c.images ?? []);
    setFormPrice(c.price);
    setFormItems(c.items.map((i) => ({ ...i })));
    setError(null);
    setModalOpen(true);
  };

  const addItemRow = () => setFormItems([...formItems, emptyItem()]);
  const removeItemRow = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ComboFormItem, value: any) => {
    const next = [...formItems];
    if (field === "productId") {
      const product = activeProducts.find((p) => p.id === value);
      next[idx] = { ...next[idx], productId: value, productName: product?.name || "", skuId: "", skuLabel: "" };
    } else if (field === "skuId") {
      const sku = getSkus(next[idx].productId).find((s) => s.id === value);
      next[idx] = { ...next[idx], skuId: value, skuLabel: sku?.label || "" };
    } else {
      next[idx] = { ...next[idx], [field]: value };
    }
    setFormItems(next);
  };

  const sumIndividualPrices = () => {
    let total = 0;
    for (const item of formItems) {
      if (!item.productId || !item.skuId) continue;
      const sku = getSkus(item.productId).find((s) => s.id === item.skuId);
      if (sku) total += (sku.price || 0) * (item.quantity || 1);
    }
    return total;
  };

  const handleSave = async () => {
    if (!formName.trim()) { setError("Name is required"); return; }
    if (formPrice <= 0) { setError("Combo price must be greater than 0"); return; }
    const validItems = formItems.filter((i) => i.productId && i.skuId && i.quantity > 0);
    if (validItems.length === 0) { setError("Add at least one item"); return; }
    setSaving(true);
    setError(null);
    try {
      const data = {
        name: formName.trim(),
        description: formDesc.trim(),
        images: formImages,
        price: formPrice,
        items: validItems.map((i) => ({ productId: i.productId, productName: i.productName, skuId: i.skuId, skuLabel: i.skuLabel, quantity: i.quantity })),
        isActive: true,
        updatedAt: new Date(),
      };
      if (editing) {
        await setDocument(`combos/${editing.id}`, data);
        if (staff) logActivity({ action: "Updated combo", details: `Updated combo "${data.name}"`, module: "Combos", staffId: staff.id, staffName: staff.name, relatedDocId: editing.id });
      } else {
        const ref = await addDocument("combos", { ...data, createdAt: new Date() });
        if (staff) logActivity({ action: "Created combo", details: `Created combo "${data.name}"`, module: "Combos", staffId: staff.id, staffName: staff.name, relatedDocId: ref });
      }
      setModalOpen(false);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Combo) => {
    if (!confirm(`Delete combo "${c.name}"?`)) return;
    try {
      await removeDocument(`combos/${c.id}`);
      if (staff) logActivity({ action: "Deleted combo", details: `Deleted combo "${c.name}"`, module: "Combos", staffId: staff.id, staffName: staff.name, relatedDocId: c.id });
    } catch (e: any) {
      alert(e.message || "Failed to delete");
    }
  };

  const individualTotal = sumIndividualPrices();
  const savings = individualTotal - formPrice;

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-6">
          <h1 className="font-heading text-lg font-bold text-text sm:text-xl">Combos</h1>
          {can("products.write") && (
            <button onClick={openNew} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">
              + New Combo
            </button>
          )}
        </div>

        <DataTable
          columns={[
            { key: "name", header: "Name", render: (c: Combo) => <span className="font-medium text-text">{c.name}</span> },
            { key: "price", header: "Price", render: (c: Combo) => <span>NPR {c.price.toLocaleString()}</span> },
            { key: "items", header: "Items", render: (c: Combo) => <span className="text-text-muted">{c.items.length} items</span> },
            {
              key: "active",
              header: "Active",
              render: (c: Combo) => (
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.isActive ? "bg-green-500" : "bg-gray-300"}`} />
              ),
            },
            {
              key: "actions",
              header: "",
              render: (c: Combo) => (
                can("products.write") ? (
                  <button onClick={() => handleDelete(c)} className="text-xs text-error hover:underline">Delete</button>
                ) : null
              ),
            },
          ]}
          data={combos}
          loading={loading}
          keyExtractor={(c: Combo) => c.id}
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Combo" : "New Combo"} onSave={handleSave} saving={saving} error={error} size="lg">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Name *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full rounded-input border border-border px-3 py-2 text-sm text-text outline-none focus:border-forest-green" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Description</label>
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full rounded-input border border-border px-3 py-2 text-sm text-text outline-none focus:border-forest-green" rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Images</label>
              <ImageUploader images={formImages} onChange={setFormImages} max={5} gasUrl={gasUrl} driveFolderId={driveFolderId} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Combo Price (NPR) *</label>
              <input type="number" min={0} value={formPrice} onChange={(e) => setFormPrice(Number(e.target.value))} className="w-full rounded-input border border-border px-3 py-2 text-sm text-text outline-none focus:border-forest-green" />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-text">Items</label>
                <button onClick={addItemRow} className="text-xs text-forest-green hover:underline">+ Add Item</button>
              </div>
              <div className="space-y-3">
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-btn bg-light-gray p-3">
                    <div className="flex-1 min-w-[140px]">
                      <label className="mb-1 block text-xs text-text-muted">Product</label>
                      <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)} className="w-full rounded-input border border-border px-2 py-1.5 text-sm text-text outline-none focus:border-forest-green">
                        <option value="">Select product</option>
                        {activeProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="mb-1 block text-xs text-text-muted">SKU</label>
                      <select value={item.skuId} onChange={(e) => updateItem(idx, "skuId", e.target.value)} className="w-full rounded-input border border-border px-2 py-1.5 text-sm text-text outline-none focus:border-forest-green" disabled={!item.productId}>
                        <option value="">Select SKU</option>
                        {getSkus(item.productId).filter((s) => s.isActive).map((s) => (
                          <option key={s.id} value={s.id}>{s.label} — NPR {s.price}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-16">
                      <label className="mb-1 block text-xs text-text-muted">Qty</label>
                      <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Math.max(1, Number(e.target.value)))} className="w-full rounded-input border border-border px-2 py-1.5 text-sm text-text outline-none focus:border-forest-green" />
                    </div>
                    {formItems.length > 1 && (
                      <button onClick={() => removeItemRow(idx)} className="pb-1 text-sm text-error hover:underline">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {formItems.some((i) => i.productId && i.skuId) && (
              <div className="rounded-btn bg-light-gray px-4 py-3 text-sm">
                <div className="flex justify-between text-text-muted">
                  <span>Individual total:</span>
                  <span>NPR {individualTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium text-text">
                  <span>Combo price:</span>
                  <span>NPR {formPrice.toLocaleString()}</span>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Savings:</span>
                    <span>NPR {savings.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </FormModal>
      </div>
    </AdminLayout>
  );
}
