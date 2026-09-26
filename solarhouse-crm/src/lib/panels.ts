/* Panel layout engine — packs PV modules into a roof plane's polygon and returns real geo rectangles.
 * Works in a local metric frame (equirectangular around the plane centroid), aligns the grid to the
 * plane's longest edge so rows follow the building, and keeps only panels that sit fully on the roof. */
import type { LatLng } from './solar'
import type { DesignPanel, DesignPlane, PanelOrientation } from '../store/types'

// w = short side, h = long side (m). Extra fields drive the module picker + BOM.
export type Module = {
  id: string; name: string; watts: number; w: number; h: number
  brand: string; cell: string; effPct: number; priceGbp: number; warrantyYr?: number
}
export const MODULES: Module[] = [
  { id: 'm405', name: 'AC-405-MH-108', watts: 405, w: 1.134, h: 1.722, brand: 'Aiko', cell: 'N-type ABC all-black', effPct: 20.7, priceGbp: 118, warrantyYr: 25 },
  { id: 'm440', name: 'JKM440N-54HL4R', watts: 440, w: 1.134, h: 1.762, brand: 'Jinko Solar', cell: 'N-type TOPCon mono', effPct: 22.0, priceGbp: 96, warrantyYr: 30 },
  { id: 'm450', name: 'TSM-450 NEG9R', watts: 450, w: 1.134, h: 1.762, brand: 'Trina Solar', cell: 'N-type i-TOPCon', effPct: 22.5, priceGbp: 104, warrantyYr: 25 },
  { id: 'm500', name: 'LR5-66HTH-500M', watts: 500, w: 1.134, h: 1.96, brand: 'LONGi', cell: 'Hi-MO 6 half-cut', effPct: 22.5, priceGbp: 132, warrantyYr: 25 },
  { id: 'm430b', name: 'SPR-MAX3-430', watts: 430, w: 1.05, h: 1.69, brand: 'Maxeon', cell: 'Maxeon Gen III mono', effPct: 22.2, priceGbp: 205, warrantyYr: 40 },
  { id: 'm550', name: 'VSMDH-550', watts: 550, w: 1.134, h: 2.279, brand: 'JA Solar', cell: 'Bifacial half-cut', effPct: 21.3, priceGbp: 138, warrantyYr: 30 },
  { id: 'm500g', name: 'GC-500-N16', watts: 500, w: 1.134, h: 1.96, brand: 'GameChange', cell: 'N-type bifacial', effPct: 22.5, priceGbp: 129, warrantyYr: 30 },
]
export const moduleById = (id?: string) => MODULES.find((m) => m.id === id) || MODULES[1]

const DEG = Math.PI / 180
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

type XY = { x: number; y: number }
export function projector(origin: LatLng) {
  const mPerLat = 110540
  const mPerLng = 111320 * Math.cos(origin.lat * DEG)
  return {
    toXY: (p: LatLng): XY => ({ x: (p.lng - origin.lng) * mPerLng, y: (p.lat - origin.lat) * mPerLat }),
    toLL: (p: XY): LatLng => ({ lat: origin.lat + p.y / mPerLat, lng: origin.lng + p.x / mPerLng }),
  }
}
export const rot = (p: XY, a: number): XY => ({ x: p.x * Math.cos(a) + p.y * Math.sin(a), y: -p.x * Math.sin(a) + p.y * Math.cos(a) })
export const unrot = (p: XY, a: number): XY => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) })

export function pointInPoly(pt: XY, poly: XY[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < ((poly[j].x - poly[i].x) * (pt.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside
  }
  return inside
}
/** Do two simple polygons overlap? A vertex of one inside the other, or any edges crossing. Used to
 *  keep panels off obstruction keep-outs (chimneys/vents/skylights). */
function segCross(a: XY, b: XY, c: XY, d: XY): boolean {
  const o = (p: XY, q: XY, r: XY) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b)
}
export function polysOverlap(A: XY[], B: XY[]): boolean {
  for (const p of A) if (pointInPoly(p, B)) return true
  for (const p of B) if (pointInPoly(p, A)) return true
  for (let i = 0; i < A.length; i++) { const a = A[i], b = A[(i + 1) % A.length]; for (let j = 0; j < B.length; j++) { if (segCross(a, b, B[j], B[(j + 1) % B.length])) return true } }
  return false
}
/** Bearing (rad) of the polygon's longest edge — the grid aligns to this so panels follow the roof. */
export function dominantAngle(poly: XY[]): number {
  let best = 0, blen = -1
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len > blen) { blen = len; best = Math.atan2(b.y - a.y, b.x - a.x) }
  }
  return best
}

const signedArea = (poly: XY[]) => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y } return a / 2 }
/** Inset a polygon inward by d (angle-bisector offset) — the panel-safe area inside the fire setback.
 *  Robust: the per-vertex offset is clamped, and if the inset collapses/inverts (small or spiky faces)
 *  we return the original polygon so those faces still take panels. */
export function insetXY(poly: XY[], d: number): XY[] {
  const n = poly.length; if (n < 3) return poly
  const orig = signedArea(poly); const s = orig > 0 ? 1 : -1
  const nrm = (vx: number, vy: number) => { const l = Math.hypot(vx, vy) || 1; return { x: vx / l, y: vy / l } }
  const out: XY[] = []
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n], p1 = poly[i], p2 = poly[(i + 1) % n]
    const n1 = nrm(-(p1.y - p0.y) * s, (p1.x - p0.x) * s), n2 = nrm(-(p2.y - p1.y) * s, (p2.x - p1.x) * s)
    let bx = n1.x + n2.x, by = n1.y + n2.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl
    const cosHalf = Math.max(0.5, bx * n1.x + by * n1.y) // floor 0.5 → offset capped at 2× the setback
    out.push({ x: p1.x + (bx * d) / cosHalf, y: p1.y + (by * d) / cosHalf })
  }
  const inset = signedArea(out)
  // collapsed or flipped (over-eroded a small/spiky face) → keep the original so it still packs
  if (Math.sign(inset) !== Math.sign(orig) || Math.abs(inset) < Math.abs(orig) * 0.25) return poly
  return out
}

export type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number }
export type PackOpts = {
  orientation: PanelOrientation; gap?: number; setback?: number; rowGap?: number; bbox?: BBox; angleDeg?: number
  pitchDeg?: number // roof (or racking) tilt — the up-slope size of a module is shorter on plan by cos(tilt)
  azimuthDeg?: number // which way the pane faces (from north) — the grid lines up with the slope, not just the longest edge
  offsetX?: number; offsetY?: number // 0–1 shift of the grid origin, in cells — the packer tries several to fit more
  obstacles?: LatLng[][] // keep-out rings (obstruction outlines) panels must avoid
  obstacleClearance?: number // margin kept around each obstruction (m); default 0.15
}

/** A single valid module position on a plane's roof-aligned grid — indexed by (row, col) so a drag
 *  can select a perfectly aligned rectangular block of cells, never a scattered lat/lng box. */
export type GridCell = { row: number; col: number; corners: LatLng[]; center: LatLng }

/** Build the full grid of valid module positions on a plane. Rows follow the roof's longest edge,
 *  every cell sits fully inside the polygon after the fire setback, and (row,col) are contiguous
 *  integer indices — the spine of both auto-pack and precise manual placement. */
export function planeGrid(polygon: LatLng[], module: Module, opts: PackOpts): GridCell[] {
  if (polygon.length < 3) return []
  const origin = polygon.reduce((a, p) => ({ lat: a.lat + p.lat / polygon.length, lng: a.lng + p.lng / polygon.length }), { lat: 0, lng: 0 })
  const proj = projector(origin)
  const polyXY = polygon.map(proj.toXY)
  // Rows run along the slope's contour (so modules sit square to the ridge) when the pane's facing is known and
  // it's actually pitched; otherwise along the longest edge. Plus any manual array rotation.
  const pitched = opts.azimuthDeg != null && (opts.pitchDeg ?? 0) >= 3
  const theta = (pitched ? -(opts.azimuthDeg! * Math.PI) / 180 : dominantAngle(polyXY)) + (opts.angleDeg ?? 0) * (Math.PI / 180)
  const R = polyXY.map((p) => rot(p, theta)) // grid-aligned frame (x along the contour, y down/up the slope)
  // PLAN footprint: a module lying on a pitched roof is shorter on plan up the slope by cos(pitch) — without
  // this, every module was drawn ~20% too long and the array overflowed the roof in 3D.
  const fore = pitched ? Math.cos(((opts.pitchDeg ?? 0) * Math.PI) / 180) : 1
  const pw = opts.orientation === 'portrait' ? module.w : module.h // across the slope
  const ph = (opts.orientation === 'portrait' ? module.h : module.w) * fore // up the slope, on plan
  const gap = opts.gap ?? 0.02
  const rowGap = (opts.rowGap ?? gap) * fore
  const setback = opts.setback ?? 0.3
  const cw = pw + gap, ch = ph + rowGap
  // Enforce the setback from every roof EDGE (not just the bounding box): erode the polygon and keep
  // only modules whose corners fall inside it — so panels never overflow the safe zone.
  const Rin = insetXY(R, setback)
  // Obstruction keep-outs: project each obstacle ring into the grid frame and grow it by the clearance;
  // any module cell overlapping one is dropped, so auto-fill flows around vents/skylights/chimneys.
  const clearance = opts.obstacleClearance ?? 0.15
  const obs = (opts.obstacles ?? [])
    .map((o) => o.map((p) => rot(proj.toXY(p), theta)))
    .map((o) => (clearance > 0 ? insetXY(o, -clearance) : o))
    .filter((o) => o.length >= 3)

  const minX = Math.min(...R.map((p) => p.x)), maxX = Math.max(...R.map((p) => p.x))
  const minY = Math.min(...R.map((p) => p.y)), maxY = Math.max(...R.map((p) => p.y))

  const cells: GridCell[] = []
  let row = 0
  for (let y = minY + ((opts.offsetY ?? 0) % 1) * ch; y + ph <= maxY; y += ch, row++) {
    let col = 0
    for (let x = minX + ((opts.offsetX ?? 0) % 1) * cw; x + pw <= maxX; x += cw, col++) {
      // corners of the cell in the grid frame (inset a hair so touching edges still count as in)
      const corners: XY[] = [
        { x: x + 0.02, y: y + 0.02 }, { x: x + pw - 0.02, y: y + 0.02 },
        { x: x + pw - 0.02, y: y + ph - 0.02 }, { x: x + 0.02, y: y + ph - 0.02 },
      ]
      if (!corners.every((c) => pointInPoly(c, Rin))) continue
      if (obs.length && obs.some((o) => polysOverlap(corners, o))) continue // sits on an obstruction
      const cornersLL = corners.map((c) => proj.toLL(unrot(c, theta)))
      const centerLL = proj.toLL(unrot({ x: x + pw / 2, y: y + ph / 2 }, theta))
      cells.push({ row, col, corners: cornersLL, center: centerLL })
    }
  }
  return cells
}

/** Pack a plane. Returns the laid-out panels (geo rectangles). With `bbox`, only cells whose centre
 *  falls inside the box are kept. Built on the same grid the manual tool uses, so they stay aligned. */
export function packPlane(polygon: LatLng[], module: Module, opts: PackOpts): DesignPanel[] {
  return planeGrid(polygon, module, opts)
    .filter((c) => !opts.bbox || (c.center.lat >= opts.bbox.minLat && c.center.lat <= opts.bbox.maxLat && c.center.lng >= opts.bbox.minLng && c.center.lng <= opts.bbox.maxLng))
    .map((c) => ({ id: uid('pn'), corners: c.corners }))
}

/** Pick the orientation that fits the most panels — the AI's default packing choice. */
export function autoPackPlane(plane: DesignPlane, module: Module, setback: number): { panels: DesignPanel[]; orientation: PanelOrientation } {
  const portrait = packPlane(plane.polygon, module, { orientation: 'portrait', setback })
  const landscape = packPlane(plane.polygon, module, { orientation: 'landscape', setback })
  return landscape.length > portrait.length ? { panels: landscape, orientation: 'landscape' } : { panels: portrait, orientation: 'portrait' }
}

export const kwpOf = (count: number, watts: number) => Math.round((count * watts) / 100) / 10

/* ── Smart, goal-driven auto-layout ──────────────────────────────────────────
 * Ovi's layout brain. Ranks roof planes by solar quality (orientation × tilt × area), then packs
 * best-first honouring each plane's own racking/orientation/setback/row-gap, and — for a target
 * kWp — stops once the goal is met (trimming the last plane row-by-row to land close). */
import { orientationTiltFactor } from './solar'

export type LayoutGoal =
  | { kind: 'max' }
  | { kind: 'target-kwp'; kwp: number }
  | { kind: 'target-kwh'; kwh: number; yieldPerKwp: number } // hit an annual generation target (offset briefs)
export type LayoutOpts = {
  restrict?: (p: DesignPlane) => boolean // only lay out planes passing this
  obstacles?: LatLng[][] // obstruction keep-out rings the modules must avoid
}
export type LayoutResult = { planes: DesignPlane[]; count: number; kwp: number; kwh: number }

/** Orientation/tilt yield factor (0–1) for a plane. Planes store azimuth from NORTH (0=N,180=S);
 *  orientationTiltFactor expects 0=due south, so shift by 180°. */
export function planeSolarFactor(p: Pick<DesignPlane, 'azimuthDeg' | 'pitchDeg'>): number {
  return orientationTiltFactor(p.azimuthDeg + 180, p.pitchDeg)
}
/** Solar quality of a plane (yield factor × sloped area) — higher = pack first. */
export function planeQuality(p: DesignPlane): number {
  return planeSolarFactor(p) * Math.max(1, p.areaM2)
}

/** Pack one plane using its own settings (falls back to the design defaults passed in). Obstacles are
 *  keep-out rings (obstruction outlines) the modules must avoid. */
export function packWithSettings(plane: DesignPlane, module: Module, designSetback: number, obstacles?: LatLng[][]): { panels: DesignPanel[]; orientation: PanelOrientation } {
  const setback = plane.setbackM ?? designSetback
  const rowGap = plane.rowGapM
  const gap = plane.panelGapM
  const angleDeg = plane.arrayAngleDeg
  const tilt = plane.racking && plane.racking !== 'flush' ? (plane.tiltDeg ?? 10) : plane.pitchDeg
  const base: PackOpts = { orientation: 'portrait', setback, rowGap, gap, angleDeg, obstacles, pitchDeg: tilt, azimuthDeg: plane.azimuthDeg }
  // Search: each allowed orientation × several grid origins — where the grid starts decides whether that last
  // column/row squeezes in. Keep the arrangement that fits the most modules.
  const orients: PanelOrientation[] = plane.orientation ? [plane.orientation] : ['portrait', 'landscape']
  let best: { panels: DesignPanel[]; orientation: PanelOrientation } = { panels: [], orientation: orients[0] }
  // On a low-pitched roof (<15°) the facing hardly matters and modules normally follow the building — also try the
  // grid along the pane's longest edge and keep whichever alignment fits more.
  const aligns = tilt < 15 && !angleDeg ? [base.azimuthDeg, undefined] : [base.azimuthDeg]
  let bestAlign: number | undefined = base.azimuthDeg
  for (const az of aligns) for (const orientation of orients) for (const offsetX of [0, 0.25, 0.5, 0.75]) for (const offsetY of [0, 0.33, 0.67]) {
    const panels = packPlane(plane.polygon, module, { ...base, azimuthDeg: az, orientation, offsetX, offsetY })
    if (panels.length > best.panels.length) { best = { panels, orientation }; bestAlign = az }
  }
  base.azimuthDeg = bestAlign // the gap-filling pass below uses the same alignment
  // Mixed: where the main block leaves space the other way round fits, add those modules too (e.g. a landscape
  // row across the top of a portrait array). Only when the orientation isn't locked for this pane.
  if (!plane.orientation && best.panels.length) {
    const other: PanelOrientation = best.orientation === 'portrait' ? 'landscape' : 'portrait'
    const proj = projector(plane.polygon[0])
    const taken = best.panels.map((p) => p.corners.map(proj.toXY))
    const clash = (c: XY[]) => taken.some((t) => polysOverlap(c, t))
    let extra: DesignPanel[] = []
    for (const offsetX of [0, 0.25, 0.5, 0.75]) for (const offsetY of [0, 0.33, 0.67]) {
      const add = packPlane(plane.polygon, module, { ...base, orientation: other, offsetX, offsetY }).filter((p) => !clash(p.corners.map(proj.toXY)))
      if (add.length > extra.length) extra = add
    }
    if (extra.length) best = { panels: [...best.panels, ...extra], orientation: best.orientation }
  }
  return best
}

/** Lay out the whole design toward a goal. Best planes first; trims the last plane to hit a target. */
export function autoLayout(planes: DesignPlane[], module: Module, goal: LayoutGoal, designSetback: number, opts: LayoutOpts = {}): LayoutResult {
  const kwhPerPanelOn = (p: DesignPlane) => goal.kind === 'target-kwh' ? (module.watts / 1000) * goal.yieldPerKwp * planeSolarFactor(p) : 0
  const order = [...planes].map((p, i) => ({ p, i, q: planeQuality(p) })).sort((a, b) => b.q - a.q)
  const targetCount = goal.kind === 'target-kwp' ? Math.max(0, Math.round((goal.kwp * 1000) / module.watts)) : Infinity
  const out = planes.map((p) => ({ ...p, panels: [] as DesignPanel[], orientation: p.orientation, moduleId: p.moduleId ?? module.id }))
  let placed = 0, kwh = 0
  for (const { i, p } of order) {
    if (placed >= targetCount) break
    if (opts.restrict && !opts.restrict(p)) continue // skip planes the brief excluded
    if (goal.kind === 'target-kwh' && kwh >= goal.kwh) break
    // Worth it? A pane yielding under ~60% of an ideal south roof (north-facing) isn't filled unless the brief
    // explicitly asked for it (opts.restrict) — Ovi's "max" means max sensible, not every square metre.
    if (!opts.restrict && planeSolarFactor({ azimuthDeg: p.azimuthDeg, pitchDeg: p.racking && p.racking !== 'flush' ? (p.tiltDeg ?? 10) : p.pitchDeg }) < 0.6) continue
    const packed = packWithSettings(planes[i], module, designSetback, opts.obstacles)
    let panels = packed.panels
    if (panels.length < 3 && !opts.restrict) continue // one or two stray modules on a scrap of roof — not worth a string
    if (placed + panels.length > targetCount) panels = panels.slice(0, targetCount - placed) // trim to target kWp
    if (goal.kind === 'target-kwh') {
      const per = kwhPerPanelOn(p)
      const need = per > 0 ? Math.ceil((goal.kwh - kwh) / per) : panels.length
      if (need < panels.length) panels = panels.slice(0, Math.max(0, need))
      kwh += panels.length * per
    }
    out[i] = { ...out[i], panels, orientation: packed.orientation }
    placed += panels.length
  }
  return { planes: out, count: placed, kwp: kwpOf(placed, module.watts), kwh: Math.round(kwh) }
}
