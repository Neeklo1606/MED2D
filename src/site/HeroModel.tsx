"use client";
import { useEffect, useState } from "react";
import PhotoRenderer from "@/configurator/renderers/PhotoRenderer";
import type { Look } from "@/configurator/look";

const LOOKS: [string, string, string][] = [
  ["emerald", "emerald", "white"],
  ["lightblue", "navy", "white"],
  ["pink", "pink", "white"],
  ["navy", "navy", "black"],
  ["white", "lightblue", "grey"],
];

/** Витрина на главной: фото-модель, цвета образа сменяются раз в 2,6 с (без анимации при reduced motion). */
export default function HeroModel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % LOOKS.length), 2600);
    return () => clearInterval(id);
  }, []);
  const [top, bottom, feet] = LOOKS[i];
  const look: Look = { gender: "f", slots: { top: { slug: "anorak", color: top, size: null }, bottom: { slug: "joggers", color: bottom, size: null }, feet: { slug: "sabo", color: feet, size: null } } };
  return <PhotoRenderer look={look} label="Модель в комплекте MEDFORM: анорак, джоггеры и сабо" />;
}
