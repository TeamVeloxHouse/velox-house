/* Showroom mockup — a "solar on your roof" image for the proposal hero.
 *
 * Real part: a Google Street View photo of the actual house (via /api/street-view, server-side
 * key). Illustrated part: a stylised panel array drawn on top with a <canvas>, sized and coloured
 * from the real design (panel count, aspect). It is NOT a geometrically accurate render of the
 * roof — it's a tidy, attractive "here's roughly what it'll look like" image, same spirit as the
 * satellite RoofRender. Swap `drawPanelOverlay` for a real image-generation call (e.g. OpenAI
 * images) later without touching the call sites — they only care about the returned data URL.
 */
import type { LatLng } from './solar'
import type { SolarDesign } from './solar'

export type MockupResult = { dataUrl: string; source: 'streetview' | 'illustrated' }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

const W = 960, H = 600

function drawSkyHouse(ctx: CanvasRenderingContext2D) {
  // Illustrated fallback when no Street View imagery is available for the address.
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6)
  sky.addColorStop(0, '#bcd9f0'); sky.addColorStop(1, '#e8f1f7')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.62)
  ctx.fillStyle = '#dce7d8'; ctx.fillRect(0, H * 0.6, W, H * 0.4)
  // simple house silhouette, centred
  const bx = W * 0.28, by = H * 0.62, bw = W * 0.44, bh = H * 0.22
  ctx.fillStyle = '#eef1f0'; ctx.fillRect(bx, by, bw, bh)
  ctx.beginPath(); ctx.moveTo(bx - 18, by); ctx.lineTo(bx + bw / 2, by - bh * 0.62); ctx.lineTo(bx + bw + 18, by); ctx.closePath()
  ctx.fillStyle = '#8a9aa8'; ctx.fill()
  return { roof: { x0: bx - 18, y0: by - bh * 0.62, x1: bx + bw + 18, y1: by, apex: bx + bw / 2 } }
}

function drawPanelOverlay(ctx: CanvasRenderingContext2D, roof: { x0: number; y0: number; x1: number; y1: number; apex: number }, panels: number) {
  // Two pitched faces meeting at the apex, panels packed in a grid on each, in perspective.
  const cols = Math.max(3, Math.min(10, Math.round(Math.sqrt(panels * 1.6))))
  const perSide = Math.ceil(panels / 2)
  const rows = Math.max(1, Math.ceil(perSide / cols))
  const sides: [number, number, number][] = [
    [roof.x0, roof.apex, -1],
    [roof.apex, roof.x1, 1],
  ]
  let remaining = panels
  for (const [sx0, sx1, _dir] of sides) {
    if (remaining <= 0) break
    const pad = (sx1 - sx0) * 0.08
    const gx0 = sx0 + pad, gx1 = sx1 - pad
    const gy0 = roof.y0 + (roof.y1 - roof.y0) * 0.18, gy1 = roof.y1 - (roof.y1 - roof.y0) * 0.06
    const cw = (gx1 - gx0) / cols, ch = (gy1 - gy0) / rows
    let placed = 0
    for (let r = 0; r < rows && remaining > 0; r++) {
      for (let c = 0; c < cols && remaining > 0; c++) {
        const px = gx0 + c * cw + cw * 0.06, py = gy0 + r * ch + ch * 0.06
        const pw = cw * 0.88, ph = ch * 0.82
        const g = ctx.createLinearGradient(px, py, px + pw, py + ph)
        g.addColorStop(0, '#1c2e4a'); g.addColorStop(1, '#0d1a2e')
        ctx.fillStyle = g
        ctx.fillRect(px, py, pw, ph)
        ctx.strokeStyle = 'rgba(148,180,255,0.35)'; ctx.lineWidth = 1
        ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2)
        remaining--; placed++
      }
    }
  }
}

/** Geocodes a free-text address via /api/geocode (server-side key), for callers — like the
 *  Showroom — that only have an address string, not a lat/lng center. Returns null on failure
 *  (no key, or the address didn't resolve), so the caller can fall back to the illustrated house. */
async function geocodeAddress(address: string): Promise<LatLng | null> {
  try {
    const r = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) })
    const j = await r.json()
    if (typeof j.lat === 'number' && typeof j.lng === 'number') return { lat: j.lat, lng: j.lng }
  } catch { /* fall through to illustrated */ }
  return null
}

export function streetViewSrc(center: LatLng, heading?: number, size = '960x600') {
  const h = heading !== undefined ? `&heading=${Math.round(heading)}` : ''
  return `/api/street-view?lat=${center.lat}&lng=${center.lng}&size=${size}${h}`
}

/** Builds the showroom mockup: real street photo (or an illustrated fallback) + a stylised
 *  panel-count overlay from the actual design. Returns a JPEG data URL. */
async function generateMockupAt(center: LatLng | null, panels: number, heading?: number): Promise<MockupResult> {
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  let source: MockupResult['source'] = 'illustrated'
  let roof: { x0: number; y0: number; x1: number; y1: number; apex: number }

  if (center) {
    try {
      const img = await loadImage(streetViewSrc(center, heading))
      ctx.drawImage(img, 0, 0, W, H)
      source = 'streetview'
      // Photos vary — assume the house roofline sits in the upper-middle third, a reasonable
      // default for a "front of house at the pavement" Street View framing.
      roof = { x0: W * 0.22, y0: H * 0.16, x1: W * 0.78, y1: H * 0.42, apex: W * 0.5 }
      // soft vignette so the panel overlay reads clearly against varied photos
      const vg = ctx.createRadialGradient(W / 2, H * 0.3, H * 0.15, W / 2, H * 0.3, H * 0.6)
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.18)')
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
    } catch {
      roof = drawSkyHouse(ctx).roof
    }
  } else {
    roof = drawSkyHouse(ctx).roof
  }

  drawPanelOverlay(ctx, roof, panels)

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), source }
}

export async function generateMockup(design: SolarDesign, heading?: number): Promise<MockupResult> {
  return generateMockupAt(design.center ?? null, design.panels, heading)
}

/** Same mockup, but starting from a free-text address (geocoded server-side) rather than a
 *  design's known lat/lng — for callers like the Showroom that only collect an address. */
export async function generateMockupForAddress(address: string, panels: number, heading?: number): Promise<MockupResult> {
  const center = await geocodeAddress(address)
  return generateMockupAt(center, panels, heading)
}
