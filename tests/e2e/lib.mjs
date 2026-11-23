// Shared helpers for the MEDFORM e2e suite. Plain Node + the globally installed Playwright library.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

export function loadPlaywright() {
  try {
    return require("/opt/node22/lib/node_modules/playwright");
  } catch {
    return require("playwright");
  }
}

export const CHROMIUM_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];

/** Main viewports: every scenario runs on both. */
export const VIEWPORTS = {
  mobile: { label: "375", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { label: "1440", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
};

/** Console messages we know about and accept (see task brief). */
export const IGNORED_CONSOLE = [
  /eval\(\) is not supported/i, // dev-only CSP warning
  /GPU stall due to ReadPixels/i, // swiftshader performance warning
  /Service Worker registration blocked by Playwright/i, // we block SW on purpose (stable runs)
  // Staging only: the server's HostCare nginx injects Yandex Metrika, CSP blocks it. Reported once by the
  // dedicated "no analytics before consent" check in pages.mjs instead of failing every page.
  /mc\.yandex\.ru\/metrika/i,
];

export const SLUGS = ["anorak", "tshirt", "joggers", "halat", "cap", "dokerka", "sabo", "lanyard", "shopper"];

export const norm = (s) => String(s ?? "").replace(/\u001b\[[0-9;]*m/g, "").replace(/[\s  ]+/g, " ").trim();

/* ---------------- results ---------------- */

export class Results {
  constructor(outDir) {
    this.rows = [];
    this.outDir = outDir;
    mkdirSync(outDir, { recursive: true });
  }
  add(row) {
    this.rows.push(row);
    const mark = row.status === "pass" ? "PASS" : row.status === "skip" ? "SKIP" : "FAIL";
    const extra = row.status === "fail" ? `  -> ${row.error}` : row.status === "skip" ? `  (${row.error})` : "";
    console.log(`[${mark}] ${row.vp.padEnd(5)} ${row.group} / ${row.name} (${row.ms} ms)${extra}`);
  }
  shotPath(vp, group, name) {
    const safe = `${vp}-${group}-${name}`.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "").slice(0, 90);
    return path.join(this.outDir, `${safe}.png`);
  }
}

/**
 * A scenario is a sequence of steps sharing one page. A failed `fatal` step skips the rest
 * of the scenario (they would only produce noise).
 */
export function scenario(results, { vp, group, page }) {
  let aborted = null;
  async function step(name, fn, { fatal = false, shot = false, always = false } = {}) {
    const t0 = Date.now();
    if (aborted && !always) {
      results.add({ vp, group, name, status: "skip", ms: 0, error: `after failed step "${aborted}"` });
      return undefined;
    }
    try {
      const out = await fn();
      let screenshot;
      if (shot && page) {
        screenshot = results.shotPath(vp, group, name);
        await page.screenshot({ path: screenshot }).catch(() => {});
      }
      results.add({ vp, group, name, status: "pass", ms: Date.now() - t0, screenshot });
      return out;
    } catch (e) {
      if (e?.skip) {
        results.add({ vp, group, name, status: "skip", ms: Date.now() - t0, error: norm(e.message) });
        return undefined;
      }
      let screenshot;
      if (page && !page.isClosed()) {
        screenshot = results.shotPath(vp, group, name);
        await page.screenshot({ path: screenshot }).catch(() => { screenshot = undefined; });
      }
      let error = norm(e?.message ?? e).slice(0, 400);
      // app error boundary: the rest of the scenario can only time out
      const crashed = page && !page.isClosed() && (await page.getByText("Что-то пошло не так").count().catch(() => 0)) > 0;
      if (crashed) error = `PAGE CRASHED (error boundary «Что-то пошло не так»). ${error}`;
      results.add({ vp, group, name, status: "fail", ms: Date.now() - t0, error, screenshot });
      if (fatal || crashed) aborted = name;
      return undefined;
    }
  }
  return { step, get aborted() { return aborted; } };
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/* ---------------- browser / page ---------------- */

export async function newContext(browser, vpDef, extra = {}) {
  const { viewport, isMobile, hasTouch, deviceScaleFactor } = vpDef;
  return browser.newContext({
    viewport, isMobile, hasTouch, deviceScaleFactor,
    locale: "ru-RU",
    // reduced motion: no intro spin, camera moves are instant -> stable screenshots
    reducedMotion: "reduce",
    serviceWorkers: "block",
    ...extra,
  });
}

/** Collects console errors/warnings, page errors and failed same-origin requests. */
export function watchPage(page, baseUrl) {
  const log = { errors: [], warnings: [], glb: new Map() };
  const origin = new URL(baseUrl).origin;
  const ignored = (t) => IGNORED_CONSOLE.some((r) => r.test(t));
  page.on("console", (m) => {
    const text = m.text();
    if (ignored(text)) return;
    const src = m.location()?.url ?? "";
    // "Failed to load resource" for an expected HTTP error (allow-listed URL) is not a bug
    if (/Failed to load resource/.test(text) && src && log.allow?.(src)) return;
    const loc = src ? ` @ ${src}` : "";
    if (m.type() === "error") log.errors.push(`console.error: ${text}${loc}`.slice(0, 500));
    else if (m.type() === "warning") log.warnings.push(`console.warn: ${text}`.slice(0, 500));
  });
  page.on("pageerror", (e) => log.errors.push(`pageerror: ${e.message}`.slice(0, 500)));
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/3d/models/") && u.split("?")[0].endsWith(".glb")) log.glb.set(path.basename(u.split("?")[0]), r.status());
    if (u.startsWith(origin) && r.status() >= 400 && !log.allow?.(u)) log.errors.push(`HTTP ${r.status()} ${u}`);
  });
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText ?? "";
    if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(f)) return; // navigation aborted fetches (RSC prefetch etc.)
    if (ignored(r.url())) return;
    log.errors.push(`request failed: ${r.url()} ${f}`);
  });
  log.take = () => { const e = [...log.errors]; log.errors.length = 0; return e; };
  return log;
}

export async function acceptCookies(page) {
  const btn = page.getByRole("dialog", { name: "Настройки cookies" }).getByRole("button", { name: "Принять", exact: true });
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.click();
  await btn.waitFor({ state: "detached", timeout: 5000 });
}

/** Toast text (aria-live region at the top). */
export async function waitToast(page, re, timeout = 5000) {
  const toast = page.locator('div[aria-live="polite"].fixed');
  await toast.filter({ hasText: re }).waitFor({ state: "visible", timeout });
  return norm(await toast.innerText());
}

/* ---------------- canvas pixels ---------------- */

let decoder = null;
async function getDecoder(browser) {
  if (decoder && !decoder.isClosed()) return decoder;
  const ctx = await browser.newContext();
  decoder = await ctx.newPage();
  await decoder.goto("about:blank");
  return decoder;
}

/**
 * Screenshot of the visible 3D canvas with UI overlays hidden, decoded in a blank page.
 * Returns the share of "non-blank" pixels (far from the dominant background colour) and the mean colour.
 */
export async function canvasShot(page, browser) {
  const canvas = page.locator("canvas:visible").first();
  await canvas.waitFor({ state: "visible", timeout: 30000 });
  await canvas.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const c = [...document.querySelectorAll("canvas")].find((x) => x.offsetParent !== null);
    const root = c?.closest("section") ?? c?.parentElement?.parentElement;
    const hide = [...(root?.querySelectorAll("button, p, svg") ?? []), ...document.querySelectorAll(".fixed")];
    for (const el of hide) {
      if (el.closest("canvas")) continue;
      el.dataset.qaHidden = el.style.visibility || "-";
      el.style.visibility = "hidden";
    }
  });
  const buf = await canvas.screenshot({ animations: "disabled" });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-qa-hidden]")) {
      el.style.visibility = el.dataset.qaHidden === "-" ? "" : el.dataset.qaHidden;
      delete el.dataset.qaHidden;
    }
  });
  return { buf, ...(await pixelStats(browser, buf)) };
}

export async function pixelStats(browser, buf) {
  const d = await getDecoder(browser);
  return d.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const w = Math.max(1, Math.floor(bmp.width / 2)), h = Math.max(1, Math.floor(bmp.height / 2));
    const cv = new OffscreenCanvas(w, h);
    const g = cv.getContext("2d");
    g.drawImage(bmp, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    const hist = new Map();
    for (let i = 0; i < px.length; i += 4) {
      const k = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
      hist.set(k, (hist.get(k) ?? 0) + 1);
    }
    let mode = 0, best = -1;
    for (const [k, v] of hist) if (v > best) { best = v; mode = k; }
    const mr = ((mode >> 10) & 31) * 8 + 4, mg = ((mode >> 5) & 31) * 8 + 4, mb = (mode & 31) * 8 + 4;
    let far = 0, sr = 0, sg = 0, sb = 0;
    const n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      sr += px[i]; sg += px[i + 1]; sb += px[i + 2];
      if (Math.abs(px[i] - mr) + Math.abs(px[i + 1] - mg) + Math.abs(px[i + 2] - mb) > 60) far++;
    }
    return { nonBlank: far / n, mean: [sr / n, sg / n, sb / n], w, h };
  }, buf.toString("base64"));
}

/** Mean absolute per-channel difference (0..255) between two screenshots of the same size. */
export async function imageDiff(browser, a, b) {
  const d = await getDecoder(browser);
  return d.evaluate(async ([x, y]) => {
    const load = async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const cv = new OffscreenCanvas(160, 160);
      const g = cv.getContext("2d");
      g.drawImage(bmp, 0, 0, 160, 160);
      return g.getImageData(0, 0, 160, 160).data;
    };
    const [p, q] = await Promise.all([load(x), load(y)]);
    let s = 0;
    for (let i = 0; i < p.length; i += 4) s += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]);
    return s / (p.length / 4) / 3;
  }, [a.toString("base64"), b.toString("base64")]);
}

/** Waits until the 3D scene finished loading and two consecutive frames are identical. */
export async function waitScene(page, browser, timeout = 45000) {
  const t0 = Date.now();
  await page.locator("canvas:visible").first().waitFor({ state: "visible", timeout });
  // loader text from ThreeRenderer ("3D-модель 42%") and dynamic import placeholder ("3D…")
  await page.waitForFunction(() => !/3D-модель \d+%|^3D…$/m.test(document.body.innerText), null, { timeout: Math.max(1000, timeout - (Date.now() - t0)) });
  let prev = (await canvasShot(page, browser)).buf;
  while (Date.now() - t0 < timeout) {
    await page.waitForTimeout(400);
    const cur = (await canvasShot(page, browser)).buf;
    if ((await imageDiff(browser, prev, cur)) < 0.3) return cur;
    prev = cur;
  }
  throw new Error("3D scene did not settle");
}

export async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const over = de.scrollWidth - window.innerWidth;
    if (over <= 1) return null;
    // the widest offender helps the report
    let worst = null;
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth + 1 && r.width > 0) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed") continue;
        if (!worst || r.right > worst.right) worst = { right: Math.round(r.right), tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 80) };
      }
    }
    return { over, scrollWidth: de.scrollWidth, innerWidth: window.innerWidth, worst };
  });
}
