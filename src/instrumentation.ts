export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { bootstrap } = await import("./server/db/bootstrap");
  try {
    await bootstrap();
  } catch (e) {
    console.error("[db] bootstrap failed", e);
  }
}
