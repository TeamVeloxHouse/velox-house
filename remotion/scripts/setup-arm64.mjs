// Ensures the x64 Rust compositor binary is present so Remotion can RENDER on this
// Windows-on-ARM64 machine (it runs fine under x64 emulation). npm refuses to install
// @remotion/compositor-win32-x64-msvc here (EBADPLATFORM), and passing --cpu/--os
// globally poisons the tree (it strips the native arm64 @rspack binding). So we fetch
// the tarball with `npm pack` (no platform gate) and extract it straight into
// node_modules. Safe to run repeatedly. Run this once after every `npm install`.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VERSION = "4.0.484";
const PKG = "@remotion/compositor-win32-x64-msvc";
const dest = join("node_modules", "@remotion", "compositor-win32-x64-msvc");

if (existsSync(join(dest, "remotion.exe"))) {
  console.log("[setup-arm64] compositor already present — nothing to do.");
  process.exit(0);
}

const work = join(tmpdir(), "velox-remotion-compositor");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

console.log(`[setup-arm64] fetching ${PKG}@${VERSION} …`);
execSync(`npm pack ${PKG}@${VERSION}`, { cwd: work, stdio: "inherit" });
const tgz = readdirSync(work).find((f) => f.endsWith(".tgz"));
if (!tgz) throw new Error("[setup-arm64] npm pack produced no tarball");

execSync(`tar -xzf "${tgz}"`, { cwd: work, stdio: "inherit" });
mkdirSync(dest, { recursive: true });
cpSync(join(work, "package"), dest, { recursive: true });
rmSync(work, { recursive: true, force: true });

console.log(
  existsSync(join(dest, "remotion.exe"))
    ? "[setup-arm64] compositor installed ✓"
    : "[setup-arm64] FAILED — remotion.exe missing after extract"
);
