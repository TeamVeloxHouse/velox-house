/* Battery siting + grid connection.
 *
 * PAS 63100:2024 (fire protection of home battery storage): outdoors is preferred and must sit ≥1 m from doors,
 * windows, vents and escape routes; indoors only in rooms with REI 30 fire separation (utility room, garage, plant
 * room); never in bedrooms, stairs/hallways/escape routes, lofts/roof voids, or cupboards opening into bedrooms;
 * a rarely-visited location needs an interlinked smoke/heat alarm.
 * G98/G99: what counts is the total inverter capacity per phase — the PV inverter plus any separate battery
 * inverter. A DC-coupled battery shares the hybrid inverter, so it adds nothing; an AC-coupled one adds its own. */

import type { BatteryLocation, Design } from '../store/types'
import { batteryById } from './catalogue'
import { batteryOf, scopeOf } from './homeSystem'
import { gridRoute, inverterById, INVERTERS } from './electrical'

export const LOCATIONS: { id: BatteryLocation; label: string; allowed: boolean | 'conditions'; why: string }[] = [
  { id: 'outdoor-wall', label: 'Outside wall', allowed: 'conditions', why: 'Preferred by PAS 63100 — at least 1 m from doors, windows, vents and escape routes' },
  { id: 'garage', label: 'Garage (integral or detached)', allowed: 'conditions', why: 'Allowed with REI 30 separation from the house and a smoke/heat alarm' },
  { id: 'utility', label: 'Utility room', allowed: 'conditions', why: 'Allowed with REI 30 fire separation; not on the escape route' },
  { id: 'plant-room', label: 'Plant / boiler room', allowed: 'conditions', why: 'Allowed with REI 30 fire separation' },
  { id: 'cupboard', label: 'Store cupboard', allowed: 'conditions', why: 'Only if it doesn’t open into a bedroom; needs an interlinked alarm' },
  { id: 'loft', label: 'Loft / roof space', allowed: false, why: 'Not allowed — lofts, roof spaces and voids are excluded' },
  { id: 'hallway', label: 'Hallway / stairs', allowed: false, why: 'Not allowed — escape routes are excluded' },
  { id: 'bedroom', label: 'Bedroom', allowed: false, why: 'Not allowed — rooms for sleeping are excluded' },
]

/** The checks the surveyor ticks for the chosen location. */
export function locationChecks(loc?: BatteryLocation): { id: string; label: string }[] {
  if (!loc) return []
  if (loc === 'outdoor-wall') return [
    { id: 'clear1m', label: 'At least 1 m from doors, opening windows and vents' },
    { id: 'notEscape', label: 'Not under or beside an escape route' },
    { id: 'ip', label: 'Product is outdoor-rated and out of direct flood risk' },
    { id: 'mount', label: 'Wall/floor can take the weight' },
  ]
  if (loc === 'loft' || loc === 'hallway' || loc === 'bedroom') return []
  return [
    { id: 'rei30', label: 'Walls, ceiling and door give REI 30 fire separation' },
    { id: 'notEscape', label: 'Not on an escape route' },
    { id: 'alarm', label: 'Interlinked smoke/heat alarm in this space' },
    { id: 'vent', label: 'Ventilation and clearances per the manufacturer' },
    ...(loc === 'cupboard' ? [{ id: 'notBedroom', label: 'Cupboard does not open into a bedroom' }] : []),
  ]
}

export function batteryCompliance(d: Design) {
  const scope = scopeOf(d), bd = batteryOf(d), p = batteryById(bd.productId)
  const loc = LOCATIONS.find((l) => l.id === bd.location)
  const checks = locationChecks(bd.location)
  const ticked = checks.filter((c) => bd.checks?.[c.id]).length
  const siting = !loc ? { ok: false, warn: true, text: 'Pick where the battery will go — it’s confirmed on survey' }
    : loc.allowed === false ? { ok: false, warn: false, text: `${loc.label}: ${loc.why}` }
    : !p.outdoor && loc.id === 'outdoor-wall' ? { ok: false, warn: false, text: `${p.brand} ${p.name} isn’t outdoor-rated` }
    : { ok: ticked === checks.length, warn: ticked < checks.length, text: `${loc.label}: ${loc.why} — ${ticked}/${checks.length} checks confirmed` }

  // Grid route: PV inverter (unless the battery's hybrid replaces it) + a separate AC-coupled battery inverter
  const pvInv = scope.pv ? inverterById(d.electrical?.inverterId) ?? INVERTERS[1] : null
  const hybridReplaces = p.coupling === 'dc'
  const pvKw = scope.pv ? (hybridReplaces ? 0 : pvInv?.acKw ?? 0) : 0
  const existingPvKw = !scope.pv && d.home?.existingPv ? Math.min(d.home.existingPv.kwp, 3.68) : 0
  const totalKw = +(pvKw + existingPvKw + p.inverterKw).toFixed(2)
  const route = gridRoute(totalKw, d.electrical?.exportLimitKw)
  const parts = [
    ...(scope.pv && !hybridReplaces && pvInv ? [`PV inverter ${pvInv.acKw} kW`] : []),
    ...(existingPvKw ? [`existing PV inverter ~${existingPvKw} kW`] : []),
    `${p.coupling === 'dc' ? 'hybrid inverter (PV + battery)' : 'battery inverter'} ${p.inverterKw} kW`,
  ]
  return { product: p, loc, checks, ticked, siting, totalKw, route, parts, hybridReplaces }
}
