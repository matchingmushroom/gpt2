export interface ComboItem {
  productId: string;
  productName: string;
  skuId: string;
  skuLabel: string;
  quantity: number;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  images: string[];
  price: number;
  items: ComboItem[];
  isActive: boolean;
}
