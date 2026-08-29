/* Industry electricity load profiles — the demand side of the self-consumption simulation.
 *
 * Solar only saves money on the kWh a business uses AT THE MOMENT it's generated; the rest exports
 * at the low SEG rate. So accuracy hinges on how well midday generation lines up with the site's
 * actual load. A single "daytime match %" is a fudge; this builds a real 8,760-hour demand shape per
 * industry (operating hours, weekday/weekend, night base load, seasonality) and the calculator runs
 * generation against it hour by hour.
 *
 * Profiles are normalised shapes scaled to the site's annual kWh — synthetic but shaped on how each
 * building type actually runs (a 24/7 cold store vs a 9–5 office), and every field is overridable.
 */

import type { IndustryKey } from './commercialModel'

type LoadModel = {
  open: number // hour the operating day starts (local)
  close: number // hour it ends
  weekend: number // weekend load as a fraction of a weekday (1 = same, 0.1 = near-closed)
  nightBase: number // out-of-hours load as a fraction of the operating peak (24/7 plant is high)
  winterBoost: number // Dec–Feb multiplier (heating/lighting) vs summer
  ramp: number // hours to ramp up/down at open/close (softens the edges)
}

// Tuned per building type. These drive coincidence with the solar day, so the shape matters more
// than the absolute level (which is normalised out).
const LOAD_MODELS: Record<IndustryKey, LoadModel> = {
  warehouse: { open: 6, close: 20, weekend: 0.3, nightBase: 0.12, winterBoost: 1.12, ramp: 1.5 },
  cold_storage: { open: 0, close: 24, weekend: 0.92, nightBase: 0.82, winterBoost: 0.85, ramp: 0 },
  manufacturing: { open: 6, close: 18, weekend: 0.15, nightBase: 0.16, winterBoost: 1.1, ramp: 1 },
  light_industrial: { open: 7, close: 18, weekend: 0.2, nightBase: 0.12, winterBoost: 1.12, ramp: 1 },
  office: { open: 8, close: 18, weekend: 0.08, nightBase: 0.08, winterBoost: 1.15, ramp: 1 },
  retail: { open: 8, close: 20, weekend: 0.9, nightBase: 0.1, winterBoost: 1.2, ramp: 1 },
  supermarket: { open: 7, close: 22, weekend: 0.95, nightBase: 0.32, winterBoost: 1.02, ramp: 1 },
  hotel: { open: 6, close: 24, weekend: 1.0, nightBase: 0.4, winterBoost: 1.15, ramp: 1.5 },
  leisure: { open: 6, close: 22, weekend: 0.95, nightBase: 0.15, winterBoost: 1.1, ramp: 1 },
  school: { open: 8, close: 16, weekend: 0.08, nightBase: 0.08, winterBoost: 1.2, ramp: 1 },
  hospital: { open: 0, close: 24, weekend: 0.95, nightBase: 0.7, winterBoost: 1.1, ramp: 0 },
  car_dealership: { open: 8, close: 18, weekend: 0.7, nightBase: 0.1, winterBoost: 1.15, ramp: 1 },
  data_centre: { open: 0, close: 24, weekend: 1.0, nightBase: 0.95, winterBoost: 0.95, ramp: 0 },
  other: { open: 7, close: 19, weekend: 0.35, nightBase: 0.15, winterBoost: 1.12, ramp: 1 },
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
// Seasonal weight per month (1 = summer baseline); winterBoost applied to Dec–Feb, tapered spring/autumn.
const MONTH_SEASON = [1.0, 0.95, 0.85, 0.75, 0.7, 0.7, 0.72, 0.75, 0.82, 0.9, 0.98, 1.0] // relative "winter-ness"

// Smooth operating-hours weight for a given hour, with soft ramps at open/close.
function hourWeight(h: number, m: LoadModel): number {
  if (m.open === 0 && m.close === 24) return 1 // 24/7
  const inDay = h >= m.open && h < m.close
  if (inDay) {
    // ramp up after open, ramp down before close
    const up = m.ramp > 0 ? Math.min(1, (h - m.open + 0.5) / m.ramp) : 1
    const down = m.ramp > 0 ? Math.min(1, (m.close - h - 0.5) / m.ramp) : 1
    return m.nightBase + (1 - m.nightBase) * Math.max(0, Math.min(up, down))
  }
  return m.nightBase
}

/**
 * Build an 8,760-hour demand array (kWh) for a site, shaped by its industry and scaled to `annualKwh`.
 * Hour 0 is 1 Jan 00:00; the year starts on a Wednesday (2020) to match the PVGIS series alignment.
 */
export function buildHourlyLoad(annualKwh: number, industry: IndustryKey): number[] {
  const m = LOAD_MODELS[industry] || LOAD_MODELS.other
  const weights = new Array(8760)
  let dow = 2 // 2020-01-01 was a Wednesday (0=Mon … 6=Sun)
  let idx = 0
  let total = 0
  for (let mo = 0; mo < 12; mo++) {
    const winter = 1 + (m.winterBoost - 1) * MONTH_SEASON[mo]
    for (let d = 0; d < DAYS_IN_MONTH[mo]; d++) {
      const isWeekend = dow >= 5
      const dayScale = (isWeekend ? m.weekend : 1) * winter
      for (let h = 0; h < 24; h++) {
        const w = hourWeight(h, m) * dayScale
        weights[idx++] = w
        total += w
      }
      dow = (dow + 1) % 7
    }
  }
  // Normalise to annual kWh.
  const k = total > 0 ? annualKwh / total : 0
  for (let i = 0; i < 8760; i++) weights[i] *= k
  return weights
}

/** Day-shape (0–23) for charts: average weekday load for a month, normalised so peak = 1. */
export function representativeDay(industry: IndustryKey, month = 6): number[] {
  const m = LOAD_MODELS[industry] || LOAD_MODELS.other
  const winter = 1 + (m.winterBoost - 1) * MONTH_SEASON[month - 1]
  const day = Array.from({ length: 24 }, (_, h) => hourWeight(h, m) * winter)
  const peak = Math.max(...day, 1e-9)
  return day.map((v) => v / peak)
}
