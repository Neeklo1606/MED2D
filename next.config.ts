import type { NextConfig } from "next";

const indexing = process.env.INDEXING_ENABLED === "true";
// Яндекс Метрика разрешена в CSP только если задан счётчик (грузится после согласия на cookies)
const ym = process.env.YM_COUNTER_ID ? " https://mc.yandex.ru https://mc.yandex.com" : "";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; img-src 'self' data: blob:${ym}; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${ym}; font-src 'self'; connect-src 'self' blob: data:${ym}; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { staleTimes: { dynamic: 30, static: 300 } },
  async headers() {
    const headers = [...securityHeaders];
    if (!indexing) headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    return [
      { source: "/:path*", headers },
      // 3D-модели с версией (?v=<хэш содержимого> из model-versions.json): файл по такому адресу не меняется
      {
        source: "/3d/:path*",
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // без версии (прямые ссылки, инструменты): короткий кеш, чтобы новые модели появлялись без сброса кеша
      {
        source: "/3d/:path*",
        missing: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
      // фото товаров меняются редко: сутки из кеша, неделю показываем старое, пока обновляем в фоне
      { source: "/products/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      // шрифты и фото-модель меняются редко: месяц в кеше, фоновое обновление
      { source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=2592000" }] },
      { source: "/photo-model/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

export default nextConfig;
