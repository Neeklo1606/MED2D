/** Интерфейс оплаты. ЮKassa (СБП + карты, чеки 54-ФЗ) подключается отдельным адаптером. */
export interface PaymentProvider {
  name: string;
  /** null = оплата не нужна (режим заявки). */
  createPayment(order: { number: string; token: string; totalKop: number }): Promise<{ redirectUrl: string; paymentId: string } | null>;
}

const none: PaymentProvider = { name: "none", async createPayment() { return null; } };

const mock: PaymentProvider = {
  name: "mock",
  async createPayment(o) {
    return { paymentId: `mock-${o.number}`, redirectUrl: `/order/${o.token}?payment=mock` };
  },
};

export function paymentProvider(): PaymentProvider {
  return process.env.PAYMENTS_PROVIDER === "mock" ? mock : none;
}
