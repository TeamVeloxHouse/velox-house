/* Shared clean-energy engine for the Studio calculators.
 *
 * The single import surface every calculator page reads from: MCS solar helpers (re-exported
 * from solar.ts), plus the finance solvers, battery model, and EV model that the Battery Sizer,
 * Commercial Solar and Whole-Home tools build on. Keep the maths here and the pages thin.
 *
 * Units: energy kWh, power kW, money £ (pence only where a UI asks for p/mile), CO₂ tonnes.
 */

// ── Re-export the MCS solar surface so pages import from one place ──────────
import type { Occupancy } from './solar'
export { regionYield, orientationTiltFactor, selfConsumptionRate, designFor, designFrom, analyseRoof, analyseRoofLive, gbp, monthlyPayment } from './solar'
export type { Occupancy, RoofAnalysis, SolarDesign, Pricing, DesignOpts } from './solar'

// ── UK default assumptions (all overridable per quote) ─────────────────────
export const UK = {
  importRate: 0.28, // £/kWh
  exportRate: 0.15, // £/kWh (SEG)
  evOffPeakRate: 0.075, // £/kWh (e.g. Intelligent Octopus overnight)
  publicRapidRate: 0.79, // £/kWh
  petrolPricePerLitre: 1.42, // £/L
  dieselPricePerLitre: 1.48, // £/L
  gridCo2PerKwh: 0.207, // kg CO₂ / kWh (UK grid)
  petrolCo2PerLitre: 2.31, // kg CO₂ / L
  dieselCo2PerLitre: 2.68, // kg CO₂ / L
  litresPerGallon: 4.54609,
  energyInflation: 0.05, // yr-on-yr
  discountRate: 0.06,
  pvDegradation: 0.005, // /yr
}

// ── Finance solvers (used by Battery Sizer & Commercial Solar) ─────────────
/** Net present value of a cashflow series discounted at `rate`. cashflows[0] is year 0. */
export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, cf, y) => acc + cf / Math.pow(1 + rate, y), 0)
}

/** Internal rate of return — the rate where NPV = 0. Bisection, robust for solar-shaped flows.
 *  Returns null if it can't bracket a root (e.g. never profitable). */
export function irr(cashflows: number[]): number | null {
  const f = (r: number) => npv(r, cashflows)
  let lo = -0.9, hi = 1.0
  let flo = f(lo), fhi = f(hi)
  if (flo * fhi > 0) return null
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (Math.abs(fm) < 1e-6) return mid
    if (flo * fm < 0) { hi = mid; fhi = fm } else { lo = mid; flo = fm }
  }
  return (lo + hi) / 2
}

/** First year the cumulative (undiscounted) cashflow turns positive. Fractional. */
export function simplePayback(capex: number, annualSavings: number[]): number {
  let cum = -capex
  for (let y = 0; y < annualSavings.length; y++) {
    const next = cum + annualSavings[y]
    if (next >= 0) return y + (-cum) / annualSavings[y]
    cum = next
  }
  return Infinity
}

/** Levelised cost of energy: lifetime cost ÷ lifetime generation (£/kWh). */
export function lcoe(capex: number, annualCost: number[], annualKwh: number[]): number {
  const cost = capex + annualCost.reduce((a, b) => a + b, 0)
  const gen = annualKwh.reduce((a, b) => a + b, 0)
  return gen > 0 ? cost / gen : 0
}

// ── Battery model (foundation for the Battery Sizer) ───────────────────────
export type BatteryChem = { dod: number; roundTrip: number }
export const CHEMISTRY: Record<string, BatteryChem> = {
  lifepo4: { dod: 0.9, roundTrip: 0.92 },
  nmc: { dod: 0.85, roundTrip: 0.9 },
  leadacid: { dod: 0.5, roundTrip: 0.8 },
}

/** Usable energy from a nameplate rating after depth-of-discharge and round-trip losses. */
export function usableCapacity(nameplateKwh: number, chem: BatteryChem): number {
  return nameplateKwh * chem.dod * chem.roundTrip
}

/** Nameplate kWh needed to deliver `usableKwh` of real output. */
export function nameplateFor(usableKwh: number, chem: BatteryChem): number {
  return usableKwh / (chem.dod * chem.roundTrip)
}

// ── EV model ───────────────────────────────────────────────────────────────
export type EvInputs = {
  annualMiles: number
  miPerKWh: number // EV efficiency
  homeSharePct: number // % of charging done at home
  homeRate: number // £/kWh at home (off-peak if on an EV tariff)
  publicRate: number // £/kWh public rapid
  solarSharePct?: number // % of HOME charging drawn from own solar (~free)
  chargingLoss?: number // AC→battery loss, default 0.10
  petrolMpg: number
  fuelPricePerLitre: number
  fuelCo2PerLitre?: number // default petrol
}
export type EvResult = {
  blendedRate: number // £/kWh across the home/public mix, after solar
  evPencePerMile: number
  petrolPencePerMile: number
  evAnnualCost: number // £
  petrolAnnualCost: number // £
  annualSaving: number // £
  annualKwh: number
  co2SavedTonnes: number
}

/** Compare an EV against the buyer's current petrol/diesel car on their real tariff mix. */
export function evComparison(i: EvInputs): EvResult {
  const homeShare = Math.min(1, Math.max(0, i.homeSharePct / 100))
  const publicShare = 1 - homeShare
  const solarShare = Math.min(1, Math.max(0, (i.solarSharePct ?? 0) / 100))
  const loss = i.chargingLoss ?? 0.1

  // Home charging: the solar-charged slice is ~free; the rest is billed at the home rate.
  const effHomeRate = i.homeRate * (1 - solarShare)
  const blendedRate = homeShare * effHomeRate + publicShare * i.publicRate

  const kWhPerMile = (1 / i.miPerKWh) * (1 + loss) // billed kWh incl. charging losses
  const evPerMile = kWhPerMile * blendedRate // £/mile
  const litresPerMile = UK.litresPerGallon / i.petrolMpg
  const petrolPerMile = litresPerMile * i.fuelPricePerLitre // £/mile

  const annualKwh = i.annualMiles * kWhPerMile
  const evAnnualCost = evPerMile * i.annualMiles
  const petrolAnnualCost = petrolPerMile * i.annualMiles

  const litresPerYear = litresPerMile * i.annualMiles
  const petrolCo2 = litresPerYear * (i.fuelCo2PerLitre ?? UK.petrolCo2PerLitre) // kg
  const evCo2 = annualKwh * (1 - homeShare * solarShare) * UK.gridCo2PerKwh // kg (solar slice ~0)
  const co2SavedTonnes = Math.max(0, (petrolCo2 - evCo2) / 1000)

  return {
    blendedRate,
    evPencePerMile: +(evPerMile * 100).toFixed(1),
    petrolPencePerMile: +(petrolPerMile * 100).toFixed(1),
    evAnnualCost: Math.round(evAnnualCost),
    petrolAnnualCost: Math.round(petrolAnnualCost),
    annualSaving: Math.round(petrolAnnualCost - evAnnualCost),
    annualKwh: Math.round(annualKwh),
    co2SavedTonnes: +co2SavedTonnes.toFixed(2),
  }
}

/** Common EV efficiencies (mi/kWh) for a quick preset picker. */
export const EV_PRESETS: { label: string; miPerKWh: number }[] = [
  { label: 'Small EV (e.g. Renault 5, MG4)', miPerKWh: 4.2 },
  { label: 'Family EV (e.g. Tesla Model 3, Kia EV6)', miPerKWh: 3.8 },
  { label: 'Large EV / SUV (e.g. Model Y, Enyaq)', miPerKWh: 3.3 },
  { label: 'Electric van (e.g. e-Transit)', miPerKWh: 2.4 },
]

// ── Whole-home half-hourly dispatch simulation ─────────────────────────────
// This is the engine that turns three isolated calculators into ONE system.
// Solar generation, the household base load, the EV (a schedulable load) and the
// battery all meet on the same timeline — a representative day per month at
// half-hourly resolution (48 slots) — so self-consumption, solar-soak EV
// charging and battery-discharge timing fall out of the dispatch instead of
// being guessed with a single ratio. Every calculator page (Battery Sizer, EV
// planner, Whole-Home ROI) is just a different call into simulateHome().

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Share of a south-facing UK array's annual yield by month (sums to ~1).
const PV_MONTH_SHARE = [0.025, 0.045, 0.08, 0.11, 0.125, 0.13, 0.125, 0.11, 0.085, 0.055, 0.03, 0.015]
// Daylight length (hours) mid-month at ~53°N — shapes the generation bell.
const DAYLIGHT_H = [8, 10, 12, 13.5, 15.5, 16.5, 16, 14.5, 12.5, 10.5, 8.5, 7.5]
// Mild seasonal swing on household demand (heating/lighting), average ≈ 1.
const LOAD_MONTH = [1.25, 1.2, 1.1, 0.95, 0.85, 0.78, 0.75, 0.78, 0.9, 1.05, 1.18, 1.28]

// Hourly base-load shapes (relative, any scale — normalised at use). Two archetypes:
// an out-all-day household (sharp morning + evening peaks, low midday) and a
// home-all-day one (flatter daytime plateau). in_half_day blends the two.
const LOAD_OUT = [0.5, 0.45, 0.4, 0.4, 0.45, 0.6, 1.0, 1.6, 1.2, 0.6, 0.5, 0.5, 0.6, 0.5, 0.5, 0.6, 0.9, 1.7, 2.3, 2.4, 2.1, 1.7, 1.1, 0.7]
const LOAD_HOME = [0.5, 0.45, 0.4, 0.4, 0.45, 0.6, 1.0, 1.3, 1.2, 1.1, 1.1, 1.2, 1.3, 1.1, 1.0, 1.1, 1.4, 1.9, 2.1, 2.0, 1.7, 1.3, 0.9, 0.6]

/** Expand 24 hourly weights to 48 half-hour slots and normalise to sum = 1. */
function normHalfHour(hourly: number[]): number[] {
  const slots: number[] = []
  for (let h = 0; h < 24; h++) { slots.push(hourly[h], hourly[h]) }
  const sum = slots.reduce((a, b) => a + b, 0)
  return slots.map((v) => v / sum)
}
function loadShape(occ: Occupancy): number[] {
  if (occ === 'out_all_day') return normHalfHour(LOAD_OUT)
  if (occ === 'home_all_day') return normHalfHour(LOAD_HOME)
  return normHalfHour(LOAD_OUT.map((v, i) => (v + LOAD_HOME[i]) / 2)) // in_half_day
}

/** Half-hourly generation (kWh) for a representative day in month `m`, scaled so
 *  the year totals `annualGen`. A raised-sine bell across the month's daylight window. */
function genDay(m: number, annualGen: number): number[] {
  const L = DAYLIGHT_H[m], sunrise = 12.5 - L / 2, sunset = 12.5 + L / 2
  const raw: number[] = []
  for (let s = 0; s < 48; s++) {
    const hour = s * 0.5 + 0.25
    raw.push(hour > sunrise && hour < sunset ? Math.sin(Math.PI * (hour - sunrise) / L) : 0)
  }
  const sum = raw.reduce((a, b) => a + b, 0) || 1
  const dayEnergy = (annualGen * PV_MONTH_SHARE[m]) / MONTH_DAYS[m]
  return raw.map((v) => (v / sum) * dayEnergy)
}

function isOffPeak(hour: number, start: number, end: number): boolean {
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

/** Place the EV's daily home-charging demand across the 48 slots per strategy.
 *  'offpeak' fills the cheap window; 'dumb' charges on plug-in (~18:00) at charger
 *  power; 'solar' soaks midday surplus first, then tops up off-peak. */
function evDay(dailyKwh: number, strategy: 'dumb' | 'offpeak' | 'solar', chargerKw: number, gen: number[], base: number[], opStart: number, opEnd: number): number[] {
  const ev = new Array(48).fill(0)
  if (dailyKwh <= 0) return ev
  const perSlotMax = chargerKw * 0.5
  const fill = (order: number[], budget: number) => {
    for (const s of order) {
      if (budget <= 0) break
      const put = Math.min(perSlotMax - ev[s], budget)
      if (put > 0) { ev[s] += put; budget -= put }
    }
    return budget
  }
  if (strategy === 'dumb') {
    const order = []; for (let s = 36; s < 48 + 36; s++) order.push(s % 48) // from 18:00 onward, wrapping
    fill(order, dailyKwh)
  } else if (strategy === 'solar') {
    // 1) midday slots ranked by surplus (gen − base); 2) remainder into the off-peak window.
    const surplus = gen.map((g, s) => ({ s, x: g - base[s] })).filter((o) => o.x > 0).sort((a, b) => b.x - a.x).map((o) => o.s)
    let left = fill(surplus, dailyKwh)
    const op = []; for (let s = 0; s < 48; s++) if (isOffPeak(s * 0.5 + 0.25, opStart, opEnd)) op.push(s)
    fill(op, left)
  } else {
    const op = []; for (let s = 0; s < 48; s++) if (isOffPeak(s * 0.5 + 0.25, opStart, opEnd)) op.push(s)
    fill(op, dailyKwh)
  }
  return ev
}

export type HomeSimInput = {
  annualGeneration: number // kWh/yr the array makes (0 = no solar; existing arrays still set this)
  annualDemand: number // kWh/yr household base load
  occupancy: Occupancy
  battery?: { usableKwh: number; powerKw?: number; roundTrip?: number; allowGridCharge?: boolean }
  ev?: { annualMiles: number; miPerKWh: number; chargerKw?: number; strategy?: 'dumb' | 'offpeak' | 'solar'; homeSharePct?: number; chargingLoss?: number }
  tariff?: { importRate?: number; exportRate?: number; offPeakRate?: number; offPeakStart?: number; offPeakEnd?: number; timeOfUse?: boolean }
}

export type HomeSim = {
  annualGeneration: number
  annualDemand: number
  annualEvKwh: number // home-charged EV energy that lands on the house
  selfConsumed: number // solar used on-site (not exported)
  selfConsumptionPct: number // selfConsumed / generation
  selfSufficiencyPct: number // (demand met without grid) / total demand
  gridImport: number
  gridExport: number
  importCost: number
  exportIncome: number
  netBill: number // £/yr electricity (import cost − export income)
  batteryThroughput: number // kWh/yr discharged — for cycle-life checks
  batteryCycles: number // equivalent full cycles/yr
  evFromSolar: number // EV kWh drawn straight from the roof
  evFromBattery: number // EV kWh from the battery
  evRenewablePct: number // (solar + battery) share of home EV charging
  monthly: { label: string; generation: number; import: number; export: number }[]
}

/** Simulate a home's energy over a year at half-hourly resolution. Deterministic;
 *  runs each month's representative day and scales by days-in-month. Compare two
 *  runs (e.g. battery vs none) to isolate a component's savings. */
export function simulateHome(input: HomeSimInput): HomeSim {
  const t = input.tariff ?? {}
  const importRate = t.importRate ?? UK.importRate
  const exportRate = t.exportRate ?? UK.exportRate
  // The cheap off-peak rate only applies on a time-of-use tariff (e.g. Octopus Go/Flux).
  // A flat-tariff household pays the standard import rate around the clock.
  const timeOfUse = t.timeOfUse ?? false
  const offPeakRate = timeOfUse ? (t.offPeakRate ?? UK.evOffPeakRate) : importRate
  const opStart = t.offPeakStart ?? 23.5
  const opEnd = t.offPeakEnd ?? 5.5

  const cap = input.battery?.usableKwh ?? 0
  const roundTrip = input.battery?.roundTrip ?? CHEMISTRY.lifepo4.roundTrip
  const battKw = input.battery?.powerKw ?? Math.min(5, Math.max(2.5, cap * 0.5))
  const powerPerSlot = battKw * 0.5
  const allowGridCharge = input.battery?.allowGridCharge ?? false

  // Home-charged EV energy per day (public charging is priced separately by evComparison).
  const ev = input.ev
  const homeShare = ev ? Math.min(1, Math.max(0, (ev.homeSharePct ?? 90) / 100)) : 0
  const evLoss = ev?.chargingLoss ?? 0.1
  const evAnnualHome = ev ? (ev.annualMiles / Math.max(0.1, ev.miPerKWh)) * (1 + evLoss) * homeShare : 0
  const evDaily = evAnnualHome / 365
  const strategy = ev?.strategy ?? 'solar'
  const chargerKw = ev?.chargerKw ?? 7

  const base = loadShape(input.occupancy)
  let soc = 0 // start empty; warm-up passes settle the daily cycle without injecting free energy

  let selfConsumed = 0, gridImport = 0, gridExport = 0, importCost = 0, exportIncome = 0
  let demandMetOnSite = 0, totalDemand = 0, battDischarge = 0
  let evFromSolar = 0, evFromBattery = 0, evTotal = 0
  const monthly = MONTH_LABELS.map((label) => ({ label, generation: 0, import: 0, export: 0 }))

  for (let m = 0; m < 12; m++) {
    const gen = genDay(m, input.annualGeneration)
    const dayDemand = (input.annualDemand * LOAD_MONTH[m]) / (LOAD_MONTH.reduce((a, b) => a + b, 0) / 12) / 365
    const baseDay = base.map((f) => f * dayDemand) // f sums to 1 over 48 → per-slot kWh = share × daily total
    const evl = evDay(evDaily, strategy, chargerKw, gen, baseDay, opStart, opEnd)

    for (let pass = 0; pass < 3; pass++) {
      const record = pass === 2 // measure the settled final pass
      for (let s = 0; s < 48; s++) {
        const hour = s * 0.5 + 0.25
        const offPeak = isOffPeak(hour, opStart, opEnd)
        const g = gen[s], load = baseDay[s], evNeed = evl[s]

        // Solar cascade: base load → EV → battery → export.
        let solarLeft = g
        const solarToBase = Math.min(solarLeft, load); solarLeft -= solarToBase
        let loadLeft = load - solarToBase
        const solarToEv = Math.min(solarLeft, evNeed); solarLeft -= solarToEv
        let evLeft = evNeed - solarToEv
        const chargeCap = Math.min(powerPerSlot, (cap - soc) / roundTrip)
        const solarToBatt = Math.max(0, Math.min(solarLeft, chargeCap)); solarLeft -= solarToBatt
        soc += solarToBatt * roundTrip
        let chargedThisSlot = solarToBatt
        const exportKwh = solarLeft

        // Cheap-rate grid charge for arbitrage (Flux-style), only in the off-peak window.
        let gridToBatt = 0
        if (allowGridCharge && offPeak) {
          const room = Math.min(powerPerSlot - chargedThisSlot, (cap - soc) / roundTrip)
          if (room > 0) { gridToBatt = room; soc += room * roundTrip; chargedThisSlot += room }
        }

        // Battery discharge: remaining base load → EV.
        let dischargeCap = Math.min(powerPerSlot, soc)
        const battToLoad = Math.min(dischargeCap, loadLeft); soc -= battToLoad; loadLeft -= battToLoad; dischargeCap -= battToLoad
        const battToEv = Math.min(dischargeCap, evLeft); soc -= battToEv; evLeft -= battToEv

        // Grid covers whatever's left.
        const gridToLoad = loadLeft, gridToEv = evLeft
        const importKwh = gridToLoad + gridToEv + gridToBatt
        const importPrice = offPeak ? offPeakRate : importRate

        if (record) {
          // Each slot is one representative day for month `m`; weight by its day count.
          const md = MONTH_DAYS[m]
          selfConsumed += (g - exportKwh) * md
          gridImport += importKwh * md
          gridExport += exportKwh * md
          importCost += importKwh * importPrice * md
          exportIncome += exportKwh * exportRate * md
          demandMetOnSite += (solarToBase + solarToEv + battToLoad + battToEv) * md
          totalDemand += (load + evNeed) * md
          battDischarge += (battToLoad + battToEv) * md
          evFromSolar += solarToEv * md; evFromBattery += battToEv * md; evTotal += evNeed * md
          monthly[m].generation += g * md
          monthly[m].import += importKwh * md
          monthly[m].export += exportKwh * md
        }
      }
    }
  }

  const evRenewable = evFromSolar + evFromBattery
  return {
    annualGeneration: Math.round(input.annualGeneration),
    annualDemand: Math.round(input.annualDemand),
    annualEvKwh: Math.round(evAnnualHome),
    selfConsumed: Math.round(selfConsumed),
    selfConsumptionPct: input.annualGeneration > 0 ? Math.round((selfConsumed / input.annualGeneration) * 100) : 0,
    selfSufficiencyPct: totalDemand > 0 ? Math.round((demandMetOnSite / totalDemand) * 100) : 0,
    gridImport: Math.round(gridImport),
    gridExport: Math.round(gridExport),
    importCost: Math.round(importCost),
    exportIncome: Math.round(exportIncome),
    netBill: Math.round(importCost - exportIncome),
    batteryThroughput: Math.round(battDischarge),
    batteryCycles: cap > 0 ? +(battDischarge / cap).toFixed(0) : 0,
    evFromSolar: Math.round(evFromSolar),
    evFromBattery: Math.round(evFromBattery),
    evRenewablePct: evTotal > 0 ? Math.round((evRenewable / evTotal) * 100) : 0,
    monthly: monthly.map((mo) => ({ label: mo.label, generation: Math.round(mo.generation), import: Math.round(mo.import), export: Math.round(mo.export) })),
  }
}
