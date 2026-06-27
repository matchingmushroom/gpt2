import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import type { Product } from "@/data/products";
import jsonProducts from "@/data/products.json";

interface FirestoreProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryIds: string[];
  images: string[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
}

interface FirestoreSKU {
  id: string;
  skuCode: string;
  label: string;
  weightInGrams: number;
  price: number;
  unit: string;
  isActive: boolean;
}

interface FirestoreCategory {
  id: string;
  name: string;
}

let catMapCache: Record<string, string> | null = null;

async function getCategoryMap(): Promise<Record<string, string>> {
  if (catMapCache) return catMapCache;
  const snap = await getDocs(collection(db, "categories"));
  const map: Record<string, string> = {};
  snap.forEach((d) => {
    const cat = d.data() as FirestoreCategory;
    map[d.id] = cat.name;
  });
  catMapCache = map;
  return map;
}

export async function fetchProductsFromFirestore(): Promise<Product[]> {
  const catMap = await getCategoryMap();
  const snap = await getDocs(
    query(collection(db, "products"), where("isActive", "==", true))
  );

  const jsonMap = new Map((jsonProducts as Product[]).map((p) => [p.slug, p]));

  const results: Product[] = [];
  for (const d of snap.docs) {
    const p = d.data() as FirestoreProduct;
    const slug = p.slug || d.id;
    const jsonFallback = jsonMap.get(slug);

    const categoryName =
      p.categoryIds?.map((id) => catMap[id]).filter(Boolean).join(", ") || jsonFallback?.category || "Uncategorized";

    const skus = await fetchSKUs(d.id);

    results.push({
      id: d.id,
      name: p.name,
      slug,
      description: p.description || jsonFallback?.description || "",
      category: categoryName,
      isFeatured: p.isFeatured ?? jsonFallback?.isFeatured ?? false,
      skus: skus.length > 0 ? skus : jsonFallback?.skus || [],
      image: p.images?.length ? "" : jsonFallback?.image || "",
      images: p.images?.length ? p.images : jsonFallback?.images || [],
    });
  }
  return results;
}

export async function fetchProductBySlugFromFirestore(slug: string): Promise<Product | null> {
  const catMap = await getCategoryMap();
  const snap = await getDocs(
    query(collection(db, "products"), where("slug", "==", slug), where("isActive", "==", true))
  );

  if (snap.empty) return null;
  const d = snap.docs[0];
  const p = d.data() as FirestoreProduct;

  const jsonFallback = (jsonProducts as Product[]).find((pr) => pr.slug === slug);

  const categoryName =
    p.categoryIds?.map((id) => catMap[id]).filter(Boolean).join(", ") || jsonFallback?.category || "Uncategorized";

  const skus = await fetchSKUs(d.id);

  return {
    id: d.id,
    name: p.name,
    slug: p.slug || d.id,
    description: p.description || jsonFallback?.description || "",
    category: categoryName,
    isFeatured: p.isFeatured ?? jsonFallback?.isFeatured ?? false,
    skus: skus.length > 0 ? skus : jsonFallback?.skus || [],
    image: p.images?.length ? "" : jsonFallback?.image || "",
    images: p.images?.length ? p.images : jsonFallback?.images || [],
  };
}

async function fetchSKUs(productId: string): Promise<Product["skus"]> {
  const snap = await getDocs(collection(db, "products", productId, "skus"));
  return snap.docs
    .filter((s) => (s.data() as FirestoreSKU).isActive !== false)
    .map((s) => {
      const sku = s.data() as FirestoreSKU;
      return {
        label: sku.label || `${sku.weightInGrams} ${sku.unit || "gm"}`,
        weightGrams: sku.weightInGrams,
        price: sku.price,
      };
    });
}
