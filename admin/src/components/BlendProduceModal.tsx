import { useState, useMemo } from "react";
import FormModal from "./FormModal";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { getDocument, setDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import type { Blend, RawMaterial } from "../types";

interface BlendProduceModalProps {
  blend: Blend;
  onClose: () => void;
  onDone: () => void;
}

export default function BlendProduceModal({ blend, onClose, onDone }: BlendProduceModalProps) {
  const { staff } = useStaff();
  const { data: rawMaterials } = useCollection<RawMaterial>("rawMaterials");
  const [kgInput, setKgInput] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingredientRequirements = useMemo(() => {
    return blend.recipe.map((ing) => {
      const rm = rawMaterials.find((r) => r.id === ing.materialId);
      const requiredG = ing.qtyPerKg * kgInput;
      return {
        materialId: ing.materialId,
        materialName: ing.materialName,
        requiredG,
        availableG: rm?.quantity ?? 0,
        unitCost: rm?.avgUnitCost ?? 0,
        totalCost: requiredG * (rm?.avgUnitCost ?? 0),
        sufficient: (rm?.quantity ?? 0) >= requiredG,
      };
    });
  }, [blend.recipe, rawMaterials, kgInput]);

  const totalCost = useMemo(() => ingredientRequirements.reduce((s, i) => s + i.totalCost, 0), [ingredientRequirements]);
  const costPerKg = kgInput > 0 ? totalCost / kgInput : 0;
  const allSufficient = ingredientRequirements.every((i) => i.sufficient);

  const handleProduce = async () => {
    if (!staff || kgInput <= 0) return;
    if (!allSufficient) { setError("Insufficient raw material stock to produce this quantity"); return; }
    setSaving(true); setError(null);
    try {
      for (const ing of ingredientRequirements) {
        const rm = await getDocument<RawMaterial>(`rawMaterials/${ing.materialId}`);
        if (!rm) continue;
        const newQty = rm.quantity - ing.requiredG;
        await setDocument(`rawMaterials/${ing.materialId}`, {
          quantity: newQty,
          totalValue: newQty * rm.avgUnitCost,
        });
      }

      const existingKg = blend.quantity / 1000;
      const totalKg = existingKg + kgInput;
      const newAvgCostPerKg = totalKg > 0
        ? ((existingKg * blend.avgCostPerKg) + (kgInput * costPerKg)) / totalKg
        : 0;

      const newQty = blend.quantity + kgInput * 1000;
      const productionRun = {
        producedKg: kgInput,
        totalCost: Math.round(totalCost * 100) / 100,
        costPerKg: Math.round(costPerKg * 100) / 100,
        producedBy: staff.id,
        producedByName: staff.name,
        producedAt: new Date(),
      };

      await setDocument(`blends/${blend.id}`, {
        quantity: newQty,
        avgCostPerKg: Math.round(newAvgCostPerKg * 100) / 100,
        totalValue: Math.round(newQty / 1000 * newAvgCostPerKg * 100) / 100,
        productionHistory: [...(blend.productionHistory || []), productionRun],
      });

      logActivity({
        action: "Produced blend",
        details: `Produced ${kgInput}kg of '${blend.name}' @ NPR ${Math.round(costPerKg).toLocaleString()}/kg (total NPR ${Math.round(totalCost).toLocaleString()})`,
        module: "Inventory",
        staffId: staff.id,
        staffName: staff.name,
        relatedDocId: blend.id,
      });

      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to produce blend");
    } finally { setSaving(false); }
  };

  return (
    <FormModal
      open={true}
      onClose={onClose}
      title={`Produce: ${blend.name}`}
      onSave={handleProduce}
      saveLabel={`Produce ${kgInput} kg`}
      saving={saving}
      error={error}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Quantity to Produce (kg)</label>
          <input
            value={kgInput || ""}
            onChange={(e) => setKgInput(Math.max(0, Number(e.target.value) || 0))}
            type="number"
            step="0.5"
            min="0.5"
            className="w-32 rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green"
          />
          <span className="ml-2 text-xs text-text-muted">kg ({kgInput * 1000}g)</span>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="border-b border-border bg-light-gray px-4 py-2">
            <h3 className="text-sm font-semibold text-text">Required Ingredients</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="px-4 py-2 font-medium">Spice</th>
                <th className="px-4 py-2 font-medium text-right">Required</th>
                <th className="px-4 py-2 font-medium text-right">Available</th>
                <th className="px-4 py-2 font-medium text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {ingredientRequirements.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-3 text-center text-xs text-text-muted">No ingredients in recipe</td></tr>
              ) : (
                ingredientRequirements.map((ing) => (
                  <tr key={ing.materialId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-text">{ing.materialName}</td>
                    <td className="px-4 py-2.5 text-right text-text-light">{ing.requiredG.toFixed(0)} g</td>
                    <td className={`px-4 py-2.5 text-right ${ing.sufficient ? "text-success" : "text-error"}`}>
                      {ing.availableG.toFixed(0)} g
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-text">NPR {Math.round(ing.totalCost).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-light-gray font-medium">
                <td className="px-4 py-2.5 text-text">Total</td>
                <td className="px-4 py-2.5 text-right text-text">{kgInput * 1000} g</td>
                <td className="px-4 py-2.5 text-right">—</td>
                <td className="px-4 py-2.5 text-right text-forest-green">NPR {Math.round(totalCost).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="rounded-lg bg-light-gray p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Cost per kg of blend</span>
            <span className="text-lg font-bold text-forest-green">NPR {Math.round(costPerKg).toLocaleString()}/kg</span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
