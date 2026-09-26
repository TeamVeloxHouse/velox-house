/* Build the local building store from Geofabrik OpenStreetMap extracts — instant footprints, no Overpass.
 *
 *   node scripts/osm-build.mjs                  (reads every data/osm/*.osm.pbf)
 *
 * Keeps every building within CATCHMENT_KM of a showroom, as 0.01° tiles in data/osm/tiles/<latKey>_<lngKey>.json:
 *   [[osmId, [lat,lng, lat,lng, …], { b, hn, hname, st, pc, h, lv }], …]
 * Two streaming passes per file so memory stays small: pass 1 collects building ways and the node ids they use,
 * pass 2 picks those nodes' coordinates. Re-run after downloading fresher extracts (Geofabrik updates daily). */
import { createReadStream, readdirSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const parseOSM = require('osm-pbf-parser')
import { Writable } from 'node:stream'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'data/osm'), TILES = join(DIR, 'tiles')
export const CATCHMENTS = [
  { id: 'cardiff', lat: 51.51364, lng: -3.22066 },
  { id: 'cheltenham', lat: 51.896348, lng: -2.081946 },
  { id: 'melksham', lat: 51.380462, lng: -2.142861 },
]
const CATCHMENT_KM = 30
const km = (a, b) => { const R = 6371, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }
const inCatchment = (p) => CATCHMENTS.some((c) => km(c, p) <= CATCHMENT_KM)

function pass(file, onItem) {
  return new Promise((ok, bad) => {
    createReadStream(file).pipe(parseOSM()).pipe(new Writable({ objectMode: true, write(items, _e, next) { for (const it of items) onItem(it); next() } }))
      .on('finish', ok).on('error', bad)
  })
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.osm.pbf'))
if (!files.length) { console.error('No .osm.pbf files in data/osm'); process.exit(1) }
if (existsSync(TILES)) rmSync(TILES, { recursive: true })
mkdirSync(TILES, { recursive: true })
const tiles = new Map()
let total = 0

for (const f of files) {
  const path = join(DIR, f), t0 = Date.now()
  // pass 1 — building ways
  const ways = [], refs = []
  await pass(path, (it) => {
    if (it.type !== 'way' || !it.tags?.building || it.tags.building === 'no' || it.refs.length < 4) return
    const t = it.tags
    ways.push({ id: +it.id, start: refs.length, n: it.refs.length, tags: { b: t.building, hn: t['addr:housenumber'], hname: t['addr:housename'], st: t['addr:street'], pc: t['addr:postcode'], h: t.height, lv: t['building:levels'], roof: t['roof:shape'] } })
    for (const r of it.refs) refs.push(+r)
  })
  const need = Float64Array.from(new Set(refs)).sort()
  console.log(`${f}: ${ways.length.toLocaleString()} buildings, ${need.length.toLocaleString()} nodes (pass 1 ${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  // pass 2 — the coordinates of just those nodes
  const lat = new Float64Array(need.length).fill(NaN), lng = new Float64Array(need.length).fill(NaN)
  const find = (id) => { let lo = 0, hi = need.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (need[m] === id) return m; if (need[m] < id) lo = m + 1; else hi = m - 1 } return -1 }
  await pass(path, (it) => { if (it.type === 'node') { const i = find(+it.id); if (i >= 0) { lat[i] = it.lat; lng[i] = it.lon } } })
  // rings → catchment filter → tiles
  let kept = 0
  for (const w of ways) {
    const flat = []; let ok = true, cLat = 0, cLng = 0
    for (let k = 0; k < w.n; k++) { const i = find(refs[w.start + k]); if (i < 0 || isNaN(lat[i])) { ok = false; break } flat.push(+lat[i].toFixed(7), +lng[i].toFixed(7)); cLat += lat[i]; cLng += lng[i] }
    if (!ok) continue
    const c = { lat: cLat / w.n, lng: cLng / w.n }
    if (!inCatchment(c)) continue
    const key = `${Math.floor(c.lat * 100)}_${Math.floor(c.lng * 100)}`
    const tags = Object.fromEntries(Object.entries(w.tags).filter(([, v]) => v != null))
    if (!tiles.has(key)) tiles.set(key, [])
    tiles.get(key).push([w.id, flat, tags]); kept++
  }
  total += kept
  console.log(`${f}: kept ${kept.toLocaleString()} buildings in the catchments (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
}
for (const [k, v] of tiles) writeFileSync(join(TILES, `${k}.json`), JSON.stringify(v))
writeFileSync(join(DIR, 'meta.json'), JSON.stringify({ builtAt: new Date().toISOString(), files, catchments: CATCHMENTS, catchmentKm: CATCHMENT_KM, buildings: total, tiles: tiles.size }))
console.log(`Done — ${total.toLocaleString()} buildings in ${tiles.size} tiles`)
