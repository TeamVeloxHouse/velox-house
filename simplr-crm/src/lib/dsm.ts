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
export async function fetchDsm(lat: number, lng: number, radius = 35, px = 0.1): Promise<DsmData | null> {
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
export async function fetchRgbCanvas(lat: number, lng: number, radius = 35, px = 0.1): Promise<HTMLCanvasElement | null> {
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

export type RgbOverlay = { dataUrl: string; bounds: [[number, number], [number, number]] }
/** Fetch the RGB aerial as a georeferenced overlay for the 2D map — the same Google Solar high-res
 *  imagery we drape in 3D, returned as a PNG data-URL plus its true [[south,west],[north,east]] bounds
 *  (metric extent from the GeoTIFF's own resolution, centred on the query point). Null with no key/data. */
export async function fetchRgbOverlay(lat: number, lng: number, radius = 40, px = 0.1): Promise<RgbOverlay | null> {
  try {
    const r = await fetch(`/api/solar-layer?kind=rgb&lat=${lat}&lng=${lng}&radius=${radius}&px=${px}`)
    if (!r.ok) return null
    const img = await (await fromArrayBuffer(await r.arrayBuffer())).getImage()
    const w = img.getWidth(), h = img.getHeight(), res = Math.abs(img.getResolution()[0])
    const bands = await img.readRasters() as unknown as number[][]
    const [R, G, B] = [bands[0], bands[1] ?? bands[0], bands[2] ?? bands[0]]
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); if (!ctx) return null
    const id = ctx.createImageData(w, h)
    for (let i = 0; i < w * h; i++) { id.data[i * 4] = R[i]; id.data[i * 4 + 1] = G[i]; id.data[i * 4 + 2] = B[i]; id.data[i * 4 + 3] = 255 }
    ctx.putImageData(id, 0, 0)
    const halfW = (w * res) / 2, halfH = (h * res) / 2, mLat = 110540, mLng = 111320 * Math.cos((lat * Math.PI) / 180)
    return { dataUrl: canvas.toDataURL('image/png'), bounds: [[lat - halfH / mLat, lng - halfW / mLng], [lat + halfH / mLat, lng + halfW / mLng]] }
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

/** Moore boundary trace of a region (clockwise) → ordered pixel loop, or null. */
function mooreTrace(inRegion: (x: number, y: number) => boolean, W: number, H: number): PXY[] | null {
  let sx = -1, sy = -1
  for (let y = 0; y < H && sy < 0; y++) for (let x = 0; x < W; x++) if (inRegion(x, y)) { sx = x; sy = y; break }
  if (sx < 0) return null
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
  const boundary: PXY[] = []; let cx = sx, cy = sy, dir = 6, guard = 0
  do {
    boundary.push([cx, cy]); let found = false
    for (let k = 0; k < 8; k++) { const d = (dir + k) % 8, nx = cx + dirs[d][0], ny = cy + dirs[d][1]; if (inRegion(nx, ny)) { cx = nx; cy = ny; dir = (d + 5) % 8; found = true; break } }
    if (!found) break
  } while ((cx !== sx || cy !== sy) && ++guard < W * H)
  return boundary.length >= 4 ? boundary : null
}

export type RoofFacet = { polygon: { lat: number; lng: number }[]; pitchDeg: number; azimuthDeg: number; areaM2: number }

/** Segment a building's roof into true planar facets from the DSM itself — compute a normal per pixel,
 *  region-grow coplanar roof pixels, then fit + outline each facet. Gives one correctly-tilted plane
 *  per real roof face (gable side, hip, dormer) instead of Google's coarse boxes. */
export async function segmentRoofFacets(lat: number, lng: number, radius = 40, px = 0.25): Promise<RoofFacet[] | null> {
  try {
    const q = `lat=${lat}&lng=${lng}&radius=${radius}&px=${px}`
    const [dsmR, maskR] = await Promise.all([fetch(`/api/solar-layer?kind=dsm&${q}`), fetch(`/api/solar-layer?kind=mask&${q}`)])
    if (!dsmR.ok || !maskR.ok) return null
    const dsm = await readBand(await dsmR.arrayBuffer())
    const mk = await readBand(await maskR.arrayBuffer())
    if (mk.w !== dsm.w || mk.h !== dsm.h) return null
    const W = dsm.w, H = dsm.h, res = dsm.res
    // smooth heights (3×3) to tame normal noise
    const hs = new Float32Array(W * H)
    let minH = Infinity
    for (let i = 0; i < W * H; i++) { const v = dsm.data[i]; if (v > -500 && v < 10000 && v < minH) minH = v }
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      let s = 0, n = 0
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < H && cc >= 0 && cc < W) { const v = dsm.data[rr * W + cc]; if (v > -500 && v < 10000) { s += v; n++ } } }
      hs[r * W + c] = n ? s / n : minH
    }
    // Restrict to the TARGET building = the mask component containing the centre (the query point),
    // else we'd segment the whole terrace/neighbourhood that falls in the DSM window.
    const comp = new Int32Array(W * H).fill(-1)
    { let cur = 0; const st: number[] = []
      for (let s = 0; s < W * H; s++) {
        if (mk.data[s] <= 0.5 || comp[s] >= 0) continue
        st.length = 0; st.push(s); comp[s] = cur
        while (st.length) { const p = st.pop()!; const x = p % W, y = (p / W) | 0; const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]; for (const q of nb) if (q >= 0 && mk.data[q] > 0.5 && comp[q] < 0) { comp[q] = cur; st.push(q) } }
        cur++
      } }
    const cxp = (W / 2) | 0, cyp = (H / 2) | 0
    let target = -1, bd = Infinity
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const idx = y * W + x; if (mk.data[idx] > 0.5) { const dd = (x - cxp) ** 2 + (y - cyp) ** 2; if (dd < bd) { bd = dd; target = comp[idx] } } }
    if (target < 0) return null
    // per-pixel roof test + gradient (a = ∂h/∂east, b = ∂h/∂north); reject walls (near-vertical) & ground
    const isRoof = new Uint8Array(W * H), gA = new Float32Array(W * H), gB = new Float32Array(W * H), up = new Float32Array(W * H)
    for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
      const idx = r * W + c
      if (comp[idx] !== target || hs[idx] - minH < 1.0) continue
      const a = (hs[idx + 1] - hs[idx - 1]) / (2 * res) // east
      const b = (hs[(r - 1) * W + c] - hs[(r + 1) * W + c]) / (2 * res) // north (row 0 = north)
      const u = 1 / Math.sqrt(a * a + b * b + 1)
      if (u < 0.32) continue // slope > ~72° → wall/edge, not a roof face
      isRoof[idx] = 1; gA[idx] = a; gB[idx] = b; up[idx] = u
    }
    // region-grow coplanar facets by normal similarity (≈18°)
    const label = new Int32Array(W * H).fill(-1)
    const COS = Math.cos((18 * Math.PI) / 180)
    const facets: number[][] = []
    const queue: number[] = []
    for (let s = 0; s < W * H; s++) {
      if (!isRoof[s] || label[s] >= 0) continue
      const px0 = -gA[s] * up[s], py0 = up[s], pz0 = -gB[s] * up[s]
      let ax = px0, ay = py0, az = pz0 // running average normal (unnormalised sum)
      const pixels: number[] = []
      queue.length = 0; queue.push(s); label[s] = facets.length
      while (queue.length) {
        const p = queue.pop()!; pixels.push(p); const x = p % W, y = (p / W) | 0
        const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]
        // current average normal (normalised)
        const am = Math.hypot(ax, ay, az) || 1
        for (const nq of nb) {
          if (nq < 0 || !isRoof[nq] || label[nq] >= 0) continue
          const nx = -gA[nq] * up[nq], ny = up[nq], nz = -gB[nq] * up[nq]
          if ((nx * ax + ny * ay + nz * az) / am >= COS) { label[nq] = facets.length; ax += nx; ay += ny; az += nz; queue.push(nq) }
        }
      }
      if (pixels.length >= 24) facets.push(pixels)
      else pixels.forEach((p) => (label[p] = -1))
    }
    if (!facets.length) return null
    const halfW = (W * res) / 2, halfH = (H * res) / 2, mLat = 110540, mLng = 111320 * Math.cos((lat * Math.PI) / 180)
    const pxToLL = (c: number, r: number) => { const east = (c + 0.5) * res - halfW, north = halfH - (r + 0.5) * res; return { lat: lat + north / mLat, lng: lng + east / mLng } }
    const fitPixels = (pixels: number[]) => {
      let Sxx = 0, Sxz = 0, Sx = 0, Szz = 0, Sz = 0, Sxy = 0, Szy = 0, Sy = 0, n = 0
      for (const p of pixels) { const c = p % W, r = (p / W) | 0, e = (c + 0.5) * res - halfW, no = halfH - (r + 0.5) * res, h = hs[p]; n++; Sxx += e * e; Sxz += e * no; Sx += e; Szz += no * no; Sz += no; Sxy += e * h; Szy += no * h; Sy += h }
      return solve3v([[Sxx, Sxz, Sx], [Sxz, Szz, Sz], [Sx, Sz, n]], [Sxy, Szy, Sy])
    }
    // Merge adjacent, coplanar facets (one roof face split by DSM noise) via union-find on planes.
    const planes = facets.map(fitPixels)
    const parent = facets.map((_, i) => i)
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    for (let p = 0; p < W * H; p++) {
      const l = label[p]; if (l < 0) continue
      const x = p % W, y = (p / W) | 0
      for (const q of [x < W - 1 ? p + 1 : -1, y < H - 1 ? p + W : -1]) {
        if (q < 0) continue; const m = label[q]; if (m < 0 || find(m) === find(l)) continue
        const A = planes[l], B = planes[m]; if (!A || !B) continue
        if (Math.abs(A[0] - B[0]) < 0.16 && Math.abs(A[1] - B[1]) < 0.16 && Math.abs(A[2] - B[2]) < 1.2) parent[find(l)] = find(m)
      }
    }
    const groups = new Map<number, number[]>()
    for (let i = 0; i < facets.length; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); for (const p of facets[i]) groups.get(r)!.push(p) }
    const rlabel = new Int32Array(W * H).fill(-1)
    const gList: number[][] = []
    for (const [, pix] of groups) { const gi = gList.length; pix.forEach((p) => (rlabel[p] = gi)); gList.push(pix) }
    const out: RoofFacet[] = []
    gList.forEach((pixels, fid) => {
      const sol = fitPixels(pixels); if (!sol) return
      const [a, b] = sol
      const pitch = Math.round((Math.atan(Math.hypot(a, b)) * 180) / Math.PI)
      if (pitch > 55) return // walls / spurious steep faces
      const azimuth = Math.round(((Math.atan2(-a, -b) * 180) / Math.PI + 360) % 360) // down-slope = facing, from north
      const boundary = mooreTrace((x, y) => x >= 0 && y >= 0 && x < W && y < H && rlabel[y * W + x] === fid, W, H)
      if (!boundary) return
      const simp = dpSimplify(boundary, 1.3); if (simp.length < 3) return
      const polygon = simp.map(([c, r]) => pxToLL(c, r))
      const areaM2 = Math.round((pixels.length * res * res) / Math.max(0.2, Math.cos((pitch * Math.PI) / 180)))
      if (areaM2 >= 8) out.push({ polygon, pitchDeg: Math.max(0, Math.min(60, pitch)), azimuthDeg: azimuth, areaM2 })
    })
    return out.length ? out.sort((p, q) => q.areaM2 - p.areaM2) : null
  } catch { return null }
}
/* ── Auto-detect v2: Google-anchored roof segmentation ────────────────────────
 * The pure-DSM segmentation above rediscovers roof planes from noisy normals, which on lower-quality
 * imagery gives the wrong count, wobbly pitch/azimuth and ragged outlines. Google's buildingInsights
 * already reports each roof face's TRUE pitch and azimuth — so instead of guessing, we snap each DSM
 * roof pixel to the Google plane it best matches, split detached faces of the same orientation, and
 * regularize the traced outline into a crisp rectilinear polygon. Result: sharp, accurate faces. */

type MXY = { x: number; y: number } // metric east(+x)/north(+y) offset from the DSM centre

/** Snap a roof-facet outline to a crisp rectilinear polygon aligned to its own dominant axis — turns
 *  the DSM's ragged pixel trace into straight, parallel / right-angled edges. Only applied when the
 *  ring is already mostly rectilinear (≥70% of its perimeter within ~18° of the two axes) so hip and
 *  diagonal faces are left untouched. Returns the input unchanged when it can't confidently regularize. */
function regularizeRingMetric(pts: MXY[]): MXY[] {
  const n = pts.length
  if (n < 4) return pts
  // dominant axis U = direction of the longest edge; V is perpendicular
  let bx = 1, by = 0, bl = -1
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy); if (l > bl) { bl = l; bx = dx / (l || 1); by = dy / (l || 1) } }
  const U = { x: bx, y: by }, V = { x: -by, y: bx }
  let recti = 0, total = 0
  const edges = pts.map((a, i) => {
    const b = pts[(i + 1) % n]; const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy)
    const du = Math.abs(dx * U.x + dy * U.y), dv = Math.abs(dx * V.x + dy * V.y)
    const axis = du >= dv ? 0 : 1
    total += len; if ((axis === 0 ? du : dv) / (len || 1) > Math.cos((18 * Math.PI) / 180)) recti += len
    return { a, b, len, axis }
  })
  if (total <= 0 || recti / total < 0.7) return pts // hip / complex face — don't force it square
  // collapse runs of same-axis edges into one line; offset = length-weighted mean perpendicular coord
  type Ln = { axis: number; off: number; w: number }
  const merged: Ln[] = []
  for (const e of edges) {
    const off = e.axis === 0
      ? (e.a.x * V.x + e.a.y * V.y + e.b.x * V.x + e.b.y * V.y) / 2 // U-edge → fixed V coordinate
      : (e.a.x * U.x + e.a.y * U.y + e.b.x * U.x + e.b.y * U.y) / 2 // V-edge → fixed U coordinate
    const last = merged[merged.length - 1]
    if (last && last.axis === e.axis) { last.off = (last.off * last.w + off * e.len) / (last.w + e.len); last.w += e.len }
    else merged.push({ axis: e.axis, off, w: e.len })
  }
  if (merged.length > 1 && merged[0].axis === merged[merged.length - 1].axis) {
    const first = merged[0], last = merged.pop()!
    first.off = (first.off * first.w + last.off * last.w) / (first.w + last.w); first.w += last.w
  }
  if (merged.length < 4 || merged.length % 2 !== 0) return pts // must alternate U/V into a closed ring
  const out: MXY[] = []
  for (let i = 0; i < merged.length; i++) {
    const L1 = merged[(i - 1 + merged.length) % merged.length], L2 = merged[i]
    if (L1.axis === L2.axis) return pts
    const uOff = L1.axis === 1 ? L1.off : L2.off // the V-line's U coordinate
    const vOff = L1.axis === 0 ? L1.off : L2.off // the U-line's V coordinate
    out.push({ x: uOff * U.x + vOff * V.x, y: uOff * U.y + vOff * V.y })
  }
  return out
}

/** BEST auto-detect. Segment the roof using Google's true plane orientations as priors: each roof
 *  pixel is snapped to the Google plane whose normal it best matches, detached faces of the same
 *  orientation are split, and each face's outline is traced + regularized. Pitch/azimuth come from
 *  Google (reliable); the DSM only decides each face's shape. Falls back (null) if data is missing. */
export async function segmentRoofFacetsFromPriors(
  lat: number, lng: number,
  priors: { pitchDeg: number; azimuthDeg: number }[],
  radius = 40, px = 0.25,
): Promise<RoofFacet[] | null> {
  if (!priors?.length) return null
  try {
    const q = `lat=${lat}&lng=${lng}&radius=${radius}&px=${px}`
    const [dsmR, maskR] = await Promise.all([fetch(`/api/solar-layer?kind=dsm&${q}`), fetch(`/api/solar-layer?kind=mask&${q}`)])
    if (!dsmR.ok || !maskR.ok) return null
    const dsm = await readBand(await dsmR.arrayBuffer())
    const mk = await readBand(await maskR.arrayBuffer())
    if (mk.w !== dsm.w || mk.h !== dsm.h) return null
    const W = dsm.w, H = dsm.h, res = dsm.res
    // smooth heights (3×3) to tame normal noise
    const hs = new Float32Array(W * H); let minH = Infinity
    for (let i = 0; i < W * H; i++) { const v = dsm.data[i]; if (v > -500 && v < 10000 && v < minH) minH = v }
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      let s = 0, nn = 0
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < H && cc >= 0 && cc < W) { const v = dsm.data[rr * W + cc]; if (v > -500 && v < 10000) { s += v; nn++ } } }
      hs[r * W + c] = nn ? s / nn : minH
    }
    // restrict to the target building = the mask component containing the query centre
    const comp = new Int32Array(W * H).fill(-1)
    { let cur = 0; const st: number[] = []
      for (let s = 0; s < W * H; s++) {
        if (mk.data[s] <= 0.5 || comp[s] >= 0) continue
        st.length = 0; st.push(s); comp[s] = cur
        while (st.length) { const p = st.pop()!; const x = p % W, y = (p / W) | 0; const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]; for (const nq of nb) if (nq >= 0 && mk.data[nq] > 0.5 && comp[nq] < 0) { comp[nq] = cur; st.push(nq) } }
        cur++
      } }
    const cxp = (W / 2) | 0, cyp = (H / 2) | 0
    let target = -1, bd = Infinity
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const idx = y * W + x; if (mk.data[idx] > 0.5) { const dd = (x - cxp) ** 2 + (y - cyp) ** 2; if (dd < bd) { bd = dd; target = comp[idx] } } }
    if (target < 0) return null
    // prior normals in (east, up, north): n = (sinθ·sin a, cosθ, sinθ·cos a), a = azimuth from north
    const pn = priors.map((p) => { const t = (p.pitchDeg * Math.PI) / 180, a = (p.azimuthDeg * Math.PI) / 180; return { x: Math.sin(t) * Math.sin(a), y: Math.cos(t), z: Math.sin(t) * Math.cos(a) } })
    // assign each roof pixel to the best-matching prior orientation
    const label = new Int32Array(W * H).fill(-1)
    const COS = Math.cos((24 * Math.PI) / 180)
    for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
      const idx = r * W + c
      if (comp[idx] !== target || hs[idx] - minH < 1.0) continue
      const a = (hs[idx + 1] - hs[idx - 1]) / (2 * res)
      const b = (hs[(r - 1) * W + c] - hs[(r + 1) * W + c]) / (2 * res)
      const inv = 1 / Math.sqrt(a * a + b * b + 1)
      const nx = -a * inv, ny = inv, nz = -b * inv
      if (ny < 0.3) continue // slope > ~72° → wall/edge, not a roof face
      let best = -1, bestDot = COS
      for (let k = 0; k < pn.length; k++) { const d = nx * pn[k].x + ny * pn[k].y + nz * pn[k].z; if (d > bestDot) { bestDot = d; best = k } }
      if (best >= 0) label[idx] = best
    }
    // geometry helpers
    const halfW = (W * res) / 2, halfH = (H * res) / 2, mLat = 110540, mLng = 111320 * Math.cos((lat * Math.PI) / 180)
    const pxToXY = (c: number, r: number): MXY => ({ x: (c + 0.5) * res - halfW, y: halfH - (r + 0.5) * res })
    const xyToLL = (p: MXY) => ({ lat: lat + p.y / mLat, lng: lng + p.x / mLng })
    // split each prior label into spatially-connected faces; trace + regularize each
    const out: RoofFacet[] = []
    const seen = new Uint8Array(W * H)
    for (let s = 0; s < W * H; s++) {
      if (label[s] < 0 || seen[s]) continue
      const pk = label[s]; const pixels: number[] = []; const st = [s]; seen[s] = 1
      while (st.length) { const p = st.pop()!; pixels.push(p); const x = p % W, y = (p / W) | 0; const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]; for (const nq of nb) if (nq >= 0 && label[nq] === pk && !seen[nq]) { seen[nq] = 1; st.push(nq) } }
      if (pixels.length < 40) continue
      const inFace = new Uint8Array(W * H); for (const p of pixels) inFace[p] = 1
      const boundary = mooreTrace((x, y) => x >= 0 && y >= 0 && x < W && y < H && inFace[y * W + x] === 1, W, H)
      if (!boundary) continue
      const simp = dpSimplify(boundary, 1.3); if (simp.length < 3) continue
      const ring = regularizeRingMetric(simp.map(([c, r]) => pxToXY(c, r)))
      if (ring.length < 3) continue
      const pitch = priors[pk].pitchDeg
      const areaM2 = Math.round((pixels.length * res * res) / Math.max(0.2, Math.cos((pitch * Math.PI) / 180)))
      if (areaM2 < 6) continue
      out.push({ polygon: ring.map(xyToLL), pitchDeg: Math.max(0, Math.min(60, pitch)), azimuthDeg: Math.round(((priors[pk].azimuthDeg % 360) + 360) % 360), areaM2 })
    }
    return out.length ? out.sort((p, q) => q.areaM2 - p.areaM2) : null
  } catch { return null }
}

function solve3v(M: number[][], B: number[]): number[] | null {
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const d = det(M); if (Math.abs(d) < 1e-9) return null
  const col = (k: number) => M.map((row, i) => row.map((v, j) => (j === k ? B[i] : v)))
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d]
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
