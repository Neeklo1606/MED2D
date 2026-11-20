import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { bySlug, PRODUCTS } from "@/catalog/data";
import { getField } from "@/content/registry";
import ProductView from "@/shop/ProductView";

export function generateStaticParams() { return PRODUCTS.map((p) => ({ slug: p.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = bySlug.get((await params).slug);
  return p ? { title: `${p.title} MEDFORM`, description: p.short, alternates: { canonical: `/product/${p.slug}` } } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = bySlug.get((await params).slug);
  if (!p) notFound();
  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-16 pt-1 md:px-10">
      <nav aria-label="Хлебные крошки" className="mb-3 text-xs text-muted">
        <Link href="/" className="underline-offset-2 hover:underline">{getField("product.crumbs.home")}</Link> / <Link href="/catalog" className="underline-offset-2 hover:underline">{getField("product.crumbs.catalog")}</Link> / <span className="text-ink">{p.title}</span>
      </nav>
      <ProductView p={p} />
    </main>
  );
}
