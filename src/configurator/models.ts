import type { Gender } from "@/catalog/data";
import { DEFAULT_LOOK } from "./store";
import { fromQuery, wornList, type Look } from "./look";
import versions from "./model-versions.json";

/**
 * Адреса GLB с версией: /3d/models/<model>_<g>.glb?v=<хэш>. Хэши пишет tools/3d/manifest.py
 * в model-versions.json; файлы с ?v= отдаются с Cache-Control immutable (next.config.ts),
 * поэтому при повторном заходе модели берутся из кеша браузера без запросов.
 */
const V: Record<string, string | undefined> = versions;

export const modelFile = (model: string, g: Gender) => {
  const v = V[`${model}_${g}`];
  return `/3d/models/${model}_${g}.glb${v ? `?v=${v}` : ""}`;
};

/** Что нужно для первого кадра: манекен и надетые вещи (по одному GLB на вещь, цвет задаётся материалом). */
export const lookFiles = (look: Look) => [
  modelFile("mannequin", look.gender),
  ...wornList(look).flatMap((x) => (x.product.model ? [modelFile(x.product.model, look.gender)] : [])),
];

/** Образ, который покажет конфигуратор при входе (как useUrlSync в Configurator). */
export function initialLook(search: string): Look {
  const parsed = fromQuery(search);
  return Object.keys(parsed.slots).length ? parsed : { ...DEFAULT_LOOK, gender: parsed.gender };
}

const warmed = new Set<string>();

/**
 * Скачать файл в HTTP-кеш (и кеш service worker) без разбора: загрузчик three потом возьмёт его из кеша.
 * Тело читается полностью, иначе запись в кеше не завершится.
 */
export async function warm(url: string, priority: "high" | "low" = "low") {
  if (warmed.has(url)) return;
  warmed.add(url);
  try {
    const res = await fetch(url, { priority } as RequestInit);
    await res.arrayBuffer();
  } catch {
    warmed.delete(url);
  }
}
