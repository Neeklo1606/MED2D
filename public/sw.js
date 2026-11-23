/* MEDFORM service worker. Кеш по ID сборки; API, админка, POST и заказы не кешируются. */
const V = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC = `mf-static-${V}`;
const PAGES = `mf-pages-${V}`;
// 3D-модели с ?v=<хэш> не зависят от сборки: кеш переживает деплой, старые версии файла удаляются
const MODELS = "mf-3d";
const OFFLINE = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mf-") && k !== STATIC && k !== PAGES && k !== MODELS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const noCache = (url) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/order/") || url.pathname.startsWith("/checkout");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || noCache(url)) return;

  if (url.pathname.startsWith("/3d/") && url.searchParams.has("v")) {
    e.respondWith(caches.open(MODELS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        await c.put(req, res.clone());
        for (const old of await c.keys()) {
          const u = new URL(old.url);
          if (u.pathname === url.pathname && u.search !== url.search) c.delete(old);
        }
      }
      return res;
    }));
    return;
  }

  // статика с хэшем, шрифты и 3D-модели без версии: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/3d/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // HTML: network-first с офлайн-страницей
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok && !url.search) caches.open(PAGES).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE))));
  }
});
