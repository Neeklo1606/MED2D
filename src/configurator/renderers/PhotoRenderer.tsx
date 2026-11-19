"use client";
import { forwardRef, useImperativeHandle, useState } from "react";
import { COLORS } from "@/catalog/data";
import type { LookRendererHandle, LookRendererProps } from "./types";

/**
 * 2D-режим (нет WebGL или слабое устройство). Пока фото-слоёв нет, рисуем силуэт
 * с цветными слоями вещей. Позже здесь будут слои media/layers/{g}/{slug}/{color}.webp.
 */
const PhotoRenderer = forwardRef<LookRendererHandle, LookRendererProps>(function PhotoRenderer({ look, label }, ref) {
  const [zoom, setZoom] = useState(1);
  useImperativeHandle(ref, () => ({
    zoomIn: () => setZoom((z) => Math.min(2.5, z + 0.25)),
    zoomOut: () => setZoom((z) => Math.max(1, z - 0.25)),
    reset: () => setZoom(1),
  }));
  const c = (slot: keyof typeof look.slots) => {
    const w = look.slots[slot];
    return w ? COLORS[w.color]?.hex : undefined;
  };
  const m = look.gender === "m";
  const sw = m ? 1.1 : 1;
  return (
    <svg role="img" aria-label={label} viewBox="0 0 200 520" className="h-full w-full transition-transform duration-200 motion-reduce:transition-none" style={{ transform: `scale(${zoom})`, transformOrigin: "50% 40%" }}>
      <g transform={`translate(${100 - 100 * sw} 0) scale(${sw} 1)`}>
        <circle cx="100" cy="46" r="26" fill="#d6d7db" />
        <rect x="88" y="68" width="24" height="18" fill="#d6d7db" />
        <rect x="56" y="84" width="88" height="160" rx="26" fill="#d6d7db" />
        <rect x="62" y="236" width="36" height="220" rx="16" fill="#d6d7db" />
        <rect x="102" y="236" width="36" height="220" rx="16" fill="#d6d7db" />
        {c("bottom") && (<g fill={c("bottom")}><rect x="60" y="226" width="40" height="214" rx="16" /><rect x="100" y="226" width="40" height="214" rx="16" /></g>)}
        {c("top") && <rect x="50" y="82" width="100" height="160" rx="28" fill={c("top")} />}
        {c("coat") && <path d="M44 84h112l8 250H36z" fill={c("coat")} opacity="0.96" stroke="#c9ccd1" />}
        {c("head") && <path d="M72 40a28 24 0 0 1 56 0z" fill={c("head")} />}
        {c("feet") && (<g fill={c("feet")}><rect x="54" y="440" width="46" height="24" rx="10" /><rect x="100" y="440" width="46" height="24" rx="10" /></g>)}
      </g>
    </svg>
  );
});

export default PhotoRenderer;
