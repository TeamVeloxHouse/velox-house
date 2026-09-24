// Cloudflare Pages Function — production backend for /api/ovi (the real Ovi operator).
// Set ANTHROPIC_API_KEY (and optionally OVI_MODEL) as env vars in the Cloudflare Pages
// project. Without a key, returns { fallback: true } and the app uses the built-in engine.
// @ts-expect-error — .mjs provider, resolved at bundle time
import { callOvi } from '../../server/oviProvider.mjs'

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const key = context.env.ANTHROPIC_API_KEY
    if (!key) return new Response(JSON.stringify({ fallback: true, reason: 'no-key' }), { headers })
    const payload = await context.request.json()
    if (!payload.messages) return new Response(JSON.stringify({ live: true }), { headers }) // cheap liveness ping
    const data = await callOvi(payload, key, context.env.OVI_MODEL || undefined)
    return new Response(JSON.stringify(data), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { headers })
  }
}
