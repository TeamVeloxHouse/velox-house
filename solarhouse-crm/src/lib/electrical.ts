/* Electrical design for a residential PV system — strings, inverter checks, grid connection and cables.
 *
 * Module/inverter figures are TYPICAL DATASHEET VALUES for the listed products and are marked as such in the
 * UI: the installer must confirm against the datasheet of the exact model fitted. The checks follow standard
 * PV practice (IET Code of Practice for Grid-Connected Solar PV / MCS MIS 3002):
 *   · string Voc at the coldest cell temperature (−10 °C) must stay under the inverter's max DC voltage
 *   · string Vmp at hot cell temperature (70 °C) must stay above the MPPT minimum, and cold Vmp under its max
 *   · parallel strings on one MPPT must stay within its current limits
 *   · inverter AC output ≤ 16 A per phase (3.68 kW) connects under EREC G98; above that it's G99 (or G100 export limit)
 *   · AC voltage rise and DC loss from cable length, cross-section and current (BS 7671 mV/A/m values). */
import type { DesignPanel, DesignPlane } from '../store/types'

export type ModuleElec = { voc: number; vmp: number; isc: number; imp: number; betaVoc: number /* %/°C */; gammaVmp: number /* %/°C */ }
export const MODULE_ELEC: Record<string, ModuleElec> = {
  m405: { voc: 37.9, vmp: 31.8, isc: 13.6, imp: 12.75, betaVoc: -0.24, gammaVmp: -0.29 },
  m440: { voc: 39.5, vmp: 32.95, isc: 14.05, imp: 13.36, betaVoc: -0.25, gammaVmp: -0.30 },
  m450: { voc: 52.9, vmp: 44.4, isc: 10.75, imp: 10.14, betaVoc: -0.25, gammaVmp: -0.30 },
  m500: { voc: 45.5, vmp: 38.2, isc: 13.94, imp: 13.09, betaVoc: -0.24, gammaVmp: -0.29 },
  m430b: { voc: 48.4, vmp: 40.5, isc: 11.2, imp: 10.6, betaVoc: -0.236, gammaVmp: -0.27 },
  m550: { voc: 49.9, vmp: 41.96, isc: 14.0, imp: 13.11, betaVoc: -0.275, gammaVmp: -0.35 },
  m500g: { voc: 45.3, vmp: 37.9, isc: 14.0, imp: 13.2, betaVoc: -0.25, gammaVmp: -0.30 },
}
export const elecOf = (moduleId?: string) => MODULE_ELEC[moduleId ?? 'm440'] ?? MODULE_ELEC.m440

export type Inverter = {
  id: string; name: string; brand: string; acKw: number; hybrid: boolean
  mppts: number; vMax: number; mpptMin: number; mpptMax: number; startV: number
  iMaxPerMppt: number; iscMaxPerMppt: number; maxDcKw: number; priceGbp: number
}
export const INVERTERS: Inverter[] = [
  { id: 'give36', name: 'Gen3 Hybrid 3.6 kW', brand: 'GivEnergy', acKw: 3.6, hybrid: true, mppts: 2, vMax: 550, mpptMin: 120, mpptMax: 500, startV: 150, iMaxPerMppt: 16, iscMaxPerMppt: 20, maxDcKw: 5.4, priceGbp: 1150 },
  { id: 'give50', name: 'Gen3 Hybrid 5.0 kW', brand: 'GivEnergy', acKw: 5.0, hybrid: true, mppts: 2, vMax: 550, mpptMin: 120, mpptMax: 500, startV: 150, iMaxPerMppt: 16, iscMaxPerMppt: 20, maxDcKw: 7.5, priceGbp: 1350 },
  { id: 'solis50', name: 'S6 Hybrid 5 kW', brand: 'Solis', acKw: 5.0, hybrid: true, mppts: 2, vMax: 600, mpptMin: 90, mpptMax: 520, startV: 120, iMaxPerMppt: 16, iscMaxPerMppt: 22, maxDcKw: 8.0, priceGbp: 1100 },
  { id: 'solax50', name: 'X1-Hybrid G4 5.0', brand: 'SolaX', acKw: 5.0, hybrid: true, mppts: 2, vMax: 600, mpptMin: 70, mpptMax: 550, startV: 90, iMaxPerMppt: 16, iscMaxPerMppt: 20, maxDcKw: 7.5, priceGbp: 1250 },
  { id: 'fox50', name: 'H1-5.0-E G2', brand: 'Fox ESS', acKw: 5.0, hybrid: true, mppts: 2, vMax: 600, mpptMin: 80, mpptMax: 550, startV: 100, iMaxPerMppt: 16, iscMaxPerMppt: 20, maxDcKw: 7.5, priceGbp: 1050 },
  { id: 'sigen50', name: 'SigenStor EC 5.0 SP', brand: 'Sigenergy', acKw: 5.0, hybrid: true, mppts: 2, vMax: 600, mpptMin: 50, mpptMax: 550, startV: 70, iMaxPerMppt: 16, iscMaxPerMppt: 20, maxDcKw: 10, priceGbp: 1600 },
  { id: 'huawei50', name: 'SUN2000-5KTL-L1', brand: 'Huawei', acKw: 5.0, hybrid: true, mppts: 2, vMax: 600, mpptMin: 90, mpptMax: 560, startV: 120, iMaxPerMppt: 12.5, iscMaxPerMppt: 18, maxDcKw: 7.5, priceGbp: 1150 },
  { id: 'solis36s', name: 'Mini 3.6K 5G (string)', brand: 'Solis', acKw: 3.6, hybrid: false, mppts: 1, vMax: 600, mpptMin: 90, mpptMax: 520, startV: 120, iMaxPerMppt: 14, iscMaxPerMppt: 22, maxDcKw: 5.4, priceGbp: 650 },
]
export const inverterById = (id?: string) => INVERTERS.find((i) => i.id === id)

export type DesignString = { id: string; planeId: string; mppt: number; panelIds: string[] }
export type Electrical = {
  inverterId: string; strings: DesignString[]
  acCableM?: number; acCableMm2?: number; dcCableM?: number; dcCableMm2?: number; ze?: number; exportLimitKw?: number
}
export const STRING_COLORS = ['#62E4CC', '#F59E0B', '#A78BFA', '#F472B6', '#38BDF8', '#A3E635', '#FB7185', '#FACC15']

const T_COLD = -10, T_HOT = 70
export const vocCold = (n: number, e: ModuleElec) => n * e.voc * (1 + (e.betaVoc / 100) * (T_COLD - 25))
export const vmpHot = (n: number, e: ModuleElec) => n * e.vmp * (1 + (e.gammaVmp / 100) * (T_HOT - 25))
export const vmpCold = (n: number, e: ModuleElec) => n * e.vmp * (1 + (e.gammaVmp / 100) * (T_COLD - 25))
/** Shortest and longest string this module can make on this inverter. */
export function stringLimits(e: ModuleElec, inv: Inverter) {
  const nMax = Math.floor(Math.min(inv.vMax / vocCold(1, e), inv.mpptMax / vmpCold(1, e)))
  const nMin = Math.ceil(Math.max(inv.mpptMin, inv.startV) / vmpHot(1, e))
  return { nMin, nMax }
}

/** Snake order through a plane's panels (row by row, alternating), so each string is a tidy run. */
export function snakeOrder(panels: DesignPanel[], azimuthDeg: number): DesignPanel[] {
  if (!panels.length) return []
  const lat0 = panels[0].corners[0].lat, mLng = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const az = (azimuthDeg * Math.PI) / 180, down = { x: Math.sin(az), y: Math.cos(az) }, across = { x: Math.cos(az), y: -Math.sin(az) }
  const c = panels.map((p) => {
    const cx = ((p.corners[0].lng + p.corners[2].lng) / 2) * mLng, cy = ((p.corners[0].lat + p.corners[2].lat) / 2) * 110540
    return { p, row: cx * down.x + cy * down.y, col: cx * across.x + cy * across.y }
  })
  c.sort((a, b) => a.row - b.row)
  const rows: (typeof c)[] = []
  for (const x of c) { const last = rows[rows.length - 1]; if (last && Math.abs(last[0].row - x.row) < 0.8) last.push(x); else rows.push([x]) }
  return rows.flatMap((r, i) => r.sort((a, b) => (i % 2 ? b.col - a.col : a.col - b.col)).map((x) => x.p))
}

/** Auto-string: each roof face gets its own MPPT where possible, split into equal parallel strings that fit
 *  the voltage window and current limit. Faces that can't get an MPPT, or panels that won't fit, are reported. */
export function autoString(planes: DesignPlane[], moduleId: string, inv: Inverter): { strings: DesignString[]; issues: string[] } {
  const filled = planes.filter((p) => p.panels?.length).sort((a, b) => (b.panels!.length - a.panels!.length))
  const issues: string[] = []
  const strings: DesignString[] = []
  let mppt = 0
  for (const p of filled) {
    const e = elecOf(p.moduleId ?? moduleId), { nMin, nMax } = stringLimits(e, inv)
    const order = snakeOrder(p.panels!, p.azimuthDeg)
    if (mppt >= inv.mppts) { issues.push(`${p.name || 'A roof face'} has no MPPT left — choose an inverter with more MPPTs, add optimisers, or a second inverter.`); continue }
    const N = order.length
    const maxPar = Math.max(1, Math.floor(inv.iMaxPerMppt / e.imp + 1e-9))
    let best: { par: number; len: number } | null = null
    for (let par = 1; par <= maxPar; par++) {
      const len = Math.floor(N / par)
      if (len > nMax || len < nMin) continue
      if (!best || par * len > best.par * best.len) best = { par, len }
    }
    if (!best) {
      if (N < nMin) issues.push(`${p.name || 'A roof face'}: ${N} panels is below the ${nMin}-panel minimum for this inverter's MPPT window.`)
      else issues.push(`${p.name || 'A roof face'}: ${N} panels can't be split into strings of ${nMin}–${nMax} within ${inv.iMaxPerMppt} A.`)
      mppt++
      continue
    }
    for (let s = 0; s < best.par; s++) strings.push({ id: `s${strings.length + 1}`, planeId: p.id, mppt, panelIds: order.slice(s * best.len, (s + 1) * best.len).map((x) => x.id) })
    const left = N - best.par * best.len
    if (left) issues.push(`${p.name || 'A roof face'}: ${left} panel${left > 1 ? 's' : ''} left unstrung — remove ${left > 1 ? 'them' : 'it'} or re-layout so strings are equal.`)
    mppt++
  }
  return { strings, issues }
}

export type Check = { label: string; value: string; limit: string; ok: boolean; warn?: boolean }
export type MpptCheck = { mppt: number; strings: DesignString[]; len: number; parallel: number; checks: Check[] }

export function checkStrings(el: Electrical, planes: DesignPlane[], moduleId: string) {
  const inv = inverterById(el.inverterId)!
  const byMppt = new Map<number, DesignString[]>()
  for (const s of el.strings) byMppt.set(s.mppt, [...(byMppt.get(s.mppt) ?? []), s])
  const out: MpptCheck[] = []
  for (const [m, ss] of [...byMppt].sort((a, b) => a[0] - b[0])) {
    const plane = planes.find((p) => p.id === ss[0].planeId)
    const e = elecOf(plane?.moduleId ?? moduleId)
    const len = Math.max(...ss.map((s) => s.panelIds.length)), par = ss.length
    const equal = ss.every((s) => s.panelIds.length === len)
    const voc = vocCold(len, e), vh = vmpHot(len, e), vc = vmpCold(len, e)
    out.push({ mppt: m, strings: ss, len, parallel: par, checks: [
      { label: 'Voc at −10 °C', value: `${voc.toFixed(0)} V`, limit: `≤ ${inv.vMax} V max DC`, ok: voc <= inv.vMax },
      { label: 'Vmp at 70 °C', value: `${vh.toFixed(0)} V`, limit: `≥ ${Math.max(inv.mpptMin, inv.startV)} V MPPT/start`, ok: vh >= Math.max(inv.mpptMin, inv.startV) },
      { label: 'Vmp at −10 °C', value: `${vc.toFixed(0)} V`, limit: `≤ ${inv.mpptMax} V MPPT max`, ok: vc <= inv.mpptMax, warn: vc > inv.mpptMax * 0.97 && vc <= inv.mpptMax },
      { label: 'Operating current', value: `${(e.imp * par).toFixed(1)} A`, limit: `≤ ${inv.iMaxPerMppt} A per MPPT`, ok: e.imp * par <= inv.iMaxPerMppt },
      { label: 'Short-circuit current', value: `${(e.isc * par).toFixed(1)} A`, limit: `≤ ${inv.iscMaxPerMppt} A per MPPT`, ok: e.isc * par <= inv.iscMaxPerMppt },
      ...(par > 1 ? [{ label: 'Parallel strings equal', value: equal ? 'Yes' : 'No', limit: 'same length on one MPPT', ok: equal }] : []),
    ] })
  }
  return out
}

/** BS 7671 Appendix 4 — voltage drop (mV/A/m) for twin & earth / 2-core copper, 70 °C thermoplastic. */
export const MV_PER_A_M: Record<number, number> = { 2.5: 18, 4: 11, 6: 7.3, 10: 4.4, 16: 2.8 }
export const CABLE_SIZES = [2.5, 4, 6, 10, 16]
export const breakerFor = (amps: number) => [16, 20, 25, 32, 40, 50, 63].find((b) => b >= amps * 1.0) ?? 63

export function acVoltageRise(acKw: number, lengthM: number, mm2: number, ze = 0) {
  const I = (acKw * 1000) / 230
  const vCable = (MV_PER_A_M[mm2] * I * lengthM) / 1000
  const vSupply = I * ze
  return { I, vCable, pctCable: (vCable / 230) * 100, vSupply, pctSupply: (vSupply / 230) * 100, pctTotal: ((vCable + vSupply) / 230) * 100 }
}
/** DC loss for a string: two conductors, copper resistivity ≈ 1/56 Ω·mm²/m. */
export function dcLoss(lengthM: number, mm2: number, amps: number, stringV: number) {
  const v = (2 * lengthM * amps) / (56 * mm2)
  return { v, pct: (v / Math.max(1, stringV)) * 100, w: v * amps }
}

/** Grid connection route for the inverter's AC rating (single phase). */
export function gridRoute(acKw: number, exportLimitKw?: number) {
  const i = (acKw * 1000) / 230
  if (i <= 16.05) return { code: 'G98', text: `EREC G98 — ${acKw} kW (${i.toFixed(1)} A) is within 16 A per phase: install, then notify the DNO within 28 days.` }
  if (exportLimitKw != null && exportLimitKw <= 3.68) return { code: 'G100', text: `EREC G99 with G100 export limitation to ${exportLimitKw} kW — apply to the DNO before install; the limiter must be a G100-compliant scheme.` }
  return { code: 'G99', text: `EREC G99 — ${acKw} kW (${i.toFixed(1)} A) is above 16 A per phase: apply to the DNO and get approval before install.` }
}

export function defaultElectrical(planes: DesignPlane[], moduleId: string, kwp: number, hasBattery: boolean): Electrical {
  const inv = INVERTERS.filter((i) => (hasBattery ? i.hybrid : true)).find((i) => i.maxDcKw >= kwp && i.acKw >= Math.min(5, kwp * 0.75)) ?? INVERTERS[1]
  return { inverterId: inv.id, strings: autoString(planes, moduleId, inv).strings, acCableM: 8, acCableMm2: 6, dcCableM: 15, dcCableMm2: 4, ze: 0.35 }
}
