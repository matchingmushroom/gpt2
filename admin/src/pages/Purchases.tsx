import { useState, useEffect, useRef } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import PurchaseDetailModal from "../components/PurchaseDetailModal";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, getDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import { getNextCounter } from "../utils/counters";
import type { Purchase, PurchaseItem, Supplier, Creditor, CreditorPurchaseRef, RawMaterial } from "../types";

export default function Purchases() {
  const { staff, can } = useStaff();
  const { data: purchases, loading } = useCollection<Purchase>("purchases");
  const { data: suppliers } = useCollection<Supplier>("suppliers");
  const { data: creditors } = useCollection<Creditor>("creditors");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const [formSupplierSearch, setFormSupplierSearch] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formSupplierName, setFormSupplierName] = useState("");
  const [formSupplierPhone, setFormSupplierPhone] = useState("");
  const [formSupplierAddress, setFormSupplierAddress] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [formItems, setFormItems] = useState<PurchaseItem[]>([]);
  const [formNotes, setFormNotes] = useState("");
  const [cashPaid, setCashPaid] = useState(0);
  const [formBillImage, setFormBillImage] = useState("");
  const [gasUrl, setGasUrl] = useState("");
  const [billsFolderId, setBillsFolderId] = useState("");
  const [uploadingBill, setUploadingBill] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);

  const subtotal = formItems.reduce((s, i) => s + i.totalPrice, 0);
  const due = Math.max(0, subtotal - cashPaid);

  useEffect(() => {
    getDocument("settings/backup").then((doc: any) => {
      if (doc?.gasUrl) setGasUrl(doc.gasUrl);
      if (doc?.billsFolderId) setBillsFolderId(doc.billsFolderId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredSuppliers = suppliers.filter(
    (s) => s.isActive && s.name.toLowerCase().includes(formSupplierSearch.toLowerCase())
  );

  const selectSupplier = (s: Supplier) => {
    setFormSupplierId(s.id);
    setFormSupplierName(s.name);
    setFormSupplierPhone(s.phone);
    setFormSupplierAddress(s.address);
    setFormSupplierSearch(s.name);
    setShowSupplierDropdown(false);
  };

  const addItem = () => setFormItems([...formItems, { materialName: "", quantity: 0, unit: "kg", unitPrice: 0, totalPrice: 0 }]);
  const updateItem = (i: number, field: keyof PurchaseItem, value: string | number) => {
    const next = [...formItems];
    next[i] = { ...next[i], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      const q = field === "quantity" ? Number(value) : next[i].quantity;
      const p = field === "unitPrice" ? Number(value) : next[i].unitPrice;
      next[i].totalPrice = q * p;
    }
    setFormItems(next);
  };

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!gasUrl) {
      const url = prompt("Paste Google Drive bill URL:");
      if (url) setFormBillImage(url);
      return;
    }
    setUploadingBill(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      const res = await fetch(gasUrl, {
        method: "POST",
        body: JSON.stringify({ action: "uploadBill", data: base64, fileName: file.name, folderId: billsFolderId || undefined }),
      });
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch {}
      if (parsed?.success && parsed?.data?.url) {
        setFormBillImage(parsed.data.url);
      } else if (text.startsWith("http")) {
        setFormBillImage(text);
      } else {
        throw new Error(parsed?.error || text || "Upload failed");
      }
    } catch {
      alert("Upload failed. Paste a Drive URL instead.");
    } finally {
      setUploadingBill(false);
    }
  };

  const handleSave = async () => {
    if (!staff || !can("purchases.write")) return;
    if (!formSupplierName.trim() || formItems.length === 0) { setError("Supplier and items required"); return; }
    setSaving(true); setError(null);
    try {
      const purchaseNumber = await getNextCounter("purchases");
      const paymentStatus = cashPaid >= subtotal ? "paid" : cashPaid > 0 ? "partial" : "credit";
      const id = await addDocument("purchases", {
        purchaseNumber,
        supplierId: formSupplierId || "",
        supplierName: formSupplierName.trim(),
        supplierPhone: formSupplierPhone,
        supplierAddress: formSupplierAddress,
        items: formItems.filter((i) => i.materialName),
        subtotal, discount: 0, grandTotal: subtotal,
        cashPaid, due,
        paymentStatus, paymentHistory: [],
        billImage: formBillImage, notes: formNotes, createdBy: staff.id,
      });

      if (formSupplierId) {
        await setDocument(`suppliers/${formSupplierId}`, {
          totalPurchased: (suppliers.find((s) => s.id === formSupplierId)?.totalPurchased ?? 0) + subtotal,
          lastPurchaseAt: new Date(),
        });
      }

      if (due > 0) {
        const supplierKey = formSupplierId || `manual-${formSupplierName.trim().toLowerCase().replace(/\s+/g, "-")}`;
        const existingCreditor = creditors.find(
          (c) => c.id === supplierKey || c.supplierName.toLowerCase() === formSupplierName.trim().toLowerCase()
        );
        const purchaseRef: CreditorPurchaseRef = {
          purchaseId: id,
          purchaseNumber,
          amount: subtotal,
          paidAmount: cashPaid,
          balance: due,
          date: new Date() as any,
        };
        if (existingCreditor) {
          await setDocument(`creditors/${existingCreditor.id}`, {
            purchases: [...existingCreditor.purchases, purchaseRef],
            totalOutstanding: (existingCreditor.totalOutstanding ?? 0) + due,
            updatedAt: new Date(),
          });
        } else {
          await addDocument("creditors", {
            supplierName: formSupplierName.trim(),
            supplierPhone: formSupplierPhone,
            totalOutstanding: due,
            purchases: [purchaseRef],
            paymentHistory: [],
            clearedAt: null,
          });
        }
      }

      for (const item of formItems.filter((i) => i.materialName.trim())) {
        const rawId = item.materialName.trim().toLowerCase().replace(/\s+/g, "-");
        const existing = await getDocument<RawMaterial>(`rawMaterials/${rawId}`);
        const newQty = item.quantity;
        const newCost = item.unitPrice;
        if (existing) {
          const totalVal = existing.quantity * existing.avgUnitCost + newQty * newCost;
          const totalQty = existing.quantity + newQty;
          const avgUnitCost = totalQty > 0 ? totalVal / totalQty : 0;
          await setDocument(`rawMaterials/${rawId}`, {
            name: item.materialName.trim(),
            unit: item.unit,
            quantity: totalQty,
            avgUnitCost: Math.round(avgUnitCost * 100) / 100,
            totalValue: Math.round(totalVal * 100) / 100,
          });
        } else {
          await setDocument(`rawMaterials/${rawId}`, {
            name: item.materialName.trim(),
            unit: item.unit,
            quantity: newQty,
            avgUnitCost: newCost,
            totalValue: newQty * newCost,
          });
        }
      }

      logActivity({ action: "Created purchase", details: `Created purchase ${purchaseNumber} from '${formSupplierName}' (paid: ${cashPaid}, due: ${due})`, module: "Purchases", staffId: staff.id, staffName: staff.name, relatedDocId: id });
      invalidateCache(["pnl", "stock", "purchases", "creditors", "rawMaterials"]);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const openNew = () => {
    setError(null);
    setFormSupplierSearch("");
    setFormSupplierId("");
    setFormSupplierName("");
    setFormSupplierPhone("");
    setFormSupplierAddress("");
    setFormItems([]);
    setFormNotes("");
    setCashPaid(0);
    setFormBillImage("");
    setModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Purchases</h1>
            <p className="text-sm text-text-light">Raw material purchase records</p>
          </div>
          {can("purchases.write") && <button onClick={openNew} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white">+ New Purchase</button>}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={(() => {
            const cols: any[] = [
              { key: "purchaseNumber", header: "ID", render: (p: Purchase) => (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-text">{p.purchaseNumber}</span>
                  {p.billImage && <a href={p.billImage} target="_blank" rel="noopener noreferrer" className="text-xs text-info hover:underline" title="View bill">🧾</a>}
                </div>
              ), sortable: true },
              { key: "supplier", header: "Supplier", render: (p: Purchase) => <span className="text-text-light">{p.supplierName}</span> },
              { key: "items", header: "Items", render: (p: Purchase) => <span className="text-text-light">{p.items.length}</span> },
            ];
            if (staff?.role !== "production_staff") {
              cols.push(
                { key: "total", header: "Total", render: (p: Purchase) => <span className="font-medium text-forest-green">NPR {p.grandTotal.toLocaleString()}</span> },
                { key: "cashPaid", header: "Paid", render: (p: Purchase) => <span className="text-text-light">NPR {(p as any).cashPaid?.toLocaleString() ?? "—"}</span> },
                { key: "due", header: "Due", render: (p: Purchase) => {
                  const d = (p as any).due ?? 0;
                  return d > 0 ? <span className="font-medium text-warning">NPR {d.toLocaleString()}</span> : <span className="text-success">—</span>;
                }},
              );
            }
            cols.push({ key: "status", header: "Status", render: (p: Purchase) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                p.paymentStatus === "paid" ? "bg-success/10 text-success" :
                p.paymentStatus === "partial" ? "bg-warning/10 text-warning" :
                "bg-error/10 text-error"
              }`}>{p.paymentStatus}</span>
            )});
            return cols;
          })()}
          data={purchases}
          keyExtractor={(p) => p.id}
          onRowClick={setSelectedPurchase}
          loading={loading}
          emptyMessage="No purchases yet"
          emptyIcon="📥"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase" onSave={handleSave} saving={saving} size="lg">
          <div className="space-y-4">
            <div ref={supplierRef} className="relative">
              <label className="mb-1 block text-sm font-medium text-text">Supplier *</label>
              <input
                value={formSupplierSearch}
                onChange={(e) => { setFormSupplierSearch(e.target.value); setFormSupplierId(""); setShowSupplierDropdown(true); }}
                onFocus={() => setShowSupplierDropdown(true)}
                placeholder="Type supplier name or select from list..."
                className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
              />
              {showSupplierDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                  {filteredSuppliers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSupplier(s)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-beige/50"
                    >
                      <span className="font-medium text-text">{s.name}</span>
                      <span className="text-xs text-text-muted">{s.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {formSupplierId && (
                <p className="mt-1 text-xs text-forest-green">Selected: {formSupplierName} — {formSupplierPhone}</p>
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Phone</label><input value={formSupplierPhone} onChange={(e) => setFormSupplierPhone(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium text-text">Address</label><input value={formSupplierAddress} onChange={(e) => setFormSupplierAddress(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" /></div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Bill Image</label>
              <div className="flex items-center gap-3">
                <input value={formBillImage} onChange={(e) => setFormBillImage(e.target.value)} placeholder="Drive URL or upload..." className="flex-1 rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" />
                <label className="flex cursor-pointer items-center gap-1 rounded-btn border border-border px-3 py-2 text-sm text-text-light transition-colors hover:border-forest-green hover:text-forest-green">
                  <span>📎</span>
                  <span>{uploadingBill ? "Uploading..." : "Upload"}</span>
                  <input type="file" accept="image/*" onChange={handleBillUpload} className="hidden" disabled={uploadingBill} />
                </label>
                {formBillImage && (
                  <a href={formBillImage} target="_blank" rel="noopener noreferrer" className="text-sm text-info hover:underline">View</a>
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-text">Items</h3><button type="button" onClick={addItem} className="text-xs text-info">+ Add Item</button></div>
              {formItems.map((item, i) => (
                <div key={i} className="mb-2 flex gap-2 rounded-lg border border-border p-2">
                  <input value={item.materialName} onChange={(e) => updateItem(i, "materialName", e.target.value)} className="flex-1 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green" placeholder="Material name" />
                  <input value={item.quantity || ""} onChange={(e) => updateItem(i, "quantity", Number(e.target.value) || 0)} type="number" className="w-16 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green" placeholder="Qty" />
                  <select value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} className="w-16 rounded-input border border-border px-1 py-1 text-xs outline-none focus:border-forest-green">
                    <option value="kg">kg</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Gm">Gm</option>
                    <option value="pieces">pcs</option>
                  </select>
                  <input value={item.unitPrice || ""} onChange={(e) => updateItem(i, "unitPrice", Number(e.target.value) || 0)} type="number" className="w-20 rounded-input border border-border px-2 py-1 text-xs outline-none focus:border-forest-green" placeholder="Price" />
                  <span className="flex items-center text-xs font-medium text-forest-green">NPR {item.totalPrice.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-semibold text-text">Payment</h3>
              <div className="rounded-lg border border-border bg-beige/20 p-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-text">Total Bill Amount</span>
                  <span className="font-bold text-forest-green">NPR {subtotal.toLocaleString()}</span>
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-sm font-medium text-text">Cash Paid</label>
                  <input
                    value={cashPaid}
                    onChange={(e) => setCashPaid(e.target.value === "" ? 0 : Number(e.target.value))}
                    type="number"
                    min="0"
                    className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
                  />
                </div>
                {due > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-error/10 px-3 py-2 text-sm">
                    <span className="font-medium text-error">Due</span>
                    <span className="font-bold text-error">NPR {due.toLocaleString()}</span>
                  </div>
                )}
                {due === 0 && subtotal > 0 && (
                  <p className="text-xs text-success">Fully paid</p>
                )}
              </div>
            </div>
            <div><label className="mb-1 block text-sm font-medium text-text">Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={2} /></div>
          </div>
        </FormModal>

        <PurchaseDetailModal purchase={selectedPurchase} onClose={() => setSelectedPurchase(null)} />
      </div>
    </AdminLayout>
  );
}
