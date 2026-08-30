/* Design Studio helpers — turn a measured roof into editable, georeferenced planes, and do the
 * geometry (areas) the canvas needs. Google Solar gives per-plane pitch/azimuth + an axis-aligned
 * bounding box; we seed planes from those (editable), and refine to true shapes in a later phase. */
import { analyseRoofLive, type LatLng, type RoofAnalysis } from './solar'
import type { DesignPlane } from '../store/types'

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

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
export function planesFromAnalysis(a: RoofAnalysis): DesignPlane[] {
  const boxed = a.segments.filter((s) => s.box)
  return boxed.map((s, i) => {
    const b = s.box!
    const polygon: LatLng[] = [
      { lat: b.sw.lat, lng: b.sw.lng },
      { lat: b.sw.lat, lng: b.ne.lng },
      { lat: b.ne.lat, lng: b.ne.lng },
      { lat: b.ne.lat, lng: b.sw.lng },
    ]
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
}

/** Fetch + convert in one call. Returns planes + the building centre for framing. */
export async function detectPlanes(address: string, center?: LatLng): Promise<{ planes: DesignPlane[]; center?: LatLng; measured: boolean }> {
  const analysis = await analyseRoofLive(address, center)
  return { planes: planesFromAnalysis(analysis), center: analysis.center || center, measured: analysis.source === 'google' }
}

/** Total sloped roof area across planes (m²). */
export function totalRoofArea(planes: DesignPlane[]): number {
  return Math.round(planes.reduce((s, p) => s + slopedAreaM2(p.areaM2, p.pitchDeg), 0))
}
