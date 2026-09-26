/**
 * Face operations for the roof editor — for when the height model is wrong and a person knows better.
 *
 * The classic case: a flat roof with a glass lantern or rooflights. Glass confuses the aerial survey, so Google's
 * 3D surface (and Google's own roof segments) show a little hipped roof where there's really a flat one. Nothing
 * automatic can tell those apart from a genuine low hipped roof, so the editor gives one-click fixes instead:
 *   mergeFaces  — two faces become one clean face (union, traced and tidied)
 *   neighbours  — which faces touch a given face (≥ 0.5 m of shared boundary, or within 30 cm)
 */
import type { DesignPlane } from '../store/types'
import type { LatLng } from './solar'
import { metricFrame, tidyRing, type XY } from './paneShape'
import { trace, dp } from './roofPanes'
import { polygonAreaM2 } from './design'

const inRing = (p: XY, r: XY[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c } return c }
const segDist = (p: XY, a: XY, b: XY) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) }

/** Faces that touch `id` (share an edge or come within 30 cm), nearest first. */
export function neighbours(planes: DesignPlane[], id: string): DesignPlane[] {
  const me = planes.find((p) => p.id === id); if (!me) return []
  const f = metricFrame(me.polygon[0])
  const A = me.polygon.map(f.toXY)
  const near = (B: XY[]) => {
    let close = 0
    for (const p of B) { let d = Infinity; for (let i = 0; i < A.length; i++) d = Math.min(d, segDist(p, A[i], A[(i + 1) % A.length])); if (d < 0.3) close++ }
    for (const p of A) { let d = Infinity; for (let i = 0; i < B.length; i++) d = Math.min(d, segDist(p, B[i], B[(i + 1) % B.length])); if (d < 0.3) close++ }
    return close
  }
  return planes.filter((p) => p.id !== id).map((p) => ({ p, n: near(p.polygon.map(f.toXY)) })).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).map((x) => x.p)
}

/** Union of faces as ONE clean outline (rasterised at 10 cm, traced, simplified, tidied). Null if they don't join. */
export function unionPolygon(polys: LatLng[][], outline?: LatLng[]): LatLng[] | null {
  if (!polys.length) return null
  const f = metricFrame(polys[0][0])
  const rings = polys.map((p) => p.map(f.toXY))
  const pts = rings.flat()
  const res = 0.1, pad = 0.4
  const x0 = Math.min(...pts.map((p) => p.x)) - pad, y1 = Math.max(...pts.map((p) => p.y)) + pad
  const W = Math.ceil((Math.max(...pts.map((p) => p.x)) + pad - x0) / res), H = Math.ceil((y1 - (Math.min(...pts.map((p) => p.y)) - pad)) / res)
  if (W * H > 4e6) return null
  const grid = new Uint8Array(W * H)
  const cx = (c: number) => x0 + (c + 0.5) * res, cy = (r: number) => y1 - (r + 0.5) * res
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const p = { x: cx(c), y: cy(r) }; if (rings.some((q) => inRing(p, q))) grid[r * W + c] = 1 }
  // close hairline gaps between faces that nearly touch (a 20 cm dilate then erode)
  const morph = (src: Uint8Array, grow: boolean) => { const out = new Uint8Array(W * H); for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { let v = grow ? 0 : 1; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; const s = rr >= 0 && cc >= 0 && rr < H && cc < W ? src[rr * W + cc] : 0; if (grow ? s : !s) { v = grow ? 1 : 0 } } out[r * W + c] = v } return out }
  const closed = morph(morph(grid, true), false)
  // largest connected piece
  const seen = new Uint8Array(W * H); let best: number[] = []
  for (let i = 0; i < W * H; i++) {
    if (!closed[i] || seen[i]) continue
    const comp: number[] = [], st = [i]; seen[i] = 1
    while (st.length) { const q = st.pop()!; comp.push(q); const x = q % W, y = (q / W) | 0; for (const t of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1]) if (t >= 0 && closed[t] && !seen[t]) { seen[t] = 1; st.push(t) } }
    if (comp.length > best.length) best = comp
  }
  const mask = new Uint8Array(W * H); for (const i of best) mask[i] = 1
  const loop = trace((x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1, W, H)
  if (!loop) return null
  const simp = dp(loop, 3.5).map(([c, r]) => ({ x: x0 + c * res, y: y1 - r * res }))
  if (simp.length < 3) return null
  // line the merged face up with the BUILDING: its walls' directions, and its corners where they're close
  const O = (outline ?? []).map(f.toXY)
  const dirs: number[] = []
  for (let i = 0; i < O.length; i++) { const a = O[i], b = O[(i + 1) % O.length]; if (Math.hypot(b.x - a.x, b.y - a.y) > 1.5) { const t = Math.atan2(b.y - a.y, b.x - a.x); dirs.push(t, t + Math.PI / 2) } }
  let r = tidyRing(simp, { dirs: dirs.length ? dirs.map((t) => ((t % Math.PI) + Math.PI) % Math.PI) : undefined, collinearTol: 0.35, minEdge: 1, snapDeg: 15, rectFill: 0.9 })
  if (O.length) r = r.map((v) => { let b: XY | null = null, bd = 0.6; for (const w of O) { const d = Math.hypot(w.x - v.x, w.y - v.y); if (d < bd) { bd = d; b = w } } return b ? { ...b } : v })
  return r.map(f.toLL)
}

/** Merge faces into the first one. flat = make the result a flat roof (0°, faces south for racking). */
export function mergeFaces(planes: DesignPlane[], ids: string[], flat = false, outline?: LatLng[]): DesignPlane[] | null {
  const parts = planes.filter((p) => ids.includes(p.id)); if (parts.length < 2 && !flat) return null
  const poly = parts.length > 1 ? unionPolygon(parts.map((p) => p.polygon), outline) : parts[0].polygon
  if (!poly) return null
  const areas = parts.map((p) => Math.max(1, p.areaM2)), tot = areas.reduce((a, b) => a + b, 0)
  const main = parts[areas.indexOf(Math.max(...areas))]
  // the merged face keeps the biggest part's facing; pitch is the area-weighted mean unless it's being made flat
  const pitch = flat ? 0 : Math.round(parts.reduce((s, p, i) => s + p.pitchDeg * areas[i], 0) / tot)
  const merged: DesignPlane = {
    ...main, polygon: poly, areaM2: Math.round(polygonAreaM2(poly)), pitchDeg: pitch, azimuthDeg: flat ? 180 : main.azimuthDeg,
    name: flat ? 'Flat roof' : main.name,
    panels: [], // the face changed shape — re-fill it
  }
  return [...planes.filter((p) => !ids.includes(p.id) || p.id === main.id).map((p) => (p.id === main.id ? merged : p))]
}
