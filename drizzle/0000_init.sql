CREATE TYPE "public"."admin_role" AS ENUM('owner', 'manager');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'layer', 'thumb', 'model');--> statement-breakpoint
CREATE TYPE "public"."order_channel" AS ENUM('request', 'paid');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'in_progress', 'contacted', 'confirmed', 'shipped', 'completed', 'cancelled', 'awaiting_payment', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."slot" AS ENUM('top', 'bottom', 'coat', 'head', 'feet', 'accessory');--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "admin_role" DEFAULT 'manager' NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "color" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hex" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_field" (
	"id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" text NOT NULL,
	"before" text,
	"after" text NOT NULL,
	"by" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"consent_pd_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"kind" "media_kind" NOT NULL,
	"gender" text,
	"color_slug" text,
	"url" text NOT NULL,
	"w" integer,
	"h" integer,
	"alt" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"token" text NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"channel" "order_channel" DEFAULT 'request' NOT NULL,
	"customer" jsonb NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"delivery_method" text NOT NULL,
	"comment" text,
	"items_total_kop" integer NOT NULL,
	"delivery_kop" integer,
	"total_kop" integer NOT NULL,
	"consent_pd_at" timestamp with time zone NOT NULL,
	"consent_marketing_at" timestamp with time zone,
	"offer_version" text NOT NULL,
	"utm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"look" text,
	"manager_note" text,
	"payment_id" text,
	"payment_status" text,
	"receipt_id" text,
	"shipment_id" text,
	"tracking_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_number_unique" UNIQUE("number"),
	CONSTRAINT "order_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "order_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" "order_status" NOT NULL,
	"actor" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"variant_id" integer,
	"qty" integer NOT NULL,
	"price_snapshot_kop" integer NOT NULL,
	"title_snapshot" text NOT NULL,
	"color_snapshot" text NOT NULL,
	"size_snapshot" text NOT NULL,
	"marking_codes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"slot" "slot" NOT NULL,
	"model" text,
	"title" text NOT NULL,
	"short" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"care" text DEFAULT '' NOT NULL,
	"composition" text DEFAULT '' NOT NULL,
	"manufacturer_name" text,
	"manufacturer_address" text,
	"country" text,
	"certificate" jsonb,
	"size_chart_id" integer,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"price_pending" boolean DEFAULT false NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "size_chart" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"table" jsonb NOT NULL,
	"hint" text
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"color_slug" text NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"sku" text NOT NULL,
	"price_kop" integer,
	"old_price_kop" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"track_stock" boolean DEFAULT false NOT NULL,
	"weight_g" integer,
	"dims_mm" jsonb,
	"barcode" text,
	"requires_marking" boolean DEFAULT false NOT NULL,
	CONSTRAINT "variant_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_size_chart_id_size_chart_id_fk" FOREIGN KEY ("size_chart_id") REFERENCES "public"."size_chart"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_color_slug_color_slug_fk" FOREIGN KEY ("color_slug") REFERENCES "public"."color"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_due_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_created_idx" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_pcs" ON "variant" USING btree ("product_id","color_slug","size");