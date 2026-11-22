import type { Slot } from "@/catalog/data";
import type { Look } from "../look";

/** Общий интерфейс отрисовки образа: 3D (three) или 2D (photo). Логика образа от него не зависит. */
export interface LookRendererHandle {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  /** Навести камеру на часть тела (в 2D-режиме приближение к зоне). */
  focus(slot: Slot | "full"): void;
  /** Повернуть модель на угол в градусах. */
  rotate(deg: number): void;
}

export interface LookRendererProps {
  look: Look;
  label: string;
  /** 3D: показать один оборот модели при первой загрузке. */
  intro?: boolean;
}

export type RendererKind = "three" | "photo";

/** 3D только при WebGL и не на самых слабых устройствах. */
let cached: RendererKind | null = null;

export function detectRenderer(): RendererKind {
  if (typeof window === "undefined") return "photo";
  if (!cached) cached = probe();
  return cached;
}

function probe(): RendererKind {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return "photo";
  } catch {
    return "photo";
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.deviceMemory ?? 4) < 2 || (navigator.hardwareConcurrency ?? 4) < 2) return "photo";
  return "three";
}
