"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProductImage from "./ProductImage";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/products";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const router = useRouter();
  const [skuIndex, setSkuIndex] = useState(0);
  const [imgIndex, setImgIndex] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const sku = product.skus[skuIndex];
  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  const minPrice = Math.min(...product.skus.map((s) => s.price));
  const maxPrice = Math.max(...product.skus.map((s) => s.price));

  const prevImg = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setImgIndex((i) => (i - 1 + images.length) % images.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setImgIndex((i) => (i + 1) % images.length);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, skuIndex, 1);
    setFeedback("Added!");
    setTimeout(() => setFeedback(null), 1500);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, skuIndex, 1);
    router.push("/checkout");
  };

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-beige/50 text-7xl transition-transform group-hover:scale-105">
        <ProductImage src={images[imgIndex] || null} alt={product.name} className="text-7xl" icon={product.image} />
        {images.length > 1 && (
          <>
            <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/70 px-2 py-1.5 text-sm text-text shadow transition-opacity hover:bg-white sm:px-1.5 sm:py-1 sm:text-xs sm:opacity-0 sm:group-hover:opacity-100">‹</button>
            <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/70 px-2 py-1.5 text-sm text-text shadow transition-opacity hover:bg-white sm:px-1.5 sm:py-1 sm:text-xs sm:opacity-0 sm:group-hover:opacity-100">›</button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <span key={i} className={`block h-1.5 w-1.5 rounded-full transition-colors ${i === imgIndex ? "bg-forest-green" : "bg-white/60"}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium uppercase tracking-wider text-mustard-gold">
          {product.category}
        </span>
        <h3 className="font-heading text-lg font-semibold text-text">{product.name}</h3>
        <p className="line-clamp-2 text-sm text-text-light">{product.description}</p>

        {product.skus.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {product.skus.map((s, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSkuIndex(i); }}
                className={`rounded-btn border px-2 py-0.5 text-xs font-medium transition-colors ${
                  i === skuIndex
                    ? "border-forest-green bg-forest-green text-white"
                    : "border-border text-text-muted hover:border-forest-green"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold text-forest-green">NPR {sku.price.toLocaleString()}</span>
          {maxPrice > minPrice && (
            <span className="text-xs text-text-muted">{product.skus.length} sizes</span>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            onClick={handleAddToCart}
            className="flex-1 rounded-btn border border-forest-green px-3 py-1.5 text-xs font-medium text-forest-green transition-colors hover:bg-forest-green/5"
          >
            {feedback || "Add to Cart"}
          </button>
          <button
            onClick={handleBuyNow}
            className="flex-1 rounded-btn bg-forest-green px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-forest-green-dark"
          >
            Buy Now
          </button>
        </div>
      </div>
    </Link>
  );
}
