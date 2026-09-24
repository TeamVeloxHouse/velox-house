// Cloudflare Pages Function — Street View photo proxy for /api/street-view.
// Set GOOGLE_MAPS_API_KEY (Street View Static API enabled). Without it, returns 404.
// @ts-expect-error — .mjs provider, resolved at bundle time
import { staticStreetView } from '../../server/streetViewProvider.mjs'

export const onRequestGet = async (context: { request: Request; env: Record<string, string> }) => {
  const u = new URL(context.request.url)
  const lat = u.searchParams.get('lat'), lng = u.searchParams.get('lng')
  const heading = u.searchParams.get('heading')
  const size = u.searchParams.get('size') || '640x400'
  const key = context.env.GOOGLE_MAPS_API_KEY
  if (!key || !lat || !lng) return new Response(null, { status: 404 })
  try {
    const { buf, contentType } = await staticStreetView(lat, lng, heading, size, key)
    return new Response(buf, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' } })
  } catch {
    return new Response(null, { status: 404 })
  }
}
