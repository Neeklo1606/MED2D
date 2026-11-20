"use client";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { COLORS, type Slot } from "@/catalog/data";
import { getField as t } from "@/content/registry";
import type { Look } from "../look";
import type { LookRendererHandle, LookRendererProps } from "./types";

/**
 * Фото-модель: реальное фото (вид спереди и сзади) с перекраской вещей.
 * Для каждой части есть слой тени и маска (tools/photo-model/segment.py):
 * фото → серая тень части → цвет через mask-image + multiply. Складки и свет сохраняются.
 */
export type Part = "top" | "bottom" | "feet";
type View = "front" | "back";
const BASE = "/photo-model/f";
const NEUTRAL = "#D9DADD";
const PARTS: Part[] = ["bottom", "top", "feet"];
// какие слоты образа показывает каждая часть фото
const PART_SLOTS: Record<Part, Slot[]> = { top: ["top"], bottom: ["bottom"], feet: ["feet"] };
// вещи, которых нет на фото (пока нет съёмки)
const NOT_ON_PHOTO: Slot[] = ["coat", "head", "accessory"];
const ORIGIN: Record<Slot | "full", string> = { full: "50% 45%", head: "50% 6%", top: "50% 32%", coat: "50% 40%", bottom: "50% 68%", feet: "50% 96%", accessory: "50% 40%" };

function partColor(look: Look, part: Part): string | null {
  for (const s of PART_SLOTS[part]) {
    const w = look.slots[s];
    if (w) return COLORS[w.color]?.hex ?? null;
  }
  return null;
}

const PhotoRenderer = forwardRef<LookRendererHandle, LookRendererProps>(function PhotoRenderer({ look, label }, ref) {
  const [view, setView] = useState<View>("front");
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState(ORIGIN.full);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number; pan: { x: number; y: number }; start: { x: number; y: number } } | null>(null);

  const reset = () => { setZoom(1); setOrigin(ORIGIN.full); setPan({ x: 0, y: 0 }); };
  useImperativeHandle(ref, () => ({
    zoomIn: () => setZoom((z) => Math.min(2.5, z + 0.3)),
    zoomOut: () => setZoom((z) => { const n = Math.max(1, z - 0.3); if (n === 1) setPan({ x: 0, y: 0 }); return n; }),
    reset,
    focus: (slot) => { setOrigin(ORIGIN[slot] ?? ORIGIN.full); setPan({ x: 0, y: 0 }); setZoom(slot === "full" ? 1 : slot === "head" || slot === "feet" ? 2.2 : 1.7); },
    rotate: () => setView((v) => (v === "front" ? "back" : "front")),
  }));

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    gesture.current = { dist: ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0, zoom, pan, start: ps[0] };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...pointers.current.values()];
    const g = gesture.current;
    if (ps.length > 1 && g.dist > 0) {
      setZoom(Math.min(2.5, Math.max(1, (g.zoom * Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)) / g.dist)));
    } else if (zoom > 1) {
      setPan({ x: g.pan.x + (ps[0].x - g.start.x) / zoom, y: g.pan.y + (ps[0].y - g.start.y) / zoom });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const ps = [...pointers.current.values()];
    gesture.current = ps.length ? { dist: 0, zoom, pan, start: ps[0] } : null;
  };

  const hidden = NOT_ON_PHOTO.filter((s) => look.slots[s]);
  const male = look.gender === "m";

  return (
    <div className="relative h-full w-full touch-none select-none overflow-hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={reset}>
      <div
        role="img"
        aria-label={`${label}. ${view === "front" ? "Вид спереди" : "Вид сзади"}`}
        className="absolute inset-x-0 -bottom-1 top-0 flex justify-center transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: origin }}
      >
        <PhotoFigure look={look} view={view} />
      </div>
      {(hidden.length > 0 || male) && (
        <p className="pointer-events-none absolute inset-x-3 top-2 mx-auto max-w-xs rounded-[var(--radius-md)] bg-surface/90 px-3 py-2 text-center text-xs text-muted lg:top-4">
          {male ? t("catalog.photo.maleSoon") : t("catalog.photo.notShown")}
        </p>
      )}
    </div>
  );
});

export default PhotoRenderer;

/** Фото-фигура со слоями перекраски. Высота задаётся родителем, ширина по пропорции листа. */
export function PhotoFigure({ look, view, only, className = "h-full" }: { look: Look; view: View; only?: Part; className?: string }) {
  return (
    <div className={`relative isolate ${className}`} style={{ aspectRatio: "448 / 1200" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE}/${view}.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
      {PARTS.map((part) => {
        const color = (only && part !== only ? null : partColor(look, part)) ?? NEUTRAL;
        const mask = `url(${BASE}/${view}-${part}-mask.png)`;
        return (
          <div key={`${view}-${part}`} className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/${view}-${part}-shade.webp`} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
            <div
              className="absolute inset-0 transition-[background-color] duration-200 motion-reduce:transition-none"
              style={{ backgroundColor: color, mixBlendMode: "multiply", WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Какой фрагмент фото показывать в миниатюре вещи (в долях высоты листа). */
const CROP: Record<Part, { y0: number; y1: number }> = { top: { y0: 0.19, y1: 0.5 }, bottom: { y0: 0.47, y1: 0.93 }, feet: { y0: 0.89, y1: 0.99 } };
export const PHOTO_PART: Partial<Record<Slot, Part>> = { top: "top", bottom: "bottom", feet: "feet" };

/** Миниатюра вещи из фото-модели в выбранном цвете. */
export function PhotoThumb({ part, color, size = 64 }: { part: Part; color: string; size?: number }) {
  const c = CROP[part];
  const H = size / (c.y1 - c.y0);
  const look: Look = { gender: "f", slots: { [part === "top" ? "top" : part === "bottom" ? "bottom" : "feet"]: { slug: "x", color, size: null } } };
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[10px] bg-bg" style={{ width: size, height: size }} aria-hidden>
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -c.y0 * H, height: H }}>
        <PhotoFigure look={look} view="front" only={part} />
      </div>
    </div>
  );
}

