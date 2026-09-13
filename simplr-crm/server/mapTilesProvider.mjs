/* Google Map Tiles API (2D satellite) — high-res aerial base map, same imagery family Pylon uses.
 * We keep the key server-side and proxy each tile: mint a session token (cached ~2 weeks per Google),
 * then stream the tile bytes. If the Map Tiles API isn't enabled on the key, createSession fails and
 * the caller 404s so the client falls back to the Esri base layer. */

let session = null // { token, expiryMs }

async function getSession(key) {
  const now = Date.now()
  if (session && session.expiryMs - now > 60_000) return session.token
  const r = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapType: 'satellite', language: 'en-GB', region: 'GB', highDpi: false }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.session) throw new Error(`createSession ${r.status} ${j?.error?.message || j?.error?.status || ''}`)
  // `expiry` is a unix-seconds string; refresh a little early.
  const expiryMs = j.expiry ? Number(j.expiry) * 1000 : now + 6 * 3600_000
  session = { token: j.session, expiryMs }
  return session.token
}

/** Fetch one 2D satellite tile. Throws if the key/API can't serve it (→ caller 404s → client uses Esri). */
export async function mapTileBytes(z, x, y, key) {
  const token = await getSession(key)
  const url = `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${token}&key=${key}`
  const r = await fetch(url)
  if (!r.ok) {
    // A stale session returns 4xx — drop it so the next call re-mints.
    if (r.status === 401 || r.status === 403 || r.status === 404) session = null
    throw new Error(`tile ${z}/${x}/${y} → ${r.status}`)
  }
  const buf = Buffer.from(await r.arrayBuffer())
  return { buf, contentType: r.headers.get('content-type') || 'image/jpeg' }
}
