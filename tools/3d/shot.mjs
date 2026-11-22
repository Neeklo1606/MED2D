// Скриншот просмотрщика: node tools/3d/shot.mjs "<query>" out.png [width] [height]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
const [q, out, w = "1200", h = "760"] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
p.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(`http://127.0.0.1:${process.env.VPORT || 8765}/?${q}`);
await p.waitForFunction(() => document.title === "ready", null, { timeout: 120000 });
await p.screenshot({ path: out, omitBackground: true });
await b.close();
