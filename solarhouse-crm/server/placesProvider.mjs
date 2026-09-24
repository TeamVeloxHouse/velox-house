/* Server-side Google Places (v1 Text Search) provider for /api/places.
 * Turns "warehouses in the West Midlands" into real buildings the Commercial Solar Engine can
 * measure: name, address, coordinates, and — crucially — the website domain that lets PDL find the
 * RIGHT people at that exact company. Keeps GOOGLE_MAPS_API_KEY server-side.
 *
 * Returns DiscoveredBuilding[] { name, address, domain, center:{lat,lng}, category } or [] (caller
 * falls back to an empty result and reports "no building source configured"). */

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const FIELDS = 'places.displayName,places.formattedAddress,places.location,places.websiteUri,places.primaryTypeDisplayName,places.types,nextPageToken'

function domainOf(websiteUri) {
  if (!websiteUri) return undefined
  try {
    return new URL(websiteUri).hostname.replace(/^www\./, '') || undefined
  } catch {
    return undefined
  }
}

function mapPlace(p) {
  return {
    name: p.displayName?.text || 'Unknown site',
    address: p.formattedAddress || '',
    domain: domainOf(p.websiteUri),
    center: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined,
    category: p.primaryTypeDisplayName?.text || (Array.isArray(p.types) ? p.types[0] : undefined),
  }
}

/** Address/place autocomplete — Google-Maps-style typeahead. Returns [{text, placeId}]. */
export async function placesAutocomplete(input, key) {
  if (!key || !input || input.length < 2) return []
  const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
    body: JSON.stringify({ input, regionCode: 'GB', includedRegionCodes: ['GB'] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`autocomplete ${j?.error?.status || r.status}`)
  return (j.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({ text: p.text?.text || '', placeId: p.placeId }))
}

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000, p = (d) => (d * Math.PI) / 180
  const dLat = p(bLat - aLat), dLng = p(bLng - aLng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(p(aLat)) * Math.cos(p(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// Broad net of commercial-site queries — running several and deduping scans an area densely
// (Places has no single "all industrial buildings" query). Narrowed when the caller names an industry.
const SCAN_QUERIES = ['warehouses', 'industrial units', 'factories', 'distribution centres', 'trade counters', 'business park units', 'commercial premises']

/**
 * Drop-a-pin radius scan: every business within `radius` metres of (lat,lng). Runs one or more text
 * queries biased to the circle, dedupes, and haversine-filters to the exact radius so the result is
 * genuinely "the businesses inside your circle" — the geographic targeting Tony wants.
 */
export async function placesRadiusScan({ lat, lng, radius = 2000, industry, count = 60 }, key) {
  if (!key) throw new Error('no key')
  const queries = industry ? [industry, `${industry} units`] : SCAN_QUERIES
  const seen = new Map() // key: name|rounded-latlng → building
  for (const q of queries) {
    if (seen.size >= count * 2) break
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({ textQuery: q, maxResultCount: 20, regionCode: 'GB', locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radius, 50000) } } }),
    })
    const j = await r.json()
    if (!r.ok) { if (j?.error?.status === 'PERMISSION_DENIED') throw new Error(`places ${j.error.status}`); continue }
    for (const p of j.places || []) {
      const loc = p.location
      if (!loc) continue
      const dist = haversine(lat, lng, loc.latitude, loc.longitude)
      if (dist > radius) continue // strict radius
      const b = mapPlace(p)
      const id = `${b.name}|${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`
      if (!seen.has(id)) seen.set(id, { ...b, distanceM: Math.round(dist) })
    }
  }
  return [...seen.values()].sort((a, b) => a.distanceM - b.distanceM).slice(0, count)
}

/** Search commercial sites by area name. Pages through results until `count` is reached (cap 3 pages / ~60). */
export async function placesSearch({ area, industry, count = 20 }, key) {
  if (!key) throw new Error('no key')
  const query = `${industry || 'commercial buildings'} in ${area}`.trim()
  const want = Math.min(Math.max(count, 1), 60)

  const out = []
  let pageToken
  for (let page = 0; page < 3 && out.length < want; page++) {
    const body = { textQuery: query, maxResultCount: 20, regionCode: 'GB' }
    if (pageToken) body.pageToken = pageToken
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify(body),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(`places ${r.status} ${j?.error?.status || ''}`)
    for (const p of j.places || []) out.push(mapPlace(p))
    pageToken = j.nextPageToken
    if (!pageToken) break
    // Google requires a short delay before a page token becomes valid.
    await new Promise((res) => setTimeout(res, 1600))
  }
  return out.slice(0, want)
}
