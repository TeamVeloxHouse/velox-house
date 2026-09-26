/**
 * Ovi's designer — lays panels out the way a good installer would, not the way a bin-packer would.
 *
 * The packer (panels.ts packWithSettings) squeezes the most modules onto a face: mixed orientations, arrays run
 * edge to edge. That's right for "how much could this roof take?", but it isn't what gets installed. A real design:
 *   · sits in the MIDDLE of each face with an even margin (no module hard against a hip or the verge),
 *   · is one orientation per face, in straight rows along the slope, columns lined up row to row,
 *   · is a clean rectangle where one fits (a rectangle within 15% of the best count wins),
 *   · has no stubby end rows or lone modules, and skips faces too small for a proper array,
 *   · hits a size target (kWp / kWh) by trimming whole rows/columns symmetrically, best faces first.
 *
 * Everything is measured in the face's own frame (rows along the contour, up-slope foreshortened by cos pitch),
 * the same frame the manual grid and 3D use, so what Ovi proposes is exactly what can be built.
 */
import type { DesignPanel, DesignPlane, PanelOrientation } from '../store/types'
import type { LatLng } from './solar'
import { projector, rot, unrot, insetXY, dominantAngle, planeSolarFactor, kwpOf, moduleById as byId, type Module } from './panels'

type XY = { x: number; y: number }
const uid = () => `pn${Date.now().toString(36)}${Math.floor(Math.random() * 1e6)}`

export type OviGoal = { kind: 'max' } | { kind: 'target-kwp'; kwp: number } | { kind: 'target-kwh'; kwh: number; yieldPerKwp: number }
export type OviOpts = { obstacles?: LatLng[][]; setbackM?: number; minYield?: number; restrict?: (p: DesignPlane) => boolean }
export type FaceNote = { planeId: string; name: string; panels: number; text: string; used: boolean }
export type OviResult = { planes: DesignPlane[]; count: number; kwp: number; notes: FaceNote[]; summary: string }

/** One face's clean layout: rows of column indices on a shared column grid. */
type Layout = {
  orientation: PanelOrientation
  rows: { y: number; cols: number[] }[] // y = row's lower edge (grid frame); cols = column indices (contiguous)
  x0: number; cw: number; pw: number; ph: number
  theta: number; proj: ReturnType<typeof projector>
  count: number; rect: boolean
}

/** Longest x-interval where the band [y0, y1] lies wholly inside the polygon and clear of the obstacles. */
function bandInterval(poly: XY[], obs: XY[][], y0: number, y1: number): [number, number] | null {
  const chords = (y: number): [number, number][] => {
    const xs: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length]
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
    }
    xs.sort((p, q) => p - q)
    const out: [number, number][] = []
    for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]])
    return out
  }
  // sample the band at 5 heights plus every polygon vertex inside it; intersect the chord sets
  const hs = [0, 0.25, 0.5, 0.75, 1].map((t) => y0 + (y1 - y0) * t).map((y, i) => (i === 0 ? y + 1e-4 : i === 4 ? y - 1e-4 : y))
  for (const v of poly) if (v.y > y0 && v.y < y1) hs.push(v.y + 1e-4, v.y - 1e-4)
  let cur: [number, number][] | null = null
  for (const y of hs) {
    const c = chords(y)
    if (!cur) { cur = c; continue }
    const nxt: [number, number][] = []
    for (const [a, b] of cur) for (const [p, q] of c) { const lo = Math.max(a, p), hi = Math.min(b, q); if (hi > lo) nxt.push([lo, hi]) }
    cur = nxt
    if (!cur.length) return null
  }
  if (!cur || !cur.length) return null
  // obstacles overlapping the band cut the intervals
  for (const o of obs) {
    const oy0 = Math.min(...o.map((p) => p.y)), oy1 = Math.max(...o.map((p) => p.y))
    if (oy1 <= y0 || oy0 >= y1) continue
    const ox0 = Math.min(...o.map((p) => p.x)), ox1 = Math.max(...o.map((p) => p.x))
    cur = cur.flatMap(([a, b]): [number, number][] => (ox1 <= a || ox0 >= b ? [[a, b]] : [...(ox0 > a ? [[a, ox0] as [number, number]] : []), ...(ox1 < b ? [[ox1, b] as [number, number]] : [])]))
  }
  if (!cur.length) return null
  return cur.reduce((m, iv) => (iv[1] - iv[0] > m[1] - m[0] ? iv : m))
}

/** The best clean layout of one face in one orientation. */
function layoutFace(plane: DesignPlane, module: Module, orientation: PanelOrientation, setback: number, obstacles: LatLng[][]): Layout | null {
  const poly = plane.polygon
  if (poly.length < 3) return null
  const origin = poly.reduce((a, p) => ({ lat: a.lat + p.lat / poly.length, lng: a.lng + p.lng / poly.length }), { lat: 0, lng: 0 })
  const proj = projector(origin)
  const XYp = poly.map(proj.toXY)
  const tilt = plane.racking && plane.racking !== 'flush' ? (plane.tiltDeg ?? 10) : plane.pitchDeg
  const pitched = tilt >= 3
  const theta = (pitched ? -(plane.azimuthDeg * Math.PI) / 180 : dominantAngle(XYp)) + ((plane.arrayAngleDeg ?? 0) * Math.PI) / 180
  const R = XYp.map((p) => rot(p, theta))
  const Rin = insetXY(R, setback)
  const obs = obstacles.map((o) => insetXY(o.map((p) => rot(proj.toXY(p), theta)), -0.2)).filter((o) => o.length >= 3)
  const fore = pitched ? Math.cos((tilt * Math.PI) / 180) : 1
  const gap = plane.panelGapM ?? 0.02
  const pw = orientation === 'portrait' ? module.w : module.h
  const ph = (orientation === 'portrait' ? module.h : module.w) * fore
  const cw = pw + gap, ch = ph + (plane.rowGapM ?? gap) * fore
  const minY = Math.min(...Rin.map((p) => p.y)), maxY = Math.max(...Rin.map((p) => p.y))
  const minX = Math.min(...Rin.map((p) => p.x)), maxX = Math.max(...Rin.map((p) => p.x))
  if (maxY - minY < ph || maxX - minX < pw) return null
  // usable-area centre (for centring)
  let cx = 0, cy = 0, ca = 0
  for (let i = 0; i < Rin.length; i++) { const a = Rin[i], b = Rin[(i + 1) % Rin.length], k = a.x * b.y - b.x * a.y; cx += (a.x + b.x) * k; cy += (a.y + b.y) * k; ca += k }
  if (Math.abs(ca) > 1e-6) { cx /= 3 * ca; cy /= 3 * ca } else { cx = (minX + maxX) / 2; cy = (minY + maxY) / 2 }

  let best: (Omit<Layout, 'orientation' | 'pw' | 'ph' | 'theta' | 'proj' | 'cw'> & { off: number }) | null = null
  const STEP = 0.05
  for (let oy = 0; oy < ch; oy += STEP) {
    // rows and their free intervals for this vertical phase
    const bands: { y: number; iv: [number, number] | null }[] = []
    for (let y = minY + oy; y + ph <= maxY + 1e-6; y += ch) bands.push({ y, iv: bandInterval(Rin, obs, y, y + ph) })
    if (!bands.length) continue
    for (let ox = 0; ox < cw; ox += STEP) {
      const x0 = minX + ox
      let rows = bands.map((b) => {
        if (!b.iv) return { y: b.y, cols: [] as number[] }
        const c0 = Math.ceil((b.iv[0] - x0) / cw - 1e-9), c1 = Math.floor((b.iv[1] - pw - x0) / cw + 1e-9)
        const cols: number[] = []; for (let c = c0; c <= c1; c++) cols.push(c)
        return { y: b.y, cols }
      })
      // no stubby rows: a row under 60% of the longest (min 2) goes; then keep the biggest run of consecutive rows
      const longest = Math.max(0, ...rows.map((r) => r.cols.length))
      if (longest === 0) continue
      const minRow = Math.max(2, Math.ceil(longest * 0.6)) // rows of similar length read as one array; a 2 under a 5 looks like an afterthought
      rows = rows.map((r) => (r.cols.length >= minRow ? r : { ...r, cols: [] }))
      let runBest: typeof rows = [], run: typeof rows = []
      for (const r of rows) { if (r.cols.length) run.push(r); else { if (run.reduce((s, q) => s + q.cols.length, 0) > runBest.reduce((s, q) => s + q.cols.length, 0)) runBest = run; run = [] } }
      if (run.reduce((s, q) => s + q.cols.length, 0) > runBest.reduce((s, q) => s + q.cols.length, 0)) runBest = run
      rows = runBest
      if (!rows.length) continue
      // a clean rectangle (columns every row shares) wins if it keeps ≥ 85% of the modules
      const lo = Math.max(...rows.map((r) => r.cols[0])), hi = Math.min(...rows.map((r) => r.cols[r.cols.length - 1]))
      const free = rows.reduce((s, r) => s + r.cols.length, 0)
      const rectN = hi >= lo ? (hi - lo + 1) * rows.length : 0
      let rect = false
      if (rectN >= free * 0.85 && rectN > 0) { rows = rows.map((r) => ({ ...r, cols: r.cols.filter((c) => c >= lo && c <= hi) })); rect = true }
      const count = rows.reduce((s, r) => s + r.cols.length, 0)
      // centring: block centre (weighted) vs usable-area centre
      let bx = 0, by = 0
      for (const r of rows) for (const c of r.cols) { bx += x0 + c * cw + pw / 2; by += r.y + ph / 2 }
      const off = Math.hypot(bx / count - cx, by / count - cy)
      if (!best || count > best.count || (count === best.count && (rect && !best.rect || (rect === best.rect && off < best.off - 0.01)))) best = { rows, x0, count, rect, off }
    }
  }
  if (!best) return null
  return { orientation, rows: best.rows, x0: best.x0, cw, pw, ph, theta, proj, count: best.count, rect: best.rect }
}

/** Trim a layout to k modules, keeping it neat: drop whole end rows first (the shorter end), then take columns
 *  off alternate ends of the longest rows so the block stays centred. */
function trimLayout(L: Layout, k: number): Layout {
  let rows = L.rows.map((r) => ({ ...r, cols: [...r.cols] }))
  let n = rows.reduce((s, r) => s + r.cols.length, 0)
  while (n > k && rows.length > 1) {
    const end = rows[0].cols.length <= rows[rows.length - 1].cols.length ? 0 : rows.length - 1
    if (n - rows[end].cols.length < k) break
    n -= rows[end].cols.length; rows.splice(end, 1)
  }
  let side = 0
  while (n > k) {
    const maxLen = Math.max(...rows.map((r) => r.cols.length))
    const r = rows.find((q) => q.cols.length === maxLen)!
    if (side++ % 2) r.cols.pop(); else r.cols.shift()
    n--
  }
  rows = rows.filter((r) => r.cols.length)
  const lo = Math.max(...rows.map((r) => r.cols[0])), hi = Math.min(...rows.map((r) => r.cols[r.cols.length - 1]))
  return { ...L, rows, count: n, rect: rows.every((r) => r.cols[0] === lo && r.cols[r.cols.length - 1] === hi) }
}

/** For a size target: the neatest RECTANGLE (r rows × c columns, centred in the face's layout) within one module
 *  of the target — an installer rounds 14 to a tidy 3 × 5 rather than a ragged 4-5-5. Null if none is that close. */
function rectNear(L: Layout, want: number): Layout | null {
  const lo = Math.max(...L.rows.map((r) => r.cols[0])), hi = Math.min(...L.rows.map((r) => r.cols[r.cols.length - 1]))
  if (hi < lo) return null
  let best: { r: number; c: number; d: number } | null = null
  for (let r = 1; r <= L.rows.length; r++) for (let c = 1; c <= hi - lo + 1; c++) {
    const d = Math.abs(r * c - want)
    if (d > 1 || (r > 1 && c < 2)) continue
    if (!best || d < best.d || (d === best.d && (c > best.c || (c === best.c && r * c >= want)))) best = { r, c, d }
  }
  if (!best) return null
  const r0 = Math.floor((L.rows.length - best.r) / 2), c0 = lo + Math.floor((hi - lo + 1 - best.c) / 2)
  const rows = L.rows.slice(r0, r0 + best.r).map((q) => ({ ...q, cols: Array.from({ length: best!.c }, (_, k) => c0 + k) }))
  return { ...L, rows, count: best.r * best.c, rect: true }
}

function panelsOf(L: Layout): DesignPanel[] {
  const out: DesignPanel[] = []
  for (const r of L.rows) for (const c of r.cols) {
    const x = L.x0 + c * L.cw, y = r.y
    const corners: XY[] = [{ x: x + 0.02, y: y + 0.02 }, { x: x + L.pw - 0.02, y: y + 0.02 }, { x: x + L.pw - 0.02, y: y + L.ph - 0.02 }, { x: x + 0.02, y: y + L.ph - 0.02 }]
    out.push({ id: uid(), corners: corners.map((q) => L.proj.toLL(unrot(q, L.theta))) })
  }
  return out
}

const compass = (az: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((az % 360) + 360) % 360) / 45) % 8]
const describe = (L: Layout) => {
  const lens = L.rows.map((r) => r.cols.length)
  const same = lens.every((l) => l === lens[0])
  return `${L.count} ${L.orientation} in ${lens.length === 1 ? `one row of ${lens[0]}` : same ? `${lens.length} rows of ${lens[0]}` : `${lens.length} rows (${lens.join('-')})`}${L.rect ? ', a clean rectangle' : ''}, centred on the face`
}

/** Design the whole roof toward a goal. */
export function oviDesign(planes: DesignPlane[], module: Module, goal: OviGoal, opts: OviOpts = {}): OviResult {
  const setback = Math.max(0.5, opts.setbackM ?? 0.3) // installers keep ~0.5 m clear of verges, hips and ridges
  const minYield = opts.minYield ?? 0.7 // E/W (~80%) yes, NE/NW/N (≤ 68%) no — what an installer would propose
  const notes: FaceNote[] = []
  // each face's best clean layout (whichever orientation fits more; portrait on a tie — the UK norm)
  const cand = planes.map((p) => {
    const tilt = p.racking && p.racking !== 'flush' ? (p.tiltDeg ?? 10) : p.pitchDeg
    const yieldF = planeSolarFactor({ azimuthDeg: p.azimuthDeg, pitchDeg: tilt })
    const orients: PanelOrientation[] = p.orientation ? [p.orientation] : ['portrait', 'landscape']
    let L: Layout | null = null
    // generous 0.5 m margin by default; the tighter 0.35 m only when it wins a whole extra row / ≥15% more modules
    const best = (sb: number) => { let b: Layout | null = null; for (const o of orients) { const l = layoutFace(p, moduleById(p, module), o, sb, opts.obstacles ?? []); if (l && (!b || l.count > b.count)) b = l } return b }
    L = best(p.setbackM ?? setback)
    if (p.setbackM == null) { const tight = best(0.35); if (tight && tight.count >= Math.max((L?.count ?? 0) + 1, Math.ceil((L?.count ?? 0) * 1.15))) L = tight }
    return { p, L, yieldF }
  })
  const order = cand.map((c, i) => ({ ...c, i })).sort((a, b) => b.yieldF * (b.L?.count ?? 0) - a.yieldF * (a.L?.count ?? 0))
  const target = goal.kind === 'target-kwp' ? Math.max(1, Math.round((goal.kwp * 1000) / module.watts)) : Infinity
  const out = planes.map((p) => ({ ...p, panels: [] as DesignPanel[] }))
  let placed = 0, kwh = 0
  for (const { p, L, yieldF, i } of order) {
    const name = `${compass(p.azimuthDeg)} ${p.pitchDeg}°`
    if (opts.restrict && !opts.restrict(p)) { notes.push({ planeId: p.id, name, panels: 0, used: false, text: 'left out by the brief' }); continue }
    const offSouth = Math.abs((((p.azimuthDeg - 180) % 360) + 540) % 360 - 180)
    if (!opts.restrict && offSouth > 112 && p.pitchDeg >= 12) { notes.push({ planeId: p.id, name, panels: 0, used: false, text: `skipped — a ${compass(p.azimuthDeg)}-facing slope (${Math.round(yieldF * 100)}% of an ideal roof) isn't worth the panels` }); continue }
    if (!opts.restrict && yieldF < minYield) { notes.push({ planeId: p.id, name, panels: 0, used: false, text: `skipped — faces ${compass(p.azimuthDeg)}, only ${Math.round(yieldF * 100)}% of an ideal roof's output` }); continue }
    if (!L || L.count < (opts.restrict ? 1 : 3)) { notes.push({ planeId: p.id, name, panels: 0, used: false, text: 'too small for a proper array once the edges are kept clear' }); continue }
    if (placed >= target || (goal.kind === 'target-kwh' && kwh >= goal.kwh)) { notes.push({ planeId: p.id, name, panels: 0, used: false, text: 'not needed — the target is already met' }); continue }
    let lay = L
    let want = L.count
    if (goal.kind === 'target-kwp') want = Math.min(want, target - placed)
    if (goal.kind === 'target-kwh') { const per = (module.watts / 1000) * goal.yieldPerKwp * yieldF; want = Math.min(want, Math.ceil((goal.kwh - kwh) / Math.max(1, per))) }
    if (want < L.count) {
      if (want < 3 && placed > 0) { notes.push({ planeId: p.id, name, panels: 0, used: false, text: `only ${want} more needed — not worth a separate array` }); continue }
      lay = rectNear(L, want) ?? trimLayout(L, want)
    }
    out[i] = { ...out[i], panels: panelsOf(lay), orientation: lay.orientation, moduleId: p.moduleId ?? module.id }
    placed += lay.count
    if (goal.kind === 'target-kwh') kwh += lay.count * (module.watts / 1000) * goal.yieldPerKwp * yieldF
    notes.push({ planeId: p.id, name, panels: lay.count, used: true, text: describe(lay) + (lay.count < L.count ? ` (room for ${L.count})` : '') })
  }
  const kwp = kwpOf(placed, module.watts)
  const used = notes.filter((n) => n.used).length
  const summary = placed
    ? `${placed} panels · ${kwp} kWp on ${used} face${used === 1 ? '' : 's'} — each array centred with clear margins${goal.kind === 'target-kwp' ? `, sized to ${goal.kwp} kWp` : goal.kind === 'max' ? ', the most that looks right on this roof' : ''}`
    : 'No face can take a proper array'
  const short = goal.kind === 'target-kwp' && kwp < goal.kwp - 0.5
  if (short) notes.push({ planeId: '_short', name: 'Target', panels: 0, used: false, text: `the good faces top out at ${kwp} kWp — ${goal.kwp} kWp would need the north/east-facing slopes or a bigger module` })
  return { planes: out, count: placed, kwp, notes, summary }
}

/** a face may carry its own module choice */
function moduleById(p: DesignPlane, fallback: Module): Module { return p.moduleId ? byId(p.moduleId) : fallback }
