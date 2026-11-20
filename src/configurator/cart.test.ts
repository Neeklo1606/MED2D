import { describe, expect, it } from "vitest";
import { patchLine, type CartItem } from "./store";

describe("cart patchLine", () => {
  const base: CartItem[] = [
    { slug: "anorak", color: "pink", size: "M", qty: 1 },
    { slug: "anorak", color: "navy", size: "M", qty: 2 },
  ];
  it("changes color in place", () => {
    expect(patchLine(base, 0, { color: "white" })[0]).toEqual({ slug: "anorak", color: "white", size: "M", qty: 1 });
  });
  it("merges into an existing identical line", () => {
    const r = patchLine(base, 0, { color: "navy" });
    expect(r).toEqual([{ slug: "anorak", color: "navy", size: "M", qty: 3 }]);
  });
});
