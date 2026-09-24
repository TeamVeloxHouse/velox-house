import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { googleSolarAnalysis, googleSolarAnalysisAt, geocode, solarLayerBytes } from './server/solarProvider.mjs'
import { mapTileBytes } from './server/mapTilesProvider.mjs'
import { parcelAt } from './server/parcelProvider.mjs'
import { pdlSearch } from './server/sourcingProvider.mjs'
import { staticSatellite } from './server/roofImage.mjs'
import { staticStreetView } from './server/streetViewProvider.mjs'
import { aiSolarMockup } from './server/imageGenProvider.mjs'
import { placesSearch, placesRadiusScan, placesAutocomplete } from './server/placesProvider.mjs'
import { pvgisHourly } from './server/pvgisProvider.mjs'
import { callOvi } from './server/oviProvider.mjs'

/** Dev-only backend for the real Ovi operator — keeps the Anthropic key server-side.
 *  Set ANTHROPIC_API_KEY in .env to go live; without it, /api/ovi returns
 *  { fallback: true } and the app uses the built-in deterministic Ovi engine. */
function oviApi(env: Record<string, string>): Plugin {
  const key = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || ''
  const model = env.OVI_MODEL || process.env.OVI_MODEL || ''
  return {
    name: 'ovi-api',
    configureServer(server) {
      server.middlewares.use('/api/ovi', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            if (!key) return res.end(JSON.stringify({ fallback: true, reason: 'no-key' }))
            const payload = JSON.parse(body || '{}')
            if (!payload.messages) return res.end(JSON.stringify({ live: true })) // cheap liveness ping
            const data = await callOvi(payload, key, model || undefined)
            res.end(JSON.stringify(data))
          } catch (e) {
            res.statusCode = 200
            res.end(JSON.stringify({ error: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** Dev-only backend for the Google Solar API — keeps the key server-side.
 *  Set GOOGLE_MAPS_API_KEY in .env (Solar API + Geocoding API enabled) to go live;
 *  without it, /api/solar returns { fallback: true } and the client uses the offline model. */
function solarApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'solar-api',
    configureServer(server) {
      server.middlewares.use('/api/solar', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const { address, lat, lng } = JSON.parse(body || '{}')
            if (!key) return res.end(JSON.stringify({ fallback: true, reason: 'no-key' }))
            const analysis = (typeof lat === 'number' && typeof lng === 'number')
              ? await googleSolarAnalysisAt(lat, lng, key)
              : await googleSolarAnalysis(address, key)
            res.end(JSON.stringify(analysis))
          } catch (e) {
            res.end(JSON.stringify({ fallback: true, reason: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** Dev-only backend for People Data Labs lead sourcing — keeps the key server-side.
 *  Set PEOPLE_DATA_LABS_API_KEY (or PDL_API_KEY) in .env to go live; without it,
 *  /api/sourcing returns { fallback: true } and the client uses sample data. */
function sourcingApi(env: Record<string, string>): Plugin {
  const key = env.PEOPLE_DATA_LABS_API_KEY || env.PDL_API_KEY || process.env.PEOPLE_DATA_LABS_API_KEY || process.env.PDL_API_KEY || ''
  return {
    name: 'sourcing-api',
    configureServer(server) {
      server.middlewares.use('/api/sourcing', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const criteria = JSON.parse(body || '{}')
            if (!key) return res.end(JSON.stringify({ fallback: true, reason: 'no-key' }))
            const result = await pdlSearch(criteria, key)
            res.end(JSON.stringify(result))
          } catch (e) {
            res.end(JSON.stringify({ fallback: true, reason: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** Dev-only satellite-image proxy for the Design Studio roof view. */
function roofImageApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'roof-image-api',
    configureServer(server) {
      server.middlewares.use('/api/roof-image', (req, res) => {
        const u = new URL(req.url || '', 'http://localhost')
        const lat = u.searchParams.get('lat'), lng = u.searchParams.get('lng')
        const z = u.searchParams.get('z') || '20', size = u.searchParams.get('size') || '640x400'
        if (!key || !lat || !lng) { res.statusCode = 404; return res.end() }
        staticSatellite(lat, lng, z, size, key)
          .then(({ buf, contentType }) => { res.setHeader('Content-Type', contentType); res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(buf) })
          .catch(() => { res.statusCode = 404; res.end() })
      })
    },
  }
}

/** Dev-only Street View photo proxy for the proposal "showroom mockup" — a real photo of the
 *  front of the house, composited client-side with a stylised panel overlay. Reuses
 *  GOOGLE_MAPS_API_KEY; enable the "Street View Static API" on that key. */
function streetViewApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'street-view-api',
    configureServer(server) {
      server.middlewares.use('/api/street-view', (req, res) => {
        const u = new URL(req.url || '', 'http://localhost')
        const lat = u.searchParams.get('lat'), lng = u.searchParams.get('lng')
        const heading = u.searchParams.get('heading')
        const size = u.searchParams.get('size') || '640x400'
        if (!key || !lat || !lng) { res.statusCode = 404; return res.end() }
        staticStreetView(lat, lng, heading, size, key)
          .then(({ buf, contentType }) => { res.setHeader('Content-Type', contentType); res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(buf) })
          .catch(() => { res.statusCode = 404; res.end() })
      })
    },
  }
}

/** Dev-only real AI "solar on the roof" render — Street View photo → gpt-image-1 edit.
 *  This is a real, paid OpenAI call (~$0.02–$0.19/image). Set OPENAI_API_KEY (gpt-image-1,
 *  verified org — platform.openai.com → Settings → Organization → Verify) alongside
 *  GOOGLE_MAPS_API_KEY (Street View Static API) to go live; without either, returns
 *  { fallback: true } and the client uses the free composite overlay instead. */
function aiMockupApi(env: Record<string, string>): Plugin {
  const mapsKey = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  const openaiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''
  return {
    name: 'ai-mockup-api',
    configureServer(server) {
      server.middlewares.use('/api/ai-mockup', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        res.setHeader('Content-Type', 'application/json')
        if (!mapsKey || !openaiKey) return res.end(JSON.stringify({ fallback: true, reason: 'no-key' }))
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          try {
            const { lat, lng, heading } = JSON.parse(body || '{}')
            if (typeof lat !== 'number' || typeof lng !== 'number') return res.end(JSON.stringify({ fallback: true, reason: 'no-location' }))
            const { buf, contentType } = await staticStreetView(lat, lng, heading, '1024x1024', mapsKey)
            const png = await aiSolarMockup(buf, contentType, openaiKey)
            res.setHeader('Content-Type', 'image/png')
            res.end(png)
          } catch (e) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ fallback: true, reason: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** Dev-only proxy for Solar API Data Layers (DSM / flux / mask GeoTIFFs) — streams the raw bytes
 *  with the key kept server-side, so the client can parse the real roof heightfield + irradiance. */
function solarLayerApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'solar-layer-api',
    configureServer(server) {
      server.middlewares.use('/api/solar-layer', (req, res) => {
        const u = new URL(req.url || '', 'http://localhost')
        const lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'))
        const kind = u.searchParams.get('kind') || 'dsm'
        const radiusMeters = Number(u.searchParams.get('radius') || '40'), pixelSizeMeters = Number(u.searchParams.get('px') || '0.25')
        if (!key || !isFinite(lat) || !isFinite(lng)) { res.statusCode = 404; return res.end() }
        solarLayerBytes(lat, lng, kind, key, { radiusMeters, pixelSizeMeters })
          .then(({ buf, contentType }) => { res.setHeader('Content-Type', contentType); res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(buf) })
          .catch((e) => { res.statusCode = 404; res.end(String(e?.message || e)) })
      })
    },
  }
}

/** Dev-only proxy for Google Map Tiles (2D satellite) — high-res aerial base map, key kept server-side.
 *  URL: /api/maptiles/{z}/{x}/{y}. 404s (→ client keeps the Esri base) when the Map Tiles API isn't
 *  enabled on GOOGLE_MAPS_API_KEY. */
function mapTilesApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'map-tiles-api',
    configureServer(server) {
      server.middlewares.use('/api/maptiles', (req, res) => {
        const path = (req.url || '').split('?')[0].replace(/^\//, '') // "z/x/y"
        const [z, x, y] = path.split('/').map(Number)
        if (!key || ![z, x, y].every(Number.isFinite)) { res.statusCode = 404; return res.end() }
        mapTileBytes(z, x, y, key)
          .then(({ buf, contentType }) => { res.setHeader('Content-Type', contentType); res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(buf) })
          .catch((e) => { res.statusCode = 404; res.end(String(e?.message || e)) })
      })
    },
  }
}

/** Dev-only land-ownership (parcel) boundary lookup — HM Land Registry INSPIRE Index Polygons.
 *  Point INSPIRE_PARCELS at a WGS84 GeoJSON file (or a directory of them) exported from a council's
 *  INSPIRE download to serve real title boundaries; otherwise it reports { configured:false } and the
 *  client falls back to the (real) building footprint. */
function parcelApi(env: Record<string, string>): Plugin {
  const src = env.INSPIRE_PARCELS || process.env.INSPIRE_PARCELS || ''
  return {
    name: 'parcel-api',
    configureServer(server) {
      server.middlewares.use('/api/parcel', (req, res) => {
        const u = new URL(req.url || '', 'http://localhost')
        const lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'))
        res.setHeader('Content-Type', 'application/json')
        if (!isFinite(lat) || !isFinite(lng)) { res.statusCode = 400; return res.end(JSON.stringify({ configured: false, reason: 'bad-point' })) }
        try { res.end(JSON.stringify(parcelAt(lat, lng, src))) }
        catch (e) { res.end(JSON.stringify({ configured: false, reason: String((e as Error)?.message || e) })) }
      })
    },
  }
}

/** Dev-only backend for Google Places discovery — keeps the key server-side.
 *  Set GOOGLE_MAPS_API_KEY (Places API enabled); without it /api/places returns { buildings: [] }
 *  and the Commercial Solar Engine reports "no building source configured". */
function placesApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'places-api',
    configureServer(server) {
      server.middlewares.use('/api/places', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            if (!key) return res.end(JSON.stringify({ buildings: [], fallback: true, reason: 'no-key' }))
            const { area, industry, count, lat, lng, radius } = JSON.parse(body || '{}')
            const buildings = (typeof lat === 'number' && typeof lng === 'number')
              ? await placesRadiusScan({ lat, lng, radius, industry, count }, key)
              : await placesSearch({ area, industry, count }, key)
            res.end(JSON.stringify({ buildings, live: true }))
          } catch (e) {
            res.end(JSON.stringify({ buildings: [], fallback: true, reason: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** Dev-only Places autocomplete proxy — Google-Maps-style address/place typeahead. */
function autocompleteApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'autocomplete-api',
    configureServer(server) {
      server.middlewares.use('/api/autocomplete', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const { input } = JSON.parse(body || '{}')
            if (!key) return res.end(JSON.stringify({ suggestions: [] }))
            res.end(JSON.stringify({ suggestions: await placesAutocomplete(input, key) }))
          } catch (e) {
            res.end(JSON.stringify({ suggestions: [], reason: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** Dev-only geocoding proxy — turns a typed location into a pin (lat/lng) for radius/single-site. */
function geocodeApi(env: Record<string, string>): Plugin {
  const key = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  return {
    name: 'geocode-api',
    configureServer(server) {
      server.middlewares.use('/api/geocode', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const { address, lat, lng } = JSON.parse(body || '{}')
            if (!key) return res.end(JSON.stringify({ fallback: true, reason: 'no-key' }))
            if (typeof lat === 'number' && typeof lng === 'number') {
              // Reverse: a home's pin → its street address (rooftop result preferred).
              const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=street_address|premise&key=${key}`)
              const j = await r.json()
              const hit = j.results?.[0]
              if (!hit) return res.end(JSON.stringify({ fallback: true, reason: j.status }))
              const pc = hit.address_components?.find((c: { types: string[] }) => c.types.includes('postal_code'))?.long_name
              return res.end(JSON.stringify({ formatted: hit.formatted_address, postcode: pc }))
            }
            res.end(JSON.stringify(await geocode(address, key)))
          } catch (e) {
            res.end(JSON.stringify({ fallback: true, reason: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** Dev-only PVGIS proxy — free, no key. Returns the 8,760-hour per-kWp generation profile for a
 *  plane at (tilt, azimuth), used by the single-site page's accurate self-consumption simulation. */
function pvgisApi(): Plugin {
  return {
    name: 'pvgis-api',
    configureServer(server) {
      server.middlewares.use('/api/pvgis', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const { lat, lng, tilt, azimuth } = JSON.parse(body || '{}')
            const data = await pvgisHourly(lat, lng, tilt ?? 35, azimuth ?? 0)
            res.end(JSON.stringify(data))
          } catch (e) {
            res.end(JSON.stringify({ fallback: true, reason: String((e as Error)?.message || e) }))
          }
        })
      })
    },
  }
}

/** EPC register — parked for now. Returns null until an EPC Open Data token is wired in.
 *  Swap the body for a real epcProvider call once EPC_API_EMAIL + EPC_API_KEY are set. */
function epcApi(_env: Record<string, string>): Plugin {
  return {
    name: 'epc-api',
    configureServer(server) {
      server.middlewares.use('/api/epc', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ rating: null, fallback: true, reason: 'epc-not-configured' }))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), solarApi(env), solarLayerApi(env), mapTilesApi(env), parcelApi(env), sourcingApi(env), roofImageApi(env), streetViewApi(env), aiMockupApi(env), placesApi(env), autocompleteApi(env), pvgisApi(), geocodeApi(env), epcApi(env), oviApi(env)],
    server: { port: 3011, host: true },
  }
})
