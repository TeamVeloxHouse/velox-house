/* Google Static Maps (satellite) proxy for /api/roof-image — keeps the key server-side.
 * The Design Studio requests a top-down satellite tile centred on the building so panels can be
 * placed on the real roof. Uses GOOGLE_MAPS_API_KEY (Static Maps API enabled). */

export async function staticSatellite(lat, lng, zoom, size, key) {
  const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=2&maptype=satellite&key=${key}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`staticmap ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  return { buf, contentType: r.headers.get('content-type') || 'image/png' }
}
