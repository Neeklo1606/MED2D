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
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
