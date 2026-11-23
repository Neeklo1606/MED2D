"use client";
import { useEffect } from "react";
import { detectRenderer } from "./renderers/types";
import { initialLook, lookFiles, warm } from "./models";

/**
 * Начинает скачивать модели образа сразу после гидрации, параллельно с чанком three.js
 * (ThreeRenderer грузится динамически и иначе запросил бы GLB только после своего кода).
 * Ничего не рисует; в фото-режиме ничего не делает.
 */
export default function ModelPreload() {
  useEffect(() => {
    if (detectRenderer() !== "three") return;
    for (const u of lookFiles(initialLook(window.location.search))) void warm(u, "high");
  }, []);
  return null;
}
