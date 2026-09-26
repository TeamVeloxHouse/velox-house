/* Roof panes from the building outline.
 *
 * The outline (Google's building mask where Solar coverage exists, else OpenStreetMap) is the part we
 * trust. A pitched roof over that outline is, to a very good approximation, its straight skeleton:
 * every wall that carries an eave gets a roof plane rising inward from it at the roof pitch, and the
 * roof surface is the LOWEST of those planes at each point. Ridges, hips and valleys then fall out as
 * the lines where two planes meet. Walls that carry no roof slope — gable ends and party walls with the
 * neighbour — are left out, so the planes either side run through to them.
 *
 *   1. OUTLINE   Google mask → OSM footprint (+ neighbouring buildings for party-wall detection)
 *   2. ROLES     each wall: eave (a roof plane slopes down to it), gable, or party wall
 *   3. SPLIT     rasterise at ~10 cm, label every point with the plane that forms the roof there
 *   4. TRACE     outline each pane, weld shared corners, snap eaves onto the walls
 *   5. MEASURE   with Google's height model: fit each pane's true pitch + facing, and turn any wall
 *                whose "pane" doesn't actually slope towards it into a gable, then re-split
 *
 * Without height data the pitch is ASSUMED (35°, typical UK) and flagged on every pane. */

import type { DesignPlane } from '../store/types'
import { fetchBuildingOutline, fetchDsm, fetchLidarDsm, sampleHeight, regularizeRingMetric, type DsmData } from './dsm'
import { tidyRing, tidyRoof, dropCollinear, mergeShortEdges, paneDirections } from './paneShape'

type LatLng = { lat: number; lng: number }
type XY = { x: number; y: number } // metres east (x) / north (y) of the query point
export type EdgeRole = 'eave' | 'gable' | 'party'
export type RoofStyle = 'gable' | 'hip'
export type RoofModel = NonNullable<import('../store/types').Design['roofModel']>

const DEG = Math.PI / 180
export const ASSUMED_PITCH = 35
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

/* ── geometry ──────────────────────────────────────────────────────────── */

function frame(o: LatLng) {
  const mLat = 110540, mLng = 111320 * Math.cos(o.lat * DEG)
  return {
    toXY: (p: LatLng): XY => ({ x: (p.lng - o.lng) * mLng, y: (p.lat - o.lat) * mLat }),
    toLL: (p: XY): LatLng => ({ lat: o.lat + p.y / mLat, lng: o.lng + p.x / mLng }),
  }
}
const signedArea = (r: XY[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.y - q.x * p.y } return a / 2 }
const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)
function inPoly(p: XY, r: XY[]) {
  let inside = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i].y > p.y) !== (r[j].y > p.y) && p.x < ((r[j].x - r[i].x) * (p.y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) inside = !inside
  return inside
}
function segDist(p: XY, a: XY, b: XY) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return { d: Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy), q: { x: a.x + t * dx, y: a.y + t * dy } }
}

/** CCW, no duplicate points, no near-collinear corners, no stub edges — a roofer's outline. */
function cleanRing(r0: XY[]): XY[] {
  let r = r0.slice()
  if (r.length > 1 && dist(r[0], r[r.length - 1]) < 0.05) r.pop()
  if (signedArea(r) < 0) r.reverse()
  for (let pass = 0; pass < 6; pass++) {
    let changed = false
    const out: XY[] = []
    for (let i = 0; i < r.length; i++) {
      const p = r[(i - 1 + r.length) % r.length], c = r[i], n = r[(i + 1) % r.length]
      if (dist(c, n) < 0.3) { changed = true; continue } // stub edge — drop this corner
      const a1 = Math.atan2(c.y - p.y, c.x - p.x), a2 = Math.atan2(n.y - c.y, n.x - c.x)
      let turn = Math.abs(a2 - a1); if (turn > Math.PI) turn = 2 * Math.PI - turn
      if (turn < 12 * DEG) { changed = true; continue } // nearly straight — not a real corner
      out.push(c)
    }
    r = out
    if (!changed || r.length < 4) break
  }
  return r
}

/* ── 1 · outline ───────────────────────────────────────────────────────── */

/** The building at `c` from OpenStreetMap plus the buildings touching it (for party walls). */
async function osmBuildings(c: LatLng): Promise<{ target: LatLng[] | null; others: LatLng[][] }> {
  {
    try {
      const r = await fetch(`/api/osm-buildings?lat=${c.lat}&lng=${c.lng}&r=70`)
      if (!r.ok) return { target: null, others: [] }
      const j = await r.json()
      const ways: LatLng[][] = (j.buildings || []).map((b: { ring: LatLng[] }) => b.ring)
      const f = frame(c), o = { x: 0, y: 0 }
      const rings = ways.map((w) => w.map(f.toXY))
      let ti = rings.findIndex((r) => inPoly(o, r))
      if (ti < 0) { // pin just off the roof → nearest wall within 3 m
        let bd = 3 // only if the pin is on it or right at its wall — never a neighbour's building
        rings.forEach((r, i) => { for (let k = 0; k < r.length - 1; k++) { const d = segDist(o, r[k], r[k + 1]).d; if (d < bd) { bd = d; ti = i } } })
      }
      return { target: ti >= 0 ? ways[ti] : null, others: ways.filter((_, i) => i !== ti) }
    } catch { /* next mirror */ }
  }
  return { target: null, others: [] }
}

/** The part of building `a` inside title boundary `b` (both metric rings) — rasterised at 10 cm, the piece
 *  under the pin, traced and simplified. Cuts a terrace-wide Google building down to this house. */
function intersectRings(a: XY[], b: XY[]): XY[] | null {
  const res = 0.1
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of a) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  const W = Math.ceil((maxX - minX) / res) + 2, H = Math.ceil((maxY - minY) / res) + 2
  if (W * H > 4e6) return null
  const px = (c: number) => minX + (c - 0.5) * res, py = (r: number) => maxY - (r - 0.5) * res
  const inside = new Uint8Array(W * H)
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const p = { x: px(c), y: py(r) }; if (inPoly(p, a) && inPoly(p, b)) inside[r * W + c] = 1 }
  // the connected piece under (or nearest to) the pin at the origin
  const c0 = Math.round((0 - minX) / res + 0.5), r0 = Math.round((maxY - 0) / res + 0.5)
  let seed = -1, bd = Infinity
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (inside[r * W + c]) { const d = (c - c0) ** 2 + (r - r0) ** 2; if (d < bd) { bd = d; seed = r * W + c } }
  if (seed < 0 || bd * res * res > 16) return null // nothing of the building within 4 m of the pin inside this title
  const comp = new Uint8Array(W * H), st = [seed]; comp[seed] = 1; let n = 0
  while (st.length) { const q = st.pop()!; n++; const x = q % W, y = (q / W) | 0; for (const t of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1]) if (t >= 0 && inside[t] && !comp[t]) { comp[t] = 1; st.push(t) } }
  if (n * res * res < 15) return null
  const loop = trace((x, y) => x >= 0 && y >= 0 && x < W && y < H && comp[y * W + x] === 1, W, H)
  if (!loop) return null
  const simp = dp(loop, 2.5)
  return simp.length >= 3 ? simp.map(([c, r]) => ({ x: px(c), y: py(r) })) : null
}
async function titleBoundary(c: LatLng): Promise<LatLng[] | null> {
  try { const j = await (await fetch(`/api/parcel?lat=${c.lat}&lng=${c.lng}`)).json(); return j.configured && j.parcel?.length >= 3 && j.areaM2 < 3000 ? j.parcel : null } catch { return null }
}

/* ── 2 · wall roles ────────────────────────────────────────────────────── */

/** Walls shared with a neighbouring building (semis, terraces): parallel, within 0.8 m, overlapping. */
function partyWalls(r: XY[], others: XY[][]): boolean[] {
  return r.map((a, i) => {
    const b = r[(i + 1) % r.length], len = dist(a, b); if (len < 1.5) return false
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len
    for (const o of others) for (let k = 0; k < o.length - 1; k++) {
      const c = o[k], d = o[k + 1], l2 = dist(c, d); if (l2 < 1) continue
      const vx = (d.x - c.x) / l2, vy = (d.y - c.y) / l2
      if (Math.abs(ux * vy - uy * vx) > 0.17) continue // not parallel (±10°)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (Math.abs((mid.x - c.x) * vy - (mid.y - c.y) * vx) > 0.8) continue
      const t1 = (a.x - c.x) * vx + (a.y - c.y) * vy, t2 = (b.x - c.x) * vx + (b.y - c.y) * vy
      const overlap = Math.min(Math.max(t1, t2), l2) - Math.max(Math.min(t1, t2), 0)
      if (overlap > 0.5 * len) return true
    }
    return false
  })
}

const isConvex = (r: XY[], i: number) => { const p = r[(i - 1 + r.length) % r.length], c = r[i], n = r[(i + 1) % r.length]; return (c.x - p.x) * (n.y - c.y) - (c.y - p.y) * (n.x - c.x) > 0 }

/** Default roles. Gable style (most UK houses): the short end wall of each wing — convex at both
 *  corners and no longer than the walls either side — is a gable. Hip style: every free wall is an eave. */
export function defaultRoles(r: XY[], party: boolean[], style: RoofStyle): EdgeRole[] {
  const n = r.length
  const roles: EdgeRole[] = party.map((p) => (p ? 'party' : 'eave'))
  if (style === 'gable') {
    const len = r.map((a, i) => dist(a, r[(i + 1) % n]))
    const dir = (i: number) => { const a = r[i], b = r[(i + 1) % n], l = len[i] || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l } }
    const parallel = (i: number, j: number) => { const u = dir(i), v = dir(j); return Math.abs(u.x * v.y - u.y * v.x) < 0.17 }
    const partyIdx = party.map((p, i) => (p ? i : -1)).filter((i) => i >= 0)
    const cands = r.map((_, i) => i)
      .filter((i) => roles[i] === 'eave' && isConvex(r, i) && isConvex(r, (i + 1) % n))
      // Semis and end-terraces: the ridge runs away from the party wall, so the free end wall PARALLEL
      // to it is the gable, however long it is. Otherwise the short end of each wing is.
      .filter((i) => partyIdx.length ? partyIdx.some((j) => parallel(i, j)) : len[i] <= 1.02 * Math.min(len[(i - 1 + n) % n], len[(i + 1) % n]))
      .sort((a, b) => len[a] - len[b])
    for (const i of cands) {
      const prev = roles[(i - 1 + n) % n], next = roles[(i + 1) % n]
      if (prev !== 'eave' || next !== 'eave') continue // a gable needs eaves either side to run through to it
      roles[i] = 'gable'
    }
  }
  if (roles.filter((x) => x === 'eave').length < 2) return party.map((p) => (p ? 'party' : 'eave'))
  return roles
}

/* ── 3 · split into panes ──────────────────────────────────────────────── */

type Pane = { edge: number; ring: XY[]; areaM2: number }

/** Label the outline with the plane that forms the roof at each point (the lower envelope of the eave
 *  planes, each confined to its skeleton wedge), then trace each pane. */
export function splitPanes(r: XY[], roles: EdgeRole[], pitch: number[]): Pane[] {
  const n = r.length
  const area = Math.abs(signedArea(r))
  const res = Math.max(0.1, Math.sqrt(area / 160000)) // ≤ ~160k samples even on a big shed
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of r) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  const W = Math.ceil((maxX - minX) / res) + 2, H = Math.ceil((maxY - minY) / res) + 2
  const px = (c: number) => minX + (c - 0.5) * res, py = (rr: number) => maxY - (rr - 0.5) * res
  // per-edge inward normal + slope
  const E = r.map((a, i) => {
    const b = r[(i + 1) % n], l = dist(a, b)
    return { a, nx: -(b.y - a.y) / l, ny: (b.x - a.x) / l, t: Math.tan((pitch[i] ?? ASSUMED_PITCH) * DEG), on: roles[i] === 'eave' }
  })
  const h = (i: number, p: XY) => ((p.x - E[i].a.x) * E[i].nx + (p.y - E[i].a.y) * E[i].ny) * E[i].t
  const convex = r.map((_, i) => isConvex(r, i))
  const label = new Int32Array(W * H).fill(-2) // -2 = outside
  for (let rr = 0; rr < H; rr++) for (let c = 0; c < W; c++) {
    const p = { x: px(c), y: py(rr) }
    if (!inPoly(p, r)) continue
    let best = -1, bh = Infinity, loose = -1, lh = Infinity
    for (let i = 0; i < n; i++) {
      if (!E[i].on) continue
      const hi = h(i, p); if (hi < -1e-6) continue
      if (hi < lh) { lh = hi; loose = i }
      // skeleton wedge: bounded by the bisector with each ACTIVE neighbour (convex corner → we're the
      // lower plane; reflex corner → the higher one). A gable/party neighbour doesn't bound us.
      const pv = (i - 1 + n) % n, nx = (i + 1) % n
      if (E[pv].on && (convex[i] ? hi > h(pv, p) + 1e-6 : hi < h(pv, p) - 1e-6)) continue
      if (E[nx].on && (convex[nx] ? hi > h(nx, p) + 1e-6 : hi < h(nx, p) - 1e-6)) continue
      if (hi < bh) { bh = hi; best = i }
    }
    label[rr * W + c] = best >= 0 ? best : loose
  }
  // Absorb crumbs (< 1.5 m²) into whichever pane surrounds them most.
  const minPx = Math.round(1.5 / (res * res))
  for (let pass = 0; pass < 3; pass++) {
    const seen = new Uint8Array(W * H); let changed = false
    for (let s = 0; s < W * H; s++) {
      if (label[s] < 0 || seen[s]) continue
      const lb = label[s], pix = [s]; seen[s] = 1
      const border = new Map<number, number>()
      for (let k = 0; k < pix.length; k++) {
        const p = pix[k], x = p % W, y = (p / W) | 0
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
          if (q < 0 || label[q] === -2) continue
          if (label[q] === lb) { if (!seen[q]) { seen[q] = 1; pix.push(q) } } else border.set(label[q], (border.get(label[q]) ?? 0) + 1)
        }
      }
      if (pix.length < minPx && border.size) {
        const to = [...border.entries()].sort((a, b) => b[1] - a[1])[0][0]
        for (const p of pix) label[p] = to
        changed = true
      }
    }
    if (!changed) break
  }
  // Trace each connected pane.
  const panes: Pane[] = []
  const done = new Uint8Array(W * H)
  for (let s = 0; s < W * H; s++) {
    if (label[s] < 0 || done[s]) continue
    const lb = label[s], inComp = new Uint8Array(W * H), pix = [s]; done[s] = 1; inComp[s] = 1
    for (let k = 0; k < pix.length; k++) {
      const p = pix[k], x = p % W, y = (p / W) | 0
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) if (q >= 0 && label[q] === lb && !done[q]) { done[q] = 1; inComp[q] = 1; pix.push(q) }
    }
    const a = pix.length * res * res
    if (a < 1.5) continue
    const loop = trace((x, y) => x >= 0 && y >= 0 && x < W && y < H && inComp[y * W + x] === 1, W, H)
    if (!loop) continue
    const simp = dp(loop, Math.max(1.6, 0.22 / res))
    if (simp.length < 3) continue
    panes.push({ edge: lb, ring: simp.map(([c, rr]) => ({ x: px(c), y: py(rr) })), areaM2: a })
  }
  return weld(panes, r)
}

/** Snap pane corners onto the outline's corners and walls, and merge the corners panes share (ridge
 *  ends, hip tops) so neighbouring panes meet exactly with no slivers. */
function weld(panes: Pane[], outline: XY[]): Pane[] {
  const pts: { pane: number; k: number; p: XY }[] = []
  panes.forEach((pn, i) => pn.ring.forEach((p, k) => pts.push({ pane: i, k, p })))
  const fixed = new Set<number>()
  pts.forEach((v, idx) => {
    let bd = 0.5, snap: XY | null = null
    for (const c of outline) { const d = dist(v.p, c); if (d < bd) { bd = d; snap = c } }
    if (snap) { v.p = { ...snap }; fixed.add(idx) }
  })
  // cluster the free corners (≤ 0.45 m apart) and move each cluster to its mean
  const used = new Set<number>()
  pts.forEach((v, i) => {
    if (fixed.has(i) || used.has(i)) return
    const grp = pts.map((w, j) => ({ w, j })).filter(({ w, j }) => !fixed.has(j) && !used.has(j) && dist(w.p, v.p) < 0.45)
    if (grp.length < 2) return
    const m = { x: grp.reduce((s, g) => s + g.w.p.x, 0) / grp.length, y: grp.reduce((s, g) => s + g.w.p.y, 0) / grp.length }
    grp.forEach((g) => { used.add(g.j); g.w.p = { ...m } })
  })
  // free corners lying on a wall → exactly onto that wall (eaves line up with the outline)
  pts.forEach((v, i) => {
    if (fixed.has(i)) return
    let bd = 0.3, q: XY | null = null
    for (let k = 0; k < outline.length; k++) { const s = segDist(v.p, outline[k], outline[(k + 1) % outline.length]); if (s.d < bd) { bd = s.d; q = s.q } }
    if (q) v.p = q
  })
  const out = panes.map((pn) => ({ ...pn, ring: pn.ring.map((p) => ({ ...p })) }))
  pts.forEach((v) => (out[v.pane].ring[v.k] = v.p))
  return out.map((pn) => ({ ...pn, ring: pn.ring.filter((p, k) => dist(p, pn.ring[(k + 1) % pn.ring.length]) > 0.05) })).filter((pn) => pn.ring.length >= 3)
}

type PXY = [number, number]
function trace(inR: (x: number, y: number) => boolean, W: number, H: number): PXY[] | null {
  let sx = -1, sy = -1
  for (let y = 0; y < H && sy < 0; y++) for (let x = 0; x < W; x++) if (inR(x, y)) { sx = x; sy = y; break }
  if (sx < 0) return null
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
  const out: PXY[] = []; let cx = sx, cy = sy, dir = 6, guard = 0
  do {
    out.push([cx, cy]); let found = false
    for (let k = 0; k < 8; k++) { const d = (dir + k) % 8, nx = cx + dirs[d][0], ny = cy + dirs[d][1]; if (inR(nx, ny)) { cx = nx; cy = ny; dir = (d + 5) % 8; found = true; break } }
    if (!found) break
  } while ((cx !== sx || cy !== sy) && ++guard < W * H)
  return out.length >= 3 ? out : null
}
/** Douglas–Peucker on a closed pixel loop (split at the two farthest points). */
function dp(loop: PXY[], tol: number): PXY[] {
  if (loop.length < 5) return loop
  let a = 0, b = 0, best = -1
  for (let i = 0; i < loop.length; i += Math.max(1, (loop.length / 60) | 0)) for (let j = 0; j < loop.length; j++) { const d = (loop[i][0] - loop[j][0]) ** 2 + (loop[i][1] - loop[j][1]) ** 2; if (d > best) { best = d; a = i; b = j } }
  if (a > b) [a, b] = [b, a]
  const run = (idx: number[]): number[] => {
    if (idx.length < 3) return idx
    const p0 = loop[idx[0]], p1 = loop[idx[idx.length - 1]]
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1
    let md = 0, mi = -1
    for (let k = 1; k < idx.length - 1; k++) { const p = loop[idx[k]]; const d = Math.abs((p[0] - p0[0]) * dy - (p[1] - p0[1]) * dx) / l; if (d > md) { md = d; mi = k } }
    if (md <= tol) return [idx[0], idx[idx.length - 1]]
    return [...run(idx.slice(0, mi + 1)).slice(0, -1), ...run(idx.slice(mi))]
  }
  const c1 = Array.from({ length: b - a + 1 }, (_, k) => a + k)
  const c2 = Array.from({ length: loop.length - b + a + 1 }, (_, k) => (b + k) % loop.length)
  return [...run(c1).slice(0, -1), ...run(c2).slice(0, -1)].map((i) => loop[i])
}

/* ── 3b · panes straight from the 3D surface ────────────────────────────────
 * The same height model the 3D view draws. Inside the house's outline we find every flat plane in the
 * surface (region growing on height + slope, refitting the plane as it grows), merge planes that are really
 * one, give stragglers to the plane that explains them best, then trace each plane and straighten its edges
 * to the building's own angles (walls, and hips at 45° to them). Steps between roof levels — a lower wing, a
 * flat extension, a dormer — come out as separate panes because they're different planes. */

type HPlane = { a: number; b: number; c: number } // z = a·east + b·north + c

/** Square a ring to a building axis: every wall within `tolDeg` of the axis or its perpendicular is turned exactly
 *  onto it (about its midpoint) and the corners rebuilt where the straightened walls meet. */
function squareRing(ring: XY[], theta: number, tolDeg = 20): XY[] {
  const n = ring.length; if (n < 4) return ring
  const tol = (tolDeg * Math.PI) / 180
  const lines = ring.map((a, i) => {
    const b = ring[(i + 1) % n], t = Math.atan2(b.y - a.y, b.x - a.x)
    let best = t
    for (const d of [theta, theta + Math.PI / 2]) { const e = Math.abs(((t - d) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2); if (e < tol) { best = t - (((t - d) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2) } }
    return { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: { x: Math.cos(best), y: Math.sin(best) } }
  })
  return ring.map((orig, i) => {
    const L1 = lines[(i - 1 + n) % n], L2 = lines[i], den = L1.d.x * L2.d.y - L1.d.y * L2.d.x
    if (Math.abs(den) < 0.2) return orig
    const t = ((L2.p.x - L1.p.x) * L2.d.y - (L2.p.y - L1.p.y) * L2.d.x) / den
    const q = { x: L1.p.x + L1.d.x * t, y: L1.p.y + L1.d.y * t }
    return dist(q, orig) < 1.5 ? q : orig
  })
}

/** Keep the part of a polygon where f(x,y) ≥ 0, f linear (Sutherland–Hodgman against one half-plane). */
function clipHalf(poly: XY[], f: (p: XY) => number): XY[] {
  const out: XY[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b)
    if (fa >= 0) out.push(a)
    if (fa * fb < 0) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) }
  }
  return out
}
/** Convex hull (monotone chain), then pushed outward by d metres. */
function grownHull(pts: XY[], d: number): XY[] {
  const P = [...pts].sort((p, q) => p.x - q.x || p.y - q.y)
  if (P.length < 3) return P
  const cross = (o: XY, a: XY, b: XY) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lo: XY[] = [], hi: XY[] = []
  for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p) }
  const h = [...lo.slice(0, -1), ...hi.slice(0, -1)] // CCW
  if (h.length < 3) return h
  const lines = h.map((a, i) => { const b = h[(i + 1) % h.length], l = dist(a, b) || 1; const n = { x: (b.y - a.y) / l, y: -(b.x - a.x) / l }; return { p: { x: a.x + n.x * d, y: a.y + n.y * d }, d: { x: (b.x - a.x) / l, y: (b.y - a.y) / l } } })
  return lines.map((L2, i) => {
    const L1 = lines[(i - 1 + lines.length) % lines.length], den = L1.d.x * L2.d.y - L1.d.y * L2.d.x
    if (Math.abs(den) < 1e-6) return L2.p
    const t = ((L2.p.x - L1.p.x) * L2.d.y - (L2.p.y - L1.p.y) * L2.d.x) / den
    return { x: L1.p.x + L1.d.x * t, y: L1.p.y + L1.d.y * t }
  })
}
export function panesFromHeights(dsm: DsmData, outline: XY[]): { ring: XY[]; plane: HPlane; areaM2: number }[] | null {
  const W = dsm.width, H = dsm.height, res = dsm.resM
  const halfW = (W * res) / 2, halfH = (H * res) / 2
  const ex = (c: number) => (c + 0.5) * res - halfW, no = (r: number) => halfH - (r + 0.5) * res
  const valid = (v: number) => v > -500 && v < 10000
  // inside the outline (grown 0.3 m for the eaves overhang)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of outline) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  const c0 = Math.max(1, Math.floor((minX - 0.5 + halfW) / res)), c1 = Math.min(W - 2, Math.ceil((maxX + 0.5 + halfW) / res))
  const r0 = Math.max(1, Math.floor((halfH - maxY - 0.5) / res)), r1 = Math.min(H - 2, Math.ceil((halfH - minY + 0.5) / res))
  const inside = new Uint8Array(W * H)
  const nearEdge = (p: XY) => { let d = Infinity; for (let k = 0; k < outline.length; k++) d = Math.min(d, segDist(p, outline[k], outline[(k + 1) % outline.length]).d); return d }
  let nIn = 0
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const p = { x: ex(c), y: no(r) }
    if ((inPoly(p, outline) || nearEdge(p) < 0.3) && valid(dsm.heights[r * W + c])) { inside[r * W + c] = 1; nIn++ }
  }
  if (nIn < 200) return null
  // smoothed heights + slope per pixel (central differences on a 3×3 mean)
  const hs = new Float32Array(W * H)
  for (let r = r0 - 1; r <= r1 + 1; r++) for (let c = c0 - 1; c <= c1 + 1; c++) {
    let s = 0, n = 0
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < H && cc < W) { const v = dsm.heights[rr * W + cc]; if (valid(v)) { s += v; n++ } } }
    if (r >= 0 && c >= 0 && r < H && c < W) hs[r * W + c] = n ? s / n : dsm.minH
  }
  const gA = new Float32Array(W * H), gB = new Float32Array(W * H), curv = new Float32Array(W * H)
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * W + c; if (!inside[i]) continue
    gA[i] = (hs[i + 1] - hs[i - 1]) / (2 * res); gB[i] = (hs[i - W] - hs[i + W]) / (2 * res)
  }
  for (let r = r0 + 1; r < r1; r++) for (let c = c0 + 1; c < c1; c++) {
    const i = r * W + c; if (!inside[i]) continue
    curv[i] = Math.abs(gA[i + 1] - gA[i - 1]) + Math.abs(gB[i - W] - gB[i + W]) + Math.abs(gA[i - W] - gA[i + W]) + Math.abs(gB[i + 1] - gB[i - 1])
  }
  // region growing, seeded from the flattest-looking pixels first
  const label = new Int32Array(W * H).fill(-1)
  const seeds: number[] = []; for (let i = 0; i < W * H; i++) if (inside[i]) seeds.push(i)
  seeds.sort((p, q) => curv[p] - curv[q])
  type Reg = { pix: number[]; pl: HPlane; S: number[] }
  const regs: Reg[] = []
  const solve = (S: number[]): HPlane | null => { // S = [Sxx,Sxy,Sx,Syy,Sy,N,Sxz,Syz,Sz]
    const M = [[S[0], S[1], S[2]], [S[1], S[3], S[4]], [S[2], S[4], S[5]]], B = [S[6], S[7], S[8]]
    const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    const d = det(M); if (Math.abs(d) < 1e-9) return null
    const k = [0, 1, 2].map((j) => det(M.map((row, i) => row.map((v, jj) => (jj === j ? B[i] : v)))) / d)
    return { a: k[0], b: k[1], c: k[2] }
  }
  const TOL = 0.12, COS = Math.cos((18 * Math.PI) / 180)
  const nrm = (a: number, b: number) => { const l = Math.hypot(a, b, 1); return [-a / l, -b / l, 1 / l] }
  for (const s of seeds) {
    if (label[s] >= 0 || curv[s] > 1.2) continue
    const id = regs.length
    const reg: Reg = { pix: [], pl: { a: gA[s], b: gB[s], c: hs[s] - gA[s] * ex(s % W) - gB[s] * no((s / W) | 0) }, S: new Array(9).fill(0) }
    const add = (i: number) => {
      const x = ex(i % W), y = no((i / W) | 0), z = hs[i]
      const S = reg.S; S[0] += x * x; S[1] += x * y; S[2] += x; S[3] += y * y; S[4] += y; S[5] += 1; S[6] += x * z; S[7] += y * z; S[8] += z
      reg.pix.push(i); label[i] = id
    }
    add(s)
    const queue = [s]; let nextFit = 16
    while (queue.length) {
      const p = queue.shift()!, x = p % W, y = (p / W) | 0
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
        if (q < 0 || !inside[q] || label[q] >= 0) continue
        const pl = reg.pl, qx = ex(q % W), qy = no((q / W) | 0)
        if (Math.abs(hs[q] - (pl.a * qx + pl.b * qy + pl.c)) > TOL) continue
        const n1 = nrm(gA[q], gB[q]), n2 = nrm(pl.a, pl.b)
        if (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] < COS) continue
        add(q); queue.push(q)
        if (reg.pix.length >= nextFit) { const f = solve(reg.S); if (f) reg.pl = f; nextFit = Math.ceil(nextFit * 1.5) }
      }
    }
    if (reg.pix.length * res * res < 1.2) { for (const i of reg.pix) label[i] = -1; regs.push({ pix: [], pl: reg.pl, S: reg.S }); continue }
    const f = solve(reg.S); if (f) reg.pl = f
    regs.push(reg)
  }
  // merge neighbouring regions that are the same plane (DSM noise splits one face)
  const parent = regs.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < W * H; i++) {
    const l = label[i]; if (l < 0) continue
    for (const q of [i + 1, i + W]) {
      const m = label[q]; if (m < 0 || find(m) === find(l)) continue
      const A = regs[l].pl, B = regs[m].pl, x = ex(i % W), y = no((i / W) | 0)
      const n1 = nrm(A.a, A.b), n2 = nrm(B.a, B.b)
      if (n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2] > Math.cos((7 * Math.PI) / 180) && Math.abs((A.a * x + A.b * y + A.c) - (B.a * x + B.b * y + B.c)) < 0.2) parent[find(l)] = find(m)
    }
  }
  const groups = new Map<number, number[]>()
  regs.forEach((r, i) => { if (!r.pix.length) return; const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(...r.pix) })
  let planes: { pix: number[]; pl: HPlane }[] = []
  for (const pix of groups.values()) {
    const S = new Array(9).fill(0)
    for (const i of pix) { const x = ex(i % W), y = no((i / W) | 0), z = hs[i]; S[0] += x * x; S[1] += x * y; S[2] += x; S[3] += y * y; S[4] += y; S[5] += 1; S[6] += x * z; S[7] += y * z; S[8] += z }
    // a real roof pane is at least ~4 m² and under ~52°; smaller or steeper pieces are gutters, party-wall steps or
    // wall edges — leave their pixels for the neighbouring panes to absorb below
    // …and at least ~1.1 m wide: a thin strip along a ridge is the blur where two slopes meet, not a pane of its own
    const n = pix.length, mx = S[2] / n, my = S[4] / n
    const cxx = S[0] / n - mx * mx, cyy = S[3] / n - my * my, cxy = S[1] / n - mx * my
    const lmin = (cxx + cyy) / 2 - Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy)
    const width = Math.sqrt(12 * Math.max(0, lmin))
    const pl = solve(S); if (pl && n * res * res >= 4 && width >= 1.1 && Math.atan(Math.hypot(pl.a, pl.b)) / DEG <= 52) planes.push({ pix, pl })
  }
  if (!planes.length) return null
  // relabel, then give leftover roof pixels to whichever neighbouring plane explains them best
  label.fill(-1); planes.forEach((p, k) => p.pix.forEach((i) => (label[i] = k)))
  for (let pass = 0; pass < 40; pass++) {
    let changed = 0
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * W + c; if (!inside[i] || label[i] >= 0) continue
      let best = -1, be = 0.5
      for (const q of [i - 1, i + 1, i - W, i + W]) { const k = label[q]; if (k < 0) continue; const pl = planes[k].pl; const e = Math.abs(hs[i] - (pl.a * ex(c) + pl.b * no(r) + pl.c)); if (e < be) { be = e; best = k } }
      if (best >= 0) { label[i] = best; changed++ }
    }
    if (!changed) break
  }
  // dominant directions: the outline's walls, and 45° to them (hips)
  const dirs: number[] = []
  for (let k = 0; k < outline.length; k++) { const a = outline[k], b = outline[(k + 1) % outline.length]; if (dist(a, b) < 1.5) continue; const t = Math.atan2(b.y - a.y, b.x - a.x); for (const d of [t, t + Math.PI / 4, t + Math.PI / 2, t - Math.PI / 4]) dirs.push(((d % Math.PI) + Math.PI) % Math.PI) }
  const snapDir = (t: number) => { const u = ((t % Math.PI) + Math.PI) % Math.PI; let best = u, bd = (12 * Math.PI) / 180; for (const d of dirs) { const e = Math.min(Math.abs(u - d), Math.PI - Math.abs(u - d)); if (e < bd) { bd = e; best = d } } return best }
  const straighten = (ring: XY[]): XY[] => {
    const n = ring.length; if (n < 4) return ring
    const lines = ring.map((a, i) => { const b = ring[(i + 1) % n]; const t = snapDir(Math.atan2(b.y - a.y, b.x - a.x)); return { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: { x: Math.cos(t), y: Math.sin(t) } } })
    return ring.map((orig, i) => {
      const L1 = lines[(i - 1 + n) % n], L2 = lines[i]
      const den = L1.d.x * L2.d.y - L1.d.y * L2.d.x
      if (Math.abs(den) < 0.2) return orig // near-parallel — keep the traced corner
      const t = ((L2.p.x - L1.p.x) * L2.d.y - (L2.p.y - L1.p.y) * L2.d.x) / den
      const q = { x: L1.p.x + L1.d.x * t, y: L1.p.y + L1.d.y * t }
      return dist(q, orig) < 1.2 ? q : orig
    })
  }
  // STRAIGHT EDGES: a pane's outline = the building outline, cut by one straight line per neighbouring pane —
  // the exact intersection of the two roof planes (ridge / hip / valley) where they meet, or a best-fit line
  // snapped to the building's angles where there's a step between levels — then kept to the pane's own area.
  const analytic = (pix: number[], k: number): XY[] | null => {
    const P = planes[k].pl
    const nb = new Map<number, XY[]>()
    for (const i of pix) {
      const x = ex(i % W), y = no((i / W) | 0)
      for (const q of [i - 1, i + 1, i - W, i + W]) {
        const j = label[q]; if (j < 0 || j === k) continue
        if (!nb.has(j)) nb.set(j, [])
        nb.get(j)!.push({ x: (x + ex(q % W)) / 2, y: (y + no((q / W) | 0)) / 2 })
      }
    }
    const step = Math.max(1, (pix.length / 400) | 0)
    let poly: XY[] = outline.slice()
    for (const [j, pts] of nb) {
      if (pts.length < 6) continue
      const Q = planes[j].pl, A = P.a - Q.a, B = P.b - Q.b, C = P.c - Q.c, nn = Math.hypot(A, B)
      let f: ((p: XY) => number) | null = null
      if (nn > 0.02) {
        const md = pts.reduce((s, p) => s + Math.abs(A * p.x + B * p.y + C) / nn, 0) / pts.length
        if (md < 0.35) f = (p) => A * p.x + B * p.y + C // the planes really meet here: ridge / hip / valley
      }
      if (!f) { // a step between levels: straight line through the boundary, at the building's angle
        const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length
        let sxx = 0, syy = 0, sxy = 0; for (const p of pts) { sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; sxy += (p.x - mx) * (p.y - my) }
        const t = snapDir(0.5 * Math.atan2(2 * sxy, sxx - syy)), nx = -Math.sin(t), ny = Math.cos(t)
        f = (p) => nx * (p.x - mx) + ny * (p.y - my)
      }
      let pos = 0, neg = 0
      for (let s = 0; s < pix.length; s += step) { const i = pix[s]; if (f({ x: ex(i % W), y: no((i / W) | 0) }) >= 0) pos++; else neg++ }
      const g = f, sgn = pos >= neg ? 1 : -1
      poly = clipHalf(poly, (p) => sgn * g(p))
      if (poly.length < 3) return null
    }
    const hullPts: XY[] = []; for (let s = 0; s < pix.length; s += step) { const i = pix[s]; hullPts.push({ x: ex(i % W), y: no((i / W) | 0) }) }
    const hull = grownHull(hullPts, 0.45)
    for (let h = 0; h < hull.length && poly.length >= 3; h++) { const a = hull[h], b = hull[(h + 1) % hull.length]; poly = clipHalf(poly, (p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) }
    if (poly.length < 3) return null
    const area = Math.abs(signedArea(poly)), want = pix.length * res * res
    if (area < want * 0.7 || area > want * 1.45) return null // disagrees with the data → use the traced shape
    // …and it must actually BE this pane: the hull is convex, so an L-shaped or split pixel set would stretch it
    // across another slope. At least 80% of the straight-edged shape has to be this pane's own measured roof.
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity
    for (const p of poly) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y) }
    let tot = 0, own = 0
    const ca = Math.max(0, Math.floor((bx0 + halfW) / res)), cb = Math.min(W - 1, Math.ceil((bx1 + halfW) / res))
    const ra = Math.max(0, Math.floor((halfH - by1) / res)), rb = Math.min(H - 1, Math.ceil((halfH - by0) / res))
    const st = Math.max(1, Math.round(0.2 / res))
    for (let r = ra; r <= rb; r += st) for (let c = ca; c <= cb; c += st) { if (!inPoly({ x: ex(c), y: no(r) }, poly)) continue; tot++; if (label[r * W + c] === k) own++ }
    return tot && own / tot >= 0.8 ? poly : null
  }
  const out: { ring: XY[]; plane: HPlane; areaM2: number; pix: number[] }[] = []
  planes.forEach((p, k) => {
    const done = new Uint8Array(W * H)
    for (const s0 of p.pix) {
      if (done[s0] || label[s0] !== k) continue
      const comp = new Uint8Array(W * H), stack = [s0]; done[s0] = 1; comp[s0] = 1; let n = 0; const compPix: number[] = []
      while (stack.length) { const q = stack.pop()!; n++; compPix.push(q); for (const t of [q - 1, q + 1, q - W, q + W]) if (t >= 0 && t < W * H && label[t] === k && !done[t]) { done[t] = 1; comp[t] = 1; stack.push(t) } }
      if (n * res * res < 2.5) continue // a stray scrap of a plane, not a pane
      const loop = trace((x, y) => x >= 0 && y >= 0 && x < W && y < H && comp[y * W + x] === 1, W, H)
      if (!loop) continue
      const simp = dp(loop, Math.max(1.5, 0.28 / res))
      if (simp.length < 3) continue
      const ring = analytic(compPix, k) ?? straighten(simp.map(([c, r]) => ({ x: ex(c), y: no(r) })))
      out.push({ ring, plane: p.pl, areaM2: n * res * res, pix: compPix })
    }
  })
  // ── TIDY: no two panes may overlap, and no slivers. Each pane was cut only against neighbours whose pixels touch
  // it, so panes that nearly touch (or fell back to the traced shape) can still overlap. Cut every overlapping pair
  // apart along the line that best separates their measured pixels — where the two planes meet if that line does
  // the job, else a straight line at the building's angles.
  const sample = (pix: number[]) => { const st = Math.max(1, (pix.length / 300) | 0), o: XY[] = []; for (let q = 0; q < pix.length; q += st) { const i = pix[q]; o.push({ x: ex(i % W), y: no((i / W) | 0) }) } return o }
  const overlapM2 = (A: XY[], B: XY[]) => {
    const bb = (r: XY[]) => r.reduce((m, p) => ({ x0: Math.min(m.x0, p.x), x1: Math.max(m.x1, p.x), y0: Math.min(m.y0, p.y), y1: Math.max(m.y1, p.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity })
    const a = bb(A), b = bb(B), x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), y0 = Math.max(a.y0, b.y0), y1 = Math.min(a.y1, b.y1)
    if (x1 <= x0 || y1 <= y0) return 0
    let n = 0; const g = 0.2
    for (let x = x0 + g / 2; x < x1; x += g) for (let y = y0 + g / 2; y < y1; y += g) if (inPoly({ x, y }, A) && inPoly({ x, y }, B)) n++
    return n * g * g
  }
  const separator = (i: number, j: number): ((p: XY) => number) => {
    const A = sample(out[i].pix), B = sample(out[j].pix), N = A.length + B.length
    const err = (f: (p: XY) => number) => (A.filter((p) => f(p) < 0).length + B.filter((p) => f(p) > 0).length) / N
    let best: { f: (p: XY) => number; e: number } = { f: () => 0, e: Infinity }
    const Pi = out[i].plane, Pj = out[j].plane, a = Pi.a - Pj.a, b = Pi.b - Pj.b, c = Pi.c - Pj.c
    if (Math.hypot(a, b) > 0.02) { const g = (p: XY) => a * p.x + b * p.y + c; const f = err(g) > 0.5 ? (p: XY) => -g(p) : g; best = { f, e: err(f) - 0.03 } } // slight preference: it's the real ridge/hip/valley
    for (const t of dirs) {
      const nx = -Math.sin(t), ny = Math.cos(t)
      const pr = [...A.map((p) => ({ v: nx * p.x + ny * p.y, s: 1 })), ...B.map((p) => ({ v: nx * p.x + ny * p.y, s: -1 }))].sort((u, w) => u.v - w.v)
      for (const sg of [1, -1]) { // sg 1: A above the threshold, B below
        let e = sg === 1 ? B.length : A.length, be = e, bt = pr[0].v - 0.01
        for (let q = 0; q < pr.length; q++) {
          e += pr[q].s === sg ? 1 : -1
          if (e < be) { be = e; bt = q + 1 < pr.length ? (pr[q].v + pr[q + 1].v) / 2 : pr[q].v + 0.01 }
        }
        if (be / N < best.e) { const T = bt; best = { f: (p) => sg * (nx * p.x + ny * p.y - T), e: be / N } }
      }
    }
    return best.f
  }
  const alive = out.map(() => true)
  for (let pass = 0; pass < 3; pass++) {
    const pairs: [number, number, number][] = []
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (alive[i] && alive[j]) { const o = overlapM2(out[i].ring, out[j].ring); if (o > 0.2) pairs.push([i, j, o]) }
    if (!pairs.length) break
    pairs.sort((u, w) => w[2] - u[2])
    for (const [i, j] of pairs) {
      if (!alive[i] || !alive[j] || overlapM2(out[i].ring, out[j].ring) <= 0.2) continue
      const f = separator(i, j)
      const ri = clipHalf(out[i].ring, f), rj = clipHalf(out[j].ring, (p) => -f(p))
      if (ri.length >= 3) out[i].ring = ri; else alive[i] = false
      if (rj.length >= 3) out[j].ring = rj; else alive[j] = false
    }
  }
  // slivers: under 2.5 m² or narrower than a metre at their widest cross-section
  const widthOf = (r: XY[]) => { const h = grownHull(r, 0); let w = Infinity; for (let k = 0; k < h.length; k++) { const a = h[k], b = h[(k + 1) % h.length], l = dist(a, b); if (l < 0.2) continue; const nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l; let lo = Infinity, hi = -Infinity; for (const p of h) { const v = nx * p.x + ny * p.y; lo = Math.min(lo, v); hi = Math.max(hi, v) } w = Math.min(w, hi - lo) } return w }
  const kept = out.filter((o, i) => alive[i] && Math.abs(signedArea(o.ring)) >= 2.5 && widthOf(o.ring) >= 1).map(({ ring, plane, areaM2 }) => ({ ring, plane, areaM2 }))
  return kept.length ? kept : null
}

/* ── 5 · measure with the height model ─────────────────────────────────── */

type Fit = { pitch: number; azimuth: number; rms: number; n: number }
function fitPane(dsm: DsmData, ring: XY[], robust = true): Fit | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of ring) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  // sample the pane's interior, 0.4 m in from its edges (the edges straddle ridges and gutters)
  const pts: [number, number, number][] = []
  for (let x = minX; x <= maxX; x += 0.3) for (let y = minY; y <= maxY; y += 0.3) {
    const p = { x, y }; if (!inPoly(p, ring)) continue
    let edge = Infinity; for (let k = 0; k < ring.length; k++) edge = Math.min(edge, segDist(p, ring[k], ring[(k + 1) % ring.length]).d)
    if (edge < (dsm.resM >= 0.45 ? 0.8 : 0.4)) continue // LiDAR is coarser — stay further from ridges and gutters
    const z = sampleHeight(dsm, x, y); if (z > 0.5) pts.push([x, y, z])
  }
  if (pts.length < 20) return null
  // least-squares plane z = a·x + b·y + c, refitted twice without the worst 20% of points — so a chimney, a
  // dormer edge or the ridge blur in 1 m LiDAR can't tilt the whole pane
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const fit = (P: [number, number, number][]) => {
    let Sxx = 0, Sxy = 0, Sx = 0, Syy = 0, Sy = 0, Sxz = 0, Syz = 0, Sz = 0
    for (const [x, y, z] of P) { Sxx += x * x; Sxy += x * y; Sx += x; Syy += y * y; Sy += y; Sxz += x * z; Syz += y * z; Sz += z }
    const M = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, P.length]], B = [Sxz, Syz, Sz]
    const d = det(M); if (Math.abs(d) < 1e-9) return null
    return [0, 1, 2].map((k) => det(M.map((row, i) => row.map((v, j) => (j === k ? B[i] : v)))) / d)
  }
  let use = pts, sol = fit(use)
  for (let it = 0; it < (robust ? 2 : 0) && sol; it++) {
    const [a0, b0, c0] = sol
    const err = (p: [number, number, number]) => Math.abs(p[2] - (a0 * p[0] + b0 * p[1] + c0))
    const cut = use.map(err).sort((x, y) => x - y)[Math.floor(use.length * 0.8)]
    const next = use.filter((p) => err(p) <= cut)
    if (next.length < 15) break
    use = next; sol = fit(use)
  }
  if (!sol) return null
  const [a, b, c] = sol
  const rms = Math.sqrt(use.reduce((s, [x, y, z]) => s + (z - (a * x + b * y + c)) ** 2, 0) / use.length)
  return { pitch: Math.atan(Math.hypot(a, b)) / DEG, azimuth: ((Math.atan2(-a, -b) / DEG) + 360) % 360, rms, n: use.length }
}

/* ── the whole pipeline ────────────────────────────────────────────────── */

const outwardAz = (r: XY[], i: number) => { const a = r[i], b = r[(i + 1) % r.length]; return ((Math.atan2(b.y - a.y, -(b.x - a.x)) / DEG) + 360) % 360 } // azimuth (from N) the pane on wall i faces
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compassOf = (az: number) => COMPASS[Math.round((((az % 360) + 360) % 360) / 45) % 8]
const polyArea = (ring: XY[]) => Math.abs(signedArea(ring))

export type PaneResult = { planes: DesignPlane[]; model: RoofModel; outlineSource: 'google' | 'osm'; measured: boolean; message: string }

/** Build DesignPlanes from an outline + roles (and optional height model). */
function planesFrom(origin: LatLng, r: XY[], roles: EdgeRole[], dsm: DsmData | null): { planes: DesignPlane[]; roles: EdgeRole[]; measured: boolean } {
  const f = frame(origin)
  let pitch = r.map(() => ASSUMED_PITCH)
  let panes = splitPanes(r, roles, pitch)
  let fits: (Fit | null)[] = panes.map(() => null)
  if (dsm) {
    // MODEL SELECTION: build each plausible roof over this outline — gabled, gabled across the other way, hipped,
    // flat — and keep the one whose planes fit the measured heights best. The height data decides the shape;
    // nothing is guessed from wall lengths when it doesn't have to be.
    const party = roles.map((x) => x === 'party')
    const swap = roles.map((x) => (x === 'party' ? 'party' : x === 'gable' ? 'eave' : 'gable')) as EdgeRole[]
    const hyps: EdgeRole[][] = [roles, defaultRoles(r, party, 'gable'), defaultRoles(r, party, 'hip'), ...(swap.filter((x) => x === 'eave').length >= 2 ? [swap] : [])]
      .filter((h, i, a) => a.findIndex((o) => o.join() === h.join()) === i)
    const score = (ps: Pane[]) => {
      let sse = 0, n = 0, missed = 0
      for (const p of ps) { const ft = fitPane(dsm, p.ring, false); if (!ft) { missed += polyArea(p.ring); continue } sse += ft.rms * ft.rms * ft.n; n += ft.n }
      return n ? Math.sqrt(sse / n) + (missed / Math.max(1, polyArea(r))) * 0.5 : Infinity
    }
    let best = { roles, panes, rms: score(panes) }
    for (const h of hyps) { const ps = splitPanes(r, h, pitch); const s = score(ps); if (s < best.rms - 0.02) best = { roles: h, panes: ps, rms: s } }
    const whole = fitPane(dsm, r, false)
    if (whole && whole.pitch < 8 && whole.rms < best.rms * 0.85) { // a flat roof fits better than any pitched one
      best = { roles: r.map(() => 'gable' as EdgeRole), panes: [{ edge: 0, ring: r, areaM2: polyArea(r) }], rms: whole.rms }
    }
    roles = best.roles; panes = best.panes
    fits = panes.map((p) => fitPane(dsm, p.ring))
    // re-split with each wall's measured pitch, so ridges sit where unequal slopes actually meet
    let reSplit = false
    panes.forEach((p, i) => { const ft = fits[i]; if (ft && ft.rms <= 0.45 && ft.pitch >= 8 && ft.pitch <= 60) { pitch[p.edge] = ft.pitch; reSplit = true } })
    if (reSplit && panes.length > 1) { panes = splitPanes(r, roles, pitch); fits = panes.map((p) => fitPane(dsm, p.ring)) }
  }
  let measured = false
  const planes: DesignPlane[] = panes.map((p) => {
    const ft = fits[panes.indexOf(p)]
    const facingOff = ft ? Math.abs(((ft.azimuth - outwardAz(r, p.edge) + 540) % 360) - 180) : 180
    // trust a measurement only if it's a believable roof: under 60°, a clean plane, sloping the way its wall faces (or flat)
    const good = !!ft && ft.rms <= 0.45 && ft.pitch <= 60 && (ft.pitch < 6 || facingOff <= 50)
    const flat = good && ft!.pitch < 6
    if (good) measured = true
    const az = flat ? 180 : Math.round(outwardAz(r, p.edge))
    const pt = good ? Math.round(ft!.pitch) : ASSUMED_PITCH
    return {
      id: uid('pl'), name: flat ? 'Flat roof' : `${compassOf(az)}-facing pane`,
      polygon: p.ring.map(f.toLL), pitchDeg: flat ? 0 : pt, azimuthDeg: az, areaM2: Math.round(polyArea(p.ring)),
      source: 'google' as const, racking: 'flush' as const, pitchSource: good ? 'measured' as const : 'assumed' as const,
    }
  }).sort((a, b) => b.areaM2 - a.areaM2)
  // panes we couldn't measure take the measured median — both sides of a gable almost always share a pitch
  const got = planes.filter((p) => p.pitchSource === 'measured' && p.pitchDeg >= 6).map((p) => p.pitchDeg).sort((a, b) => a - b)
  if (got.length) { const med = got[Math.floor(got.length / 2)]; for (const p of planes) if (p.pitchSource === 'assumed') p.pitchDeg = med }
  return { planes, roles, measured }
}

/** Detect the building at `center` and split its roof into panes. */
export async function detectRoofPanes(center: LatLng, style: RoofStyle = 'gable', onStep?: (s: string) => void): Promise<PaneResult | null> {
  const f = frame(center)
  onStep?.('Finding the building outline…')
  const [mask, osm] = await Promise.all([fetchBuildingOutline(center.lat, center.lng).catch(() => null), osmBuildings(center)])
  // OSM first: it's traced per house. Google's mask merges terraces and neighbours into one blob, so it's only the
  // fallback where OSM has no building here. Google's height model still measures the pitch either way.
  const outlineLL = osm.target ?? (mask && mask.length >= 4 ? mask : null)
  if (!outlineLL) return null
  const source: 'google' | 'osm' = osm.target ? 'osm' : 'google'
  const raw = cleanRing(outlineLL.map(f.toXY))
  // Google's shape is traced from pixels — square it up to the building's main axis (OSM outlines are already drawn by hand)
  // A Google shape often spans a whole terrace — cut it to this house's Land Registry title (party walls = title lines)
  let piece = raw, clippedToTitle = false
  if (source === 'google') {
    const title = await titleBoundary(center)
    const cut = title ? intersectRings(raw, title.map(f.toXY)) : null
    if (cut && Math.abs(signedArea(cut)) < Math.abs(signedArea(raw)) * 0.9) { piece = cleanRing(cut); clippedToTitle = true }
  }
  // OSM outlines carry 20–40 cm jogs (bay windows, drainpipes traced by hand) that become extra pane corners — drop them
  const r0 = source === 'google' ? cleanRing(regularizeRingMetric(piece)) : piece
  const rt = mergeShortEdges(dropCollinear(r0, 0.3), 0.7)
  const r = rt.length >= 3 && Math.abs(Math.abs(signedArea(rt)) - Math.abs(signedArea(r0))) < Math.abs(signedArea(r0)) * 0.05 ? rt : r0
  if (r.length < 3) return null
  onStep?.('Reading walls, gables and party walls…')
  const party = partyWalls(r, osm.others.map((o) => o.map(f.toXY)))
  let roles = defaultRoles(r, party, style)
  onStep?.('Fetching roof heights (Google or LiDAR)…')
  const ext = Math.max(...r.map((p) => Math.hypot(p.x, p.y)))

  // Heights: Google's DSM where it works, else free government LiDAR (England) — either way the pitch is MEASURED
  let heightSource = ''
  let dsm: DsmData | null = await fetchDsm(center.lat, center.lng, Math.min(100, Math.ceil(ext + 6)), 0.25).catch(() => null)
  if (dsm) heightSource = 'Google height model'
  else { const l = await fetchLidarDsm(center.lat, center.lng, Math.min(60, Math.ceil(ext + 6))).catch(() => null); if (l) { dsm = l; heightSource = 'Environment Agency LiDAR' } }
  // BEST: cut the panes straight from Google's 3D surface (10 cm) — the same data the 3D view draws. Used whenever
  // it covers most of the house; the outline skeleton below is the fallback (LiDAR / no height data).
  if (heightSource === 'Google height model') {
    onStep?.('Cutting the panes from the 3D roof surface…')
    const fine = await fetchDsm(center.lat, center.lng, Math.min(40, Math.ceil(ext + 3)), 0.1).catch(() => null)
    let rs = r
    let hp = fine ? panesFromHeights(fine, rs) : null
    // Square the walls to the ridge the height model actually shows (title lines and traced shapes are a little skew):
    // the ridge runs along the intersection of the two biggest non-parallel panes.
    if (hp && hp.length >= 2 && fine) {
      const [P, Q] = [...hp].sort((a, b) => b.areaM2 - a.areaM2)
      const A = P.plane.a - Q.plane.a, B = P.plane.b - Q.plane.b
      if (Math.hypot(A, B) > 0.2) {
        const sq = cleanRing(squareRing(rs, Math.atan2(-A, B)))
        const ratio = Math.abs(signedArea(sq)) / Math.max(1, Math.abs(signedArea(rs)))
        if (sq.length >= 3 && ratio > 0.85 && ratio < 1.15) { const again = panesFromHeights(fine, sq); if (again) { rs = sq; hp = again } }
      }
    }
    const covered = hp ? hp.reduce((s, p) => s + p.areaM2, 0) / Math.max(1, polyArea(rs)) : 0
    if (hp && covered >= 0.6) {
      const hpF = hp
      // Shape rules before the corners are welded: no near-collinear corners, no tiny edges, edges square to the
      // slope (eave/ridge/gable) or on its 45°s (hips), and a rectangle where it's really a rectangle.
      const wallDirs: number[] = []
      for (let k = 0; k < rs.length; k++) { const a = rs[k], b = rs[(k + 1) % rs.length]; if (dist(a, b) >= 1.5) wallDirs.push(Math.atan2(b.y - a.y, b.x - a.x)) }
      const tidied = hpF.map((p) => {
        const pl = p.plane, az = ((Math.atan2(-pl.a, -pl.b) / DEG) + 360) % 360
        return tidyRing(p.ring, { dirs: paneDirections(Math.hypot(pl.a, pl.b) > 0.1 ? az : undefined, wallDirs) })
      })
      const welded0 = weld(hpF.map((p, i) => ({ edge: i, ring: tidied[i], areaM2: p.areaM2 })), rs) // edge = index into hp (weld may drop a sliver)
      // mesh the whole roof: near-miss corners become one shared corner, T-junctions shared exactly
      const meshed = tidyRoof(welded0.map((p) => ({ ring: p.ring })), { perPane: false })
      const welded = welded0.map((p, i) => ({ ...p, ring: meshed[i] }))
      const planes: DesignPlane[] = welded.map((p) => {
        const pl = hpF[p.edge].plane
        const pitch = Math.atan(Math.hypot(pl.a, pl.b)) / DEG, flat = pitch < 6
        const az = flat ? 180 : Math.round(((Math.atan2(-pl.a, -pl.b) / DEG) + 360) % 360)
        return {
          id: uid('pl'), name: flat ? 'Flat roof' : `${compassOf(az)}-facing pane`, polygon: p.ring.map(f.toLL),
          pitchDeg: flat ? 0 : Math.round(Math.min(60, pitch)), azimuthDeg: az, areaM2: Math.round(polyArea(p.ring)),
          source: 'google' as const, racking: 'flush' as const, pitchSource: 'measured' as const,
        }
      }).filter((p) => p.areaM2 >= 2).sort((a, b) => b.areaM2 - a.areaM2)
      if (planes.length) return {
        planes, model: { outline: rs.map(f.toLL), roles, source, measured: true }, outlineSource: source, measured: true,
        message: `${planes.length} pane${planes.length === 1 ? '' : 's'} cut from Google's 3D roof surface inside the ${source === 'osm' ? 'OpenStreetMap' : 'Google'} outline${clippedToTitle ? ' (cut to the Land Registry title)' : ''} · pitch + facing measured`,
      }
    }
  }
  onStep?.(dsm ? 'Measuring each pane’s pitch from the height model…' : 'Splitting the roof into panes…')
  const res = planesFrom(center, r, roles, dsm)
  roles = res.roles
  const nParty = roles.filter((x) => x === 'party').length, nGable = roles.filter((x) => x === 'gable').length
  const message = `${res.planes.length} pane${res.planes.length === 1 ? '' : 's'} from the ${source === 'google' ? 'Google' : 'OpenStreetMap'} outline`
    + (nGable ? ` · ${nGable} gable${nGable === 1 ? '' : 's'}` : '') + (nParty ? ` · ${nParty} party wall${nParty === 1 ? '' : 's'}` : '')
    + (res.measured ? ` · pitch measured from ${heightSource}` : ` · pitch assumed ${ASSUMED_PITCH}° (no height data here)`)
  return { planes: res.planes, model: { outline: r.map(f.toLL), roles, source, measured: res.measured }, outlineSource: source, measured: res.measured, message }
}

/** Re-split a detected roof with a different style (gable ⇄ hip) or hand-set wall roles. */
export async function resplitRoof(center: LatLng, model: RoofModel, rolesOrStyle: RoofStyle | EdgeRole[]): Promise<PaneResult> {
  const f = frame(center)
  const r = model.outline.map(f.toXY)
  const party = model.roles.map((x) => x === 'party')
  const roles = Array.isArray(rolesOrStyle) ? rolesOrStyle : defaultRoles(r, party, rolesOrStyle)
  const radius = Math.min(60, Math.ceil(Math.max(...r.map((p) => Math.hypot(p.x, p.y))) + 6))
  const dsm = model.measured ? (await fetchDsm(center.lat, center.lng, radius, 0.25).catch(() => null)) ?? (await fetchLidarDsm(center.lat, center.lng, radius).catch(() => null)) : null
  const res = planesFrom(center, r, roles, dsm)
  return { planes: res.planes, model: { ...model, roles: res.roles, measured: res.measured }, outlineSource: model.source, measured: res.measured, message: `${res.planes.length} panes` }
}

export const roofStyleOf = (m?: RoofModel): RoofStyle | null => (m ? (m.roles.includes('gable') ? 'gable' : 'hip') : null)
