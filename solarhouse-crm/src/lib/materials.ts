import type { StudioProject, OrderItem } from '../store/types'

/* Job costing / materials estimator — turns a system size into a real bill of materials.
 * Ratios are industry-typical for a UK domestic install, not manufacturer-specific — treat as a
 * starting order that a project manager checks off against the actual site survey, the same way
 * the rest of this app is honest that modelled numbers get confirmed at survey. */

const RATES = {
  panelUnitCost: 110, // £/panel, Tier-1 mono ~440W
  inverterBase: 650, // £, hybrid inverter base
  inverterPerKwp: 40, // £/kWp on top of base
  railPerPanelM: 1.6, // m of mounting rail per panel
  railCostPerM: 4.5, // £/m
  hooksPerPanel: 3, // roof hooks/clamps per panel
  hookCost: 2.2, // £ each
  dcCableBaseM: 10, // m — string to inverter, base run
  dcCablePerPanelM: 0.5, // extra m per panel
  dcCableCostPerM: 2.8, // £/m (2-core PV cable)
  acCableM: 15, // m — inverter to consumer unit, typical
  acCableCostPerM: 3.2, // £/m
  containmentM: 20, // m of trunking/conduit
  containmentCostPerM: 2.1, // £/m
  isolatorCost: 45, // £ each (AC + DC)
  consumerUnitWork: 180, // £ flat — breaker, metering, labelling
  panelsPerScaffoldDay: 8, // roof coverage a scaffold day typically supports
  scaffoldDayCost: 220, // £/day
  batteryUnitCost: 480, // £/kWh, installed battery hardware (mounting/wiring, not the cell itself — that's in the quote's battery line)
  consumables: 85, // £ flat — fixings, sealant, cable clips, labels, tape
}

export function estimateMaterials(p: Pick<StudioProject, 'systemKwp' | 'products'>): OrderItem[] {
  const kwp = p.systemKwp ?? 4
  const panels = Math.max(4, Math.round((kwp * 1000) / 440))
  const hasBattery = (p.products ?? []).some((x) => /battery/i.test(x.name))
  const batteryKwh = hasBattery ? (p.products!.find((x) => /battery/i.test(x.name))?.detail.match(/(\d+(\.\d+)?)\s*kWh/)?.[1] ?? '5') : '0'

  const scaffoldDays = Math.max(1, Math.ceil(panels / RATES.panelsPerScaffoldDay))
  const dcCableM = Math.round(RATES.dcCableBaseM + panels * RATES.dcCablePerPanelM)

  const items: OrderItem[] = [
    { name: 'Solar PV panels (440W Tier-1 mono)', qty: panels, unitCost: RATES.panelUnitCost },
    { name: 'Hybrid inverter', qty: 1, unitCost: Math.round(RATES.inverterBase + kwp * RATES.inverterPerKwp) },
    { name: 'Mounting rail', qty: Math.round(panels * RATES.railPerPanelM), unitCost: RATES.railCostPerM },
    { name: 'Roof hooks / clamps', qty: panels * RATES.hooksPerPanel, unitCost: RATES.hookCost },
    { name: 'DC cable (string → inverter)', qty: dcCableM, unitCost: RATES.dcCableCostPerM },
    { name: 'AC cable (inverter → consumer unit)', qty: RATES.acCableM, unitCost: RATES.acCableCostPerM },
    { name: 'Trunking / containment', qty: RATES.containmentM, unitCost: RATES.containmentCostPerM },
    { name: 'AC + DC isolators', qty: 2, unitCost: RATES.isolatorCost },
    { name: 'Consumer unit work (breaker, metering, labelling)', qty: 1, unitCost: RATES.consumerUnitWork },
    { name: 'Scaffolding', qty: scaffoldDays, unitCost: RATES.scaffoldDayCost },
    { name: 'Consumables (fixings, sealant, clips, labels)', qty: 1, unitCost: RATES.consumables },
  ]
  if (hasBattery) items.splice(2, 0, { name: `Battery mounting & wiring (${batteryKwh} kWh)`, qty: 1, unitCost: RATES.batteryUnitCost })
  return items
}

export const materialsTotal = (items: OrderItem[]) => items.reduce((s, i) => s + i.qty * i.unitCost, 0)
