import data from "@/data/products.json";
import type { Product } from "@/data/products";

const products = data as Product[];

export function getAllProducts(): Product[] {
  return products;
}

export function getFeaturedProducts(): Product[] {
  return products.filter((p) => p.isFeatured);
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductCategories(): string[] {
  return [...new Set(products.map((p) => p.category))];
}

export { fetchProductsFromFirestore, fetchProductBySlugFromFirestore } from "./firestoreProducts";

export type { Product } from "@/data/products";
