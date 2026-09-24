/* Land-ownership (title) boundary lookup — HM Land Registry INSPIRE Index Polygons.
 *
 * Built offline by scripts/inspire-build.mjs from the councils' free INSPIRE downloads (OGL) into 1 km
 * tiles at data/inspire/tiles/E_N.json (WGS84 via Ordnance Survey OSTN15). A lookup converts the point to
 * British National Grid, reads its tile (+ neighbours at tile edges), and returns the title polygon that
 * contains the point plus the surrounding titles for context. With no tiles built it reports
 * { configured:false } and the client falls back to the building footprint. */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import proj4 from 'proj4'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TILES = join(ROOT, 'data/inspire/tiles')
const GSB = join(ROOT, 'data/ostn15/OSTN15_NTv2_OSGBtoETRS.gsb')

let toBng = null
function projector() {
  if (toBng) return toBng
  if (existsSync(GSB)) {
    const b = readFileSync(GSB)
    proj4.nadgrid('OSTN15', b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    proj4.defs('BNG', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +nadgrids=OSTN15 +no_defs')
  } else {
    proj4.defs('BNG', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +no_defs')
  }
  toBng = proj4('WGS84', 'BNG')
  return toBng
}

const tileCache = new Map()
function tile(e, n) {
  const k = `${e}_${n}`
  if (tileCache.has(k)) return tileCache.get(k)
  const p = join(TILES, `${k}.json`)
  const v = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []
  if (tileCache.size > 60) tileCache.delete(tileCache.keys().next().value)
  tileCache.set(k, v)
  return v
}

function contains(flat, lat, lng) {
  let inside = false
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const xi = flat[i], yi = flat[i + 1], xj = flat[j], yj = flat[j + 1]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const ring = (flat) => { const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push({ lat: flat[i + 1], lng: flat[i] }); return out }
const areaM2 = (flat, lat) => { let a = 0; const mLng = 111320 * Math.cos((lat * Math.PI) / 180), mLat = 110540; for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) a += (flat[j] * mLng) * (flat[i + 1] * mLat) - (flat[i] * mLng) * (flat[j + 1] * mLat); return Math.abs(a / 2) }

export function parcelConfigured() { return existsSync(TILES) }

/** Title containing (lat,lng) + the nearest `nNear` neighbouring titles. */
export function parcelAt(lat, lng, _src, nNear = 14) {
  if (!existsSync(TILES)) return { configured: false }
  const [e, n] = projector().forward([lng, lat])
  const te = Math.floor(e / 1000), tn = Math.floor(n / 1000)
  const seen = new Set(), cands = []
  for (let de = -1; de <= 1; de++) for (let dn = -1; dn <= 1; dn++) {
    // only look into neighbouring tiles when the point is within 150 m of that edge
    if ((de === -1 && e - te * 1000 > 150) || (de === 1 && (te + 1) * 1000 - e > 150) || (dn === -1 && n - tn * 1000 > 150) || (dn === 1 && (tn + 1) * 1000 - n > 150)) continue
    for (const [id, flat] of tile(te + de, tn + dn)) if (!seen.has(id)) { seen.add(id); cands.push([id, flat]) }
  }
  if (!cands.length) return { configured: true, covered: false, parcel: null, neighbours: [] }
  // several titles can contain a point (e.g. a flat within a building's title) — prefer the smallest
  const hits = cands.filter(([, f]) => contains(f, lat, lng)).map(([id, f]) => ({ id, f, a: areaM2(f, lat) })).sort((x, y) => x.a - y.a)
  const owner = hits[0]
  const near = cands.filter(([id]) => id !== owner?.id).map(([id, f]) => {
    let cx = 0, cy = 0; for (let i = 0; i < f.length; i += 2) { cx += f[i]; cy += f[i + 1] }
    const k = f.length / 2; return { id, f, d: (cx / k - lng) ** 2 + (cy / k - lat) ** 2 }
  }).sort((a, b) => a.d - b.d).slice(0, nNear)
  return {
    configured: true, covered: true, source: 'inspire',
    parcel: owner ? ring(owner.f) : null, titleId: owner?.id ?? null, areaM2: owner ? Math.round(owner.a) : null,
    neighbours: near.map((x) => ring(x.f)),
  }
}
