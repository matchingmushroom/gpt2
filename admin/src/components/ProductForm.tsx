import { useState, useEffect } from "react";
import type { Product, Category } from "../types";
import CategoryTreePicker from "./CategoryTreePicker";
import SKUManager from "./SKUManager";
import ImageUploader from "./ImageUploader";

interface SKUFormData {
  skuCode: string;
  label: string;
  weightInGrams: number;
  price: number;
  unit: string;
  isActive: boolean;
}

interface ProductFormProps {
  initial?: Partial<Product>;
  categories: Category[];
  initialSkus?: SKUFormData[];
  onSave: (product: Partial<Product>, skus: SKUFormData[]) => void;
  saving?: boolean;
  gasUrl?: string;
  driveFolderId?: string;
  onCategoryCreated?: () => void;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function ProductForm({ initial, categories, initialSkus, onSave, saving, gasUrl, driveFolderId, onCategoryCreated }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [tags, setTags] = useState(initial?.tags?.join(", ") ?? "");
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [skus, setSkus] = useState<SKUFormData[]>(initialSkus ?? []);

  useEffect(() => {
    if (!initial && name && !slug) {
      setSlug(slugify(name));
    }
  }, [name, slug, initial]);

  useEffect(() => {
    if (!initial && skus.length === 0) {
      setSkus([
        { skuCode: "", label: "300 gm", weightInGrams: 300, price: 0, unit: "gm", isActive: true },
      ]);
    }
  }, [initial, skus.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || categoryIds.length === 0 || skus.length === 0) return;
    if (new Set(skus.map((s) => s.weightInGrams)).size !== skus.length) return;

    onSave(
      {
        name: name.trim(),
        slug: slug.trim(),
        description,
        categoryIds,
        images,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        isFeatured,
        isActive,
      },
      skus
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Product Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Slug *</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={4} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Categories *</label>
          <CategoryTreePicker categories={categories} selectedIds={categoryIds} onChange={setCategoryIds} min={1} onCategoryCreated={onCategoryCreated} />
          {categoryIds.length === 0 && <p className="mt-1 text-xs text-error">At least 1 category required</p>}
        </div>
        <div>
          <ImageUploader images={images} onChange={setImages} max={5} gasUrl={gasUrl} driveFolderId={driveFolderId} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-text">Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" placeholder="spicy, organic, non-veg" />
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="h-4 w-4 accent-forest-green" />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-forest-green" />
            Active
          </label>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <SKUManager skus={skus} onChange={setSkus} productName={name} />
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <button type="submit" disabled={saving || categoryIds.length === 0 || skus.length === 0} className="rounded-btn bg-forest-green px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">
          {saving ? "Saving..." : initial ? "Update Product" : "Create Product"}
        </button>
      </div>
    </form>
  );
}
