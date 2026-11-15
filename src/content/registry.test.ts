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
