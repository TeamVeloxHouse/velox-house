/* Solar design model — Phase 1 of the Artemis-style engine.
 *
 * This is a deterministic, offline model so the full design → savings → price flow works
 * with no backend or API keys. Swap `analyseRoof()` for a call to the Google Solar API
 * (Building Insights / roof segments) + NREL PVWatts (production) behind a backend, and the
 * return shape below stays the same, so the Design Studio UI is unchanged.
 */

export type RoofSegment = { id: string; label: string; azimuth: string; pitch: number; maxPanels: number; irradiance: number }
export type RoofAnalysis = {
  segments: RoofSegment[]
  usableArea: number // m²
  specificYield: number // kWh/kWp/yr (location factor)
  maxPanels: number
  panelWatts: number
  source: 'google' | 'model'
}
export type SolarDesign = {
  address: string
  segments: RoofSegment[]
  usableArea: number // m²
  panels: number
  maxPanels: number
  panelWatts: number
  systemKwp: number
  specificYield: number // kWh/kWp/yr (location factor)
  annualProduction: number // kWh
  annualSavings: number // £
  billOffsetPct: number
  systemCost: number
  payback: number // years
  lifetimeSavings: number // £ over 25y
  co2PerYear: number // tonnes
  source: 'google' | 'model'
}

const PANEL_W = 440
const PANEL_AREA = 1.9 // m²
const IMPORT_RATE = 0.28 // £/kWh
const EXPORT_RATE = 0.15 // £/kWh (SEG)
const SELF_USE = 0.42 // fraction consumed on-site
const COST_PER_KWP = 1350 // £/kWp installed
const BASE_COST = 1800 // £ fixed (scaffold, inverter, install)
const CO2_PER_KWH = 0.207 / 1000 // tonnes CO2 per kWh (UK grid)

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
  const segCount = 1 + Math.round(rand(0, 0, 2)) // 1–3 usable planes
  const segments: RoofSegment[] = Array.from({ length: segCount }, (_, i) => {
    const az = aspects[(seed >>> (i * 3)) % aspects.length]
    const irr = az.includes('South') ? rand(i * 2, 0.92, 1.0) : az === 'West' || az === 'East' ? rand(i * 2, 0.78, 0.9) : 0.85
    const area = rand(i * 4 + 1, 22, 55)
    return { id: `s${i}`, label: `${az}-facing plane`, azimuth: az, pitch: Math.round(rand(i * 5, 25, 40)), maxPanels: Math.floor((area * 0.72) / PANEL_AREA), irradiance: irr }
  })
  const usableArea = segments.reduce((a, s) => a + s.maxPanels * PANEL_AREA, 0)
  const specificYield = Math.round(rand(7, 950, 1120)) // UK kWh/kWp/yr
  const maxPanels = segments.reduce((a, s) => a + s.maxPanels, 0)
  return { segments, usableArea: Math.round(usableArea), specificYield, maxPanels, panelWatts: PANEL_W, source: 'model' }
}

export type Pricing = { costPerKwp: number; baseCost: number; perPanel: number; marginPct: number; vatPct: number }

/** Build a full design from a roof analysis; `panelOverride` lets the UI add/remove panels live.
 *  `pricing` is the contractor's own calculator config (falls back to sensible defaults). */
export function designFrom(a: RoofAnalysis, address: string, panelOverride?: number, pricing?: Pricing): SolarDesign {
  const { segments, usableArea, specificYield, maxPanels } = a
  const panelWatts = a.panelWatts || PANEL_W
  const panels = Math.max(4, Math.min(maxPanels, panelOverride ?? Math.round(maxPanels * 0.82)))

  // weight production by the segments the panels actually sit on (best aspects fill first)
  const ordered = [...segments].sort((a, b) => b.irradiance - a.irradiance)
  let left = panels
  let irrWeighted = 0
  for (const s of ordered) { const take = Math.min(left, s.maxPanels); irrWeighted += take * s.irradiance; left -= take; if (left <= 0) break }
  const avgIrr = panels > 0 ? irrWeighted / panels : 0.9

  const systemKwp = (panels * panelWatts) / 1000
  const annualProduction = Math.round(systemKwp * specificYield * avgIrr)
  const annualSavings = Math.round(annualProduction * (SELF_USE * IMPORT_RATE + (1 - SELF_USE) * EXPORT_RATE))
  const typicalBill = 1400 // £/yr household electricity
  const billOffsetPct = Math.min(100, Math.round(((annualProduction * SELF_USE * IMPORT_RATE) / typicalBill) * 100))
  // Contractor's own pricing (falls back to defaults)
  const p = pricing ?? { costPerKwp: COST_PER_KWP, baseCost: BASE_COST, perPanel: 0, marginPct: 0, vatPct: 0 }
  const rawCost = systemKwp * p.costPerKwp + p.baseCost + panels * (p.perPanel || 0)
  const systemCost = Math.round((rawCost * (1 + p.marginPct / 100) * (1 + p.vatPct / 100)) / 50) * 50
  const payback = +(systemCost / annualSavings).toFixed(1)
  const lifetimeSavings = Math.round(annualSavings * 25 * 0.9 - systemCost)
  const co2PerYear = +(annualProduction * CO2_PER_KWH).toFixed(2)

  return { address, segments, usableArea: Math.round(usableArea), panels, maxPanels, panelWatts, systemKwp: +systemKwp.toFixed(2), specificYield, annualProduction, annualSavings, billOffsetPct, systemCost, payback, lifetimeSavings, co2PerYear, source: a.source }
}

/** Offline convenience: analyse + design in one call. */
export function designFor(address: string, panelOverride?: number, pricing?: Pricing): SolarDesign {
  return designFrom(analyseRoof(address), address, panelOverride, pricing)
}

/** Live: ask the backend for a Google Solar analysis; fall back to the offline model. */
export async function analyseRoofLive(address: string): Promise<RoofAnalysis> {
  try {
    const r = await fetch('/api/solar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) })
    if (r.ok) {
      const j = await r.json()
      if (j && !j.fallback && Array.isArray(j.segments) && j.segments.length) return j as RoofAnalysis
    }
  } catch {
    /* network / no backend — fall through */
  }
  return analyseRoof(address)
}

export const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`

/** Monthly payment for a finance product on a given system cost (standard amortisation). */
export function monthlyPayment(systemCost: number, apr: number, termMonths: number, depositPct: number): number {
  const principal = systemCost * (1 - depositPct / 100)
  const r = apr / 100 / 12
  if (r === 0) return Math.round(principal / termMonths)
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -termMonths)))
}
