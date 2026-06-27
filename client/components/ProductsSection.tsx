"use client";

import { useProducts } from "@/hooks/useProducts";
import ProductGrid from "./ProductGrid";

export default function ProductsSection() {
  const { products, loading } = useProducts();

  const featured = products.filter((p) => p.isFeatured);
  const all = products;

  if (loading && !products.length) {
    return (
      <>
        {[1, 2].map((section) => (
          <section key={section} className="bg-cream px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-6xl">
              <div className="mb-10 text-center">
                <div className="mx-auto mb-2 h-8 w-48 animate-pulse rounded bg-beige/50" />
                <div className="mx-auto h-4 w-64 animate-pulse rounded bg-beige/30" />
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: section === 1 ? 4 : 8 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-card bg-beige/50" />
                ))}
              </div>
            </div>
          </section>
        ))}
      </>
    );
  }

  return (
    <>
      <ProductGrid products={featured} title="Featured Pickles" />
      <ProductGrid products={all} title="All Products" />
    </>
  );
}
