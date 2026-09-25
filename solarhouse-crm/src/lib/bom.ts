/* Kit list (bill of materials) for a design — what the installers need on the van, worked out from the layout.
 *
 * Mounting comes from the real panel rows: two rails under every row, rail stock in 3.3 m lengths with splices,
 * a roof hook every ~1.2 m of rail, end clamps at each row end and mid clamps between panels. Electrical comes
 * from the strings and cable runs on the Electrical tab. Trade costs are EXAMPLE figures for planning — replace
 * them with the wholesaler's price list. Lines are grouped by supplier so they drop straight into delivery orders. */
import type { Design } from '../store/types'
import { moduleById } from './panels'
import { inverterById, panelRows, breakerFor, acVoltageRise, INVERTERS } from './electrical'

export type BomCategory = 'Solar modules' | 'Inverter & battery' | 'Mounting' | 'DC electrical' | 'AC electrical' | 'Site & access'
export type BomLine = { id: string; category: BomCategory; item: string; detail: string; qty: number; unit: string; unitCost: number; supplier: string; optional?: boolean }

export const SUPPLIERS = { wholesale: 'Midsummer Wholesale', mounting: 'Renusol UK', electrical: 'CEF', access: 'Scaffold subcontractor' }
const RAIL_LEN = 3.3, HOOK_SPACING = 1.2, GAP = 0.02
const TE_COST: Record<number, number> = { 2.5: 1.1, 4: 1.9, 6: 2.8, 10: 4.6, 16: 7.2 }

export function buildBom(design: Design, moduleId: string): BomLine[] {
  const filled = design.planes.filter((p) => p.panels?.length)
  const lines: BomLine[] = []
  const add = (l: Omit<BomLine, 'id'>) => { if (l.qty > 0) lines.push({ ...l, id: `${l.category}:${l.item}` }) }

  // modules — grouped per model in case faces use different ones
  const byModule = new Map<string, number>()
  for (const p of filled) byModule.set(p.moduleId ?? moduleId, (byModule.get(p.moduleId ?? moduleId) ?? 0) + p.panels!.length)
  for (const [id, n] of byModule) { const m = moduleById(id); add({ category: 'Solar modules', item: `${m.brand} ${m.name}`, detail: `${m.watts} W · ${m.cell}`, qty: n, unit: 'pcs', unitCost: m.priceGbp, supplier: SUPPLIERS.wholesale }) }

  // inverter + battery
  const el = design.electrical
  const inv = inverterById(el?.inverterId) ?? INVERTERS[1]
  add({ category: 'Inverter & battery', item: `${inv.brand} ${inv.name}`, detail: `${inv.acKw} kW · ${inv.mppts} MPPT${inv.hybrid ? ' · hybrid' : ''}`, qty: 1, unit: 'pcs', unitCost: inv.priceGbp, supplier: SUPPLIERS.wholesale })
  if (design.batteryKwh) add({ category: 'Inverter & battery', item: `${inv.brand} battery`, detail: `${design.batteryKwh} kWh usable, ${inv.brand}-compatible`, qty: 1, unit: 'set', unitCost: Math.round(design.batteryKwh * 330), supplier: SUPPLIERS.wholesale })
  add({ category: 'Inverter & battery', item: 'Monitoring gateway / CT clamp', detail: 'Export metering + app', qty: 1, unit: 'pcs', unitCost: 45, supplier: SUPPLIERS.wholesale })

  // mounting from the real rows
  let rails = 0, splices = 0, hooks = 0, endClamps = 0, midClamps = 0, perimeter = 0
  for (const p of filled) {
    const m = moduleById(p.moduleId ?? moduleId)
    const along = (p.orientation ?? 'portrait') === 'landscape' ? m.h : m.w, depth = (p.orientation ?? 'portrait') === 'landscape' ? m.w : m.h
    const rows = panelRows(p.panels!, p.azimuthDeg)
    let maxLen = 0
    for (const r of rows) {
      const L = r.length * (along + GAP) + 0.1
      maxLen = Math.max(maxLen, L)
      const perRail = Math.ceil(L / RAIL_LEN)
      rails += 2 * perRail; splices += 2 * (perRail - 1)
      hooks += 2 * (Math.ceil(L / HOOK_SPACING) + 1)
      endClamps += 4; midClamps += 2 * (r.length - 1)
    }
    perimeter += 2 * (maxLen + rows.length * (depth + GAP))
  }
  add({ category: 'Mounting', item: 'Mounting rail 3.3 m', detail: 'Aluminium, black', qty: rails, unit: 'pcs', unitCost: 26, supplier: SUPPLIERS.mounting })
  add({ category: 'Mounting', item: 'Rail splice', detail: 'Joins rail lengths', qty: splices, unit: 'pcs', unitCost: 3.2, supplier: SUPPLIERS.mounting })
  add({ category: 'Mounting', item: 'Roof hook (tile)', detail: `~every ${HOOK_SPACING} m of rail — check rafter centres on survey`, qty: hooks, unit: 'pcs', unitCost: 6.5, supplier: SUPPLIERS.mounting })
  add({ category: 'Mounting', item: 'End clamp', detail: 'Black, 30–35 mm frame', qty: endClamps, unit: 'pcs', unitCost: 1.9, supplier: SUPPLIERS.mounting })
  add({ category: 'Mounting', item: 'Mid clamp', detail: 'Black, 30–35 mm frame', qty: midClamps, unit: 'pcs', unitCost: 1.7, supplier: SUPPLIERS.mounting })
  add({ category: 'Mounting', item: 'Bird protection mesh', detail: 'Around the array edge', qty: Math.ceil(perimeter), unit: 'm', unitCost: 4.5, supplier: SUPPLIERS.mounting, optional: true })

  // DC — from strings + the DC cable run
  const strings = (el?.strings ?? []).filter((s) => s.panelIds.length)
  const nStrings = strings.length || Math.max(1, filled.length)
  const mppts = new Set(strings.map((s) => s.mppt)).size || Math.min(inv.mppts, filled.length)
  const dcRun = el?.dcCableM ?? 15, dcMm2 = el?.dcCableMm2 ?? 4
  add({ category: 'DC electrical', item: `PV cable ${dcMm2} mm² (red)`, detail: `${nStrings} string${nStrings > 1 ? 's' : ''} × (${dcRun} m run + 5 m on the array)`, qty: nStrings * (dcRun + 5), unit: 'm', unitCost: dcMm2 >= 6 ? 1.35 : 0.95, supplier: SUPPLIERS.electrical })
  add({ category: 'DC electrical', item: `PV cable ${dcMm2} mm² (black)`, detail: 'as above', qty: nStrings * (dcRun + 5), unit: 'm', unitCost: dcMm2 >= 6 ? 1.35 : 0.95, supplier: SUPPLIERS.electrical })
  add({ category: 'DC electrical', item: 'MC4 connector pair', detail: '2 per string + spares', qty: nStrings * 2 + 2, unit: 'pairs', unitCost: 3.2, supplier: SUPPLIERS.electrical })
  add({ category: 'DC electrical', item: 'DC isolator (2-pole, 1000 V)', detail: 'One per MPPT input', qty: mppts, unit: 'pcs', unitCost: 45, supplier: SUPPLIERS.electrical })
  add({ category: 'DC electrical', item: 'Roof-space cable glands & conduit', detail: 'Weatherproof entry', qty: 1, unit: 'kit', unitCost: 25, supplier: SUPPLIERS.electrical })

  // AC — from the inverter rating + AC run
  const ac = acVoltageRise(inv.acKw, el?.acCableM ?? 8, el?.acCableMm2 ?? 6)
  const brk = breakerFor(ac.I), acMm2 = el?.acCableMm2 ?? 6
  add({ category: 'AC electrical', item: `Twin & earth ${acMm2} mm²`, detail: 'Inverter → consumer unit', qty: (el?.acCableM ?? 8) + 2, unit: 'm', unitCost: TE_COST[acMm2] ?? 2.8, supplier: SUPPLIERS.electrical })
  add({ category: 'AC electrical', item: `AC isolator ${brk} A double-pole`, detail: 'Next to the inverter', qty: 1, unit: 'pcs', unitCost: 25, supplier: SUPPLIERS.electrical })
  add({ category: 'AC electrical', item: `RCBO ${brk} A type B`, detail: 'Dedicated way in the consumer unit', qty: 1, unit: 'pcs', unitCost: 32, supplier: SUPPLIERS.electrical })
  add({ category: 'AC electrical', item: 'Generation meter (MID)', detail: 'For the SEG / MCS certificate', qty: 1, unit: 'pcs', unitCost: 38, supplier: SUPPLIERS.electrical })
  add({ category: 'AC electrical', item: 'Surge protection device, type 2', detail: 'If not already in the consumer unit', qty: 1, unit: 'pcs', unitCost: 65, supplier: SUPPLIERS.electrical, optional: true })
  add({ category: 'AC electrical', item: 'Warning labels & dual-supply signage', detail: 'Consumer unit, meter, isolators', qty: 1, unit: 'set', unitCost: 15, supplier: SUPPLIERS.electrical })

  // access
  add({ category: 'Site & access', item: 'Scaffold with edge protection', detail: `${filled.length} roof face${filled.length > 1 ? 's' : ''}, erect + dismantle`, qty: 1, unit: 'job', unitCost: 650 + 250 * Math.max(0, filled.length - 1), supplier: SUPPLIERS.access })
  return lines
}

export const lineTotal = (l: BomLine) => Math.round(l.qty * l.unitCost * 100) / 100
export function bomTotals(lines: BomLine[], include: Set<string>) {
  const used = lines.filter((l) => !l.optional || include.has(l.id))
  const total = used.reduce((s, l) => s + lineTotal(l), 0)
  const bySupplier = new Map<string, { items: BomLine[]; value: number }>()
  for (const l of used) { const g = bySupplier.get(l.supplier) ?? { items: [], value: 0 }; g.items.push(l); g.value += lineTotal(l); bySupplier.set(l.supplier, g) }
  return { used, total, bySupplier }
}
export function bomCsv(lines: BomLine[]) {
  const rows = [['Category', 'Item', 'Detail', 'Qty', 'Unit', 'Unit cost (£)', 'Line total (£)', 'Supplier', 'Optional']]
  for (const l of lines) rows.push([l.category, l.item, l.detail, String(l.qty), l.unit, l.unitCost.toFixed(2), lineTotal(l).toFixed(2), l.supplier, l.optional ? 'yes' : ''])
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
}
