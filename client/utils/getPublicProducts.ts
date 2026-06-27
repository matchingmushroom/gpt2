import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  images: string[];
  categoryIds: string[];
  categoryNames: string[];
  tags: string[];
  isFeatured: boolean;
  isActive: boolean;
  skus: {
    id: string;
    skuCode: string;
    label: string;
    weightInGrams: number;
    price: number;
    stock: number;
    isActive: boolean;
    isAvailable: boolean;
  }[];
  minPrice: number;
  maxPrice: number;
  isInStock: boolean;
}

export interface PublicCatalog {
  version: number;
  updatedAt: string | null;
  products: PublicProduct[];
}

export async function getPublicProducts(): Promise<PublicCatalog> {
  // 1. Try static JSON (0 reads)
  try {
    const res = await fetch("/data/products.json");
    if (res.ok) return await res.json();
  } catch {}

  // 2. Fallback: Firestore cache doc (1 read)
  try {
    const snap = await getDoc(doc(db, "products", "publicCatalog"));
    if (snap.exists()) return snap.data() as PublicCatalog;
  } catch {}

  // 3. Last resort: empty catalog
  return { version: 0, updatedAt: null, products: [] };
}
