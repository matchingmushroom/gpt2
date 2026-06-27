import type { SKU } from "../types";

interface SKUFormData {
  skuCode: string;
  label: string;
  weightInGrams: number;
  price: number;
  unit: string;
  isActive: boolean;
}

interface SKUManagerProps {
  skus: SKUFormData[];
  onChange: (skus: SKUFormData[]) => void;
  productName?: string;
}

function generateSkuCode(productName: string, weight: number): string {
  const code = productName
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map((w) => w.substring(0, 3).toUpperCase())
    .join("")
    .substring(0, 6);
  const w = weight >= 1000 ? `${weight / 1000}K` : String(weight);
  return `${code}-${w}`;
}

export default function SKUManager({ skus, onChange, productName = "" }: SKUManagerProps) {
  const update = (index: number, field: keyof SKUFormData, value: string | number | boolean) => {
    const next = skus.map((sku, i) => {
      if (i !== index) return sku;
      const updated = { ...sku, [field]: value };
      if ((field === "label" || field === "weightInGrams") && productName) {
        const w = field === "weightInGrams" ? Number(value) : sku.weightInGrams;
        updated.skuCode = generateSkuCode(productName, w);
      }
      return updated;
    });
    onChange(next);
  };

  const add = () => {
    const weight = skus.length > 0 ? Math.max(...skus.map((s) => s.weightInGrams)) * 2 : 300;
    const newSku: SKUFormData = {
      skuCode: productName ? generateSkuCode(productName, weight) : "",
      label: `${weight} gm`,
      weightInGrams: weight,
      price: 0,
      unit: "gm",
      isActive: true,
    };
    onChange([...skus, newSku]);
  };

  const remove = (index: number) => {
    if (skus.length <= 1) return;
    onChange(skus.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h3 className="mb-3 font-heading font-semibold text-text">SKUs</h3>
      <div className="space-y-3">
        {skus.map((sku, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
            <div className="flex-1 min-w-[120px]">
              <label className="mb-0.5 block text-xs text-text-muted">Code</label>
              <input value={sku.skuCode} onChange={(e) => update(i, "skuCode", e.target.value)} className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label className="mb-0.5 block text-xs text-text-muted">Label</label>
              <input value={sku.label} onChange={(e) => update(i, "label", e.target.value)} className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" required />
            </div>
            <div className="w-20">
              <label className="mb-0.5 block text-xs text-text-muted">Weight (g)</label>
              <input value={sku.weightInGrams} onChange={(e) => update(i, "weightInGrams", Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" required />
            </div>
            <div className="w-24">
              <label className="mb-0.5 block text-xs text-text-muted">Price (NPR)</label>
              <input value={sku.price} onChange={(e) => update(i, "price", Number(e.target.value) || 0)} type="number" className="w-full rounded-input border border-border px-2 py-1.5 text-xs outline-none focus:border-forest-green" required />
            </div>
            <label className="flex items-center gap-1 pb-1 text-xs">
              <input type="checkbox" checked={sku.isActive} onChange={(e) => update(i, "isActive", e.target.checked)} className="h-3.5 w-3.5 accent-forest-green" />
              Active
            </label>
            {skus.length > 1 && (
              <button onClick={() => remove(i)} className="rounded-btn border border-error/30 px-2 py-1.5 text-xs text-error transition-colors hover:bg-error/5">Remove</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={add} type="button" className="mt-3 rounded-btn border border-dashed border-forest-green px-4 py-2 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green/5">
        + Add SKU
      </button>
      <p className="mt-2 text-xs text-text-muted">At least 1 SKU required. Weight must be unique per product.</p>
    </div>
  );
}
