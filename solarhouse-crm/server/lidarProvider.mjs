/* Free roof heights from government LiDAR — lets the designer MEASURE each roof pane's pitch without Google.
 *
 * England: Environment Agency National LiDAR Programme composite DSM, 1 m (OGL, no key) via its public WCS.
 * Wales: Welsh Government LiDAR isn't served as raw heights over a public API (only rendered map images), so
 * Welsh addresses report { covered:false } and fall back to Google's height model when billing is on.
 * The EA grid is British National Grid (rotated ~1–2° from true north in the West); we resample it onto the same
 * true-north metric grid Google's DSM uses (centred on the point, row 0 = north), so lib/dsm.ts sampleHeight and
 * the roof-pane fitter use it unchanged. Point → BNG uses OSTN15, so heights line up with the outline. */
import { fromArrayBuffer } from 'geotiff'
import { projector } from './parcelProvider.mjs'

const EA = 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-surface-model-last-return-dsm-1m/wcs'
const COVERAGE = '9ba4d5ac-d596-445a-9056-dae3ddec0178__Lidar_Composite_Elevation_LZ_DSM_1m'
const cache = new Map()

export async function lidarDsm(lat, lng, radius = 30, res = 0.5) {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)},${radius},${res}`
  if (cache.has(key)) return cache.get(key)
  const toBng = projector()
  const [e, n] = toBng.forward([lng, lat])
  const pad = radius + 4
  const url = `${EA}?service=WCS&version=2.0.1&request=GetCoverage&CoverageId=${COVERAGE}&subset=E(${Math.floor(e - pad)},${Math.ceil(e + pad)})&subset=N(${Math.floor(n - pad)},${Math.ceil(n + pad)})&format=image/tiff`
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000)
  const r = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t))
  if (!r.ok || !/tiff/.test(r.headers.get('content-type') || '')) return { covered: false, reason: `EA LiDAR ${r.status}` }
  const img = await (await fromArrayBuffer(await r.arrayBuffer())).getImage()
  const W = img.getWidth(), H = img.getHeight(), [ox, oy] = img.getOrigin(), [rx, ry] = img.getResolution()
  const src = (await img.readRasters())[0]
  const valid = (v) => v > -100 && v < 2000
  let good = 0; for (let i = 0; i < src.length; i++) if (valid(src[i])) good++
  if (good < src.length * 0.3) return { covered: false, reason: 'No EA LiDAR here (outside England or a gap in coverage)' }
  // bilinear sample of the BNG grid at a BNG point
  const at = (E, N) => {
    const fx = (E - ox) / Math.abs(rx) - 0.5, fy = (oy - N) / Math.abs(ry) - 0.5 // north-up; EA reports the row resolution unsigned
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) return NaN
    const tx = fx - x0, ty = fy - y0, g = (c, rr) => src[rr * W + c]
    const v = [g(x0, y0), g(x0 + 1, y0), g(x0, y0 + 1), g(x0 + 1, y0 + 1)]
    if (!v.every(valid)) return NaN
    return v[0] * (1 - tx) * (1 - ty) + v[1] * tx * (1 - ty) + v[2] * (1 - tx) * ty + v[3] * tx * ty
  }
  // resample onto a true-north metric grid centred on (lat, lng)
  const size = Math.round((2 * radius) / res), half = (size * res) / 2
  const mLat = 110540, mLng = 111320 * Math.cos((lat * Math.PI) / 180)
  const heights = new Array(size * size)
  let minH = Infinity, maxH = -Infinity
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const east = (col + 0.5) * res - half, north = half - (row + 0.5) * res
    const [E, N] = toBng.forward([lng + east / mLng, lat + north / mLat])
    const h = at(E, N)
    heights[row * size + col] = Number.isFinite(h) ? Math.round(h * 100) / 100 : -9999
    if (Number.isFinite(h)) { if (h < minH) minH = h; if (h > maxH) maxH = h }
  }
  const out = { covered: true, source: 'EA LiDAR composite DSM 1 m', width: size, height: size, resM: res, heights, minH, maxH }
  if (cache.size > 200) cache.delete(cache.keys().next().value)
  cache.set(key, out)
  return out
}
