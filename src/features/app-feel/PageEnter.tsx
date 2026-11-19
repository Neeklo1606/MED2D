"use client";
import { useSyncExternalStore } from "react";

let back = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => { back = true; setTimeout(() => (back = false), 600); });
}

/** Вход страницы 180 мс; при «Назад» без анимации. */
export default function PageEnter({ children }: { children: React.ReactNode }) {
  const isBack = useSyncExternalStore(() => () => {}, () => back, () => false);
  return <div className={isBack ? undefined : "page-enter"}>{children}</div>;
}
