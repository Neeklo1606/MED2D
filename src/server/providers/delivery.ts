import type { DeliveryMethod } from "@/lib/checkout";

export interface DeliveryOption { id: DeliveryMethod; label: string; priceKop: number | null; note: string }

/** Интерфейс доставки. СДЭК v2 подключается отдельным адаптером без переделки оформления. */
export interface DeliveryProvider {
  name: string;
  quote(input: { city: string; itemsTotalKop: number }): Promise<DeliveryOption[]>;
}

const none: DeliveryProvider = {
  name: "none",
  async quote() {
    return [
      { id: "pickup", label: "Пункт выдачи СДЭК", priceKop: null, note: "Стоимость и срок сообщит менеджер" },
      { id: "courier", label: "Курьер до двери", priceKop: null, note: "Стоимость и срок сообщит менеджер" },
    ];
  },
};

const mock: DeliveryProvider = {
  name: "mock",
  async quote({ itemsTotalKop }) {
    const free = itemsTotalKop >= 1_000_000;
    return [
      { id: "pickup", label: "Пункт выдачи СДЭК", priceKop: free ? 0 : 35_000, note: "2-4 дня, тестовый расчёт" },
      { id: "courier", label: "Курьер до двери", priceKop: free ? 0 : 60_000, note: "1-3 дня, тестовый расчёт" },
    ];
  },
};

export function deliveryProvider(): DeliveryProvider {
  return process.env.DELIVERY_PROVIDER === "mock" ? mock : none;
}
