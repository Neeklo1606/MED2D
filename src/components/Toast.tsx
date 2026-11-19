"use client";
import { useToast } from "@/configurator/store";

export default function Toast() {
  const text = useToast((s) => s.text);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      {text && <div className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg">{text}</div>}
    </div>
  );
}
