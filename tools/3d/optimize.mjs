#!/usr/bin/env node
// Сжатие GLB для сайта: meshopt (геометрия) + WebP (текстуры). Запускается после сборки моделей.
//   node tools/3d/optimize.mjs <папка_glb> [--force] [--jobs 4]
// Инструмент сборки: @gltf-transform/cli вызывается через npx и в зависимости сайта не попадает.
//
// Что делает с каждым *.glb в папке:
//   1. текстуры кожи (материал `skin`/`body`) ≤ 1024 px, остальные ≤ 512 px;
//   2. цветовые текстуры → WebP (с потерями, качество 88; альфа для MASK сохраняется),
//      карта нормалей → WebP без потерь;
//   3. геометрия → EXT_meshopt_compression (квантование: позиции 14 бит, нормали 10, UV 12, цвет вершин 8).
// Имена материалов, режимы прозрачности, COLOR_0 (запечённый AO), UV и нормали остаются.
//
// Повторный запуск безопасен: уже сжатые файлы (EXT_meshopt_compression) пропускаются, если нет --force.
// Файл перезаписывается только если результат прошёл проверку (те же материалы, атрибуты, треугольники,
// файл стал меньше); иначе исходник остаётся нетронутым и скрипт завершается с кодом 1.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);
const CLI = ["-y", "@gltf-transform/cli@4.5.1"];

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const force = args.includes("--force");
const jobsArg = args.indexOf("--jobs");
const jobs = jobsArg >= 0 ? Math.max(1, Number(args[jobsArg + 1]) || 1) : 4;
if (!dir) {
  console.error("Использование: node tools/3d/optimize.mjs <папка_glb> [--force] [--jobs N]");
  process.exit(2);
}

/** JSON-часть GLB (бинарный контейнер glTF 2.0). */
function glbJson(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("не GLB");
  const len = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error("нет JSON-чанка");
  return JSON.parse(buf.subarray(20, 20 + len).toString("utf8"));
}

const isCompressed = (j) => (j.extensionsUsed ?? []).includes("EXT_meshopt_compression");

/** Отпечаток того, что не должно меняться при сжатии. */
function signature(j) {
  const mats = (j.materials ?? []).map((m) => {
    const pbr = m.pbrMetallicRoughness ?? {};
    return JSON.stringify({
      name: m.name ?? "",
      alpha: m.alphaMode ?? "OPAQUE",
      cutoff: (m.alphaMode === "MASK" ? m.alphaCutoff ?? 0.5 : null),
      double: !!m.doubleSided,
      base: !!pbr.baseColorTexture,
      normal: !!m.normalTexture,
    });
  }).sort();
  const matName = (i) => (i === undefined ? "-" : j.materials?.[i]?.name ?? String(i));
  let tris = 0;
  const prims = [];
  for (const mesh of j.meshes ?? []) {
    for (const p of mesh.primitives) {
      const idx = p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count;
      if ((p.mode ?? 4) === 4) tris += idx / 3;
      prims.push(`${mesh.name ?? ""}|${matName(p.material)}|${Object.keys(p.attributes).sort().join(",")}`);
    }
  }
  // квантование может вынести сетку узла с детьми в безымянный дочерний узел — его не считаем
  const nodes = (j.nodes ?? []).filter((n) => n.name).map((n) => n.name).sort();
  nodes.push(`сеток в сцене: ${(j.nodes ?? []).filter((n) => n.mesh !== undefined).length}`);
  return { mats, prims: prims.sort(), nodes, tris };
}

function diff(a, b) {
  const out = [];
  for (const k of ["mats", "prims", "nodes"]) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(`${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
  }
  if (a.tris !== b.tris) out.push(`треугольники ${a.tris} → ${b.tris}`);
  return out;
}

/** Glob-шаблон {a,b,c} по именам изображений (gltf-transform сравнивает с именем текстуры или URI). */
function namesPattern(names) {
  const esc = names.map((n) => n.replace(/[*?{}[\]()!+@,\\]/g, "\\$&"));
  return esc.length === 1 ? esc[0] : `{${esc.join(",")}}`;
}

/** Имена изображений: крупные (кожа тела) и остальные. */
function textureGroups(j) {
  const big = new Set();
  const all = new Set();
  const imgName = (texIdx) => {
    const t = j.textures?.[texIdx];
    const src = t?.source ?? t?.extensions?.EXT_texture_webp?.source;
    return src === undefined ? null : j.images?.[src]?.name ?? null;
  };
  for (const m of j.materials ?? []) {
    const refs = [m.pbrMetallicRoughness?.baseColorTexture, m.pbrMetallicRoughness?.metallicRoughnessTexture,
      m.normalTexture, m.occlusionTexture, m.emissiveTexture].filter(Boolean);
    for (const r of refs) {
      const n = imgName(r.index);
      if (!n) continue;
      all.add(n);
      if (/^(skin|body)(\.\d+)?$/i.test(m.name ?? "")) big.add(n);
    }
  }
  return { big: [...big], small: [...all].filter((n) => !big.has(n)), unnamed: (j.images ?? []).some((i) => !i.name) };
}

async function cli(...a) {
  await run("npx", [...CLI, ...a], { maxBuffer: 64 << 20 });
}

async function optimize(file) {
  const name = path.basename(file);
  const src = await readFile(file);
  const j0 = glbJson(src);
  if (isCompressed(j0) && !force) return { name, skipped: true, before: src.length, after: src.length };

  const tmp = await mkdtemp(path.join(tmpdir(), "medform-opt-"));
  try {
    let cur = path.join(tmp, "0.glb");
    await writeFile(cur, src);
    let step = 0;
    const next = async (...a) => {
      const out = path.join(tmp, `${++step}.glb`);
      await cli(a[0], cur, out, ...a.slice(1));
      cur = out;
    };
    const { big, small, unnamed } = textureGroups(j0);
    if ((j0.images ?? []).length) {
      // всё ≤ 1024, затем всё, кроме кожи, ≤ 512 (безымянные изображения тоже ≤ 512 — шаблоном их не выбрать)
      await next("resize", "--width", "1024", "--height", "1024");
      if (small.length) await next("resize", "--width", "512", "--height", "512", "--pattern", namesPattern(small));
      if (unnamed) console.warn(`  ${name}: есть текстуры без имени, оставлены ≤ 1024 px`);
      await next("webp", "--slots", "{baseColorTexture,emissiveTexture,occlusionTexture,metallicRoughnessTexture}",
        "--quality", "88", "--effort", "90");
      await next("webp", "--slots", "normalTexture", "--lossless", "true");
    }
    await next("meshopt", "--level", "high", "--quantize-position", "14", "--quantize-normal", "10",
      "--quantize-texcoord", "12", "--quantize-color", "8");

    const out = await readFile(cur);
    const j1 = glbJson(out);
    const problems = diff(signature(j0), signature(j1));
    if (!isCompressed(j1)) problems.push("нет EXT_meshopt_compression");
    if (out.length >= src.length && !isCompressed(j0)) problems.push(`файл не уменьшился (${src.length} → ${out.length})`);
    if (problems.length) return { name, error: problems.join("; "), before: src.length, after: src.length };

    // запись на месте атомарно: временный файл в той же папке + rename
    const tmpOut = `${file}.opt-tmp`;
    await writeFile(tmpOut, out);
    await rename(tmpOut, file);
    return { name, before: src.length, after: out.length };
  } catch (e) {
    return { name, error: String(e.stderr || e.message || e).trim().split("\n").slice(-3).join(" "), before: src.length, after: src.length };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

const files = (await readdir(dir)).filter((f) => f.endsWith(".glb")).sort().map((f) => path.join(dir, f));
const results = [];
let i = 0;
await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, async () => {
  while (i < files.length) {
    const r = await optimize(files[i++]);
    results.push(r);
    const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
    if (r.error) console.error(`✗ ${r.name}: ${r.error} (исходник не тронут)`);
    else if (r.skipped) console.log(`· ${r.name}: уже сжат, пропуск (${kb(r.before)})`);
    else console.log(`✓ ${r.name}: ${kb(r.before)} → ${kb(r.after)} (−${Math.round((1 - r.after / r.before) * 100)} %)`);
  }
}));
const sum = (k) => results.reduce((s, r) => s + r[k], 0);
console.log(`Итого: ${(sum("before") / 1048576).toFixed(2)} MB → ${(sum("after") / 1048576).toFixed(2)} MB`);
if (results.some((r) => r.error)) process.exit(1);
