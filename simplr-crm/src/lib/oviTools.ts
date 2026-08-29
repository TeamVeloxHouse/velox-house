/* The tool surface Ovi (the real Claude operator) can call to run the CRM.
 * Each tool maps to the same store action a button calls — so Ovi has exactly a
 * user's power, and because the UI is reactive, you watch changes happen live.
 * Phase A: a high-value slice. Phase B extends this registry to every action.
 */
import { live } from '../store/store'
import type { useActions } from '../store/store'
import type { StageName } from '../data/mock'

type Act = ReturnType<typeof useActions>
export type ToolCtx = { act: Act; nav: (to: string) => void; confirm: (summary: string) => Promise<boolean> }
export type ToolResult = { ok: boolean; summary: string; content: string }
export type OviTool = {
  name: string
  description: string
  risky?: boolean
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
  execute: (input: Record<string, any>, ctx: ToolCtx) => Promise<ToolResult> | ToolResult
}

const S = () => live.state!
const money = (n: number) => `£${Math.round(n).toLocaleString()}`
// Resolve a deal by id or a fuzzy name/org match.
const findDeal = (ref: string) => {
  const d = S().deals
  return d.find((x) => x.id === ref) || d.find((x) => `${x.name} ${x.org}`.toLowerCase().includes((ref || '').toLowerCase()))
}
const findLead = (ref: string) => {
  const l = S().leads
  return l.find((x) => x.id === ref) || l.find((x) => x.name.toLowerCase().includes((ref || '').toLowerCase()))
}
const memberIdByName = (name?: string) => (name ? S().teamMembers.find((m) => m.name.toLowerCase().includes(name.toLowerCase()))?.id : undefined)
const stageNames = () => (S().pipelines.find((p) => p.id === S().activePipelineId) ?? S().pipelines[0])?.stages.map((s) => s.name) ?? []

export const OVI_TOOLS: OviTool[] = [
  // ── read / query ──
  {
    name: 'pipeline_summary', description: 'Get a summary of the sales pipeline: total open value, weighted value, and value/count by stage.',
    input_schema: { type: 'object', properties: {} },
    execute: () => {
      const open = S().deals.filter((d) => !d.won && !d.lost)
      const total = open.reduce((s, d) => s + d.value, 0)
      const weighted = Math.round(open.reduce((s, d) => s + d.value * (d.probability / 100), 0))
      const byStage: Record<string, { n: number; v: number }> = {}
      open.forEach((d) => { const b = (byStage[d.stage] ??= { n: 0, v: 0 }); b.n++; b.v += d.value })
      const lines = Object.entries(byStage).map(([s, b]) => `${s}: ${b.n} deals, ${money(b.v)}`).join('; ')
      return { ok: true, summary: `Pipeline: ${money(total)} open`, content: `Open pipeline ${money(total)} across ${open.length} deals; weighted ${money(weighted)}. By stage — ${lines}.` }
    },
  },
  {
    name: 'list_deals', description: 'List deals, optionally filtered. Use to find a deal before acting on it.',
    input_schema: { type: 'object', properties: { stage: { type: 'string', description: 'exact stage name' }, owner: { type: 'string' }, health: { type: 'string', enum: ['Healthy', 'At risk', 'Stalled', 'No next step'] }, query: { type: 'string', description: 'text match on name/org' } } },
    execute: (i) => {
      let ds = S().deals.filter((d) => !d.lost)
      if (i.stage) ds = ds.filter((d) => d.stage === i.stage)
      if (i.owner) ds = ds.filter((d) => d.owner.toLowerCase().includes(String(i.owner).toLowerCase()))
      if (i.health) ds = ds.filter((d) => d.health === i.health)
      if (i.query) ds = ds.filter((d) => `${d.name} ${d.org}`.toLowerCase().includes(String(i.query).toLowerCase()))
      const rows = ds.slice(0, 20).map((d) => `${d.id} · ${d.org} — ${d.name} · ${money(d.value)} · ${d.stage} · ${d.probability}%`)
      return { ok: true, summary: `${ds.length} deals`, content: rows.length ? rows.join('\n') : 'No matching deals.' }
    },
  },
  {
    name: 'list_leads', description: 'List leads, optionally by status (new/working/nurturing/qualified/unqualified).',
    input_schema: { type: 'object', properties: { status: { type: 'string' } } },
    execute: (i) => {
      let ls = S().leads.filter((l) => !l.archived)
      if (i.status) ls = ls.filter((l) => l.status === i.status)
      const rows = ls.slice(0, 25).map((l) => `${l.id} · ${l.name} · ${l.company} · score ${l.score} · ${l.status}`)
      return { ok: true, summary: `${ls.length} leads`, content: rows.length ? rows.join('\n') : 'No matching leads.' }
    },
  },

  // ── create / update ──
  {
    name: 'create_deal', description: 'Create a new deal (opportunity) in the pipeline.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, org: { type: 'string' }, value: { type: 'number' }, stage: { type: 'string' }, probability: { type: 'number' } }, required: ['name', 'org'] },
    execute: (i, ctx) => {
      const stage = (stageNames().includes(i.stage) ? i.stage : stageNames()[0]) as StageName
      const d = ctx.act.addDeal({ name: i.name, org: i.org, value: Number(i.value) || 0, stage, probability: i.probability != null ? Number(i.probability) : undefined })
      ctx.nav(`/deals/${d.id}`)
      return { ok: true, summary: `Created “${d.name}”`, content: `Created deal ${d.id} — ${d.name} (${d.org}), ${money(d.value)}, stage ${d.stage}.` }
    },
  },
  {
    name: 'move_deal_stage', description: 'Move a deal to a different pipeline stage. Identify the deal by id or name.',
    input_schema: { type: 'object', properties: { deal: { type: 'string', description: 'deal id or name/org' }, stage: { type: 'string' } }, required: ['deal', 'stage'] },
    execute: (i, ctx) => {
      const d = findDeal(i.deal); if (!d) return { ok: false, summary: 'Deal not found', content: `No deal matching "${i.deal}".` }
      if (!stageNames().includes(i.stage)) return { ok: false, summary: 'Unknown stage', content: `Stage must be one of: ${stageNames().join(', ')}.` }
      ctx.act.moveStage(d.id, i.stage as StageName); ctx.nav(`/deals/${d.id}`)
      return { ok: true, summary: `${d.org} → ${i.stage}`, content: `Moved ${d.name} to ${i.stage}.` }
    },
  },
  {
    name: 'create_task', description: 'Create a task/activity, optionally on a deal and assigned to a teammate.',
    input_schema: { type: 'object', properties: { subject: { type: 'string' }, deal: { type: 'string' }, due: { type: 'string', description: 'e.g. Today, Tomorrow, This week' }, priority: { type: 'string', enum: ['High', 'Medium', 'Low'] }, assignee: { type: 'string', description: 'teammate name' } }, required: ['subject'] },
    execute: (i, ctx) => {
      const d = i.deal ? findDeal(i.deal) : undefined
      const assigneeId = memberIdByName(i.assignee)
      ctx.act.logActivity({ type: 'task', subject: i.subject, dealId: d?.id, due: i.due || 'Today', priority: (i.priority as any) || 'Medium', assigneeIds: assigneeId ? [assigneeId] : undefined, done: false, source: 'ai' }, `Task added: ${i.subject}`)
      return { ok: true, summary: `Task: ${i.subject}`, content: `Created task "${i.subject}"${d ? ` on ${d.org}` : ''}${i.assignee ? ` for ${i.assignee}` : ''}, due ${i.due || 'Today'}.` }
    },
  },
  {
    name: 'add_lead', description: 'Add a new lead.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, company: { type: 'string' }, role: { type: 'string' }, score: { type: 'number' } }, required: ['name', 'company'] },
    execute: (i, ctx) => {
      const l = ctx.act.addLead({ name: i.name, company: i.company, role: i.role, score: i.score != null ? Number(i.score) : undefined })
      return { ok: true, summary: `Lead: ${l.name}`, content: `Added lead ${l.id} — ${l.name} (${l.company}).` }
    },
  },
  {
    name: 'convert_lead', description: 'Convert a lead into a deal + contact. Identify by id or name.',
    input_schema: { type: 'object', properties: { lead: { type: 'string' } }, required: ['lead'] },
    execute: (i, ctx) => {
      const l = findLead(i.lead); if (!l) return { ok: false, summary: 'Lead not found', content: `No lead matching "${i.lead}".` }
      const d = ctx.act.convertLead(l); ctx.nav(`/deals/${d.id}`)
      return { ok: true, summary: `Converted ${l.name}`, content: `Converted ${l.name} → deal ${d.id} + contact.` }
    },
  },
  {
    name: 'add_contact', description: 'Add a person (contact).',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, org: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } }, required: ['name'] },
    execute: (i, ctx) => {
      const p = ctx.act.addPerson({ name: i.name, role: i.role, org: i.org, email: i.email, phone: i.phone })
      return { ok: true, summary: `Contact: ${p.name}`, content: `Added contact ${p.id} — ${p.name}${i.org ? ` at ${i.org}` : ''}.` }
    },
  },
  {
    name: 'create_portal', description: 'Create a customer portal from a deal (identify by id or name).',
    input_schema: { type: 'object', properties: { deal: { type: 'string' } }, required: ['deal'] },
    execute: (i, ctx) => {
      const d = findDeal(i.deal); if (!d) return { ok: false, summary: 'Deal not found', content: `No deal matching "${i.deal}".` }
      const person = S().people.find((p) => d.personIds.includes(p.id))
      const p = ctx.act.createPortal({ dealId: d.id, customer: person?.name || d.org, email: person?.email || '', address: d.org, systemKwp: d.solar?.systemKwp ?? 6, systemCost: Math.round(d.solar?.systemCost ?? d.value), annualSavings: Math.round(d.solar?.annualSavings ?? d.value * 0.12) })
      ctx.nav(`/customers/${p.id}`)
      return { ok: true, summary: `Portal for ${p.customer}`, content: `Created customer portal ${p.id} for ${p.customer}.` }
    },
  },
  {
    name: 'add_dashboard_widget', description: 'Add a widget to the Insights dashboard.',
    input_schema: { type: 'object', properties: { metric: { type: 'string', enum: ['open', 'weighted', 'won', 'count'] }, groupBy: { type: 'string', enum: ['stage', 'owner', 'health'] }, chart: { type: 'string', enum: ['bar', 'donut', 'table'] } }, required: ['metric', 'groupBy'] },
    execute: (i, ctx) => {
      const labels: Record<string, string> = { open: 'Open value', weighted: 'Weighted value', won: 'Won value', count: 'Deal count' }
      const title = `${labels[i.metric] || i.metric} by ${i.groupBy}`
      ctx.act.addWidget({ title, metric: i.metric, groupBy: i.groupBy, chart: (i.chart as any) || 'bar' })
      ctx.nav('/insights')
      return { ok: true, summary: `Widget: ${title}`, content: `Added "${title}" to the dashboard.` }
    },
  },
  {
    name: 'navigate', description: 'Open a page in the app so the user can see it (e.g. /deals, /leads, /forecast, /customers, /insights, /jobs).',
    input_schema: { type: 'object', properties: { to: { type: 'string' } }, required: ['to'] },
    execute: (i, ctx) => { ctx.nav(i.to.startsWith('/') ? i.to : `/${i.to}`); return { ok: true, summary: `Opened ${i.to}`, content: `Navigated to ${i.to}.` } },
  },

  // ── risky (require approval) ──
  {
    name: 'mark_deal_won', description: 'Mark a deal as WON. Requires user approval.', risky: true,
    input_schema: { type: 'object', properties: { deal: { type: 'string' } }, required: ['deal'] },
    execute: async (i, ctx) => {
      const d = findDeal(i.deal); if (!d) return { ok: false, summary: 'Deal not found', content: `No deal matching "${i.deal}".` }
      if (!(await ctx.confirm(`Mark “${d.name}” (${money(d.value)}) as won?`))) return { ok: false, summary: 'Declined', content: 'User declined.' }
      ctx.act.markWon(d.id, d.name); ctx.nav(`/deals/${d.id}`)
      return { ok: true, summary: `${d.org} won 🎉`, content: `Marked ${d.name} as won.` }
    },
  },
  {
    name: 'mark_deal_lost', description: 'Mark a deal as LOST with a reason. Requires user approval.', risky: true,
    input_schema: { type: 'object', properties: { deal: { type: 'string' }, reason: { type: 'string' } }, required: ['deal'] },
    execute: async (i, ctx) => {
      const d = findDeal(i.deal); if (!d) return { ok: false, summary: 'Deal not found', content: `No deal matching "${i.deal}".` }
      if (!(await ctx.confirm(`Mark “${d.name}” as lost${i.reason ? ` (${i.reason})` : ''}?`))) return { ok: false, summary: 'Declined', content: 'User declined.' }
      ctx.act.markLost(d.id, d.name, i.reason)
      return { ok: true, summary: `${d.org} lost`, content: `Marked ${d.name} as lost.` }
    },
  },
  {
    name: 'send_email', description: 'Send an email on the user’s behalf. Requires user approval.', risky: true,
    input_schema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, deal: { type: 'string' } }, required: ['to', 'subject', 'body'] },
    execute: async (i, ctx) => {
      if (!(await ctx.confirm(`Send email to ${i.to} — “${i.subject}”?`))) return { ok: false, summary: 'Declined', content: 'User declined.' }
      const d = i.deal ? findDeal(i.deal) : undefined
      ctx.act.sendEmail({ folder: 'sent', from: 'Jordan Miles', fromEmail: 'jordan@tellovi.io', to: i.to, subject: i.subject, body: i.body, dealId: d?.id, time: 'Just now' })
      return { ok: true, summary: `Emailed ${i.to}`, content: `Sent "${i.subject}" to ${i.to}.` }
    },
  },
]

export const toolByName = (name: string) => OVI_TOOLS.find((t) => t.name === name)
/** The JSON-schema tool list sent to Claude (no execute/risky). */
export const toolSchemas = () => OVI_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
