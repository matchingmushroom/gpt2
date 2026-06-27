"use client";

import { useState } from "react";
import { useCombos } from "@/hooks/useCombos";
import { useCart } from "@/lib/cart";
import ProductImage from "./ProductImage";
import type { Combo } from "@/data/comboTypes";

function ComboCard({ combo }: { combo: Combo }) {
  const { addCombo } = useCart();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [imgIndex, setImgIndex] = useState(0);

  const images = combo.images ?? [];

  const handleAdd = () => {
    addCombo(combo.id, combo.name, combo.items.map((i) => ({
      productId: i.productId,
      productName: i.productName,
      skuId: i.skuId,
      skuLabel: i.skuLabel,
      quantity: i.quantity,
      price: 0,
      image: "",
    })));
    setFeedback("Added!");
    setTimeout(() => setFeedback(null), 1500);
  };

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i - 1 + images.length) % images.length);
  };
  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i + 1) % images.length);
  };

  const itemTotal = combo.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-lg">
      <div className="relative aspect-video overflow-hidden bg-beige/50 text-5xl">
        <ProductImage src={images[imgIndex] || null} alt={combo.name} className="text-5xl" icon="🎯" />
        {images.length > 1 && (
          <>
            <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/70 px-2 py-1.5 text-sm text-text shadow transition-opacity hover:bg-white sm:px-1.5 sm:py-1 sm:text-xs">‹</button>
            <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/70 px-2 py-1.5 text-sm text-text shadow transition-opacity hover:bg-white sm:px-1.5 sm:py-1 sm:text-xs">›</button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <span key={i} className={`block h-1.5 w-1.5 rounded-full transition-colors ${i === imgIndex ? "bg-forest-green" : "bg-white/60"}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-heading text-lg font-semibold text-text">{combo.name}</h3>
        {combo.description && (
          <p className="line-clamp-2 text-sm text-text-light">{combo.description}</p>
        )}
        <div className="mt-1 space-y-1">
          {combo.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-green" />
              <span>{item.productName} — {item.skuLabel} <span className="text-text-light">×{item.quantity}</span></span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <span className="text-lg font-bold text-forest-green">NPR {combo.price.toLocaleString()}</span>
            <span className="ml-2 text-xs text-text-muted">{itemTotal} item{itemTotal > 1 ? "s" : ""}</span>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="mt-2 w-full rounded-btn bg-forest-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark"
        >
          {feedback || "Add to Cart"}
        </button>
      </div>
    </div>
  );
}

export default function CombosSection() {
  const { combos, loading } = useCombos();

  if (loading) return null;
  if (combos.length === 0) return null;

  return (
    <section id="combos" className="bg-cream px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-3xl font-bold text-forest-green sm:text-4xl">Combo Offers</h2>
          <p className="mt-2 text-text-light">Best value bundles, handpicked for you</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => (
            <ComboCard key={combo.id} combo={combo} />
          ))}
        </div>
      </div>
    </section>
  );
}
