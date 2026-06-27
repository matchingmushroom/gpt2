import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import SupplierForm from "../components/SupplierForm";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import type { Supplier } from "../types";

export default function Suppliers() {
  const { staff, can } = useStaff();
  const { data: suppliers, loading } = useCollection<Supplier>("suppliers");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenNew = () => {
    setEditing(null);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditing(s);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (data: Partial<Supplier>) => {
    if (!staff) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await setDocument(`suppliers/${editing.id}`, data);
        logActivity({ action: "Updated supplier", details: `Updated supplier '${data.name}'`, module: "Suppliers", staffId: staff.id, staffName: staff.name, relatedDocId: editing.id });
      } else {
        await addDocument("suppliers", { ...data, totalPurchased: 0, lastPurchaseAt: null });
        logActivity({ action: "Created supplier", details: `Created supplier '${data.name}'`, module: "Suppliers", staffId: staff.id, staffName: staff.name });
      }
      invalidateCache(["purchases"]);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      console.error("Supplier save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Suppliers</h1>
            <p className="text-sm text-text-light">Manage your suppliers</p>
          </div>
          {can("suppliers.write") && (
            <button onClick={handleOpenNew} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">+ Add Supplier</button>
          )}
        </div>
        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "name", header: "Name", render: (s: Supplier) => <span className="font-medium text-text">{s.name}</span>, sortable: true },
            { key: "phone", header: "Phone", render: (s: Supplier) => <span className="text-text-light">{s.phone}</span> },
            { key: "address", header: "Address", render: (s: Supplier) => <span className="text-text-light">{s.address}</span> },
            { key: "totalPurchased", header: "Total Purchased", render: (s: Supplier) => <span className="font-medium text-forest-green">NPR {s.totalPurchased.toLocaleString()}</span> },
            { key: "lastPurchaseAt", header: "Last Purchase", render: (s: Supplier) => <span className="text-text-light">{s.lastPurchaseAt ? s.lastPurchaseAt.toDate().toLocaleDateString() : "—"}</span> },
            { key: "status", header: "Status", render: (s: Supplier) => (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"}`}>{s.isActive ? "Active" : "Inactive"}</span>
            )},
            { key: "actions", header: "", render: (s: Supplier) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {can("suppliers.write") && <button onClick={() => handleOpenEdit(s)} className="text-xs text-info">Edit</button>}
              </div>
            ), width: "60px" },
          ]}
          data={suppliers}
          keyExtractor={(s) => s.id}
          searchFields={["name", "phone", "address"]}
          searchPlaceholder="Search suppliers..."
          loading={loading}
          emptyMessage="No suppliers yet"
          emptyIcon="🏭"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Supplier" : "New Supplier"} onSave={() => {}} saving={saving} size="md">
          <SupplierForm
            initial={editing || undefined}
            onSave={handleSave}
            saving={saving}
          />
        </FormModal>
      </div>
    </AdminLayout>
  );
}
