import { getField } from "@/content/registry";

export const NAV = () => [
  { href: "/catalog", label: getField("global.nav.catalog") },
  { href: "/about", label: getField("global.nav.about") },
  { href: "/buyers", label: getField("global.nav.buyers") },
  { href: "/contacts", label: getField("global.nav.contacts") },
];

export const LEGAL = [
  { href: "/legal/offer", label: "Публичная оферта" },
  { href: "/legal/privacy", label: "Политика обработки персональных данных" },
  { href: "/legal/consent", label: "Согласие на обработку персональных данных" },
  { href: "/legal/cookies", label: "Политика cookies" },
  { href: "/legal/requisites", label: "Реквизиты" },
];
