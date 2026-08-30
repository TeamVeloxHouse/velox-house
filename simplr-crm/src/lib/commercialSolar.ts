/* Commercial Solar Engine — the outreach funnel behind an Ovi command like
 *   "100 warehouses in the West Midlands, ~250 kWp, decision-makers".
 *
 * The roof is the QUALIFIER, the people are the PAYLOAD. We spend cheap/free calls first and only
 * spend metered PDL credits on buildings that already passed the roof-size + domain gate:
 *
 *   1. DISCOVER  Google Places → name + address + coords + website(domain)   [cheap]
 *   2. MEASURE   Google Solar (analyseRoofLive) → kWp, orientation, panels    [Google $200/mo credit]
 *      ✂ drop anything under the kWp gate here — no point finding people for a tiny roof
 *   3. COST      designFrom() with commercial pricing → system cost, savings, payback
 *   4. EPC       gov EPC register → rating + floor area (free)               [free]
 *   5. PEOPLE    PDL sourceLeads scoped by domain + job titles              [credits — survivors only]
 *   6. SCORE     blend roof fit · EPC opportunity · contactability → 0–100
 *
 * Every external provider degrades gracefully (no key → offline sample / null), so the whole engine
 * runs end-to-end in dev and lights up as each key is added to the backend .env.
 */

import { analyseRoofLive, type LatLng, type RoofAnalysis } from './solar'
import { computeCommercial, classifyIndustry, type CommercialCalc } from './commercialModel'
import { sourceLeads, type SourcedLead } from './sourcing'

// ── Inputs ──────────────────────────────────────────────────────────────────
export type CommercialCriteria = {
  industry?: string // free text: "warehouses", "manufacturing", "cold storage", "car dealership"…
  area?: string // town / region / postcode district — used when there's no pin
  pin?: LatLng // drop-a-pin centre for a radius scan (takes precedence over `area`)
  radiusM?: number // scan radius in metres (default 3000)
  targetKwp: number // the sweet-spot system size the customer is chasing (e.g. 250)
  minKwp?: number // hard floor for the roof gate (default = 40% of target)
  jobTitles?: string[] // decision-makers to find (e.g. ["Managing Director", "Facilities Manager"])
  count?: number // how many qualified prospects to return (default 20)
  skipPeople?: boolean // don't spend PDL credits during the scan — contacts are revealed on demand
}

// ── Building discovered by Places (pre-roof) ─────────────────────────────────
export type DiscoveredBuilding = {
  name: string
  address: string
  domain?: string
  center?: LatLng
  category?: string // Places type label, for the card
  distanceM?: number // distance from the dropped pin (radius scans)
}

// ── EPC register record ──────────────────────────────────────────────────────
export type EpcRecord = {
  rating: string // A–G
  score?: number // SAP/SBEM points
  floorArea?: number // m²
  buildingType?: string
  expiry?: string
}

// ── A fully-assembled prospect (one roof card) ───────────────────────────────
export type CommercialProspect = {
  id: string
  company: string
  address: string
  domain?: string
  center?: LatLng
  category?: string
  calc: CommercialCalc // optimised system + full economics + size-vs-return sweep
  roofMaxKwp: number // the roof's full capacity (what qualifies a big shed)
  roofAreaM2?: number // measured usable roof area
  epc: EpcRecord | null
  people: SourcedLead[] // decision-makers with (where found) work emails
  score: number // 0–100 overall fit
  reasons: string[] // why this prospect scores where it does
  imageUrl?: string // satellite tile with the measured roof
  roofZoom?: number // zoom that fits the whole building (bigger roofs zoom out)
  roofSegments?: { box: import('./solar').SegBox }[] // roof-plane boxes for the on-image outline
  roofMeasured: boolean // true = real Google Solar, false = modelled estimate
  distanceM?: number // distance from the dropped pin (radius scans)
}

// ── Providers (backend-proxied, key server-side; graceful fallback) ──────────

/** Places discovery → real buildings with a domain. Radius scan when a pin is given, else by area name. */
async function discoverBuildings(c: CommercialCriteria, count: number): Promise<DiscoveredBuilding[]> {
  try {
    const body = c.pin
      ? { lat: c.pin.lat, lng: c.pin.lng, radius: c.radiusM ?? 3000, industry: c.industry, count }
      : { area: c.area, industry: c.industry, count }
    const r = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) {
      const j = await r.json()
      if (Array.isArray(j?.buildings)) return j.buildings as DiscoveredBuilding[]
    }
  } catch {
    /* no backend / no key — caller handles the empty result */
  }
  return []
}

/** EPC register lookup by address. Returns null when unregistered or no token configured. */
async function lookupEpc(address: string, postcode?: string): Promise<EpcRecord | null> {
  try {
    const r = await fetch('/api/epc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, postcode }),
    })
    if (r.ok) {
      const j = await r.json()
      if (j && j.rating) return j as EpcRecord
    }
  } catch {
    /* no backend / no token */
  }
  return null
}

/** Satellite tile centred on the building — the picture on the roof card. */
export function roofImageUrl(center: LatLng, zoom = 19, size = '560x360'): string {
  return `/api/roof-image?lat=${center.lat}&lng=${center.lng}&z=${zoom}&size=${size}`
}

/** Pick a zoom that shows the WHOLE building — big sheds zoom out so nothing is cropped. */
export function zoomForRoof(a: RoofAnalysis): number {
  const boxes = a.segments.map((s) => s.box).filter(Boolean) as { sw: LatLng; ne: LatLng }[]
  if (!boxes.length || !a.center) return 19
  let latMin = 90, latMax = -90, lngMin = 180, lngMax = -180
  for (const b of boxes) {
    latMin = Math.min(latMin, b.sw.lat, b.ne.lat); latMax = Math.max(latMax, b.sw.lat, b.ne.lat)
    lngMin = Math.min(lngMin, b.sw.lng, b.ne.lng); lngMax = Math.max(lngMax, b.sw.lng, b.ne.lng)
  }
  const lat = a.center.lat
  const widthM = (lngMax - lngMin) * 111320 * Math.cos((lat * Math.PI) / 180)
  const heightM = (latMax - latMin) * 110540
  const roofM = Math.max(widthM, heightM, 12)
  // Fit ~1.7× the roof into the 560px-wide tile. mpp = 156543.03*cos/2^z.
  const targetMpp = (roofM * 1.7) / 560
  const z = Math.log2((156543.03 * Math.cos((lat * Math.PI) / 180)) / targetMpp)
  return Math.max(16, Math.min(20, Math.round(z)))
}

// ── Scoring ──────────────────────────────────────────────────────────────────
// A good prospect has a roof near the target size, an EPC worth upgrading, and a reachable
// decision-maker. Worse EPC = bigger retrofit story = higher opportunity score.
const EPC_OPPORTUNITY: Record<string, number> = { A: 2, B: 4, C: 8, D: 14, E: 18, F: 20, G: 22 }

function scoreProspect(calc: CommercialCalc, measured: boolean, epc: EpcRecord | null, people: SourcedLead[], target: number): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 40
  const roofKwp = calc.maxKwp
  const rec = calc.recommended

  // Roof-size fit — a roof at/above the target scores best (bigger is fine, tiny is penalised).
  const ratio = target > 0 ? roofKwp / target : 1
  const fit = ratio >= 1 ? 1 : Math.max(0, ratio)
  score += Math.round(fit * 30)
  reasons.push(`${Math.round(roofKwp)} kWp roof capacity (${Math.round(ratio * 100)}% of your ${target} kWp target)`)
  reasons.push(`Best-payback system ${Math.round(rec.kwp)} kWp — ${rec.paybackYears}y payback, ${rec.selfConsumptionPct}% self-used`)

  if (measured) { score += 6; reasons.push('Roof measured from satellite (Google Solar)') }
  if (rec.paybackYears > 0 && rec.paybackYears <= 6) { score += 6; reasons.push(`Strong economics — ${rec.paybackYears}y payback`) }

  if (epc) {
    const opp = EPC_OPPORTUNITY[epc.rating?.toUpperCase()?.[0]] ?? 8
    score += opp
    reasons.push(`EPC ${epc.rating}${opp >= 14 ? ' — strong upgrade case' : ''}`)
  }

  const reachable = people.filter((p) => p.email).length
  if (reachable) { score += Math.min(12, 6 + reachable * 2); reasons.push(`${reachable} decision-maker${reachable > 1 ? 's' : ''} reachable by email`) }
  else if (people.length) { score += 4; reasons.push(`${people.length} contact${people.length > 1 ? 's' : ''} found (no direct email yet)`) }

  return { score: Math.max(30, Math.min(99, score)), reasons }
}

// ── Progress streaming (so Ovi can show the funnel working) ──────────────────
export type EngineStage = 'discover' | 'measure' | 'epc' | 'people' | 'score' | 'done'
export type EngineProgress = {
  stage: EngineStage
  message: string
  found?: number // qualified so far
  scanned?: number // buildings looked at
  total?: number // buildings to scan
}

function postcodeOf(address: string): string | undefined {
  const m = address.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)
  return m ? m[1].toUpperCase() : undefined
}

// ── The engine ────────────────────────────────────────────────────────────────
export async function runCommercialSolarEngine(
  c: CommercialCriteria,
  onProgress?: (p: EngineProgress) => void,
  onProspect?: (p: CommercialProspect) => void, // fires as each qualified prospect is assembled (live cards)
): Promise<{ prospects: CommercialProspect[]; scanned: number; live: boolean; reason?: string }> {
  const want = c.count ?? 20
  const minKwp = c.minKwp ?? Math.round(c.targetKwp * 0.4)
  const report = (p: EngineProgress) => onProgress?.(p)

  // 1) Discover — pull more than we need, since the roof gate will drop some.
  const where = c.pin ? `within ${((c.radiusM ?? 3000) / 1000).toFixed(1)} km of the dropped pin` : `in ${c.area}`
  report({ stage: 'discover', message: `Scanning ${c.industry || 'commercial sites'} ${where}…` })
  const buildings = await discoverBuildings(c, Math.max(want * 3, 30))
  const live = buildings.length > 0

  const prospects: CommercialProspect[] = []
  let scanned = 0

  for (const b of buildings) {
    if (prospects.length >= want) break
    scanned++
    report({ stage: 'measure', message: `Measuring roof at ${b.name}…`, found: prospects.length, scanned, total: buildings.length })

    // 2) Measure the roof (real Google Solar → offline fallback), then 3) cost it accurately.
    // Prefer the precise Places centre over geocoding the name — better for big sheds.
    const analysis = await analyseRoofLive(b.address, b.center)
    // 4) EPC (free) — rating + floor area (floor area sharpens the demand estimate).
    report({ stage: 'epc', message: `Checking EPC for ${b.name}…`, found: prospects.length, scanned, total: buildings.length })
    const epc = await lookupEpc(b.address, postcodeOf(b.address))
    const calc = computeCommercial(analysis, { industry: classifyIndustry(c.industry), floorAreaM2: epc?.floorArea, objective: 'payback' })

    // Roof gate — skip anything whose ROOF CAPACITY is too small (before spending PDL credits).
    if (calc.maxKwp < minKwp) continue

    // 5) People (PDL credits) — survivors only, scoped to THIS company by domain.
    // Skipped during a scan when contacts are revealed on demand (the reveal = spend model).
    let leads: SourcedLead[] = []
    if (!c.skipPeople) {
      report({ stage: 'people', message: `Finding decision-makers at ${b.name}…`, found: prospects.length, scanned, total: buildings.length })
      leads = (await sourceLeads({ company: b.name, domain: b.domain, location: c.area, titles: c.jobTitles, title: c.jobTitles?.[0], limit: 5 })).leads
    }

    // 6) Score + assemble the card.
    const { score, reasons } = scoreProspect(calc, analysis.source === 'google', epc, leads, c.targetKwp)
    const center = analysis.center || b.center
    const zoom = zoomForRoof(analysis)
    const prospect: CommercialProspect = {
      id: `csp-${scanned}-${(b.domain || b.name).replace(/[^a-z0-9]/gi, '').slice(0, 10)}`,
      company: b.name,
      address: b.address,
      domain: b.domain,
      center,
      category: b.category,
      calc,
      roofMaxKwp: Math.round(calc.maxKwp),
      roofAreaM2: Math.round(analysis.usableArea),
      epc,
      people: leads,
      score,
      reasons,
      imageUrl: center ? roofImageUrl(center, zoom) : undefined,
      roofZoom: zoom,
      roofSegments: analysis.segments.filter((s) => s.box).map((s) => ({ box: s.box! })),
      roofMeasured: analysis.source === 'google',
      distanceM: b.distanceM,
    }
    prospects.push(prospect)
    onProspect?.(prospect)
  }

  prospects.sort((a, b) => b.score - a.score)
  report({ stage: 'done', message: `${prospects.length} qualified prospect${prospects.length === 1 ? '' : 's'} from ${scanned} sites scanned`, found: prospects.length, scanned, total: buildings.length })

  return {
    prospects,
    scanned,
    live,
    reason: live ? undefined : 'No building source configured — add GOOGLE_MAPS_API_KEY (Places) to go live.',
  }
}
