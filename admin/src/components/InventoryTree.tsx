import { useState, useMemo } from "react";
import type { Category, Product, SKU, Batch, Order } from "../types";

interface InventoryTreeProps {
  categories: Category[];
  products: Product[];
  skus: Record<string, SKU[]>;
  batches: Batch[];
  orders: Order[];
  loading: boolean;
}

type ExpandedMap = Record<string, boolean>;
type RowType = "main_cat" | "sub_cat" | "product" | "sku";

interface FlatRow {
  id: string;
  type: RowType;
  label: string;
  depth: number;
  hasChildren: boolean;
  skuCode?: string;
  batched: number;
  sold: number;
  returned: number;
  available: number;
}

function getStock(skuId: string, productId: string, batches: Batch[], orders: Order[]) {
  const batched = batches
    .filter((b) => b.productId === productId && b.status === "completed")
    .reduce((s, b) => s + (b.items.find((i) => i.skuId === skuId)?.quantity || 0), 0);
  const sold = orders
    .filter((o) => o.status === "shipped" || o.status === "delivered")
    .reduce((s, o) => s + (o.items.find((i) => i.skuId === skuId)?.quantity || 0), 0);
  const returned = orders
    .filter((o) => o.status === "returned")
    .reduce((s, o) => s + (o.items.find((i) => i.skuId === skuId)?.quantity || 0), 0);
  return { batched, sold, returned };
}

function statusDot(available: number) {
  if (available <= 0) return <span className="inline-block h-2 w-2 rounded-full bg-red-500" title="Out of Stock" />;
  if (available < 10) return <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" title="Low Stock" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="In Stock" />;
}

function statusBadge(available: number) {
  if (available <= 0) return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Out of Stock</span>;
  if (available < 10) return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Low Stock</span>;
  return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">In Stock</span>;
}

export default function InventoryTree({ categories, products, skus, batches, orders, loading }: InventoryTreeProps) {
  const [expanded, setExpanded] = useState<ExpandedMap>({});

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const { mainCats, subCatsByParent } = useMemo(() => {
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const mainCats = categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name));
    const subCatsByParent = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parentId) {
        const list = subCatsByParent.get(c.parentId) || [];
        list.push(c);
        subCatsByParent.set(c.parentId, list);
      }
    }
    return { mainCats, subCatsByParent };
  }, [categories]);

  const rows = useMemo((): FlatRow[] => {
    const result: FlatRow[] = [];

    const buildSkuRows = (productId: string): FlatRow[] =>
      (skus[productId] || []).map((sku) => {
        const stock = getStock(sku.id, productId, batches, orders);
        return {
          id: `sku-${sku.id}`,
          type: "sku",
          label: sku.label,
          depth: 3,
          hasChildren: false,
          skuCode: sku.skuCode,
          ...stock,
          available: stock.batched - stock.sold + stock.returned,
        };
      });

    const buildProductRows = (catId: string): FlatRow[] => {
      const r: FlatRow[] = [];
      for (const p of products.filter((p) => (p.categoryIds || []).includes(catId) && p.isActive)) {
        const skuRows = buildSkuRows(p.id);
        const batched = skuRows.reduce((s, r) => s + r.batched, 0);
        const sold = skuRows.reduce((s, r) => s + r.sold, 0);
        const returned = skuRows.reduce((s, r) => s + r.returned, 0);
        const available = skuRows.reduce((s, r) => s + r.available, 0);
        r.push({ id: `product-${p.id}`, type: "product", label: p.name, depth: 2, hasChildren: skuRows.length > 0, batched, sold, returned, available });
        if (expanded[`product-${p.id}`]) r.push(...skuRows);
      }
      return r;
    };

    const buildSubCatRows = (parentId: string): FlatRow[] => {
      const r: FlatRow[] = [];
      for (const sub of (subCatsByParent.get(parentId) || []).sort((a, b) => a.name.localeCompare(b.name))) {
        const productRows = buildProductRows(sub.id);
        const batched = productRows.reduce((s, r) => s + r.batched, 0);
        const sold = productRows.reduce((s, r) => s + r.sold, 0);
        const returned = productRows.reduce((s, r) => s + r.returned, 0);
        const available = productRows.reduce((s, r) => s + r.available, 0);
        r.push({ id: `subcat-${sub.id}`, type: "sub_cat", label: sub.name, depth: 1, hasChildren: productRows.length > 0, batched, sold, returned, available });
        if (expanded[`subcat-${sub.id}`]) r.push(...productRows);
      }
      return r;
    };

    for (const mc of mainCats) {
      const subRows = buildSubCatRows(mc.id);
      const batched = subRows.reduce((s, r) => s + r.batched, 0);
      const sold = subRows.reduce((s, r) => s + r.sold, 0);
      const returned = subRows.reduce((s, r) => s + r.returned, 0);
      const available = subRows.reduce((s, r) => s + r.available, 0);
      result.push({ id: `main-${mc.id}`, type: "main_cat", label: mc.name, depth: 0, hasChildren: subRows.length > 0, batched, sold, returned, available });
      if (expanded[`main-${mc.id}`]) result.push(...subRows);
    }

    const uncategorized = products.filter(
      (p) => p.isActive && (!p.categoryIds || p.categoryIds.length === 0 || !p.categoryIds.some((cid) => categories.some((c) => c.id === cid)))
    );
    if (uncategorized.length > 0) {
      const uRows: FlatRow[] = [];
      for (const p of uncategorized) {
        const skuRows = buildSkuRows(p.id);
        const batched = skuRows.reduce((s, r) => s + r.batched, 0);
        const sold = skuRows.reduce((s, r) => s + r.sold, 0);
        const returned = skuRows.reduce((s, r) => s + r.returned, 0);
        const available = skuRows.reduce((s, r) => s + r.available, 0);
        uRows.push({ id: `product-${p.id}`, type: "product", label: p.name, depth: 1, hasChildren: skuRows.length > 0, batched, sold, returned, available });
        if (expanded[`product-${p.id}`]) uRows.push(...skuRows);
      }
      const t = uRows.reduce((s, r) => ({ batched: s.batched + r.batched, sold: s.sold + r.sold, returned: s.returned + r.returned, available: s.available + r.available }), { batched: 0, sold: 0, returned: 0, available: 0 });
      result.push({ id: "uncategorized", type: "main_cat", label: "Uncategorized", depth: 0, hasChildren: uRows.length > 0, ...t });
      if (expanded["uncategorized"]) result.push(...uRows);
    }

    return result;
  }, [products, skus, batches, orders, categories, expanded, mainCats, subCatsByParent]);

  if (loading)
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-card bg-beige/50" />)}</div>;

  if (rows.length === 0)
    return <div className="flex flex-col items-center gap-2 py-16 text-text-muted"><span className="text-4xl">📋</span><p className="text-sm">No inventory data</p></div>;

  return (
    <div className="overflow-x-auto rounded-card bg-white shadow-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs text-text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Category / Product / SKU</th>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium text-right">Batched</th>
            <th className="px-4 py-3 font-medium text-right">Sold</th>
            <th className="px-4 py-3 font-medium text-right">Returned</th>
            <th className="px-4 py-3 font-medium text-right">Available</th>
            <th className="px-4 py-3 font-medium text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const available = row.available;
            return (
              <tr
                key={row.id}
                className={`transition-colors hover:bg-light-gray ${row.hasChildren ? "cursor-pointer" : ""}`}
                onClick={() => row.hasChildren && toggle(row.id)}
              >
                <td className={`flex items-center gap-2 px-4 py-2.5 ${row.depth === 0 ? "pl-0" : row.depth === 1 ? "pl-6 sm:pl-8" : row.depth === 2 ? "pl-10 sm:pl-14" : "pl-14 sm:pl-20"}`}>
                  {row.hasChildren ? (
                    <span className={`w-4 text-center text-xs text-text-muted transition-transform ${expanded[row.id] ? "rotate-90" : ""}`}>▶</span>
                  ) : (
                    <span className="w-4 text-center text-xs text-text-muted">•</span>
                  )}
                  <span className={`truncate ${row.type === "main_cat" ? "font-semibold text-text" : row.type === "sub_cat" ? "font-medium text-text" : row.type === "product" ? "text-text-light" : "font-mono text-xs text-text-muted"}`}>
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-text-muted">{row.type === "sku" ? row.skuCode : ""}</td>
                <td className="px-4 py-2.5 text-right text-text-light">{row.batched || "-"}</td>
                <td className="px-4 py-2.5 text-right text-text-light">{row.sold || "-"}</td>
                <td className="px-4 py-2.5 text-right text-text-light">{row.returned || "-"}</td>
                <td className={`px-4 py-2.5 text-right font-medium ${available < 10 ? "text-error" : "text-success"}`}>{available || "-"}</td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {statusDot(available)}
                    {statusBadge(available)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
