import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import FormModal from "../components/FormModal";
import DataTable from "../components/DataTable";
import ProductForm from "../components/ProductForm";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { addDocument, setDocument, removeDocument, getDocument, listenCollection } from "../lib/firestore";
import { logActivity } from "../utils/activityLog";
import { invalidateCache } from "../utils/cacheInvalidate";
import type { Product, Category, SKU } from "../types";

interface ProductWithSkuCount extends Product {
  skuCount: number;
  minPrice: number;
  maxPrice: number;
}

export default function Products() {
  const { staff, can } = useStaff();
  const { data: products, loading } = useCollection<Product>("products");
  const { data: categories } = useCollection<Category>("categories");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingSkus, setEditingSkus] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuCounts, setSkuCounts] = useState<Record<string, number>>({});
  const [priceRanges, setPriceRanges] = useState<Record<string, { min: number; max: number }>>({});
  const [gasUrl, setGasUrl] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");

  useEffect(() => {
    getDocument("settings/backup").then((doc: any) => {
      if (doc?.gasUrl) setGasUrl(doc.gasUrl);
      if (doc?.driveFolderId) setDriveFolderId(doc.driveFolderId);
    }).catch(() => {});
  }, []);

  const enriched: ProductWithSkuCount[] = products.map((p) => {
    const sc = skuCounts[p.id] ?? 0;
    const pr = priceRanges[p.id] ?? { min: 0, max: 0 };
    return { ...p, skuCount: sc, minPrice: pr.min, maxPrice: pr.max };
  });

  const handleOpenNew = () => {
    setEditing(null);
    setEditingSkus([]);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = async (product: Product) => {
    setEditing(product);
    setError(null);
    const skus = await new Promise<any[]>((resolve) => {
      const unsub = listenCollection<SKU>(`products/${product.id}/skus`, (data) => {
        resolve(data.map((s) => ({
          skuCode: s.skuCode,
          label: s.label,
          weightInGrams: s.weightInGrams,
          price: s.price,
          unit: s.unit,
          isActive: s.isActive,
        })));
        setTimeout(unsub, 0);
      });
    });
    setEditingSkus(skus);
    setModalOpen(true);
  };

  const handleSave = async (productData: Partial<Product>, skuData: any[]) => {
    if (!staff) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await setDocument(`products/${editing.id}`, productData);
        for (const sku of skuData) {
          const existingSkus = await new Promise<SKU[]>((resolve) => {
            const unsub = listenCollection<SKU>(`products/${editing.id}/skus`, (data) => {
              resolve(data);
              setTimeout(unsub, 0);
            });
          });
          const match = existingSkus.find((s) => s.skuCode === sku.skuCode);
          if (match) {
            await setDocument(`products/${editing.id}/skus/${match.id}`, sku);
          } else {
            await addDocument(`products/${editing.id}/skus`, sku);
          }
        }
        logActivity({ action: "Updated product", details: `Updated product '${productData.name}'`, module: "Products", staffId: staff.id, staffName: staff.name, relatedDocId: editing.id });
      } else {
        const productId = await addDocument("products", productData);
        for (const sku of skuData) {
          await addDocument(`products/${productId}/skus`, sku);
        }
        logActivity({ action: "Created product", details: `Created product '${productData.name}' with ${skuData.length} SKUs`, module: "Products", staffId: staff.id, staffName: staff.name, relatedDocId: productId });
      }
      invalidateCache(["products", "stock", "dashboard"]);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleField = async (product: Product, field: "isActive" | "isFeatured") => {
    if (!can("products.write") || !staff) return;
    await setDocument(`products/${product.id}`, { [field]: !product[field] });
    logActivity({ action: `Toggled product ${field}`, details: `Set product '${product.name}' ${field} to ${!product[field]}`, module: "Products", staffId: staff.id, staffName: staff.name, relatedDocId: product.id });
    invalidateCache(["products", "stock", "dashboard"]);
  };

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl font-bold text-text">Products & SKUs</h1>
            <p className="text-sm text-text-light">Manage your product catalog</p>
          </div>
          {can("products.write") && (
            <button onClick={handleOpenNew} className="rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">+ Add Product</button>
          )}
        </div>

        {error && <div className="mb-4 rounded-btn bg-error/10 px-4 py-2 text-sm text-error">{error}</div>}

        <DataTable
          columns={[
            { key: "name", header: "Name", render: (p: ProductWithSkuCount) => <span className="font-medium text-text">{p.name}</span>, sortable: true },
            { key: "category", header: "Category", render: (p: ProductWithSkuCount) => {
              const names = (p.categoryIds || []).map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean);
              return (
                <div className="flex flex-wrap gap-1">
                  {names.slice(0, 2).map((n) => <span key={n} className="rounded-full bg-beige px-2 py-0.5 text-xs text-text-light">{n}</span>)}
                  {names.length > 2 && <span className="text-xs text-text-muted">+{names.length - 2}</span>}
                </div>
              );
            }},
            { key: "skus", header: "SKUs", render: (p: ProductWithSkuCount) => <span className="text-text-light">{p.skuCount}</span> },
            { key: "range", header: "Price Range", render: (p: ProductWithSkuCount) => (
              p.minPrice > 0 ? <span className="font-medium text-forest-green">NPR {p.minPrice} – {p.maxPrice}</span> : <span className="text-text-muted">—</span>
            )},
            { key: "featured", header: "Featured", render: (p: ProductWithSkuCount) => (
              <button onClick={(e) => { e.stopPropagation(); handleToggleField(p, "isFeatured"); }} className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isFeatured ? "bg-mustard-gold/10 text-mustard-gold" : "bg-light-gray text-text-muted"}`}>
                {p.isFeatured ? "Yes" : "No"}
              </button>
            )},
            { key: "status", header: "Status", render: (p: ProductWithSkuCount) => (
              <button onClick={(e) => { e.stopPropagation(); handleToggleField(p, "isActive"); }} className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"}`}>
                {p.isActive ? "Active" : "Inactive"}
              </button>
            )},
            { key: "actions", header: "", render: (p: ProductWithSkuCount) => (
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                {can("products.write") && <button onClick={() => handleOpenEdit(p as Product)} className="text-xs text-info">Edit</button>}
              </div>
            ), width: "60px" },
          ]}
          data={enriched}
          keyExtractor={(p) => p.id}
          searchFields={["name"]}
          searchPlaceholder="Search products..."
          loading={loading}
          emptyMessage="No products yet"
          emptyIcon="🥫"
        />

        <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Product" : "New Product"} onSave={() => {}} saving={saving} size="lg">
          <ProductForm
            initial={editing || undefined}
            categories={categories}
            initialSkus={editingSkus.length > 0 ? editingSkus : undefined}
            onSave={handleSave}
            saving={saving}
            gasUrl={gasUrl}
            driveFolderId={driveFolderId}
          />
        </FormModal>
      </div>
    </AdminLayout>
  );
}
