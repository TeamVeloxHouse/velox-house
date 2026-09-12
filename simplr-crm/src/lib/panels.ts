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
function projector(origin: LatLng) {
  const mPerLat = 110540
  const mPerLng = 111320 * Math.cos(origin.lat * DEG)
  return {
    toXY: (p: LatLng): XY => ({ x: (p.lng - origin.lng) * mPerLng, y: (p.lat - origin.lat) * mPerLat }),
    toLL: (p: XY): LatLng => ({ lat: origin.lat + p.y / mPerLat, lng: origin.lng + p.x / mPerLng }),
  }
}
const rot = (p: XY, a: number): XY => ({ x: p.x * Math.cos(a) + p.y * Math.sin(a), y: -p.x * Math.sin(a) + p.y * Math.cos(a) })
const unrot = (p: XY, a: number): XY => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) })

function pointInPoly(pt: XY, poly: XY[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if ((poly[i].y > pt.y) !== (poly[j].y > pt.y) && pt.x < ((poly[j].x - poly[i].x) * (pt.y - poly[i].y)) / (poly[j].y - poly[i].y) + poly[i].x) inside = !inside
  }
  return inside
}
/** Bearing (rad) of the polygon's longest edge — the grid aligns to this so panels follow the roof. */
function dominantAngle(poly: XY[]): number {
  let best = 0, blen = -1
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len > blen) { blen = len; best = Math.atan2(b.y - a.y, b.x - a.x) }
  }
  return best
}

export type PackOpts = { orientation: PanelOrientation; gap?: number; setback?: number; rowGap?: number }

/** Pack a plane. Returns the laid-out panels (geo rectangles). */
export function packPlane(polygon: LatLng[], module: Module, opts: PackOpts): DesignPanel[] {
  if (polygon.length < 3) return []
  const origin = polygon.reduce((a, p) => ({ lat: a.lat + p.lat / polygon.length, lng: a.lng + p.lng / polygon.length }), { lat: 0, lng: 0 })
  const proj = projector(origin)
  const polyXY = polygon.map(proj.toXY)
  const theta = dominantAngle(polyXY)
  const R = polyXY.map((p) => rot(p, theta)) // grid-aligned frame

  const pw = opts.orientation === 'portrait' ? module.w : module.h // panel footprint in the grid
  const ph = opts.orientation === 'portrait' ? module.h : module.w
  const gap = opts.gap ?? 0.02
  const rowGap = opts.rowGap ?? gap
  const setback = opts.setback ?? 0.3
  const cw = pw + gap, ch = ph + rowGap

  const minX = Math.min(...R.map((p) => p.x)), maxX = Math.max(...R.map((p) => p.x))
  const minY = Math.min(...R.map((p) => p.y)), maxY = Math.max(...R.map((p) => p.y))

  const panels: DesignPanel[] = []
  for (let y = minY + setback; y + ph <= maxY - setback; y += ch) {
    for (let x = minX + setback; x + pw <= maxX - setback; x += cw) {
      // four corners of the panel in the grid frame (inset a hair so touching edges still count as in)
      const corners: XY[] = [
        { x: x + 0.02, y: y + 0.02 }, { x: x + pw - 0.02, y: y + 0.02 },
        { x: x + pw - 0.02, y: y + ph - 0.02 }, { x: x + 0.02, y: y + ph - 0.02 },
      ]
      if (!corners.every((c) => pointInPoly(c, R))) continue
      panels.push({ id: uid('pn'), corners: corners.map((c) => proj.toLL(unrot(c, theta))) })
    }
  }
  return panels
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

export type LayoutGoal = { kind: 'max' } | { kind: 'target-kwp'; kwp: number }
export type LayoutResult = { planes: DesignPlane[]; count: number; kwp: number }

/** Orientation/tilt yield factor (0–1) for a plane. Planes store azimuth from NORTH (0=N,180=S);
 *  orientationTiltFactor expects 0=due south, so shift by 180°. */
export function planeSolarFactor(p: Pick<DesignPlane, 'azimuthDeg' | 'pitchDeg'>): number {
  return orientationTiltFactor(p.azimuthDeg + 180, p.pitchDeg)
}
/** Solar quality of a plane (yield factor × sloped area) — higher = pack first. */
export function planeQuality(p: DesignPlane): number {
  return planeSolarFactor(p) * Math.max(1, p.areaM2)
}

/** Pack one plane using its own settings (falls back to the design defaults passed in). */
export function packWithSettings(plane: DesignPlane, module: Module, designSetback: number): { panels: DesignPanel[]; orientation: PanelOrientation } {
  const setback = plane.setbackM ?? designSetback
  const rowGap = plane.rowGapM
  if (plane.orientation) {
    return { panels: packPlane(plane.polygon, module, { orientation: plane.orientation, setback, rowGap }), orientation: plane.orientation }
  }
  const portrait = packPlane(plane.polygon, module, { orientation: 'portrait', setback, rowGap })
  const landscape = packPlane(plane.polygon, module, { orientation: 'landscape', setback, rowGap })
  return landscape.length > portrait.length ? { panels: landscape, orientation: 'landscape' } : { panels: portrait, orientation: 'portrait' }
}

/** Lay out the whole design toward a goal. Best planes first; trims to hit a target kWp. */
export function autoLayout(planes: DesignPlane[], module: Module, goal: LayoutGoal, designSetback: number): LayoutResult {
  const order = [...planes].map((p, i) => ({ p, i, q: planeQuality(p) })).sort((a, b) => b.q - a.q)
  const targetCount = goal.kind === 'target-kwp' ? Math.max(0, Math.round((goal.kwp * 1000) / module.watts)) : Infinity
  const out = planes.map((p) => ({ ...p, panels: [] as DesignPanel[], orientation: p.orientation, moduleId: p.moduleId ?? module.id }))
  let placed = 0
  for (const { i } of order) {
    if (placed >= targetCount) break
    const packed = packWithSettings(planes[i], module, designSetback)
    let panels = packed.panels
    if (placed + panels.length > targetCount) panels = panels.slice(0, targetCount - placed) // trim last plane to hit target
    out[i] = { ...out[i], panels, orientation: packed.orientation }
    placed += panels.length
  }
  return { planes: out, count: placed, kwp: kwpOf(placed, module.watts) }
}
