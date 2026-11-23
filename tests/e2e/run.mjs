#!/usr/bin/env node
// MEDFORM critical e2e suite.
//   node tests/e2e/run.mjs <baseUrl> [--only=health,configurator,resilience,pages,overflow] [--viewports=375,1440]
//                                    [--readonly | --allow-submit] [--out=artifacts/qa/<name>]
// Non-local targets are read-only by default (no order submission). Exit code 1 on any failure.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { CHROMIUM_ARGS, loadPlaywright, Results, VIEWPORTS } from "./lib.mjs";
import { runConfigurator, runGlbFailure } from "./configurator.mjs";
import { runHealth, runOverflow, runPages } from "./pages.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name) => flag(name)?.split("=").slice(1).join("=");
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3400").replace(/\/$/, "");
const host = new URL(base).hostname;
const local = ["localhost", "127.0.0.1", "0.0.0.0"].includes(host);
const readonly = flag("readonly") ? true : flag("allow-submit") ? false : !local;
const only = value("only")?.split(",") ?? ["health", "configurator", "resilience", "pages", "overflow"];
const vps = (value("viewports")?.split(",") ?? ["375", "1440"]).map((l) => Object.entries(VIEWPORTS).find(([, v]) => v.label === l)).filter(Boolean);
const outDir = path.resolve(value("out") ?? path.join("artifacts", "qa", local ? `local-${new URL(base).port || 80}` : host));

const { chromium, request: pwRequest } = loadPlaywright();
const results = new Results(outDir);
const t0 = Date.now();
console.log(`MEDFORM e2e -> ${base} (${readonly ? "read-only" : "may submit orders"}), artifacts: ${path.relative(process.cwd(), outDir)}`);

const request = await pwRequest.newContext();
try {
  await request.get(`${base}/api/health`, { timeout: 15000 });
} catch (e) {
  console.error(`Target ${base} is not reachable: ${e.message.split("\n")[0]}`);
  process.exit(2);
}
const browser = await chromium.launch({ args: CHROMIUM_ARGS, headless: !flag("headed") });
let db = "unknown";
try {
  if (only.includes("health")) {
    const info = await runHealth({ base, results, request });
    db = info?.database ?? "unknown";
  } else {
    db = (await (await request.get(`${base}/api/health`)).json().catch(() => ({}))).database ?? "unknown";
  }
  console.log(`database: ${db}`);
  for (const [vpKey, vpDef] of vps) {
    if (only.includes("configurator")) await runConfigurator({ browser, base, vpKey, vpDef, results, db, readonly });
    if (only.includes("resilience")) await runGlbFailure({ browser, base, vpDef, results });
    if (only.includes("pages")) await runPages({ browser, base, vpDef, results });
  }
  if (only.includes("overflow")) await runOverflow({ browser, base, results });
} catch (e) {
  results.add({ vp: "-", group: "runner", name: "crashed", status: "fail", ms: 0, error: String(e?.stack ?? e).slice(0, 500) });
} finally {
  await request.dispose().catch(() => {});
  await browser.close().catch(() => {});
}

/* ---------- report ---------- */
const rows = results.rows;
const w = { vp: 5, group: 13, name: Math.min(60, Math.max(...rows.map((r) => r.name.length), 4)) };
const line = (a, b, c, d) => `${a.padEnd(w.vp)} | ${b.padEnd(w.group)} | ${c.slice(0, w.name).padEnd(w.name)} | ${d}`;
console.log(`\n${line("vp", "group", "check", "result")}`);
console.log("-".repeat(w.vp + w.group + w.name + 20));
for (const r of rows) console.log(line(r.vp, r.group, r.name, r.status.toUpperCase()));
const fail = rows.filter((r) => r.status === "fail");
const pass = rows.filter((r) => r.status === "pass").length;
const skip = rows.filter((r) => r.status === "skip").length;
if (fail.length) {
  console.log("\nFailures:");
  for (const r of fail) console.log(`- [${r.vp}] ${r.group} / ${r.name}: ${r.error}${r.screenshot ? `\n    screenshot: ${path.relative(process.cwd(), r.screenshot)}` : ""}`);
}
const uniqWarn = [...new Set(results.warnings ?? [])];
if (uniqWarn.length) console.log(`\nConsole warnings (not failing, ${uniqWarn.length}):\n${uniqWarn.slice(0, 15).map((x) => `- ${x}`).join("\n")}`);
console.log(`\n${pass} passed, ${fail.length} failed, ${skip} skipped in ${Math.round((Date.now() - t0) / 1000)} s`);
writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ base, readonly, db, at: new Date().toISOString(), rows, warnings: uniqWarn }, null, 2));
process.exit(fail.length ? 1 : 0);
