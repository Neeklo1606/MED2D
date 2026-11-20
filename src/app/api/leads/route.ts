import { headers } from "next/headers";
import { z } from "zod";
import { fieldErrors } from "@/lib/checkout";
import { db, schema } from "@/server/db";
import { clientIp, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const leadSchema = z.object({
  kind: z.enum(["question", "size"]),
  name: z.string().trim().min(2, "Введите имя").max(80),
  contact: z.string().trim().min(5, "Укажите телефон или email").max(120),
  message: z.string().trim().min(3, "Напишите вопрос").max(2000),
  consentPd: z.literal(true, { message: "Нужно согласие на обработку персональных данных" }),
  website: z.string().max(0).optional().default(""),
});

export async function POST(req: Request) {
  if (!rateLimit(`lead:${clientIp(await headers())}`, 5, 10 * 60_000)) {
    return Response.json({ errors: { form: "Слишком много сообщений подряд. Попробуйте через 10 минут." } }, { status: 429 });
  }
  const parsed = leadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ errors: fieldErrors(parsed.error) }, { status: 422 });
  const { kind, name, contact, message } = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const [l] = await tx.insert(schema.lead).values({ kind, data: { name, contact, message }, consentPdAt: new Date() }).returning({ id: schema.lead.id });
      await tx.insert(schema.notificationOutbox).values({ channel: "telegram", payload: { type: "lead", id: l.id, kind, name, message } });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("[leads] save failed", e);
    return Response.json({ errors: { form: "Не удалось отправить. Попробуйте ещё раз через минуту." } }, { status: 500 });
  }
}
