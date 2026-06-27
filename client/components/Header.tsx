"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toDirectDriveUrl } from "@/lib/driveUrl";
import { useCart } from "@/lib/cart";

export default function Header() {
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [store, setStore] = useState<{ storeName: string; logoUrl: string | null; logoDisplay: string } | null>(null);

  useEffect(() => {
    getDoc(doc(db, "settings/store")).then((snap) => {
      if (snap.exists()) setStore(snap.data() as any);
    }).catch(() => {});
  }, []);

  const storeName = store?.storeName || "Great Pickle Taste";
  const display = (store?.logoDisplay as "logo" | "name" | "both") || "both";
  const rawLogo = store?.logoUrl || "";
  const logoUrl = rawLogo ? toDirectDriveUrl(
    rawLogo.startsWith("http") ? rawLogo : `${rawLogo.startsWith("/") ? "" : "/images/"}${rawLogo}`
  ) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-beige bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          {logoUrl && display !== "name" && (
            <span className="inline-flex shrink-0 items-center bg-white px-1 py-0.5">
              <img src={logoUrl} alt="" style={{ maxWidth: "none", height: 60, width: "auto", display: "inline" }} />
            </span>
          )}
          {display !== "logo" && <span className="font-heading text-lg font-bold text-forest-green">{storeName}</span>}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link href="/" className="text-text-light transition-colors hover:text-forest-green">Home</Link>
          <Link href="/products/" className="text-text-light transition-colors hover:text-forest-green">Products</Link>
          <Link href="/about/" className="text-text-light transition-colors hover:text-forest-green">About</Link>
          <Link href="/track/" className="text-text-light transition-colors hover:text-forest-green">Track</Link>
          <Link href="/cart/" className="relative text-text-light transition-colors hover:text-forest-green">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-base shadow-sm backdrop-blur-sm ring-1 ring-beige/50 transition-colors hover:bg-white/80">🛒</span>
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-chili-red text-xs font-bold text-white">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>
        </nav>

        {/* Mobile hamburger + cart */}
        <div className="flex items-center gap-2 sm:hidden">
          <Link href="/cart/" className="relative text-text-light">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-base shadow-sm backdrop-blur-sm ring-1 ring-beige/50">🛒</span>
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-chili-red text-xs font-bold text-white">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-lg shadow-sm ring-1 ring-beige/50 transition-colors hover:bg-white/80">
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="border-t border-beige bg-white sm:hidden">
          <div className="space-y-1 px-4 pb-3 pt-2">
            <Link href="/" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-text-light transition-colors hover:bg-beige/50 hover:text-forest-green">Home</Link>
            <Link href="/products/" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-text-light transition-colors hover:bg-beige/50 hover:text-forest-green">Products</Link>
            <Link href="/about/" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-text-light transition-colors hover:bg-beige/50 hover:text-forest-green">About</Link>
            <Link href="/track/" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-text-light transition-colors hover:bg-beige/50 hover:text-forest-green">Track</Link>
          </div>
        </div>
      )}
    </header>
  );
}
