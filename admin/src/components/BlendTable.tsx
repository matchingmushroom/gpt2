import { useState } from "react";
import DataTable from "./DataTable";
import FormModal from "./FormModal";
import BlendProduceModal from "./BlendProduceModal";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import type { Blend, BlendIngredient, RawMaterial } from "../types";
import type { Column } from "./DataTable";

export default function BlendTable() {
  const { staff, can } = useStaff();
  const { data: blends, loading } = useCollection<Blend>("blends");
  const { data: rawMaterials } = useCollection<RawMaterial>("rawMaterials");
  const isAdmin = staff?.role === "super_admin" || staff?.role === "manager";

  const [createOpen, setCreateOpen] = useState(false);
  const [produceBlend, setProduceBlend] = useState<Blend | null>(null);
  const [recipeBlend, setRecipeBlend] = useState<Blend | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formIngredients, setFormIngredients] = useState<BlendIngredient[]>([]);
  const [editBlendId, setEditBlendId] = useState<string | null>(null);

  const openCreate = () => {
    setEditBlendId(null);
    setFormName("");
    setFormIngredients([]);
    setCreateOpen(true);
    setError(null);
  };

  const openEdit = (blend: Blend) => {
    setEditBlendId(blend.id);
    setFormName(blend.name);
    setFormIngredients(blend.recipe.map((r) => ({ ...r })));
    setCreateOpen(true);
    setError(null);
  };

  const addIngredient = () => {
    setFormIngredients([...formIngredients, { materialId: "", materialName: "", qtyPerKg: 0 }]);
  };

  const updateIngredient = (i: number, field: keyof BlendIngredient, value: string | number) => {
    const next = [...formIngredients];
    (next[i] as unknown as Record<string, string | number>)[field] = value;
    setFormIngredients(next);
  };

  const removeIngredient = (i: number) => {
    setFormIngredients(formIngredients.filter((_, idx) => idx !== i));
  };

  const handleSaveBlend = async () => {
    if (!staff || !can("purchases.write")) return;
    if (!formName.trim()) { setError("Blend name is required"); return; }
    const validIngredients = formIngredients.filter((i) => i.materialId && i.qtyPerKg > 0);
    if (validIngredients.length === 0) { setError("At least one ingredient with qty > 0 is required"); return; }
    setSaving(true); setError(null);
    try {
      const data: Record<string, unknown> = {
        name: formName.trim(),
        recipe: validIngredients,
      };
      if (editBlendId) {
        await setDocument(`blends/${editBlendId}`, data);
      } else {
        const id = await addDocument("blends", {
          ...data,
          quantity: 0,
          avgCostPerKg: 0,
          totalValue: 0,
          productionHistory: [],
          isActive: true,
        });
        logActivity({
          action: "Created blend",
          details: `Created blend '${formName.trim()}' with ${validIngredients.length} ingredients`,
          module: "Inventory",
          staffId: staff.id,
          staffName: staff.name,
          relatedDocId: id,
        });
      }
      invalidateCache(["rawMaterials"]);
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save blend");
    } finally { setSaving(false); }
  };

  const columns: Column<Blend>[] = [
    { key: "name", header: "Blend Name", render: (b: Blend) => (
      <span className="font-medium text-text">{b.name}</span>
    ), sortable: true },
    { key: "stock", header: "Stock (g)", render: (b: Blend) => (
      <span className={`font-mono font-medium ${b.quantity <= 0 ? "text-error" : b.quantity < 1000 ? "text-warning" : "text-success"}`}>
        {(b.quantity / 1000).toFixed(2)} kg
      </span>
    )},
    { key: "cost", header: "Avg Cost/kg", render: (b: Blend) => (
      <span className="font-mono text-forest-green">NPR {b.avgCostPerKg.toLocaleString()}</span>
    )},
    { key: "lastProd", header: "Last Produced", render: (b: Blend) => {
      const last = b.productionHistory?.[b.productionHistory.length - 1];
      return last ? (
        <span className="text-xs text-text-muted">
          {last.producedKg}kg @ NPR {last.costPerKg.toLocaleString()}/kg
        </span>
      ) : (
        <span className="text-xs text-text-muted">—</span>
      );
    }},
  ];

  if (isAdmin) {
    columns.push({ key: "recipe", header: "Recipe", render: (b: Blend) => (
      <button
        onClick={(e) => { e.stopPropagation(); setRecipeBlend(b); }}
        className="rounded-btn border border-border px-2 py-1 text-xs text-text-light transition-colors hover:border-mustard-gold hover:text-mustard-gold"
      >
        View
      </button>
    ), width: "80px" });
    columns.push({ key: "actions", header: "", render: (b: Blend) => (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setProduceBlend(b)}
          className="rounded-btn bg-forest-green px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-forest-green/90"
        >
          Produce
        </button>
        <button
          onClick={() => openEdit(b)}
          className="rounded-btn border border-border px-2 py-1 text-xs text-text-light transition-colors hover:border-forest-green hover:text-forest-green"
        >
          Edit
        </button>
      </div>
    ), width: "140px" });
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-muted">Secret spice blends. Only managers/admins can view recipes and produce.</p>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white"
          >
            + New Blend
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={blends}
        keyExtractor={(b) => b.id}
        loading={loading}
        searchFields={["name"]}
        searchPlaceholder="Search blends..."
        emptyMessage="No blends yet"
        emptyIcon="🧂"
      />

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editBlendId ? "Edit Blend" : "Create New Blend"}
        onSave={handleSaveBlend}
        saving={saving}
        error={error}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text">Blend Name *</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
              placeholder="e.g. Spices Blend"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-text">Recipe (ingredients per 1kg of blend)</label>
              <button
                onClick={addIngredient}
                className="rounded-btn border border-forest-green px-2 py-1 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green/10"
              >
                + Add Ingredient
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formIngredients.length === 0 && (
                <p className="text-xs text-text-muted">No ingredients added yet. Click "Add Ingredient" to define the recipe.</p>
              )}
                  {formIngredients.map((ing, i) => {
                    const rm = rawMaterials.find((r) => r.id === ing.materialId);
                    const costPerKgBlend = rm ? (ing.qtyPerKg / 1000) * rm.avgUnitCost * 1000 : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                        <select
                          value={ing.materialId}
                          onChange={(e) => {
                            const sel = e.target.value;
                            const rm = rawMaterials.find((r) => r.id === sel);
                            const next = [...formIngredients];
                            next[i] = { ...next[i], materialId: sel, materialName: rm?.name || "" };
                            setFormIngredients(next);
                          }}
                          className="flex-1 rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green"
                        >
                          <option value="">Select spice...</option>
                          {rawMaterials.map((rm) => (
                            <option key={rm.id} value={rm.id}>
                              {rm.name} (NPR {rm.avgUnitCost.toLocaleString()}/{rm.unit})
                            </option>
                          ))}
                        </select>
                        <input
                          value={ing.qtyPerKg || ""}
                          onChange={(e) => updateIngredient(i, "qtyPerKg", Number(e.target.value) || 0)}
                          type="number"
                          className="w-20 rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green"
                          placeholder="g/kg"
                        />
                        <span className="text-xs text-text-muted w-8">g/kg</span>
                        {rm && (
                          <span className="w-24 text-right text-xs font-mono text-forest-green">
                            NPR {Math.round(costPerKgBlend).toLocaleString()}
                          </span>
                        )}
                        <button
                          onClick={() => removeIngredient(i)}
                          className="flex h-6 w-6 items-center justify-center rounded text-xs text-error hover:bg-error/10"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
            </div>
            <div className="rounded-lg bg-light-gray p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text">Est. cost per kg of blend</span>
                <span className="text-lg font-bold text-forest-green">
                  NPR {Math.round(formIngredients.reduce((s, ing) => {
                    const rm = rawMaterials.find((r) => r.id === ing.materialId);
                    return s + (rm ? (ing.qtyPerKg / 1000) * rm.avgUnitCost * 1000 : 0);
                  }, 0)).toLocaleString()}/kg
                </span>
              </div>
            </div>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={!!recipeBlend}
        onClose={() => setRecipeBlend(null)}
        title={`Recipe: ${recipeBlend?.name || ""}`}
        showSave={false}
        size="md"
      >
        {recipeBlend && (
          <div className="space-y-3">
            <p className="text-xs text-warning">⚠️ This recipe is confidential. Only authorized personnel can view it.</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="pb-2 font-medium">Spice</th>
                  <th className="pb-2 font-medium text-right">Unit Cost</th>
                  <th className="pb-2 font-medium text-right">Qty per kg</th>
                  <th className="pb-2 font-medium text-right">Cost/kg blend</th>
                </tr>
              </thead>
              <tbody>
                {recipeBlend.recipe.map((ing) => {
                  const rm = rawMaterials.find((r) => r.id === ing.materialId);
                  const unitCost = rm?.avgUnitCost ?? 0;
                  const costPerKgBlend = (ing.qtyPerKg / 1000) * unitCost * 1000;
                  return (
                    <tr key={ing.materialId} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium text-text">{ing.materialName}</td>
                      <td className="py-2 text-right font-mono text-text-light">NPR {Math.round(unitCost).toLocaleString()}/{rm?.unit || "kg"}</td>
                      <td className="py-2 text-right text-text-light">{ing.qtyPerKg} g</td>
                      <td className="py-2 text-right font-mono text-forest-green">
                        NPR {Math.round(costPerKgBlend).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium">
                  <td className="py-2 text-text">Total</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 text-right text-text">{recipeBlend.recipe.reduce((s, ing) => s + ing.qtyPerKg, 0)} g</td>
                  <td className="py-2 text-right text-forest-green">
                    NPR {Math.round(recipeBlend.recipe.reduce((s, ing) => {
                      const rm = rawMaterials.find((r) => r.id === ing.materialId);
                      return s + (rm ? (ing.qtyPerKg / 1000) * rm.avgUnitCost * 1000 : 0);
                    }, 0)).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </FormModal>

      {produceBlend && (
        <BlendProduceModal
          blend={produceBlend}
          onClose={() => setProduceBlend(null)}
          onDone={() => invalidateCache(["rawMaterials"])}
        />
      )}
    </>
  );
}
