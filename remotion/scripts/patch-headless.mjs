// ─────────────────────────────────────────────────────────────────────────────
// Windows-on-ARM64 Remotion render patch.
//
// This machine is Windows on ARM64. Remotion has no bundled Chrome Headless Shell
// for that arch, so we render with the locally installed Microsoft Edge (see
// remotion.config.ts). Two Edge-specific problems have to be patched in the
// installed @remotion/renderer for rendering to work:
//
//   1. Edge 149+ dropped the legacy `--headless=old` mode Remotion passes by
//      default; it makes the browser exit instantly. Force `--headless=new`.
//
//   2. Edge's launcher re-execs the real browser into a versioned/EdgeCore path,
//      so the exact process Remotion spawned exits (code 0) and the
//      "DevTools listening on ws://…" line never reaches its stderr. Remotion then
//      reports "Failed to launch the browser process! Closed with 0 signal".
//      The re-exec'd child DOES honour our --remote-debugging-port + --user-data-dir
//      and writes a `DevToolsActivePort` file into the user-data-dir. So when the
//      spawned process closes without yielding an endpoint, fall back to polling
//      that file and build the ws endpoint from it.
//
// Runs on postinstall so it survives `npm install`. Idempotent.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const edit = (file, fn) => {
  if (!existsSync(file)) return;
  const before = readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`[patch-remotion] patched ${file}`);
  }
};

// (1) --headless=old -> --headless=new
for (const f of [
  "node_modules/@remotion/renderer/dist/open-browser.js",
  "node_modules/@remotion/renderer/dist/esm/index.mjs",
]) {
  edit(f, (s) =>
    s.replaceAll("'--headless=old'", "'--headless=new'").replaceAll('"--headless=old"', '"--headless=new"')
  );
}

// (3) Rust compositor has no win32-arm64 build — fall back to the x64 binary,
// which runs fine under Windows-on-ARM x64 emulation. (The x64 package is
// force-installed via `npm run setup:arm64`; see README.)
edit("node_modules/@remotion/renderer/dist/compositor/get-executable-path.js", (s) =>
  s.includes("case 'arm64':\n                    return require('@remotion/compositor-win32-x64-msvc')")
    ? s
    : s.replace(
        `                default:
                    throw new Error(\`Unsupported architecture on Windows: \${process.arch}\`);`,
        `                case 'arm64':
                    return require('@remotion/compositor-win32-x64-msvc').dir;
                default:
                    throw new Error(\`Unsupported architecture on Windows: \${process.arch}\`);`
      )
);

// (2) DevToolsActivePort fallback in BrowserRunner
const helper = `function __waitForDevToolsActivePort(userDataDir, timeoutMs) {
    return new Promise((resolveEp) => {
        if (!userDataDir) return resolveEp(null);
        const __fs = require('fs');
        const __path = require('path');
        const file = __path.join(userDataDir, 'DevToolsActivePort');
        const started = Date.now();
        const tick = () => {
            try {
                const raw = __fs.readFileSync(file, 'utf8').trim().split('\\n');
                const port = parseInt(raw[0], 10);
                const wsPath = (raw[1] || '').trim();
                if (port && wsPath) return resolveEp('ws://127.0.0.1:' + port + wsPath);
            } catch (e) {}
            if (Date.now() - started > timeoutMs) return resolveEp(null);
            setTimeout(tick, 150);
        };
        tick();
    });
}
`;

edit("node_modules/@remotion/renderer/dist/browser/BrowserRunner.js", (s) => {
  if (s.includes("__waitForDevToolsActivePort")) return s; // already patched

  // B1: pass userDataDir into waitForWSEndpoint(...)
  s = s.replace(
    `const browserWSEndpoint = await waitForWSEndpoint({
        browserProcess: proc,
        timeout,
        indent,
        logLevel,
    });`,
    `const browserWSEndpoint = await waitForWSEndpoint({
        browserProcess: proc,
        timeout,
        indent,
        logLevel,
        userDataDir,
    });`
  );

  // B2: accept userDataDir in the function signature + inject the helper before it
  s = s.replace(
    `function waitForWSEndpoint({ browserProcess, timeout, logLevel, indent, }) {`,
    `${helper}function waitForWSEndpoint({ browserProcess, timeout, logLevel, indent, userDataDir, }) {`
  );

  // B3: on close, try the DevToolsActivePort file before rejecting
  s = s.replace(
    `        function onClose(error) {
            cleanup();
            reject(new Error([`,
    `        function onClose(error) {
            __waitForDevToolsActivePort(userDataDir, 8000).then((ep) => {
                if (ep) { cleanup(); return resolve(ep); }
                cleanup();
                reject(new Error([`
  );
  // close the added .then() callback + promise chain right after the reject(...) statement
  s = s.replace(
    `                .filter(truthy_1.truthy)
                .join('\\n')));
        }`,
    `                .filter(truthy_1.truthy)
                .join('\\n')));
            });
        }`
  );

  return s;
});

console.log("[patch-remotion] done.");
