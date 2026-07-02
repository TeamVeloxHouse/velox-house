// Compress the raw Remotion render into a web-ready hero MP4:
//   • H.264 CRF 25 (text-heavy screenshots stay readable, ~3MB for 25s @1080p)
//   • +faststart so the browser can start playing before the whole file loads
//   • no audio track
// Remotion's raw output is ~10MB with metadata at the end — unusable for autoplay.
// Uses the x64 ffmpeg bundled with the compositor (works under ARM64 emulation).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const FF = "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe";
const SRC = "out/velox-hero-raw.mp4";
const DEST = "out/velox-hero.mp4";

if (!existsSync(SRC)) throw new Error(`Missing ${SRC} — run \`npm run render\` first.`);

execFileSync(FF, [
  "-hide_banner", "-y", "-i", SRC,
  "-c:v", "libx264", "-crf", "25", "-preset", "slow",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
  DEST,
], { stdio: "inherit" });

console.log(`[optimize] wrote ${DEST}`);
