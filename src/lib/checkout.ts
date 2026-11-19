import { z } from "zod";

/** Общие схемы клиента и сервера. */
export const cartLineSchema = z.object({
  slug: z.string().min(1).max(64),
  color: z.string().min(1).max(32),
  size: z.string().max(8).nullable(),
  qty: z.number().int().min(1).max(20),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const DELIVERY_METHODS = ["pickup", "courier"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => /^\+?\d{10,15}$/.test(v), "Введите телефон, например +7 900 000-00-00");

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Введите имя").max(80, "Слишком длинное имя"),
  phone,
  email: z.string().trim().max(120).email("Проверьте email, например name@mail.ru"),
  city: z.string().trim().min(2, "Укажите город").max(80),
  deliveryMethod: z.enum(DELIVERY_METHODS, { message: "Выберите способ получения" }),
  address: z.string().trim().min(5, "Укажите адрес или пункт выдачи").max(240),
  comment: z.string().trim().max(1000).optional().default(""),
  consentPd: z.literal(true, { message: "Нужно согласие на обработку персональных данных" }),
  consentMarketing: z.boolean().optional().default(false),
  /** honeypot: люди это поле не видят */
  website: z.string().max(0).optional().default(""),
  items: z.array(cartLineSchema).min(1, "Корзина пуста").max(50),
  look: z.string().max(500).optional(),
  utm: z.record(z.string(), z.string().max(200)).optional(),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const fieldErrors = (e: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const i of e.issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
};

export const rub = (kop: number) => new Intl.NumberFormat("ru-RU").format(Math.round(kop / 100)) + " ₽";
