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

export async function geocode(address, key) {
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

/** Every roof segment Google measured for the building at (lat,lng) — pitch, compass azimuth, area, centre, box.
 *  Independent of our own pane detection, so it's used as a cross-check (roof QA). */
export async function roofSegmentsAt(lat, lng, key) {
  const sp = await buildingInsights(lat, lng, key)
  return (sp.roofSegmentStats || []).map((s) => ({
    pitchDeg: s.pitchDegrees ?? 0, azimuthDeg: s.azimuthDegrees ?? 0, areaM2: s.stats?.areaMeters2 ?? 0, groundAreaM2: s.stats?.groundAreaMeters2 ?? 0,
    center: s.center ? { lat: s.center.latitude, lng: s.center.longitude } : null, heightM: s.planeHeightAtCenterMeters ?? null,
    box: s.boundingBox ? { sw: { lat: s.boundingBox.sw.latitude, lng: s.boundingBox.sw.longitude }, ne: { lat: s.boundingBox.ne.latitude, lng: s.boundingBox.ne.longitude } } : null,
  }))
}

/** Measure a roof directly from coordinates — skips geocoding. Preferred when the caller already
 *  has a precise building centre (e.g. from Places), which is more accurate for large sites than
 *  geocoding a company name (that often lands on the office/gate, not the main roof). */
export async function googleSolarAnalysisAt(lat, lng, key) {
  if (!key) throw new Error('no key')
  const sp = await buildingInsights(lat, lng, key)
  return mapAnalysis(sp, lat, lng)
}

export async function googleSolarAnalysis(address, key) {
  if (!key) throw new Error('no key')
  const { lat, lng } = await geocode(address, key)
  return googleSolarAnalysisAt(lat, lng, key)
}

/** Solar API Data Layers — GeoTIFF URLs for DSM (roof heightfield), RGB aerial, mask, and annual
 *  solar flux (irradiance/shading). Each returned URL needs the key appended to download. */
export async function solarDataLayers(lat, lng, key, { radiusMeters = 40, pixelSizeMeters = 0.25 } = {}) {
  if (!key) throw new Error('no key')
  const url = `https://solar.googleapis.com/v1/dataLayers:get?location.latitude=${lat}&location.longitude=${lng}&radiusMeters=${radiusMeters}&view=FULL_LAYERS&requiredQuality=HIGH&pixelSizeMeters=${pixelSizeMeters}&exactQualityRequired=false&key=${key}`
  const r = await fetch(url)
  const j = await r.json()
  if (!r.ok || (!j.dsmUrl && !j.rgbUrl)) throw new Error(`dataLayers ${r.status} ${j?.error?.status || ''}`)
  return { imageryDate: j.imageryDate, imageryQuality: j.imageryQuality, dsmUrl: j.dsmUrl, rgbUrl: j.rgbUrl, maskUrl: j.maskUrl, annualFluxUrl: j.annualFluxUrl, monthlyFluxUrl: j.monthlyFluxUrl }
}

/** Fetch one data-layer GeoTIFF/PNG by kind, streaming the raw bytes (keeps the key server-side). */
export async function solarLayerBytes(lat, lng, kind, key, opts) {
  const layers = await solarDataLayers(lat, lng, key, opts)
  const map = { dsm: layers.dsmUrl, rgb: layers.rgbUrl, mask: layers.maskUrl, flux: layers.annualFluxUrl }
  const u = map[kind]
  if (!u) throw new Error(`no ${kind} layer`)
  const r = await fetch(`${u}&key=${key}`)
  if (!r.ok) throw new Error(`${kind} ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  return { buf, contentType: r.headers.get('content-type') || 'image/tiff' }
}

function mapAnalysis(sp, lat, lng) {
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
      const bb = s.boundingBox
      const box = bb && bb.sw && bb.ne
        ? { sw: { lat: bb.sw.latitude, lng: bb.sw.longitude }, ne: { lat: bb.ne.latitude, lng: bb.ne.longitude } }
        : undefined
      // Google azimuth is degrees from north; convert to model convention (0 = due south).
      const azDeg = ((((s.azimuthDegrees || 180) - 180) % 360) + 360) % 360
      return {
        id: `s${i}`,
        label: `${aspectLabel(s.azimuthDegrees)}-facing plane`,
        azimuth: aspectLabel(s.azimuthDegrees),
        pitch: Math.round(s.pitchDegrees || 30),
        maxPanels: segMax,
        irradiance: irradianceFactor(s.azimuthDegrees, s.pitchDegrees),
        azimuthDeg: azDeg > 180 ? azDeg - 360 : azDeg,
        box,
      }
    })
    .filter((s) => s.maxPanels > 0)
    .sort((a, b) => b.irradiance - a.irradiance)
    .slice(0, 4)

  // ensure segment panels reconcile to maxPanels
  if (segments.length && assigned !== maxPanels) segments[0].maxPanels += maxPanels - assigned
  if (!segments.length) throw new Error('no usable segments')

  // ALL roof segments with Google's reliable per-plane geometry (pitch, azimuth-from-north, centre,
  // plane height, box) — un-sliced. The design studio uses these as priors so the DSM segmentation
  // snaps pixels to Google's true plane orientations instead of rediscovering them from noise.
  const planes = rs
    .map((s) => {
      const bb = s.boundingBox
      const box = bb && bb.sw && bb.ne
        ? { sw: { lat: bb.sw.latitude, lng: bb.sw.longitude }, ne: { lat: bb.ne.latitude, lng: bb.ne.longitude } }
        : undefined
      return {
        pitchDeg: Math.round(s.pitchDegrees || 30),
        azimuthDeg: Math.round((((s.azimuthDegrees ?? 180) % 360) + 360) % 360), // from NORTH (0=N,180=S)
        areaM2: Math.round(s.stats?.areaMeters2 || 0),
        center: s.center ? { lat: s.center.latitude, lng: s.center.longitude } : undefined,
        heightM: typeof s.planeHeightAtCenterMeters === 'number' ? s.planeHeightAtCenterMeters : undefined,
        box,
      }
    })
    .filter((p) => p.areaM2 > 2)

  const usableArea = Math.round(sp.maxArrayAreaMeters2 || totalArea)
  const center = sp.center ? { lat: sp.center.latitude, lng: sp.center.longitude } : { lat, lng }
  return { segments, usableArea, specificYield, maxPanels, panelWatts, source: 'google', center, planes }
}
