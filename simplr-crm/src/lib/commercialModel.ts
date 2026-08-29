/* Commercial solar — the "mega calculator".
 *
 * Takes a measured roof + the business's industry and returns a fully-optimised system: it doesn't
 * just fill the roof, it SWEEPS system sizes and picks the one with the best payback (or NPV),
 * because past the point where generation exceeds daytime demand every extra panel only earns the
 * low export rate and drags the return down.
 *
 * Every number is derived, overridable, and location-aware:
 *   • demand   — from industry energy-intensity benchmarks × floor area (kWh/m²/yr)
 *   • yield    — the roof's specific yield (Google Solar per-building, or MCS regional) × shade
 *   • self-consumption — how much generation the business uses on-site (import rate) vs exports (SEG)
 *   • finance  — 25-year cashflow with energy-price inflation, panel degradation, O&M, discounting
 *
 * Outputs: recommended kWp, panels, Year-1 saving, 25-year saving, payback, IRR, NPV, LCOE,
 * £/kWp, self-consumption %, and CO₂ saved per year + lifetime.
 */

import { UK, npv, irr, simplePayback, lcoe } from './energy'
import type { RoofAnalysis } from './solar'
import { buildHourlyLoad } from './loadProfiles'

// ── Panel spec — configurable, and drives BOTH kWp and how many fit on the roof ──────────────
export type PanelSpec = { watts: number; width: number; height: number } // metres
// A current-generation commercial mono panel. Swap freely; Google Solar also reports the exact
// panel size it assumed, which we read when available (see fromRoof()).
export const DEFAULT_PANEL: PanelSpec = { watts: 440, width: 1.134, height: 1.722 }
export const panelArea = (p: PanelSpec) => p.width * p.height // m² per module

// ── Industry energy benchmarks (UK non-domestic, electricity only) ───────────────────────────
// kwhPerM2 = typical annual electricity use per m² of floor area (CIBSE TM46-style approximations,
// electricity portion only — clearly labelled and overridable per prospect).
// daytimeMatch = the share of that demand that lands in daylight hours, i.e. how much solar can
// realistically offset on-site (a 24/7 cold store matches less of solar's midday peak than a 9–5 office).
export type IndustryKey =
  | 'warehouse' | 'cold_storage' | 'manufacturing' | 'light_industrial' | 'office' | 'retail'
  | 'supermarket' | 'hotel' | 'leisure' | 'school' | 'hospital' | 'car_dealership' | 'data_centre' | 'other'

export const INDUSTRY_ENERGY: Record<IndustryKey, { label: string; kwhPerM2: number; daytimeMatch: number }> = {
  warehouse: { label: 'Warehouse / distribution', kwhPerM2: 35, daytimeMatch: 0.55 },
  cold_storage: { label: 'Cold storage', kwhPerM2: 130, daytimeMatch: 0.5 },
  manufacturing: { label: 'Manufacturing / factory', kwhPerM2: 95, daytimeMatch: 0.6 },
  light_industrial: { label: 'Light industrial', kwhPerM2: 65, daytimeMatch: 0.58 },
  office: { label: 'Office', kwhPerM2: 95, daytimeMatch: 0.62 },
  retail: { label: 'Retail (general)', kwhPerM2: 165, daytimeMatch: 0.65 },
  supermarket: { label: 'Supermarket / food retail', kwhPerM2: 400, daytimeMatch: 0.6 },
  hotel: { label: 'Hotel', kwhPerM2: 105, daytimeMatch: 0.48 },
  leisure: { label: 'Leisure / gym', kwhPerM2: 200, daytimeMatch: 0.55 },
  school: { label: 'School', kwhPerM2: 40, daytimeMatch: 0.7 },
  hospital: { label: 'Hospital', kwhPerM2: 90, daytimeMatch: 0.55 },
  car_dealership: { label: 'Car dealership', kwhPerM2: 120, daytimeMatch: 0.62 },
  data_centre: { label: 'Data centre', kwhPerM2: 2000, daytimeMatch: 0.5 },
  other: { label: 'Other commercial', kwhPerM2: 80, daytimeMatch: 0.58 },
}

/** Map free-text ("warehouses", "cold store", "car showroom") to a benchmark key. */
export function classifyIndustry(text?: string): IndustryKey {
  const t = (text || '').toLowerCase()
  if (/cold|chill|freez|refriger/.test(t)) return 'cold_storage'
  if (/data.?cent/.test(t)) return 'data_centre'
  if (/wareh|logist|distrib|storage|fulfil/.test(t)) return 'warehouse'
  if (/factor|manufact|producti|assembl|process/.test(t)) return 'manufacturing'
  if (/superm|grocer|food.?retail/.test(t)) return 'supermarket'
  if (/retail|shop|store|showroom/.test(t)) return t.includes('car') ? 'car_dealership' : 'retail'
  if (/car|vehicle|dealer|garage|motor/.test(t)) return 'car_dealership'
  if (/hotel|hospitality|guest/.test(t)) return 'hotel'
  if (/gym|leisure|sport|fitness/.test(t)) return 'leisure'
  if (/school|colleg|academy|educat/.test(t)) return 'school'
  if (/hospital|health|clinic|care/.test(t)) return 'hospital'
  if (/office|workplace/.test(t)) return 'office'
  if (/industr|workshop|unit/.test(t)) return 'light_industrial'
  return 'other'
}

/** Estimate annual electricity demand (kWh) from floor area and industry benchmark. */
export function estimateAnnualDemandKwh(floorAreaM2: number, industry: IndustryKey): number {
  return Math.round(floorAreaM2 * INDUSTRY_ENERGY[industry].kwhPerM2)
}

// ── Cost curve — £/kWp falls with scale (economies of a bigger install) ──────────────────────
export function costPerKwp(kwp: number): number {
  if (kwp <= 30) return 1150
  if (kwp <= 100) return 950
  if (kwp <= 250) return 850
  if (kwp <= 500) return 780
  return 720
}
const BASE_INSTALL = 6000 // £ fixed mobilisation (scaffold, DNO, commissioning)
const OM_PER_KWP_YR = 8 // £/kWp/yr operations & maintenance

// ── Inputs & outputs ─────────────────────────────────────────────────────────────────────────
export type CommercialInputs = {
  industry?: IndustryKey
  floorAreaM2?: number // from EPC when available; else estimated from the roof footprint
  annualDemandKwh?: number // hard override, wins over the benchmark estimate
  panel?: PanelSpec
  importRate?: number // £/kWh saved on self-consumed generation
  exportRate?: number // £/kWh earned on export (SEG)
  inflation?: number // energy-price inflation /yr
  discount?: number // discount rate for NPV
  degradation?: number // panel output loss /yr
  years?: number // appraisal period (default 25)
  objective?: 'payback' | 'npv' // what to optimise system size for
  hourlyGenPerKwp?: number[] // 8,760 Wh/kWp from PVGIS — enables the accurate hourly simulation
}

export type SystemResult = {
  kwp: number
  panels: number
  annualGenKwh: number
  selfConsumedKwh: number
  exportedKwh: number
  selfConsumptionPct: number // % of generation used on-site
  demandOffsetPct: number // % of the site's demand covered
  capex: number
  costPerKwp: number
  year1Saving: number
  lifetimeSaving: number // sum over the appraisal period
  paybackYears: number
  npv: number
  irr: number | null
  lcoe: number // £/kWh
  co2PerYearTonnes: number
  co2LifetimeTonnes: number
}

export type CommercialCalc = {
  recommended: SystemResult // the optimised system
  roofMax: SystemResult // fill-the-roof, for comparison
  sweep: { kwp: number; payback: number; npv: number; year1: number }[] // for the size-vs-return chart
  demandKwh: number
  specificYield: number
  maxKwp: number
  industry: IndustryKey
  method: 'hourly' | 'coefficient' // 'hourly' = PVGIS 8760-hour simulation (single-site accurate)
  assumptions: Required<Omit<CommercialInputs, 'annualDemandKwh' | 'floorAreaM2' | 'hourlyGenPerKwp'>> & { floorAreaM2: number }
}

// Roof footprint (m²) — for single-storey commercial sheds this ≈ floor area, a reasonable demand
// proxy until EPC gives the real figure. Google's usableArea is the array area, so gross up a little.
function footprintFrom(roof: RoofAnalysis): number {
  return Math.round((roof.usableArea || 0) * 1.15)
}

/** Max panels that physically fit, honouring the chosen panel's dimensions (not just Google's). */
function maxPanelsFor(roof: RoofAnalysis, panel: PanelSpec): number {
  const byArea = roof.usableArea ? Math.floor(roof.usableArea / panelArea(panel)) : 0
  // Trust Google's own count when we're using a comparable panel; otherwise use the area-derived one.
  return Math.max(byArea, roof.maxPanels || 0) && byArea > 0 ? byArea : roof.maxPanels || byArea
}

/**
 * Hour-by-hour self-consumption: the accurate method. Scales the per-kWp generation shape to the
 * system size and, for every one of 8,760 hours, the site can only self-consume min(generated, load)
 * that hour — the rest exports. This is what makes savings defensible.
 */
function simulateHourly(kwp: number, shade: number, hourlyGenPerKwpWh: number[], hourlyLoadKwh: number[]) {
  let gen = 0, self = 0
  const n = Math.min(hourlyGenPerKwpWh.length, hourlyLoadKwh.length)
  for (let h = 0; h < n; h++) {
    const g = (hourlyGenPerKwpWh[h] / 1000) * kwp * shade // kWh generated this hour
    gen += g
    self += g < hourlyLoadKwh[h] ? g : hourlyLoadKwh[h]
  }
  return { annualGen: Math.round(gen), selfConsumed: Math.round(self) }
}

/** Model one system size end-to-end. */
function evaluate(kwp: number, panels: number, ctx: {
  specificYield: number; shade: number; demandKwh: number; daytimeMatch: number
  importRate: number; exportRate: number; inflation: number; discount: number; degradation: number; years: number
  hourlyGen?: number[]; hourlyLoad?: number[]
}): SystemResult {
  let annualGen: number
  let selfConsumed: number
  if (ctx.hourlyGen && ctx.hourlyLoad) {
    const sim = simulateHourly(kwp, ctx.shade, ctx.hourlyGen, ctx.hourlyLoad)
    annualGen = sim.annualGen
    selfConsumed = sim.selfConsumed
  } else {
    // Fast coefficient method (bulk scanning): cap self-consumption by the daytime-coincident demand.
    annualGen = Math.round(kwp * ctx.specificYield * ctx.shade)
    const daytimeDemand = ctx.demandKwh * ctx.daytimeMatch
    selfConsumed = Math.round(Math.min(annualGen * 0.9, daytimeDemand))
  }
  const exported = Math.max(0, annualGen - selfConsumed)
  const selfConsumptionPct = annualGen ? Math.round((selfConsumed / annualGen) * 100) : 0
  const demandOffsetPct = ctx.demandKwh ? Math.round((selfConsumed / ctx.demandKwh) * 100) : 0

  const capex = Math.round(kwp * costPerKwp(kwp) + BASE_INSTALL)
  const om = kwp * OM_PER_KWP_YR
  const year1Gross = selfConsumed * ctx.importRate + exported * ctx.exportRate
  const year1Saving = Math.round(year1Gross - om)

  // 25-year cashflow: energy prices inflate, panels degrade, O&M roughly flat.
  const cashflows: number[] = [-capex]
  const savings: number[] = []
  const genSeries: number[] = []
  const omSeries: number[] = []
  for (let y = 1; y <= ctx.years; y++) {
    const priceFactor = Math.pow(1 + ctx.inflation, y - 1)
    const genFactor = Math.pow(1 - ctx.degradation, y - 1)
    const gross = year1Gross * priceFactor * genFactor
    const net = gross - om
    savings.push(net)
    cashflows.push(net)
    genSeries.push(annualGen * genFactor)
    omSeries.push(om)
  }

  const lifetimeSaving = Math.round(savings.reduce((a, b) => a + b, 0))
  const paybackYears = simplePayback(capex, savings)
  const co2PerYear = (annualGen * UK.gridCo2PerKwh) / 1000 // tonnes
  const co2Lifetime = genSeries.reduce((a, g) => a + (g * UK.gridCo2PerKwh) / 1000, 0)

  return {
    kwp: Math.round(kwp * 10) / 10,
    panels,
    annualGenKwh: annualGen,
    selfConsumedKwh: selfConsumed,
    exportedKwh: exported,
    selfConsumptionPct,
    demandOffsetPct,
    capex,
    costPerKwp: costPerKwp(kwp),
    year1Saving,
    lifetimeSaving,
    paybackYears: Math.round(paybackYears * 10) / 10,
    npv: Math.round(npv(ctx.discount, cashflows)),
    irr: irr(cashflows),
    lcoe: Math.round(lcoe(capex, omSeries, genSeries) * 1000) / 1000,
    co2PerYearTonnes: Math.round(co2PerYear * 10) / 10,
    co2LifetimeTonnes: Math.round(co2Lifetime),
  }
}

/** The full calculation: optimise system size for the chosen objective and return everything. */
export function computeCommercial(roof: RoofAnalysis, inputs: CommercialInputs = {}): CommercialCalc {
  const panel = inputs.panel || DEFAULT_PANEL
  const industry = inputs.industry || 'other'
  const bench = INDUSTRY_ENERGY[industry]
  const floorAreaM2 = inputs.floorAreaM2 || footprintFrom(roof)
  const demandKwh = inputs.annualDemandKwh || estimateAnnualDemandKwh(floorAreaM2, industry)

  const importRate = inputs.importRate ?? UK.importRate
  const exportRate = inputs.exportRate ?? UK.exportRate
  const inflation = inputs.inflation ?? UK.energyInflation
  const discount = inputs.discount ?? UK.discountRate
  const degradation = inputs.degradation ?? UK.pvDegradation
  const years = inputs.years ?? 25
  const objective = inputs.objective ?? 'payback'

  const maxPanels = maxPanelsFor(roof, panel)
  const maxKwp = (maxPanels * panel.watts) / 1000
  const shade = roof.shadeFactor ?? 1

  // If a PVGIS hourly profile is supplied, use the accurate hour-by-hour simulation and take the
  // specific yield straight from that profile; otherwise fall back to the roof's yield + coefficient.
  const hourlyGen = inputs.hourlyGenPerKwp
  const hourlyLoad = hourlyGen ? buildHourlyLoad(demandKwh, industry) : undefined
  const specificYield = hourlyGen
    ? Math.round((hourlyGen.reduce((a, b) => a + b, 0) / 1000) * shade)
    : roof.specificYield || 950
  const method: 'hourly' | 'coefficient' = hourlyGen ? 'hourly' : 'coefficient'
  const ctx = { specificYield, shade, demandKwh, daytimeMatch: bench.daytimeMatch, importRate, exportRate, inflation, discount, degradation, years, hourlyGen, hourlyLoad }

  // Sweep system sizes from small up to the roof max; keep the sweep for the chart.
  const STEPS = 28
  const minPanels = Math.max(1, Math.round(maxPanels * 0.04))
  const sweep: { kwp: number; payback: number; npv: number; year1: number }[] = []
  let best: SystemResult | null = null
  for (let i = 0; i <= STEPS; i++) {
    const panels = Math.round(minPanels + ((maxPanels - minPanels) * i) / STEPS)
    if (panels < 1) continue
    const kwp = (panels * panel.watts) / 1000
    const r = evaluate(kwp, panels, ctx)
    sweep.push({ kwp: r.kwp, payback: r.paybackYears, npv: r.npv, year1: r.year1Saving })
    const better = objective === 'payback'
      ? r.paybackYears < (best?.paybackYears ?? Infinity)
      : r.npv > (best?.npv ?? -Infinity)
    // Only consider systems that actually pay back within the appraisal period.
    if (better && isFinite(r.paybackYears) && r.paybackYears <= years) best = r
  }

  const recommended = best || evaluate(maxKwp, maxPanels, ctx)
  const roofMax = evaluate(maxKwp, maxPanels, ctx)

  return {
    recommended,
    roofMax,
    sweep,
    demandKwh,
    specificYield,
    maxKwp: Math.round(maxKwp * 10) / 10,
    industry,
    method,
    assumptions: { industry, panel, importRate, exportRate, inflation, discount, degradation, years, objective, floorAreaM2 },
  }
}
