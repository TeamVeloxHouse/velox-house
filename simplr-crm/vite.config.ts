import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { googleSolarAnalysis, googleSolarAnalysisAt } from './server/solarProvider.mjs'
import { pdlSearch } from './server/sourcingProvider.mjs'
import { staticSatellite } from './server/roofImage.mjs'
import { placesSearch, placesRadiusScan } from './server/placesProvider.mjs'
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
    plugins: [react(), solarApi(env), sourcingApi(env), roofImageApi(env), placesApi(env), pvgisApi(), epcApi(env), oviApi(env)],
    server: { port: 3010 },
  }
})
