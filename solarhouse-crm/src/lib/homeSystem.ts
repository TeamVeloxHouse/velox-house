/* Whole-home system engine — solar, battery and EV on one half-hourly timeline, priced by the real tariff.
 *
 * Each month is one representative day of 48 half-hours (run three times so the battery settles into its daily
 * cycle), scaled by the days in the month. What makes it honest:
 *   • SOLAR SHAPE comes from the design's actual roof faces: the sun's position for this latitude on each month's
 *     mid-day, projected onto every face's tilt and facing — an east/west roof peaks morning and evening, a south
 *     roof at noon. Each face's monthly total follows its MCS/PVGIS annual yield.
 *   • USAGE is the household's real half-hourly profile when a smart-meter file has been loaded, else a UK
 *     occupancy archetype with the seasonal swing.
 *   • PRICES are the tariff's 48 half-hour rates, import and export.
 *   • BATTERY runs one of three strategies: self-consumption, time-of-use (fill from the grid in the cheap window,
 *     save it for the dear hours) or Flux-style arbitrage (also export at the evening peak).
 *   • EV charging is a schedulable load: on plug-in, in the off-peak window, or soaking up surplus solar first.
 * Products are valued by running the same home with and without them. */

import type { Design, DesignScope, HomeProfile, BatteryDesign, EvDesign } from '../store/types'
import { sunPosition, orientationFactor, UK_MONTHLY_SHARE, type Occupancy } from './mcs'
import { batteryById, usableKwhOf, chargerById, vehicleById } from './catalogue'
import { tariffById, TARIFFS, importTariffs, eligible, type Tariff } from './tariffs'

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MID_DOY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]
const DEG = Math.PI / 180

/* ── defaults: what an estimate starts from before the survey ─────────────── */

export const DEFAULT_HOME: HomeProfile = {
  usageSource: 'estimate', tariffId: 'flat', exportTariffId: 'seg-fixed',
  supply: { fuseA: 100, phases: 1, earthing: 'TN-C-S', spareWays: 1, source: 'estimate' },
  loads: { showerKw: 0, cookingKw: 10, immersionKw: 0, heatPumpKw: 0, otherKw: 0 },
  tenure: 'owner',
}
export const DEFAULT_BATTERY: BatteryDesign = { productId: 'duracell-dura5-36', units: 2, mode: 'self', backup: 'none' }
export const DEFAULT_EV: EvDesign = { vehicleId: 'generic', annualMiles: 8000, homeSharePct: 90, chargerId: 'zappi', strategy: 'solar', cableRunM: 10, install: 'clipped', chargerLocation: 'house-wall', source: 'estimate' }

export function scopeOf(d: Design): DesignScope {
  return d.scope ?? { pv: d.planes.length > 0 || !d.batteryKwh, battery: (d.batteryKwh ?? 0) > 0, ev: false }
}
export function homeOf(d: Design): HomeProfile {
  const h = d.home
  return { ...DEFAULT_HOME, ...(h ?? {}), supply: { ...DEFAULT_HOME.supply, ...(h?.supply ?? {}) }, loads: { ...DEFAULT_HOME.loads, ...(h?.loads ?? {}) } }
}
export const batteryOf = (d: Design): BatteryDesign => ({ ...DEFAULT_BATTERY, ...(d.batteryDesign ?? {}) })
export const evOf = (d: Design): EvDesign => ({ ...DEFAULT_EV, ...(d.evDesign ?? {}) })

/* ── demand ───────────────────────────────────────────────────────────────── */

// Hourly shapes (relative): out during the day (sharp peaks) vs home all day (flatter daytime).
const LOAD_OUT = [0.5, 0.45, 0.4, 0.4, 0.45, 0.6, 1.0, 1.6, 1.2, 0.6, 0.5, 0.5, 0.6, 0.5, 0.5, 0.6, 0.9, 1.7, 2.3, 2.4, 2.1, 1.7, 1.1, 0.7]
const LOAD_HOME = [0.5, 0.45, 0.4, 0.4, 0.45, 0.6, 1.0, 1.3, 1.2, 1.1, 1.1, 1.2, 1.3, 1.1, 1.0, 1.1, 1.4, 1.9, 2.1, 2.0, 1.7, 1.3, 0.9, 0.6]
const LOAD_MONTH = [1.25, 1.2, 1.1, 0.95, 0.85, 0.78, 0.75, 0.78, 0.9, 1.05, 1.18, 1.28] // winter lighting/heating swing

function shape48(occ: Occupancy): number[] {
  const h = occ === 'out_all_day' ? LOAD_OUT : occ === 'home_all_day' ? LOAD_HOME : LOAD_OUT.map((v, i) => (v + LOAD_HOME[i]) / 2)
  const s: number[] = []; for (let i = 0; i < 24; i++) s.push(h[i], h[i])
  const t = s.reduce((a, b) => a + b, 0); return s.map((v) => v / t)
}
/** 12 × 48 kWh — the average day for each month. Real smart-meter data wins when it's loaded. */
export function demandProfile(annualKwh: number, occ: Occupancy, real?: number[][]): number[][] {
  if (real && real.length === 12 && real.every((r) => r.length === 48)) return real
  const sh = shape48(occ), mean = LOAD_MONTH.reduce((a, b) => a + b, 0) / 12
  return MONTHS.map((_, m) => { const day = (annualKwh * LOAD_MONTH[m]) / mean / 365; return sh.map((f) => f * day) })
}

/* ── solar ────────────────────────────────────────────────────────────────── */

export type PvArray = { kwh: number; tiltDeg: number; azFromSouthDeg: number } // annual kWh of one roof face
/** Relative plane-of-array irradiance through a clear-ish day for one face (48 slots, solar time). */
function faceDay(lat: number, doy: number, tilt: number, azS: number): number[] {
  const out: number[] = []
  for (let s = 0; s < 48; s++) {
    const { alt, az } = sunPosition(lat, doy, s / 2 + 0.25)
    if (alt <= 0.5) { out.push(0); continue }
    const sa = Math.sin(alt * DEG)
    const cosInc = sa * Math.cos(tilt * DEG) + Math.cos(alt * DEG) * Math.sin(tilt * DEG) * Math.cos((az - azS) * DEG)
    const beam = Math.max(0, cosInc) * Math.pow(0.72, Math.pow(1 / sa, 0.678)) // simple air-mass attenuation
    const diffuse = 0.12 * sa * (1 + Math.cos(tilt * DEG)) / 2
    out.push(beam + diffuse)
  }
  return out
}
/** 12 × 48 kWh of generation from the design's faces (monthly split = UK share unless a site split is given). */
export function genProfile(arrays: PvArray[], lat: number, monthlyShare: number[] = UK_MONTHLY_SHARE): number[][] {
  return MONTHS.map((_, m) => {
    const day = new Array(48).fill(0)
    for (const a of arrays) {
      if (a.kwh <= 0) continue
      const f = faceDay(lat, MID_DOY[m], a.tiltDeg, a.azFromSouthDeg), t = f.reduce((x, y) => x + y, 0) || 1
      const dayKwh = (a.kwh * monthlyShare[m]) / MONTH_DAYS[m]
      for (let s = 0; s < 48; s++) day[s] += (f[s] / t) * dayKwh
    }
    return day
  })
}
/** A battery-only retrofit's existing array, estimated from its size and orientation. */
export function existingArray(pv: { kwp: number; azimuthDeg: number; pitchDeg: number }, lat: number): PvArray {
  const azS = pv.azimuthDeg - 180
  const optimum = 1020 - (lat - 50) * 25 // kWh/kWp for an ideal UK roof, falling to the north
  return { kwh: pv.kwp * optimum * orientationFactor(pv.pitchDeg, azS), tiltDeg: pv.pitchDeg, azFromSouthDeg: azS }
}

/* ── the simulation ───────────────────────────────────────────────────────── */

export type SimBattery = { usableKwh: number; powerKw: number; roundTrip: number; mode: BatteryDesign['mode'] }
export type SimEv = { dailyKwh: number; chargerKw: number; strategy: EvDesign['strategy'] }
export type SimInput = { gen: number[][]; demand: number[][]; battery?: SimBattery | null; ev?: SimEv | null; importRates: number[]; exportRates: number[] }
export type DaySeries = { gen: number[]; load: number[]; ev: number[]; soc: number[]; grid: number[]; exp: number[]; price: number[] }
export type SimResult = {
  genKwh: number; demandKwh: number; evKwh: number
  selfUseKwh: number; importKwh: number; exportKwh: number; gridChargeKwh: number
  importCost: number; exportIncome: number; net: number // £/yr, net = import cost − export income
  selfSufficiency: number; selfConsumption: number
  batteryThroughput: number; batteryCycles: number
  evFromSolar: number; evFromBattery: number
  monthly: { m: string; gen: number; imp: number; exp: number; cost: number }[]
  days: { summer: DaySeries; winter: DaySeries }
}

const cheapSlots = (r: number[]) => { const min = Math.min(...r), avg = r.reduce((a, b) => a + b, 0) / r.length; return min < avg * 0.8 ? r.map((v) => v <= min + 0.02) : r.map(() => false) }

function evDay(daily: number, strategy: SimEv['strategy'], kw: number, gen: number[], base: number[], cheap: boolean[]): number[] {
  const ev = new Array(48).fill(0); if (daily <= 0) return ev
  const cap = kw * 0.5
  const fill = (order: number[], left: number) => { for (const s of order) { if (left <= 0) break; const put = Math.min(cap - ev[s], left); if (put > 0) { ev[s] += put; left -= put } } return left }
  const cheapOrder = cheap.some(Boolean) ? cheap.map((c, s) => (c ? s : -1)).filter((s) => s >= 0) : [46, 47, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // no cheap window → overnight anyway
  if (strategy === 'dumb') { const o: number[] = []; for (let s = 36; s < 84; s++) o.push(s % 48); fill(o, daily) }
  else if (strategy === 'solar') { const sur = gen.map((g, s) => ({ s, x: g - base[s] })).filter((o) => o.x > 0.05).sort((a, b) => b.x - a.x).map((o) => o.s); fill(cheapOrder, fill(sur, daily)) }
  else fill(cheapOrder, daily)
  return ev
}

export function simulate(inp: SimInput): SimResult {
  const b = inp.battery && inp.battery.usableKwh > 0 ? inp.battery : null
  const cap = b?.usableKwh ?? 0, perSlot = (b?.powerKw ?? 0) * 0.5, rte = b?.roundTrip ?? 0.9
  const cheap = cheapSlots(inp.importRates)
  const peakExp = Math.max(...inp.exportRates), cheapImp = Math.min(...inp.importRates)
  // Flux-style export only pays when the peak export price beats refilling from the cheap window
  const arbSlots = inp.exportRates.map((r) => b?.mode === 'arbitrage' && r >= peakExp - 0.005 && r > cheapImp / rte + 0.03)
  let soc = 0
  const R = { gen: 0, dem: 0, ev: 0, self: 0, imp: 0, exp: 0, gridCh: 0, cost: 0, inc: 0, onsite: 0, total: 0, thr: 0, evS: 0, evB: 0 }
  const monthly = MONTHS.map((m) => ({ m, gen: 0, imp: 0, exp: 0, cost: 0 }))
  const days: { summer: DaySeries; winter: DaySeries } = { summer: null as unknown as DaySeries, winter: null as unknown as DaySeries }

  for (let m = 0; m < 12; m++) {
    const gen = inp.gen[m] ?? new Array(48).fill(0), base = inp.demand[m]
    const ev = evDay(inp.ev?.dailyKwh ?? 0, inp.ev?.strategy ?? 'offpeak', inp.ev?.chargerKw ?? 7.4, gen, base, cheap)
    // How much tomorrow's sun will refill on its own — grid-charge only the rest (don't pre-fill a battery the sun will fill)
    const solarSurplus = gen.reduce((s, g, i) => s + Math.max(0, g - base[i] - ev[i]), 0)
    const gridTarget = b && b.mode !== 'self' ? Math.max(0, cap - solarSurplus * rte * 0.85) : 0
    const series: DaySeries = { gen: [], load: [], ev: [], soc: [], grid: [], exp: [], price: [] }
    // Warm up until the battery repeats the same daily cycle (big batteries take several days to settle),
    // then record one settled day — otherwise energy stored "for tomorrow" is lost from the books.
    let settled = false
    for (let pass = 0; pass < 20; pass++) {
      const socStart = soc
      const rec = settled || pass === 19, md = MONTH_DAYS[m]
      for (let s = 0; s < 48; s++) {
        const g = gen[s], load = base[s], evNeed = ev[s], pImp = inp.importRates[s], pExp = inp.exportRates[s]
        let sun = g
        const toLoad = Math.min(sun, load); sun -= toLoad; let loadLeft = load - toLoad
        const toEv = Math.min(sun, evNeed); sun -= toEv; let evLeft = evNeed - toEv
        let charged = 0
        if (b) { const put = Math.max(0, Math.min(sun, perSlot, (cap - soc) / rte)); soc += put * rte; sun -= put; charged = put }
        let exportKwh = sun
        let gridCharge = 0
        if (b && cheap[s] && b.mode !== 'self' && soc < gridTarget) {
          gridCharge = Math.max(0, Math.min(perSlot - charged, (gridTarget - soc) / rte)); soc += gridCharge * rte
        }
        let battOut = 0, battEv = 0
        if (b && !(cheap[s] && b.mode !== 'self')) { // in the cheap window the grid is cheaper than stored energy
          let can = Math.min(perSlot, soc)
          battOut = Math.min(can, loadLeft); soc -= battOut; loadLeft -= battOut; can -= battOut
          battEv = Math.min(can, evLeft); soc -= battEv; evLeft -= battEv; can -= battEv
          if (arbSlots[s] && can > 0) { const keep = cap * 0.1; const push = Math.max(0, Math.min(can, soc - keep)); soc -= push; exportKwh += push; battOut += push }
        }
        const imp = loadLeft + evLeft + gridCharge
        if (rec) {
          R.gen += g * md; R.dem += load * md; R.ev += evNeed * md
          R.self += (g - sun) * md; R.imp += imp * md; R.exp += exportKwh * md; R.gridCh += gridCharge * md
          R.cost += imp * pImp * md; R.inc += exportKwh * pExp * md
          R.onsite += (toLoad + toEv + Math.min(battOut, load - toLoad) + battEv) * md; R.total += (load + evNeed) * md
          R.thr += (battOut + battEv) * md; R.evS += toEv * md; R.evB += battEv * md
          monthly[m].gen += g * md; monthly[m].imp += imp * md; monthly[m].exp += exportKwh * md; monthly[m].cost += (imp * pImp - exportKwh * pExp) * md
          series.gen.push(g); series.load.push(load); series.ev.push(evNeed); series.soc.push(soc); series.grid.push(imp); series.exp.push(exportKwh); series.price.push(pImp)
        }
      }
      if (rec) break
      if (Math.abs(soc - socStart) < 0.01 && pass >= 1) settled = true
    }
    if (m === 5) days.summer = series
    if (m === 11) days.winter = series
  }
  const r = (v: number) => Math.round(v)
  return {
    genKwh: r(R.gen), demandKwh: r(R.dem), evKwh: r(R.ev), selfUseKwh: r(R.self), importKwh: r(R.imp), exportKwh: r(R.exp), gridChargeKwh: r(R.gridCh),
    importCost: r(R.cost), exportIncome: r(R.inc), net: r(R.cost - R.inc),
    selfSufficiency: R.total > 0 ? Math.max(0, Math.min(1, 1 - R.imp / R.total)) : 0, // grid-charged battery energy is still grid energy
    selfConsumption: R.gen > 0 ? R.self / R.gen : 0,
    batteryThroughput: r(R.thr), batteryCycles: cap > 0 ? r(R.thr / cap) : 0, evFromSolar: r(R.evS), evFromBattery: r(R.evB),
    monthly: monthly.map((x) => ({ ...x, gen: r(x.gen), imp: r(x.imp), exp: r(x.exp), cost: r(x.cost) })), days,
  }
}

/* ── the design as a system ───────────────────────────────────────────────── */

export type SystemInputs = { gen: number[][]; demand: number[][]; battery: SimBattery | null; ev: SimEv | null; imp: Tariff; exp: Tariff; scope: DesignScope; annualDemand: number; evMiles: number; evHomeMiles: number }

/** Everything the simulation needs, read from one design. `arrays` = its roof faces' annual yields (from useMcs). */
export function systemInputs(d: Design, arrays: PvArray[]): SystemInputs {
  const scope = scopeOf(d), home = homeOf(d), lat = d.center?.lat ?? 51.5
  const faces = scope.pv ? arrays : home.existingPv ? [existingArray(home.existingPv, lat)] : []
  const gen = genProfile(faces, lat)
  const annualDemand = d.annualConsumptionKwh ?? 3800
  const demand = demandProfile(annualDemand, (d.occupancy ?? 'in_half_day') as Occupancy, home.usageSource === 'smart-meter' ? home.usageProfile : undefined)
  let battery: SimBattery | null = null
  if (scope.battery) {
    const bd = batteryOf(d), p = batteryById(bd.productId)
    battery = { usableKwh: usableKwhOf(p, bd.units), powerKw: p.powerKw, roundTrip: p.roundTrip, mode: bd.mode }
  }
  let ev: SimEv | null = null, evMiles = 0, evHomeMiles = 0
  if (scope.ev) {
    const e = evOf(d), v = vehicleById(e.vehicleId), c = chargerById(e.chargerId)
    evMiles = e.annualMiles; evHomeMiles = (e.annualMiles * e.homeSharePct) / 100
    ev = { dailyKwh: ((e.annualMiles / v.miPerKwh) * 1.1 * (e.homeSharePct / 100)) / 365, chargerKw: Math.min(c.kw, v.acKw), strategy: e.strategy }
  }
  const imp = tariffById(home.tariffId) ?? TARIFFS[0]
  const exp = tariffById(home.exportTariffId) ?? tariffById('seg-fixed')!
  return { gen, demand, battery, ev, imp, exp, scope, annualDemand, evMiles, evHomeMiles }
}

const zero = () => MONTHS.map(() => new Array(48).fill(0))
const runWith = (s: SystemInputs, o: { pv?: boolean; battery?: boolean; ev?: boolean; imp?: Tariff; exp?: Tariff }) => simulate({
  gen: o.pv === false ? zero() : s.gen, demand: s.demand,
  battery: o.battery === false ? null : s.battery, ev: o.ev === false ? null : s.ev,
  importRates: (o.imp ?? s.imp).rates, exportRates: (o.pv === false && o.battery === false ? tariffById('none')! : (o.exp ?? s.exp)).rates,
})

export type Attribution = {
  before: SimResult // the home today (no solar, battery or home charging), current tariff
  full: SimResult // everything in scope on the chosen tariffs
  steps: { key: 'pv' | 'battery' | 'ev' | 'tariff'; label: string; saving: number }[] // £/yr each product adds, in design order
  evCostPerMile?: { system: number; grid: number; petrol: number }
}
/** Value each product by adding it to the home one at a time, on the customer's current tariff, then the switch. */
export function attribute(s: SystemInputs, current: { imp: Tariff; exp: Tariff }): Attribution {
  const before = runWith(s, { pv: false, battery: false, ev: false, imp: current.imp, exp: current.exp })
  const steps: Attribution['steps'] = []
  let prev = before
  // EV energy is new load — measure solar/battery against a home that already charges the car, so EV isn't a "cost" of the kit
  const evOnly = s.ev ? runWith(s, { pv: false, battery: false, imp: current.imp, exp: current.exp }) : null
  if (evOnly) prev = evOnly
  if (s.scope.pv || s.gen.some((d) => d.some((v) => v > 0))) { const r = runWith(s, { battery: false, imp: current.imp, exp: current.exp }); steps.push({ key: 'pv', label: s.scope.pv ? 'Solar panels' : 'Existing solar', saving: prev.net - r.net }); prev = r }
  if (s.battery) { const r = runWith(s, { imp: current.imp, exp: current.exp }); steps.push({ key: 'battery', label: 'Battery', saving: prev.net - r.net }); prev = r }
  const full = runWith(s, {})
  if (s.imp.id !== current.imp.id || s.exp.id !== current.exp.id) steps.push({ key: 'tariff', label: `Switch to ${s.imp.name}`, saving: prev.net - full.net })
  let evCostPerMile: Attribution['evCostPerMile']
  if (s.ev && s.evMiles > 0 && evOnly) {
    const noEvFull = runWith(s, { ev: false })
    const miles = Math.max(1, s.evHomeMiles) // only the miles charged at home ride on this system
    // petrol: ~£1.45 a litre at ~42 mpg ≈ 15.7p a mile
    evCostPerMile = { system: (full.net - noEvFull.net) / miles, grid: (evOnly.net - before.net) / miles, petrol: (1.45 * 4.546) / 42 }
  }
  return { before, full, steps, evCostPerMile }
}

/** Which tariff pair suits this system best? Every eligible import tariff (with its paired or the current export). */
export function rankTariffs(s: SystemInputs, currentExp: Tariff, smartCharger: boolean) {
  const has = { ev: !!s.ev, battery: !!s.battery, solar: s.gen.some((d) => d.some((v) => v > 0)), smartCharger }
  return importTariffs.filter((t) => eligible(t, has)).map((imp) => {
    const exp = imp.pairsWith ? tariffById(imp.pairsWith)! : currentExp.pairsWith ? tariffById('seg-fixed')! : currentExp
    const r = simulate({ gen: s.gen, demand: s.demand, battery: s.battery, ev: s.ev, importRates: imp.rates, exportRates: exp.rates })
    return { imp, exp, net: r.net, r }
  }).sort((a, b) => a.net - b.net)
}

/** Annual £ saving of the whole system at each battery size (units), for the sizing curve. */
export function batteryCurve(s: SystemInputs, productId: string, mode: BatteryDesign['mode']) {
  const p = batteryById(productId)
  const noBatt = simulate({ gen: s.gen, demand: s.demand, battery: null, ev: s.ev, importRates: s.imp.rates, exportRates: s.exp.rates })
  const rows: { units: number; kwh: number; saving: number; cost: number; payback: number; selfSufficiency: number; cycles: number }[] = []
  for (let u = p.minUnits; u <= p.maxUnits; u++) {
    const kwh = usableKwhOf(p, u)
    const r = simulate({ gen: s.gen, demand: s.demand, battery: { usableKwh: kwh, powerKw: p.powerKw, roundTrip: p.roundTrip, mode }, ev: s.ev, importRates: s.imp.rates, exportRates: s.exp.rates })
    const saving = noBatt.net - r.net, cost = batteryPriceOf(p.id, u)
    rows.push({ units: u, kwh, saving, cost, payback: saving > 0 ? cost / saving : Infinity, selfSufficiency: r.selfSufficiency, cycles: r.batteryCycles })
  }
  // recommend the size where one more unit adds less than ~40% of the average saving per unit (diminishing returns)
  let rec = rows[0]
  for (let i = 1; i < rows.length; i++) {
    const add = rows[i].saving - rows[i - 1].saving, avg = rows[i].saving / (i + 1)
    if (add >= avg * 0.4 && rows[i].payback <= rec.payback * 1.25) rec = rows[i]
  }
  return { rows, recommended: rec, noBattery: noBatt }
}

/** Customer-facing trade cost (before margin/VAT) of a battery configuration. */
export function batteryPriceOf(productId: string, units: number) {
  const p = batteryById(productId)
  return p.systemCost + p.unitCost * units + 450 // + install labour & sundries
}
