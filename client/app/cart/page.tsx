"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductImage from "@/components/ProductImage";

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, clearCart } = useCart();

  const delivery = subtotal >= 500 ? 0 : 50;
  const total = subtotal + delivery;

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-text">Shopping Cart</h1>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-sm text-error transition-colors hover:text-chili-red">Clear All</button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-card bg-white p-12 text-center shadow-card">
            <p className="text-5xl">🛒</p>
            <p className="mt-4 text-text-light">Your cart is empty</p>
            <Link href="/#products" className="mt-4 inline-block rounded-btn bg-forest-green px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={`${item.productId}-${item.skuIndex}`} className="flex flex-wrap items-center gap-3 rounded-card bg-white p-3 shadow-card sm:flex-nowrap sm:gap-4 sm:p-4">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-beige/50 sm:h-16 sm:w-16">
                  <ProductImage src={item.productImage} alt={item.productName} className="h-full w-full object-cover text-2xl sm:text-3xl" icon={item.productImage} />
                </div>
                <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                  <Link href={`/products/${item.productSlug}`} className="text-sm font-semibold text-text transition-colors hover:text-forest-green sm:font-heading">
                    {item.productName}
                  </Link>
                  <p className="text-xs text-text-muted sm:text-sm">{item.skuLabel} — NPR {item.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.productId, item.skuIndex, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs transition-colors hover:border-forest-green sm:h-8 sm:w-8 sm:text-sm">−</button>
                  <span className="w-5 text-center text-sm font-semibold sm:w-6">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, item.skuIndex, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs transition-colors hover:border-forest-green sm:h-8 sm:w-8 sm:text-sm">+</button>
                </div>
                <div className="text-right text-sm font-semibold text-forest-green sm:w-24">
                  NPR {(item.price * item.quantity).toLocaleString()}
                </div>
                <button onClick={() => removeItem(item.productId, item.skuIndex)} className="text-text-muted transition-colors hover:text-error" aria-label="Remove">
                  ✕
                </button>
              </div>
            ))}

            <div className="rounded-card bg-white p-6 shadow-card">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-light">Subtotal</span>
                  <span className="font-semibold">NPR {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-light">Delivery</span>
                  <span className="font-semibold">{delivery === 0 ? <span className="text-success">Free</span> : `NPR ${delivery}`}</span>
                </div>
                {delivery > 0 && <p className="text-xs text-text-muted">Free delivery on orders over NPR 500</p>}
                <div className="border-t border-border pt-2">
                  <div className="flex justify-between text-lg">
                    <span className="font-heading font-bold">Total</span>
                    <span className="font-heading font-bold text-forest-green">NPR {total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <Link href="/checkout" className="mt-4 block w-full rounded-btn bg-forest-green py-3 text-center text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-forest-green-dark">
                Proceed to Checkout
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
