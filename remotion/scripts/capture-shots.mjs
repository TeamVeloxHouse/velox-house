// Capture real product screenshots from the running velox-house-app (port 3002,
// VITE_BYPASS_AUTH=true so mock data renders). Output: remotion/public/shots/*.png at 2x.
//
// Edge's launcher re-execs and the initial process exits, which breaks puppeteer.launch()
// (and remotion — see patch-headless.mjs). So we launch Edge ourselves on a fixed
// remote-debugging port, wait for it, then puppeteer.connect() to it (no launch race).
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:3002";
const PORT = 9222;
const OUT = "public/shots";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["dashboard", "/dashboard"],
  ["find-leads", "/find-leads"],
  ["compose", "/compose"],
  ["sequences", "/sequences"],
  ["pipeline", "/pipeline"],
  ["inbox", "/inbox"],
  ["analytics", "/analytics"],
  ["contacts", "/contacts"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const udd = join(tmpdir(), "velox-capture-udd");
rmSync(udd, { recursive: true, force: true });

const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${udd}`,
    "about:blank",
  ],
  { detached: true, stdio: "ignore" }
);
edge.unref();

// Wait for the debugging endpoint.
let version = null;
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) { version = await r.json(); break; }
  } catch {}
  await sleep(500);
}
if (!version) throw new Error("Edge debugging endpoint never came up");
console.log("[capture] connected to", version.Browser);

const browser = await puppeteer.connect({
  browserWSEndpoint: version.webSocketDebuggerUrl,
  defaultViewport: { width: 1512, height: 950, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 2 });

// Seed cookie-consent so the banner never shows.
await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  try { localStorage.setItem("velox:cookie-consent", "essential"); } catch {}
});

for (const [name, path] of ROUTES) {
  await page.goto(BASE + path, { waitUntil: "networkidle2" });
  await sleep(2500);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`[capture] ${name} ✓`);
}

await browser.disconnect();
try { process.kill(-edge.pid); } catch {}
console.log("[capture] done.");
process.exit(0);
