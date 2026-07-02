// Capture POPULATED states for compose (prospect selected) and find-leads (search run).
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:3002";
const PORT = 9223;
const OUT = "public/shots";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const udd = join(tmpdir(), "velox-capture-udd2");
rmSync(udd, { recursive: true, force: true });
const edge = spawn(EDGE, [
  "--headless=new", "--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${udd}`, "about:blank",
], { detached: true, stdio: "ignore" });
edge.unref();

let version = null;
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { version = await r.json(); break; } } catch {}
  await sleep(500);
}
if (!version) throw new Error("Edge endpoint never came up");

const browser = await puppeteer.connect({
  browserWSEndpoint: version.webSocketDebuggerUrl,
  defaultViewport: { width: 1512, height: 950, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 2 });
await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
await page.evaluate(() => { try { localStorage.setItem("velox:cookie-consent", "essential"); } catch {} });

// Click helper: click first element whose text contains `text`.
const clickByText = (text, tags = "button,a,div,li,span") =>
  page.evaluate((t, sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim().includes(t) && e.offsetParent !== null);
    if (el) { el.click(); return true; }
    return false;
  }, text, tags);

// ── compose: select first prospect ──
await page.goto(BASE + "/compose", { waitUntil: "networkidle2" });
await sleep(1500);
const composed = await clickByText("Sarah Donnelly");
console.log("compose: clicked prospect =", composed);
await sleep(2500);
await page.screenshot({ path: join(OUT, "compose.png") });
console.log("[capture] compose ✓");

// ── find-leads: fill industry + size, search ──
await page.goto(BASE + "/find-leads", { waitUntil: "networkidle2" });
await sleep(1500);
const industry = await page.$('input[placeholder*="recruitment"], input[placeholder*="SaaS"], input[type="text"]');
if (industry) { await industry.click(); await industry.type("Marketing agencies"); }
await clickByText("11-50");
await sleep(300);
await clickByText("Find leads");
await sleep(4000); // wait for any results
await page.screenshot({ path: join(OUT, "find-leads.png") });
console.log("[capture] find-leads ✓");

await browser.disconnect();
try { process.kill(-edge.pid); } catch {}
console.log("[capture] done.");
process.exit(0);
