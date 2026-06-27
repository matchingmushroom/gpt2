"use client";

import { useState, useEffect } from "react";
import { fetchProductsFromFirestore } from "@/lib/firestoreProducts";
import { getAllProducts } from "@/lib/products";
import type { Product } from "@/data/products";

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchProductsFromFirestore()
      .then((result) => {
        if (!cancelled) {
          setProducts(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const data = products ?? getAllProducts();
  return { products: data, loading };
}
