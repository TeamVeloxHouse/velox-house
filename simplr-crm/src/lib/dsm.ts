/* Google Solar API Data Layers → a real roof heightfield (DSM) + annual irradiance (flux), parsed
 * client-side from the GeoTIFFs our /api/solar-layer proxy streams. The DSM comes in a metric UTM
 * grid (0.25 m/px), so it drops straight into the 3D scene as a true-shape roof mesh, and the flux
 * layer paints the shading/irradiance heatmap. */
import { fromArrayBuffer } from 'geotiff'

export type DsmData = {
  width: number
  height: number
  resM: number // metres per pixel
  heights: Float32Array // row-major absolute elevations (m); row 0 = north edge
  minH: number // lowest valid elevation (ground datum)
  maxH: number
  flux?: Float32Array // annual irradiance (kWh/kW/yr), same grid, if available
  fluxMin?: number
  fluxMax?: number
  mask?: Float32Array // building mask (>0 = the analysed building), same grid — used to flatten trees/ground
}

const NODATA = -9999

async function readBand(buf: ArrayBuffer): Promise<{ w: number; h: number; res: number; data: Float32Array }> {
  const img = await (await fromArrayBuffer(buf)).getImage()
  const data = (await img.readRasters())[0] as Float32Array
  return { w: img.getWidth(), h: img.getHeight(), res: Math.abs(img.getResolution()[0]), data }
}

/** Fetch + parse the DSM (and flux) for a point. Returns null if the proxy/key has no data here. */
export async function fetchDsm(lat: number, lng: number, radius = 40, px = 0.25): Promise<DsmData | null> {
  try {
    const q = `lat=${lat}&lng=${lng}&radius=${radius}&px=${px}`
    const [dsmR, fluxR, maskR] = await Promise.all([
      fetch(`/api/solar-layer?kind=dsm&${q}`),
      fetch(`/api/solar-layer?kind=flux&${q}`).catch(() => null),
      fetch(`/api/solar-layer?kind=mask&${q}`).catch(() => null),
    ])
    if (!dsmR.ok) return null
    const dsm = await readBand(await dsmR.arrayBuffer())
    let minH = Infinity, maxH = -Infinity
    for (let i = 0; i < dsm.data.length; i++) { const v = dsm.data[i]; if (v > -500 && v < 10000) { if (v < minH) minH = v; if (v > maxH) maxH = v } }
    const out: DsmData = { width: dsm.w, height: dsm.h, resM: dsm.res, heights: dsm.data, minH, maxH }
    if (maskR && maskR.ok) {
      try {
        const m = await readBand(await maskR.arrayBuffer())
        if (m.w === dsm.w && m.h === dsm.h) {
          out.mask = m.data
          // Base maxH on the building only, so tall trees don't skew the camera height.
          let bMax = -Infinity
          for (let i = 0; i < dsm.data.length; i++) { if (m.data[i] > 0.5) { const v = dsm.data[i]; if (v > -500 && v < 10000 && v > bMax) bMax = v } }
          if (bMax > minH) out.maxH = bMax
        }
      } catch { /* mask optional */ }
    }
    if (fluxR && fluxR.ok) {
      try {
        const flux = await readBand(await fluxR.arrayBuffer())
        if (flux.w === dsm.w && flux.h === dsm.h) {
          let fmin = Infinity, fmax = -Infinity
          for (let i = 0; i < flux.data.length; i++) { const v = flux.data[i]; if (v >= 0 && v < 5000) { if (v < fmin) fmin = v; if (v > fmax) fmax = v } }
          out.flux = flux.data; out.fluxMin = fmin; out.fluxMax = fmax
        }
      } catch { /* flux optional */ }
    }
    return out
  } catch { return null }
}

/** Fetch the RGB aerial data-layer (same grid as the DSM) as a canvas, to drape on the roof mesh. */
export async function fetchRgbCanvas(lat: number, lng: number, radius = 40, px = 0.25): Promise<HTMLCanvasElement | null> {
  try {
    const r = await fetch(`/api/solar-layer?kind=rgb&lat=${lat}&lng=${lng}&radius=${radius}&px=${px}`)
    if (!r.ok) return null
    const img = await (await fromArrayBuffer(await r.arrayBuffer())).getImage()
    const w = img.getWidth(), h = img.getHeight()
    const bands = await img.readRasters() as unknown as number[][]
    const [R, G, B] = [bands[0], bands[1] ?? bands[0], bands[2] ?? bands[0]]
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); if (!ctx) return null
    const id = ctx.createImageData(w, h)
    for (let i = 0; i < w * h; i++) { id.data[i * 4] = R[i]; id.data[i * 4 + 1] = G[i]; id.data[i * 4 + 2] = B[i]; id.data[i * 4 + 3] = 255 }
    ctx.putImageData(id, 0, 0)
    return canvas
  } catch { return null }
}

/** Bilinear height (relative to ground datum) at an east/north offset from the DSM centre, in metres.
 *  east = +metres east of centre, north = +metres north of centre. Returns 0 outside the grid. */
export function sampleHeight(dsm: DsmData, east: number, north: number): number {
  const halfW = (dsm.width * dsm.resM) / 2, halfH = (dsm.height * dsm.resM) / 2
  const fx = (east + halfW) / dsm.resM - 0.5 // column (fractional)
  const fy = (halfH - north) / dsm.resM - 0.5 // row (fractional), row 0 = north
  const x0 = Math.floor(fx), y0 = Math.floor(fy)
  if (x0 < 0 || y0 < 0 || x0 >= dsm.width - 1 || y0 >= dsm.height - 1) return 0
  const tx = fx - x0, ty = fy - y0
  const at = (c: number, r: number) => { const v = dsm.heights[r * dsm.width + c]; return v > -500 && v < 10000 ? v : dsm.minH }
  const h = at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty) + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty
  return h - dsm.minH
}

type PXY = [number, number]
/** Douglas–Peucker simplify (pixel space). */
function dpSimplify(pts: PXY[], tol: number): PXY[] {
  if (pts.length < 3) return pts
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true
  const perp = (p: PXY, a: PXY, b: PXY) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l }
  const stack: PXY[] = [[0, pts.length - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()!
    let md = 0, mi = -1
    for (let k = i + 1; k < j; k++) { const d = perp(pts[k], pts[i], pts[j]); if (d > md) { md = d; mi = k } }
    if (md > tol && mi > 0) { keep[mi] = true; stack.push([i, mi], [mi, j]) }
  }
  return pts.filter((_, i) => keep[i])
}

/** Trace the building outline from Google's mask (reliable, no Overpass) — a simplified lat/lng
 *  polygon centred on (lat,lng). Used to clip Google's roof boxes to the true building shape. */
export async function fetchBuildingOutline(lat: number, lng: number, radius = 40, px = 0.25): Promise<{ lat: number; lng: number }[] | null> {
  try {
    const r = await fetch(`/api/solar-layer?kind=mask&lat=${lat}&lng=${lng}&radius=${radius}&px=${px}`)
    if (!r.ok) return null
    const img = await (await fromArrayBuffer(await r.arrayBuffer())).getImage()
    const W = img.getWidth(), H = img.getHeight(), res = Math.abs(img.getResolution()[0])
    const raw = (await img.readRasters())[0] as Float32Array
    const bin = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) bin[i] = raw[i] > 0.5 ? 1 : 0
    // largest connected component (4-connected)
    const label = new Int32Array(W * H).fill(-1)
    let best = -1, bestSize = 0, cur = 0
    const stack: number[] = []
    for (let s = 0; s < W * H; s++) {
      if (!bin[s] || label[s] >= 0) continue
      let size = 0; stack.length = 0; stack.push(s); label[s] = cur
      while (stack.length) {
        const p = stack.pop()!; size++; const x = p % W, y = (p / W) | 0
        const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]
        for (const q of nb) if (q >= 0 && bin[q] && label[q] < 0) { label[q] = cur; stack.push(q) }
      }
      if (size > bestSize) { bestSize = size; best = cur }
      cur++
    }
    if (best < 0 || bestSize < 24) return null
    const inComp = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === best
    // Moore boundary trace (clockwise)
    let sx = -1, sy = -1
    for (let y = 0; y < H && sy < 0; y++) for (let x = 0; x < W; x++) if (inComp(x, y)) { sx = x; sy = y; break }
    if (sx < 0) return null
    const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
    const boundary: PXY[] = []
    let cx = sx, cy = sy, dir = 6, guard = 0
    do {
      boundary.push([cx, cy])
      let found = false
      for (let k = 0; k < 8; k++) { const d = (dir + k) % 8, nx = cx + dirs[d][0], ny = cy + dirs[d][1]; if (inComp(nx, ny)) { cx = nx; cy = ny; dir = (d + 5) % 8; found = true; break } }
      if (!found) break
    } while ((cx !== sx || cy !== sy) && ++guard < W * H)
    if (boundary.length < 6) return null
    const simplified = dpSimplify(boundary, 1.4)
    if (simplified.length < 4) return null
    const halfW = (W * res) / 2, halfH = (H * res) / 2, mLat = 110540, mLng = 111320 * Math.cos((lat * Math.PI) / 180)
    return simplified.map(([c, rr]) => { const east = (c + 0.5) * res - halfW, north = halfH - (rr + 0.5) * res; return { lat: lat + north / mLat, lng: lng + east / mLng } })
  } catch { return null }
}

/** A blue→green→yellow→red irradiance ramp (0..1) for the flux heatmap. */
export function fluxColor(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t))
  // 0 blue, .35 cyan/green, .65 yellow, 1 red
  const stops: [number, number[]][] = [[0, [30, 60, 200]], [0.35, [30, 190, 160]], [0.6, [230, 220, 60]], [0.8, [240, 150, 40]], [1, [220, 50, 40]]]
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [a0, ca] = stops[i - 1], [a1, cb] = stops[i]
      const k = (c - a0) / (a1 - a0)
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k].map((v) => v / 255) as [number, number, number]
    }
  }
  return [220 / 255, 50 / 255, 40 / 255]
}
