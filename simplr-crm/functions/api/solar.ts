// Cloudflare Pages Function — production backend for /api/solar.
// Set GOOGLE_MAPS_API_KEY as an environment variable in the Cloudflare Pages project
// (Solar API + Geocoding API enabled). Without it, returns { fallback: true }.
// @ts-expect-error — .mjs provider, resolved at bundle time
import { googleSolarAnalysis } from '../../server/solarProvider.mjs'

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const { address } = await context.request.json()
    const key = context.env.GOOGLE_MAPS_API_KEY
    if (!key) return new Response(JSON.stringify({ fallback: true, reason: 'no-key' }), { headers })
    const analysis = await googleSolarAnalysis(address, key)
    return new Response(JSON.stringify(analysis), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ fallback: true, reason: String((e as Error)?.message || e) }), { headers })
  }
}
