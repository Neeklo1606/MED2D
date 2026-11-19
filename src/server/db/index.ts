import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;
const g = globalThis as unknown as { __sql?: postgres.Sql; __db?: Db };

export function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

function client() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  g.__sql ??= postgres(process.env.DATABASE_URL, { max: 10, idle_timeout: 30 });
  return g.__sql;
}

/** Ленивое подключение: сборка проходит без DATABASE_URL. */
export const db = new Proxy({} as Db, {
  get(_, prop) {
    g.__db ??= drizzle(client(), { schema });
    return Reflect.get(g.__db, prop, g.__db);
  },
});

export { schema };
