"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toDirectDriveUrl } from "@/lib/driveUrl";

export default function Footer() {
  const [store, setStore] = useState<{ storeName: string; logoUrl: string | null; footerLogoUrl: string | null; logoDisplay: string } | null>(null);

  useEffect(() => {
    getDoc(doc(db, "settings/store")).then((snap) => {
      if (snap.exists()) setStore(snap.data() as any);
    }).catch(() => {});
  }, []);

  const storeName = store?.storeName || "Great Pickle Taste";
  const display = (store?.logoDisplay as "logo" | "name" | "both") || "both";
  const rawLogo = store?.footerLogoUrl || store?.logoUrl || "";
  const logoUrl = rawLogo ? toDirectDriveUrl(
    rawLogo.startsWith("http") ? rawLogo : `${rawLogo.startsWith("/") ? "" : "/images/"}${rawLogo}`
  ) : null;

  return (
    <footer id="contact" className="bg-forest-green-dark px-4 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              {logoUrl && display !== "name" ? (
                <span className="inline-flex items-center">
                  <img src={logoUrl} alt="" style={{ maxWidth: "none", height: 70, width: "auto", display: "inline" }} />
                </span>
              ) : (
                <span className="flex h-9 w-9 items-center justify-center text-base">🥒</span>
              )}
              {display !== "logo" && <span className="font-heading text-lg font-bold">{storeName}</span>}
            </div>
            <p className="mt-3 text-sm text-white/60">
              Homemade authentic Nepali pickles, crafted with traditional recipes
              and the finest ingredients.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-mustard-gold">
              Quick Links
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-white/60">
              <li><Link href="/" className="transition-colors hover:text-white">Home</Link></li>
              <li><a href="#products" className="transition-colors hover:text-white">Products</a></li>
              <li><Link href="/loyalty/" className="transition-colors hover:text-white">Loyalty</Link></li>
              <li><a href="#about" className="transition-colors hover:text-white">About Us</a></li>
              <li><a href="#contact" className="transition-colors hover:text-white">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-mustard-gold">
              Contact
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-white/60">
              <li>Pokhara, Nepal</li>
              <li>info@greatpickletaste.com</li>
              <li>+977-98XXXXXXXX</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-sm text-white/40">
          &copy; {new Date().getFullYear()} Great Pickle Taste. All rights reserved.
        </div>
      </div>
    </footer>
  );
}