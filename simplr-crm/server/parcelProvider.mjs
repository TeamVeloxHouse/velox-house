/* Land-ownership (parcel) boundary lookup — HM Land Registry INSPIRE Index Polygons.
 *
 * INSPIRE has no free live point-API: it's published as bulk GML per local authority under the OGL.
 * To wire real boundaries, convert a council's INSPIRE polygons to a single WGS84 GeoJSON
 * FeatureCollection (EPSG:4326, [lng,lat]) and point INSPIRE_PARCELS at the file (or a directory of
 * them). This endpoint then returns the parcel whose polygon contains the query point, plus nearby
 * parcels for context. With nothing configured it reports { configured:false } and the client falls
 * back to the (real) building footprint so the feature still shows something useful. */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let cache = null // { features: [...] }
function loadAll(src) {
  if (cache) return cache
  if (!src || !existsSync(src)) return null
  const files = []
  try {
    const stat = readdirSync(src, { withFileTypes: true })
    for (const d of stat) if (d.isFile() && d.name.endsWith('.geojson')) files.push(join(src, d.name))
  } catch { files.push(src) } // src is a single file, not a dir
  const features = []
  for (const f of files.length ? files : [src]) {
    try { const gj = JSON.parse(readFileSync(f, 'utf8')); if (gj.type === 'FeatureCollection') features.push(...gj.features); else if (gj.type === 'Feature') features.push(gj) } catch { /* skip bad file */ }
  }
  cache = { features }
  return cache
}

function ringContains(ring, lat, lng) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j] // [lng,lat]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const polysOf = (geom) => geom?.type === 'Polygon' ? [geom.coordinates] : geom?.type === 'MultiPolygon' ? geom.coordinates : []
const centroidOf = (ring) => { let x = 0, y = 0; for (const [lng, lat] of ring) { x += lng; y += lat }; return { lng: x / ring.length, lat: y / ring.length } }
const ringLL = (poly) => poly[0].map(([lng, lat]) => ({ lat, lng }))

/** Parcel containing (lat,lng) + up to `nNear` nearby parcels (for the surrounding plot context). */
export function parcelAt(lat, lng, src, nNear = 12) {
  const data = loadAll(src)
  if (!data) return { configured: false }
  let owner = null
  const near = []
  for (const f of data.features) {
    for (const poly of polysOf(f.geometry)) {
      const c = centroidOf(poly[0])
      const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2
      if (ringContains(poly[0], lat, lng)) owner = ringLL(poly)
      near.push({ d, ring: ringLL(poly) })
    }
  }
  near.sort((a, b) => a.d - b.d)
  return { configured: true, parcel: owner, source: 'inspire', neighbours: near.slice(0, nNear).map((n) => n.ring) }
}
