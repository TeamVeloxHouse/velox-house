/* Server-side Google Solar API provider.
 * Geocodes an address, calls the Solar API's buildingInsights:findClosest, and maps the
 * result into the RoofAnalysis shape the frontend's designFrom() expects.
 * Runs in Node (Vite dev middleware) and the Cloudflare Pages Function — global `fetch` only.
 *
 * Returns a RoofAnalysis { segments, usableArea, specificYield, maxPanels, panelWatts, source:'google' }
 * or throws (caller falls back to the offline model).
 */

const COMPASS = [
  ['North', 0], ['North-east', 45], ['East', 90], ['South-east', 135],
  ['South', 180], ['South-west', 225], ['West', 270], ['North-west', 315],
]
function aspectLabel(azimuthDeg) {
  const az = ((azimuthDeg % 360) + 360) % 360
  let best = COMPASS[0], bestD = 999
  for (const [name, deg] of COMPASS) {
    const d = Math.min(Math.abs(az - deg), 360 - Math.abs(az - deg))
    if (d < bestD) { bestD = d; best = [name, deg] }
  }
  return best[0]
}
// South-facing → ~1.0, north → ~0.6; blended with pitch.
function irradianceFactor(azimuthDeg, pitchDeg) {
  const az = ((azimuthDeg % 360) + 360) % 360
  const devFromSouth = Math.min(Math.abs(az - 180), 360 - Math.abs(az - 180)) // 0..180
  const azFactor = 1 - (devFromSouth / 180) * 0.4
  const pitchFactor = 1 - Math.abs((pitchDeg || 30) - 35) / 120 // best near 35°
  return Math.max(0.55, Math.min(1, azFactor * pitchFactor))
}

async function geocode(address, key) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const r = await fetch(url)
  const j = await r.json()
  if (j.status !== 'OK' || !j.results?.length) throw new Error(`geocode ${j.status}`)
  const loc = j.results[0].geometry.location
  return { lat: loc.lat, lng: loc.lng, formatted: j.results[0].formatted_address }
}

async function buildingInsights(lat, lng, key) {
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${key}`
  const r = await fetch(url)
  const j = await r.json()
  if (!r.ok || !j.solarPotential) throw new Error(`solar ${r.status} ${j?.error?.status || ''}`)
  return j.solarPotential
}

export async function googleSolarAnalysis(address, key) {
  if (!key) throw new Error('no key')
  const { lat, lng } = await geocode(address, key)
  const sp = await buildingInsights(lat, lng, key)

  const panelWatts = Math.round(sp.panelCapacityWatts || 400)
  const maxPanels = sp.maxArrayPanelsCount || 0
  if (!maxPanels) throw new Error('no panels')

  // specific yield (kWh/kWp/yr) from the largest panel config
  const configs = sp.solarPanelConfigs || []
  const top = configs.length ? configs[configs.length - 1] : null
  let specificYield = 1000
  if (top && top.panelsCount) {
    specificYield = Math.round(top.yearlyEnergyDcKwh / ((top.panelsCount * panelWatts) / 1000))
  } else if (sp.maxArrayAreaMeters2 && maxPanels) {
    specificYield = Math.round((sp.wholeRoofStats?.sunshineQuantiles?.[5] || 1000) * 0.15)
  }

  const rs = sp.roofSegmentStats || []
  const totalArea = rs.reduce((a, s) => a + (s.stats?.areaMeters2 || 0), 0) || 1
  let assigned = 0
  const segments = rs
    .map((s, i) => {
      const area = s.stats?.areaMeters2 || 0
      const share = area / totalArea
      const segMax = Math.round(maxPanels * share)
      assigned += segMax
      return {
        id: `s${i}`,
        label: `${aspectLabel(s.azimuthDegrees)}-facing plane`,
        azimuth: aspectLabel(s.azimuthDegrees),
        pitch: Math.round(s.pitchDegrees || 30),
        maxPanels: segMax,
        irradiance: irradianceFactor(s.azimuthDegrees, s.pitchDegrees),
      }
    })
    .filter((s) => s.maxPanels > 0)
    .sort((a, b) => b.irradiance - a.irradiance)
    .slice(0, 4)

  // ensure segment panels reconcile to maxPanels
  if (segments.length && assigned !== maxPanels) segments[0].maxPanels += maxPanels - assigned
  if (!segments.length) throw new Error('no usable segments')

  const usableArea = Math.round(sp.maxArrayAreaMeters2 || totalArea)
  return { segments, usableArea, specificYield, maxPanels, panelWatts, source: 'google' }
}
