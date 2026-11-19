import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/** Деньги везде в копейках (integer). */

export const slotEnum = pgEnum("slot", ["top", "bottom", "coat", "head", "feet", "accessory"]);
export const orderStatus = pgEnum("order_status", [
  "new", "in_progress", "contacted", "confirmed", "shipped", "completed", "cancelled",
  // для онлайн-оплаты (этап ЮKassa)
  "awaiting_payment", "paid", "refunded",
]);
export const orderChannel = pgEnum("order_channel", ["request", "paid"]);
export const mediaKind = pgEnum("media_kind", ["photo", "layer", "thumb", "model"]);
export const outboxStatus = pgEnum("outbox_status", ["pending", "sent", "failed"]);
export const adminRole = pgEnum("admin_role", ["owner", "manager"]);

const ts = (n: string) => timestamp(n, { withTimezone: true });

export const color = pgTable("color", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  hex: text("hex").notNull(),
});

export const sizeChart = pgTable("size_chart", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  table: jsonb("table").$type<string[][]>().notNull(),
  hint: text("hint"),
});

export const product = pgTable("product", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(),
  slot: slotEnum("slot").notNull(),
  model: text("model"),
  title: text("title").notNull(),
  short: text("short").notNull().default(""),
  description: text("description").notNull().default(""),
  specs: jsonb("specs").$type<Record<string, string>>().notNull().default({}),
  care: text("care").notNull().default(""),
  composition: text("composition").notNull().default(""),
  manufacturerName: text("manufacturer_name"),
  manufacturerAddress: text("manufacturer_address"),
  country: text("country"),
  certificate: jsonb("certificate").$type<{ kind: string; number: string; date: string; body: string; validTo: string } | null>(),
  sizeChartId: integer("size_chart_id").references(() => sizeChart.id),
  seo: jsonb("seo").$type<{ title?: string; description?: string }>().notNull().default({}),
  sort: integer("sort").notNull().default(0),
  published: boolean("published").notNull().default(true),
  pricePending: boolean("price_pending").notNull().default(false),
});

export const variant = pgTable("variant", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  colorSlug: text("color_slug").notNull().references(() => color.slug),
  size: text("size").notNull().default(""),
  sku: text("sku").notNull().unique(),
  priceKop: integer("price_kop"),
  oldPriceKop: integer("old_price_kop"),
  stock: integer("stock").notNull().default(0),
  trackStock: boolean("track_stock").notNull().default(false),
  weightG: integer("weight_g"),
  dimsMm: jsonb("dims_mm").$type<{ l: number; w: number; h: number } | null>(),
  barcode: text("barcode"),
  requiresMarking: boolean("requires_marking").notNull().default(false),
}, (t) => [uniqueIndex("variant_pcs").on(t.productId, t.colorSlug, t.size)]);

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => product.id, { onDelete: "cascade" }),
  kind: mediaKind("kind").notNull(),
  gender: text("gender"),
  colorSlug: text("color_slug"),
  url: text("url").notNull(),
  w: integer("w"),
  h: integer("h"),
  alt: text("alt").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

export const order = pgTable("order", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  token: text("token").notNull().unique(),
  status: orderStatus("status").notNull().default("new"),
  channel: orderChannel("channel").notNull().default("request"),
  customer: jsonb("customer").$type<{ name: string; phone: string; email: string }>().notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  deliveryMethod: text("delivery_method").notNull(),
  comment: text("comment"),
  itemsTotalKop: integer("items_total_kop").notNull(),
  deliveryKop: integer("delivery_kop"),
  totalKop: integer("total_kop").notNull(),
  consentPdAt: ts("consent_pd_at").notNull(),
  consentMarketingAt: ts("consent_marketing_at"),
  offerVersion: text("offer_version").notNull(),
  utm: jsonb("utm").$type<Record<string, string>>().notNull().default({}),
  look: text("look"),
  managerNote: text("manager_note"),
  // готовность к оплате и отправке
  paymentId: text("payment_id"),
  paymentStatus: text("payment_status"),
  receiptId: text("receipt_id"),
  shipmentId: text("shipment_id"),
  trackingNumber: text("tracking_number"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("order_status_idx").on(t.status), index("order_created_idx").on(t.createdAt)]);

export const orderItem = pgTable("order_item", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => order.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => variant.id, { onDelete: "set null" }),
  qty: integer("qty").notNull(),
  priceSnapshotKop: integer("price_snapshot_kop").notNull(),
  titleSnapshot: text("title_snapshot").notNull(),
  colorSnapshot: text("color_snapshot").notNull(),
  sizeSnapshot: text("size_snapshot").notNull(),
  markingCodes: jsonb("marking_codes").$type<string[]>().notNull().default([]),
});

export const orderEvent = pgTable("order_event", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => order.id, { onDelete: "cascade" }),
  status: orderStatus("status").notNull(),
  actor: text("actor").notNull(),
  at: ts("at").notNull().defaultNow(),
});

export const lead = pgTable("lead", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  data: jsonb("data").$type<Record<string, string>>().notNull(),
  status: text("status").notNull().default("new"),
  consentPdAt: ts("consent_pd_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const contentField = pgTable("content_field", {
  id: text("id").primaryKey(), // page.section.key
  value: text("value").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const contentRevision = pgTable("content_revision", {
  id: serial("id").primaryKey(),
  fieldId: text("field_id").notNull(),
  before: text("before"),
  after: text("after").notNull(),
  by: text("by"),
  at: ts("at").notNull().defaultNow(),
});

export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const notificationOutbox = pgTable("notification_outbox", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(), // telegram | email
  payload: jsonb("payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  status: outboxStatus("status").notNull().default("pending"),
  lastError: text("last_error"),
  nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("outbox_due_idx").on(t.status, t.nextAttemptAt)]);

export const adminUser = pgTable("admin_user", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: adminRole("role").notNull().default("manager"),
  name: text("name"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  data: jsonb("data"),
  at: ts("at").notNull().default(sql`now()`),
});
