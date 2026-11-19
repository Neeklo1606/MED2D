"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/** Link с предзагрузкой по намерению: pointerdown, touchstart, focus. */
export default function IntentLink(props: ComponentProps<typeof Link>) {
  const router = useRouter();
  const href = typeof props.href === "string" ? props.href : props.href.pathname ?? "/";
  const go = () => router.prefetch(href);
  return <Link {...props} onPointerDown={(e) => { go(); props.onPointerDown?.(e); }} onTouchStart={(e) => { go(); props.onTouchStart?.(e); }} onFocus={(e) => { go(); props.onFocus?.(e); }} />;
}
