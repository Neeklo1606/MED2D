import { headers } from "next/headers";
import { createOrder } from "@/server/orders";
import { clientIp, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(await headers());
  if (!rateLimit(`order:${ip}`, 5, 10 * 60_000)) {
    return Response.json({ errors: { form: "Слишком много заявок подряд. Попробуйте через 10 минут или позвоните нам." } }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ errors: { form: "Неверный запрос" } }, { status: 400 }); }
  try {
    const r = await createOrder(body);
    if (!r.ok) return Response.json({ errors: r.errors }, { status: r.status });
    return Response.json({ number: r.number, token: r.token, redirectUrl: r.redirectUrl }, { status: 201 });
  } catch (e) {
    console.error("[orders] create failed", e);
    return Response.json({ errors: { form: "Не удалось сохранить заявку. Попробуйте ещё раз через минуту." } }, { status: 500 });
  }
}
