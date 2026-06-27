import { useState } from "react";
import type { Category } from "../types";
import { addDocument } from "../lib/firestore";

interface CategoryTreePickerProps {
  categories: Category[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  min?: number;
  onCategoryCreated?: () => void;
}

function getDepth(categories: Category[], id: string): number {
  let depth = 0;
  let current = categories.find((c) => c.id === id);
  while (current?.parentId) {
    depth++;
    current = categories.find((c) => c.id === current!.parentId);
  }
  return depth;
}

function getChildren(cats: Category[], parentId: string | null): Category[] {
  return cats.filter((c) => (c.parentId ?? null) === parentId).sort((a, b) => a.sortOrder - b.sortOrder);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CategoryTreePicker({ categories, selectedIds, onChange, min = 1, onCategoryCreated }: CategoryTreePickerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id];
    onChange(next);
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleNewCategory = async () => {
    const name = prompt("New category name:");
    if (!name || !name.trim()) return;
    setCreating(true);
    try {
      const parentId = prompt("Parent category ID (leave empty for top-level):") || null;
      await addDocument("categories", {
        name: name.trim(),
        slug: slugify(name.trim()),
        parentId: parentId || null,
        description: "",
        image: "",
        isActive: true,
        sortOrder: categories.length + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      onCategoryCreated?.();
    } catch {
      alert("Failed to create category");
    } finally {
      setCreating(false);
    }
  };

  const renderNode = (cat: Category) => {
    const depth = getDepth(categories, cat.id);
    const hasChildren = getChildren(categories, cat.id).length > 0;
    const isCollapsed = collapsed.has(cat.id);

    return (
      <div key={cat.id}>
        <div
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-beige/50"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapse(cat.id); }}
              className="h-4 w-4 shrink-0 text-xs text-text-muted transition-transform hover:text-text"
            >
              {isCollapsed ? "▶" : "▼"}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <label className="flex items-center gap-2 flex-1 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(cat.id)}
              onChange={() => toggle(cat.id)}
              className="h-4 w-4 accent-forest-green"
            />
            {cat.name}
          </label>
        </div>
        {hasChildren && !isCollapsed && (
          <div>
            {getChildren(categories, cat.id).map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {categories.filter((c) => c.isActive).length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">No categories yet.</p>
          <button type="button" onClick={handleNewCategory} disabled={creating} className="text-xs font-medium text-forest-green hover:text-forest-green-dark">
            + New Category
          </button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {getChildren(categories, null).map((root) => renderNode(root))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-3">
        <p className="text-xs text-text-muted">
          {selectedIds.length} selected {min > 0 && `(minimum ${min})`}
        </p>
        {categories.filter((c) => c.isActive).length > 0 && (
          <button type="button" onClick={handleNewCategory} disabled={creating} className="text-xs font-medium text-forest-green hover:text-forest-green-dark">
            + New
          </button>
        )}
      </div>
    </div>
  );
}
