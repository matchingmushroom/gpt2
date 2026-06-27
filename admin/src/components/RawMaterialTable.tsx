import { useState } from "react";
import DataTable from "./DataTable";
import FormModal from "./FormModal";
import { setDocument } from "../lib/firestore";
import { useStaff } from "../hooks/useStaff";
import { invalidateCache } from "../utils/cacheInvalidate";
import type { RawMaterial } from "../types";
import type { Column } from "./DataTable";

interface RawMaterialTableProps {
  data: RawMaterial[];
  loading: boolean;
}

export default function RawMaterialTable({ data, loading }: RawMaterialTableProps) {
  const { staff, can } = useStaff();
  const isProductionStaff = staff?.role === "production_staff";
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<RawMaterial | null>(null);
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("");
  const [formQty, setFormQty] = useState(0);
  const [formCost, setFormCost] = useState(0);
  const [saving, setSaving] = useState(false);

  const openAdjust = (item?: RawMaterial) => {
    setEditItem(item || null);
    setFormName(item?.name || "");
    setFormUnit(item?.unit || "kg");
    setFormQty(item?.quantity || 0);
    setFormCost(item?.avgUnitCost || 0);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!staff || !can("purchases.write")) return;
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const rawId = formName.trim().toLowerCase().replace(/\s+/g, "-");
      await setDocument(`rawMaterials/${rawId}`, {
        name: formName.trim(),
        unit: formUnit,
        quantity: formQty,
        avgUnitCost: formCost,
        totalValue: formQty * formCost,
      });
      invalidateCache(["rawMaterials"]);
      setModalOpen(false);
    } catch {
      //
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<RawMaterial>[] = [
    { key: "name", header: "Material", render: (r: RawMaterial) => (
      <span className="font-medium text-text">{r.name}</span>
    ), sortable: true },
    { key: "unit", header: "Unit", render: (r: RawMaterial) => (
      <span className="text-text-light">{r.unit}</span>
    )},
    { key: "qty", header: "Qty on Hand", render: (r: RawMaterial) => (
      <span className={`font-medium ${r.quantity <= 0 ? "text-error" : r.quantity < 10 ? "text-warning" : "text-success"}`}>
        {r.quantity}
      </span>
    )},
  ];

  if (!isProductionStaff) {
    columns.push(
      { key: "cost", header: "Avg Unit Cost", render: (r: RawMaterial) => (
        <span className="font-mono text-text-light">NPR {r.avgUnitCost.toLocaleString()}</span>
      )},
      { key: "value", header: "Total Value", render: (r: RawMaterial) => (
        <span className="font-mono font-medium text-forest-green">NPR {r.totalValue.toLocaleString()}</span>
      )},
    );
  }

  if (can("purchases.write")) {
    columns.push({ key: "actions", header: "", render: (r: RawMaterial) => (
      <button
        onClick={(e) => { e.stopPropagation(); openAdjust(r); }}
        className="rounded-btn border border-border px-2 py-1 text-xs text-text-light transition-colors hover:border-forest-green hover:text-forest-green"
      >
        Adjust
      </button>
    ), width: "80px" });
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        keyExtractor={(r) => r.id}
        loading={loading}
        searchFields={["name"]}
        searchPlaceholder="Search materials..."
        emptyMessage="No raw materials — purchase stock first"
        emptyIcon="📦"
      />

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? `Adjust: ${editItem.name}` : "New Raw Material"}
        onSave={handleSave}
        saving={saving}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Material Name</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
              placeholder="e.g. Chicken Meat"
            />
          </div>
          <div className="flex gap-3">
            <div className="w-24">
              <label className="mb-1 block text-sm font-medium text-text">Unit</label>
              <select
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                className="w-full rounded-input border border-border px-2 py-2 text-sm outline-none focus:border-forest-green"
              >
                <option value="kg">kg</option>
                <option value="Ltr">Ltr</option>
                <option value="Gm">Gm</option>
                <option value="pieces">pcs</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-text">Quantity</label>
              <input
                value={formQty || ""}
                onChange={(e) => setFormQty(Number(e.target.value) || 0)}
                type="number"
                className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Avg Unit Cost (NPR)</label>
            <input
              value={formCost || ""}
              onChange={(e) => setFormCost(Number(e.target.value) || 0)}
              type="number"
              className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
            />
          </div>
        </div>
      </FormModal>
    </>
  );
}
