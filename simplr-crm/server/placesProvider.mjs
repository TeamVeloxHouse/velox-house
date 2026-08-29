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

/** Search commercial sites. Pages through results until `count` is reached (cap 3 pages / ~60). */
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
