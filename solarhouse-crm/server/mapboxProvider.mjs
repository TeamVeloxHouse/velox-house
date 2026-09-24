/* Mapbox provider — geocoding (forward / reverse / typeahead) for UK addresses and postcodes.
 * Used as the fallback when Google Geocoding/Places is unavailable (e.g. billing off), and it is
 * free up to 100k requests/month. Needs MAPBOX_TOKEN (a public pk.* token is fine).
 *
 * Licensing note: these are Mapbox "temporary" geocoding results. Mapbox's terms don't allow
 * storing them permanently; storing addresses at scale needs `permanent=true` (a paid option). */

const BASE = 'https://api.mapbox.com/search/geocode/v6'
// Bias results to South Wales / Gloucestershire / Wiltshire, where the business works.
const PROXIMITY = '-2.55,51.7'

async function mb(path, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const r = await fetch(`${BASE}/${path}?${qs}`)
  const j = await r.json()
  if (!r.ok) throw new Error(`mapbox ${r.status} ${j?.message || ''}`)
  return j.features || []
}

/** Place / postcode / address → { lat, lng, formatted }. */
export async function mapboxGeocode(q, token) {
  if (!token) throw new Error('no mapbox token')
  const [f] = await mb('forward', { q, country: 'gb', limit: '1', proximity: PROXIMITY }, token)
  if (!f) throw new Error('mapbox: no match')
  const [lng, lat] = f.geometry.coordinates
  return { lat, lng, formatted: f.properties.full_address }
}

/** Pin → nearest street address + postcode. */
export async function mapboxReverse(lat, lng, token) {
  if (!token) throw new Error('no mapbox token')
  const [f] = await mb('reverse', { latitude: String(lat), longitude: String(lng), types: 'address', limit: '1' }, token)
  if (!f) throw new Error('mapbox: no address')
  const ctx = f.properties.context || {}
  return { formatted: f.properties.full_address, postcode: ctx.postcode?.name }
}

/** Typeahead suggestions in the same { text } shape as the Google Places proxy. */
export async function mapboxSuggest(input, token) {
  if (!token || !input?.trim()) return []
  const fs = await mb('forward', { q: input, country: 'gb', limit: '6', autocomplete: 'true', proximity: PROXIMITY }, token)
  return fs.map((f) => ({ text: f.properties.full_address }))
}
