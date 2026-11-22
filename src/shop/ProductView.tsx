"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COLORS, formatRub, type Product } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import { emptyLook, toQuery, wear } from "@/configurator/look";
import { useCart, useToast } from "@/configurator/store";
import { detectRenderer, type RendererKind } from "@/configurator/renderers/types";
import PhotoRenderer from "@/configurator/renderers/PhotoRenderer";
import { Stepper } from "./CartView";
import ProductImage from "./ProductImage";
import SizeChart from "./SizeChart";

const ThreeRenderer = dynamic(() => import("@/configurator/renderers/ThreeRenderer"), {
  ssr: false,
  loading: () => <div aria-hidden className="absolute bottom-[6%] left-1/2 h-[84%] w-[24%] -translate-x-1/2 animate-pulse rounded-t-[999px] rounded-b-[40px] bg-black/[0.04]" />,
});
const noop = () => () => {};

export default function ProductView({ p }: { p: Product }) {
  const [color, setColor] = useState(p.colors[0]);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const [chart, setChart] = useState(false);
  // мобильная панель «В корзину», пока основная кнопка вне экрана
  const buyRef = useRef<HTMLDivElement>(null);
  const [buyHidden, setBuyHidden] = useState(false);
  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBuyHidden(!e.isIntersecting && e.boundingClientRect.top > 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const webgl = useSyncExternalStore(noop, detectRenderer, () => "photo" as RendererKind) === "three";
  // Реалистичная 3D-модель, если есть WebGL; без него вещи с фото-слоями на фото-модели, остальные фото товара
  const onPhoto = ["top", "bottom", "feet"].includes(p.slot);
  const kind: RendererKind = webgl ? "three" : onPhoto ? "photo" : "three";
  const add = useCart((s) => s.add);
  const toast = useToast((s) => s.show);
  const look = p.model ? wear(emptyLook("f"), { slug: p.slug, color, size }) : emptyLook("f");
  const label = `${p.title}, ${COLORS[color].name}`;

  const addToCart = () => {
    if (p.sizes.length && !size) {
      setNeedSize(true);
      toast(t("catalog.card.sizeMissing"));
      document.getElementById("size-group")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (p.priceRub === null) { toast(t("catalog.toast.pending")); return; }
    add(Array.from({ length: qty }, () => ({ slug: p.slug, color, size })));
    toast(t("catalog.toast.added"));
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
      <div className="relative h-[52svh] max-h-[560px] min-h-[340px] overflow-hidden rounded-[var(--radius-lg)] bg-surface md:h-[560px] lg:sticky lg:top-4 lg:self-start lg:h-[min(680px,calc(100svh-32px))] lg:max-h-none">
        {p.model && webgl ? (
          <ThreeRenderer look={look} label={label} />
        ) : p.model && kind === "photo" ? (
          <PhotoRenderer look={look} label={label} />
        ) : (
          <ProductImage slug={p.slug} color={color} alt={label} className="h-full w-full p-6" />
        )}
        <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-bg/90 px-3 py-1.5 text-xs text-muted">{t("product.gallery.pending")}</p>
      </div>

      <div className="mt-5 lg:mt-0">
        <h1 className="font-display text-[22px] font-black uppercase leading-[1.1] md:text-3xl">{p.title}</h1>
        <p className="mt-2 font-display text-2xl font-black tabular-nums">{p.priceRub === null ? <span className="text-base text-muted">{t("catalog.card.pricePending")}</span> : formatRub(p.priceRub)}</p>
        <p className="mt-3 text-[15px] leading-snug text-muted">{p.short}</p>

        <div className="mt-5 space-y-4 rounded-[var(--radius-lg)] bg-surface p-4">
          <div>
            <p className="text-sm text-muted">{t("catalog.card.color")}: <span className="font-semibold text-ink">{COLORS[color].name}</span></p>
            <div role="radiogroup" aria-label={t("catalog.card.color")} className="-mx-1.5 mt-1 flex flex-wrap">
              {p.colors.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={COLORS[c].name} onClick={() => setColor(c)} className="grid size-11 place-items-center rounded-full">
                  <span className={`size-8 rounded-full ${c === "white" || c === "silver" ? "border border-line" : ""} ${color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: COLORS[c].hex }} />
                </button>
              ))}
            </div>
          </div>
          {p.sizes.length > 0 && (
            <div id="size-group" className="scroll-mt-24">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted">{t("catalog.card.size")}{size ? <>: <span className="font-semibold text-ink">{size}</span></> : ""}</p>
                <button type="button" onClick={() => setChart(true)} className="-my-3 flex min-h-11 items-center text-sm underline decoration-line underline-offset-[3px] hover:decoration-ink">{t("catalog.card.sizeChart")}</button>
              </div>
              <div role="radiogroup" aria-label={t("catalog.card.size")} className="mt-2 flex flex-wrap gap-1.5">
                {p.sizes.map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => { setSize(s); setNeedSize(false); }}
                    className={`grid min-h-11 min-w-11 place-items-center rounded-full px-2.5 text-sm font-semibold tabular-nums ${size === s ? "bg-ink text-white" : needSize ? "border border-red-600/60" : "border border-line hover:border-ink/30"}`}>{s}</button>
                ))}
              </div>
              {needSize && <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700">{t("catalog.card.sizeMissing")}</p>}
            </div>
          )}
          <div ref={buyRef} className="flex items-center gap-3">
            <Stepper value={qty} onChange={setQty} label="Количество" />
            <button type="button" onClick={addToCart} className="press flex min-h-12 flex-1 items-center justify-center rounded-full bg-accent text-base font-semibold text-white">{t("product.buy.add")}</button>
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
      {buyHidden && (
        <div className="fade-up fixed inset-x-3 z-40 mx-auto flex max-w-[560px] items-center gap-3 rounded-full bg-surface py-1.5 pl-5 pr-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.14)] ring-1 ring-line lg:hidden" style={{ bottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
          <span className="min-w-0 flex-1 truncate font-display text-[15px] tabular-nums">{p.priceRub === null ? t("catalog.card.pricePending") : formatRub(p.priceRub)}</span>
          <button type="button" onClick={addToCart} className="min-h-11 shrink-0 rounded-full bg-accent px-6 text-[15px] font-semibold text-white">{t("product.buy.add")}</button>
        </div>
      )}
      {chart && <SizeChart onClose={() => setChart(false)} />}
    </div>
  );
}
