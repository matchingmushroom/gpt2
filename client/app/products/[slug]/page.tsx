import { getAllProducts } from "@/lib/products";
import ProductDetail from "./ProductDetail";

export function generateStaticParams() {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ProductDetail params={params} />;
}
