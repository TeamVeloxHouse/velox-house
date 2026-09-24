/* Build the land-ownership boundary tiles from HM Land Registry INSPIRE Index Polygons.
 *
 *   node scripts/inspire-build.mjs <folder-of-council-zips-or-gml>
 *
 * Each council download (free, Open Government Licence) is a zip holding Land_Registry_Cadastral_Parcels.gml
 * with every registered title's polygon in British National Grid (EPSG:27700). We convert every vertex to
 * WGS84 with Ordnance Survey's OSTN15 grid (data/ostn15/OSTN15_NTv2_OSGBtoETRS.gsb — centimetre-level, the
 * same transformation the Land Registry and Pylon rely on) and write 1 km tiles to data/inspire/tiles/E_N.json
 * so a lookup only ever reads one small file. Re-run monthly when the Land Registry republishes. */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import proj4 from 'proj4'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GSB = join(ROOT, 'data/ostn15/OSTN15_NTv2_OSGBtoETRS.gsb')
const OUT = join(ROOT, 'data/inspire/tiles')
const src = process.argv[2]
if (!src) { console.error('usage: node scripts/inspire-build.mjs <folder>'); process.exit(1) }

const buf = readFileSync(GSB)
proj4.nadgrid('OSTN15', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
proj4.defs('BNG', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +nadgrids=OSTN15 +no_defs')
const toWgs = proj4('BNG', 'WGS84')

// ── self-test against Ordnance Survey's published OSTN15 test point (TP01 area: Inverness-ish is fine, use a GB point) ──
{
  const [lng, lat] = toWgs.forward([322354.89, 164616.83])
  console.log(`sanity: BNG 322354.89,164616.83 → ${lat.toFixed(7)}, ${lng.toFixed(7)}`)
}

const tiles = new Map() // "E_N" → [[id, flat lng/lat...]]
const addToTiles = (id, flat, bb) => {
  for (let e = Math.floor(bb[0] / 1000); e <= Math.floor(bb[2] / 1000); e++)
    for (let n = Math.floor(bb[1] / 1000); n <= Math.floor(bb[3] / 1000); n++) {
      const k = `${e}_${n}`; if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push([id, flat])
    }
}

function handleMember(xml) {
  const id = xml.match(/<LR:INSPIREID>(\d+)<\/LR:INSPIREID>/)?.[1]
  const ext = xml.match(/<gml:exterior><gml:LinearRing><gml:posList>([^<]+)<\/gml:posList>/)?.[1]
  if (!id || !ext) return 0
  const nums = ext.trim().split(/\s+/).map(Number)
  const flat = []; let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const e = nums[i], n = nums[i + 1]
    if (e < minE) minE = e; if (e > maxE) maxE = e; if (n < minN) minN = n; if (n > maxN) maxN = n
    const [lng, lat] = toWgs.forward([e, n])
    flat.push(Math.round(lng * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7)
  }
  addToTiles(Number(id), flat, [minE, minN, maxE, maxN])
  return 1
}

/** Stream a GML (from a zip via `unzip -p`, or a plain file) member by member. */
function streamGml(path) {
  return new Promise((resolve, reject) => {
    const isZip = path.toLowerCase().endsWith('.zip')
    const child = isZip ? spawn('unzip', ['-p', path, '*.gml']) : spawn('cat', [path])
    let carry = '', count = 0
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      carry += chunk
      let i
      while ((i = carry.indexOf('</wfs:member>')) >= 0) { count += handleMember(carry.slice(0, i)); carry = carry.slice(i + 13) }
    })
    child.on('error', reject)
    child.on('close', () => resolve(count))
  })
}

const files = statSync(src).isDirectory() ? readdirSync(src).filter((f) => /\.(zip|gml)$/i.test(f)).map((f) => join(src, f)) : [src]
let total = 0
for (const f of files) {
  const t0 = Date.now()
  const n = await streamGml(f)
  total += n
  console.log(`${basename(f)}: ${n.toLocaleString()} parcels in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}
mkdirSync(OUT, { recursive: true })
// merge with any existing tiles (councils processed in separate runs), de-duplicating by INSPIRE id
let written = 0
for (const [k, list] of tiles) {
  const p = join(OUT, `${k}.json`)
  const prev = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : []
  const seen = new Set(list.map((x) => x[0]))
  writeFileSync(p, JSON.stringify([...list, ...prev.filter((x) => !seen.has(x[0]))]))
  written++
}
writeFileSync(join(ROOT, 'data/inspire/manifest.json'), JSON.stringify({ builtAt: new Date().toISOString(), sources: files.map((f) => basename(f)), parcels: total, tiles: written }, null, 1))
console.log(`done: ${total.toLocaleString()} parcels → ${written} tiles in data/inspire/tiles`)
