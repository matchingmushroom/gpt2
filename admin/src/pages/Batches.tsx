import { useState } from "react";
import { increment } from "firebase/firestore";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import BatchDetailModal from "../components/BatchDetailModal";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, updateDocument, getDocument, listenCollection } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import { getNextCounter } from "../utils/counters";
import type { Batch, Product, SKU, BatchItem, RawMaterial, RawMaterialUsage, Blend, BlendUsage } from "../types";

interface ConsumeItem {
  materialId: string;
  materialName: string;
  unit: string;
  availableQty: number;
  consumeQty: number;
  isBlend: boolean;
}

interface SkuEntry {
  skuId: string;
  skuCode: string;
  label: string;
  weightInGrams: number;
  qty: number;
}

export default function Batches() {
  const { staff, can } = useStaff();
  const { data: batches, loading } = useCollection<Batch>("batches");
  const { data: products } = useCollection<Product>("products");
  const { data: rawMaterials } = useCollection<RawMaterial>("rawMaterials");
  const { data: blends } = useCollection<Blend>("blends");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formProduct, setFormProduct] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [consumeBatch, setConsumeBatch] = useState<Batch | null>(null);
  const [consumeItems, setConsumeItems] = useState<ConsumeItem[]>([]);
  const [consumeModalOpen, setConsumeModalOpen] = useState(false);

  const [skuEntryBatch, setSkuEntryBatch] = useState<Batch | null>(null);
  const [skuEntries, setSkuEntries] = useState<SkuEntry[]>([]);
  const [skuModalOpen, setSkuModalOpen] = useState(false);

  const [viewDetail, setViewDetail] = useState<Batch | null>(null);

  const handleSave = async () => {
    if (!staff || !can("batches.write")) return;
    if (!formProduct) { setError("Select a product"); return; }
    setSaving(true); setError(null);
    try {
      const product = products.find((p) => p.id === formProduct);
      const batchNumber = await getNextCounter("batches");
      const id = await addDocument("batches", {
        batchNumber,
        productId: formProduct,
        productName: product?.name ?? "",
        items: [],
        totalCost: 0,
        rawMaterialUsage: [],
        linkedPurchaseId: null,
        notes: formNotes,
        status: "start",
        createdBy: staff.id,
      });
      logActivity({
        action: "Created batch",
        details: `Created batch ${batchNumber} for '${product?.name}'`,
        module: "Batches",
        staffId: staff.id,
        staffName: staff.name,
        relatedDocId: id,
      });
      invalidateCache(["stock"]);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const openConsume = (batch: Batch) => {
    setConsumeBatch(batch);
    const rmItems = rawMaterials.map((rm) => {
      const alreadyUsed = (batch.rawMaterialUsage || []).find((u) => u.materialId === rm.id);
      return {
        materialId: rm.id,
        materialName: rm.name,
        unit: rm.unit,
        availableQty: rm.quantity - (alreadyUsed?.quantity || 0),
        consumeQty: 0,
        isBlend: false,
      };
    }).filter((i) => i.availableQty > 0);
    const blendItems = blends.map((bl) => {
      const alreadyUsed = (batch.blendUsage || []).find((u) => u.blendId === bl.id);
      return {
        materialId: bl.id,
        materialName: bl.name,
        unit: "gm",
        availableQty: bl.quantity - (alreadyUsed?.quantity || 0),
        consumeQty: 0,
        isBlend: true,
      };
    }).filter((i) => i.availableQty > 0);
    setConsumeItems([...rmItems, ...blendItems]);
    setConsumeModalOpen(true);
    setError(null);
  };

  const isAdmin = staff?.role === "super_admin" || staff?.role === "manager";

  const handleStatusChangeSave = async (batch: Batch, newStatus: string, revertInventory: boolean) => {
    if (!staff || !can("batches.write") || newStatus === batch.status) return;

    setSaving(true); setError(null);
    try {
      if (revertInventory) {
        for (const item of batch.items) {
          await updateDocument(`products/${batch.productId}/skus/${item.skuId}`, {
            stock: increment(-item.quantity),
          });
        }
        for (const usage of batch.rawMaterialUsage || []) {
          const rm = await getDocument<RawMaterial>(`rawMaterials/${usage.materialId}`);
          if (rm) {
            const newQty = rm.quantity + usage.quantity;
            await setDocument(`rawMaterials/${usage.materialId}`, {
              quantity: newQty,
              totalValue: newQty * rm.avgUnitCost,
            });
          }
        }
        for (const usage of batch.blendUsage || []) {
          const bl = await getDocument<Blend>(`blends/${usage.blendId}`);
          if (bl) {
            const newQty = bl.quantity + usage.quantity;
            await setDocument(`blends/${usage.blendId}`, {
              quantity: newQty,
              totalValue: newQty * (bl.avgCostPerKg / 1000),
            });
          }
        }
      }

      await setDocument(`batches/${batch.id}`, { status: newStatus });
      logActivity({
        action: `Batch status changed to ${newStatus}`,
        details: `Batch ${batch.batchNumber} for '${batch.productName}' changed to ${newStatus}${revertInventory ? " (inventory reversed)" : ""}`,
        module: "Batches",
        staffId: staff.id,
        staffName: staff.name,
        relatedDocId: batch.id,
      });
      invalidateCache(["stock", "rawMaterials"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change status");
      throw err;
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (batch: Batch, status: "cancelled") => {
    if (!staff || !can("batches.write")) return;
    if (!confirm(`Cancel batch ${batch.batchNumber}?`)) return;
    setSaving(true);
    try {
      await setDocument(`batches/${batch.id}`, { status });
      logActivity({
        action: `Batch cancelled`,
        details: `Batch ${batch.batchNumber} for '${batch.productName}' cancelled`,
        module: "Batches",
        staffId: staff.id,
        staffName: staff.name,
        relatedDocId: batch.id,
      });
      invalidateCache(["stock"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally { setSaving(false); }
  };

  const handleConsumeSave = async () => {
    if (!staff || !can("batches.write") || !consumeBatch) return;
    const usage = consumeItems.filter((i) => i.consumeQty > 0);
    if (usage.length === 0) { setError("Enter at least one material quantity"); return; }
    const overuse = usage.find((i) => i.consumeQty > i.availableQty);
    if (overuse) { setError(`Not enough ${overuse.materialName}: available ${overuse.availableQty} ${overuse.unit}, trying to consume ${overuse.consumeQty}`); return; }
    setSaving(true); setError(null);
    try {
      const rawUsage: RawMaterialUsage[] = [];
      const blendUsage: BlendUsage[] = [];
      for (const item of usage) {
        if (item.isBlend) {
          const bl = blends.find((b) => b.id === item.materialId);
          if (!bl) continue;
          const unitCost = bl.avgCostPerKg / 1000;
          const totalCost = item.consumeQty * unitCost;
          blendUsage.push({
            blendId: item.materialId,
            blendName: item.materialName,
            quantity: item.consumeQty,
            unitCost: Math.round(unitCost * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
          });
          const newQty = bl.quantity - item.consumeQty;
          await setDocument(`blends/${item.materialId}`, {
            quantity: newQty,
            totalValue: newQty * (bl.avgCostPerKg / 1000),
          });
        } else {
          const rm = rawMaterials.find((r) => r.id === item.materialId);
          if (!rm) continue;
          const unitCost = rm.avgUnitCost;
          const totalCost = item.consumeQty * unitCost;
          rawUsage.push({
            materialId: item.materialId,
            materialName: item.materialName,
            quantity: item.consumeQty,
            unit: item.unit,
            unitCost: Math.round(unitCost * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
          });
          const newQty = rm.quantity - item.consumeQty;
          await setDocument(`rawMaterials/${item.materialId}`, {
            quantity: newQty,
            totalValue: newQty * rm.avgUnitCost,
          });
        }
      }
      const existingUsage = consumeBatch.rawMaterialUsage || [];
      const allUsage = [...existingUsage, ...rawUsage];
      const existingBlendUsage = consumeBatch.blendUsage || [];
      const allBlendUsage = [...existingBlendUsage, ...blendUsage];
      const rawCost = allUsage.reduce((s, u) => s + u.totalCost, 0);
      const blendCost = allBlendUsage.reduce((s, u) => s + u.totalCost, 0);

      const updates: Record<string, unknown> = {
        rawMaterialUsage: allUsage,
        blendUsage: allBlendUsage,
        totalCost: Math.round((rawCost + blendCost) * 100) / 100,
      };
      if (consumeBatch.status === "start") {
        updates.status = "in_progress";
      }

      await setDocument(`batches/${consumeBatch.id}`, updates);
      const consumedList = [
        ...rawUsage.map((u) => `${u.quantity} ${u.unit} ${u.materialName}`),
        ...blendUsage.map((u) => `${u.quantity}g ${u.blendName}`),
      ];
      logActivity({
        action: "Consumed materials",
        details: `Batch ${consumeBatch.batchNumber}: ${consumedList.join(", ")}`,
        module: "Batches",
        staffId: staff.id,
        staffName: staff.name,
        relatedDocId: consumeBatch.id,
      });
      invalidateCache(["stock", "rawMaterials"]);
      setConsumeModalOpen(false);
      setConsumeBatch(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to consume");
    } finally { setSaving(false); }
  };

  const openSkuEntry = async (batch: Batch) => {
    const hasMaterial = (batch.rawMaterialUsage || []).length > 0 || (batch.blendUsage || []).length > 0;
    if (!hasMaterial) {
      setError("Request raw materials or blend before entering SKU production");
      return;
    }
    setSkuEntryBatch(batch);
    const allSkus = await new Promise<SKU[]>((resolve) => {
      const unsub = listenCollection<SKU>(
        `products/${batch.productId}/skus`, (data) => { resolve(data); setTimeout(unsub, 0); }
      );
    });
    const existing = batch.items || [];
    setSkuEntries(
      allSkus.map((s) => {
        const existingItem = existing.find((i) => i.skuId === s.id);
        return {
          skuId: s.id,
          skuCode: s.skuCode,
          label: s.label,
          weightInGrams: s.weightInGrams,
          qty: existingItem?.quantity || 0,
        };
      })
    );
    setSkuModalOpen(true);
    setError(null);
  };

  const handleSkuSubmit = async () => {
    if (!staff || !can("batches.write") || !skuEntryBatch) return;
    const withQty = skuEntries.filter((e) => e.qty > 0);
    if (withQty.length === 0) { setError("Enter quantity for at least one SKU"); return; }

    const totalWeight = withQty.reduce((s, e) => s + e.qty * e.weightInGrams, 0);
    if (totalWeight <= 0) { setError("Total production weight must be greater than 0"); return; }

    const allUsage = skuEntryBatch.rawMaterialUsage || [];
    const allBlendUsage = skuEntryBatch.blendUsage || [];
    const rawMaterialCost = allUsage.reduce((s, u) => s + u.totalCost, 0) + allBlendUsage.reduce((s, u) => s + u.totalCost, 0);
    if (rawMaterialCost <= 0) { setError("No material cost recorded"); return; }

    const costPerGram = rawMaterialCost / totalWeight;
    const items: BatchItem[] = withQty.map((e) => ({
      skuId: e.skuId,
      skuCode: e.skuCode,
      label: e.label,
      quantity: e.qty,
      unitCost: Math.round(e.weightInGrams * costPerGram * 100) / 100,
    }));

    setSaving(true); setError(null);
    try {
      await setDocument(`batches/${skuEntryBatch.id}`, {
        items,
        totalCost: Math.round(rawMaterialCost * 100) / 100,
        status: "completed",
      });

      for (const item of items) {
        await updateDocument(`products/${skuEntryBatch.productId}/skus/${item.skuId}`, {
          stock: increment(item.quantity),
        });
      }

      logActivity({
        action: "Batch completed",
        details: `Batch ${skuEntryBatch.batchNumber}: ${items.map((i) => `${i.quantity}× ${i.label}`).join(", ")}`,
        module: "Batches",
        staffId: staff.id,
        staffName: staff.name,
        relatedDocId: skuEntryBatch.id,
      });
      invalidateCache(["stock", "rawMaterials"]);
      setSkuModalOpen(false);
      setSkuEntryBatch(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save production");
    } finally { setSaving(false); }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Production Batches</h1>
            <p className="text-sm text-text-light">Track batch production runs</p>
          </div>
          {can("batches.write") && (
            <button
              onClick={() => { setError(null); setFormProduct(""); setFormNotes(""); setModalOpen(true); }}
              className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white"
            >
              + New Batch
            </button>
          )}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "batchNumber", header: "Batch #", render: (b: Batch) => <span className="font-mono text-xs font-medium text-text">{b.batchNumber}</span>, sortable: true },
            { key: "product", header: "Product", render: (b: Batch) => <span className="text-text-light">{b.productName}</span> },
            { key: "items", header: "Items", render: (b: Batch) => (
              b.items.length > 0
                ? <span className="text-text-light">{b.items.length}</span>
                : <span className="text-xs text-text-muted">—</span>
            )},
            { key: "materialUsed", header: "Materials", render: (b: Batch) => {
              const count = (b.rawMaterialUsage || []).length;
              return count > 0
                ? <span className="text-xs text-info">{count} used</span>
                : <span className="text-xs text-text-muted">—</span>;
            }},
            { key: "cost", header: "Total Cost", render: (b: Batch) => (
              <span className="font-medium text-forest-green">NPR {b.totalCost.toLocaleString()}</span>
            )},
            { key: "status", header: "Status", render: (b: Batch) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                b.status === "completed" ? "bg-success/10 text-success" :
                b.status === "cancelled" ? "bg-error/10 text-error" :
                b.status === "in_progress" ? "bg-info/10 text-info" :
                "bg-warning/10 text-warning"
              }`}>{b.status.replace("_", " ")}</span>
            )},
            { key: "actions", header: "Next Step", render: (b: Batch) => {
              let nextBtn = null;
              if (b.status === "start" && can("batches.write")) {
                nextBtn = (
                  <button
                    onClick={(e) => { e.stopPropagation(); openConsume(b); }}
                    className="rounded-btn border border-mustard-gold px-2.5 py-1 text-xs font-medium text-mustard-gold transition-colors hover:bg-mustard-gold/10"
                  >
                    Request Materials →
                  </button>
                );
              } else if (b.status === "in_progress" && can("batches.write")) {
                nextBtn = (
                  <button
                    onClick={(e) => { e.stopPropagation(); openSkuEntry(b); }}
                    className="rounded-btn border border-forest-green px-2.5 py-1 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green/10"
                  >
                    Enter SKUs →
                  </button>
                );
              } else {
                nextBtn = (
                  <span className="text-xs text-text-muted">—</span>
                );
              }
              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewDetail(b); }}
                    className="flex h-7 w-7 items-center justify-center rounded-btn border border-border text-xs transition-colors hover:border-forest-green hover:text-forest-green"
                    title="View details"
                  >
                    👁
                  </button>
                  {nextBtn}
                </div>
              );
            }, width: "220px" },
          ]}
          data={batches}
          keyExtractor={(b) => b.id}
          loading={loading}
          emptyMessage="No batches yet"
          emptyIcon="🏭"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Production Batch" onSave={handleSave} saving={saving} size="md">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Product *</label>
              <select
                value={formProduct}
                onChange={(e) => setFormProduct(e.target.value)}
                className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
                required
              >
                <option value="">Select a product...</option>
                {products.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Notes</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
                rows={3}
              />
            </div>
          </div>
        </FormModal>

        <FormModal
          open={consumeModalOpen}
          onClose={() => { setConsumeModalOpen(false); setConsumeBatch(null); }}
          title={`${consumeBatch?.status === "start" ? "Request" : "Consume"} Raw Materials — ${consumeBatch?.batchNumber || ""}`}
          onSave={handleConsumeSave}
          saving={saving}
          size="md"
        >
          {consumeItems.length === 0 ? (
            <p className="text-sm text-text-muted">No raw materials available to consume. Purchase stock first.</p>
          ) : (
            <div className="space-y-3">
              {consumeItems.map((item, i) => (
                <div key={item.materialId} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {item.isBlend && (
                        <span className="rounded-full bg-mustard-gold/10 px-1.5 py-0.5 text-xs font-medium text-mustard-gold">Blend</span>
                      )}
                      <span className="text-sm font-medium text-text">{item.materialName}</span>
                    </div>
                    <span className="text-xs text-text-muted">({item.availableQty} {item.unit} avail)</span>
                  </div>
                  <input
                    value={item.consumeQty || ""}
                    onChange={(e) => {
                      const next = [...consumeItems];
                      next[i] = { ...next[i], consumeQty: Math.min(Number(e.target.value) || 0, item.availableQty) };
                      setConsumeItems(next);
                    }}
                    type="number"
                    max={item.availableQty}
                    className="w-20 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green"
                    placeholder="Qty"
                  />
                </div>
              ))}
            </div>
          )}
        </FormModal>

        <FormModal
          open={skuModalOpen}
          onClose={() => { setSkuModalOpen(false); setSkuEntryBatch(null); }}
          title={`Enter SKU Production — ${skuEntryBatch?.batchNumber || ""}`}
          onSave={handleSkuSubmit}
          saving={saving}
          size="md"
        >
          {skuEntries.length === 0 ? (
            <p className="text-sm text-text-muted">No SKUs found for this product</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">Enter the quantity produced for each SKU. Costs are auto-calculated from raw material costs.</p>
              {skuEntries.map((entry, i) => (
                <div key={entry.skuId} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-text">{entry.label}</span>
                    <span className="ml-2 text-xs text-text-muted">({entry.weightInGrams}g each)</span>
                  </div>
                  <input
                    value={entry.qty || ""}
                    onChange={(e) => {
                      const next = [...skuEntries];
                      next[i] = { ...next[i], qty: Number(e.target.value) || 0 };
                      setSkuEntries(next);
                    }}
                    type="number"
                    className="w-20 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green"
                    placeholder="Qty"
                  />
                </div>
              ))}
            </div>
          )}
        </FormModal>

        {viewDetail && (
          <BatchDetailModal
            batch={viewDetail}
            onClose={() => setViewDetail(null)}
            onStatusChange={handleStatusChangeSave}
          />
        )}
      </div>
    </AdminLayout>
  );
}
