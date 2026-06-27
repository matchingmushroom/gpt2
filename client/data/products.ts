export interface SKU {
  label: string;
  weightGrams: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  isFeatured: boolean;
  skus: SKU[];
  image: string;
  images?: string[];
}
