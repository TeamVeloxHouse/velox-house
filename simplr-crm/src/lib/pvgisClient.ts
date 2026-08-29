/* Client helper for the PVGIS hourly profile (single-site accurate mode).
 * Feeds `hourlyGenPerKwp` into computeCommercial() so savings come from the 8,760-hour simulation. */

export type PvgisProfile = { perKwpWh: number[]; annualYield: number; source: 'pvgis'; tilt: number; azimuth: number }

/** Fetch the per-kWp hourly generation profile for a roof plane. Returns null if PVGIS is unreachable
 *  (the calculator then falls back to the coefficient method — still fully functional). */
export async function fetchPvgisHourly(lat: number, lng: number, tilt = 35, azimuth = 0): Promise<PvgisProfile | null> {
  try {
    const r = await fetch('/api/pvgis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng, tilt, azimuth }),
    })
    if (r.ok) {
      const j = await r.json()
      if (j && !j.fallback && Array.isArray(j.perKwpWh) && j.perKwpWh.length) return j as PvgisProfile
    }
  } catch {
    /* PVGIS down / offline — caller falls back to the coefficient method */
  }
  return null
}
