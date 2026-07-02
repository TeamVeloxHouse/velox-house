# Velox House — Remotion hero video

The animated product showcase in the marketing-site hero (`src/components/sections/HeroVideo.tsx`).
A 12s / 1920×1080 / 30fps clip: **brand intro → tagline → live product dashboard**, in the
Velox House brand (near-black `#0A0A0A`, crimson `#DA291C`, Sora + Inter).

## Structure

- `src/Root.tsx` — the `VeloxHero` composition (dimensions, fps, duration)
- `src/VeloxHero.tsx` — sequences the three scenes
- `src/components/BrandMark.tsx` — the animated `V.` app mark (mirrors `public/favicon.svg`)
- `src/components/Dashboard.tsx` — the animated product dashboard (counting KPIs, growing chart, live reply)
- `src/components/Background.tsx` — dot-grid + crimson-glow backdrop
- `src/theme.ts` / `src/fonts.ts` — brand tokens + Google-fonts loading

## Preview & edit

```bash
npm install        # runs the ARM64 render patch automatically (postinstall)
npm run setup:arm64  # ONE-OFF after install on Windows/ARM64 — see note below
npm run studio     # opens Remotion Studio to preview/scrub/edit
```

## Render

```bash
npm run render        # -> out/velox-hero.mp4  (H.264, CRF 18)
npm run render:webm   # -> out/velox-hero.webm (VP8)
npm run still         # -> out/still.png
```

Then publish to the site (served from the marketing site's `public/`):

```bash
cp out/velox-hero.mp4 out/velox-hero.webm ../public/
# poster: npx remotion still VeloxHero ../public/velox-hero-poster.jpg --frame=320 --image-format=jpeg
```

## ⚠️ Windows-on-ARM64 note

This machine is Windows/ARM64, which Remotion doesn't ship prebuilt render binaries for.
Two automated workarounds make rendering work; both are safe and reproducible:

1. **`scripts/patch-headless.mjs`** (runs on `postinstall`) — renders via the installed
   **Microsoft Edge** instead of the (unavailable) bundled Chrome Headless Shell. It forces
   `--headless=new` (Edge 149 dropped `--headless=old`) and adds a `DevToolsActivePort`
   fallback so Remotion survives Edge re-exec'ing its launcher process. The Edge path is set
   in `remotion.config.ts`.
2. **`scripts/setup-arm64.mjs`** (`npm run setup:arm64`) — installs the **x64 Rust compositor**
   (`@remotion/compositor-win32-x64-msvc`), which runs under x64 emulation. Run it once after
   each `npm install`. Do **not** `npm i --cpu=x64 --os=win32` directly — that strips the native
   arm64 `@rspack` binding and breaks bundling.

On a normal x64/ARM-mac machine none of this is needed; the patches simply no-op.
