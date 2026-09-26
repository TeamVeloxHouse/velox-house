/* Local OpenStreetMap buildings — read from the tiles scripts/osm-build.mjs makes from Geofabrik extracts.
 * Inside the showroom catchments a lookup is a few file reads (milliseconds) instead of an Overpass round trip
 * (seconds, and rate-limited). Returns the same shape Overpass does, so callers don't care where it came from. */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data/osm')
const TILES = join(DIR, 'tiles')
let meta = null, metaAt = 0
function getMeta() {
  if (Date.now() - metaAt > 60000) { metaAt = Date.now(); meta = existsSync(join(DIR, 'meta.json')) ? JSON.parse(readFileSync(join(DIR, 'meta.json'), 'utf8')) : null }
  return meta
}
const km = (a, b) => { const R = 6371, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }

/** Is this point inside the area the local store was built for? */
export function localCovered(lat, lng, radiusM = 0) {
  const m = getMeta(); if (!m) return false
  return m.catchments.some((c) => km(c, { lat, lng }) * 1000 + radiusM <= m.catchmentKm * 1000)
}

const cache = new Map()
function tile(key) {
  if (cache.has(key)) return cache.get(key)
  const p = join(TILES, `${key}.json`)
  const v = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []
  if (cache.size > 400) cache.delete(cache.keys().next().value)
  cache.set(key, v)
  return v
}
const TAG = { b: 'building', hn: 'addr:housenumber', hname: 'addr:housename', st: 'addr:street', pc: 'addr:postcode', h: 'height', lv: 'building:levels', roof: 'roof:shape' }

/** Buildings with any part within radiusM of the point — Overpass `way["building"](around:…)` equivalent. */
export function localBuildings(lat, lng, radiusM) {
  const dLat = (radiusM + 60) / 110540, dLng = (radiusM + 60) / (111320 * Math.cos((lat * Math.PI) / 180))
  const out = [], seen = new Set() // county extracts overlap at their borders — keep each building once
  for (let a = Math.floor((lat - dLat) * 100); a <= Math.floor((lat + dLat) * 100); a++) {
    for (let b = Math.floor((lng - dLng) * 100); b <= Math.floor((lng + dLng) * 100); b++) {
      for (const [id, flat, t] of tile(`${a}_${b}`)) {
        if (seen.has(id)) continue
        let near = false
        for (let i = 0; i < flat.length && !near; i += 2) if (km({ lat, lng }, { lat: flat[i], lng: flat[i + 1] }) * 1000 <= radiusM) near = true
        if (!near) continue
        const geometry = []; for (let i = 0; i < flat.length; i += 2) geometry.push({ lat: flat[i], lon: flat[i + 1] })
        seen.add(id)
        out.push({ type: 'way', id, tags: Object.fromEntries(Object.entries(t).map(([k, v]) => [TAG[k] ?? k, v])), geometry })
      }
    }
  }
  return out
}
export function localMeta() { return getMeta() }
