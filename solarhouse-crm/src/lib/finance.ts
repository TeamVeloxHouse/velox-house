/* 20-year homeowner finance for a design — the numbers behind the Savings tab, the optimiser and the proposal.
 *
 * Generation comes from the MCS estimate (lib/mcs.ts). Each year: output degrades (first-year light-induced
 * loss, then a steady annual rate), the battery fades, self-consumption is re-run on the degraded output, and
 * savings are valued at that year's import price (rising yearly) plus Smart Export Guarantee income.
 * Inverter/battery replacements land as costs in their year. Money is discounted to today for NPV. */
import { selfConsumption, type Occupancy } from './mcs'
import { npv, irr } from './energy'
import type { StudioConfig } from '../store/types'

export type FinanceAssumptions = {
  years: number
  importRate: number // £/kWh today
  exportRate: number // £/kWh SEG today
  standingPerDay: number // £/day — paid with or without solar, shown on the bill comparison
  priceRise: number // electricity price rise a year
  exportRise: number // SEG rate change a year
  inflation: number // general inflation (replacement costs)
  discountRate: number // for NPV / discounted payback
  firstYearDeg: number // output in year 1 as a share of nameplate estimate
  annualDeg: number // yearly output loss after year 1
  batteryFade: number // yearly usable-capacity loss
  inverterYear: number; inverterCost: number // today's £
  batteryYear: number; batteryReplacePct: number // share of today's battery price
  smartTariff: number // 1 = on a smart/overnight tariff, so the battery also charges cheaply from the grid
  offPeakRate: number // £/kWh overnight rate on that tariff
}
export const DEFAULT_FINANCE: FinanceAssumptions = {
  years: 20, importRate: 0.27, exportRate: 0.15, standingPerDay: 0.53, priceRise: 0.04, exportRise: 0, inflation: 0.02,
  discountRate: 0.045, firstYearDeg: 0.98, annualDeg: 0.0055, batteryFade: 0.02,
  inverterYear: 12, inverterCost: 1100, batteryYear: 15, batteryReplacePct: 0.6, smartTariff: 1, offPeakRate: 0.085,
}
export const FINANCE_LABEL: Record<keyof FinanceAssumptions, { label: string; unit: string; pct?: boolean; step?: number }> = {
  years: { label: 'Term', unit: 'years' },
  importRate: { label: 'Electricity price', unit: '£/kWh', step: 0.01 },
  exportRate: { label: 'Export rate (SEG)', unit: '£/kWh', step: 0.01 },
  standingPerDay: { label: 'Standing charge', unit: '£/day', step: 0.01 },
  priceRise: { label: 'Price rise', unit: '% a year', pct: true },
  exportRise: { label: 'Export rate change', unit: '% a year', pct: true },
  inflation: { label: 'Inflation', unit: '% a year', pct: true },
  discountRate: { label: 'Discount rate', unit: '% a year', pct: true },
  firstYearDeg: { label: 'Year-1 output', unit: '%', pct: true },
  annualDeg: { label: 'Degradation', unit: '% a year', pct: true, step: 0.05 },
  batteryFade: { label: 'Battery fade', unit: '% a year', pct: true },
  inverterYear: { label: 'Inverter replaced', unit: 'year' },
  inverterCost: { label: 'Inverter cost', unit: '£', step: 50 },
  batteryYear: { label: 'Battery replaced', unit: 'year' },
  batteryReplacePct: { label: 'Battery replacement', unit: '% of price', pct: true },
  smartTariff: { label: 'Smart overnight tariff', unit: 'on / off' },
  offPeakRate: { label: 'Off-peak rate', unit: '£/kWh', step: 0.01 },
}

/** Battery supply-and-fit price before margin (hybrid inverter/controls + per usable kWh). */
export const batteryRaw = (usableKwh: number) => (usableKwh > 0 ? 900 + 480 * usableKwh : 0)

/** Customer price from the Studio pricing config (same formula as the calculators), plus the battery. */
export function systemPrice(kwp: number, panels: number, batteryKwh: number, cfg: Pick<StudioConfig, 'costPerKwp' | 'baseCost' | 'perPanel' | 'marginPct' | 'vatPct'>) {
  const raw = kwp * cfg.costPerKwp + cfg.baseCost + panels * (cfg.perPanel || 0) + batteryRaw(batteryKwh)
  return Math.round((raw * (1 + cfg.marginPct / 100) * (1 + cfg.vatPct / 100)) / 50) * 50
}

export type YearRow = {
  year: number; genKwh: number; selfKwh: number; exportKwh: number; importRate: number
  billBefore: number; billAfter: number; importSaving: number; tariffSaving: number; gridShiftKwh: number; exportIncome: number; costs: number
  net: number; cumulative: number; discounted: number; cumDiscounted: number
}
export type Projection = {
  capex: number; rows: YearRow[]; npv: number; irr: number | null; payback: number | null; discountedPayback: number | null
  lifetimeSavings: number; firstYearSaving: number; billBefore1: number; billAfter1: number; selfSufficiency1: number
  roi: number; co2Tonnes: number; lifetimeKwh: number
}

const GRID_CO2 = 0.207 // kg/kWh
const crossing = (cum: number[], start: number) => {
  let prev = start
  for (let i = 0; i < cum.length; i++) { if (cum[i] >= 0) return i + (prev < 0 ? -prev / (cum[i] - prev) : 0); prev = cum[i] }
  return null
}

export function project(input: { capex: number; genKwh: number; useKwh: number; occupancy: Occupancy; batteryKwh: number; batteryPrice?: number; a?: Partial<FinanceAssumptions> }): Projection {
  const a = { ...DEFAULT_FINANCE, ...(input.a ?? {}) }
  const rows: YearRow[] = []
  let cum = -input.capex, cumD = -input.capex, battAge = 0
  const battPrice = input.batteryPrice ?? batteryRaw(input.batteryKwh)
  for (let y = 1; y <= a.years; y++) {
    const gen = input.genKwh * a.firstYearDeg * Math.pow(1 - a.annualDeg, y - 1)
    const batt = input.batteryKwh * Math.pow(1 - a.batteryFade, battAge)
    const sc = selfConsumption(gen, input.useKwh, input.occupancy, batt)
    const imp = a.importRate * Math.pow(1 + a.priceRise, y - 1), exp = a.exportRate * Math.pow(1 + a.exportRise, y - 1)
    const standing = a.standingPerDay * 365 * Math.pow(1 + a.priceRise, y - 1)
    const importSaving = sc.selfKwh * imp, exportIncome = sc.exportKwh * exp
    // smart tariff: the battery's spare capacity fills from the grid overnight and covers evening use at the peak rate
    let gridShiftKwh = 0, tariffSaving = 0
    if (a.smartTariff && batt > 0) {
      const offPeak = a.offPeakRate * Math.pow(1 + a.priceRise, y - 1)
      gridShiftKwh = Math.round(Math.min(Math.max(0, batt * 365 * 0.9 - sc.batteryKwh), Math.max(0, (input.useKwh - sc.selfKwh) * 0.75)))
      tariffSaving = Math.max(0, gridShiftKwh * (imp - offPeak / 0.9))
    }
    let costs = 0
    if (y === a.inverterYear) costs += a.inverterCost * Math.pow(1 + a.inflation, y)
    if (input.batteryKwh > 0 && y === a.batteryYear) { costs += battPrice * a.batteryReplacePct * Math.pow(1 + a.inflation, y); battAge = -1 }
    battAge++
    const net = importSaving + tariffSaving + exportIncome - costs
    cum += net
    const disc = net / Math.pow(1 + a.discountRate, y)
    cumD += disc
    rows.push({ year: y, genKwh: Math.round(gen), selfKwh: sc.selfKwh, exportKwh: sc.exportKwh, importRate: imp, billBefore: input.useKwh * imp + standing, billAfter: (input.useKwh - sc.selfKwh) * imp + standing - tariffSaving, importSaving, tariffSaving, gridShiftKwh, exportIncome, costs, net, cumulative: cum, discounted: disc, cumDiscounted: cumD })
  }
  const nets = rows.map((r) => r.net)
  const lifetimeSavings = nets.reduce((s, v) => s + v, 0)
  const lifetimeKwh = rows.reduce((s, r) => s + r.genKwh, 0)
  return {
    capex: input.capex, rows, npv: npv(a.discountRate, [-input.capex, ...nets]), irr: input.capex > 0 ? irr([-input.capex, ...nets]) : null,
    payback: crossing(rows.map((r) => r.cumulative), -input.capex), discountedPayback: crossing(rows.map((r) => r.cumDiscounted), -input.capex),
    lifetimeSavings, firstYearSaving: rows[0]?.net ?? 0, billBefore1: rows[0]?.billBefore ?? 0, billAfter1: rows[0]?.billAfter ?? 0,
    selfSufficiency1: rows[0] ? rows[0].selfKwh / Math.max(1, input.useKwh) : 0,
    roi: input.capex > 0 ? (lifetimeSavings - input.capex) / input.capex : 0, co2Tonnes: (lifetimeKwh * GRID_CO2) / 1000, lifetimeKwh,
  }
}

/* ───────── Optimiser: every solar size × battery size, scored ───────── */
export type OptMetric = 'npv' | 'selfSufficiency' | 'firstYearSaving' | 'discountedPayback' | 'billAfter1' | 'irr'
export const OPT_METRIC: Record<OptMetric, { label: string; better: 'high' | 'low'; fmt: (v: number) => string }> = {
  npv: { label: '20-year NPV', better: 'high', fmt: (v) => `${v < 0 ? '−' : ''}£${Math.abs(Math.round(v / 100) / 10)}k` },
  selfSufficiency: { label: 'Self-sufficiency', better: 'high', fmt: (v) => `${Math.round(v * 100)}%` },
  firstYearSaving: { label: 'Year-1 saving', better: 'high', fmt: (v) => `£${Math.round(v).toLocaleString()}` },
  discountedPayback: { label: 'Discounted payback', better: 'low', fmt: (v) => (Number.isFinite(v) ? `${v.toFixed(1)} yr` : '—') },
  billAfter1: { label: 'Year-1 bill (before export)', better: 'low', fmt: (v) => `£${Math.round(v).toLocaleString()}` },
  irr: { label: 'Return (IRR)', better: 'high', fmt: (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—') },
}
export const BATTERY_OPTIONS = [0, 5, 9.5, 13.5, 16, 20, 27]
export type OptCell = { panels: number; kwp: number; batteryKwh: number; genKwh: number; price: number; p: Projection }

/** `panelYields` = kWh a year for each possible panel position, any order (best are used first). */
export function optimise(input: { panelYields: number[]; watts: number; useKwh: number; occupancy: Occupancy; cfg: Pick<StudioConfig, 'costPerKwp' | 'baseCost' | 'perPanel' | 'marginPct' | 'vatPct'>; a?: Partial<FinanceAssumptions>; steps?: number }) {
  const ys = [...input.panelYields].sort((x, y) => y - x)
  const max = ys.length, min = Math.min(max, 4), steps = Math.min(input.steps ?? 9, Math.max(1, max - min + 1))
  const counts = [...new Set(Array.from({ length: steps }, (_, i) => Math.round(min + ((max - min) * i) / Math.max(1, steps - 1))))]
  const prefix = [0]; for (const v of ys) prefix.push(prefix[prefix.length - 1] + v)
  const cells: OptCell[][] = counts.map((n) => BATTERY_OPTIONS.map((b) => {
    const kwp = (n * input.watts) / 1000, price = systemPrice(kwp, n, b, input.cfg)
    const raw = batteryRaw(b) * (1 + input.cfg.marginPct / 100)
    return { panels: n, kwp, batteryKwh: b, genKwh: Math.round(prefix[n]), price, p: project({ capex: price, genKwh: prefix[n], useKwh: input.useKwh, occupancy: input.occupancy, batteryKwh: b, batteryPrice: raw, a: input.a }) }
  }))
  return { counts, batteries: BATTERY_OPTIONS, cells }
}
export function metricOf(c: OptCell, m: OptMetric): number {
  switch (m) {
    case 'npv': return c.p.npv
    case 'selfSufficiency': return c.p.selfSufficiency1
    case 'firstYearSaving': return c.p.firstYearSaving
    case 'discountedPayback': return c.p.discountedPayback ?? Infinity
    case 'billAfter1': return c.p.billAfter1
    case 'irr': return c.p.irr ?? -Infinity
  }
}
