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
    const [dsmR, fluxR] = await Promise.all([
      fetch(`/api/solar-layer?kind=dsm&${q}`),
      fetch(`/api/solar-layer?kind=flux&${q}`).catch(() => null),
    ])
    if (!dsmR.ok) return null
    const dsm = await readBand(await dsmR.arrayBuffer())
    let minH = Infinity, maxH = -Infinity
    for (let i = 0; i < dsm.data.length; i++) { const v = dsm.data[i]; if (v > -500 && v < 10000) { if (v < minH) minH = v; if (v > maxH) maxH = v } }
    const out: DsmData = { width: dsm.w, height: dsm.h, resM: dsm.res, heights: dsm.data, minH, maxH }
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
