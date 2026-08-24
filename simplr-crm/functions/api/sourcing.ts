// Cloudflare Pages Function — production backend for /api/sourcing (People Data Labs).
// Set PEOPLE_DATA_LABS_API_KEY (or PDL_API_KEY) as an environment variable in the Cloudflare
// Pages project. Without it, returns { fallback: true } and the client uses sample data.
// @ts-expect-error — .mjs provider, resolved at bundle time
import { pdlSearch } from '../../server/sourcingProvider.mjs'

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const criteria = await context.request.json()
    const key = context.env.PEOPLE_DATA_LABS_API_KEY || context.env.PDL_API_KEY
    if (!key) return new Response(JSON.stringify({ fallback: true, reason: 'no-key' }), { headers })
    const result = await pdlSearch(criteria, key)
    return new Response(JSON.stringify(result), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ fallback: true, reason: String((e as Error)?.message || e) }), { headers })
  }
}
