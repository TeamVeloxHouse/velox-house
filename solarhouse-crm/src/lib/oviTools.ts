/* The tool surface Ovi (the real Claude operator) can call to run the CRM.
 * Each tool maps to the same store action a button calls — so Ovi has exactly a
 * user's power, and because the UI is reactive, you watch changes happen live.
 * Phase A: a high-value slice. Phase B extends this registry to every action.
 */
import { live } from '../store/store'
import type { useActions } from '../store/store'
import type { StageName } from '../data/mock'
import { generateProspects } from './ai'
import { INDUSTRY_TEMPLATES } from './pipelines'
import { effectiveDueDate, isTask } from './tasks'
import { STATUS_LABEL } from './dno'

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
const findPortal = (ref: string) => S().portals.find((p) => p.id === ref) || S().portals.find((p) => p.customer.toLowerCase().includes((ref || '').toLowerCase()))
const findJob = (ref: string) => S().jobs.find((j) => j.id === ref || j.ref === ref) || S().jobs.find((j) => `${j.title} ${j.customer}`.toLowerCase().includes((ref || '').toLowerCase()))
const findProject = (ref: string) => {
  const r = (ref || '').toLowerCase()
  const ps = S().projects
  return ps.find((p) => p.id === ref) || ps.find((p) => `${p.address} ${p.customer}`.toLowerCase().includes(r)) ||
    ps.find((p) => p.address.toLowerCase().split(/[ ,]+/).some((w) => w.length > 3 && r.includes(w)))
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const findChannel = (ref: string) => S().teamChannels.find((c) => c.id === ref) || S().teamChannels.find((c) => c.name.toLowerCase().includes((ref || '').toLowerCase()))

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

  // ── deals: detail + update ──
  {
    name: 'deal_detail', description: 'Get full detail on one deal, including its recent activity.',
    input_schema: { type: 'object', properties: { deal: { type: 'string' } }, required: ['deal'] },
    execute: (i) => {
      const d = findDeal(i.deal); if (!d) return { ok: false, summary: 'Not found', content: `No deal matching "${i.deal}".` }
      const acts = S().activities.filter((a) => a.dealId === d.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6).map((a) => `• ${a.subject}`).join('\n')
      const contacts = S().people.filter((p) => d.personIds.includes(p.id)).map((p) => p.name).join(', ')
      return { ok: true, summary: d.name, content: `${d.name} (${d.org}) — ${money(d.value)}, ${d.stage}, ${d.probability}%, health ${d.health}${d.won ? ', WON' : d.lost ? ', LOST' : ''}. Contacts: ${contacts || 'none'}. Recent:\n${acts || 'no activity'}` }
    },
  },
  {
    name: 'update_deal', description: 'Update a deal’s value, probability, expected close date or owner.',
    input_schema: { type: 'object', properties: { deal: { type: 'string' }, value: { type: 'number' }, probability: { type: 'number' }, closeDate: { type: 'string' }, owner: { type: 'string' } }, required: ['deal'] },
    execute: (i, ctx) => {
      const d = findDeal(i.deal); if (!d) return { ok: false, summary: 'Not found', content: `No deal matching "${i.deal}".` }
      const patch: any = {}
      if (i.value != null) patch.value = Number(i.value)
      if (i.probability != null) patch.probability = Number(i.probability)
      if (i.closeDate) patch.closeDate = i.closeDate
      if (i.owner) patch.owner = i.owner
      ctx.act.updateDeal(d.id, patch); ctx.act.toast('Deal updated'); ctx.nav(`/deals/${d.id}`)
      return { ok: true, summary: `Updated ${d.org}`, content: `Updated ${d.name}: ${Object.keys(patch).join(', ') || 'nothing'}.` }
    },
  },

  // ── leads ──
  {
    name: 'set_lead_status', description: 'Set a lead’s lifecycle status (new, working, nurturing, qualified, unqualified).',
    input_schema: { type: 'object', properties: { lead: { type: 'string' }, status: { type: 'string', enum: ['new', 'working', 'nurturing', 'qualified', 'unqualified'] } }, required: ['lead', 'status'] },
    execute: (i, ctx) => {
      const l = findLead(i.lead); if (!l) return { ok: false, summary: 'Not found', content: `No lead matching "${i.lead}".` }
      ctx.act.setLeadStatus(l.id, i.status, l.name)
      return { ok: true, summary: `${l.name} → ${i.status}`, content: `Set ${l.name} to ${i.status}.` }
    },
  },

  // ── contacts / orgs ──
  {
    name: 'add_org', description: 'Add an organisation (company).',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, industry: { type: 'string' } }, required: ['name'] },
    execute: (i, ctx) => { const o = ctx.act.addOrg({ name: i.name, industry: i.industry }); return { ok: true, summary: `Org: ${o.name}`, content: `Added organisation ${o.id} — ${o.name}.` } },
  },
  {
    name: 'list_people', description: 'List contacts, optionally filtered by a text query.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } } },
    execute: (i) => {
      let ps = S().people
      if (i.query) ps = ps.filter((p) => `${p.name} ${p.org} ${p.role}`.toLowerCase().includes(String(i.query).toLowerCase()))
      return { ok: true, summary: `${ps.length} contacts`, content: ps.slice(0, 25).map((p) => `${p.id} · ${p.name} — ${p.role || '—'} at ${p.org}`).join('\n') || 'None.' }
    },
  },

  // ── tasks / activities ──
  {
    name: 'list_tasks', description: 'List open tasks, optionally for a specific teammate.',
    input_schema: { type: 'object', properties: { assignee: { type: 'string' } } },
    execute: (i) => {
      const mid = memberIdByName(i.assignee)
      let ts = S().activities.filter((a) => isTask(a) && !a.done)
      if (mid) ts = ts.filter((a) => a.assigneeIds?.includes(mid))
      const rows = ts.slice(0, 25).map((a) => `${a.id} · ${a.subject} · due ${effectiveDueDate(a) || a.due || '—'} · ${a.priority || '—'}`)
      return { ok: true, summary: `${ts.length} open tasks`, content: rows.join('\n') || 'No open tasks.' }
    },
  },
  {
    name: 'complete_task', description: 'Mark a task as done. Identify by its exact text/subject.',
    input_schema: { type: 'object', properties: { task: { type: 'string', description: 'task id or subject text' } }, required: ['task'] },
    execute: (i, ctx) => {
      const t = S().activities.find((a) => a.id === i.task) || S().activities.find((a) => isTask(a) && !a.done && a.subject.toLowerCase().includes(String(i.task).toLowerCase()))
      if (!t) return { ok: false, summary: 'Not found', content: `No open task matching "${i.task}".` }
      ctx.act.toggleActivity(t.id); ctx.act.toast('Task completed')
      return { ok: true, summary: `Done: ${t.subject}`, content: `Marked "${t.subject}" complete.` }
    },
  },

  // ── calendar / meetings ──
  {
    name: 'schedule_meeting', description: 'Schedule a meeting (adds it to the calendar).',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, when: { type: 'string', description: 'human time e.g. Tomorrow 2pm' }, org: { type: 'string' }, date: { type: 'string', description: 'ISO yyyy-mm-dd' }, start: { type: 'string', description: 'HH:MM' } }, required: ['title'] },
    execute: (i, ctx) => {
      const m = ctx.act.addMeeting({ title: i.title, when: i.when || 'Soon', dealOrg: i.org || '', date: i.date, start: i.start, status: 'upcoming' })
      ctx.nav('/calendar')
      return { ok: true, summary: `Meeting: ${m.title}`, content: `Scheduled "${m.title}"${i.when ? ` (${i.when})` : ''}.` }
    },
  },

  // ── jobs (field ops) ──
  {
    name: 'book_job', description: 'Book a field job (survey, showroom, install, service, remedial), optionally linked to a deal.',
    input_schema: { type: 'object', properties: { kind: { type: 'string', enum: ['survey', 'showroom', 'install', 'service', 'remedial'] }, title: { type: 'string' }, customer: { type: 'string' }, address: { type: 'string' }, date: { type: 'string', description: 'ISO yyyy-mm-dd' }, deal: { type: 'string' } }, required: ['kind', 'title', 'customer'] },
    execute: (i, ctx) => {
      const d = i.deal ? findDeal(i.deal) : undefined
      const j = ctx.act.addJob({ kind: i.kind, title: i.title, customer: i.customer, address: i.address, date: i.date, dealId: d?.id })
      ctx.nav('/jobs')
      return { ok: true, summary: `${j.ref} booked`, content: `Booked ${j.ref} — ${j.title} for ${j.customer}${i.date ? ` on ${i.date}` : ' (unscheduled)'}.` }
    },
  },
  {
    name: 'list_jobs', description: 'List field jobs, optionally by status.',
    input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['unscheduled', 'scheduled', 'in-progress', 'complete', 'cancelled'] } } },
    execute: (i) => {
      let js = S().jobs
      if (i.status) js = js.filter((j) => j.status === i.status)
      return { ok: true, summary: `${js.length} jobs`, content: js.slice(0, 25).map((j) => `${j.ref} · ${j.title} · ${j.customer} · ${j.date ?? 'unscheduled'} · ${j.status}`).join('\n') || 'None.' }
    },
  },

  // ── forecast (read) ──
  {
    name: 'forecast_summary', description: 'Get the revenue forecast: closed, commit, best case, and quota coverage.',
    input_schema: { type: 'object', properties: {} },
    execute: () => {
      const ds = S().deals.filter((d) => !d.lost)
      const proposalIdx = stageNames().indexOf('Proposal Made')
      const quoted = (d: any) => d.quoted || (proposalIdx >= 0 && stageNames().indexOf(d.stage) >= proposalIdx)
      const cat = (d: any) => d.won ? 'closed' : quoted(d) && d.probability >= 60 ? 'commit' : d.probability >= 40 ? 'best' : 'pipeline'
      const sum = (c: string) => ds.filter((d) => cat(d) === c).reduce((s, d) => s + d.value, 0)
      const closed = sum('closed'), commit = sum('commit'), best = sum('best')
      const committed = closed + commit
      return { ok: true, summary: `Commit ${money(committed)}`, content: `Closed ${money(closed)}, Commit ${money(committed)} (closed + high-confidence quoted), Best case ${money(committed + best)}. Quota £1.1M — ${Math.round((committed / 1_100_000) * 100)}% covered.` }
    },
  },

  // ── inbox ──
  {
    name: 'set_inbox_auto_reply', description: 'Set Ovi’s inbox auto-reply mode: off, draft (queue for approval), or send (auto-send).',
    input_schema: { type: 'object', properties: { mode: { type: 'string', enum: ['off', 'draft', 'send'] } }, required: ['mode'] },
    execute: (i, ctx) => { ctx.act.setAutoReply(i.mode); ctx.nav('/inbox'); return { ok: true, summary: `Auto-reply: ${i.mode}`, content: `Set inbox auto-reply to ${i.mode}.` } },
  },

  // ── pipelines ──
  {
    name: 'create_pipeline', description: 'Create a new pipeline from an industry template.',
    input_schema: { type: 'object', properties: { template: { type: 'string', enum: INDUSTRY_TEMPLATES.map((t) => t.key) }, name: { type: 'string' } }, required: ['template'] },
    execute: (i, ctx) => { const p = ctx.act.addPipelineFromTemplate(i.template, i.name); if (!p) return { ok: false, summary: 'Unknown template', content: `Templates: ${INDUSTRY_TEMPLATES.map((t) => t.key).join(', ')}.` }; ctx.nav('/deals'); return { ok: true, summary: `Pipeline: ${p.name}`, content: `Created pipeline "${p.name}" and made it active.` } },
  },

  // ── customer portals ──
  {
    name: 'list_portals', description: 'List customer portals.',
    input_schema: { type: 'object', properties: {} },
    execute: () => ({ ok: true, summary: `${S().portals.length} portals`, content: S().portals.map((p) => `${p.id} · ${p.customer} · ${p.systemKwp} kWp · ${p.status}`).join('\n') || 'None.' }),
  },
  {
    name: 'send_portal_invite', description: 'Email a customer their portal login. Identify by portal id or customer name.',
    input_schema: { type: 'object', properties: { portal: { type: 'string' } }, required: ['portal'] },
    execute: (i, ctx) => { const p = findPortal(i.portal); if (!p) return { ok: false, summary: 'Not found', content: `No portal matching "${i.portal}".` }; ctx.act.sendPortalInvite(p); return { ok: true, summary: `Invited ${p.customer}`, content: `Emailed the portal invite to ${p.customer}.` } },
  },
  {
    name: 'add_manual', description: 'Add a product manual to the customer resource library (Ovi reads it to help customers). Global unless a portal is given.',
    input_schema: { type: 'object', properties: { title: { type: 'string' }, manufacturer: { type: 'string' }, content: { type: 'string', description: 'the manual/troubleshooting text' }, portal: { type: 'string' } }, required: ['title'] },
    execute: (i, ctx) => {
      const p = i.portal ? findPortal(i.portal) : undefined
      ctx.act.addResource({ type: 'manual', title: i.title, manufacturer: i.manufacturer, desc: `${i.manufacturer || 'Product'} manual`, content: i.content, global: !p, portalId: p?.id })
      return { ok: true, summary: `Manual: ${i.title}`, content: `Added "${i.title}" to the resource library.` }
    },
  },

  // ── prospecting (Reach) ──
  {
    name: 'find_prospects', description: 'Find and add new prospects to Leads (vertical e.g. solar, b2b; count).',
    input_schema: { type: 'object', properties: { vertical: { type: 'string' }, count: { type: 'number' } }, required: ['vertical'] },
    execute: (i, ctx) => {
      const n = Math.min(200, Math.max(1, Number(i.count) || 25))
      const rows = generateProspects(n, i.vertical).map((p: any) => ({ name: p.name, company: p.company, role: p.role, score: p.score }))
      ctx.act.bulkAddLeads(rows, 'Ovi sourced'); ctx.act.toast(`${n} prospects added to Leads`); ctx.nav('/leads')
      return { ok: true, summary: `${n} prospects added`, content: `Sourced and added ${n} ${i.vertical} prospects to Leads.` }
    },
  },
  {
    name: 'launch_campaign', description: 'Launch a multichannel outreach campaign to a fresh prospect list.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, vertical: { type: 'string' }, count: { type: 'number' } }, required: ['name', 'vertical'] },
    execute: (i, ctx) => {
      const n = Math.min(200, Math.max(1, Number(i.count) || 25))
      const rows = generateProspects(n, i.vertical).map((p: any) => ({ name: p.name, company: p.company }))
      const c = ctx.act.createReachCampaign(i.name, i.vertical, rows); ctx.nav('/reach/campaigns')
      return { ok: true, summary: `Campaign: ${c.name}`, content: `Launched "${c.name}" to ${n} ${i.vertical} prospects — email + LinkedIn.` }
    },
  },

  // ── DNO Autopilot (Studio delivery) ──
  {
    name: 'list_dno_applications', description: 'List DNO (grid connection) applications across delivery projects, with form, status and reference.',
    input_schema: { type: 'object', properties: {} },
    execute: () => {
      const apps = S().projects.filter((p) => p.dno)
      if (!apps.length) return { ok: true, summary: 'No DNO applications', content: 'No delivery project has a DNO application yet.' }
      return { ok: true, summary: `${apps.length} DNO applications`, content: apps.map((p) => `${p.address} · ${p.dno!.form} · ${STATUS_LABEL[p.dno!.status]}${p.dno!.reference ? ` · ${p.dno!.reference}` : ''}`).join('\n') }
    },
  },
  {
    name: 'queue_dno_application', description: 'Prepare / queue the DNO (grid connection) application for a delivery project — reads the survey & design, classifies the connection (G98/G99), builds the SLD and pack, ready to sign. Identify the project by address or customer.',
    input_schema: { type: 'object', properties: { project: { type: 'string', description: 'project address, customer name, or id' } }, required: ['project'] },
    execute: (i, ctx) => {
      const p = findProject(i.project)
      if (!p) return { ok: false, summary: 'Project not found', content: `No delivery project matching "${i.project}".` }
      ctx.nav(`/studio/delivery/${p.id}#dno`)
      const dno = ctx.act.startDnoRun(p.id) // classifies now; the DNO tab streams + finishes the pack
      return { ok: true, summary: `${dno?.classification ?? 'DNO'} ready`, content: `Preparing the DNO application for ${p.address} — classified ${dno?.classification ?? ''} (aggregate RC ${dno?.aggregateRcA ?? '?'} A, ${dno?.dnoRegion ?? ''}). It's streaming on the DNO tab and will finish with the SLD and pack ready to sign.` }
    },
  },

  // ── delivery / projects (Deliver) ──
  {
    name: 'list_projects', description: 'List delivery projects (installs) with milestone progress. Use to find a project before acting on it.',
    input_schema: { type: 'object', properties: {} },
    execute: () => {
      const ps = S().projects
      return { ok: true, summary: `${ps.length} projects`, content: ps.slice(0, 25).map((p) => `${p.id} · ${p.address} · ${p.customer} · ${p.milestones[p.milestoneIndex]?.label ?? '—'} (${p.milestoneIndex + 1}/${p.milestones.length})`).join('\n') || 'No delivery projects.' }
    },
  },
  {
    name: 'advance_delivery', description: 'Advance a delivery project to its next milestone (e.g. survey → install → commissioning → PTO). Identify by address, customer or id.',
    input_schema: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] },
    execute: (i, ctx) => {
      const p = findProject(i.project); if (!p) return { ok: false, summary: 'Project not found', content: `No delivery project matching "${i.project}".` }
      if (p.milestoneIndex >= p.milestones.length - 1) return { ok: false, summary: 'At final milestone', content: `${p.address} is already at ${p.milestones[p.milestoneIndex]?.label ?? 'the end'}.` }
      const next = p.milestones[Math.min(p.milestones.length - 1, p.milestoneIndex + 1)]?.label
      ctx.act.advanceMilestone(p); ctx.nav(`/studio/delivery/${p.id}`)
      return { ok: true, summary: `${p.address} → ${next}`, content: `Advanced ${p.address} to ${next}.` }
    },
  },
  {
    name: 'report_customer_issue', description: 'Log a problem a customer reported as a traceable service job for the field team. Identify the customer by portal id or name.',
    input_schema: { type: 'object', properties: { customer: { type: 'string', description: 'portal id or customer name' }, item: { type: 'string', description: 'what the issue is about, e.g. Inverter fault' }, description: { type: 'string' } }, required: ['customer', 'item'] },
    execute: (i, ctx) => {
      const p = findPortal(i.customer); if (!p) return { ok: false, summary: 'Customer not found', content: `No customer portal matching "${i.customer}".` }
      ctx.act.reportPortalIssue(p, i.item, i.description || i.item); ctx.nav('/customers/support')
      return { ok: true, summary: `Issue logged for ${p.customer}`, content: `Raised a service job for ${p.customer} — ${i.item}. It's in the field backlog and on the deal timeline.` }
    },
  },

  // ── invoicing (Business / Finance) ──
  {
    name: 'create_invoice', description: 'Raise an invoice on a delivery project. Creates the invoice record (does not take payment). Identify the project by address, customer or id.',
    input_schema: { type: 'object', properties: { project: { type: 'string' }, amount: { type: 'number' }, kind: { type: 'string', enum: ['deposit', 'interim', 'final', 'other'] }, status: { type: 'string', enum: ['draft', 'sent'] } }, required: ['project', 'amount'] },
    execute: (i, ctx) => {
      const p = findProject(i.project); if (!p) return { ok: false, summary: 'Project not found', content: `No delivery project matching "${i.project}".` }
      const n = (p.invoices?.length ?? 0) + 1
      const number = `INV-${(p.id.replace(/[^0-9]/g, '').slice(-4) || '0000')}-${n}`
      ctx.act.addInvoice(p.id, { id: `inv_${Date.now()}`, number, kind: (i.kind || 'deposit') as import('../store/types').InvoiceKind, amount: Number(i.amount) || 0, status: (i.status || 'draft') as import('../store/types').InvoiceStatus, issuedDate: today() })
      ctx.nav(`/studio/delivery/${p.id}`)
      return { ok: true, summary: `Invoice ${number}`, content: `Raised a ${i.kind || 'deposit'} invoice ${number} for ${money(Number(i.amount) || 0)} on ${p.address} (${i.status || 'draft'}).` }
    },
  },

  // ── team space (OviTeams — act in the conversation) ──
  {
    name: 'post_team_message', description: 'Post a message into a team chat channel as Ovi — to report a result, flag something, or answer the team. Identify the channel by name.',
    input_schema: { type: 'object', properties: { channel: { type: 'string', description: 'channel name e.g. leadership, sales' }, text: { type: 'string' } }, required: ['channel', 'text'] },
    execute: (i, ctx) => {
      const c = findChannel(i.channel); if (!c) return { ok: false, summary: 'Channel not found', content: `No channel matching "${i.channel}". Channels: ${S().teamChannels.map((x) => x.name).join(', ')}.` }
      ctx.act.postAiMessage(c.id, i.text); ctx.nav('/team')
      return { ok: true, summary: `Posted to #${c.name}`, content: `Posted to #${c.name}: "${i.text}".` }
    },
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
    name: 'delete_deal', description: 'Permanently delete a deal. Requires user approval.', risky: true,
    input_schema: { type: 'object', properties: { deal: { type: 'string' } }, required: ['deal'] },
    execute: async (i, ctx) => {
      const d = findDeal(i.deal); if (!d) return { ok: false, summary: 'Not found', content: `No deal matching "${i.deal}".` }
      if (!(await ctx.confirm(`Delete “${d.name}” (${money(d.value)})? This can’t be undone.`))) return { ok: false, summary: 'Declined', content: 'User declined.' }
      ctx.act.removeDeal(d.id, d.name); ctx.nav('/deals')
      return { ok: true, summary: `Deleted ${d.org}`, content: `Deleted ${d.name}.` }
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
