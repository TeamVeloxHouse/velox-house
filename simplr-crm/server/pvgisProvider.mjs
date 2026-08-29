/* PVGIS provider (EU JRC) — free, no key. Used for the single-site page where accuracy matters most.
 *
 * Two calls:
 *   • pvgisHourly()  → 8,760 hourly generation values per 1 kWp (Wh), the real shape that drives the
 *                      hour-by-hour self-consumption simulation, plus the annual specific yield.
 *   • (monthly + yield come free inside the same response totals.)
 *
 * Coordinates + the dominant roof plane's tilt/azimuth make this building-specific. Azimuth uses the
 * PVGIS convention (0 = south, −90 = east, +90 = west), which equals our segment azimuthDeg. */

const BASE = 'https://re.jrc.ec.europa.eu/api/v5_2'

// PVGIS returns leap-year 2020 (8784 h). Collapse Feb 29 so downstream always sees 8760.
function to8760(hourly) {
  const p = hourly.map((r) => r.P) // W == Wh for a 1-hour step, per 1 kWp
  if (p.length === 8784) p.splice(59 * 24, 24) // drop 29 Feb (day index 59, 0-based)
  return p.slice(0, 8760)
}

/** Hourly per-kWp generation (Wh) + annual yield, for a plane at `tilt`°, `azimuth`° (0=S). */
export async function pvgisHourly(lat, lng, tilt = 35, azimuth = 0, lossPct = 14) {
  const url = `${BASE}/seriescalc?lat=${lat}&lon=${lng}&pvcalculation=1&peakpower=1&loss=${lossPct}`
    + `&angle=${Math.max(0, Math.min(90, Math.round(tilt)))}&aspect=${Math.round(azimuth)}`
    + `&pvtechchoice=crystSi&mountingplace=building&startyear=2020&endyear=2020&outputformat=json`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`pvgis series ${r.status}`)
  const j = await r.json()
  const hourly = j?.outputs?.hourly
  if (!Array.isArray(hourly) || !hourly.length) throw new Error('pvgis: no hourly data')
  const perKwpWh = to8760(hourly)
  const annualYield = Math.round(perKwpWh.reduce((a, b) => a + b, 0) / 1000) // kWh/kWp/yr
  return { perKwpWh, annualYield, source: 'pvgis', tilt, azimuth }
}

/** Monthly per-kWp yield (kWh) + annual — cheaper when the hourly shape isn't needed. */
export async function pvgisMonthly(lat, lng, tilt = 35, azimuth = 0, lossPct = 14) {
  const url = `${BASE}/PVcalc?lat=${lat}&lon=${lng}&peakpower=1&loss=${lossPct}`
    + `&angle=${Math.max(0, Math.min(90, Math.round(tilt)))}&aspect=${Math.round(azimuth)}`
    + `&pvtechchoice=crystSi&mountingplace=building&outputformat=json`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`pvgis pvcalc ${r.status}`)
  const j = await r.json()
  const fixed = j?.outputs?.totals?.fixed
  const monthly = (j?.outputs?.monthly?.fixed || []).map((m) => Math.round(m.E_m))
  if (!fixed) throw new Error('pvgis: no totals')
  return { annualYield: Math.round(fixed.E_y), monthly, lossTotalPct: fixed.l_total, source: 'pvgis' }
}
