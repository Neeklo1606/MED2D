import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MEDFORM: медицинская одежда",
    short_name: "MEDFORM",
    description: "Соберите капсулу медицинской одежды в 3D-конфигураторе",
    start_url: "/catalog",
    scope: "/",
    display: "standalone",
    background_color: "#ededef",
    theme_color: "#ededef",
    lang: "ru",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
