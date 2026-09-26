/* Product catalogue for the whole-home designer — batteries, EV chargers and cars.
 *
 * Stock list for now (Tony, 2026-09-26: "just put stock batteries in, or the most common brands — we use Duracell
 * and GoodWe"). Figures are TYPICAL DATASHEET values and trade prices are EXAMPLES — every screen that shows them
 * says so. Swap in The Solar House's real price list when it exists; nothing else needs to change. */

export type Coupling = 'dc' | 'ac' // dc = battery on a hybrid inverter with the PV; ac = its own inverter on the AC side
export type BatteryProduct = {
  id: string; brand: string; name: string
  unitKwh: number // nominal kWh per module / unit
  usablePct: number // usable share of nominal (depth of discharge)
  minUnits: number; maxUnits: number
  powerKw: number // continuous charge/discharge the system can do (usually the inverter's limit)
  inverterKw: number // the battery inverter's AC rating — counts towards G98/G99 with the PV
  inverter: string // what it runs on
  coupling: Coupling
  roundTrip: number
  cycles: number // warranted cycles
  warrantyYears: number
  outdoor: boolean // IP65-type, can go outside
  backup: 'none' | 'eps' | 'whole-home' // best backup it offers
  unitCost: number // example trade £ per unit
  systemCost: number // example trade £ for the inverter/gateway + install kit, once
  note?: string
}

export const BATTERIES: BatteryProduct[] = [
  { id: 'duracell-dura5-36', brand: 'Duracell Energy', name: 'Dura5 + Dura-i 3.6 kW hybrid', unitKwh: 5.12, usablePct: 0.9, minUnits: 1, maxUnits: 6, powerKw: 3.6, inverterKw: 3.68, inverter: 'Dura-i G3 3.6 kW hybrid (single phase)', coupling: 'dc', roundTrip: 0.92, cycles: 8000, warrantyYears: 10, outdoor: true, backup: 'eps', unitCost: 1350, systemCost: 1150, note: 'LFP, 1C, IP65, stack up to 6 on one inverter' },
  { id: 'duracell-dura5-5', brand: 'Duracell Energy', name: 'Dura5 + Dura-i 5 kW hybrid', unitKwh: 5.12, usablePct: 0.9, minUnits: 1, maxUnits: 6, powerKw: 5, inverterKw: 5, inverter: 'Dura-i G3 5 kW hybrid (single phase)', coupling: 'dc', roundTrip: 0.92, cycles: 8000, warrantyYears: 10, outdoor: true, backup: 'eps', unitCost: 1350, systemCost: 1350, note: 'As above with the larger inverter — G99 unless export-limited' },
  { id: 'goodwe-lynx-f-eh5', brand: 'GoodWe', name: 'Lynx Home F G2 + EH 5 kW hybrid', unitKwh: 3.2, usablePct: 1, minUnits: 2, maxUnits: 9, powerKw: 5, inverterKw: 5, inverter: 'GoodWe EH 5 kW hybrid (single phase)', coupling: 'dc', roundTrip: 0.93, cycles: 6000, warrantyYears: 10, outdoor: true, backup: 'eps', unitCost: 780, systemCost: 1250, note: 'High-voltage LFP tower, 2–9 × 3.2 kWh modules' },
  { id: 'goodwe-lynx-f-eh36', brand: 'GoodWe', name: 'Lynx Home F G2 + EH 3.6 kW hybrid', unitKwh: 3.2, usablePct: 1, minUnits: 2, maxUnits: 9, powerKw: 3.68, inverterKw: 3.68, inverter: 'GoodWe EH 3.6 kW hybrid (single phase)', coupling: 'dc', roundTrip: 0.93, cycles: 6000, warrantyYears: 10, outdoor: true, backup: 'eps', unitCost: 780, systemCost: 1100 },
  { id: 'givenergy-aio', brand: 'GivEnergy', name: 'All in One 13.5 kWh', unitKwh: 13.5, usablePct: 1, minUnits: 1, maxUnits: 3, powerKw: 6, inverterKw: 6, inverter: 'Built-in 6 kW AC inverter', coupling: 'ac', roundTrip: 0.9, cycles: 7300, warrantyYears: 12, outdoor: true, backup: 'whole-home', unitCost: 5200, systemCost: 450, note: 'AC-coupled — works with any existing PV inverter; whole-home backup needs the Gateway' },
  { id: 'tesla-pw3', brand: 'Tesla', name: 'Powerwall 3', unitKwh: 13.5, usablePct: 1, minUnits: 1, maxUnits: 1, powerKw: 5, inverterKw: 5, inverter: 'Built-in solar hybrid inverter', coupling: 'dc', roundTrip: 0.9, cycles: 4500, warrantyYears: 10, outdoor: true, backup: 'whole-home', unitCost: 6300, systemCost: 700, note: 'Integrated inverter + Gateway 3 for whole-home backup' },
  { id: 'fox-ep11', brand: 'Fox ESS', name: 'EP11 + H1 5 kW hybrid', unitKwh: 10.36, usablePct: 0.9, minUnits: 1, maxUnits: 4, powerKw: 5, inverterKw: 5, inverter: 'Fox H1 5 kW hybrid (single phase)', coupling: 'dc', roundTrip: 0.92, cycles: 6000, warrantyYears: 10, outdoor: true, backup: 'eps', unitCost: 2700, systemCost: 1100, note: 'Integrated heater, IP65' },
]
export const batteryById = (id?: string) => BATTERIES.find((b) => b.id === id) ?? BATTERIES[0]
export const usableKwhOf = (b: BatteryProduct, units: number) => Math.round(b.unitKwh * b.usablePct * units * 10) / 10

export type ChargerProduct = {
  id: string; brand: string; name: string; kw: number
  penBuiltIn: boolean // open-PEN protection built in (no earth rod needed on PME)
  dc6mA: boolean // 6 mA DC leakage detection built in → a Type A RCD is enough
  solarDivert: boolean // can charge from surplus solar only
  loadManagement: boolean // supply CT clamp to stay under the main fuse
  iog: boolean // Intelligent Octopus Go integration
  tethered: 'tethered' | 'untethered' | 'both'
  unitCost: number; note?: string
}
export const CHARGERS: ChargerProduct[] = [
  { id: 'zappi', brand: 'myenergi', name: 'zappi 7 kW', kw: 7.4, penBuiltIn: true, dc6mA: true, solarDivert: true, loadManagement: true, iog: true, tethered: 'both', unitCost: 780, note: 'Eco / Eco+ solar-only modes' },
  { id: 'ohme-home-pro', brand: 'Ohme', name: 'Home Pro', kw: 7.4, penBuiltIn: true, dc6mA: true, solarDivert: false, loadManagement: true, iog: true, tethered: 'tethered', unitCost: 560 },
  { id: 'hypervolt-3', brand: 'Hypervolt', name: 'Home 3 Pro', kw: 7.4, penBuiltIn: true, dc6mA: true, solarDivert: true, loadManagement: true, iog: true, tethered: 'both', unitCost: 620, note: 'Solar mode needs the Hypervolt solar kit' },
  { id: 'easee-one', brand: 'Easee', name: 'One', kw: 7.4, penBuiltIn: false, dc6mA: true, solarDivert: false, loadManagement: true, iog: false, tethered: 'untethered', unitCost: 540, note: 'Needs an earth rod or external PEN device on PME' },
  { id: 'tesla-wc3', brand: 'Tesla', name: 'Wall Connector Gen 3', kw: 7.4, penBuiltIn: false, dc6mA: true, solarDivert: false, loadManagement: true, iog: false, tethered: 'tethered', unitCost: 460, note: 'Needs an earth rod or external PEN device on PME' },
]
export const chargerById = (id?: string) => CHARGERS.find((c) => c.id === id) ?? CHARGERS[0]

export type Vehicle = { id: string; name: string; batteryKwh: number; miPerKwh: number; acKw: number }
export const VEHICLES: Vehicle[] = [
  { id: 'tesla-y', name: 'Tesla Model Y', batteryKwh: 75, miPerKwh: 3.5, acKw: 11 },
  { id: 'tesla-3', name: 'Tesla Model 3', batteryKwh: 60, miPerKwh: 4.1, acKw: 11 },
  { id: 'mg4', name: 'MG4 EV', batteryKwh: 64, miPerKwh: 3.8, acKw: 11 },
  { id: 'kia-ev6', name: 'Kia EV6', batteryKwh: 77, miPerKwh: 3.4, acKw: 11 },
  { id: 'vw-id3', name: 'Volkswagen ID.3', batteryKwh: 58, miPerKwh: 4, acKw: 11 },
  { id: 'kona', name: 'Hyundai Kona Electric', batteryKwh: 64, miPerKwh: 4, acKw: 11 },
  { id: 'atto3', name: 'BYD Atto 3', batteryKwh: 60, miPerKwh: 3.6, acKw: 7 },
  { id: 'leaf', name: 'Nissan Leaf', batteryKwh: 39, miPerKwh: 3.8, acKw: 6.6 },
  { id: 'phev', name: 'Plug-in hybrid (typical)', batteryKwh: 14, miPerKwh: 3, acKw: 3.6 },
  { id: 'generic', name: 'Other electric car', batteryKwh: 60, miPerKwh: 3.5, acKw: 7.4 },
]
export const vehicleById = (id?: string) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[VEHICLES.length - 1]
