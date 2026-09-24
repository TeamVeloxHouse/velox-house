// Cloudflare Pages Function — satellite-image proxy for /api/roof-image.
// Set GOOGLE_MAPS_API_KEY (Static Maps API enabled). Without it, returns 404.
// @ts-expect-error — .mjs provider, resolved at bundle time
import { staticSatellite } from '../../server/roofImage.mjs'

export const onRequestGet = async (context: { request: Request; env: Record<string, string> }) => {
  const u = new URL(context.request.url)
  const lat = u.searchParams.get('lat'), lng = u.searchParams.get('lng')
  const z = u.searchParams.get('z') || '20', size = u.searchParams.get('size') || '640x400'
  const key = context.env.GOOGLE_MAPS_API_KEY
  if (!key || !lat || !lng) return new Response(null, { status: 404 })
  try {
    const { buf, contentType } = await staticSatellite(lat, lng, z, size, key)
    return new Response(buf, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return new Response(null, { status: 404 })
  }
}
