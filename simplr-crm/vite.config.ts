import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { googleSolarAnalysis } from './server/solarProvider.mjs'
import { pdlSearch } from './server/sourcingProvider.mjs'

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
            const { address } = JSON.parse(body || '{}')
            if (!key) return res.end(JSON.stringify({ fallback: true, reason: 'no-key' }))
            const analysis = await googleSolarAnalysis(address, key)
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), solarApi(env), sourcingApi(env)],
    server: { port: 3010 },
  }
})
