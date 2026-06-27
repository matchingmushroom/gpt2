import { useState, useEffect } from "react";
import type { Category } from "../types";

interface CategoryFormProps {
  initial?: Partial<Category>;
  allCategories: Category[];
  onSave: (data: Partial<Category>) => void;
  saving?: boolean;
}

export default function CategoryForm({ initial, allCategories, onSave, saving }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [parentId, setParentId] = useState<string | null>(initial?.parentId ?? null);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [image, setImage] = useState(initial?.image ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  useEffect(() => {
    if (!initial && name && !slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }, [name, slug, initial]);

  const excludeIds = new Set<string>();
  if (initial?.id) {
    excludeIds.add(initial.id);
    allCategories.filter((c) => c.parentId === initial.id).forEach((c) => {
      excludeIds.add(c.id);
      allCategories.filter((cc) => cc.parentId === c.id).forEach((cc) => excludeIds.add(cc.id));
    });
  }

  const parentOptions = allCategories.filter((c) => !excludeIds.has(c.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    onSave({ name: name.trim(), slug: slug.trim(), parentId, description, image, isActive, sortOrder });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Slug *</label>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Parent Category</label>
        <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green">
          <option value="">— None (Top Level) —</option>
          {parentOptions
            .filter((c) => c.isActive)
            .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" rows={3} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">Image URL</label>
        <input value={image} onChange={(e) => setImage(e.target.value)} className="w-full rounded-input border border-border px-4 py-2 text-sm outline-none focus:border-forest-green" placeholder="https://drive.google.com/..." />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-forest-green" />
          Active
        </label>
        <div>
          <label className="mr-2 text-sm font-medium text-text">Sort Order</label>
          <input value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} type="number" className="w-20 rounded-input border border-border px-2 py-1 text-sm outline-none focus:border-forest-green" />
        </div>
      </div>
      <button type="submit" disabled={saving} className="rounded-btn bg-forest-green px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark disabled:opacity-60">
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
