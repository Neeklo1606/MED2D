import { describe, expect, it } from "vitest";
import { getField, registry } from "./registry";

describe("content registry", () => {
  it("returns default value", () => {
    expect(getField("global.header.cart")).toBe("Корзина");
  });
  it("throws on unknown field", () => {
    expect(() => getField("nope.nope.nope")).toThrow();
  });
  it("defaults respect maxLength and contain no em dash", () => {
    for (const d of registry) {
      if (d.maxLength) expect(d.default.length).toBeLessThanOrEqual(d.maxLength);
      expect(d.default).not.toContain("—");
    }
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !n.includes(".test.") ? [p] : [];
  });
}

describe("registry coverage", () => {
  it("every field id has page.section.key", () => {
    for (const d of registry) expect(d.key, `${d.page}.${d.section}`).toBeTruthy();
  });
  it("every getField/t(...) key used in code exists", () => {
    const ids = new Set(registry.map((d) => `${d.page}.${d.section}.${d.key}`));
    const missing: string[] = [];
    for (const f of walk("src")) {
      for (const m of readFileSync(f, "utf8").matchAll(/\b(?:getField|t)\("([a-z]+\.[A-Za-z.]+)"\)/g)) if (!ids.has(m[1])) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
});
