// Critical path: 3D configurator -> share link -> add look -> cart -> checkout.
import { acceptCookies, assert, canvasShot, imageDiff, newContext, norm, scenario, waitScene, waitToast, watchPage } from "./lib.mjs";

const card = (page, slug) => page.locator(`article[data-card="${slug}"]:visible`);
const wearBtn = (page, slug) => card(page, slug).locator("button[aria-pressed]");
const radio = (scope, name) => scope.getByRole("radio", { name, exact: true });
const totalBlock = (page) => page.locator("div.bg-accent:visible").filter({ hasText: "Добавить весь образ в корзину" });

async function ensureWorn(page, slug) {
  const b = wearBtn(page, slug);
  if ((await b.getAttribute("aria-pressed")) !== "true") await b.click();
  await waitAttr(b, "aria-pressed", "true");
}
async function waitAttr(loc, attr, value, timeout = 5000) {
  const t0 = Date.now();
  let cur;
  while (Date.now() - t0 < timeout) {
    cur = await loc.getAttribute(attr);
    if (cur === value) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${attr} expected "${value}", got "${cur}"`);
}
async function pick(page, slug, radioName) {
  const r = radio(card(page, slug), radioName);
  await r.click();
  await waitAttr(r, "aria-checked", "true");
}
async function totalRows(page) {
  return (await totalBlock(page).locator("ul > li").allInnerTexts()).map(norm);
}
async function waitUrl(page, re, timeout = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (re.test(decodeURIComponent(page.url()))) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`URL ${page.url()} does not match ${re}`);
}
async function cartItems(page) {
  return page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("medform-cart") ?? "null")?.state?.items ?? []; } catch { return []; }
  });
}
function glbOk(log, files) {
  const bad = files.filter((f) => log.glb.get(f) !== 200);
  assert(!bad.length, `GLB not loaded (status): ${bad.map((f) => `${f}=${log.glb.get(f) ?? "not requested"}`).join(", ")}`);
}
async function inViewport(page, loc) {
  const box = await loc.boundingBox();
  const vp = page.viewportSize();
  return !!box && box.x < vp.width && box.x + box.width > 0 && box.y < vp.height && box.y + box.height > 0;
}

/** Outfit built by the scenario; also what the share URL must restore. */
const OUTFIT = [
  { slug: "tshirt", color: "синий", size: "M", q: "top=tshirt.blue.M" },
  { slug: "joggers", color: "тёмно-синий", size: "L", q: "bottom=joggers.navy.L" },
  { slug: "sabo", color: "серый", size: "40", q: "feet=sabo.grey.40" },
  { slug: "cap", color: "тёмно-синий", size: null, q: "head=cap.navy" },
  { slug: "lanyard", color: "чёрный", size: null, q: "accessory=lanyard.black" },
];
const MODELS = ["mannequin", "top_tshirt", "bottom_joggers", "feet_sabo", "head_cap", "acc_lanyard"];

async function verifyOutfit(page) {
  for (const o of OUTFIT) {
    await waitAttr(wearBtn(page, o.slug), "aria-pressed", "true");
    await waitAttr(radio(card(page, o.slug), o.color), "aria-checked", "true");
    if (o.size) await waitAttr(radio(card(page, o.slug), o.size), "aria-checked", "true");
  }
  const rows = await totalRows(page);
  assert(rows.length === OUTFIT.length, `ИТОГО has ${rows.length} rows, expected ${OUTFIT.length}: ${rows.join(" | ")}`);
}

export async function runConfigurator({ browser, base, vpKey, vpDef, results, db, readonly }) {
  const vp = vpDef.label;
  const ctx = await newContext(browser, vpDef);
  const page = await ctx.newPage();
  const log = watchPage(page, base);
  // without a database the price quote is expected to fail with 503; the UI must handle it
  const allowed = [];
  log.allow = (u) => allowed.some((re) => re.test(u));
  if (db !== "ok") allowed.push(/\/api\/cart\/quote/);
  const s = scenario(results, { vp, group: "configurator", page });
  const step = s.step;
  const gender = vpKey === "mobile" ? "m" : "f"; // exercise both genders across the two runs
  let before;

  await step("open /catalog and accept cookies", async () => {
    const r = await page.goto(`${base}/catalog`, { waitUntil: "domcontentloaded" });
    assert(r.status() === 200, `status ${r.status()}`);
    await acceptCookies(page);
  }, { fatal: true });

  await step("3D canvas renders (non-blank pixels)", async () => {
    await waitScene(page, browser);
    const st = await canvasShot(page, browser);
    assert(st.nonBlank > 0.03, `canvas looks blank: ${(st.nonBlank * 100).toFixed(2)}% non-background pixels`);
    glbOk(log, ["mannequin_f.glb", "top_anorak_f.glb", "bottom_joggers_f.glb", "feet_sabo_f.glb"]);
  }, { fatal: true, shot: true });

  await step("wear top (t-shirt replaces default top)", async () => {
    await wearBtn(page, "tshirt").click();
    await waitAttr(wearBtn(page, "tshirt"), "aria-pressed", "true");
    await waitAttr(wearBtn(page, "anorak"), "aria-pressed", "false");
    const rows = await totalRows(page);
    assert(rows.some((r) => r.includes("Футболка оверсайз")) && !rows.some((r) => r.includes("Медицинский верх")), `ИТОГО: ${rows.join(" | ")}`);
    before = await waitScene(page, browser);
    glbOk(log, ["top_tshirt_f.glb"]);
  }, { fatal: true });

  await step("change top colour (model recoloured)", async () => {
    await pick(page, "tshirt", "синий");
    const after = await waitScene(page, browser);
    const d = await imageDiff(browser, before, after);
    assert(d > 0.5, `canvas did not change after colour switch (diff ${d.toFixed(2)})`);
    await waitUrl(page, /top=tshirt\.blue/);
  });

  await step("choose top size", async () => {
    await pick(page, "tshirt", "M");
    await waitUrl(page, /top=tshirt\.blue\.M/);
  });

  await step("wear trousers, colour + size", async () => {
    await ensureWorn(page, "joggers");
    await pick(page, "joggers", "тёмно-синий");
    await pick(page, "joggers", "L");
    await waitUrl(page, /bottom=joggers\.navy\.L/);
  });

  await step("wear shoes + size", async () => {
    await ensureWorn(page, "sabo");
    await pick(page, "sabo", "серый");
    await pick(page, "sabo", "40");
    await waitUrl(page, /feet=sabo\.grey\.40/);
  });

  await step("wear cap", async () => {
    await ensureWorn(page, "cap");
    await pick(page, "cap", "тёмно-синий");
    await waitUrl(page, /head=cap\.navy/);
  });

  await step("wear lanyard", async () => {
    await ensureWorn(page, "lanyard");
    await waitUrl(page, /accessory=lanyard\.black/);
    await waitScene(page, browser);
    glbOk(log, ["head_cap_f.glb", "acc_lanyard_f.glb"]);
  }, { shot: true });

  await step("ИТОГО lists the outfit and sums prices (8 200 ₽)", async () => {
    await verifyOutfit(page);
    const txt = norm(await totalBlock(page).innerText());
    assert(/Итого\s*8 200 ₽/i.test(txt), `ИТОГО header: ${txt.slice(0, 80)}`);
  });

  const genderBtn = (g) => page.locator(`button[aria-label="${g === "m" ? "Мужская модель" : "Женская модель"}"]:visible`);
  await step("switch Ж -> М keeps the outfit", async () => {
    await genderBtn("m").click();
    await waitAttr(genderBtn("m"), "aria-pressed", "true");
    await waitUrl(page, /g=m/);
    await verifyOutfit(page);
    const st = await waitScene(page, browser).then(() => canvasShot(page, browser));
    assert(st.nonBlank > 0.03, `canvas blank after gender switch (${(st.nonBlank * 100).toFixed(2)}%)`);
    glbOk(log, MODELS.map((m) => `${m}_m.glb`));
    before = st.buf;
  }, { shot: true });

  if (gender === "f") {
    await step("switch М -> Ж keeps the outfit", async () => {
      await genderBtn("f").click();
      await waitAttr(genderBtn("f"), "aria-pressed", "true");
      await waitUrl(page, /g=f/);
      await verifyOutfit(page);
      before = await waitScene(page, browser);
    });
  }

  await step("zoom + changes the view", async () => {
    await page.locator('button[aria-label="Приблизить"]:visible').click();
    const after = await waitScene(page, browser);
    const d = await imageDiff(browser, before, after);
    assert(d > 0.5, `no visible zoom (diff ${d.toFixed(2)})`);
    before = after;
  });

  await step("zoom − changes the view", async () => {
    await page.locator('button[aria-label="Отдалить"]:visible').click();
    await page.locator('button[aria-label="Отдалить"]:visible').click();
    const after = await waitScene(page, browser);
    const d = await imageDiff(browser, before, after);
    assert(d > 0.5, `no visible zoom out (diff ${d.toFixed(2)})`);
    before = after;
  });

  await step("drag rotates the view", async () => {
    // в макете нет кнопки поворота: модель вращают перетаскиванием
    const box = await page.locator("canvas:visible").first().boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 18, cy, { steps: 2 });
    await page.mouse.up();
    const after = await waitScene(page, browser);
    const d = await imageDiff(browser, before, after);
    assert(d > 0.5, `no visible rotation (diff ${d.toFixed(2)})`);
  }, { shot: true });

  let shareUrl = "";
  await step("share URL encodes the outfit", async () => {
    await page.waitForTimeout(500); // replaceState debounce 300 ms
    shareUrl = page.url();
    const q = decodeURIComponent(new URL(shareUrl).search);
    const missing = [`g=${gender}`, ...OUTFIT.map((o) => o.q)].filter((p) => !q.includes(p));
    assert(!missing.length, `URL ${q} lacks ${missing.join(", ")}`);
  });

  await step("share URL round-trip (fresh tab restores outfit)", async () => {
    assert(shareUrl, "no share URL");
    const p2 = await ctx.newPage();
    const log2 = watchPage(p2, base);
    log2.allow = log.allow;
    try {
      await p2.goto(shareUrl, { waitUntil: "domcontentloaded" });
      await verifyOutfit(p2);
      const g = p2.locator(`button[aria-label="${gender === "m" ? "Мужская модель" : "Женская модель"}"]:visible`);
      await waitAttr(g, "aria-pressed", "true");
      await waitScene(p2, browser);
      const st = await canvasShot(p2, browser);
      assert(st.nonBlank > 0.03, "canvas blank on restored look");
      const errs = log2.take();
      assert(!errs.length, `console errors on restored page: ${errs.join(" || ")}`);
    } finally {
      await p2.close();
    }
  });

  await step("«Снять всё» empties the look, model stays", async () => {
    await page.locator("button:visible", { hasText: "Снять всё" }).click();
    await totalBlock(page).getByText("Наденьте вещи из списка").waitFor({ timeout: 3000 });
    for (const o of OUTFIT) await waitAttr(wearBtn(page, o.slug), "aria-pressed", "false");
    const g = page.locator(`button[aria-label="${gender === "m" ? "Мужская модель" : "Женская модель"}"]:visible`);
    await waitAttr(g, "aria-pressed", "true");
    const st = await waitScene(page, browser).then(() => canvasShot(page, browser));
    assert(st.nonBlank > 0.01, "mannequin vanished after «Снять всё»");
  }, { shot: true });

  await step("reload after «Снять всё» keeps the empty look", async () => {
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const rows = await totalRows(page);
    assert(rows.length === 0, `after reload ИТОГО shows ${rows.length} items (${rows.join(" | ")}); URL ${decodeURIComponent(page.url())}`);
  });

  /* ---- add whole look with a missing size ---- */
  await step("«Добавить весь образ» with missing size: error on card", async () => {
    await page.goto(`${base}/catalog?g=f&top=anorak.navy.M&bottom=joggers.navy&feet=sabo.grey.40`, { waitUntil: "domcontentloaded" });
    await waitAttr(wearBtn(page, "joggers"), "aria-pressed", "true");
    await totalBlock(page).getByRole("button", { name: "Добавить весь образ в корзину" }).click();
    await waitToast(page, /Выберите размер у отмеченных вещей/);
    const c = card(page, "joggers");
    await c.getByRole("alert").filter({ hasText: "Выберите размер" }).waitFor({ timeout: 3000 });
    await page.waitForTimeout(800); // smooth scroll
    assert(await inViewport(page, c), "flagged card was not scrolled into view");
    assert(!(await card(page, "anorak").getByRole("alert").count()), "card with a size is flagged too");
    assert((await cartItems(page)).length === 0, "items were added despite a missing size");
  }, { shot: true });

  await step("missing size: keyboard focus moves to the size group", async () => {
    const inside = await card(page, "joggers").evaluate((el) => el.contains(document.activeElement));
    const active = await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.slice(0, 30)}`);
    assert(inside, `focus stays on «${norm(active)}», spec 2.5 requires focus on the size group of the flagged card`);
  });

  await step("fix size, add whole look", async () => {
    await pick(page, "joggers", "L");
    assert(!(await card(page, "joggers").getByRole("alert").count()), "error stays after choosing size");
    await totalBlock(page).getByRole("button", { name: "Добавить весь образ в корзину" }).click();
    await waitToast(page, /Образ добавлен в корзину/);
    const items = await cartItems(page);
    const keys = items.map((i) => `${i.slug}.${i.color}.${i.size}`).sort();
    assert(JSON.stringify(keys) === JSON.stringify(["anorak.navy.M", "joggers.navy.L", "sabo.grey.40"]), `cart: ${keys.join(", ")}`);
  });

  await step("header cart counter shows 3", async () => {
    const btn = page.locator("a[data-cart-button]:visible");
    await page.waitForFunction(() => {
      const a = [...document.querySelectorAll("a[data-cart-button]")].find((x) => x.offsetParent !== null);
      return a && /3/.test(a.textContent + (a.getAttribute("aria-label") ?? ""));
    }, null, { timeout: 3000 });
    await btn.click();
    await page.waitForURL(/\/cart$/, { timeout: 20000 });
  }, { fatal: true });

  /* ---- cart ---- */
  const line = (title) => page.locator("main li").filter({ has: page.locator("h3", { hasText: title }) });
  await step("cart shows 3 lines with product images", async () => {
    await page.locator("main li h3").first().waitFor({ timeout: 10000 });
    assert((await page.locator("main ul > li").count()) === 3, `lines: ${await page.locator("main ul > li").count()}`);
    for (const img of await page.locator("main li img").all()) {
      await img.scrollIntoViewIfNeeded();
      await page.waitForFunction((el) => el.complete, await img.elementHandle(), { timeout: 5000 });
      const ok = await img.evaluate((el) => el.naturalWidth > 0);
      assert(ok, `image not loaded: ${await img.getAttribute("src")}`);
    }
  }, { shot: true });

  await step("cart: change colour", async () => {
    const l = line("Медицинский верх");
    await radio(l, "розовый").click();
    await page.waitForTimeout(200);
    const it = (await cartItems(page)).find((i) => i.slug === "anorak");
    assert(it?.color === "pink", `anorak colour ${it?.color}`);
    await waitAttr(radio(line("Медицинский верх"), "розовый"), "aria-checked", "true");
  });

  await step("cart: change size", async () => {
    await radio(line("Медицинский верх"), "L").click();
    await page.waitForTimeout(200);
    const it = (await cartItems(page)).find((i) => i.slug === "anorak");
    assert(it?.size === "L", `anorak size ${it?.size}`);
  });

  await step("cart: change quantity", async () => {
    await line("Медицинский верх").getByRole("button", { name: "Больше" }).click();
    await page.waitForTimeout(200);
    const it = (await cartItems(page)).find((i) => i.slug === "anorak");
    assert(it?.qty === 2, `anorak qty ${it?.qty}`);
    assert(norm(await line("Медицинский верх").getByRole("group").innerText()).includes("2"), "stepper does not show 2");
  });

  await step(db === "ok" ? "cart: server prices and checkout enabled" : "cart: no DB -> graceful price error", async () => {
    if (db === "ok") {
      // anorak 3200×2 + joggers 3000 + sabo 3000 = 12 400 ₽
      await page.waitForFunction(() => /12\s?400\s?₽/.test(document.querySelector("aside")?.textContent?.replace(/[  ]/g, " ") ?? ""), null, { timeout: 10000 });
      const link = page.locator('a[href="/checkout"]:visible');
      await waitAttr(link, "aria-disabled", "false");
    } else {
      await page.getByRole("alert").filter({ hasText: "Не удалось обновить цены" }).waitFor({ timeout: 10000 });
      await waitAttr(page.locator('a[href="/checkout"]:visible'), "aria-disabled", "true");
    }
  }, { shot: true });

  await step("cart survives reload", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("main li h3").first().waitFor({ timeout: 10000 });
    assert((await page.locator("main ul > li").count()) === 3, "lines lost after reload");
  });

  /* ---- checkout ---- */
  await step("open checkout", async () => {
    if (db === "ok") await page.locator('a[href="/checkout"]:visible').click();
    else await page.goto(`${base}/checkout`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/checkout$/, { timeout: 10000 });
    await page.locator("#name").waitFor({ timeout: 10000 });
  }, { fatal: true });

  const submit = () => page.locator('button[type="submit"]:visible').click();
  await step("checkout: empty submit shows field errors and focuses first", async () => {
    for (const id of ["name", "phone", "email", "city", "address"]) await page.locator(`#${id}`).fill("");
    await submit();
    const expected = ["Введите имя", "Введите телефон, например +7 900 000-00-00", "Проверьте email, например name@mail.ru", "Укажите город", "Укажите адрес или пункт выдачи", "Нужно согласие на обработку персональных данных"];
    for (const t of expected) await page.getByText(t, { exact: true }).first().waitFor({ timeout: 3000 });
    await page.waitForTimeout(200);
    const focused = await page.evaluate(() => document.activeElement?.id);
    assert(focused === "name", `focus on #${focused}, expected #name`);
    assert((await page.locator("#name").getAttribute("aria-invalid")) === "true", "aria-invalid not set");
  }, { shot: true });

  await step("checkout: invalid phone/email messages", async () => {
    await page.locator("#name").fill("Тест QA");
    await page.locator("#phone").fill("123");
    await page.locator("#email").fill("not-an-email");
    await page.locator("#city").fill("Москва");
    await page.locator("#city").blur();
    await page.getByText("Введите телефон, например +7 900 000-00-00", { exact: true }).waitFor({ timeout: 3000 });
    await page.getByText("Проверьте email, например name@mail.ru", { exact: true }).waitFor({ timeout: 3000 });
    assert(!(await page.getByText("Введите имя", { exact: true }).count()), "name error remains for a valid name");
  });

  await step("checkout: valid data clears errors", async () => {
    await page.locator("#phone").fill("+7 900 000-00-00");
    await page.locator("#email").fill("qa@example.com");
    await page.locator("#address").fill("ул. Тестовая, д. 1");
    await page.locator("#consentPd").check();
    await page.locator("#address").blur();
    await page.waitForTimeout(200);
    const left = await page.locator("main p.text-red-700, main [role=alert]").allInnerTexts();
    assert(!left.length, `errors still shown: ${left.join(" | ")}`);
  });

  await step("checkout: submit", async () => {
    if (readonly) throw Object.assign(new Error("read-only target"), { skip: true });
    allowed.push(/\/api\/orders/);
    await submit();
    if (db === "ok") {
      await page.waitForURL(/\/order\//, { timeout: 15000 });
      await page.getByText(/MF-\d{5}/).first().waitFor({ timeout: 5000 });
    } else {
      const box = page.locator("main [role=alert]").filter({ hasText: /Не удалось|Нет соединения/ });
      await box.waitFor({ timeout: 10000 });
      assert(/\/checkout$/.test(page.url()), `navigated away: ${page.url()}`);
      assert((await page.locator("#name").inputValue()) === "Тест QA", "form data lost after failed submit");
      assert(!(await page.getByText("Что-то пошло не так").count()), "error boundary shown");
    }
  }, { shot: true });

  await step("no console errors during the flow", async () => {
    const errs = log.take();
    assert(!errs.length, errs.slice(0, 6).join(" || "));
  }, { always: true });

  results.warnings ??= [];
  results.warnings.push(...log.warnings.map((w) => `${vp} configurator: ${w}`));
  await ctx.close();
}

/** A single failed model download (flaky mobile network) must not take the page down. */
export async function runGlbFailure({ browser, base, vpDef, results }) {
  const vp = vpDef.label;
  const ctx = await newContext(browser, vpDef);
  await ctx.addInitScript(() => { try { localStorage.setItem("medform-consent", JSON.stringify({ analytics: false, at: "2026-11-23T00:00:00Z" })); } catch { /* ignore */ } });
  const page = await ctx.newPage();
  const s = scenario(results, { vp, group: "resilience", page });
  await page.route((u) => u.pathname.endsWith("/head_cap_f.glb"), (r) => r.abort("connectionreset"));
  await s.step("failed GLB download keeps /catalog usable", async () => {
    await page.goto(`${base}/catalog?g=f&top=anorak.navy.M&head=cap.navy`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    assert(!(await page.getByText("Что-то пошло не так").count()), "whole page replaced by the error boundary («500 Что-то пошло не так») after one model failed to download");
    await waitAttr(wearBtn(page, "anorak"), "aria-pressed", "true");
  }, { shot: true });
  await ctx.close();
}
