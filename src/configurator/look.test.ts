import { describe, expect, it } from "vitest";
import { clearLook, emptyLook, fromQuery, missingSizes, toQuery, total, wear } from "./look";

describe("look", () => {
  it("replaces the item in an occupied slot", () => {
    let l = wear(emptyLook(), { slug: "anorak", color: "pink", size: "M" });
    l = wear(l, { slug: "tshirt", color: "white", size: null });
    expect(l.slots.top?.slug).toBe("tshirt");
  });
  it("coat does not replace top", () => {
    let l = wear(emptyLook(), { slug: "anorak", color: "pink", size: "M" });
    l = wear(l, { slug: "halat", color: "white", size: "L" });
    expect(Object.keys(l.slots).sort()).toEqual(["coat", "top"]);
  });
  it("clear keeps gender", () => {
    const l = clearLook(wear(emptyLook("m"), { slug: "sabo", color: "black", size: "42" }));
    expect(l).toEqual({ gender: "m", slots: {} });
  });
  it("totals known prices and finds missing sizes", () => {
    let l = wear(emptyLook(), { slug: "anorak", color: "pink", size: "M" });
    l = wear(l, { slug: "joggers", color: "pink", size: null });
    l = wear(l, { slug: "cap", color: "pink", size: null });
    expect(total(l)).toBe(6200);
    expect(missingSizes(l)).toEqual(["bottom"]);
  });
  it("round-trips through the URL and drops invalid parts", () => {
    let l = wear(emptyLook("m"), { slug: "anorak", color: "navy", size: "L" });
    l = wear(l, { slug: "joggers", color: "navy", size: null });
    expect(fromQuery(toQuery(l))).toEqual(l);
    const bad = fromQuery("g=f&top=anorak.purple.M&feet=anorak.pink&bottom=joggers.pink.XXXL");
    expect(bad.slots).toEqual({ bottom: { slug: "joggers", color: "pink", size: null } });
  });
});
