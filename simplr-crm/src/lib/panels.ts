/* Panel layout engine — packs PV modules into a roof plane's polygon and returns real geo rectangles.
 * Works in a local metric frame (equirectangular around the plane centroid), aligns the grid to the
 * plane's longest edge so rows follow the building, and keeps only panels that sit fully on the roof. */
import type { LatLng } from './solar'
import type { DesignPanel, DesignPlane, PanelOrientation } from '../store/types'

export type Module = { id: string; name: string; watts: number; w: number; h: number } // w = short side, h = long side (m)
export const MODULES: Module[] = [
  { id: 'm405', name: '405 W all-black', watts: 405, w: 1.134, h: 1.722 },
  { id: 'm440', name: '440 W mono PERC', watts: 440, w: 1.134, h: 1.762 },
  { id: 'm500', name: '500 W half-cut', watts: 500, w: 1.134, h: 1.96 },
  { id: 'm550', name: '550 W bifacial', watts: 550, w: 1.134, h: 2.279 },
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
