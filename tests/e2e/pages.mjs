// Site-wide checks: navigation pages, product pages, 404, health, horizontal scroll.
import { acceptCookies, assert, canvasShot, newContext, noHorizontalScroll, norm, scenario, SLUGS, waitScene, watchPage } from "./lib.mjs";

const settle = (page) => page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

/** Links from the header (mobile: burger menu) and the footer, same-origin only. */
async function navLinks(page, mobile) {
  const hrefs = new Set();
  const collect = async (sel) => {
    for (const h of await page.locator(sel).evaluateAll((els) => els.map((a) => a.getAttribute("href")))) {
      if (h && h.startsWith("/") && !h.startsWith("//")) hrefs.add(h.split("#")[0]);
    }
  };
  if (mobile) {
    await page.getByRole("button", { name: "Меню" }).click();
    await page.locator("dialog[open] a").first().waitFor({ timeout: 5000 });
    await collect("dialog[open] a[href]");
    await page.keyboard.press("Escape");
  }
  await collect("header a[href]");
  await collect("footer a[href]");
  return [...hrefs].sort();
}

export async function runPages({ browser, base, vpDef, results }) {
  const vp = vpDef.label;
  const ctx = await newContext(browser, vpDef);
  const page = await ctx.newPage();
  const log = watchPage(page, base);
  const s = scenario(results, { vp, group: "pages", page });

  let links = [];
  await s.step("home opens, cookie banner accepted, nav links collected", async () => {
    const r = await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    assert(r.status() === 200, `status ${r.status()}`);
    await acceptCookies(page);
    links = await navLinks(page, vpDef.isMobile);
    for (const must of ["/catalog", "/about", "/buyers", "/contacts", "/cart", "/legal/offer", "/legal/privacy"]) {
      assert(links.includes(must), `navigation lacks ${must} (found ${links.join(", ")})`);
    }
  }, { fatal: true });

  await s.step("home: no console errors", async () => {
    await settle(page);
    const errs = log.take();
    assert(!errs.length, errs.join(" || "));
  });

  await s.step("no analytics script before consent (Metrika)", async () => {
    // fresh context: nobody has consented yet
    const c2 = await newContext(browser, vpDef);
    try {
      const p2 = await c2.newPage();
      const hits = [];
      p2.on("request", (r) => { if (/mc\.yandex\.(ru|com)/.test(r.url())) hits.push(r.url()); });
      const r = await p2.goto(`${base}/`, { waitUntil: "domcontentloaded" });
      const html = await r.text();
      await settle(p2);
      const injected = /mc\.yandex\.ru\/metrika/.test(html);
      assert(!injected && !hits.length, `Yandex Metrika ${injected ? "is injected into the HTML" : "is requested"} before cookie consent${hits.length ? ` (${hits[0]})` : ""}; CSP blocks it -> console error on every page`);
    } finally {
      await c2.close();
    }
  });

  for (const href of links) {
    await s.step(`${href} 200, no console errors`, async () => {
      const r = await page.goto(`${base}${href}`, { waitUntil: "domcontentloaded" });
      assert(r.status() === 200, `status ${r.status()}`);
      await settle(page);
      const h1 = norm(await page.locator("h1").first().innerText({ timeout: 5000 }).catch(() => ""));
      assert(h1 || href === "/", "no <h1>");
      if (href === "/catalog") await waitScene(page, browser).catch(() => {});
      const errs = log.take();
      assert(!errs.length, errs.slice(0, 5).join(" || "));
    });
  }

  for (const slug of SLUGS) {
    await s.step(`/product/${slug}`, async () => {
      const r = await page.goto(`${base}/product/${slug}`, { waitUntil: "domcontentloaded" });
      assert(r.status() === 200, `status ${r.status()}`);
      const h1 = norm(await page.locator("h1").first().innerText());
      assert(h1 && !/404/.test(h1), `bad h1 "${h1}"`);
      const add = page.getByRole("button", { name: "В корзину", exact: true }).first();
      await add.waitFor({ state: "visible", timeout: 5000 });
      const hasCanvas = await page.locator("canvas").count().then((n) => n > 0).catch(() => false);
      if (hasCanvas || (await page.locator("main canvas").first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false))) {
        await waitScene(page, browser);
        const st = await canvasShot(page, browser);
        assert(st.nonBlank > 0.01, `3D preview blank (${(st.nonBlank * 100).toFixed(2)}%)`);
      } else {
        const ok = await page.locator("main img").first().evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
        assert(ok, "no 3D canvas and no product image");
      }
      // without a size the add button must ask for one (all clothing and shoes have sizes)
      const sizes = await page.getByRole("radiogroup", { name: "Размер" }).count();
      if (sizes) {
        await add.click();
        await page.getByRole("alert").filter({ hasText: "Выберите размер" }).first().waitFor({ timeout: 3000 });
      }
      const errs = log.take();
      assert(!errs.length, errs.slice(0, 5).join(" || "));
    }, { shot: slug === "anorak" });
  }

  const notFound = ["/this-page-does-not-exist", "/product/no-such-product", "/legal/no-such-doc"];
  log.allow = (u) => notFound.some((p) => u.endsWith(p));
  for (const p of notFound) {
    await s.step(`404 page ${p}`, async () => {
      const r = await page.goto(`${base}${p}`, { waitUntil: "domcontentloaded" });
      assert(r.status() === 404, `status ${r.status()}`);
      await page.getByText("404", { exact: true }).first().waitFor({ timeout: 5000 });
      await page.getByRole("link", { name: /Собрать образ|каталог/i }).first().waitFor({ timeout: 3000 });
      await settle(page);
      const errs = log.take().filter((e) => !/status of 404/.test(e));
      assert(!errs.length, errs.slice(0, 5).join(" || "));
    }, { shot: p === notFound[0] });
  }

  results.warnings ??= [];
  results.warnings.push(...log.warnings.map((w) => `${vp} pages: ${w}`));
  await ctx.close();
}

export async function runHealth({ base, results, request }) {
  const s = scenario(results, { vp: "api", group: "health", page: null });
  let info = null;
  await s.step("/api/health 200 + JSON", async () => {
    const r = await request.get(`${base}/api/health`);
    assert(r.status() === 200, `status ${r.status()}`);
    info = await r.json();
    assert(info.status === "ok", `status field ${info.status}`);
    assert(["ok", "not-configured"].includes(info.database), `database ${info.database}`);
  });
  await s.step("security headers present", async () => {
    const r = await request.get(`${base}/catalog`);
    const h = r.headers();
    for (const k of ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy"]) assert(h[k], `missing ${k}`);
  });
  return info;
}

const OVERFLOW_PAGES = ["/", "/catalog", "/product/anorak", "/product/sabo", "/cart", "/checkout", "/about", "/buyers", "/contacts", "/legal/offer", "/this-page-does-not-exist"];
const WIDTHS = [360, 375, 414, 768, 1440];

export async function runOverflow({ browser, base, results }) {
  for (const w of WIDTHS) {
    const mobile = w < 1024;
    const ctx = await newContext(browser, { viewport: { width: w, height: mobile ? 800 : 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    // consent given and a non-empty cart so /cart and /checkout render their full layout
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("medform-consent", JSON.stringify({ analytics: false, at: "2026-11-23T00:00:00Z" }));
        if (!localStorage.getItem("medform-cart")) localStorage.setItem("medform-cart", JSON.stringify({ state: { items: [{ slug: "anorak", color: "navy", size: "M", qty: 1 }, { slug: "sabo", color: "grey", size: "40", qty: 2 }] }, version: 0 }));
      } catch { /* ignore */ }
    });
    const page = await ctx.newPage();
    const s = scenario(results, { vp: String(w), group: "no-h-scroll", page });
    for (const p of OVERFLOW_PAGES) {
      await s.step(p, async () => {
        await page.goto(`${base}${p}`, { waitUntil: "domcontentloaded" });
        await settle(page);
        await page.waitForTimeout(300);
        const o = await noHorizontalScroll(page);
        assert(!o, o ? `page is ${o.over}px wider than viewport (scrollWidth ${o.scrollWidth}); widest: <${o.worst?.tag} class="${o.worst?.cls}"> right=${o.worst?.right}` : "");
      });
    }
    await ctx.close();
  }
}
