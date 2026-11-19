import { sql } from "drizzle-orm";
import { COLORS, PRODUCTS } from "@/catalog/data";
import { db, schema } from "./index";

/** Идемпотентные сиды: временный каталог из src/catalog/data.ts (см. docs/blockers.md). */
export async function seed() {
  await db.insert(schema.color).values(Object.entries(COLORS).map(([slug, c]) => ({ slug, name: c.name, hex: c.hex }))).onConflictDoNothing();
  const [chart] = await db.select().from(schema.sizeChart).limit(1);
  const chartId = chart?.id ?? (await db.insert(schema.sizeChart).values({
    title: "Одежда унисекс",
    table: [["Размер", "Грудь, см", "Бёдра, см"], ["XS", "84-88", "88-92"], ["S", "88-92", "92-96"], ["M", "92-100", "96-104"], ["L", "100-108", "104-112"], ["XL", "108-116", "112-120"]],
    hint: "Значения предварительные, уточняются у фабрики.",
  }).returning())[0].id;

  for (const [i, p] of PRODUCTS.entries()) {
    const [row] = await db.insert(schema.product).values({
      slug: p.slug, type: p.category, slot: p.slot, model: p.model, title: p.title, short: p.short,
      sort: i, pricePending: p.priceRub === null, sizeChartId: p.sizes.length && p.slot !== "feet" ? chartId : null,
    }).onConflictDoNothing().returning();
    const productId = row?.id ?? (await db.select({ id: schema.product.id }).from(schema.product).where(sql`${schema.product.slug} = ${p.slug}`))[0].id;
    const sizes = p.sizes.length ? p.sizes : [""];
    const variants = p.colors.flatMap((c) => sizes.map((s) => ({
      productId, colorSlug: c, size: s, sku: `MF-${p.slug}-${c}${s ? `-${s}` : ""}`.toUpperCase(),
      priceKop: p.priceRub === null ? null : p.priceRub * 100,
    })));
    await db.insert(schema.variant).values(variants).onConflictDoNothing();
  }

  const defaults: Record<string, unknown> = {
    "offer.version": "2026-11-19-draft",
    "telegram.chatId": "",
    "telegram.sendContacts": false,
    "payments.enabled": false,
    "delivery.cdekEnabled": false,
    "seller.requisites": { pending: true },
  };
  await db.insert(schema.setting).values(Object.entries(defaults).map(([key, value]) => ({ key, value }))).onConflictDoNothing();
}
