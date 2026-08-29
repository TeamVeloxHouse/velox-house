/* Server-side proxy for the real Ovi operator.
 * Holds the ANTHROPIC_API_KEY and relays one Messages-API turn to Claude.
 * The tool-use LOOP runs client-side (the tools mutate the live in-browser store),
 * so this stays a thin, stateless credential-injecting relay — one call per turn.
 * Runs in Node (Vite dev middleware) and the Cloudflare Pages Function — global fetch only.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

/**
 * @param {{ system?: string, messages: any[], tools?: any[] }} req  conversation + tools from the client
 * @param {string} key  ANTHROPIC_API_KEY
 * @param {string} [model]
 * @returns the raw Anthropic Messages response (content blocks, stop_reason, usage…)
 */
export async function callOvi(req, key, model) {
  const body = {
    model: model || 'claude-opus-5',
    max_tokens: 4096,
    // adaptive thinking is on by default on Opus 5; keep effort low for a snappy operator
    output_config: { effort: 'low' },
    system: req.system,
    messages: req.messages,
    tools: req.tools,
  }
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message || `Anthropic error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}
