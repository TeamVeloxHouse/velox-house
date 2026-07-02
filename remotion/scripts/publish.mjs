// Copy the optimized hero video + poster into the marketing site's public/ folder.
import { copyFileSync, existsSync } from "node:fs";

const jobs = [
  ["out/velox-hero.mp4", "../public/velox-hero.mp4"],
  ["out/velox-hero-poster.jpg", "../public/velox-hero-poster.jpg"],
];

for (const [src, dest] of jobs) {
  if (!existsSync(src)) {
    console.warn(`[publish] skip (missing): ${src}`);
    continue;
  }
  copyFileSync(src, dest);
  console.log(`[publish] ${src} -> ${dest}`);
}
console.log("[publish] done. Rebuild the site (npm run build) before deploying.");
