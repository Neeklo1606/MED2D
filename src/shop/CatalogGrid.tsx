"use client";
import Link from "next/link";
import { useState } from "react";
import { COLORS, formatRub, PRODUCTS, type Product } from "@/catalog/data";
import { getField as t } from "@/content/registry";

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
    <section aria-labelledby="all-products" className="mx-auto max-w-[1440px] px-4 pb-32 pt-6 md:px-10 lg:pb-16">
      <h2 id="all-products" className="font-display text-xl font-black uppercase md:text-3xl">{t("catalog.grid.title")}</h2>
      <div role="group" aria-label={t("catalog.grid.filters")} className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {FILTERS.map((x) => (
          <button key={x.id} type="button" aria-pressed={f === x.id} onClick={() => setF(x.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${f === x.id ? "bg-ink text-white" : "border border-line bg-surface"}`}>{x.label}</button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <li key={p.slug}>
            <Link href={`/product/${p.slug}`} className="press press-lg flex h-full flex-col rounded-[var(--radius-lg)] bg-surface p-3">
              <div className="grid aspect-square place-items-center rounded-[var(--radius-md)] bg-bg" aria-hidden>
                <span className="size-16 rounded-full border border-line md:size-20" style={{ background: COLORS[p.colors[0]].hex }} />
              </div>
              <h3 className="mt-3 font-display text-[10px] font-bold uppercase leading-snug md:text-[11px]">{p.title}</h3>
              <p className="mt-1 text-sm font-semibold">{p.priceRub === null ? <span className="text-muted">{t("catalog.card.pricePending")}</span> : formatRub(p.priceRub)}</p>
              <div className="mt-auto flex flex-wrap gap-1 pt-2" aria-label={`Цветов: ${p.colors.length}`}>
                {p.colors.map((c) => <span key={c} className="size-3.5 rounded-full border border-line" style={{ background: COLORS[c].hex }} />)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
