/* The real Ovi: a manual Claude tool-use loop that runs in the browser.
 * Each turn calls /api/ovi (the key-holding proxy) for one Messages-API step,
 * executes any tool calls against the live store (so the UI updates as you watch),
 * feeds the results back, and repeats until Claude gives a final answer.
 * Falls back to the built-in deterministic engine when no API key is configured.
 */
import { toolByName, toolSchemas, type ToolCtx } from './oviTools'

export type OviStep = { id: string; name: string; summary: string; status: 'running' | 'done' | 'error' }
export type AnthMessage = { role: 'user' | 'assistant'; content: any }

export type RunCallbacks = {
  onText: (text: string) => void
  onStep: (step: OviStep) => void
  ctx: ToolCtx
}

const SYSTEM = `You are Ovi, the AI operator of Solar House — an AI-first CRM built for a solar-installation business. You run the app on behalf of Jordan Miles, the owner.

How to work:
- You have TOOLS that take real actions in the CRM (create deals, move stages, add tasks, convert leads, create customer portals, send emails, add dashboard widgets, navigate pages). PREFER doing over describing — if the user asks you to do something, use the tools to actually do it.
- To act on an existing record, first find it with list_deals / list_leads (they return ids), then call the action tool with that id. You may also pass a name and the tool will match it.
- After acting, confirm briefly and warmly what you did — one or two sentences. Don't narrate every internal step.
- Marking a deal won/lost and sending email are guarded: the tool will ask the user to approve. That's expected — go ahead and call them when asked.
- If the user only asks a question, answer it. Use the read tools (pipeline_summary, list_deals, list_leads) for live numbers rather than guessing. Don't call tools you don't need.
- Be concise and friendly.`

/**
 * Run one user turn through the real Ovi. `prior` is the running Anthropic message
 * history (excluding the new user text). Returns the updated history, or a fallback flag.
 */
export async function runOviAgent(userText: string, prior: AnthMessage[], cb: RunCallbacks): Promise<{ fallback?: true; error?: string; messages: AnthMessage[] }> {
  const messages: AnthMessage[] = [...prior, { role: 'user', content: userText }]

  for (let round = 0; round < 8; round++) {
    let resp: any
    try {
      resp = await fetch('/api/ovi', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system: SYSTEM, messages, tools: toolSchemas() }),
      }).then((r) => r.json())
    } catch (e) {
      return { fallback: true, messages: prior } // endpoint not reachable (e.g. static host) → use built-in engine
    }
    if (!resp || resp.fallback) return { fallback: true, messages: prior }
    if (resp.error) { cb.onText(`⚠️ ${resp.error}`); return { error: resp.error, messages } }

    messages.push({ role: 'assistant', content: resp.content })
    for (const b of resp.content || []) if (b.type === 'text' && b.text?.trim()) cb.onText(b.text)

    if (resp.stop_reason !== 'tool_use') break

    const results: any[] = []
    for (const b of resp.content || []) {
      if (b.type !== 'tool_use') continue
      const tool = toolByName(b.name)
      cb.onStep({ id: b.id, name: b.name, summary: prettyName(b.name), status: 'running' })
      let r
      try { r = tool ? await tool.execute(b.input || {}, cb.ctx) : { ok: false, summary: 'Unknown tool', content: `No tool named ${b.name}` } }
      catch (e) { r = { ok: false, summary: 'Error', content: String((e as Error)?.message || e) } }
      cb.onStep({ id: b.id, name: b.name, summary: r.summary, status: r.ok ? 'done' : 'error' })
      results.push({ type: 'tool_result', tool_use_id: b.id, content: r.content, is_error: !r.ok })
    }
    messages.push({ role: 'user', content: results })
  }
  return { messages }
}

/** Quick liveness check — is a real model wired up? (used to badge the chat). */
export async function oviIsLive(): Promise<boolean> {
  try {
    const r = await fetch('/api/ovi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ping: true }) }).then((x) => x.json())
    return r?.live === true
  } catch { return false }
}

function prettyName(n: string) {
  return n.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
