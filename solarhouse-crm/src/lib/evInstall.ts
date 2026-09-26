/* EV charger install design — will it fit on the supply, how is it earthed, what cable, what protection.
 *
 * Follows the shape of the IET Code of Practice for EV Charging Equipment Installation (5th ed.) and BS 7671
 * Section 722, simplified to what a pre-design needs and flagged for the electrician to confirm:
 *   • MAXIMUM DEMAND — household loads with typical diversity (On-Site-Guide style) plus the charger at 100%
 *     (EV charging is long and continuous, so it gets no diversity) against the main fuse.
 *   • EARTHING — on a PME (TN-C-S) supply an outdoor charger needs open-PEN protection: built into most modern
 *     chargers, otherwise an earth electrode makes that circuit TT.
 *   • CABLE — the smallest size that carries the current for the install method and keeps volt drop inside the
 *     5% BS 7671 limit (allowing ~1% already used upstream).
 *   • PROTECTION — a 30 mA RCD; Type A is enough when the charger detects 6 mA DC itself, else Type B.
 * Verdicts are advisory until the survey confirms the supply. */

import type { Design } from '../store/types'
import { homeOf, evOf, scopeOf, batteryOf } from './homeSystem'
import { chargerById, vehicleById, batteryById } from './catalogue'

const V = 230
export type EvCheck = { label: string; value: string; ok: boolean; warn?: boolean; note?: string }
export type EvVerdict = 'fits' | 'load-management' | 'upgrade'

/** Current-carrying capacity (A) of 3-core SWA / T&E for the common EV routes (typical BS 7671 Appendix 4 values). */
const CAPACITY: Record<'clipped' | 'buried' | 'conduit', Record<number, number>> = {
  clipped: { 4: 40, 6: 51, 10: 70, 16: 94 },
  buried: { 4: 37, 6: 46, 10: 61, 16: 79 },
  conduit: { 4: 32, 6: 41, 10: 57, 16: 76 },
}
const MV_A_M: Record<number, number> = { 4: 11, 6: 7.3, 10: 4.4, 16: 2.8 }
const SIZES = [4, 6, 10, 16]
export const CABLE_COST: Record<number, number> = { 4: 3.4, 6: 4.2, 10: 6.1, 16: 8.6 } // £/m example SWA

export function evInstall(d: Design) {
  const home = homeOf(d), ev = evOf(d), charger = chargerById(ev.chargerId), car = vehicleById(ev.vehicleId)
  const scope = scopeOf(d)
  const chargeKw = Math.min(charger.kw, car.acKw, home.supply.phases === 1 ? 7.4 : 22)
  const evA = Math.round((chargeKw * 1000) / V)

  // ── maximum demand (single phase) ──
  const L = home.loads
  const lines: { label: string; kw: number; amps: number; note: string }[] = []
  const add = (label: string, kw: number, amps: number, note: string) => { if (amps > 0) lines.push({ label, kw, amps: Math.round(amps), note }) }
  add('Lighting, sockets & small appliances', 0, 25, 'typical diversified allowance for a house')
  if (L.cookingKw) { const I = (L.cookingKw * 1000) / V; add('Cooking', L.cookingKw, 10 + Math.max(0, I - 10) * 0.3, 'first 10 A + 30% of the rest') }
  if (L.showerKw) add('Electric shower', L.showerKw, (L.showerKw * 1000) / V, 'no diversity')
  if (L.immersionKw) add('Immersion heater', L.immersionKw, (L.immersionKw * 1000) / V, 'no diversity')
  if (L.heatPumpKw) add('Heat pump', L.heatPumpKw, (L.heatPumpKw * 1000) / V, 'no diversity')
  if (L.otherKw) add('Other fixed loads', L.otherKw, (L.otherKw * 1000) / V, 'as entered')
  if (scope.battery) {
    const bd = batteryOf(d), b = batteryById(bd.productId)
    if (bd.mode !== 'self') add('Battery grid charging', b.powerKw, (b.powerKw * 1000) / V * 0.5, 'overnight charging overlaps the car — 50% allowed; set the inverter to share the fuse')
  }
  const houseA = lines.reduce((s, l) => s + l.amps, 0)
  add(`EV charger (${chargeKw} kW)`, chargeKw, evA, 'continuous load — no diversity')
  const totalA = houseA + evA
  const fuse = home.supply.fuseA
  const verdict: EvVerdict = totalA <= fuse ? 'fits' : houseA + 6 <= fuse && charger.loadManagement ? 'load-management' : 'upgrade'
  const headroom = fuse - houseA // what's left for the car before load management kicks in

  // ── earthing ──
  const pme = home.supply.earthing === 'TN-C-S'
  const outdoor = ev.chargerLocation !== 'garage'
  const needsRod = pme && outdoor && !charger.penBuiltIn
  const earthing = home.supply.earthing === 'TT'
    ? 'TT supply — use the existing earth electrode; check its resistance (Ra) on test'
    : pme && outdoor
      ? charger.penBuiltIn ? 'PME supply — the charger has built-in open-PEN protection, so the circuit can stay on the PME earth' : 'PME supply, charger without PEN protection — fit an earth electrode (TT the circuit) or an external open-PEN device'
      : pme ? 'Charger inside a garage on PME — confirm no exposed metalwork outside the equipotential zone' : 'TN-S supply — use the supply earth'

  // ── cable: smallest size that carries the current and keeps volt drop within budget ──
  const budgetV = V * 0.04 // 5% limit less ~1% upstream
  const cap = CAPACITY[ev.install]
  const run = Math.max(1, ev.cableRunM)
  const pick = SIZES.find((mm) => cap[mm] >= evA && (MV_A_M[mm] * evA * run) / 1000 <= budgetV) ?? 16
  const vd = (MV_A_M[pick] * evA * run) / 1000
  const breaker = evA <= 32 ? 32 : 40
  const rcd = charger.dc6mA ? 'Type A 30 mA RCBO (the charger detects 6 mA DC itself)' : 'Type B 30 mA RCD — the charger has no 6 mA DC detection'

  const checks: EvCheck[] = [
    { label: 'Supply headroom', value: `${houseA} A house + ${evA} A car = ${totalA} A on a ${fuse} A fuse`, ok: verdict === 'fits', warn: verdict === 'load-management', note: verdict === 'fits' ? 'fits without load management' : verdict === 'load-management' ? `${charger.brand} ${charger.name} throttles the car to the ${Math.max(0, headroom)} A spare using its supply CT clamp` : 'needs a DNO fuse upgrade (or a smaller charge rate) — apply to the DNO' },
    { label: 'Earthing', value: home.supply.earthing, ok: !needsRod, warn: needsRod, note: earthing },
    { label: 'Cable', value: `${pick} mm² SWA, ${run} m ${ev.install}`, ok: vd <= budgetV, note: `${vd.toFixed(1)} V drop (${((vd / V) * 100).toFixed(1)}% — limit 4% here) · rated ${cap[pick]} A` },
    { label: 'Protection', value: `${breaker} A RCBO`, ok: true, note: rcd },
    { label: 'Consumer unit', value: `${home.supply.spareWays} spare way${home.supply.spareWays === 1 ? '' : 's'}`, ok: home.supply.spareWays > 0, warn: home.supply.spareWays === 0, note: home.supply.spareWays > 0 ? 'room for the charger circuit' : 'no spare way — add a small sub-board or henley block + switch fuse' },
    { label: 'DNO', value: chargeKw > 3.68 ? 'Connect & notify' : 'No notification', ok: true, note: chargeKw > 3.68 ? 'Tell the DNO within 28 days of install (ENA EV/heat pump form) — pre-filled from this design' : 'Under 3.68 kW — nothing to send' },
  ]
  const grant = home.tenure === 'owner'
    ? { eligible: false, text: 'Owner-occupiers of houses no longer get the OZEV grant — it now only covers renters, flat owners and landlords.' }
    : { eligible: true, text: 'Eligible for the OZEV chargepoint grant: 75% of the charger + install, up to £500 per socket (scheme closes 31 March 2027).' }
  const needsSubboard = home.supply.spareWays === 0
  return { charger, car, chargeKw, evA, lines, houseA, totalA, fuse, verdict, headroom, needsRod, earthing, cableMm2: pick, vd, breaker, rcd, checks, grant, needsSubboard }
}

export type EvInstall = ReturnType<typeof evInstall>
/** Labour + materials for the charger install (example trade figures) — feeds the kit list and the price. */
export function evInstallCost(x: EvInstall, runM: number) {
  return Math.round(x.charger.unitCost + runM * (CABLE_COST[x.cableMm2] ?? 4.2) + 45 /* RCBO */ + (x.needsRod ? 85 : 0) + (x.needsSubboard ? 160 : 0) + 380 /* labour */)
}
