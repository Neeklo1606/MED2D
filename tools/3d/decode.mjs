#!/usr/bin/env node
// Распаковка сжатых GLB сайта (meshopt + квантование) в обычный glTF, который открывает Blender 4.2.
//   GT=<папка с node_modules @gltf-transform/{core,extensions} и meshoptimizer> node tools/3d/decode.mjs <in_dir> <out_dir>
// Библиотеки берутся из кеша npx после `npx -y @gltf-transform/cli@4.5.1 --help` (путь ~/.npm/_npx/<hash>).
import { createRequire } from "node:module";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const [src, dst] = process.argv.slice(2);
if (!src || !dst || !process.env.GT) {
  console.error("GT=<node_modules parent> node tools/3d/decode.mjs <in_dir> <out_dir>");
  process.exit(2);
}
const req = createRequire(path.join(process.env.GT, "node_modules", "x.js"));
const { NodeIO } = await import(req.resolve("@gltf-transform/core"));
const { ALL_EXTENSIONS } = await import(req.resolve("@gltf-transform/extensions"));
const { MeshoptDecoder } = await import(req.resolve("meshoptimizer"));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
await mkdir(dst, { recursive: true });
for (const f of (await readdir(src)).filter((n) => n.endsWith(".glb"))) {
  const doc = await io.read(path.join(src, f));
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    // геометрия уже распакована при чтении; квантование Blender понимает, но float надёжнее
    if (ext.extensionName === "EXT_meshopt_compression" || ext.extensionName === "KHR_mesh_quantization") ext.dispose();
  }
  for (const acc of doc.getRoot().listAccessors()) {
    if (acc.getComponentType() !== 5126 && acc.getType() !== "SCALAR" && acc.getNormalized() !== undefined) {
      const arr = acc.getArray();
      const out = new Float32Array(arr.length);
      for (let i = 0; i < arr.length; i++) out[i] = acc.getNormalized() ? normalize(arr[i], arr) : arr[i];
      acc.setArray(out).setNormalized(false);
    }
  }
  await io.write(path.join(dst, f), doc);
  console.log("decoded", f);
}

function normalize(v, arr) {
  if (arr instanceof Int8Array) return Math.max(v / 127, -1);
  if (arr instanceof Uint8Array) return v / 255;
  if (arr instanceof Int16Array) return Math.max(v / 32767, -1);
  if (arr instanceof Uint16Array) return v / 65535;
  return v;
}
