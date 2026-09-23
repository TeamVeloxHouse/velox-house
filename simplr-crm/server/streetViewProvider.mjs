/* Google Street View Static image proxy for /api/street-view — keeps the key server-side.
 * Used by the proposal "showroom mockup": a real photo of the front of the house, which the
 * client then composites a stylised solar-panel overlay onto. Reuses GOOGLE_MAPS_API_KEY —
 * enable the "Street View Static API" on that key (same Maps Platform project as Solar/Geocoding). */

export async function staticStreetView(lat, lng, heading, size, key) {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    size: size || '640x400',
    fov: '80',
    pitch: '5',
    source: 'outdoor',
    key,
  })
  if (heading !== undefined && heading !== null && heading !== '') params.set('heading', String(heading))
  // Google's image endpoint returns a 200 with a small grey "no imagery" placeholder rather than
  // an error — check the metadata endpoint first so the client can fall back honestly.
  const meta = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`).then((m) => m.json()).catch(() => null)
  if (meta && meta.status && meta.status !== 'OK') throw new Error(`streetview metadata ${meta.status}`)
  const r = await fetch(`https://maps.googleapis.com/maps/api/streetview?${params.toString()}`)
  if (!r.ok) throw new Error(`streetview ${r.status}`)
  const contentType = r.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await r.arrayBuffer())
  return { buf, contentType }
}
