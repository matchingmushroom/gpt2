"use client";

import { useState } from "react";
import Link from "next/link";
import { getAllProducts } from "@/lib/products";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";

export default function ProductsPage() {
  const all = getAllProducts();
  const categories = [...new Set(all.map((p) => p.category))];
  const [activeCat, setActiveCat] = useState("All");

  const filtered = activeCat === "All" ? all : all.filter((p) => p.category === activeCat);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-2 font-heading text-2xl font-bold text-text">All Products</h1>
        <p className="mb-6 text-sm text-text-light">Browse our full range of homemade pickles.</p>

        <div className="mb-8 flex flex-wrap gap-2">
          <button onClick={() => setActiveCat("All")} className={`rounded-btn border px-4 py-1.5 text-sm font-medium transition-colors ${activeCat === "All" ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}>All</button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCat(cat)} className={`rounded-btn border px-4 py-1.5 text-sm font-medium transition-colors ${activeCat === cat ? "border-forest-green bg-forest-green text-white" : "border-border bg-white text-text hover:border-forest-green"}`}>{cat}</button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
