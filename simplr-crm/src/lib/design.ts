/* Design Studio helpers — turn a measured roof into editable, georeferenced planes, and do the
 * geometry (areas) the canvas needs. Google Solar gives per-plane pitch/azimuth + an axis-aligned
 * bounding box; we seed planes from those (editable), and refine to true shapes in a later phase. */
import { analyseRoofLive, fetchBuildingFootprint, type LatLng, type RoofAnalysis } from './solar'
import { fetchBuildingOutline, segmentRoofFacets } from './dsm'
import type { DesignPlane } from '../store/types'

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

/** Clip a polygon to one axis half-plane (Sutherland–Hodgman edge). */
function clipAxis(poly: LatLng[], keep: (p: LatLng) => boolean, cut: (a: LatLng, b: LatLng) => LatLng): LatLng[] {
  const out: LatLng[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const ain = keep(a), bin = keep(b)
    if (ain) out.push(a)
    if (ain !== bin) out.push(cut(a, b))
  }
  return out
}
/** Intersection of a footprint polygon with an axis-aligned lat/lng box = the true roof-facet outline. */
function clipToBox(poly: LatLng[], minLng: number, maxLng: number, minLat: number, maxLat: number): LatLng[] {
  const iLng = (a: LatLng, b: LatLng, lng: number): LatLng => ({ lat: a.lat + ((lng - a.lng) / (b.lng - a.lng)) * (b.lat - a.lat), lng })
  const iLat = (a: LatLng, b: LatLng, lat: number): LatLng => ({ lat, lng: a.lng + ((lat - a.lat) / (b.lat - a.lat)) * (b.lng - a.lng) })
  let p = poly
  p = clipAxis(p, (v) => v.lng >= minLng, (a, b) => iLng(a, b, minLng))
  p = clipAxis(p, (v) => v.lng <= maxLng, (a, b) => iLng(a, b, maxLng))
  p = clipAxis(p, (v) => v.lat >= minLat, (a, b) => iLat(a, b, minLat))
  p = clipAxis(p, (v) => v.lat <= maxLat, (a, b) => iLat(a, b, maxLat))
  return p
}

/** Planar area of a lat/lng ring in m² (local equirectangular projection — fine at building scale). */
export function polygonAreaM2(poly: LatLng[]): number {
  if (poly.length < 3) return 0
  const mPerLat = 110540
  const mPerLng = 111320 * Math.cos((poly[0].lat * Math.PI) / 180)
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng * mPerLng, yi = poly[i].lat * mPerLat
    const xj = poly[j].lng * mPerLng, yj = poly[j].lat * mPerLat
    a += xj * yi - xi * yj
  }
  return Math.abs(a / 2)
}

/** Sloped roof area from its plan (map) area and pitch — the real surface panels sit on. */
export function slopedAreaM2(planM2: number, pitchDeg: number): number {
  return planM2 / Math.max(0.2, Math.cos((pitchDeg * Math.PI) / 180))
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export function compass(azFromNorth: number): string {
  return COMPASS[Math.round((((azFromNorth % 360) + 360) % 360) / 45) % 8]
}

/** RoofAnalysis (Google Solar) → editable design planes. Each plane gets a real geo polygon (from the
 *  segment box for now), its pitch, and azimuth expressed as degrees from north (0 = N, 180 = S). */
export function planesFromAnalysis(a: RoofAnalysis, footprint?: LatLng[] | null): DesignPlane[] {
  const boxed = a.segments.filter((s) => s.box)
  const mapped = boxed.map((s, i) => {
    const b = s.box!
    const box: LatLng[] = [
      { lat: b.sw.lat, lng: b.sw.lng },
      { lat: b.sw.lat, lng: b.ne.lng },
      { lat: b.ne.lat, lng: b.ne.lng },
      { lat: b.ne.lat, lng: b.sw.lng },
    ]
    // Clip the segment box to the real building outline → the true roof-facet shape (falls back to
    // the box if OSM has no footprint or the clip is degenerate).
    let polygon = box
    if (footprint && footprint.length >= 3) {
      const clipped = clipToBox(footprint, b.sw.lng, b.ne.lng, b.sw.lat, b.ne.lat)
      if (clipped.length >= 3 && polygonAreaM2(clipped) > 3) polygon = clipped
    }
    // solar.ts stores azimuthDeg as 0 = due south (−180..180); convert to degrees from north.
    const azFromNorth = ((((s.azimuthDeg ?? 0) + 180) % 360) + 360) % 360
    return {
      id: uid('pl'),
      name: `${compass(azFromNorth)}-facing plane`,
      polygon,
      pitchDeg: Math.round(s.pitch ?? 30),
      azimuthDeg: Math.round(azFromNorth),
      areaM2: Math.round(polygonAreaM2(polygon)),
      source: 'google' as const,
    }
  }).filter((p) => p.areaM2 > 4)
  // Google often returns several segment boxes that cover the SAME roof plane and overlap. Keep the
  // largest of each overlapping, same-facing cluster so detect doesn't stack duplicates.
  const bbox = (poly: LatLng[]) => poly.reduce((a, p) => ({ minLat: Math.min(a.minLat, p.lat), maxLat: Math.max(a.maxLat, p.lat), minLng: Math.min(a.minLng, p.lng), maxLng: Math.max(a.maxLng, p.lng) }), { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 })
  const overlap = (a: LatLng[], b: LatLng[]) => {
    const A = bbox(a), B = bbox(b)
    const ix = Math.max(0, Math.min(A.maxLng, B.maxLng) - Math.max(A.minLng, B.minLng)), iy = Math.max(0, Math.min(A.maxLat, B.maxLat) - Math.max(A.minLat, B.minLat))
    const inter = ix * iy, aa = (A.maxLng - A.minLng) * (A.maxLat - A.minLat), ab = (B.maxLng - B.minLng) * (B.maxLat - B.minLat)
    return inter / Math.max(1e-12, Math.min(aa, ab))
  }
  const kept: DesignPlane[] = []
  for (const p of [...mapped].sort((x, y) => y.areaM2 - x.areaM2)) {
    const dup = kept.some((k) => Math.min(Math.abs(k.azimuthDeg - p.azimuthDeg), 360 - Math.abs(k.azimuthDeg - p.azimuthDeg)) < 25 && overlap(k.polygon, p.polygon) > 0.45)
    if (!dup) kept.push(p)
  }
  return kept
}

/** Fetch + convert in one call. Returns planes + the building centre for framing. */
export async function detectPlanes(address: string, center?: LatLng): Promise<{ planes: DesignPlane[]; center?: LatLng; measured: boolean }> {
  const analysis = await analyseRoofLive(address, center)
  const c = analysis.center || center
  // BEST: segment the roof into true planar facets from the DSM (each real face, correctly tilted) —
  // this is the "usable area" per facet. Use it when it yields a sensible set.
  if (c) {
    const facets = await segmentRoofFacets(c.lat, c.lng).catch(() => null)
    const good = facets?.filter((f) => f.areaM2 >= 6) ?? []
    if (good.length >= 1 && good.length <= 24) {
      const planes: DesignPlane[] = good.map((f) => ({ id: uid('pl'), name: `${compass(f.azimuthDeg)}-facing plane`, polygon: f.polygon, pitchDeg: f.pitchDeg, azimuthDeg: f.azimuthDeg, areaM2: f.areaM2, source: 'google' }))
      return { planes, center: c, measured: true }
    }
  }
  // Fallback: clip Google's boxes to the building outline (mask, else flaky OSM, else raw box).
  let footprint: LatLng[] | null = null
  if (c) footprint = await fetchBuildingOutline(c.lat, c.lng).catch(() => null)
  if (!footprint && c) footprint = await fetchBuildingFootprint(c).catch(() => null)
  return { planes: planesFromAnalysis(analysis, footprint), center: c, measured: analysis.source === 'google' }
}

/** Total sloped roof area across planes (m²). */
export function totalRoofArea(planes: DesignPlane[]): number {
  return Math.round(planes.reduce((s, p) => s + slopedAreaM2(p.areaM2, p.pitchDeg), 0))
}

/* ── 3D geometry ────────────────────────────────────────────────────────────
 * A pitched roof plane is its flat footprint tilted up about the horizontal ridge line. We express
 * everything in a scene metric frame (x = east metres, z = −north metres, y = up) so the same maths
 * drives both the roof surface and the panels sitting flush on it. Down-slope is the azimuth
 * direction; the eave (lowest edge) stays at `eaveH`, the ridge rises by run·tan(pitch). */
export type Vec3 = { x: number; y: number; z: number }
export type PlaneFrame = {
  /** height (m) at a scene ground point (x,z) for this plane's tilted surface */
  elev: (x: number, z: number) => number
  /** unit surface normal (leans toward down-slope) */
  normal: Vec3
  /** horizontal down-slope unit vector in scene coords */
  slope: { x: number; z: number }
  eaveH: number
}

/** Build the tilt frame for one plane from its footprint (scene x/z), pitch and azimuth. */
export function planeFrame(footprintXZ: { x: number; z: number }[], pitchDeg: number, azimuthDeg: number, eaveH: number): PlaneFrame {
  const az = (azimuthDeg * Math.PI) / 180
  // azimuth from north; north maps to −z, so south (180°) → +z. Down-slope = azimuth direction.
  const g = { x: Math.sin(az), z: -Math.cos(az) }
  const pitch = Math.max(0, pitchDeg) * (Math.PI / 180)
  const tan = Math.tan(pitch)
  // signed distance of each vertex along the down-slope axis; eave is the max (furthest down-slope).
  let maxP = -Infinity
  for (const v of footprintXZ) maxP = Math.max(maxP, v.x * g.x + v.z * g.z)
  const elev = (x: number, z: number) => eaveH + (maxP - (x * g.x + z * g.z)) * tan
  const normal: Vec3 = { x: Math.sin(pitch) * g.x, y: Math.cos(pitch), z: Math.sin(pitch) * g.z }
  return { elev, normal, slope: g, eaveH }
}
