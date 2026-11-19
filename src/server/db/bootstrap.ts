import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";
import { seed } from "./seed";

let done: Promise<void> | null = null;

/** Миграции + сиды при старте сервера. Повторный вызов безопасен. */
export function bootstrap() {
  done ??= (async () => {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    if (process.env.SEED_CATALOG !== "false") await seed();
    console.log("[db] migrations and seed applied");
  })();
  return done;
}
