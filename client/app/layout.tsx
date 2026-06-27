import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Great Pickle Taste",
  description: "Homemade Nepali pickles — crafted with tradition, packed with flavor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-cream text-text font-body antialiased">
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
