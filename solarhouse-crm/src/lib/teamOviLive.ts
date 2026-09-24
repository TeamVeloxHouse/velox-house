import type { Deal, TeamMember } from '../store/types'
import { PURPOSES, EVENT_TYPES } from './activityTaxonomy'

/* @Ovi in Team chat, on the live model. Ovi gets the team, a compact customer list and the recent
 * thread, and can act through two tools — create tasks and schedule events — which the chat runs
 * against the real store. Returns null when the model isn't reachable so the scripted Ovi takes over. */

export type OviAction =
  | { tool: 'create_task'; subject: string; due_date?: string; assignee?: string; customer?: string; priority?: 'High' | 'Medium' | 'Low'; notes?: string }
  | { tool: 'schedule_event'; type: 'meeting' | 'call' | 'task' | 'email'; purpose: string; date: string; time?: string; customer?: string; assignee?: string; location?: string; notes?: string }

const TOOLS = [
  {
    name: 'create_task',
    description: 'Create a task in the CRM (it appears in My Tasks for the assignee). Use for anything someone asks to be done.',
    input_schema: { type: 'object', properties: { subject: { type: 'string' }, due_date: { type: 'string', description: 'YYYY-MM-DD' }, assignee: { type: 'string', description: 'Team member full name' }, customer: { type: 'string', description: 'Customer name exactly as listed' }, priority: { type: 'string', enum: ['High', 'Medium', 'Low'] }, notes: { type: 'string' } }, required: ['subject'] },
  },
  {
    name: 'schedule_event',
    description: 'Put a meeting, call, task or email on the calendar.',
    input_schema: { type: 'object', properties: { type: { type: 'string', enum: EVENT_TYPES.map((t) => t.id) }, purpose: { type: 'string', description: `One of: ${Object.values(PURPOSES).flat().join(', ')}` }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM' }, customer: { type: 'string' }, assignee: { type: 'string' }, location: { type: 'string' }, notes: { type: 'string' } }, required: ['type', 'purpose', 'date'] },
  },
]

export async function askTeamOvi(opts: { text: string; channelName: string; history: { who: string; text: string }[]; team: TeamMember[]; deals: Deal[]; me: string }): Promise<{ reply: string; actions: OviAction[] } | null> {
  const customers = opts.deals.filter((d) => d.journey && !d.lost).slice(0, 400)
    .map((d) => `${d.name} | ${d.journey!.postcode} | ${d.won ? 'customer' : d.stage} | £${d.value} | owner ${d.owner}${d.journey!.nextAction ? ` | next: ${d.journey!.nextAction.label}` : ''}`).join('\n')
  const today = new Date().toISOString().slice(0, 10)
  try {
    const r = await fetch('/api/ovi', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: `You are Ovi, the AI teammate inside The Solar House CRM team chat (UK residential solar, battery & EV installer; showrooms Cardiff, Cheltenham, Melksham). Today is ${today}. You were @mentioned in #${opts.channelName} by ${opts.me}. Be brief and friendly (1–3 sentences, UK English). If asked to do something, DO it with the tools (create_task / schedule_event) — you may call several — then say what you did. Only answer from the data below; if you can't find a customer, say so.\n\nTEAM: ${opts.team.filter((m) => !m.bot).map((m) => `${m.name} (${m.role})`).join('; ')}\n\nCUSTOMERS (name | postcode | stage | value | owner | next):\n${customers}`,
        messages: [{ role: 'user', content: `Recent messages:\n${opts.history.map((h) => `${h.who}: ${h.text}`).join('\n')}\n\nNew message to you: ${opts.text}` }],
        tools: TOOLS,
      }),
    })
    const data = await r.json()
    if (data.fallback || data.error || !data.content) return null
    const reply = data.content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n').trim()
    const actions = data.content.filter((c: { type: string }) => c.type === 'tool_use').map((c: { name: string; input: Record<string, unknown> }) => ({ tool: c.name, ...c.input }) as OviAction)
    return { reply, actions }
  } catch { return null }
}
