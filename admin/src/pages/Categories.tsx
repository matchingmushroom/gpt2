import { useState, useMemo } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import ConfirmDialog from "../components/ConfirmDialog";
import DataTable from "../components/DataTable";
import CategoryForm from "../components/CategoryForm";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, removeDocument, getDocument } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import type { Category } from "../types";

export default function Categories() {
  const { staff, can } = useStaff();
  const { data: categories, loading } = useCollection<Category>("categories");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tree = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    const roots = categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const flatten = (cats: Category[], depth = 0): (Category & { depth: number })[] =>
      cats.flatMap((c) => {
        const children = categories.filter((ch) => ch.parentId === c.id).sort((a, b) => a.sortOrder - b.sortOrder);
        return [{ ...c, depth }, ...flatten(children, depth + 1)];
      });
    return flatten(roots);
  }, [categories]);

  const handleOpenNew = () => {
    setEditing(null);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditing(cat);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (data: Partial<Category>) => {
    if (!staff) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await setDocument(`categories/${editing.id}`, data);
        logActivity({ action: "Updated category", details: `Updated category '${data.name || editing.name}'`, module: "Categories", staffId: staff.id, staffName: staff.name, relatedDocId: editing.id });
      } else {
        const id = await addDocument("categories", data);
        logActivity({ action: "Created category", details: `Created category '${data.name}'` + (data.parentId ? ` under '${categories.find((c) => c.id === data.parentId)?.name}'` : ""), module: "Categories", staffId: staff.id, staffName: staff.name, relatedDocId: id });
      }
      invalidateCache(["products"]);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !staff) return;
    setDeleting(true);
    try {
      const children = categories.filter((c) => c.parentId === deleteTarget.id);
      if (children.length > 0) throw new Error(`Cannot delete '${deleteTarget.name}'. It has ${children.length} child categor${children.length > 1 ? "ies" : "y"}. Move or delete children first.`);
      await removeDocument(`categories/${deleteTarget.id}`);
      logActivity({ action: "Deleted category", details: `Deleted category '${deleteTarget.name}'`, module: "Categories", staffId: staff.id, staffName: staff.name, relatedDocId: deleteTarget.id });
      invalidateCache(["products"]);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    if (!can("categories.write") || !staff) return;
    await setDocument(`categories/${cat.id}`, { isActive: !cat.isActive });
    logActivity({ action: !cat.isActive ? "Activated category" : "Deactivated category", details: `${!cat.isActive ? "Activated" : "Deactivated"} category '${cat.name}'`, module: "Categories", staffId: staff.id, staffName: staff.name, relatedDocId: cat.id });
    invalidateCache(["products"]);
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Categories</h1>
            <p className="text-sm text-text-light">Organize products by category</p>
          </div>
          {can("categories.write") && (
            <button onClick={handleOpenNew} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">+ Add Category</button>
          )}
        </div>

        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "name", header: "Name", render: (c: Category & { depth: number }) => (
              <span className="font-medium text-text" style={{ paddingLeft: `${c.depth * 20}px` }}>
                {c.depth > 0 && <span className="mr-1 text-text-muted">└</span>}
                {c.name}
              </span>
            ), sortable: true },
            { key: "slug", header: "Slug", render: (c: Category) => <span className="text-xs text-text-muted">{c.slug}</span> },
            { key: "products", header: "Products", render: () => <span className="text-text-light">—</span> },
            { key: "status", header: "Status", render: (c: Category) => (
              <button onClick={(e) => { e.stopPropagation(); handleToggleActive(c); }} className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${c.isActive ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"}`}>
                {c.isActive ? "Active" : "Inactive"}
              </button>
            )},
            { key: "actions", header: "", render: (c: Category) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {can("categories.write") && <button onClick={() => handleOpenEdit(c)} className="text-xs text-info transition-colors hover:text-info/80">Edit</button>}
                {can("categories.write") && <button onClick={() => setDeleteTarget(c)} className="text-xs text-error transition-colors hover:text-error/80">Delete</button>}
              </div>
            ), width: "100px" },
          ]}
          data={tree}
          keyExtractor={(c) => c.id}
          searchFields={["name", "slug"]}
          searchPlaceholder="Search categories..."
          loading={loading}
          emptyMessage="No categories yet"
          emptyIcon="📁"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Category" : "New Category"} onSave={() => {}} saving={saving} size="md">
          <CategoryForm initial={editing || undefined} allCategories={categories} onSave={handleSave} saving={saving} />
        </FormModal>

        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => { setDeleteTarget(null); setError(null); }}
          onConfirm={handleDelete}
          title="Delete Category"
          message={`Are you sure you want to delete '${deleteTarget?.name}'? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          loading={deleting}
        />
      </div>
    </AdminLayout>
  );
}
