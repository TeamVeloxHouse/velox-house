/**
 * Roof-pane shape rules — what a real roof face looks like, and how to make a traced one look like that.
 *
 * Real panes are simple: rectangles, trapezoids, triangles, the odd L or 5–6 sided hip end. Their edges run along
 * the slope's contour (eaves, ridge), down its fall line (gables), or at ~45° to it (hips and valleys, when the
 * neighbouring slopes share a pitch). Anything else — a row of near-collinear corners along one wall, a 30 cm jog,
 * an edge 4° off square — is tracing noise from the height model or the outline, not the roof.
 *
 * tidyRing() applies those rules in order, and each step is only kept if the shape still matches the original
 * (area within ±8%, no corner moved more than 1.2 m, no self-crossing). paneQuality() scores a pane against the same
 * rules so the editor can flag the ones that need a look.
 */
import type { LatLng } from './solar'

export type XY = { x: number; y: number }
const DEG = Math.PI / 180

export function metricFrame(o: LatLng) {
  const mLat = 110540, mLng = 111320 * Math.cos(o.lat * DEG)
  return {
    toXY: (p: LatLng): XY => ({ x: (p.lng - o.lng) * mLng, y: (p.lat - o.lat) * mLat }),
    toLL: (q: XY): LatLng => ({ lat: o.lat + q.y / mLat, lng: o.lng + q.x / mLng }),
  }
}

const signedArea = (r: XY[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.y - q.x * p.y } return a / 2 }
const areaOf = (r: XY[]) => Math.abs(signedArea(r))
const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y)
function chordDist(p: XY, a: XY, b: XY) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy
  if (L2 < 1e-9) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
function crosses(r: XY[]) {
  const n = r.length
  const inter = (a: XY, b: XY, c: XY, d: XY) => {
    const o = (p: XY, q: XY, s: XY) => Math.sign((q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x))
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
  }
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue
    if (inter(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true
  }
  return false
}
const lineX = (p1: XY, d1: XY, p2: XY, d2: XY): XY | null => {
  const den = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(den) < 0.15) return null // near-parallel
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t }
}

/** 1 · drop corners that sit (within tol m) on the straight line between their neighbours — least important first. */
export function dropCollinear(r0: XY[], tol = 0.25): XY[] {
  let r = r0.filter((p, i) => dist(p, r0[(i + 1) % r0.length]) > 0.05)
  for (;;) {
    if (r.length <= 3) return r
    let best = -1, bd = tol
    for (let i = 0; i < r.length; i++) {
      const d = chordDist(r[i], r[(i - 1 + r.length) % r.length], r[(i + 1) % r.length])
      if (d < bd) { bd = d; best = i }
    }
    if (best < 0) return r
    r = r.filter((_, i) => i !== best)
  }
}

/** 2 · collapse edges shorter than minEdge: the two corners become the meeting point of the edges either side. */
export function mergeShortEdges(r0: XY[], minEdge = 0.6): XY[] {
  let r = r0.slice()
  for (let guard = 0; guard < 50 && r.length > 3; guard++) {
    const n = r.length
    let k = -1, kl = minEdge
    for (let i = 0; i < n; i++) { const l = dist(r[i], r[(i + 1) % n]); if (l < kl) { kl = l; k = i } }
    if (k < 0) break
    const a = r[(k - 1 + n) % n], b = r[k], c = r[(k + 1) % n], d = r[(k + 2) % n]
    const q = lineX(a, { x: b.x - a.x, y: b.y - a.y }, d, { x: c.x - d.x, y: c.y - d.y })
    const mid = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
    const pt = q && dist(q, mid) < minEdge * 2 + 0.3 ? q : mid
    r = r.flatMap((p, i) => (i === k ? [pt] : i === (k + 1) % n ? [] : [p]))
  }
  return r
}

/** Directions (radians, mod π) a pane's edges should follow: its contour (eave/ridge), fall line, and the 45°s (hips). */
export function paneDirections(azimuthDeg?: number, extra: number[] = []): number[] {
  const out = [...extra]
  if (azimuthDeg != null) {
    const fall = Math.atan2(Math.cos(azimuthDeg * DEG), Math.sin(azimuthDeg * DEG)) // compass → maths angle of the downslope
    const contour = fall + Math.PI / 2
    out.push(contour, fall, contour + Math.PI / 4, contour - Math.PI / 4)
  }
  return out.map((t) => ((t % Math.PI) + Math.PI) % Math.PI)
}

/** 3 · rotate each edge (about its midpoint) onto the nearest allowed direction within tolDeg, then re-intersect. */
export function snapToDirections(r: XY[], dirs: number[], tolDeg = 12): XY[] {
  if (!dirs.length || r.length < 3) return r
  const n = r.length, tol = tolDeg * DEG
  const lines = r.map((a, i) => {
    const b = r[(i + 1) % n], t = Math.atan2(b.y - a.y, b.x - a.x)
    const u = ((t % Math.PI) + Math.PI) % Math.PI
    let best = t, bd = tol
    for (const d of dirs) { const e = Math.min(Math.abs(u - d), Math.PI - Math.abs(u - d)); if (e < bd) { bd = e; best = d } }
    return { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: { x: Math.cos(best), y: Math.sin(best) } }
  })
  const out = r.map((orig, i) => {
    const L1 = lines[(i - 1 + n) % n], L2 = lines[i]
    const q = lineX(L1.p, L1.d, L2.p, L2.d)
    if (q) return q
    // parallel neighbours (a small step): put the corner on the average of the two lines
    const pr = (L: typeof L1) => { const t = (orig.x - L.p.x) * L.d.x + (orig.y - L.p.y) * L.d.y; return { x: L.p.x + L.d.x * t, y: L.p.y + L.d.y * t } }
    const a = pr(L1), b = pr(L2)
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  })
  return out.some((q, i) => dist(q, r[i]) > 1.2) ? r : out
}

/** 4 · if the shape is essentially a rectangle (fills ≥ fill of its box along the main direction), make it one. */
export function rectangleFit(r: XY[], theta: number, fill = 0.95): XY[] | null {
  const c = Math.cos(theta), s = Math.sin(theta)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of r) { const u = p.x * c + p.y * s, v = -p.x * s + p.y * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v) }
  const box = (x1 - x0) * (y1 - y0)
  if (box <= 0 || areaOf(r) / box < fill) return null
  const back = (u: number, v: number): XY => ({ x: u * c - v * s, y: u * s + v * c })
  const rect = [back(x0, y0), back(x1, y0), back(x1, y1), back(x0, y1)]
  return signedArea(rect) * signedArea(r) < 0 ? rect.reverse() : rect
}

export type TidyOpts = { dirs?: number[]; collinearTol?: number; minEdge?: number; snapDeg?: number; rectFill?: number | false }

/** The full clean-up: collinear → short edges → square to the slope → collinear again → rectangle if it is one.
 *  Every step is checked against the original and skipped if it would change the pane materially. */
export function tidyRing(r0: XY[], o: TidyOpts = {}): XY[] {
  if (r0.length < 3) return r0
  const A0 = areaOf(r0)
  const ok = (r: XY[]) => r.length >= 3 && !crosses(r) && Math.abs(areaOf(r) - A0) <= A0 * 0.08
  let r = r0
  const step = (f: (x: XY[]) => XY[]) => { const q = f(r); if (ok(q)) r = q }
  step((x) => dropCollinear(x, o.collinearTol ?? 0.25))
  step((x) => mergeShortEdges(x, o.minEdge ?? 0.6))
  // default directions: the longest edge's square + 45s
  let longest = 0, lt = 0
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], l = dist(a, b); if (l > longest) { longest = l; lt = Math.atan2(b.y - a.y, b.x - a.x) } }
  const dirs = o.dirs?.length ? o.dirs : paneDirections(undefined, [lt, lt + Math.PI / 2, lt + Math.PI / 4, lt - Math.PI / 4])
  step((x) => snapToDirections(x, dirs, o.snapDeg ?? 12))
  step((x) => dropCollinear(x, Math.min(0.12, o.collinearTol ?? 0.25)))
  if (o.rectFill !== false && r.length > 4) {
    let L = 0, T = 0
    for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], l = dist(a, b); if (l > L) { L = l; T = Math.atan2(b.y - a.y, b.x - a.x) } }
    const rf = rectangleFit(r, T, o.rectFill ?? 0.95); if (rf && ok(rf)) r = rf
  }
  return r
}

/** LatLng convenience wrapper. */
export function tidyPolygon(poly: LatLng[], azimuthDeg?: number, o: Omit<TidyOpts, 'dirs'> & { extraDirs?: number[] } = {}): LatLng[] {
  if (poly.length < 3) return poly
  const f = metricFrame(poly[0])
  const r = poly.map(f.toXY)
  let longest = 0, lt = 0
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], l = dist(a, b); if (l > longest) { longest = l; lt = Math.atan2(b.y - a.y, b.x - a.x) } }
  const dirs = paneDirections(azimuthDeg, [...(o.extraDirs ?? []), ...(azimuthDeg == null ? [lt, lt + Math.PI / 2] : [])])
  return tidyRing(r, { ...o, dirs }).map(f.toLL)
}

export type PaneIssue = 'extra-corners' | 'short-edges' | 'off-square' | 'sliver' | 'overlap' | 'tiny'
export type PaneQuality = { corners: number; removable: number; shortEdges: number; offSquare: number; widthM: number; issues: PaneIssue[]; ok: boolean; summary: string }

/** Score a pane against the shape rules (and its neighbours, for overlaps). */
export function paneQuality(poly: LatLng[], azimuthDeg?: number, others: LatLng[][] = []): PaneQuality {
  const f = metricFrame(poly[0] ?? { lat: 0, lng: 0 })
  const r = poly.map(f.toXY), n = r.length
  let removable = 0, shortEdges = 0, offSquare = 0
  const otherPts = others.flat().map(f.toXY)
  const sharedPt = (p: XY) => otherPts.some((w) => dist(w, p) < 0.05)
  for (let i = 0; i < n; i++) if (n > 3 && !sharedPt(r[i]) && chordDist(r[i], r[(i - 1 + n) % n], r[(i + 1) % n]) < 0.25) removable++
  const dirs = paneDirections(azimuthDeg)
  for (let i = 0; i < n; i++) {
    const a = r[i], b = r[(i + 1) % n], l = dist(a, b)
    if (l < 0.5) shortEdges++
    if (dirs.length && l > 1) {
      const u = ((Math.atan2(b.y - a.y, b.x - a.x) % Math.PI) + Math.PI) % Math.PI
      const e = Math.min(...dirs.map((d) => Math.min(Math.abs(u - d), Math.PI - Math.abs(u - d)))) / DEG
      if (e > 2.5 && e < 12) offSquare++ // near a proper direction but not on it — tracing skew
    }
  }
  // width: narrowest extent across the shape's edge normals
  let widthM = Infinity
  for (let i = 0; i < n; i++) {
    const a = r[i], b = r[(i + 1) % n], l = dist(a, b); if (l < 0.3) continue
    const nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l
    let lo = Infinity, hi = -Infinity; for (const p of r) { const v = nx * p.x + ny * p.y; lo = Math.min(lo, v); hi = Math.max(hi, v) }
    widthM = Math.min(widthM, hi - lo)
  }
  const inRing = (p: XY, ring: XY[]) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const A = ring[i], B = ring[j]; if ((A.y > p.y) !== (B.y > p.y) && p.x < ((B.x - A.x) * (p.y - A.y)) / (B.y - A.y) + A.x) c = !c } return c }
  let overlap = 0
  for (const o of others) {
    const q = o.map(f.toXY)
    const xs = r.map((p) => p.x), ys = r.map((p) => p.y)
    for (let x = Math.min(...xs) + 0.1; x < Math.max(...xs); x += 0.25) for (let y = Math.min(...ys) + 0.1; y < Math.max(...ys); y += 0.25) if (inRing({ x, y }, r) && inRing({ x, y }, q)) overlap += 0.0625
  }
  const issues: PaneIssue[] = []
  if (removable) issues.push('extra-corners')
  if (shortEdges) issues.push('short-edges')
  if (offSquare) issues.push('off-square')
  if (widthM < 1) issues.push('sliver')
  if (overlap > 0.5) issues.push('overlap')
  if (areaOf(r) < 2.5) issues.push('tiny')
  const words: Record<PaneIssue, string> = {
    'extra-corners': `${removable} extra corner${removable === 1 ? '' : 's'}`, 'short-edges': `${shortEdges} tiny edge${shortEdges === 1 ? '' : 's'}`,
    'off-square': `${offSquare} edge${offSquare === 1 ? '' : 's'} slightly skew`, sliver: 'very narrow', overlap: `overlaps a neighbour by ${overlap.toFixed(1)} m²`, tiny: 'under 2.5 m²',
  }
  return { corners: n, removable, shortEdges, offSquare, widthM: isFinite(widthM) ? widthM : 0, issues, ok: !issues.length, summary: issues.map((i) => words[i]).join(' · ') }
}

/**
 * Tidy a WHOLE roof so the panes mesh: each pane gets the shape rules, then
 *   1 · corners of different panes within weldM of each other become ONE shared corner (their mean) — ridge ends,
 *       hip tops and valley feet meet at a single point instead of a cluster of near-misses;
 *   2 · a corner that lands on a neighbour's edge (a T-junction) is pinned onto that edge and the neighbour gets the
 *       same corner inserted, so both panes share it exactly — no slivers, no gaps, and the 3D mesh closes;
 *   3 · duplicate and newly straight corners are dropped (never one another pane uses).
 */
export function tidyRoof(panes: { ring: XY[]; azimuthDeg?: number }[], o: { weldM?: number; tjM?: number; perPane?: boolean } = {}): XY[][] {
  const weldM = o.weldM ?? 0.9, tjM = o.tjM ?? 0.25
  let rings = panes.map((p) => {
    if (o.perPane === false) return p.ring.map((q) => ({ ...q }))
    const d = paneDirections(p.azimuthDeg)
    return tidyRing(p.ring, { dirs: d.length ? d : undefined })
  })
  // 1 · weld clusters across panes (union-find over corners of DIFFERENT panes)
  const pts: { pi: number; vi: number }[] = []
  rings.forEach((r, pi) => r.forEach((_, vi) => pts.push({ pi, vi })))
  const parent = pts.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const at = (i: number) => rings[pts[i].pi][pts[i].vi]
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (pts[i].pi !== pts[j].pi && dist(at(i), at(j)) < weldM) parent[find(i)] = find(j)
  }
  const groups = new Map<number, number[]>()
  pts.forEach((_, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(i) })
  const next = rings.map((r) => r.map((p) => ({ ...p })))
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const m = { x: g.reduce((s, i) => s + at(i).x, 0) / g.length, y: g.reduce((s, i) => s + at(i).y, 0) / g.length }
    for (const i of g) next[pts[i].pi][pts[i].vi] = { ...m }
  }
  rings = next.map((r) => r.filter((p, k) => dist(p, r[(k + 1) % r.length]) > 0.05))
  // 2 · T-junctions: pin a corner onto a neighbour's edge and give the neighbour that corner too
  for (let pass = 0; pass < 1; pass++) {
    for (let a = 0; a < rings.length; a++) for (let vi = 0; vi < rings[a].length; vi++) {
      const v = rings[a][vi]
      for (let b = 0; b < rings.length; b++) {
        if (b === a) continue
        const R = rings[b]
        if (R.some((w) => dist(w, v) < 0.05)) continue // already shared
        for (let k = 0; k < R.length; k++) {
          const p = R[k], q = R[(k + 1) % R.length], L = dist(p, q); if (L < 0.5) continue
          const t = ((v.x - p.x) * (q.x - p.x) + (v.y - p.y) * (q.y - p.y)) / (L * L)
          if (t <= 0.04 || t >= 0.96) continue
          const proj = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
          if (dist(proj, v) > tjM) continue
          const existing = R.find((w) => dist(w, proj) < 0.35)
          if (existing) { rings[a][vi] = { ...existing }; break }
          rings[a][vi] = proj
          rings[b] = [...R.slice(0, k + 1), { ...proj }, ...R.slice(k + 1)]
          break
        }
      }
    }
  }
  // 3 · drop duplicates + corners that are now dead straight (8 cm), but never a corner another pane uses
  const shared = (p: XY, self: number) => rings.some((r, i) => i !== self && r.some((w) => dist(w, p) < 0.05))
  const out = rings.map((r0, i) => {
    let r = r0.filter((p, k) => dist(p, r0[(k + 1) % r0.length]) > 0.05)
    for (let guard = 0; guard < 20 && r.length > 3; guard++) {
      const k = r.findIndex((p, j) => !shared(p, i) && chordDist(p, r[(j - 1 + r.length) % r.length], r[(j + 1) % r.length]) < 0.08)
      if (k < 0) break
      r = r.filter((_, j) => j !== k)
    }
    return r.length >= 3 && !crosses(r) ? r : panes[i].ring
  })
  return guardRoof(panes.map((p) => p.ring), out)
}

/** Overlap area between two rings (20 cm sampling). */
function overlapArea(A: XY[], B: XY[]) {
  const inR = (p: XY, r: XY[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c } return c }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of A) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity
  for (const p of B) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y) }
  const X0 = Math.max(x0, bx0), X1 = Math.min(x1, bx1), Y0 = Math.max(y0, by0), Y1 = Math.min(y1, by1)
  if (X1 <= X0 || Y1 <= Y0) return 0
  let n = 0; for (let x = X0 + 0.1; x < X1; x += 0.2) for (let y = Y0 + 0.1; y < Y1; y += 0.2) if (inR({ x, y }, A) && inR({ x, y }, B)) n++
  return n * 0.04
}
/** Revert any pane the tidy made worse: more overlap with a neighbour than before (+0.3 m²), or area changed > 12%. */
function guardRoof(before: XY[][], after: XY[][]): XY[][] {
  const out = after.map((r) => r)
  for (let pass = 0; pass < 3; pass++) {
    let reverted = false
    for (let i = 0; i < out.length; i++) {
      if (out[i] === before[i]) continue
      const a0 = areaOf(before[i]), a1 = areaOf(out[i])
      let bad = Math.abs(a1 - a0) > a0 * 0.12
      for (let j = 0; j < out.length && !bad; j++) if (j !== i && overlapArea(out[i], out[j]) > overlapArea(before[i], before[j]) + 0.3) bad = true
      if (bad) { out[i] = before[i]; reverted = true }
    }
    if (!reverted) break
  }
  return out
}

/** LatLng wrapper for the editor. */
export function tidyRoofLL(planes: { polygon: LatLng[]; azimuthDeg: number; pitchDeg: number }[], o?: Parameters<typeof tidyRoof>[1]): LatLng[][] {
  if (!planes.length) return []
  const f = metricFrame(planes[0].polygon[0])
  return tidyRoof(planes.map((p) => ({ ring: p.polygon.map(f.toXY), azimuthDeg: p.pitchDeg >= 6 ? p.azimuthDeg : undefined })), o).map((r) => r.map(f.toLL))
}
