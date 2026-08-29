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

import { analyseRoofLive, designFrom, type SolarDesign, type Pricing, type DesignOpts, type LatLng } from './solar'
import { sourceLeads, type SourcedLead } from './sourcing'

// ── Inputs ──────────────────────────────────────────────────────────────────
export type CommercialCriteria = {
  industry?: string // free text: "warehouses", "manufacturing", "cold storage", "car dealership"…
  area: string // town / region / postcode district — where to look
  targetKwp: number // the sweet-spot system size the customer is chasing (e.g. 250)
  minKwp?: number // hard floor for the roof gate (default = 40% of target)
  jobTitles?: string[] // decision-makers to find (e.g. ["Managing Director", "Facilities Manager"])
  count?: number // how many qualified prospects to return (default 20)
}

// ── Building discovered by Places (pre-roof) ─────────────────────────────────
export type DiscoveredBuilding = {
  name: string
  address: string
  domain?: string
  center?: LatLng
  category?: string // Places type label, for the card
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
  design: SolarDesign // the roof measurement + PV costing
  epc: EpcRecord | null
  people: SourcedLead[] // decision-makers with (where found) work emails
  score: number // 0–100 overall fit
  reasons: string[] // why this prospect scores where it does
  imageUrl?: string // satellite tile with the measured roof
  roofMeasured: boolean // true = real Google Solar, false = modelled estimate
}

// Commercial pricing/behaviour — distinct from the residential defaults in solar.ts.
// Larger arrays are cheaper per kWp; businesses use most of their generation on-site by day.
const COMMERCIAL_PRICING: Pricing = { costPerKwp: 900, baseCost: 6000, perPanel: 0, marginPct: 0.15, vatPct: 0 }
const COMMERCIAL_OPTS: DesignOpts = { occupancy: 'home_all_day', importRate: 0.26, exportRate: 0.08 }

// ── Providers (backend-proxied, key server-side; graceful fallback) ──────────

/** Places discovery → real buildings with a domain. Falls back to an empty list with no key. */
async function discoverBuildings(area: string, industry: string | undefined, count: number): Promise<DiscoveredBuilding[]> {
  try {
    const r = await fetch('/api/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area, industry, count }),
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

// ── Scoring ──────────────────────────────────────────────────────────────────
// A good prospect has a roof near the target size, an EPC worth upgrading, and a reachable
// decision-maker. Worse EPC = bigger retrofit story = higher opportunity score.
const EPC_OPPORTUNITY: Record<string, number> = { A: 2, B: 4, C: 8, D: 14, E: 18, F: 20, G: 22 }

function scoreProspect(design: SolarDesign, epc: EpcRecord | null, people: SourcedLead[], target: number): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 40

  // Roof-size fit — closest to the target system size scores best.
  const ratio = target > 0 ? design.systemKwp / target : 1
  const fit = Math.max(0, 1 - Math.abs(1 - ratio)) // 1.0 at target, →0 as it diverges
  score += Math.round(fit * 30)
  reasons.push(`${Math.round(design.systemKwp)} kWp roof (${Math.round(ratio * 100)}% of your ${target} kWp target)`)

  if (design.source === 'google') { score += 6; reasons.push('Roof measured from satellite (Google Solar)') }

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
): Promise<{ prospects: CommercialProspect[]; scanned: number; live: boolean; reason?: string }> {
  const want = c.count ?? 20
  const minKwp = c.minKwp ?? Math.round(c.targetKwp * 0.4)
  const report = (p: EngineProgress) => onProgress?.(p)

  // 1) Discover — pull more than we need, since the roof gate will drop some.
  report({ stage: 'discover', message: `Searching ${c.industry || 'commercial sites'} in ${c.area}…` })
  const buildings = await discoverBuildings(c.area, c.industry, Math.max(want * 3, 30))
  const live = buildings.length > 0

  const prospects: CommercialProspect[] = []
  let scanned = 0

  for (const b of buildings) {
    if (prospects.length >= want) break
    scanned++
    report({ stage: 'measure', message: `Measuring roof at ${b.name}…`, found: prospects.length, scanned, total: buildings.length })

    // 2) Measure the roof (real Google Solar → offline fallback), then 3) cost it.
    const analysis = await analyseRoofLive(b.address)
    const design = designFrom(analysis, b.address, undefined, COMMERCIAL_PRICING, COMMERCIAL_OPTS)

    // Roof gate — skip anything too small BEFORE spending PDL credits on people.
    if (design.systemKwp < minKwp) continue

    // 4) EPC (free) — rating + floor area.
    report({ stage: 'epc', message: `Checking EPC for ${b.name}…`, found: prospects.length, scanned, total: buildings.length })
    const epc = await lookupEpc(b.address, postcodeOf(b.address))

    // 5) People (PDL credits) — survivors only, scoped to THIS company by domain.
    report({ stage: 'people', message: `Finding decision-makers at ${b.name}…`, found: prospects.length, scanned, total: buildings.length })
    const { leads } = await sourceLeads({
      company: b.name,
      domain: b.domain,
      location: c.area,
      titles: c.jobTitles,
      title: c.jobTitles?.[0],
      limit: 5,
    })

    // 6) Score + assemble the card.
    const { score, reasons } = scoreProspect(design, epc, leads, c.targetKwp)
    prospects.push({
      id: `csp-${scanned}-${(b.domain || b.name).replace(/[^a-z0-9]/gi, '').slice(0, 10)}`,
      company: b.name,
      address: b.address,
      domain: b.domain,
      center: analysis.center || b.center,
      category: b.category,
      design,
      epc,
      people: leads,
      score,
      reasons,
      imageUrl: (analysis.center || b.center) ? roofImageUrl(analysis.center || b.center!) : undefined,
      roofMeasured: design.source === 'google',
    })
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
