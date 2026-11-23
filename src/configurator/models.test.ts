import { describe, expect, it } from "vitest";
import versions from "./model-versions.json";
import { initialLook, lookFiles, modelFile } from "./models";

const V: Record<string, string> = versions;

describe("адреса 3D-моделей", () => {
  it("версия из model-versions.json в ?v=, без версии — чистый адрес", () => {
    for (const name of ["mannequin_f", "top_anorak_m"]) {
      const [model, g] = [name.slice(0, -2), name.slice(-1) as "f" | "m"];
      const v = V[name];
      expect(modelFile(model, g)).toBe(`/3d/models/${name}.glb${v ? `?v=${v}` : ""}`);
    }
    expect(modelFile("нет_такой", "f")).toBe("/3d/models/нет_такой_f.glb");
  });

  it("первый кадр: манекен и надетые вещи образа из адреса", () => {
    const files = lookFiles(initialLook("?g=m&top=anorak.pink.M&feet=sabo.white.42"));
    expect(files.map((f) => f.split("?")[0])).toEqual([
      "/3d/models/mannequin_m.glb",
      "/3d/models/feet_sabo_m.glb",
      "/3d/models/top_anorak_m.glb",
    ]);
  });

  it("без вещей в адресе — образ по умолчанию нужного пола", () => {
    const files = lookFiles(initialLook("?g=m"));
    expect(files[0].split("?")[0]).toBe("/3d/models/mannequin_m.glb");
    expect(files.length).toBeGreaterThan(1);
  });
});
