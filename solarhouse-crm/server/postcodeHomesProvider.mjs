/* Postcode → every home in it, for the "pick the house" step.
 *
 * No free UK source lists the addresses in a postcode (Royal Mail PAF is licensed), so we build the
 * list from the buildings themselves:
 *   1. postcodes.io (free, no key) → the postcode's centre + a sanity check that it exists
 *   2. OpenStreetMap buildings within ~160 m of it (the footprint doubles as the roof outline later)
 *   3. an address per building: OSM's own addr:* tags when present, else a reverse geocode of the
 *      building's centre (Google, falling back to Mapbox)
 *   4. keep only the buildings whose address is IN the searched postcode, one per address
 * Every home comes back with its building centre, so picking one pins the design on that exact roof. */

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const UA = { 'User-Agent': 'SolarHouseCRM/1.0 (+https://thesolarhouse.co.uk)', 'Content-Type': 'application/x-www-form-urlencoded' } // overpass-api.de answers 406 to anonymous clients
const norm = (pc) => String(pc || '').toUpperCase().replace(/\s+/g, '')
export const isFullPostcode = (s) => /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(String(s || '').trim())

async function postcodeCentre(pc) {
  const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`)
  if (!r.ok) return null
  const j = await r.json()
  return j.result ? { lat: j.result.latitude, lng: j.result.longitude, postcode: j.result.postcode, district: j.result.admin_district } : null
}

const cache = new Map() // postcode → result, 1 h (Overpass rate-limits bursts)
const bCache = new Map() // rounded point → buildings, 30 min
export async function buildingsAround(lat, lng, radius) {
  const ck = `${(+lat).toFixed(4)},${(+lng).toFixed(4)},${radius}`, hit = bCache.get(ck)
  if (hit && Date.now() - hit.at < 1800e3) return hit.v
  const q = `[out:json][timeout:20];way["building"](around:${radius},${lat},${lng});out tags geom;`
  for (const url of [...OVERPASS, OVERPASS[0]]) { // busy (429) → next mirror, then the main one once more
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000) // a slow mirror is a busy mirror — move on
      const r = await fetch(url, { method: 'POST', headers: UA, body: `data=${encodeURIComponent(q)}`, signal: ctrl.signal })
      clearTimeout(t)
      if (!r.ok) { if (r.status === 429) await new Promise((ok) => setTimeout(ok, 1500)); continue }
      const j = await r.json()
      const v = (j.elements || []).filter((e) => e.type === 'way' && e.geometry?.length >= 4)
      bCache.set(ck, { at: Date.now(), v }); if (bCache.size > 300) bCache.delete(bCache.keys().next().value)
      return v
    } catch { /* next mirror */ }
  }
  return []
}

const areaM2 = (g, lat) => { const mx = 111320 * Math.cos((lat * Math.PI) / 180), my = 110540; let a = 0; for (let i = 0, j = g.length - 1; i < g.length; j = i++) a += (g[j].lon * mx + g[i].lon * mx) * (g[j].lat * my - g[i].lat * my); return Math.abs(a / 2) }
const NON_HOME = /^(garage|garages|shed|carport|roof|hut|greenhouse|service|transformer_tower|kiosk)$/

/** reverse(lat,lng) → { formatted, postcode } | throws. */
export async function postcodeHomes(pcRaw, reverse) {
  if (!isFullPostcode(pcRaw)) return { ok: false, reason: 'Enter a full postcode, e.g. CF14 2AA' }
  const pc = await postcodeCentre(norm(pcRaw))
  if (!pc) return { ok: false, reason: 'Postcode not found' }
  const want = norm(pc.postcode)
  const hit = cache.get(want); if (hit && Date.now() - hit.at < 3600e3) return hit.v
  let els = await buildingsAround(pc.lat, pc.lng, 160)
  const cands = els
    .filter((e) => !NON_HOME.test(e.tags?.building || ''))
    .map((e) => {
      const g = e.geometry, n = g.length - 1
      const c = { lat: g.slice(0, n).reduce((s, p) => s + p.lat, 0) / n, lng: g.slice(0, n).reduce((s, p) => s + p.lon, 0) / n }
      return { id: `osm${e.id}`, tags: e.tags || {}, center: c, m2: areaM2(g, c.lat), footprint: g.map((p) => ({ lat: p.lat, lng: p.lon })), d: (c.lat - pc.lat) ** 2 + ((c.lng - pc.lng) * 0.62) ** 2 }
    })
    .filter((b) => b.m2 >= 25 && b.m2 <= 3000)
    .sort((a, b) => a.d - b.d)
    .slice(0, 70)

  const homes = []
  const seen = new Set()
  const queue = [...cands]
  async function worker() {
    while (queue.length) {
      const b = queue.shift()
      const t = b.tags
      let label = null, postcode = null, source = 'osm'
      if (t['addr:postcode'] && (t['addr:housenumber'] || t['addr:housename']) && t['addr:street']) {
        postcode = t['addr:postcode']
        label = `${t['addr:housenumber'] || t['addr:housename']} ${t['addr:street']}`
      } else {
        try { const r = await reverse(b.center.lat, b.center.lng); postcode = r.postcode; label = (r.formatted || '').split(',')[0]; source = 'geocode' } catch { continue }
      }
      if (!label || norm(postcode) !== want) continue
      const key = label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const m = label.match(/^(\d+[A-Z]?|[^,\d]+?)\s+(.*)$/i)
      homes.push({ id: b.id, label, number: m ? m[1] : label, street: m ? m[2] : '', address: `${label}, ${pc.district ? pc.district + ', ' : ''}${pc.postcode}`, center: b.center, footprint: b.footprint, areaM2: Math.round(b.m2), source })
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  const num = (s) => { const m = String(s).match(/\d+/); return m ? +m[0] : 1e9 }
  homes.sort((a, b) => a.street.localeCompare(b.street) || num(a.number) - num(b.number) || a.number.localeCompare(b.number))
  const v = { ok: true, postcode: pc.postcode, center: { lat: pc.lat, lng: pc.lng }, district: pc.district, homes, scanned: cands.length }
  if (homes.length) cache.set(want, { at: Date.now(), v })
  return v
}
