"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllProducts, fetchProductBySlugFromFirestore } from "@/lib/products";
import { useCart } from "@/lib/cart";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductImage from "@/components/ProductImage";

export default function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const fallback = getAllProducts().find((p) => p.slug === slug);
  const [product, setProduct] = useState(fallback);
  const [loading, setLoading] = useState(false);
  const { addItem } = useCart();
  const [selectedSku, setSelectedSku] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchProductBySlugFromFirestore(slug).then((p) => {
      if (p && !cancelled) setProduct(p);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  if (!product) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="font-heading text-2xl font-bold">Product not found</h1>
          <Link href="/" className="mt-4 inline-block text-mustard-gold underline">Back to home</Link>
        </main>
        <Footer />
      </>
    );
  }

  const sku = product.skus[selectedSku];
  const images = product.images?.length ? product.images : [product.image];

  const handleAdd = () => {
    addItem(product, selectedSku, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <nav className="mb-6 text-sm text-text-muted">
          <Link href="/" className="hover:text-forest-green">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/products" className="hover:text-forest-green">Products</Link>
          <span className="mx-2">/</span>
          <span className="text-text">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-image bg-beige/50">
              <ProductImage src={images[imgIdx]} alt={product.name} className="h-full w-full object-cover text-9xl" icon={product.image} />
            </div>
            {images.length > 1 && (
              <div className="flex gap-3">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`h-14 w-14 overflow-hidden rounded-lg border-2 ${i === imgIdx ? "border-forest-green" : "border-border"} bg-beige/30 transition-colors hover:border-forest-green`}>
                    <ProductImage src={img} alt={`${product.name} ${i + 1}`} className="h-full w-full object-cover text-lg" icon={img} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-mustard-gold">{product.category}</span>
              <h1 className="font-heading text-3xl font-bold text-text">{product.name}</h1>
            </div>

            <p className="leading-relaxed text-text-light">{product.description}</p>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">Size</h3>
              <div className="flex flex-wrap gap-2">
                {product.skus.map((s, i) => (
                  <button key={i} onClick={() => { setSelectedSku(i); setQty(1); }} className={`rounded-btn border px-4 py-2 text-sm font-medium transition-colors ${i === selectedSku ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}>
                    {s.label} — NPR {s.price.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">Quantity</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-10 w-10 items-center justify-center rounded-btn border border-border bg-white text-lg font-semibold transition-colors hover:border-forest-green">−</button>
                <span className="w-8 text-center font-heading text-xl font-bold">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="flex h-10 w-10 items-center justify-center rounded-btn border border-border bg-white text-lg font-semibold transition-colors hover:border-forest-green">+</button>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="font-heading text-2xl font-bold text-forest-green">
                NPR {(sku.price * qty).toLocaleString()}
              </span>
              <div className="flex gap-3">
                <button onClick={handleAdd} className={`flex-1 rounded-btn px-5 py-3 text-sm font-bold uppercase tracking-wider transition-all sm:flex-initial ${added ? "bg-success text-white" : "border border-forest-green text-forest-green hover:bg-forest-green/5"}`}>
                  {added ? "✓ Added!" : "Add to Cart"}
                </button>
                <button
                  onClick={() => { addItem(product, selectedSku, qty); router.push("/checkout"); }}
                  className="flex-1 rounded-btn bg-forest-green px-5 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-forest-green-dark sm:flex-initial"
                >
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
