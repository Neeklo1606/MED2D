"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { COLORS, formatRub, type Product } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { emptyLook, toQuery, wear } from "@/configurator/look";
import { useCart, useToast } from "@/configurator/store";
import { detectRenderer, type RendererKind } from "@/configurator/renderers/types";
import PhotoRenderer from "@/configurator/renderers/PhotoRenderer";
import { Stepper } from "./CartView";

const ThreeRenderer = dynamic(() => import("@/configurator/renderers/ThreeRenderer"), { ssr: false });
const noop = () => () => {};

export default function ProductView({ p }: { p: Product }) {
  const [color, setColor] = useState(p.colors[0]);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const kind = useSyncExternalStore(noop, detectRenderer, () => "photo" as RendererKind);
  const add = useCart((s) => s.add);
  const toast = useToast((s) => s.show);
  const look = p.model ? wear(emptyLook("f"), { slug: p.slug, color, size }) : emptyLook("f");
  const label = `${p.title}, ${COLORS[color].name}`;

  const addToCart = () => {
    if (p.sizes.length && !size) { setNeedSize(true); toast(t("catalog.card.sizeMissing")); return; }
    if (p.priceRub === null) { toast(t("catalog.toast.pending")); return; }
    add(Array.from({ length: qty }, () => ({ slug: p.slug, color, size })));
    toast(t("catalog.toast.added"));
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
      <div className="relative h-[52svh] min-h-[340px] overflow-hidden rounded-[var(--radius-lg)] bg-surface lg:h-[640px]">
        {p.model ? (
          kind === "three" ? <ThreeRenderer look={look} label={label} /> : <PhotoRenderer look={look} label={label} />
        ) : (
          <div className="grid h-full place-items-center" role="img" aria-label={label}>
            <span className="size-40 rounded-full border border-line" style={{ background: COLORS[color].hex }} />
          </div>
        )}
        <p className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-xs text-muted">{t("product.gallery.pending")}</p>
      </div>

      <div className="mt-5 lg:mt-0">
        <h1 className="font-display text-xl font-black uppercase leading-tight md:text-3xl">{p.title}</h1>
        <p className="mt-2 font-display text-2xl font-black">{p.priceRub === null ? <span className="text-base text-muted">{t("catalog.card.pricePending")}</span> : formatRub(p.priceRub)}</p>
        <p className="mt-3 text-sm text-muted">{p.short}</p>

        <div className="mt-5 space-y-4 rounded-[var(--radius-lg)] bg-surface p-4">
          <div>
            <p className="text-sm">{t("catalog.card.color")}: <strong>{COLORS[color].name}</strong></p>
            <div role="radiogroup" aria-label={t("catalog.card.color")} className="mt-2 flex flex-wrap gap-1">
              {p.colors.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={COLORS[c].name} onClick={() => setColor(c)} className="grid size-11 place-items-center rounded-full">
                  <span className={`size-8 rounded-full border border-line ${color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: COLORS[c].hex }} />
                </button>
              ))}
            </div>
          </div>
          {p.sizes.length > 0 && (
            <div>
              <p className="text-sm">{t("catalog.card.size")}</p>
              <div role="radiogroup" aria-label={t("catalog.card.size")} className="mt-2 flex flex-wrap gap-1.5">
                {p.sizes.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => { setSize(s); setNeedSize(false); }}
                    className={`grid min-h-11 min-w-11 place-items-center rounded-[var(--radius-sm)] px-2 text-sm font-semibold ${size === s ? "bg-ink text-white" : "border border-line"}`}>{s}</button>
                ))}
              </div>
              {needSize && <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700">{t("catalog.card.sizeMissing")}</p>}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Stepper value={qty} onChange={setQty} label="Количество" />
            <button type="button" onClick={addToCart} className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-accent text-base font-semibold text-white">{t("product.buy.add")}</button>
          </div>
          {p.model && (
            <Link href={`/catalog?${toQuery(look)}`} className="press flex min-h-12 items-center justify-center rounded-full border border-ink text-sm font-semibold">{t("product.buy.tryOn")}</Link>
          )}
        </div>

        <dl className="mt-5 divide-y divide-line rounded-[var(--radius-lg)] bg-surface px-4 text-sm">
          {[["product.info.composition"], ["product.info.care"], ["product.info.manufacturer"], ["product.info.country"], ["product.info.certificate"]].map(([k]) => (
            <div key={k} className="flex justify-between gap-4 py-3">
              <dt className="text-muted">{t(k)}</dt>
              <dd className="text-right">{t("product.info.pending")}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
