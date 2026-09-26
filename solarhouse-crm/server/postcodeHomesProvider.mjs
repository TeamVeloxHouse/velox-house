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

import { localCovered, localBuildings } from './osmLocal.mjs'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// building id → its geocoded address, kept on disk: a building looked up once never needs geocoding again
const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data/cache'), ADDR_FILE = join(CACHE_DIR, 'addresses.json')
const addrCache = existsSync(ADDR_FILE) ? JSON.parse(readFileSync(ADDR_FILE, 'utf8')) : {}
let saveTimer = null
const saveAddrCache = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { mkdirSync(CACHE_DIR, { recursive: true }); writeFileSync(ADDR_FILE, JSON.stringify(addrCache)) } catch { /* best effort */ } }, 1500) }
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
  if (localCovered(+lat, +lng, radius)) return localBuildings(+lat, +lng, radius) // instant — Geofabrik extract on disk
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

/** A street name without a house number ("Clos-y-Dolydd, Cardiff") → every home on that street. Finds the street,
 *  asks postcodes.io for the postcodes around it, lists each postcode's homes, keeps the ones on this street. */
export async function streetHomes(q, reverse, geocodeFn, rooftopFn) {
  const street = String(q || '').split(',')[0].replace(/^\s*\d+[a-z]?\s+/i, '').trim()
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '')
  if (norm(street).length < 4) return { ok: false, reason: 'Type the street name' }
  const g = await geocodeFn(`${q}, UK`).catch(() => null)
  if (!g || typeof g.lat !== 'number') return { ok: false, reason: 'Street not found' }
  const r = await fetch(`https://api.postcodes.io/postcodes?lon=${g.lng}&lat=${g.lat}&radius=500&limit=15`)
  const j = r.ok ? await r.json() : null
  const pcs = [...new Set((j?.result ?? []).map((x) => x.postcode))].slice(0, 10)
  const lists = await Promise.all(pcs.map((pc) => postcodeHomes(pc, reverse).catch(() => null)))
  const want = norm(street), seen = new Set(), homes = []
  for (const l of lists) for (const h of l?.homes ?? []) {
    if (seen.has(h.id) || !(norm(h.street).includes(want) || want.includes(norm(h.street)) && norm(h.street).length > 4)) continue
    seen.add(h.id); homes.push(h)
  }
  // Streets OpenStreetMap hasn't mapped (new estates): ask the geocoder for "1 <street>", "2 <street>"… and keep the
  // answers it places on an actual rooftop. Real house numbers, each pinned on its own roof.
  if (homes.length < 3 && rooftopFn) {
    const town = String(q).split(',').slice(1).join(',').trim()
    const found = []
    for (let start = 1; start <= 120; start += 20) {
      const batch = await Promise.all(Array.from({ length: 20 }, (_, k) => start + k).map((n) => rooftopFn(`${n} ${street}${town ? ', ' + town : ''}, UK`).then((r) => (r ? { n, r } : null)).catch(() => null)))
      const hits = batch.filter((x) => x && norm(x.r.formatted.split(',')[0]).includes(want) && x.r.formatted.split(',')[0].trim().toLowerCase().startsWith(`${x.n} `))
      found.push(...hits)
      if (!hits.length && start > 20) break // a run of 20 numbers with nothing — the street's ended
    }
    for (const { n, r } of found) {
      const key = `${r.lat.toFixed(6)},${r.lng.toFixed(6)}`
      if (seen.has(key)) continue; seen.add(key)
      const label = r.formatted.split(',')[0]
      homes.push({ id: `g${key}`, label, number: String(n), street: label.replace(/^\s*\d+[a-z]?\s+/i, ''), address: r.formatted.replace(/, UK$/, ''), center: { lat: r.lat, lng: r.lng }, areaM2: 0, source: 'rooftop' })
    }
  }
  const num = (s) => { const m = String(s).match(/\d+/); return m ? +m[0] : 1e9 }
  homes.sort((a, b) => num(a.number) - num(b.number) || a.number.localeCompare(b.number))
  return { ok: true, street, center: { lat: g.lat, lng: g.lng }, homes, postcodes: pcs }
}

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
        const hit = addrCache[b.id]
        if (hit) { postcode = hit.pc; label = hit.label; source = 'geocode' }
        else try { const r = await reverse(b.center.lat, b.center.lng); postcode = r.postcode; label = (r.formatted || '').split(',')[0]; source = 'geocode'; addrCache[b.id] = { pc: postcode, label }; saveAddrCache() } catch { continue }
      }
      if (!label || norm(postcode) !== want) continue
      const key = label.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const m = label.match(/^(\d+[A-Z]?|[^,\d]+?)\s+(.*)$/i)
      homes.push({ id: b.id, label, number: m ? m[1] : label, street: m ? m[2] : '', address: `${label}, ${pc.district ? pc.district + ', ' : ''}${pc.postcode}`, center: b.center, footprint: b.footprint, areaM2: Math.round(b.m2), source })
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker))
  const num = (s) => { const m = String(s).match(/\d+/); return m ? +m[0] : 1e9 }
  homes.sort((a, b) => a.street.localeCompare(b.street) || num(a.number) - num(b.number) || a.number.localeCompare(b.number))
  const v = { ok: true, postcode: pc.postcode, center: { lat: pc.lat, lng: pc.lng }, district: pc.district, homes, scanned: cands.length }
  if (homes.length) cache.set(want, { at: Date.now(), v })
  return v
}
