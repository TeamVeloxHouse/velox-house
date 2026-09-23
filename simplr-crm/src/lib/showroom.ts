import { simulateHome, UK } from './energy'
import type { ShowroomSession, ShowroomDesign } from '../store/types'

// UK generation yield — kWh per kWp per year (typical south-ish roof).
const YIELD_PER_KWP = 950
// Panels are ~460W; work out a plausible count from the array size.
export function panelsFor(kwp: number) { return Math.max(4, Math.round((kwp * 1000) / 460)) }

/** Transparent, defensible pricing for a residential system, itemised for a real quote. */
export function priceBreakdown(d: ShowroomDesign): { panels: number; battery: number; charger: number; subtotal: number; total: number } {
  const round = (n: number) => Math.round(n / 10) * 10
  const panels = round(2400 + d.systemKwp * 1150) // base (scaffold, inverter, install) + per-kWp
  const battery = d.hasBattery ? round(900 + d.batteryKwh * 480) : 0
  const charger = d.addEvCharger ? 900 : 0
  const subtotal = panels + battery + charger
  return { panels, battery, charger, subtotal, total: subtotal } // 0% VAT on domestic solar/battery
}

export function priceDesign(d: ShowroomDesign): number {
  return priceBreakdown(d).total
}

export type ShowroomModel = {
  price: number
  generationKwh: number
  currentBill: number // £/yr now (no solar)
  newBill: number // £/yr with the design
  annualSaving: number // £/yr off the electricity bill
  selfSufficiency: number // %
  paybackYears: number
  co2Saved: number // kg/yr
  evSaving: number // £/yr fuel saving if an EV is in the picture
  lifetimeSaving: number // 25-yr, with energy inflation
}

/** Derive annual kWh from a monthly spend if the customer only knows the £ figure. */
export function kwhFromSpend(monthlySpend: number, tariffPence: number): number {
  const rate = Math.max(0.05, tariffPence / 100)
  // strip a typical standing charge (~£0.55/day) before converting to units
  const energySpend = Math.max(0, monthlySpend - 17)
  return Math.round(((energySpend * 12) / rate) / 50) * 50
}

export function showroomModel(s: ShowroomSession): ShowroomModel {
  const d = s.design
  const importRate = Math.max(0.1, s.tariffPence / 100)
  const demand = s.annualKwh > 0 ? s.annualKwh : kwhFromSpend(s.monthlySpend, s.tariffPence)
  const gen = Math.round(d.systemKwp * YIELD_PER_KWP)
  const tariff = { importRate, exportRate: UK.exportRate }

  const base = simulateHome({ annualGeneration: 0, annualDemand: demand, occupancy: s.occupancy, tariff })
  const withDesign = simulateHome({
    annualGeneration: gen,
    annualDemand: demand,
    occupancy: s.occupancy,
    battery: d.hasBattery ? { usableKwh: d.batteryKwh } : undefined,
    tariff: { ...tariff, timeOfUse: d.hasBattery, offPeakRate: UK.evOffPeakRate },
  })

  const currentBill = Math.round(base.netBill)
  const newBill = Math.round(withDesign.netBill)
  const annualSaving = Math.max(0, currentBill - newBill)
  const price = priceDesign(d)
  const co2Saved = Math.round(withDesign.selfConsumed * UK.gridCo2PerKwh + withDesign.gridExport * UK.gridCo2PerKwh)

  // EV fuel saving (rough) — charging from solar/off-peak vs petrol.
  let evSaving = 0
  if (d.hasEv) {
    const miles = s.evMilesPerYear ?? 8000
    const petrolPerMile = 0.16 // ~£0.16/mi in a petrol car
    const evPerMile = (1 / 3.5) * (d.hasBattery ? UK.evOffPeakRate : importRate * 0.5)
    evSaving = Math.max(0, Math.round(miles * (petrolPerMile - evPerMile)))
  }

  // 25-year lifetime with energy inflation and mild degradation.
  let lifetime = 0, save = annualSaving + evSaving
  for (let y = 0; y < 25; y++) { lifetime += save * Math.pow(1 - UK.pvDegradation, y) * Math.pow(1 + UK.energyInflation, y) }

  return {
    price,
    generationKwh: gen,
    currentBill,
    newBill,
    annualSaving,
    selfSufficiency: Math.round(withDesign.selfSufficiencyPct),
    paybackYears: Math.round((price / Math.max(1, annualSaving + evSaving)) * 10) / 10,
    co2Saved,
    evSaving,
    lifetimeSaving: Math.round(lifetime),
  }
}

/** A sensible starting design for a household of a given consumption. */
export function starterDesign(annualKwh: number): ShowroomDesign {
  const kwp = Math.max(3, Math.min(6, Math.round((annualKwh / 950) * 10) / 10))
  return { systemKwp: kwp, panels: panelsFor(kwp), hasBattery: false, batteryKwh: 5, hasEv: false, addEvCharger: false }
}

/** UK seasonal solar shape — share of annual generation falling in each month, south-ish roof.
 *  Illustrative (not site-specific), used only to show the shape of the generation year. */
const MONTH_SHARE = [0.020, 0.036, 0.068, 0.098, 0.128, 0.138, 0.134, 0.114, 0.082, 0.052, 0.024, 0.016]
export function monthlyGeneration(annualKwh: number): { month: string; kwh: number }[] {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return names.map((month, i) => ({ month, kwh: Math.round(annualKwh * MONTH_SHARE[i]) }))
}

/** A typical clear day's generation curve (half-hourly, sunrise-ish to sunset-ish), scaled so its
 *  area matches a plausible summer day's output for this system. Illustrative — a real day varies
 *  with cloud and season; this shows the daily *shape* a customer can expect on a good day. */
export function dailyGenerationCurve(systemKwp: number): { hour: number; kw: number }[] {
  const peakKw = systemKwp * 0.82 // real-world peak is a bit under nameplate
  const pts: { hour: number; kw: number }[] = []
  for (let h = 5; h <= 21; h += 0.5) {
    const t = (h - 13) / 8 // centred on 13:00
    const kw = Math.max(0, peakKw * Math.exp(-3.1 * t * t))
    pts.push({ hour: h, kw: Math.round(kw * 100) / 100 })
  }
  return pts
}

/** Year-by-year cumulative net cash flow: -upfrontCost at year 0, then +savings each year
 *  (degrading generation, inflating energy prices) minus the upfront spend. Same math as the
 *  lifetime total in showroomModel, exposed year-by-year for the chart. */
export function cashFlowSeries(annualSaving: number, upfrontCost: number, years = 25): number[] {
  const out = [-upfrontCost]
  let cum = -upfrontCost
  for (let y = 0; y < years; y++) {
    cum += annualSaving * Math.pow(1 - UK.pvDegradation, y) * Math.pow(1 + UK.energyInflation, y)
    out.push(Math.round(cum))
  }
  return out
}
