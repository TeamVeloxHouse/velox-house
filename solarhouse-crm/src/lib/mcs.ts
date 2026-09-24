/* MCS-style production engine — how UK domestic solar is estimated for the customer.
 *
 *   Annual output (kWh) = Σ arrays  kWp × Kk × SF
 *     Kk = specific yield (kWh/kWp) for the site, the array's inclination and orientation
 *     SF = shade factor from the array's sun-path diagram (84 segments; each shaded one = 1%)
 *   Self-consumption = f(occupancy archetype, generation ÷ consumption)   [PV only; battery adds on]
 *
 * Kk source, in order of preference:
 *   1. the official MCS irradiance table (drop it at /public/mcs/kk-table.json — see loadMcsTable)
 *   2. PVGIS for the exact location, tilt and aspect (EU JRC, free) — labelled as an estimate
 *   3. an offline latitude × orientation model, so the app always has a number
 * We never present 2 or 3 as "MCS" — the proposal says which source produced the figure. */

export type Occupancy = 'home_all_day' | 'in_half_day' | 'out_all_day'
export const OCCUPANCY_LABEL: Record<Occupancy, string> = { home_all_day: 'Home all day', in_half_day: 'Home half the day', out_all_day: 'Out during the day' }
export type KkSource = 'mcs' | 'pvgis' | 'model'
export const KK_SOURCE_LABEL: Record<KkSource, string> = { mcs: 'MCS irradiance table', pvgis: 'PVGIS for this location (estimate)', model: 'Offline model (estimate)' }

export type McsArray = { id: string; name?: string; kwp: number; tiltDeg: number; azimuthFromSouthDeg: number; shadeFactor?: number }
export type ArrayResult = McsArray & { kk: number; sf: number; kwh: number; source: KkSource }

const DEG = Math.PI / 180

/* ───────── Kk: offline model ───────── */
/** Specific yield at the optimum (≈35° due south) by latitude, calibrated to MCS values (≈990 south coast → ≈760 N. Scotland). */
const optimumYield = (lat: number) => Math.max(720, Math.min(1060, 990 - (lat - 50.3) * 42)) // Cardiff (51.5°) at 30°/15° → ≈938, matching the MCS table
/** Orientation/tilt factor vs the optimum — a smooth fit to UK irradiance tables. */
export function orientationFactor(tiltDeg: number, azFromSouthDeg: number): number {
  const a = Math.abs(((azFromSouthDeg + 540) % 360) - 180) * DEG // 0 = south, π = north
  const t = tiltDeg * DEG
  const f = 1 - 0.36 * (1 - Math.cos(a)) * Math.sin(t) * 0.9 - 0.12 * (t - 35 * DEG) ** 2 - 0.08 * Math.sin(t) ** 2 * (1 - Math.cos(a)) ** 2
  return Math.max(0.3, Math.min(1.02, f))
}
export const modelKk = (lat: number, tiltDeg: number, azFromSouthDeg: number) => Math.round(optimumYield(lat) * orientationFactor(tiltDeg, azFromSouthDeg))

/* ───────── Kk: official MCS table hook ───────── */
// Expected shape: { zones: { [postcodeDistrict or area]: zoneId }, kk: { [zoneId]: { [tilt]: { [azimuth 0–175 step 5]: kWh/kWp } } } }
type McsTable = { zones: Record<string, string>; kk: Record<string, Record<string, Record<string, number>>> }
let mcsTable: McsTable | null | undefined
export async function loadMcsTable(): Promise<McsTable | null> {
  if (mcsTable !== undefined) return mcsTable
  try { const r = await fetch('/mcs/kk-table.json'); mcsTable = r.ok ? await r.json() : null } catch { mcsTable = null }
  return mcsTable ?? null
}
export function mcsZoneFor(postcode: string, t: McsTable | null): string | null {
  if (!t || !postcode) return null
  const pc = postcode.toUpperCase().replace(/\s+/g, ' ').trim()
  const district = pc.split(' ')[0], area = district.match(/^[A-Z]+/)?.[0] ?? ''
  return t.zones[district] ?? t.zones[area] ?? null
}
function mcsKk(t: McsTable, zone: string, tiltDeg: number, azFromSouthDeg: number): number | null {
  const z = t.kk[zone]; if (!z) return null
  const tilt = String(Math.max(0, Math.min(90, Math.round(tiltDeg))))
  const az = String(Math.min(175, Math.round(Math.abs(((azFromSouthDeg + 540) % 360) - 180) / 5) * 5))
  return z[tilt]?.[az] ?? null
}

/* ───────── Kk: PVGIS (cached) ───────── */
const pvgisCache = new Map<string, Promise<{ annual: number; monthly: number[] } | null>>()
export function pvgisYield(lat: number, lng: number, tiltDeg: number, azFromSouthDeg: number) {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${Math.round(tiltDeg)},${Math.round(azFromSouthDeg)}`
  if (!pvgisCache.has(key)) {
    pvgisCache.set(key, fetch(`/api/pvgis-monthly?lat=${lat}&lng=${lng}&tilt=${Math.round(tiltDeg)}&azimuth=${Math.round(azFromSouthDeg)}`)
      .then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.annualYield ? { annual: j.annualYield, monthly: j.monthly } : null)).catch(() => null))
  }
  return pvgisCache.get(key)!
}

/** Resolve Kk for every array, best source first. */
export async function resolveArrays(arrays: McsArray[], site: { lat: number; lng: number; postcode?: string }): Promise<{ arrays: ArrayResult[]; zone: string | null; source: KkSource; monthlyShare: number[] }> {
  const table = await loadMcsTable()
  const zone = mcsZoneFor(site.postcode ?? '', table)
  let monthly: number[] | null = null
  const out: ArrayResult[] = []
  let source: KkSource = 'model'
  for (const a of arrays) {
    let kk: number | null = null, src: KkSource = 'model'
    if (table && zone) { kk = mcsKk(table, zone, a.tiltDeg, a.azimuthFromSouthDeg); if (kk) src = 'mcs' }
    if (!kk) { const p = await pvgisYield(site.lat, site.lng, a.tiltDeg, a.azimuthFromSouthDeg); if (p) { kk = p.annual; src = 'pvgis'; monthly ??= p.monthly } }
    if (!kk) { kk = modelKk(site.lat, a.tiltDeg, a.azimuthFromSouthDeg); src = 'model' }
    if (src === 'mcs' || (src === 'pvgis' && source === 'model')) source = src
    const sf = a.shadeFactor ?? 1
    out.push({ ...a, kk, sf, kwh: Math.round(a.kwp * kk * sf), source: src })
  }
  const share = monthly && monthly.some(Boolean) ? normalise(monthly) : UK_MONTHLY_SHARE
  return { arrays: out, zone, source, monthlyShare: share }
}
const normalise = (xs: number[]) => { const s = xs.reduce((a, b) => a + b, 0) || 1; return xs.map((x) => x / s) }
/** Typical UK share of annual PV output by month (used when no site-specific monthly split is available). */
export const UK_MONTHLY_SHARE = normalise([2.6, 4.4, 7.9, 10.9, 12.9, 12.7, 12.9, 11.2, 8.9, 6.4, 3.4, 2.1])

/* ───────── Self-consumption (MCS-style occupancy curves) ───────── */
// Fraction of annual CONSUMPTION met by solar, as generation ÷ consumption rises, per archetype.
// Smooth saturating fits calibrated to the MCS PV-only self-consumption tables' shape.
const SC_CURVE: Record<Occupancy, { a: number; b: number }> = {
  home_all_day: { a: 0.52, b: 0.86 },
  in_half_day: { a: 0.4, b: 0.78 },
  out_all_day: { a: 0.28, b: 0.68 },
}
export function selfConsumption(genKwh: number, useKwh: number, occ: Occupancy, batteryUsableKwh = 0) {
  if (genKwh <= 0 || useKwh <= 0) return { selfKwh: 0, exportKwh: Math.max(0, genKwh), selfSufficiency: 0, selfConsumptionRate: 0, batteryKwh: 0 }
  const r = genKwh / useKwh, c = SC_CURVE[occ]
  const pvOnly = Math.min(genKwh, useKwh * c.a * (1 - Math.exp(-c.b * r)))
  // Battery: shifts surplus into the evening — roughly one useful cycle a day in summer, fewer in winter,
  // capped by the surplus available and the unmet evening demand.
  const surplus = genKwh - pvOnly, unmet = useKwh - pvOnly
  const battery = batteryUsableKwh > 0 ? Math.min(surplus * 0.9, unmet * 0.85, batteryUsableKwh * 365 * 0.62 * 0.92) : 0
  const selfKwh = Math.round(pvOnly + battery)
  return { selfKwh, exportKwh: Math.round(Math.max(0, genKwh - selfKwh - battery * 0.08)), selfSufficiency: selfKwh / useKwh, selfConsumptionRate: selfKwh / genKwh, batteryKwh: Math.round(battery) }
}

/* ───────── Sun path & shade factor (84-segment method) ───────── */
/** Sun altitude/azimuth (deg, azimuth measured from south, + west) — NOAA simplified. */
export function sunPosition(lat: number, dayOfYear: number, hour: number): { alt: number; az: number } {
  const decl = 23.44 * Math.sin((360 / 365) * (dayOfYear - 81) * DEG)
  const ha = (hour - 12) * 15
  const sinAlt = Math.sin(lat * DEG) * Math.sin(decl * DEG) + Math.cos(lat * DEG) * Math.cos(decl * DEG) * Math.cos(ha * DEG)
  const alt = Math.asin(sinAlt) / DEG
  const cosAz = (Math.sin(alt * DEG) * Math.sin(lat * DEG) - Math.sin(decl * DEG)) / (Math.cos(alt * DEG) * Math.cos(lat * DEG))
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) / DEG // 0 = south
  if (ha < 0) az = -az // morning = east = negative
  return { alt, az }
}
export type Segment = { az0: number; az1: number; alt0: number; alt1: number; weight: number }
/** The sun-path grid for a latitude: cells (15° azimuth × 15° altitude) the sun passes through, weighted
 *  by the share of the year's sunshine hours spent there, rescaled to ~84 segments of ~1% each. */
export function sunpathSegments(lat: number): Segment[] {
  const bins = new Map<string, number>(); let total = 0
  for (let d = 1; d <= 365; d += 3) for (let h = 4; h <= 20; h += 0.25) {
    const { alt, az } = sunPosition(lat, d, h)
    if (alt <= 0) continue
    const w = Math.sin(alt * DEG) // stronger sun counts for more
    const k = `${Math.floor(az / 15)}:${Math.floor(alt / 15)}`
    bins.set(k, (bins.get(k) ?? 0) + w); total += w
  }
  const cells = [...bins.entries()].map(([k, w]) => { const [a, b] = k.split(':').map(Number); return { az0: a * 15, az1: a * 15 + 15, alt0: b * 15, alt1: b * 15 + 15, weight: (w / total) * 100 } })
  return cells.filter((c) => c.weight > 0.15).sort((x, y) => x.az0 - y.az0 || x.alt0 - y.alt0)
}
/** Horizon obstacle as seen from the array: azimuth span (from south, + west) and elevation angle. */
export type Obstruction = { azFrom: number; azTo: number; elevationDeg: number; label?: string }
export function obstructionFrom(bearingFromSouthDeg: number, widthM: number, distanceM: number, heightAboveArrayM: number, label?: string): Obstruction {
  const half = Math.atan2(widthM / 2, Math.max(0.5, distanceM)) / DEG
  return { azFrom: bearingFromSouthDeg - half, azTo: bearingFromSouthDeg + half, elevationDeg: Math.atan2(Math.max(0, heightAboveArrayM), Math.max(0.5, distanceM)) / DEG, label }
}
/** Shade factor = 1 − Σ weight of the segments hidden behind an obstruction (a segment counts when its centre is below the obstruction). */
export function shadeFactor(lat: number, obs: Obstruction[]): { sf: number; segments: (Segment & { shaded: boolean })[] } {
  const segs = sunpathSegments(lat).map((s) => {
    const cAz = (s.az0 + s.az1) / 2, cAlt = (s.alt0 + s.alt1) / 2
    const shaded = obs.some((o) => cAz >= o.azFrom && cAz <= o.azTo && cAlt <= o.elevationDeg)
    return { ...s, shaded }
  })
  const lost = segs.filter((s) => s.shaded).reduce((a, s) => a + s.weight, 0)
  return { sf: Math.max(0, Math.round((1 - lost / 100) * 100) / 100), segments: segs }
}

/* ───────── One call for the whole system ───────── */
export type McsResult = {
  arrays: ArrayResult[]; zone: string | null; source: KkSource
  annualKwh: number; monthlyKwh: number[]; useKwh: number; occupancy: Occupancy
  selfKwh: number; exportKwh: number; selfSufficiency: number; selfConsumptionRate: number; batteryShiftKwh: number
}
export async function mcsEstimate(input: { arrays: McsArray[]; site: { lat: number; lng: number; postcode?: string }; useKwh: number; occupancy: Occupancy; batteryUsableKwh?: number }): Promise<McsResult> {
  const r = await resolveArrays(input.arrays, input.site)
  const annualKwh = r.arrays.reduce((s, a) => s + a.kwh, 0)
  const sc = selfConsumption(annualKwh, input.useKwh, input.occupancy, input.batteryUsableKwh)
  return {
    arrays: r.arrays, zone: r.zone, source: r.source, annualKwh, monthlyKwh: r.monthlyShare.map((s) => Math.round(s * annualKwh)),
    useKwh: input.useKwh, occupancy: input.occupancy, selfKwh: sc.selfKwh, exportKwh: sc.exportKwh, selfSufficiency: sc.selfSufficiency, selfConsumptionRate: sc.selfConsumptionRate, batteryShiftKwh: sc.batteryKwh,
  }
}
