"use client";
import Link from "next/link";
import { useState } from "react";
import { COLORS, formatRub, PRODUCTS, type Product } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import ProductImage from "./ProductImage";

const FILTERS: { id: string; label: string; match: (p: Product) => boolean }[] = [
  { id: "all", label: "Все", match: () => true },
  { id: "clothes", label: "Одежда", match: (p) => ["top", "bottom", "coat"].includes(p.category) },
  { id: "head", label: "Головные уборы", match: (p) => p.category === "head" },
  { id: "feet", label: "Обувь", match: (p) => p.category === "feet" },
  { id: "accessory", label: "Аксессуары", match: (p) => p.category === "accessory" },
];

export default function CatalogGrid() {
  const [f, setF] = useState("all");
  const list = PRODUCTS.filter(FILTERS.find((x) => x.id === f)!.match);
  return (
    <section aria-labelledby="all-products" className="mx-auto max-w-[1440px] scroll-mt-4 px-5 pb-12 pt-8 md:px-10 lg:pb-16">
      <h2 id="all-products" className="font-display text-[22px] font-black uppercase md:text-3xl">{t("catalog.grid.title")}</h2>
      <div role="group" aria-label={t("catalog.grid.filters")} className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        {FILTERS.map((x) => (
          <button key={x.id} type="button" aria-pressed={f === x.id} onClick={() => setF(x.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${f === x.id ? "bg-ink text-white" : "border border-line bg-surface hover:border-ink/30"}`}>{x.label}</button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <li key={p.slug}>
            <Link href={`/product/${p.slug}`} className="press press-lg flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-card p-3 transition-colors hover:border-ink/20 md:p-4">
              <div className="aspect-square rounded-[12px] bg-bg p-3" aria-hidden>
                <ProductImage slug={p.slug} color={p.colors[0]} className="h-full w-full" />
              </div>
              <h3 className="mt-3 font-display text-[12px] font-bold uppercase leading-[1.2] md:text-[13px]">{p.title}</h3>
              <p className="mt-1.5 text-sm font-semibold tabular-nums">{p.priceRub === null ? <span className="text-muted">{t("catalog.card.pricePending")}</span> : formatRub(p.priceRub)}</p>
              <div className="mt-auto flex flex-wrap gap-1 pt-2.5" role="img" aria-label={`Цветов: ${p.colors.length}`}>
                {p.colors.map((c) => <span key={c} className={`size-3.5 rounded-full ${c === "white" || c === "silver" ? "border border-line" : ""}`} style={{ background: COLORS[c].hex }} />)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
