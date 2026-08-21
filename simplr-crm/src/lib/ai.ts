/* Simplr AI — an in-app reasoning engine over the CRM's mock data.
 *
 * This is a deterministic, offline stand-in for a live LLM: it parses intent from
 * the prompt and composes a structured answer from the real data in `data/mock.ts`.
 * Swap `answer()` for a call to a backend that runs Claude with tool-use over the
 * live database and the block contract below stays identical, so the UI is unchanged.
 */
import { owners } from '../data/mock'
import { live } from '../store/store'
import { buildSeed } from '../store/seed'
import type { Deal } from '../store/types'
import { money } from './format'

// Read live store state (falls back to a fresh seed before the provider mounts).
const S = () => live.state ?? buildSeed()
const getDeals = () => S().deals.filter((d) => !d.lost)
const getLeads = () => S().leads.filter((l) => !l.archived)
const getPeople = () => S().people
const getOrgs = () => S().orgs

export type WfStatus = 'pending' | 'running' | 'done'
export type WorkflowStep = { label: string; detail?: string; status: WfStatus; op?: RunOp }
export type RunOp = 'search' | 'enrich' | 'addLeads' | 'sequence' | 'campaign' | 'schedule' | 'chase'

export type AiBlock =
  | { type: 'text'; text: string }
  | { type: 'deals'; deals: Deal[] }
  | { type: 'stats'; items: { label: string; value: string; tone?: 'positive' | 'negative' | 'muted' }[] }
  | { type: 'email'; to: string; subject: string; body: string }
  | { type: 'tasks'; items: { label: string; meta: string }[] }
  | { type: 'actions'; items: { label: string }[] }
  | { type: 'workflow'; title: string; steps: WorkflowStep[] }

export type RunPlan = { count: number; vertical: string; outreach: boolean; steps: WorkflowStep[]; campaignName: string }
export type AiResponse = { blocks: AiBlock[]; suggestions?: string[]; thinking?: string; run?: RunPlan }

/* ---- Prospect generation (mock; swap for a real data provider) ---- */
const verticalCompanies: Record<string, string[]> = {
  solar: ['Helios Solar', 'SunPeak Energy', 'Brightfield', 'Voltaic Renewables', 'SolarCrest', 'Lumen Power', 'Radiance Energy', 'Meridian Solar', 'GreenRoof Co', 'Photon Grid', 'Aurora Solar', 'SunHarvest'],
  energy: ['Northwind Energy', 'Baseload Power', 'GridPoint', 'Ampere Utilities', 'Cinder Power', 'Volt Networks', 'Peak Grid', 'Currentworks'],
  'data centre': ['CoreData Centres', 'Stackscale', 'Cirrus Hosting', 'RackNorth', 'Hyperbase', 'Latency Labs'],
  logistics: ['Harbour Logistics', 'PortLink', 'FreightNorth', 'CargoWise UK', 'Palletline Co'],
  b2b: ['Acme Industrial', 'Northgate Group', 'Cavendish Holdings', 'Kingsway Ltd', 'Fenwick Group', 'Ashford Co', 'Meridian Ltd', 'Brightleaf'],
}
const dirFirst = ['James', 'Sarah', 'David', 'Priya', 'Mark', 'Elena', 'Tom', 'Rachel', 'Owen', 'Nadia', 'Sam', 'Claire', 'Ben', 'Aisha', 'Paul', 'Grace']
const dirLast = ['Whitfield', 'Barnes', 'Okoro', 'Sterling', 'Hughes', 'Voss', 'Reed', 'Marsh', 'Pryce', 'Frost', 'Idris', 'Bello', 'Kerr', 'Nash', 'Doyle', 'Lund']
const dirTitles = ['Managing Director', 'Operations Director', 'Facilities Director', 'Head of Engineering', 'Sustainability Director', 'Estates Director', 'CTO', 'Energy Manager']

export function generateProspects(count: number, vertical: string): { name: string; company: string; role: string; score: number }[] {
  const key = Object.keys(verticalCompanies).find((k) => vertical.toLowerCase().includes(k)) ?? 'b2b'
  const companies = verticalCompanies[key]
  return Array.from({ length: count }, (_, i) => ({
    name: `${dirFirst[i % dirFirst.length]} ${dirLast[(i * 3) % dirLast.length]}`,
    company: `${companies[i % companies.length]}${i >= companies.length ? ` ${Math.floor(i / companies.length) + 1}` : ''}`,
    role: dirTitles[(i * 5) % dirTitles.length],
    score: 60 + ((i * 7) % 38),
  }))
}

function detectVertical(q: string): string {
  for (const k of Object.keys(verticalCompanies)) if (q.includes(k)) return k
  if (/renewab/.test(q)) return 'solar'
  if (/utilit|power|grid/.test(q)) return 'energy'
  return 'b2b'
}

const totalOpen = () => getDeals().filter((d) => !d.won).reduce((s, d) => s + d.value, 0)
const atRisk = () => getDeals().filter((d) => !d.won && (d.health === 'At risk' || d.health === 'Stalled' || d.health === 'No next step'))

function findDeal(q: string): Deal | undefined {
  const s = q.toLowerCase()
  return getDeals().find((d) => s.includes(d.org.toLowerCase().split(' ')[0]) || d.name.toLowerCase().split(' ').some((w) => w.length > 4 && s.includes(w)))
}
function findPerson(q: string) {
  const s = q.toLowerCase()
  return getPeople().find((p) => s.includes(p.name.toLowerCase().split(' ')[0]))
}

export const starterPrompts = [
  'What should I focus on today?',
  'Which deals are at risk?',
  'Summarise the Cirrus Hosting deal',
  'Draft a follow-up email to Callum Reed',
  "How's my pipeline looking?",
  'Who hasn’t been contacted in 2 weeks?',
]

export function answer(prompt: string): AiResponse {
  const q = prompt.toLowerCase().trim()

  // 0. AI OPERATOR — prospect &/or run outreach ("find 50 solar directors and email them")
  if (/\b(find|source|prospect|get me|build a list|scrape|search for)\b/.test(q) && /(compan|director|lead|prospect|people|contact|owner|site|business|firm)/.test(q)) {
    const count = Math.min(200, Math.max(5, parseInt((q.match(/\b(\d{1,3})\b/) || [])[1] ?? '50', 10)))
    const vertical = detectVertical(q)
    const outreach = /(email|reach|outreach|contact them|message|sequence|campaign|send)/.test(q)
    const vLabel = vertical === 'b2b' ? 'B2B' : vertical.charAt(0).toUpperCase() + vertical.slice(1)
    const steps: WorkflowStep[] = [
      { label: `Searching the ${vLabel.toLowerCase()} database`, status: 'pending', op: 'search' },
      { label: 'Enriching verified emails & direct dials', status: 'pending', op: 'enrich' },
      { label: 'Adding qualified prospects to Leads', status: 'pending', op: 'addLeads' },
    ]
    if (outreach) {
      steps.push({ label: 'Drafting a 5-step email + LinkedIn sequence', status: 'pending', op: 'sequence' })
      steps.push({ label: 'Launching campaign & scheduling first send', status: 'pending', op: 'campaign' })
    }
    return {
      thinking: `Planning: ${count} ${vLabel} ${outreach ? 'prospects → outreach' : 'prospects'}…`,
      blocks: [{ type: 'text', text: `On it. I’ll ${outreach ? `find **${count} ${vLabel} decision-makers**, add them to your CRM, then draft and launch a multichannel campaign` : `find **${count} ${vLabel} decision-makers** and add them to your CRM`}. Watch it run:` }],
      run: { count, vertical, outreach, steps, campaignName: `${vLabel} outreach — AI ${new Date().toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}` },
      suggestions: outreach ? ['Schedule this to run weekly', 'Show me the campaign'] : ['Now email them', 'Schedule this weekly'],
    }
  }

  // Schedule an operator task ("every monday find 20 solar sites")
  if (/(every|each|daily|weekly|schedule|automate).*(find|prospect|chase|follow.?up|email|post)/.test(q) || /(schedule|automate) (this|that|it)/.test(q)) {
    return {
      blocks: [
        { type: 'text', text: `Done — I’ll run that on a schedule and report back each time. You can manage it under **Scheduled tasks** in Reach.` },
        { type: 'actions', items: [{ label: 'View scheduled tasks' }, { label: 'Change cadence' }] },
      ],
      run: { count: 0, vertical: 'b2b', outreach: false, steps: [{ label: 'Creating scheduled task', status: 'pending', op: 'schedule' }], campaignName: prompt.slice(0, 60) },
    }
  }

  // 1. Focus / priorities
  if (/(focus|today|priorit|what.*do|next step|morning)/.test(q)) {
    const risk = atRisk()
    return {
      thinking: 'Scanning 10 open deals, 8 activities and today’s tasks…',
      blocks: [
        { type: 'text', text: `Here’s where I’d spend your time today, Jordan. You’re **68% to quota** with 24 days left. Three things move the needle most:` },
        {
          type: 'tasks',
          items: [
            { label: 'Call Callum Reed — clear the redlines on the UPS refresh', meta: `Cirrus Hosting · ${money(415000, { compact: true })} · closes in 4 days` },
            { label: 'Send the revised quote to Ashford Utilities', meta: 'Metering & monitoring · overdue' },
            { label: 'Book a next step on the Gale Renewables deal', meta: `${money(512000, { compact: true })} · in budget review, no activity 9 days` },
          ],
        },
        { type: 'text', text: `${risk.length} deals worth **${money(risk.reduce((s, d) => s + d.value, 0), { compact: true })}** need attention. Want me to draft the follow-ups and schedule the calls?` },
        { type: 'actions', items: [{ label: 'Draft all 3 follow-ups' }, { label: 'Schedule the calls' }, { label: 'Snooze low-priority' }] },
      ],
      suggestions: ['Draft the Cirrus follow-up', 'Why is Gale Renewables at risk?'],
    }
  }

  // 2. At risk
  if (/(risk|stalled|stuck|attention|slipping|rotting)/.test(q)) {
    const risk = atRisk()
    return {
      thinking: 'Evaluating deal health signals across the pipeline…',
      blocks: [
        { type: 'text', text: `${risk.length} open deals are flagged. The pattern I see: **stalled activity and legal redlines**, not lost interest — these are recoverable.` },
        { type: 'deals', deals: risk },
        { type: 'text', text: `Biggest exposure is **Gale Renewables** at ${money(512000, { compact: true })} — stuck in budget review with no next step. I’d prioritise re-engaging their economic buyer this week.` },
        { type: 'actions', items: [{ label: 'Draft re-engagement emails' }, { label: 'Add next steps to all' }] },
      ],
      suggestions: ['Draft a re-engagement email to Gale Renewables', 'What should I focus on today?'],
    }
  }

  // 3. Draft email
  if (/(draft|write|compose|follow.?up|email|reply|reach out)/.test(q)) {
    const person = findPerson(q) ?? getPeople()[1]
    const deal = getDeals().find((d) => d.org === person.org) ?? getDeals()[8]
    return {
      thinking: `Reading the ${deal.org} thread and deal history to match tone…`,
      blocks: [
        { type: 'text', text: `Drafted a follow-up to **${person.name}** based on your last exchange and where the ${deal.name} deal stands. It’s warm, specific, and asks for the next step:` },
        {
          type: 'email',
          to: `${person.name.split(' ')[0].toLowerCase()}@${person.org.split(' ')[0].toLowerCase()}.com`,
          subject: `Next steps on the ${deal.name}`,
          body: `Hi ${person.name.split(' ')[0]},\n\nThanks again for the time on the ${deal.name}. As promised, I’ve incorporated the phased rollout and split out the maintenance retainer so finance can see it clearly.\n\nThe one open item is the liability caps — our standard is a 12-month fees cap, and I’m happy to get legal on a quick call if that helps ${person.org} move forward.\n\nCould we aim to confirm by end of next week? I’ll hold the pricing on the current quote until then.\n\nBest,\nJordan`,
        },
        { type: 'actions', items: [{ label: 'Send email' }, { label: 'Edit draft' }, { label: 'Make it shorter' }, { label: 'Log to deal' }] },
      ],
      suggestions: ['Make it more formal', 'Schedule a send for 8am tomorrow'],
    }
  }

  // 4. Summarise a specific deal
  if (/(summar|tell me about|brief|status of|where.*at|overview)/.test(q)) {
    const deal = findDeal(q) ?? getDeals()[8]
    return {
      thinking: `Reading ${deal.org}: 4 activities, 2 contacts, 3 emails and 1 quote…`,
      blocks: [
        { type: 'text', text: `**${deal.name}** — ${deal.org}` },
        {
          type: 'stats',
          items: [
            { label: 'Value', value: money(deal.value) },
            { label: 'Stage', value: deal.stage },
            { label: 'Close', value: deal.closeDate },
            { label: 'Health', value: deal.health, tone: deal.health === 'Healthy' ? 'positive' : 'negative' },
          ],
        },
        { type: 'text', text: `Owned by ${deal.owner}. The deal has a **verbal yes** and a champion (Callum Reed, CTO), but is gated on **legal redlines** around liability caps and **procurement sign-off** from the CFO. Momentum is good — 3 activities in the last week. Probability ~65%.\n\n**Next best action:** get procurement sign-off; I’d offer a joint legal call to unblock the caps.` },
        { type: 'actions', items: [{ label: 'Open deal' }, { label: 'Draft the legal-call email' }, { label: 'Add task: chase procurement' }] },
      ],
      suggestions: [`Draft a follow-up for ${deal.org}`, `What’s blocking ${deal.org}?`],
    }
  }

  // 5. Pipeline / forecast
  if (/(pipeline|forecast|quota|how.*doing|numbers|revenue|target)/.test(q)) {
    const open = getDeals().filter((d) => !d.won)
    return {
      thinking: 'Aggregating pipeline by stage and applying win-probability weights…',
      blocks: [
        { type: 'text', text: `Your pipeline is **healthy but back-loaded** — most value sits in late stages, which is good for the quarter but thin for next.` },
        {
          type: 'stats',
          items: [
            { label: 'Open pipeline', value: money(totalOpen(), { compact: true }) },
            { label: 'Weighted', value: money(Math.round(totalOpen() * 0.33), { compact: true }) },
            { label: 'Open deals', value: String(open.length) },
            { label: 'To quota', value: '68%', tone: 'muted' },
          ],
        },
        { type: 'text', text: `Two deals — Gale Renewables and Cirrus Hosting — make up **${money(927000, { compact: true })}** (40% of open). That’s concentration risk: if either slips, the quarter wobbles. I’d de-risk by advancing 2–3 mid-stage deals in parallel.` },
        { type: 'actions', items: [{ label: 'Show me the mid-stage deals' }, { label: 'Build a forecast summary' }] },
      ],
      suggestions: ['Which deals are at risk?', 'What should I focus on today?'],
    }
  }

  // 6. Not contacted / cold
  if (/(cold|not contacted|no activity|haven.?t|neglect|stale|forgotten)/.test(q)) {
    const cold = getDeals().filter((d) => d.health === 'No next step' || d.health === 'Stalled' || d.health === 'At risk')
    return {
      blocks: [
        { type: 'text', text: `These accounts have gone quiet — no logged activity in 10+ days. Re-engaging early beats chasing them at close:` },
        { type: 'deals', deals: cold },
        { type: 'actions', items: [{ label: 'Draft check-in emails to all' }, { label: 'Add a task for each' }] },
      ],
      suggestions: ['Draft check-in emails to all', 'What should I focus on today?'],
    }
  }

  // 7. Counts / who owns what
  if (/(how many|count|list|show|find|who)/.test(q)) {
    return {
      blocks: [
        { type: 'text', text: `Right now you have **${getDeals().filter((d) => !d.won).length} open deals** worth ${money(totalOpen(), { compact: true })}, **${getLeads().length} leads**, **${getPeople().length} contacts** and **${getOrgs().length} organisations** across ${owners.length} owners. What would you like to see?` },
        { type: 'actions', items: [{ label: 'My open deals' }, { label: 'High-score leads' }, { label: 'Accounts up for renewal' }] },
      ],
      suggestions: starterPrompts.slice(0, 3),
    }
  }

  // Fallback
  return {
    blocks: [
      { type: 'text', text: `I can act on your CRM directly — analyse the pipeline, draft and send emails, summarise deals, prep for meetings, build reports, or run a workflow for you. Try one of these:` },
      { type: 'actions', items: starterPrompts.slice(0, 4).map((label) => ({ label })) },
    ],
    suggestions: starterPrompts.slice(4),
  }
}
