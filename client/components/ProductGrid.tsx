import type { Product } from "@/lib/products";
import ProductCard from "./ProductCard";

export default function ProductGrid({
  products,
  title,
}: {
  products: Product[];
  title?: string;
}) {
  return (
    <section id="products" className="bg-cream px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        {title && (
          <div className="mb-10 text-center">
            <h2 className="font-heading text-3xl font-bold text-forest-green sm:text-4xl">
              {title}
            </h2>
            <p className="mt-2 text-text-light">
              Handcrafted with love, packed with flavor
            </p>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
