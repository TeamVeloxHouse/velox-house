/* Shared clean-energy engine for the Studio calculators.
 *
 * The single import surface every calculator page reads from: MCS solar helpers (re-exported
 * from solar.ts), plus the finance solvers, battery model, and EV model that the Battery Sizer,
 * Commercial Solar and Whole-Home tools build on. Keep the maths here and the pages thin.
 *
 * Units: energy kWh, power kW, money £ (pence only where a UI asks for p/mile), CO₂ tonnes.
 */

// ── Re-export the MCS solar surface so pages import from one place ──────────
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
