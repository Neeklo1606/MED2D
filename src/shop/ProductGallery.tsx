"use client";
import { useRef, useState } from "react";
import { COLORS, type Product } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import type { Look } from "@/configurator/look";
import { PhotoFigure, type Part } from "@/configurator/renderers/PhotoRenderer";
import ProductImage from "./ProductImage";

/** Вещи, снятые на фото-модели: показываем реальное фото с перекраской в выбранный цвет. */
const ON_PHOTO: Record<string, Part> = { anorak: "top", joggers: "bottom", sabo: "feet" };
/** Кадр фото (доли высоты листа) для крупного плана вещи. */
const FRAME: Record<Part, { y0: number; y1: number }> = { top: { y0: 0.16, y1: 0.53 }, bottom: { y0: 0.44, y1: 0.96 }, feet: { y0: 0.84, y1: 1 } };

type Slide = { key: string; label: string; node: React.ReactNode };

function Crop({ look, view, part }: { look: Look; view: "front" | "back"; part: Part }) {
  const f = FRAME[part];
  const k = 1 / (f.y1 - f.y0);
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 -translate-x-1/2" style={{ height: `${k * 100}%`, top: `${-f.y0 * k * 100}%` }}>
        <PhotoFigure look={look} view={view} only={part} />
      </div>
    </div>
  );
}

/** Галерея карточки товара: обычные фото, без 3D. Листается пальцем, точки и стрелки внизу. */
export default function ProductGallery({ p, color, className = "" }: { p: Product; color: string; className?: string }) {
  const part = ON_PHOTO[p.slug];
  const look: Look = { gender: "f", slots: { [p.slot]: { slug: p.slug, color, size: null } } };
  const name = `${p.title}, ${COLORS[color]?.name}`;
  const slides: Slide[] = part
    ? [
        { key: "front", label: t("product.gallery.front"), node: <Crop look={look} view="front" part={part} /> },
        { key: "back", label: t("product.gallery.back"), node: <Crop look={look} view="back" part={part} /> },
        { key: "model", label: t("product.gallery.onModel"), node: <div className="absolute inset-0 flex justify-center pt-3"><PhotoFigure look={look} view="front" only={part} /></div> },
        { key: "item", label: t("product.gallery.item"), node: <ProductImage slug={p.slug} color={color} className="absolute inset-6" /> },
      ]
    : [{ key: "item", label: t("product.gallery.item"), node: <ProductImage slug={p.slug} color={color} className="absolute inset-6" /> }];
  const rail = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const go = (n: number) => {
    const el = rail.current;
    if (!el) return;
    const k = Math.max(0, Math.min(slides.length - 1, n));
    el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" });
  };
  return (
    <div className={`relative overflow-hidden rounded-[16px] bg-[#ededed] ${className}`} role="region" aria-roledescription="галерея" aria-label={name}>
      <div ref={rail} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {slides.map((s, n) => (
          <figure key={s.key} className="relative h-full w-full shrink-0 snap-center" aria-label={`${s.label} (${n + 1} из ${slides.length})`}>
            {s.node}
          </figure>
        ))}
      </div>
      {!part && <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[11.5px] text-muted">{t("product.gallery.pending")}</p>}
      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label={t("product.gallery.prev")} className="relative grid size-8 place-items-center rounded-full bg-white/90 shadow-sm disabled:opacity-40 after:absolute after:-inset-1.5">‹</button>
          <div className="flex gap-1.5" aria-hidden>
            {slides.map((s, n) => <span key={s.key} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-ink" : "w-1.5 bg-ink/25"}`} />)}
          </div>
          <button type="button" onClick={() => go(i + 1)} disabled={i === slides.length - 1} aria-label={t("product.gallery.next")} className="relative grid size-8 place-items-center rounded-full bg-white/90 shadow-sm disabled:opacity-40 after:absolute after:-inset-1.5">›</button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{slides[i]?.label}</p>
    </div>
  );
}
