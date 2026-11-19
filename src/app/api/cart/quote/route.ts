import { z } from "zod";
import { cartLineSchema } from "@/lib/checkout";
import { quoteCart } from "@/server/orders";

export const dynamic = "force-dynamic";

const body = z.object({ items: z.array(cartLineSchema).max(50), city: z.string().max(80).optional() });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    return Response.json(await quoteCart(parsed.data.items, parsed.data.city));
  } catch (e) {
    console.error("[cart] quote failed", e);
    return Response.json({ error: "Не удалось пересчитать корзину" }, { status: 503 });
  }
}
