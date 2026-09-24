/* Home Finder — residential solar targeting for The Solar House.
 *
 * Pipeline (every step is real data unless marked):
 *   1. LOCATE   areas / showrooms → lat/lng                       (Google Geocoding)
 *   2. HOMES    residential building footprints within the radius (OpenStreetMap / Overpass, free)
 *   3. FILTER   property type + footprint size                   (OSM tags + measured polygon)
 *   4. MEASURE  roof planes, panels, yield per home               (Google Solar buildingInsights)
 *   5. MODEL    system size, generation, savings, payback         (modelled from the measured roof)
 *   6. SCORE    weighted 0–100 fit, then roof/solar filters
 *   7. ADDRESS  street address for each qualifying home          (Google reverse geocoding)
 *
 * EPC filters (band, heating fuel) only apply once /api/epc is wired to the EPC register. */

import type { SolarProspect } from '../store/types'

export type LatLng = { lat: number; lng: number }
export type PropertyType = 'detached' | 'semi' | 'terrace' | 'bungalow' | 'house' | 'untagged'
export type Aspect = 'S' | 'SE' | 'SW' | 'E' | 'W' | 'N' | 'NE' | 'NW'
export type ProductFocus = 'solar' | 'solar-battery' | 'battery-ev'

// Addresses from thesolarhouse.co.uk/our-showrooms (checked 2026-09-24), pinned via Mapbox.
// The website doesn't list Gloucester yet, so that pin is the city centre until the address is confirmed.
export const SHOWROOMS: { id: string; name: string; address: string; center: LatLng; confirmed: boolean }[] = [
  { id: 'cardiff', name: 'Cardiff showroom', address: '11 Penlline Rd, Cardiff CF14 2AA', center: { lat: 51.51364, lng: -3.22066 }, confirmed: true },
  { id: 'cheltenham', name: 'Cheltenham showroom', address: 'Unit 11, The Courtyard, Montpellier St, Cheltenham GL50 1SR', center: { lat: 51.896348, lng: -2.081946 }, confirmed: true },
  { id: 'melksham', name: 'Melksham showroom', address: 'Leekes, Benacre Road, Melksham SN12 8AG', center: { lat: 51.380462, lng: -2.142861 }, confirmed: true },
  { id: 'gloucester', name: 'Gloucester showroom', address: 'Address to confirm — using city centre', center: { lat: 51.8642, lng: -2.2382 }, confirmed: false },
]

export const PROPERTY_LABEL: Record<PropertyType, string> = {
  detached: 'Detached', semi: 'Semi-detached', terrace: 'Terraced', bungalow: 'Bungalow', house: 'House (type not tagged)', untagged: 'Untagged building',
}

export type HomeCriteria = {
  // Where
  showrooms: string[]
  areas: string[]
  radiusKm: number
  maxHomes: number // how many homes to measure (each = one Google Solar lookup)
  // Property
  propertyTypes: PropertyType[]
  includeUntagged: boolean // OSM often tags UK homes as plain building=yes
  footprintMin: number // m²
  footprintMax: number // m²
  // Roof & solar
  aspects: Aspect[]
  minRoofM2: number
  minPanels: number
  minKwp: number
  minYield: number // kWh per kWp per year
  // Energy & household (modelling assumptions + EPC)
  annualUseKwh: number
  importPence: number
  exportPence: number
  epcBands: string[] // only applied when EPC data is available
  fuels: string[] // only applied when EPC data is available
  // Opportunity
  focus: ProductFocus
  weights: { roof: number; aspect: number; savings: number; size: number }
  minScore: number
  // Exclusions
  excludeFound: boolean // skip homes already in the prospects database
  excludeCustomers: boolean // skip addresses matching existing deals/customers
}

export const DEFAULT_CRITERIA: HomeCriteria = {
  showrooms: ['cardiff'], areas: [], radiusKm: 1.5, maxHomes: 40,
  propertyTypes: ['detached', 'semi', 'bungalow', 'house'], includeUntagged: true, footprintMin: 55, footprintMax: 260,
  aspects: ['S', 'SE', 'SW', 'E', 'W'], minRoofM2: 15, minPanels: 8, minKwp: 3, minYield: 800,
  annualUseKwh: 3600, importPence: 24.5, exportPence: 15, epcBands: [], fuels: [],
  focus: 'solar-battery', weights: { roof: 3, aspect: 3, savings: 3, size: 1 }, minScore: 50,
  excludeFound: true, excludeCustomers: true,
}

export type Stage = 'locate' | 'homes' | 'filter' | 'measure' | 'score' | 'address' | 'done'
export type Progress = { stage: Stage; message: string; done?: number; total?: number; counts?: Partial<Record<Stage, number>> }

export type HomeResult = {
  id: string
  center: LatLng
  footprint: LatLng[]
  footprintM2: number
  type: PropertyType
  address: string
  postcode?: string
  bestAspect: Aspect
  roofM2: number
  roofPanels: number
  panels: number
  kwp: number
  annualGenKwh: number
  selfUsePct: number
  year1Saving: number
  systemCost: number
  paybackYears: number
  score: number
  reasons: string[]
  distanceM: number
  near: string
  estimated: boolean // true = roof estimated from footprint, not measured by Google Solar
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const rid = () => Math.random().toString(36).slice(2, 10)

function metres(a: LatLng, b: LatLng) {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
function polyAreaM2(ring: LatLng[]) {
  if (ring.length < 3) return 0
  const lat0 = ring[0].lat * (Math.PI / 180)
  const mx = 111320 * Math.cos(lat0), my = 110540
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j].lng * mx + ring[i].lng * mx) * (ring[j].lat * my - ring[i].lat * my)
  return Math.abs(a / 2)
}
function centroid(ring: LatLng[]): LatLng {
  const n = ring.length
  return ring.reduce((c, p) => ({ lat: c.lat + p.lat / n, lng: c.lng + p.lng / n }), { lat: 0, lng: 0 })
}
function typeFromTag(tag: string): PropertyType {
  if (tag === 'detached') return 'detached'
  if (tag === 'semidetached_house') return 'semi'
  if (tag === 'terrace') return 'terrace'
  if (tag === 'bungalow') return 'bungalow'
  if (tag === 'house' || tag === 'residential') return 'house'
  return 'untagged'
}
const ASPECT_FROM_LABEL: Record<string, Aspect> = {
  South: 'S', 'South-east': 'SE', 'South-west': 'SW', East: 'E', West: 'W', North: 'N', 'North-east': 'NE', 'North-west': 'NW',
}

async function geocodeArea(q: string): Promise<LatLng | null> {
  try {
    const r = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: q + ', UK' }) })
    const j = await r.json()
    return typeof j.lat === 'number' ? { lat: j.lat, lng: j.lng } : null
  } catch { return null }
}
async function reverseGeocode(p: LatLng): Promise<{ formatted: string; postcode?: string } | null> {
  try {
    const r = await fetch('/api/geocode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
    const j = await r.json()
    return j.formatted ? j : null
  } catch { return null }
}

type RawHome = { id: string; ring: LatLng[]; center: LatLng; m2: number; type: PropertyType; addr?: string }

async function homesAround(center: LatLng, radiusM: number, includeUntagged: boolean): Promise<RawHome[]> {
  const tags = includeUntagged ? '^(house|detached|semidetached_house|terrace|bungalow|residential|yes)$' : '^(house|detached|semidetached_house|terrace|bungalow|residential)$'
  const q = `[out:json][timeout:25];way["building"~"${tags}"](around:${Math.round(radiusM)},${center.lat},${center.lng});out tags geom;`
  for (const url of OVERPASS) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 28000)
      const r = await fetch(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, signal: ctrl.signal })
      clearTimeout(t)
      if (!r.ok) continue
      const j = await r.json()
      type El = { id: number; type: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }
      return (j.elements as El[] || [])
        .filter((e) => e.type === 'way' && e.geometry && e.geometry.length >= 4)
        // Skip anything tagged as clearly non-domestic even when building=yes.
        .filter((e) => !e.tags?.shop && !e.tags?.amenity && !e.tags?.office && !e.tags?.industrial)
        .map((e) => {
          const ring = e.geometry!.map((g) => ({ lat: g.lat, lng: g.lon }))
          const tg = e.tags || {}
          const addr = tg['addr:housenumber'] && tg['addr:street'] ? `${tg['addr:housenumber']} ${tg['addr:street']}` : tg['addr:housename']
          return { id: `osm${e.id}`, ring, center: centroid(ring), m2: polyAreaM2(ring), type: typeFromTag(tg.building || ''), addr }
        })
    } catch { /* next mirror */ }
  }
  throw new Error('OpenStreetMap is busy — try again in a moment')
}

type RoofAnalysis = { segments: { azimuth: string; maxPanels: number; irradiance: number }[]; usableArea: number; specificYield: number; maxPanels: number; panelWatts: number }
async function measureRoof(p: LatLng): Promise<{ roof: RoofAnalysis | null; reason?: string }> {
  try {
    const r = await fetch('/api/solar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
    const j = await r.json()
    return j && !j.fallback && j.maxPanels ? { roof: j } : { roof: null, reason: j?.reason }
  } catch (e) { return { roof: null, reason: String(e) } }
}

/** When Google Solar is unavailable: estimate a pitched roof from the real OSM footprint. The ridge
 *  runs along the longest wall, so the two planes face perpendicular to it; we take the sunnier one. */
const COMPASS8: [string, number][] = [['North', 0], ['North-east', 45], ['East', 90], ['South-east', 135], ['South', 180], ['South-west', 225], ['West', 270], ['North-west', 315]]
function estimateRoof(ring: LatLng[], footprintM2: number): RoofAnalysis {
  let best = 0, bearing = 90
  const k = Math.cos((ring[0].lat * Math.PI) / 180)
  for (let i = 1; i < ring.length; i++) {
    const dx = (ring[i].lng - ring[i - 1].lng) * k, dy = ring[i].lat - ring[i - 1].lat
    const len = Math.hypot(dx, dy)
    if (len > best) { best = len; bearing = (Math.atan2(dx, dy) * 180) / Math.PI }
  }
  const faces = [bearing + 90, bearing - 90].map((b) => ((b % 360) + 360) % 360)
  const devSouth = (b: number) => Math.min(Math.abs(b - 180), 360 - Math.abs(b - 180))
  const face = faces.sort((a, b) => devSouth(a) - devSouth(b))[0]
  const label = COMPASS8.reduce((acc, [n, d]) => (Math.min(Math.abs(face - d), 360 - Math.abs(face - d)) < Math.min(Math.abs(face - acc[1]), 360 - Math.abs(face - acc[1])) ? [n, d] : acc), COMPASS8[0])[0]
  const dev = devSouth(face)
  const planeM2 = (footprintM2 / 2) * 1.22 * 0.68 // half the roof, 35° pitch, minus edges/obstructions
  const panels = Math.floor(planeM2 / 1.95)
  const irradiance = 1 - (dev / 180) * 0.4
  return { segments: [{ azimuth: label, maxPanels: panels, irradiance }], usableArea: Math.round(planeM2), specificYield: Math.round(980 * irradiance), maxPanels: panels, panelWatts: 430 }
}

/** Size, generate, save and pay back — from the measured roof. Costs are typical UK installed prices. */
function model(roof: RoofAnalysis, c: HomeCriteria) {
  const good = roof.segments.filter((s) => c.aspects.includes(ASPECT_FROM_LABEL[s.azimuth] ?? 'N'))
  const goodPanels = good.reduce((s, x) => s + x.maxPanels, 0)
  const panelKw = (roof.panelWatts || 430) / 1000
  const avgIrr = good.length ? good.reduce((s, x) => s + x.irradiance * x.maxPanels, 0) / Math.max(1, goodPanels) : 0
  // Size to ~120% of household use (battery soaks the surplus), capped at a typical domestic 16 panels / roof capacity.
  const target = Math.ceil((c.annualUseKwh * 1.2) / (roof.specificYield * panelKw))
  const panels = Math.max(0, Math.min(goodPanels, target, 20))
  const kwp = +(panels * panelKw).toFixed(2)
  const annualGenKwh = Math.round(kwp * roof.specificYield * (avgIrr ? Math.min(1, avgIrr / 0.95) : 1))
  const battery = c.focus !== 'solar'
  const selfUsePct = battery ? 0.72 : 0.38
  const used = Math.min(annualGenKwh * selfUsePct, c.annualUseKwh * 0.85)
  const year1Saving = Math.round((used * c.importPence + (annualGenKwh - used) * c.exportPence) / 100)
  const systemCost = Math.round(2400 + kwp * 1150 + (battery ? 4200 : 0) + (c.focus === 'battery-ev' ? 1100 : 0))
  const paybackYears = year1Saving > 0 ? +(systemCost / year1Saving).toFixed(1) : 99
  const best = [...roof.segments].sort((a, b) => b.irradiance * b.maxPanels - a.irradiance * a.maxPanels)[0]
  return { panels, kwp, annualGenKwh, year1Saving, systemCost, paybackYears, selfUsePct, goodPanels, bestAspect: ASPECT_FROM_LABEL[best?.azimuth] ?? 'S', avgIrr }
}

function score(h: { goodPanels: number; avgIrr: number; paybackYears: number; footprintM2: number; bestAspect: Aspect }, c: HomeCriteria) {
  const roof = Math.min(1, h.goodPanels / 14)
  const aspect = h.bestAspect === 'S' ? 1 : h.bestAspect === 'SE' || h.bestAspect === 'SW' ? 0.9 : h.bestAspect === 'E' || h.bestAspect === 'W' ? 0.7 : 0.35
  const savings = Math.max(0, Math.min(1, (16 - h.paybackYears) / 10))
  const size = Math.min(1, Math.max(0, (h.footprintM2 - 50) / 110)) // bigger home ≈ bigger bills + battery appetite
  const w = c.weights, tot = w.roof + w.aspect + w.savings + w.size || 1
  return Math.round(((roof * w.roof + aspect * w.aspect + savings * w.savings + size * w.size) / tot) * 100)
}

/* ── the engine ──────────────────────────────────────────────────────────── */

export async function runHomeFinder(
  c: HomeCriteria,
  ctx: { knownIds: Set<string>; customerAddresses: string[] },
  onProgress: (p: Progress) => void,
  onResult: (h: HomeResult) => void,
): Promise<{ measured: number; found: number; scanned: number; estimated: boolean }> {
  const counts: Partial<Record<Stage, number>> = {}
  const emit = (stage: Stage, message: string, extra: Partial<Progress> = {}) => onProgress({ stage, message, counts: { ...counts }, ...extra })

  // 1 · locate
  emit('locate', 'Locating your search areas…')
  const centres: { label: string; center: LatLng }[] = SHOWROOMS.filter((s) => c.showrooms.includes(s.id)).map((s) => ({ label: s.name, center: s.center }))
  const missed: string[] = []
  for (const a of c.areas) {
    const g = await geocodeArea(a)
    if (g) centres.push({ label: a, center: g })
    else missed.push(a)
  }
  if (!centres.length) throw new Error(missed.length ? `Couldn't locate ${missed.join(', ')} — Google Geocoding is unavailable (check billing), so use a showroom for now` : 'Pick a showroom or add at least one town or postcode')
  if (missed.length) emit('locate', `Couldn't locate ${missed.join(', ')} — skipped`)
  counts.locate = centres.length

  // 2 · homes
  const radiusM = c.radiusKm * 1000
  let raw: (RawHome & { distanceM: number; near: string })[] = []
  for (const ce of centres) {
    emit('homes', `Pulling every residential building within ${c.radiusKm} km of ${ce.label}…`)
    const hs = await homesAround(ce.center, radiusM, c.includeUntagged)
    raw.push(...hs.map((h) => ({ ...h, distanceM: Math.round(metres(ce.center, h.center)), near: ce.label })))
    counts.homes = raw.length
    emit('homes', `${raw.length.toLocaleString()} buildings found so far`)
  }
  const seen = new Set<string>()
  raw = raw.filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)))

  // 3 · filter
  emit('filter', 'Filtering by property type and size…')
  const allowed = new Set<PropertyType>([...c.propertyTypes, ...(c.includeUntagged ? (['untagged'] as PropertyType[]) : [])])
  let pool = raw
    .filter((h) => allowed.has(h.type))
    .filter((h) => h.m2 >= c.footprintMin && h.m2 <= c.footprintMax)
    .filter((h) => !(c.excludeFound && ctx.knownIds.has(h.id)))
    .filter((h) => !SHOWROOMS.some((s) => metres(s.center, h.center) < 40)) // never prospect our own showrooms
  counts.filter = pool.length
  // Spread the sample across the radius rather than only the nearest street.
  pool = pool.sort((a, b) => a.distanceM - b.distanceM)
  const step = Math.max(1, Math.floor(pool.length / c.maxHomes))
  const sample = pool.filter((_, i) => i % step === 0).slice(0, c.maxHomes)
  emit('filter', `${pool.length.toLocaleString()} homes match — measuring ${sample.length}`)

  // 4–7 · measure, model, score, address (4 at a time)
  let measured = 0, found = 0, done = 0
  let googleDown = false // after a permission/billing error, stop calling Google and estimate instead
  const queue = [...sample]
  async function worker() {
    while (queue.length) {
      const h = queue.shift()!
      let roof: RoofAnalysis | null = null
      let estimated = false
      if (!googleDown) {
        const m = await measureRoof(h.center)
        roof = m.roof
        if (!roof && /403|PERMISSION|billing|no-key|REQUEST_DENIED/i.test(m.reason || '')) googleDown = true
      }
      if (!roof && googleDown) { roof = estimateRoof(h.ring, h.m2); estimated = true }
      done++
      emit('measure', `${googleDown ? 'Estimating roofs from footprints (Google Solar unavailable)' : 'Measuring roofs from satellite'} — ${done}/${sample.length}`, { done, total: sample.length })
      if (!roof) continue
      measured++; counts.measure = measured
      const m = model(roof, c)
      const s = score({ ...m, footprintM2: h.m2 }, c)
      const pass = m.panels >= c.minPanels && m.kwp >= c.minKwp && roof.usableArea >= c.minRoofM2 && roof.specificYield >= c.minYield && c.aspects.includes(m.bestAspect) && s >= c.minScore
      if (!pass) continue
      const addr = await reverseGeocode(h.center)
      const address = addr?.formatted?.replace(/, UK$/, '') ?? `${h.addr ?? 'Unnamed home'}, near ${h.near.replace(' showroom', '')}`
      if (c.excludeCustomers && ctx.customerAddresses.some((a) => a && address.toLowerCase().includes(a.toLowerCase()))) continue
      found++; counts.score = found
      const reasons = [
        `${m.goodPanels} panels fit on ${c.aspects.includes(m.bestAspect) ? `${m.bestAspect}-facing` : ''} roof planes`,
        `${Math.round(roof.specificYield)} kWh/kWp — ${roof.specificYield >= 950 ? 'excellent' : roof.specificYield >= 850 ? 'good' : 'fair'} sunshine`,
        `${m.paybackYears}-year payback on a ${m.kwp} kWp ${c.focus === 'solar' ? 'system' : 'system + battery'}`,
        `${PROPERTY_LABEL[h.type]}, ~${Math.round(h.m2)} m² footprint`,
        ...(estimated ? ['Roof ESTIMATED from the building footprint — Google Solar unavailable, re-measure before quoting'] : ['Roof measured by Google Solar']),
      ]
      onResult({
        id: h.id, center: h.center, footprint: h.ring, footprintM2: Math.round(h.m2), type: h.type, address, postcode: addr?.postcode,
        bestAspect: m.bestAspect, roofM2: Math.round(roof.usableArea), roofPanels: m.goodPanels, panels: m.panels, kwp: m.kwp,
        annualGenKwh: m.annualGenKwh, selfUsePct: m.selfUsePct, year1Saving: m.year1Saving, systemCost: m.systemCost,
        paybackYears: m.paybackYears, score: s, reasons, distanceM: h.distanceM, near: h.near, estimated,
      })
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  emit('done', `Done — ${found} of ${measured} ${googleDown ? 'estimated' : 'measured'} homes qualify`)
  return { measured, found, scanned: raw.length, estimated: googleDown }
}

/** Store a result in the shared prospects database (reuses the SolarProspect shape). */
export function homeToProspect(h: HomeResult, campaignId: string): SolarProspect {
  const now = Date.now()
  return {
    id: h.id, campaignId, tool: 'home-finder', company: h.address.split(',')[0], address: h.address, center: h.center,
    category: PROPERTY_LABEL[h.type], distanceM: h.distanceM, roofFootprint: h.footprint,
    systemKwp: h.kwp, roofMaxKwp: h.kwp, roofAreaM2: h.roofM2, panels: h.panels, annualGenKwh: h.annualGenKwh,
    year1Saving: h.year1Saving, lifetimeSaving: Math.round(h.year1Saving * 25 * 1.1), paybackYears: h.paybackYears, npv: 0,
    co2PerYearTonnes: +(h.annualGenKwh * 0.000207).toFixed(2), selfConsumptionPct: Math.round(h.selfUsePct * 100),
    roofMeasured: !h.estimated, epcRating: null, score: h.score, reasons: h.reasons, status: 'prospected',
    contacts: [], contactsRevealed: false, createdAt: now, updatedAt: now,
  }
}

/** Plain-English brief → criteria patch (deterministic; no LLM needed for the common phrasings). */
export function parseBrief(text: string, base: HomeCriteria): { patch: Partial<HomeCriteria>; understood: string[] } {
  const t = text.toLowerCase()
  const patch: Partial<HomeCriteria> = {}
  const understood: string[] = []
  const shows = SHOWROOMS.filter((s) => t.includes(s.id))
  if (shows.length) { patch.showrooms = shows.map((s) => s.id); understood.push(`near ${shows.map((s) => s.name).join(', ')}`) }
  const pcs = text.match(/\b[A-Z]{1,2}\d[A-Z\d]?(?:\s*\d[A-Z]{2})?\b/g)
  if (pcs?.length) { patch.areas = [...new Set([...(base.areas || []), ...pcs])]; understood.push(`postcodes ${pcs.join(', ')}`) }
  const km = t.match(/(\d+(?:\.\d+)?)\s*(km|kilomet)/); const mi = t.match(/(\d+(?:\.\d+)?)\s*(mile|mi\b)/)
  if (km) { patch.radiusKm = Math.min(5, +km[1]); understood.push(`${patch.radiusKm} km radius`) }
  else if (mi) { patch.radiusKm = Math.min(5, +(+mi[1] * 1.609).toFixed(1)); understood.push(`${mi[1]} mile radius`) }
  const types: PropertyType[] = []
  if (/detached/.test(t) && !/semi/.test(t)) types.push('detached')
  if (/semi/.test(t)) types.push('semi')
  if (/terrace/.test(t)) types.push('terrace')
  if (/bungalow/.test(t)) types.push('bungalow')
  if (types.length) { patch.propertyTypes = [...types, 'house']; understood.push(types.map((x) => PROPERTY_LABEL[x].toLowerCase()).join(' + ')) }
  if (/south[- ]facing|south only/.test(t)) { patch.aspects = ['S', 'SE', 'SW']; understood.push('south-facing roofs') }
  if (/big roof|large roof|bigger roof/.test(t)) { patch.minPanels = 14; patch.minRoofM2 = 30; understood.push('large roofs (14+ panels)') }
  if (/\bev\b|electric car/.test(t)) { patch.focus = 'battery-ev'; understood.push('solar + battery + EV focus') }
  else if (/battery/.test(t)) { patch.focus = 'solar-battery'; understood.push('solar + battery focus') }
  const n = t.match(/(\d+)\s*(homes|houses|properties)/)
  if (n) { patch.maxHomes = Math.min(150, +n[1]); understood.push(`measure ${patch.maxHomes} homes`) }
  return { patch, understood }
}

export const newCampaignId = () => `hf-${rid()}`
