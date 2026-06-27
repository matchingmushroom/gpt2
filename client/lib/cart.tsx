"use client";

import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import type { Product } from "@/lib/products";

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string;
  skuId?: string;
  skuIndex: number;
  skuLabel: string;
  skuWeight: number;
  price: number;
  quantity: number;
  comboId?: string;
  comboName?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: { productId: string; skuIndex: number; comboId?: string } }
  | { type: "UPDATE_QUANTITY"; payload: { productId: string; skuIndex: number; comboId?: string; quantity: number } }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; payload: CartItem[] };

function matchKey(item: CartItem, id: string, skuIdx: number, comboId?: string) {
  return item.productId === id && item.skuIndex === skuIdx && (item.comboId || "") === (comboId || "");
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const idx = state.items.findIndex((i) => matchKey(i, action.payload.productId, action.payload.skuIndex, action.payload.comboId));
      if (idx >= 0) {
        const next = [...state.items];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + action.payload.quantity };
        return { items: next };
      }
      return { items: [...state.items, action.payload] };
    }
    case "REMOVE_ITEM":
      return { items: state.items.filter((i) => !matchKey(i, action.payload.productId, action.payload.skuIndex, action.payload.comboId)) };
    case "UPDATE_QUANTITY": {
      if (action.payload.quantity <= 0) {
        return { items: state.items.filter((i) => !matchKey(i, action.payload.productId, action.payload.skuIndex, action.payload.comboId)) };
      }
      return { items: state.items.map((i) => matchKey(i, action.payload.productId, action.payload.skuIndex, action.payload.comboId) ? { ...i, quantity: action.payload.quantity } : i) };
    }
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return { items: action.payload };
    default:
      return state;
  }
}

const CartContext = createContext<{
  items: CartItem[];
  addItem: (product: Product, skuIndex: number, quantity?: number) => void;
  addCombo: (comboId: string, comboName: string, items: Array<{ productId: string; productName: string; skuId: string; skuLabel: string; quantity: number; price: number; image: string }>) => void;
  removeItem: (productId: string, skuIndex: number, comboId?: string) => void;
  updateQuantity: (productId: string, skuIndex: number, quantity: number, comboId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
} | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gpt-cart");
      if (saved) dispatch({ type: "HYDRATE", payload: JSON.parse(saved) });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("gpt-cart", JSON.stringify(state.items));
  }, [state.items]);

  const addItem = (product: Product, skuIndex: number, quantity = 1) => {
    const sku = product.skus[skuIndex];
    dispatch({
      type: "ADD_ITEM",
      payload: {
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        productImage: product.image,
        skuIndex,
        skuLabel: sku.label,
        skuWeight: sku.weightGrams,
        price: sku.price,
        quantity,
      },
    });
  };

  const addCombo = (comboId: string, comboName: string, items: Array<{ productId: string; productName: string; skuId: string; skuLabel: string; quantity: number; price: number; image: string }>) => {
    for (const item of items) {
      dispatch({
        type: "ADD_ITEM",
        payload: {
          productId: item.productId,
          productSlug: item.productId,
          productName: item.productName,
          productImage: item.image,
          skuIndex: 0,
          skuLabel: item.skuLabel,
          skuWeight: 0,
          price: item.price,
          quantity: item.quantity,
          comboId,
          comboName,
        },
      });
    }
  };

  const removeItem = (productId: string, skuIndex: number, comboId?: string) =>
    dispatch({ type: "REMOVE_ITEM", payload: { productId, skuIndex, comboId } });

  const updateQuantity = (productId: string, skuIndex: number, quantity: number, comboId?: string) =>
    dispatch({ type: "UPDATE_QUANTITY", payload: { productId, skuIndex, quantity, comboId } });

  const clearCart = () => dispatch({ type: "CLEAR" });

  const totalItems = state.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = state.items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: state.items, addItem, addCombo, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be inside CartProvider");
  return ctx;
}
