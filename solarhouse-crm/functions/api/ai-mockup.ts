// Cloudflare Pages Function — real AI "solar panels on the roof" render for /api/ai-mockup.
// Needs GOOGLE_MAPS_API_KEY (Street View Static API) + OPENAI_API_KEY (gpt-image-1, verified org).
// Without either, returns { fallback: true } and the client falls back to the free composite.
// @ts-expect-error — .mjs provider, resolved at bundle time
import { staticStreetView } from '../../server/streetViewProvider.mjs'
// @ts-expect-error — .mjs provider, resolved at bundle time
import { aiSolarMockup } from '../../server/imageGenProvider.mjs'

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const mapsKey = context.env.GOOGLE_MAPS_API_KEY
  const openaiKey = context.env.OPENAI_API_KEY
  const fallback = () => new Response(JSON.stringify({ fallback: true }), { headers: { 'Content-Type': 'application/json' } })
  if (!mapsKey || !openaiKey) return fallback()
  try {
    const { lat, lng, heading } = await context.request.json() as { lat: number; lng: number; heading?: number }
    if (typeof lat !== 'number' || typeof lng !== 'number') return fallback()
    const { buf, contentType } = await staticStreetView(lat, lng, heading, '1024x1024', mapsKey)
    const png = await aiSolarMockup(buf, contentType, openaiKey)
    return new Response(png, { headers: { 'Content-Type': 'image/png' } })
  } catch {
    return fallback()
  }
}
