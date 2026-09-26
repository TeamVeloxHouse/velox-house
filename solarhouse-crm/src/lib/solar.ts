/* Solar design model — Phase 1 of the Artemis-style engine, hardened to the MCS method.
 *
 * Generation follows MCS MIS 3002:   annual kWh = kWp × Kk × SF
 *   Kk  = location yield (kWh/kWp/yr) from the postcode region  ×  orientation/tilt factor
 *   SF  = shade factor (0–1)
 * Self-consumption follows the MCS MGD 003 method: a lookup on the occupancy archetype
 * and the ratio of annual generation to annual demand — NOT a fixed fraction.
 *
 * Everything here is deterministic and offline so the design → savings → price flow works
 * with no backend. `analyseRoofLive()` swaps in the real Google Solar API (see
 * server/solarProvider.mjs), and it already returns this exact shape — `segment.irradiance`
 * is the orientation/tilt factor (0.55–1.0) and `specificYield` is real kWh/kWp — so the
 * model path below is calibrated to match it.
 *
 * The regional-yield and self-consumption numbers are principled approximations of the MCS
 * datasets (which are licensed). The *method* is exact; swap the tables in `MCS_REGION_YIELD`
 * and `MGD003_SELF_CONSUMPTION` for the certified figures and nothing else changes.
 */

export type Occupancy = 'home_all_day' | 'in_half_day' | 'out_all_day'
export type LatLng = { lat: number; lng: number }
export type SegBox = { sw: LatLng; ne: LatLng }
export type RoofSegment = {
  id: string; label: string; azimuth: string; pitch: number; maxPanels: number; irradiance: number
  azimuthDeg?: number // 0 = due south (model convention)
  box?: SegBox // geographic bounding box of the plane (Google only) — enables on-image placement
}
/** One roof plane as Google's buildingInsights reports it — reliable orientation, used as a prior to
 *  steer the DSM roof segmentation (snap pixels to these true planes instead of rediscovering them). */
export type GooglePlane = {
  pitchDeg: number // roof slope
  azimuthDeg: number // degrees from NORTH (0 = N, 180 = S) — the direction the plane faces
  areaM2: number
  center?: LatLng // plane centroid
  heightM?: number // plane height at centre (m)
  box?: SegBox // axis-aligned lat/lng bounding box
}
export type RoofAnalysis = {
  segments: RoofSegment[]
  usableArea: number // m²
  specificYield: number // Kk base — location yield kWh/kWp/yr (S-facing, optimal pitch)
  maxPanels: number
  panelWatts: number
  source: 'google' | 'model'
  region?: string // e.g. "South West England"
  shadeFactor?: number // SF, 0–1 (1 = unshaded)
  center?: LatLng // building centre — used to fetch satellite imagery
  planes?: GooglePlane[] // ALL Google roof planes (un-sliced) — priors for DSM segmentation
}
// Physical panel dimensions (m) for on-roof placement — a standard 440W module.
export const PANEL_DIM = { w: 1.13, h: 1.72 }
export type SolarDesign = {
  address: string
  segments: RoofSegment[]
  usableArea: number // m²
  panels: number
  maxPanels: number
  panelWatts: number
  systemKwp: number
  specificYield: number // Kk base (kWh/kWp/yr)
  annualProduction: number // kWh — kWp × Kk × SF
  annualSavings: number // £
  billOffsetPct: number
  systemCost: number
  payback: number // years
  lifetimeSavings: number // £ over 25y
  co2PerYear: number // tonnes
  source: 'google' | 'model'
  // MCS method surface (new, all optional so stored designs stay compatible)
  region?: string
  shadeFactor?: number // SF
  selfConsumptionPct?: number // 0–100, from MGD 003
  occupancy?: Occupancy
  annualDemand?: number // kWh/yr
  center?: LatLng // building centre for satellite imagery
}

const PANEL_W = 440
const PANEL_AREA = 1.9 // m²
const IMPORT_RATE = 0.28 // £/kWh
const EXPORT_RATE = 0.15 // £/kWh (SEG)
const COST_PER_KWP = 1350 // £/kWp installed
const BASE_COST = 1800 // £ fixed (scaffold, inverter, install)
const CO2_PER_KWH = 0.207 / 1000 // tonnes CO2 per kWh (UK grid)
const DEFAULT_DEMAND = 2900 // kWh/yr — Ofgem TDCV medium household

// ── MCS irradiance dataset (approximation) ─────────────────────────────────
// Location yield in kWh/kWp/yr for a south-facing array at optimal pitch, by UK region.
// The MCS Kk table has ~21 postcode zones; these macro-regions capture the spread
// (Scottish Highlands ~810 → South West ~1030) and are swappable for the licensed values.
const MCS_REGION_YIELD: Record<string, { name: string; yield: number }> = {
  SW: { name: 'South West England', yield: 1030 },
  SE: { name: 'South East England', yield: 1005 },
  LON: { name: 'London', yield: 995 },
  EE: { name: 'East of England', yield: 985 },
  EM: { name: 'East Midlands', yield: 950 },
  WM: { name: 'West Midlands', yield: 945 },
  WAL: { name: 'Wales', yield: 940 },
  NW: { name: 'North West England', yield: 910 },
  YH: { name: 'Yorkshire & Humber', yield: 920 },
  NE: { name: 'North East England', yield: 905 },
  SCC: { name: 'Central & Southern Scotland', yield: 875 },
  SCN: { name: 'Northern Scotland', yield: 815 },
  NI: { name: 'Northern Ireland', yield: 900 },
}
// Postcode area (leading letters of the outward code) → region key.
const POSTCODE_REGION: Record<string, keyof typeof MCS_REGION_YIELD> = {
  // South West
  TR: 'SW', PL: 'SW', EX: 'SW', TQ: 'SW', TA: 'SW', BS: 'SW', BA: 'SW', DT: 'SW', GL: 'SW', SN: 'SW',
  // South East
  BH: 'SE', SP: 'SE', SO: 'SE', PO: 'SE', RG: 'SE', GU: 'SE', BN: 'SE', TN: 'SE', ME: 'SE', CT: 'SE', RH: 'SE', KT: 'SE', SL: 'SE', OX: 'SE',
  // London
  E: 'LON', EC: 'LON', N: 'LON', NW: 'LON', SE: 'LON', SW: 'LON', W: 'LON', WC: 'LON', HA: 'LON', EN: 'LON', IG: 'LON', RM: 'LON', DA: 'LON', BR: 'LON', CR: 'LON', SM: 'LON', TW: 'LON', UB: 'LON', WD: 'LON',
  // East of England
  CB: 'EE', PE: 'EE', NR: 'EE', IP: 'EE', CO: 'EE', CM: 'EE', SS: 'EE', SG: 'EE', LU: 'EE', AL: 'EE', HP: 'EE', MK: 'EE', NN: 'EE',
  // East Midlands
  LE: 'EM', DE: 'EM', NG: 'EM', LN: 'EM',
  // West Midlands
  B: 'WM', CV: 'WM', DY: 'WM', WS: 'WM', WV: 'WM', WR: 'WM', HR: 'WM', ST: 'WM', TF: 'WM',
  // Wales
  CF: 'WAL', NP: 'WAL', SA: 'WAL', LD: 'WAL', SY: 'WAL', LL: 'WAL',
  // North West
  CH: 'NW', CW: 'NW', WA: 'NW', WN: 'NW', BL: 'NW', BB: 'NW', PR: 'NW', FY: 'NW', LA: 'NW', L: 'NW', M: 'NW', OL: 'NW', SK: 'NW', CA: 'NW',
  // Yorkshire & Humber
  LS: 'YH', BD: 'YH', HX: 'YH', HD: 'YH', WF: 'YH', HG: 'YH', YO: 'YH', HU: 'YH', DN: 'YH', S: 'YH',
  // North East
  DL: 'NE', TS: 'NE', SR: 'NE', DH: 'NE',
  // Scotland central/south
  G: 'SCC', EH: 'SCC', ML: 'SCC', KA: 'SCC', PA: 'SCC', FK: 'SCC', KY: 'SCC', DD: 'SCC', DG: 'SCC', TD: 'SCC',
  // Scotland north
  AB: 'SCN', IV: 'SCN', KW: 'SCN', HS: 'SCN', ZE: 'SCN', PH: 'SCN',
  // Northern Ireland
  BT: 'NI',
}

/** Pull the postcode area (leading letters) from a free-text UK address. */
function postcodeArea(address: string): string | null {
  const m = address.toUpperCase().match(/\b([A-Z]{1,2})\d[A-Z\d]?\s*\d[A-Z]{2}\b/)
  return m ? m[1] : null
}

/** Region + location yield (Kk base, kWh/kWp/yr) for an address. Falls back to a UK mid value. */
export function regionYield(address: string): { key: string; name: string; yield: number } {
  const area = postcodeArea(address)
  const key = area && POSTCODE_REGION[area]
  const r = key ? MCS_REGION_YIELD[key] : null
  return r ? { key: key as string, ...r } : { key: 'UK', name: 'United Kingdom', yield: 940 }
}

// ── Orientation & tilt factor ──────────────────────────────────────────────
const ASPECT_AZIMUTH: Record<string, number> = {
  South: 0, 'South-west': 45, 'South-east': -45, West: 90, East: -90, 'North-west': 135, 'North-east': -135, North: 180,
}
/** Fraction of optimal yield for a given orientation/pitch (matches the Google provider). */
export function orientationTiltFactor(azimuthDeg: number, pitchDeg: number): number {
  const az = ((azimuthDeg % 360) + 360) % 360
  const off = Math.min(az, 360 - az) // 0 = due south, 180 = due north
  const azFactor = Math.cos((off * Math.PI) / 180) * 0.42 + 0.58 // south 1.0 → north ~0.16, floored below
  const pitchFactor = 1 - Math.abs((pitchDeg || 30) - 35) / 120 // best near 35°
  return Math.max(0.55, Math.min(1, azFactor * pitchFactor))
}

// ── MGD 003 self-consumption ───────────────────────────────────────────────
// Self-consumption RATE (fraction of generation used on-site) as a function of the
// generation-to-demand ratio, per occupancy archetype. It falls as the system grows
// relative to demand (more is exported). Approximates the MGD 003 lookup tables.
const SC_RATIO_POINTS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]
const MGD003_SELF_CONSUMPTION: Record<Occupancy, number[]> = {
  home_all_day: [0.90, 0.78, 0.68, 0.60, 0.48, 0.40],
  in_half_day: [0.85, 0.68, 0.55, 0.45, 0.36, 0.30],
  out_all_day: [0.70, 0.50, 0.40, 0.33, 0.26, 0.22],
}

function interp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0]
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
      return ys[i - 1] + t * (ys[i] - ys[i - 1])
    }
  }
  return ys[ys.length - 1]
}

/** MGD 003 self-consumption rate (0–1). A battery lifts it toward a ceiling as its usable
 *  capacity covers the daily surplus — a documented uplift, capped so it never over-promises. */
export function selfConsumptionRate(opts: {
  generation: number
  demand: number
  occupancy?: Occupancy
  batteryUsableKwh?: number
}): number {
  const { generation, demand, occupancy = 'in_half_day', batteryUsableKwh = 0 } = opts
  const ratio = generation / Math.max(1, demand)
  const base = interp(SC_RATIO_POINTS, MGD003_SELF_CONSUMPTION[occupancy], ratio)
  if (batteryUsableKwh <= 0) return base
  // Surplus (exported) energy a battery can soak up over a day; uplift saturates with capacity.
  const dailySurplus = (generation * (1 - base)) / 365
  const capture = dailySurplus > 0 ? Math.min(1, batteryUsableKwh / dailySurplus) : 0
  return Math.min(0.9, base + (1 - base) * capture * 0.85)
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0)
}

/** Analyse a roof from an address (deterministic model; the Google provider returns the same shape). */
export function analyseRoof(address: string): RoofAnalysis {
  const seed = hash(address.trim().toLowerCase() || 'default')
  const rand = (n: number, min: number, max: number) => min + (((seed >> n) & 0xff) / 255) * (max - min)
  const aspects = ['South', 'South-west', 'South-east', 'West', 'East']
  const region = regionYield(address)
  const segCount = 1 + Math.round(rand(0, 0, 2)) // 1–3 usable planes
  const segments: RoofSegment[] = Array.from({ length: segCount }, (_, i) => {
    const az = aspects[(seed >>> (i * 3)) % aspects.length]
    const pitch = Math.round(rand(i * 5, 25, 40))
    const area = rand(i * 4 + 1, 22, 55)
    return {
      id: `s${i}`,
      label: `${az}-facing plane`,
      azimuth: az,
      pitch,
      maxPanels: Math.floor((area * 0.72) / PANEL_AREA),
      irradiance: orientationTiltFactor(ASPECT_AZIMUTH[az] ?? 0, pitch),
      azimuthDeg: ASPECT_AZIMUTH[az] ?? 0,
    }
  })
  const usableArea = segments.reduce((a, s) => a + s.maxPanels * PANEL_AREA, 0)
  const maxPanels = segments.reduce((a, s) => a + s.maxPanels, 0)
  const shadeFactor = +rand(11, 0.9, 1.0).toFixed(2) // light near/far shading
  return { segments, usableArea: Math.round(usableArea), specificYield: region.yield, maxPanels, panelWatts: PANEL_W, source: 'model', region: region.name, shadeFactor }
}

export type Pricing = { costPerKwp: number; baseCost: number; perPanel: number; marginPct: number; vatPct: number }
export type DesignOpts = { occupancy?: Occupancy; annualDemand?: number; importRate?: number; exportRate?: number; batteryUsableKwh?: number }

/** Build a full design from a roof analysis; `panelOverride` lets the UI add/remove panels live.
 *  `pricing` is the contractor's own calculator config; `opts` carries the MCS demand/occupancy
 *  assumptions (all default to sensible UK values). */
export function designFrom(a: RoofAnalysis, address: string, panelOverride?: number, pricing?: Pricing, opts?: DesignOpts): SolarDesign {
  const { segments, usableArea, specificYield, maxPanels } = a
  const panelWatts = a.panelWatts || PANEL_W
  const panels = Math.max(4, Math.min(maxPanels, panelOverride ?? Math.round(maxPanels * 0.82)))

  // weight production by the segments the panels actually sit on (best aspects fill first)
  const ordered = [...segments].sort((a, b) => b.irradiance - a.irradiance)
  let left = panels
  let irrWeighted = 0
  for (const s of ordered) { const take = Math.min(left, s.maxPanels); irrWeighted += take * s.irradiance; left -= take; if (left <= 0) break }
  const avgIrr = panels > 0 ? irrWeighted / panels : 0.9

  // MCS MIS 3002:  annual kWh = kWp × Kk × SF   (Kk = specificYield × orientation/tilt factor)
  const shadeFactor = a.shadeFactor ?? 1
  const systemKwp = (panels * panelWatts) / 1000
  const annualProduction = Math.round(systemKwp * specificYield * avgIrr * shadeFactor)

  // MCS MGD 003 self-consumption (occupancy + generation/demand ratio), not a fixed fraction.
  const occupancy = opts?.occupancy ?? 'in_half_day'
  const annualDemand = opts?.annualDemand ?? DEFAULT_DEMAND
  const importRate = opts?.importRate ?? IMPORT_RATE
  const exportRate = opts?.exportRate ?? EXPORT_RATE
  const scRate = selfConsumptionRate({ generation: annualProduction, demand: annualDemand, occupancy, batteryUsableKwh: opts?.batteryUsableKwh })
  const selfUsedKwh = annualProduction * scRate
  const exportedKwh = annualProduction - selfUsedKwh

  const annualSavings = Math.round(selfUsedKwh * importRate + exportedKwh * exportRate)
  const billOffsetPct = Math.min(100, Math.round((selfUsedKwh / annualDemand) * 100))

  // Contractor's own pricing (falls back to defaults)
  const p = pricing ?? { costPerKwp: COST_PER_KWP, baseCost: BASE_COST, perPanel: 0, marginPct: 0, vatPct: 0 }
  const rawCost = systemKwp * p.costPerKwp + p.baseCost + panels * (p.perPanel || 0)
  const systemCost = Math.round((rawCost * (1 + p.marginPct / 100) * (1 + p.vatPct / 100)) / 50) * 50
  const payback = +(systemCost / annualSavings).toFixed(1)
  const lifetimeSavings = Math.round(annualSavings * 25 * 0.9 - systemCost)
  const co2PerYear = +(annualProduction * CO2_PER_KWH).toFixed(2)

  return {
    address, segments, usableArea: Math.round(usableArea), panels, maxPanels, panelWatts,
    systemKwp: +systemKwp.toFixed(2), specificYield, annualProduction, annualSavings, billOffsetPct,
    systemCost, payback, lifetimeSavings, co2PerYear, source: a.source,
    region: a.region, shadeFactor, selfConsumptionPct: Math.round(scRate * 100), occupancy, annualDemand, center: a.center,
  }
}

/** Offline convenience: analyse + design in one call. */
export function designFor(address: string, panelOverride?: number, pricing?: Pricing, opts?: DesignOpts): SolarDesign {
  return designFrom(analyseRoof(address), address, panelOverride, pricing, opts)
}

/** Live: ask the backend for a Google Solar analysis; fall back to the offline model.
 *  Pass `coords` when you already have a precise building centre (e.g. from Places) — more accurate
 *  for large sites than geocoding the address, and skips a Geocoding call. */
export async function analyseRoofLive(address: string, coords?: LatLng): Promise<RoofAnalysis> {
  try {
    const r = await fetch('/api/solar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, lat: coords?.lat, lng: coords?.lng }) })
    if (r.ok) {
      const j = await r.json()
      if (j && !j.fallback && Array.isArray(j.segments) && j.segments.length) return j as RoofAnalysis
    }
  } catch {
    /* network / no backend — fall through */
  }
  return analyseRoof(address)
}

/* ── Building footprint (true roof outline) ────────────────────────────────────
 * Google Solar's roofSegmentStats only give axis-aligned lat/lng *bounding boxes* per plane — great
 * for area/kWp, useless for tracing a roof (they render as overlapping squares on any building that
 * isn't aligned to compass N/S/E/W). For an accurate outline we pull the real building polygon from
 * OpenStreetMap via Overpass (free, no key, CORS-enabled) and draw that. Falls back to the boxes. */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

function ringContains(poly: LatLng[], pt: LatLng): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].lat, xi = poly[i].lng, yj = poly[j].lat, xj = poly[j].lng
    if ((yi > pt.lat) !== (yj > pt.lat) && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function ringAreaish(poly: LatLng[]): number {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j].lng + poly[i].lng) * (poly[j].lat - poly[i].lat)
  return Math.abs(a / 2)
}

/** OSM buildings around a point, Overpass-shaped — via the server, which answers from the local Geofabrik store
 *  inside the showroom catchments (instant) and only falls back to Overpass outside them. */
async function osmElements(center: LatLng, radius: number): Promise<{ elements: { type: string; id: number; tags: Record<string, string>; geometry: { lat: number; lon: number }[] }[] }> {
  const r = await fetch(`/api/osm-buildings?lat=${center.lat}&lng=${center.lng}&r=${radius}`)
  const j = await r.json()
  return { elements: (j.buildings ?? []).map((b: { id: number; tags: Record<string, string>; ring: LatLng[] }) => ({ type: 'way', id: b.id, tags: b.tags, geometry: b.ring.map((p) => ({ lat: p.lat, lon: p.lng })) })) }
}

/** Real building outline at a point, from OSM. Returns the polygon (lat/lng ring) or null. */
export async function fetchBuildingFootprint(center: LatLng): Promise<LatLng[] | null> {
  // 150 m radius: a big shed's centroid can be ~75 m from its walls, so a tight radius misses it.
  // We then pick the polygon that CONTAINS the point, so a wide net never grabs a neighbour by mistake.
  {
    try {
      const j = await osmElements(center, 150)
      const ways: LatLng[][] = (j.elements || [])
        .filter((e: { type: string; geometry?: unknown[] }) => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length >= 4)
        .map((e: { geometry: { lat: number; lon: number }[] }) => e.geometry.map((g) => ({ lat: g.lat, lng: g.lon })))
      if (!ways.length) return null
      // Prefer the building the point sits INSIDE (biggest such, in case of nested rings); if the pin
      // landed just off the roof, fall back to the nearest footprint by centroid — not the largest,
      // which in a dense estate could be an unrelated neighbour.
      const containing = ways.filter((w) => ringContains(w, center)).sort((a, b) => ringAreaish(b) - ringAreaish(a))
      const centroidDist = (w: LatLng[]) => { const c = w.reduce((a, p) => ({ lat: a.lat + p.lat / w.length, lng: a.lng + p.lng / w.length }), { lat: 0, lng: 0 }); return (c.lat - center.lat) ** 2 + (c.lng - center.lng) ** 2 }
      const pick = containing[0] ?? [...ways].sort((a, b) => centroidDist(a) - centroidDist(b))[0]
      return pick.length > 60 ? pick.filter((_, i) => i % 2 === 0) : pick
    } catch { /* try next endpoint */ }
  }
  return null
}

/** Real building height at a point, from OSM `height` / `building:levels` tags. Returns the eave
 *  height in metres (what the 3D walls rise to) + which tag it came from, or null if untagged. */
export async function fetchBuildingHeight(center: LatLng): Promise<{ eaveM: number; source: 'osm' } | null> {
  {
    try {
      const j = await osmElements(center, 120)
      type W = { ring: LatLng[]; tags: Record<string, string>; area: number }
      const ways: W[] = (j.elements || [])
        .filter((e: { type: string; geometry?: unknown[] }) => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length >= 4)
        .map((e: { geometry: { lat: number; lon: number }[]; tags?: Record<string, string> }) => {
          const ring = e.geometry.map((g) => ({ lat: g.lat, lng: g.lon }))
          return { ring, tags: e.tags || {}, area: ringAreaish(ring) }
        })
      if (!ways.length) return null
      const containing = ways.filter((w) => ringContains(w.ring, center)).sort((a, b) => b.area - a.area)
      const centroidDist = (w: W) => { const c = w.ring.reduce((a, p) => ({ lat: a.lat + p.lat / w.ring.length, lng: a.lng + p.lng / w.ring.length }), { lat: 0, lng: 0 }); return (c.lat - center.lat) ** 2 + (c.lng - center.lng) ** 2 }
      const pick = containing[0] ?? [...ways].sort((a, b) => centroidDist(a) - centroidDist(b))[0]
      const tags = pick.tags
      const h = parseFloat(tags['height'] || tags['building:height'] || '')
      if (isFinite(h) && h > 2) return { eaveM: Math.max(2.4, Math.round(h * 0.85 * 10) / 10), source: 'osm' } // height is to the ridge; eave ≈ 0.85×
      const lv = parseFloat(tags['building:levels'] || '')
      if (isFinite(lv) && lv >= 1) return { eaveM: Math.max(2.4, Math.round(lv * 3 * 10) / 10), source: 'osm' } // ~3 m per storey
      return null
    } catch { /* try next endpoint */ }
  }
  return null
}

/** Frame a satellite tile on a lat/lng ring — centre + a zoom that fits it with margin. */
export function frameFromPoints(points: LatLng[], w = 560, h = 360): { center: LatLng; zoom: number } | null {
  if (!points.length) return null
  let latMin = 90, latMax = -90, lngMin = 180, lngMax = -180
  for (const p of points) { latMin = Math.min(latMin, p.lat); latMax = Math.max(latMax, p.lat); lngMin = Math.min(lngMin, p.lng); lngMax = Math.max(lngMax, p.lng) }
  const center = { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 }
  const widthM = (lngMax - lngMin) * 111320 * Math.cos((center.lat * Math.PI) / 180)
  const heightM = (latMax - latMin) * 110540
  const mpp = Math.max((Math.max(widthM, 12) * 1.35) / w, (Math.max(heightM, 12) * 1.35) / h)
  const z = Math.log2((156543.03 * Math.cos((center.lat * Math.PI) / 180)) / mpp)
  return { center, zoom: Math.max(16, Math.min(20, Math.round(z))) }
}

export const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

/** Monthly payment for a finance product on a given system cost (standard amortisation). */
export function monthlyPayment(systemCost: number, apr: number, termMonths: number, depositPct: number): number {
  const principal = systemCost * (1 - depositPct / 100)
  const r = apr / 100 / 12
  if (r === 0) return Math.round(principal / termMonths)
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -termMonths)))
}
