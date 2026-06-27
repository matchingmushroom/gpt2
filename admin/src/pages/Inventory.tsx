import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import InventoryTree from "../components/InventoryTree";
import RawMaterialTable from "../components/RawMaterialTable";
import BlendTable from "../components/BlendTable";
import { useStaff } from "../hooks/useStaff";
import { useCollection } from "../hooks/useCollection";
import { listenCollection } from "../lib/firestore";
import type { Batch, Category, Order, Product, SKU, RawMaterial } from "../types";

type Tab = "finished" | "production" | "blends";

export default function InventoryPage() {
  const { staff } = useStaff();
  const isAdmin = staff?.role === "super_admin" || staff?.role === "manager";
  const [tab, setTab] = useState<Tab>("finished");
  const { data: categories } = useCollection<Category>("categories");
  const { data: products } = useCollection<Product>("products");
  const { data: batches } = useCollection<Batch>("batches");
  const { data: orders } = useCollection<Order>("orders");
  const { data: rawMaterials, loading: rmLoading } = useCollection<RawMaterial>("rawMaterials");
  const [skus, setSkus] = useState<Record<string, SKU[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSkus = async () => {
      const map: Record<string, SKU[]> = {};
      for (const p of products) {
        const list = await new Promise<SKU[]>((resolve) => {
          const unsub = listenCollection<SKU>(`products/${p.id}/skus`, (data) => {
            resolve(data);
            setTimeout(unsub, 0);
          });
        });
        map[p.id] = list;
      }
      setSkus(map);
      setLoading(false);
    };
    if (products.length > 0) loadSkus();
  }, [products]);

  return (
    <AdminLayout>
      <div className="p-3 sm:p-6">
        <div className="mb-6">
          <h1 className="font-heading text-xl font-bold text-text">Inventory</h1>
          <p className="text-sm text-text-light">
            {tab === "finished" ? "Expand categories to view stock at each level" : tab === "production" ? "Raw material stock levels from purchases" : "Secret spice blends production"}
          </p>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setTab("finished")}
            className={`rounded-btn px-4 py-2 text-sm font-medium transition-colors ${
              tab === "finished" ? "bg-forest-green text-white" : "border border-border text-text-light hover:border-forest-green hover:text-forest-green"
            }`}
          >
            Finished Goods
          </button>
          <button
            onClick={() => setTab("production")}
            className={`rounded-btn px-4 py-2 text-sm font-medium transition-colors ${
              tab === "production" ? "bg-forest-green text-white" : "border border-border text-text-light hover:border-forest-green hover:text-forest-green"
            }`}
          >
            Production Inventory
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab("blends")}
              className={`rounded-btn px-4 py-2 text-sm font-medium transition-colors ${
                tab === "blends" ? "bg-forest-green text-white" : "border border-border text-text-light hover:border-forest-green hover:text-forest-green"
              }`}
            >
              Blends
            </button>
          )}
        </div>

        {tab === "finished" ? (
          <InventoryTree
            categories={categories}
            products={products}
            skus={skus}
            batches={batches}
            orders={orders}
            loading={loading}
          />
        ) : tab === "production" ? (
          <RawMaterialTable data={rawMaterials} loading={rmLoading} />
        ) : (
          isAdmin && <BlendTable />
        )}
      </div>
    </AdminLayout>
  );
}
