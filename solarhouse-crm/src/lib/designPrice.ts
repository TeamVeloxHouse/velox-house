/* One price for the whole design — solar (Studio pricing formula), the chosen battery from the catalogue and the
 * EV charger install from its design — with the same margin and VAT, so the quote, kit list and proposal agree. */
import type { Design, StudioConfig } from '../store/types'
import { scopeOf, batteryOf, evOf, batteryPriceOf } from './homeSystem'
import { batteryRaw } from './finance'
import { evInstall, evInstallCost } from './evInstall'

type Cfg = Pick<StudioConfig, 'costPerKwp' | 'baseCost' | 'perPanel' | 'marginPct' | 'vatPct'>
export type PriceParts = { pv: number; battery: number; ev: number; total: number } // customer £ incl. margin + VAT

export function designPrice(d: Design, kwp: number, panels: number, cfg: Cfg): PriceParts {
  const scope = scopeOf(d)
  const up = (raw: number) => raw * (1 + cfg.marginPct / 100) * (1 + cfg.vatPct / 100)
  const pvRaw = scope.pv && panels > 0 ? kwp * cfg.costPerKwp + cfg.baseCost + panels * (cfg.perPanel || 0) : 0
  const bd = batteryOf(d)
  const batRaw = scope.battery ? (d.batteryDesign ? batteryPriceOf(bd.productId, bd.units) : batteryRaw(d.batteryKwh ?? 0)) : 0
  const evRaw = scope.ev ? evInstallCost(evInstall(d), evOf(d).cableRunM) : 0
  const r50 = (v: number) => Math.round(up(v) / 50) * 50
  const pv = r50(pvRaw), battery = r50(batRaw), ev = r50(evRaw)
  return { pv, battery, ev, total: pv + battery + ev }
}
