import { useState } from "react";
import { useStaff } from "../hooks/useStaff";
import type { Batch } from "../types";

const BATCH_STATUSES = [
  { value: "start", label: "Start" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface BatchDetailModalProps {
  batch: Batch;
  onClose: () => void;
  onStatusChange: (batch: Batch, newStatus: string, revertInventory: boolean) => Promise<void>;
}

export default function BatchDetailModal({ batch, onClose, onStatusChange }: BatchDetailModalProps) {
  const { staff } = useStaff();
  const isProductionStaff = staff?.role === "production_staff";
  const isAdmin = staff?.role === "super_admin" || staff?.role === "manager";
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusValue, setStatusValue] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  const canEdit = !isProductionStaff && (
    isAdmin || (batch.status !== "completed" && batch.status !== "cancelled")
  );

  const availableStatuses = BATCH_STATUSES.filter((s) => {
    if (s.value === batch.status) return false;
    if (isAdmin) return true;
    if (batch.status === "start") return s.value === "in_progress" || s.value === "cancelled";
    if (batch.status === "in_progress") return s.value === "completed" || s.value === "cancelled";
    return false;
  });

  const handleStatusSubmit = async () => {
    if (!statusValue) return;
    setStatusSaving(true);
    try {
      const revertInventory = batch.status === "completed";
      await onStatusChange(batch, statusValue, revertInventory);
      setStatusOpen(false);
    } catch {
      // error handled upstream
    } finally {
      setStatusSaving(false);
    }
  };

  const skuCost = batch.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const matCost = (batch.rawMaterialUsage || []).reduce((s, u) => s + u.totalCost, 0);
  const blendMatCost = (batch.blendUsage || []).reduce((s, u) => s + u.totalCost, 0);
  const totalMatCost = matCost + blendMatCost;
  const totalSkuQty = batch.items.reduce((s, i) => s + i.quantity, 0);

  const statusColor: Record<string, string> = {
    start: "bg-warning/10 text-warning",
    in_progress: "bg-info/10 text-info",
    completed: "bg-success/10 text-success",
    cancelled: "bg-error/10 text-error",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-text">{batch.batchNumber}</h2>
            <p className="text-sm text-text-light">{batch.productName}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-1.5">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[batch.status] || "bg-light-gray text-text-muted"}`}>
                {batch.status.replace("_", " ")}
              </span>
              {canEdit && !statusOpen && (
                <button
                  onClick={() => { setStatusValue(""); setStatusOpen(true); }}
                  className="flex h-5 w-5 items-center justify-center rounded text-text-muted transition-colors hover:text-text"
                  title="Change status"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  </svg>
                </button>
              )}
              {statusOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-white p-3 shadow-xl">
                  <p className="mb-2 text-xs text-text-muted">Change status:</p>
                  <select
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value)}
                    className="mb-2 w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green"
                  >
                    <option value="">Select...</option>
                    {availableStatuses.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {batch.status === "completed" && isAdmin && (
                    <p className="mb-2 text-xs text-warning">Un-completing reverses inventory</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleStatusSubmit}
                      disabled={!statusValue || statusSaving}
                      className="rounded-btn bg-forest-green px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {statusSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setStatusOpen(false)}
                      className="rounded-btn border border-border px-3 py-1 text-xs text-text-light"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-lg text-text-muted hover:text-text">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className={`grid gap-4 ${isProductionStaff ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
            <div className="rounded-lg bg-light-gray p-3">
              <p className="text-xs text-text-muted">SKU Types</p>
              <p className="mt-1 text-lg font-bold text-text">{batch.items.length}</p>
            </div>
            <div className="rounded-lg bg-light-gray p-3">
              <p className="text-xs text-text-muted">Total Produced</p>
              <p className="mt-1 text-lg font-bold text-text">{totalSkuQty} units</p>
            </div>
            {!isProductionStaff && (
              <>
                <div className="rounded-lg bg-light-gray p-3">
                  <p className="text-xs text-text-muted">SKU Cost</p>
                  <p className="mt-1 text-lg font-bold text-forest-green">NPR {skuCost.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-light-gray p-3">
                  <p className="text-xs text-text-muted">Raw Mat. Cost</p>
                  <p className="mt-1 text-lg font-bold text-mustard-gold">NPR {matCost.toLocaleString()}</p>
                </div>
                {blendMatCost > 0 && (
                  <div className="rounded-lg bg-light-gray p-3">
                    <p className="text-xs text-text-muted">Blend Cost</p>
                    <p className="mt-1 text-lg font-bold text-mustard-gold">NPR {blendMatCost.toLocaleString()}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-semibold text-text">SKUs Produced</h3>
            </div>
            {batch.items.length === 0 ? (
              <p className="p-4 text-sm text-text-muted">No SKUs recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-light-gray text-left text-xs text-text-muted">
                      <th className="px-4 py-2 font-medium">SKU</th>
                      <th className="px-4 py-2 font-medium">Qty</th>
                      {!isProductionStaff && <th className="px-4 py-2 font-medium text-right">Unit Cost</th>}
                      {!isProductionStaff && <th className="px-4 py-2 font-medium text-right">Subtotal</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {batch.items.map((item) => (
                      <tr key={item.skuId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium text-text">{item.label}</td>
                        <td className="px-4 py-2.5 text-text-light">{item.quantity}</td>
                        {!isProductionStaff && (
                          <td className="px-4 py-2.5 text-right text-text-light">NPR {item.unitCost.toLocaleString()}</td>
                        )}
                        {!isProductionStaff && (
                          <td className="px-4 py-2.5 text-right font-medium text-text">NPR {(item.quantity * item.unitCost).toLocaleString()}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-medium">
                      <td className="px-4 py-2.5 text-text">{batch.items.length} SKUs</td>
                      <td className="px-4 py-2.5 text-text">{totalSkuQty}</td>
                      {!isProductionStaff && <td className="px-4 py-2.5 text-right text-text">—</td>}
                      {!isProductionStaff && <td className="px-4 py-2.5 text-right text-forest-green">NPR {skuCost.toLocaleString()}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-white">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-semibold text-text">Raw Materials Consumed</h3>
            </div>
            {!batch.rawMaterialUsage || batch.rawMaterialUsage.length === 0 ? (
              <p className="p-4 text-sm text-text-muted">No raw materials consumed yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-light-gray text-left text-xs text-text-muted">
                      <th className="px-4 py-2 font-medium">Material</th>
                      <th className="px-4 py-2 font-medium">Qty</th>
                      {!isProductionStaff && <th className="px-4 py-2 font-medium text-right">Unit Cost</th>}
                      {!isProductionStaff && <th className="px-4 py-2 font-medium text-right">Total</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {batch.rawMaterialUsage.map((u) => (
                      <tr key={u.materialId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium text-text">{u.materialName}</td>
                        <td className="px-4 py-2.5 text-text-light">{u.quantity} {u.unit}</td>
                        {!isProductionStaff && (
                          <td className="px-4 py-2.5 text-right text-text-light">NPR {u.unitCost.toLocaleString()}</td>
                        )}
                        {!isProductionStaff && (
                          <td className="px-4 py-2.5 text-right font-medium text-text">NPR {u.totalCost.toLocaleString()}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {!isProductionStaff && (
                    <tfoot>
                      <tr className="border-t border-border font-medium">
                        <td className="px-4 py-2.5 text-text">{batch.rawMaterialUsage.length} materials</td>
                        <td className="px-4 py-2.5 text-text">—</td>
                        <td className="px-4 py-2.5 text-right text-text">—</td>
                        <td className="px-4 py-2.5 text-right text-mustard-gold">NPR {matCost.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {batch.blendUsage && batch.blendUsage.length > 0 && (
            <div className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-text">Blends Consumed</h3>
                  <span className="rounded-full bg-mustard-gold/10 px-1.5 py-0.5 text-xs font-medium text-mustard-gold">Blend</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-light-gray text-left text-xs text-text-muted">
                      <th className="px-4 py-2 font-medium">Blend</th>
                      <th className="px-4 py-2 font-medium text-right">Qty</th>
                      {!isProductionStaff && <th className="px-4 py-2 font-medium text-right">Unit Cost</th>}
                      {!isProductionStaff && <th className="px-4 py-2 font-medium text-right">Total</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {batch.blendUsage.map((u) => (
                      <tr key={u.blendId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium text-text">{u.blendName}</td>
                        <td className="px-4 py-2.5 text-right text-text-light">{u.quantity} g</td>
                        {!isProductionStaff && (
                          <td className="px-4 py-2.5 text-right text-text-light">NPR {u.unitCost.toLocaleString()}</td>
                        )}
                        {!isProductionStaff && (
                          <td className="px-4 py-2.5 text-right font-medium text-text">NPR {u.totalCost.toLocaleString()}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {!isProductionStaff && (
                    <tfoot>
                      <tr className="border-t border-border font-medium">
                        <td className="px-4 py-2.5 text-text">{batch.blendUsage.length} blends</td>
                        <td className="px-4 py-2.5 text-right text-text">—</td>
                        <td className="px-4 py-2.5 text-right text-text">—</td>
                        <td className="px-4 py-2.5 text-right text-mustard-gold">NPR {blendMatCost.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {batch.notes && (
            <div className="rounded-lg border border-border bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-text">Notes</h3>
              <p className="text-sm text-text-light whitespace-pre-wrap">{batch.notes}</p>
            </div>
          )}

          {!isProductionStaff && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-light-gray p-4">
              <span className="text-sm font-medium text-text">Total Batch Cost</span>
              <span className="text-xl font-bold text-forest-green">NPR {batch.totalCost.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
