/* Electricity tariffs as 48 half-hourly prices (£/kWh), so the simulation can price every slot.
 *
 * Rates are EXAMPLE figures for a typical UK region — the screens say so and let the adviser edit the customer's
 * real rates. Standing charges are left out: they're paid with or without solar/battery/EV, so they don't change
 * any saving. Why this matters: adding a battery or an EV is exactly when people switch tariff, and the tariff is
 * often worth as much as the kit — so the designer models the customer's current tariff AND suggests a better one. */

export type Tariff = {
  id: string; name: string; supplier: string; kind: 'import' | 'export'
  rates: number[] // 48 × £/kWh, slot 0 = 00:00–00:30
  blurb: string
  needs?: { ev?: boolean; battery?: boolean; solar?: boolean; smartCharger?: boolean }
  pairsWith?: string // an export tariff that only comes with this import tariff (and vice versa)
}

/** Build 48 slots from [fromHour, toHour, rate] bands over a base rate. Hours may be fractional (0.5 = 00:30). */
function bands(base: number, spans: [number, number, number][]): number[] {
  const r = new Array(48).fill(base)
  for (const [from, to, rate] of spans) {
    for (let s = 0; s < 48; s++) {
      const h = s / 2
      const inside = from < to ? h >= from && h < to : h >= from || h < to
      if (inside) r[s] = rate
    }
  }
  return r
}

export const TARIFFS: Tariff[] = [
  { id: 'flat', name: 'Standard variable', supplier: 'Any supplier', kind: 'import', rates: bands(0.27, []), blurb: 'One price all day — the price-cap default most homes are on.' },
  { id: 'e7', name: 'Economy 7', supplier: 'Any supplier', kind: 'import', rates: bands(0.31, [[0.5, 7.5, 0.15]]), blurb: 'Seven cheaper night hours, dearer daytime rate.' },
  { id: 'go', name: 'Octopus Go', supplier: 'Octopus', kind: 'import', rates: bands(0.27, [[0.5, 5.5, 0.085]]), blurb: 'Five cheap hours overnight — built for EVs, also fills a battery.', needs: { ev: true } },
  { id: 'iog', name: 'Intelligent Octopus Go', supplier: 'Octopus', kind: 'import', rates: bands(0.27, [[23.5, 5.5, 0.07]]), blurb: 'Six cheap hours; Octopus schedules the car charge. Needs a compatible charger or car.', needs: { ev: true, smartCharger: true } },
  { id: 'flux', name: 'Octopus Flux', supplier: 'Octopus', kind: 'import', rates: bands(0.26, [[2, 5, 0.16], [16, 19, 0.37]]), blurb: 'Cheap 2–5am, pricey 4–7pm — for solar + battery homes that export at the peak.', needs: { battery: true, solar: true }, pairsWith: 'flux-export' },
  { id: 'agile', name: 'Octopus Agile (average day)', supplier: 'Octopus', kind: 'import', rates: [0.17, 0.16, 0.15, 0.14, 0.13, 0.13, 0.12, 0.12, 0.12, 0.12, 0.13, 0.14, 0.17, 0.2, 0.22, 0.22, 0.21, 0.2, 0.19, 0.18, 0.17, 0.16, 0.15, 0.15, 0.15, 0.16, 0.17, 0.18, 0.19, 0.21, 0.24, 0.27, 0.36, 0.38, 0.39, 0.37, 0.28, 0.25, 0.23, 0.22, 0.21, 0.2, 0.2, 0.19, 0.19, 0.18, 0.18, 0.17], blurb: 'Price changes every half hour with the wholesale market — this is a typical day, real days swing more.' },
  { id: 'seg-fixed', name: 'Outgoing Fixed', supplier: 'Octopus', kind: 'export', rates: bands(0.15, []), blurb: 'Flat export price for every kWh sent to the grid.', needs: { solar: true } },
  { id: 'seg-basic', name: 'Basic SEG', supplier: 'Most suppliers', kind: 'export', rates: bands(0.045, []), blurb: 'The minimum Smart Export Guarantee rate many suppliers pay.' },
  { id: 'flux-export', name: 'Flux export', supplier: 'Octopus', kind: 'export', rates: bands(0.14, [[2, 5, 0.07], [16, 19, 0.29]]), blurb: 'Pays most for exports 4–7pm. Only with Flux import.', needs: { battery: true, solar: true }, pairsWith: 'flux' },
  { id: 'agile-out', name: 'Agile Outgoing (average day)', supplier: 'Octopus', kind: 'export', rates: bands(0.1, [[16, 19, 0.22], [10, 15, 0.08]]), blurb: 'Half-hourly export price — highest in the evening peak.', needs: { solar: true } },
  { id: 'none', name: 'No export payment', supplier: '—', kind: 'export', rates: bands(0, []), blurb: 'Not signed up to any export tariff.' },
]
export const tariffById = (id?: string) => TARIFFS.find((t) => t.id === id)
export const importTariffs = TARIFFS.filter((t) => t.kind === 'import')
export const exportTariffs = TARIFFS.filter((t) => t.kind === 'export')
/** Average and cheapest price — used for labels. */
export const tariffSummary = (t: Tariff) => ({ avg: t.rates.reduce((a, b) => a + b, 0) / 48, min: Math.min(...t.rates), max: Math.max(...t.rates) })
export function eligible(t: Tariff, has: { ev: boolean; battery: boolean; solar: boolean; smartCharger: boolean }) {
  const n = t.needs ?? {}
  return (!n.ev || has.ev) && (!n.battery || has.battery) && (!n.solar || has.solar) && (!n.smartCharger || has.smartCharger)
}
