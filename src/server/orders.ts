import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { CartLine, CheckoutInput } from "@/lib/checkout";
import { checkoutSchema, fieldErrors } from "@/lib/checkout";
import { db, schema } from "./db";
import { deliveryProvider } from "./providers/delivery";
import { paymentProvider } from "./providers/payment";

export interface QuotedLine extends CartLine {
  title: string;
  colorName: string;
  hex: string;
  priceKop: number | null;
  variantId: number | null;
  sizes: string[];
  error: string | null;
}

/** Цены и наличие считаем только по БД; клиенту не доверяем. */
export async function quoteLines(lines: CartLine[]): Promise<QuotedLine[]> {
  if (!lines.length) return [];
  const slugs = [...new Set(lines.map((l) => l.slug))];
  const rows = await db
    .select({ p: schema.product, v: schema.variant, c: schema.color })
    .from(schema.variant)
    .innerJoin(schema.product, eq(schema.product.id, schema.variant.productId))
    .innerJoin(schema.color, eq(schema.color.slug, schema.variant.colorSlug))
    .where(and(inArray(schema.product.slug, slugs), eq(schema.product.published, true)));
  return lines.map((l) => {
    const forProduct = rows.filter((r) => r.p.slug === l.slug);
    const sizes = [...new Set(forProduct.filter((r) => r.v.colorSlug === l.color).map((r) => r.v.size).filter(Boolean))];
    const hit = forProduct.find((r) => r.v.colorSlug === l.color && r.v.size === (l.size ?? ""));
    const base = { ...l, sizes, title: forProduct[0]?.p.title ?? l.slug, colorName: hit?.c.name ?? l.color, hex: hit?.c.hex ?? "#ccc" };
    if (!forProduct.length) return { ...base, priceKop: null, variantId: null, error: "Товар больше не продаётся" };
    if (!hit) return { ...base, priceKop: null, variantId: null, error: sizes.length && !l.size ? "Выберите размер" : "Нет такого варианта" };
    if (hit.v.priceKop === null || hit.p.pricePending) return { ...base, priceKop: null, variantId: hit.v.id, error: "Цена уточняется" };
    if (hit.v.trackStock && hit.v.stock < l.qty) return { ...base, priceKop: hit.v.priceKop, variantId: hit.v.id, error: `В наличии ${hit.v.stock} шт.` };
    return { ...base, priceKop: hit.v.priceKop, variantId: hit.v.id, error: null };
  });
}

export async function quoteCart(lines: CartLine[], city = "") {
  const quoted = await quoteLines(lines);
  const itemsTotalKop = quoted.reduce((s, l) => s + (l.error ? 0 : (l.priceKop ?? 0) * l.qty), 0);
  const delivery = await deliveryProvider().quote({ city, itemsTotalKop });
  return { lines: quoted, itemsTotalKop, delivery };
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(schema.setting).where(eq(schema.setting.key, key));
  return (row?.value as T) ?? fallback;
}

export type CreateResult =
  | { ok: true; number: string; token: string; redirectUrl: string }
  | { ok: false; status: 422; errors: Record<string, string> };

export async function createOrder(raw: unknown): Promise<CreateResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 422, errors: fieldErrors(parsed.error) };
  const input = parsed.data;
  if (input.website) return { ok: false, status: 422, errors: { form: "Не удалось отправить заявку" } };

  const { lines, itemsTotalKop, delivery } = await quoteCart(input.items, input.city);
  const bad = lines.find((l) => l.error);
  if (bad) return { ok: false, status: 422, errors: { items: `${bad.title}: ${bad.error}` } };
  const method = delivery.find((d) => d.id === input.deliveryMethod);
  if (!method) return { ok: false, status: 422, errors: { deliveryMethod: "Выберите способ получения" } };

  const offerVersion = await getSetting("offer.version", "draft");
  const sendContacts = await getSetting("telegram.sendContacts", false);
  const token = randomBytes(24).toString("base64url");
  const now = new Date();
  const deliveryKop = method.priceKop;
  const totalKop = itemsTotalKop + (deliveryKop ?? 0);

  const created = await db.transaction(async (tx) => {
    const [o] = await tx.insert(schema.order).values({
      number: `tmp-${token}`, token, customer: { name: input.name, phone: input.phone, email: input.email },
      city: input.city, address: input.address, deliveryMethod: input.deliveryMethod, comment: input.comment || null,
      itemsTotalKop, deliveryKop, totalKop, consentPdAt: now, consentMarketingAt: input.consentMarketing ? now : null,
      offerVersion, utm: input.utm ?? {}, look: input.look ?? null,
    }).returning({ id: schema.order.id });
    const number = `MF-${String(o.id).padStart(5, "0")}`;
    await tx.update(schema.order).set({ number }).where(eq(schema.order.id, o.id));
    await tx.insert(schema.orderItem).values(lines.map((l) => ({
      orderId: o.id, variantId: l.variantId, qty: l.qty, priceSnapshotKop: l.priceKop!, titleSnapshot: l.title,
      colorSnapshot: l.colorName, sizeSnapshot: l.size ?? "",
    })));
    await tx.insert(schema.orderEvent).values({ orderId: o.id, status: "new", actor: "customer" });
    const summary = {
      number, totalKop, itemsTotalKop, deliveryKop, delivery: method.label, name: input.name, city: input.city,
      comment: input.comment, items: lines.map((l) => ({ title: l.title, color: l.colorName, size: l.size, qty: l.qty, priceKop: l.priceKop })),
      ...(sendContacts ? { phone: input.phone, email: input.email } : {}),
    };
    // Заявка уже в БД; уведомления уходят из очереди с повторами (шаг 8).
    await tx.insert(schema.notificationOutbox).values([
      { channel: "telegram", payload: summary },
      { channel: "email", payload: { ...summary, to: "manager" } },
      { channel: "email", payload: { number, to: input.email, template: "order-received" } },
    ]);
    return { id: o.id, number };
  });

  const pay = await paymentProvider().createPayment({ number: created.number, token, totalKop });
  if (pay) await db.update(schema.order).set({ paymentId: pay.paymentId, status: "awaiting_payment", channel: "paid" }).where(eq(schema.order.id, created.id));
  return { ok: true, number: created.number, token, redirectUrl: pay?.redirectUrl ?? `/order/${token}` };
}

export async function getOrderByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [o] = await db.select().from(schema.order).where(eq(schema.order.token, token));
  if (!o) return null;
  const items = await db.select().from(schema.orderItem).where(eq(schema.orderItem.orderId, o.id));
  return { ...o, items };
}

export type { CheckoutInput };
