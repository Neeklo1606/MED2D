import { sql } from "drizzle-orm";
import { db, hasDb } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "down" | "not-configured" = "not-configured";
  if (hasDb()) {
    try { await db.execute(sql`select 1`); database = "ok"; } catch { database = "down"; }
  }
  const status = database === "down" ? 503 : 200;
  return Response.json({ status: status === 200 ? "ok" : "degraded", database, version: process.env.APP_VERSION ?? "dev", time: new Date().toISOString() }, { status });
}
