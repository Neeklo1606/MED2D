"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/** Полоса 2px появляется, только если переход дольше 150 мс. */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      active.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => active.current && setState("loading"), 150);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!active.current) return;
    active.current = false;
    clearTimeout(timer.current);
    const id = setTimeout(() => setState((s) => (s === "loading" ? "done" : "idle")), 0);
    const id2 = setTimeout(() => setState("idle"), 400);
    return () => { clearTimeout(id); clearTimeout(id2); };
  }, [pathname, search]);

  return state === "idle" ? null : <div className="nav-progress" data-state={state} aria-hidden />;
}

export default function NavigationProgress() {
  return <Suspense fallback={null}><Bar /></Suspense>;
}
