import { deals as mDeals, people as mPeople, orgs as mOrgs, leads as mLeads } from '../data/mock'
import type { State, Deal, Person, Activity, EmailMsg, Meeting, Agent, AgentRun, Connection, CustomField, Webhook, ApiKey, Integration, SocialPost } from './types'

const now = Date.now()
const mins = (m: number) => now - m * 60_000
const hrs = (h: number) => now - h * 3_600_000
const days = (d: number) => now - d * 86_400_000

function emailFor(name: string, org: string) {
  return `${name.split(' ')[0].toLowerCase()}@${org.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}.com`
}

export function buildSeed(): State {
  const orgs = mOrgs.map((o) => ({ ...o }))
  const orgByName = (name: string) => orgs.find((o) => o.name === name)?.id

  const people: Person[] = mPeople.map((p) => ({
    ...p,
    orgId: orgByName(p.org),
    email: emailFor(p.name, p.org),
    labels: p.id === 'p2' ? ['Champion', 'Decision maker'] : p.id === 'p1' ? ['Facilities'] : [],
  }))

  const deals: Deal[] = mDeals.map((d) => ({
    ...d,
    orgId: orgByName(d.org),
    personIds: people.filter((p) => p.org === d.org).map((p) => p.id),
    probability: { Qualified: 20, 'Contact Made': 35, 'Demo Scheduled': 55, 'Proposal Made': 70, 'Negotiations Started': 85 }[d.stage] ?? 40,
  }))

  const dealByOrg = (org: string) => deals.find((d) => d.org === org)
  const personByName = (n: string) => people.find((p) => p.name === n)

  const activities: Activity[] = [
    // Cirrus / UPS refresh timeline
    { id: 'act1', type: 'call', subject: 'Discovery call with Callum Reed', body: 'Walked through the UPS refresh scope. Strong technical fit; procurement sign-off is the gate.', dealId: 'd9', personId: 'p2', done: true, who: 'Jordan Miles', createdAt: hrs(2), source: 'manual' },
    { id: 'act2', type: 'email', subject: 'Sent revised proposal v3', body: 'Included phased rollout option and the maintenance retainer line item.', dealId: 'd9', personId: 'p2', done: true, who: 'Jordan Miles', createdAt: days(1), source: 'email' },
    { id: 'act3', type: 'change', subject: 'Stage moved to Negotiations Started', body: 'From Proposal Made · deal value updated to $415,000.', dealId: 'd9', done: true, who: 'System', createdAt: days(2) },
    { id: 'act4', type: 'note', subject: 'Note added', body: 'Legal flagged two redline clauses on liability caps. Nothing dealbreaking.', dealId: 'd9', personId: 'p2', done: true, who: 'Priya Nair', createdAt: days(3), source: 'manual' },
    // open tasks
    { id: 'act5', type: 'call', subject: 'Call Callum re: redlines', dealId: 'd9', personId: 'p2', due: 'Today · 16:00', done: false, priority: 'High', who: 'Jordan Miles', createdAt: mins(30) },
    { id: 'act6', type: 'task', subject: 'Send updated SOW', dealId: 'd9', due: 'Tomorrow', done: false, priority: 'Medium', who: 'Jordan Miles', createdAt: hrs(4) },
    { id: 'act7', type: 'task', subject: 'Send revised quote', dealId: 'd7', personId: 'p4', due: '2 days overdue', done: false, priority: 'High', who: 'Marcus Webb', createdAt: days(2) },
    { id: 'act8', type: 'meeting', subject: 'Microgrid proposal review', dealId: 'd8', personId: 'p3', due: 'Tomorrow · 10:00', done: false, priority: 'Medium', who: 'Priya Nair', createdAt: hrs(6) },
    { id: 'act9', type: 'call', subject: 'Discovery — Meridian', dealId: 'd1', personId: 'p1', due: 'Thu · 09:30', done: false, priority: 'Low', who: 'Jordan Miles', createdAt: hrs(8) },
    { id: 'act10', type: 'task', subject: 'Confirm site survey', dealId: 'd3', personId: 'p5', due: 'Fri', done: false, who: 'Jordan Miles', createdAt: days(1) },
    { id: 'act11', type: 'task', subject: 'Chase PO', dealId: 'd6', personId: 'p6', due: '5 days overdue', done: false, priority: 'High', who: 'Marcus Webb', createdAt: days(5) },
    { id: 'act12', type: 'call', subject: 'Call · 12 min', dealId: 'd1', personId: 'p1', done: true, who: 'Jordan Miles', createdAt: hrs(2) },
    { id: 'act13', type: 'email', subject: 'Email opened', personId: 'p2', dealId: 'd9', done: true, who: 'System', createdAt: hrs(4) },
  ]

  const emails: EmailMsg[] = [
    { id: 'em1', folder: 'inbox', from: 'Callum Reed', fromEmail: 'callum@cirrus.com', to: 'jordan@simplr.io', subject: 'Re: Revised proposal v3', body: 'Hi Jordan,\n\nThis looks good — the phased rollout is exactly what we needed to make the numbers work for this budget cycle. Marta wants to see where legal landed on the liability caps before we sign off, so if you can flag that in the SOW it would speed things along.\n\nWe’re aiming to have a decision by the end of next week. Appreciate the quick turnaround on v3.\n\nBest,\nCallum', dealId: 'd9', personId: 'p2', dealLabel: 'UPS refresh', unread: true, time: '09:41', createdAt: mins(45) },
    { id: 'em2', folder: 'inbox', from: 'Elena Voss', fromEmail: 'elena@meridian.com', to: 'jordan@simplr.io', subject: 'Site access for survey', body: 'We can offer Thursday morning or Friday afternoon for the team to come in and assess the substation. Let me know what suits.', dealId: 'd1', personId: 'p1', dealLabel: 'Substation upgrade', unread: true, time: '08:12', createdAt: hrs(3) },
    { id: 'em3', folder: 'inbox', from: 'Sam Idris', fromEmail: 'sam@fenwick.com', to: 'jordan@simplr.io', subject: 'Budget approval update', body: 'Finance committee meets next week — I’ll push for a decision then.', dealId: 'd8', personId: 'p3', dealLabel: 'Campus microgrid', time: 'Yesterday', createdAt: days(1) },
    { id: 'em4', folder: 'inbox', from: 'Owen Pryce', fromEmail: 'owen@staidan.com', to: 'jordan@simplr.io', subject: 'Maintenance terms', body: 'Can we extend the retainer to cover the standby generators as well?', dealId: 'd4', personId: 'p4', dealLabel: 'Generator retrofit', time: 'Yesterday', createdAt: days(1) },
    { id: 'em5', folder: 'inbox', from: 'Dana Kirk', fromEmail: 'dana@brightleaf.com', to: 'jordan@simplr.io', subject: 'Panel spec question', body: 'What’s the degradation warranty on the modules you quoted?', dealId: 'd3', personId: 'p5', dealLabel: 'Solar + storage', time: 'Mon', createdAt: days(3) },
  ]

  const meetings: Meeting[] = [
    { id: 'mtg1', title: 'UPS refresh — legal & scope call', platform: 'Teams', when: 'Today · 16:00', dealOrg: 'Cirrus Hosting', dealId: 'd9', personId: 'p2', attendees: ['Callum Reed', 'Marta Lund', 'Jordan Miles'], status: 'live', bot: true, duration: '18:42' },
    { id: 'mtg2', title: 'Microgrid proposal review', platform: 'Google Meet', when: 'Tomorrow · 10:00', dealOrg: 'Fenwick University', dealId: 'd8', personId: 'p3', attendees: ['Sam Idris', 'Jordan Miles'], status: 'upcoming', bot: true },
    { id: 'mtg3', title: 'Discovery — substation upgrade', platform: 'Teams', when: 'Thu · 09:30', dealOrg: 'Meridian Power', dealId: 'd1', personId: 'p1', attendees: ['Elena Voss', 'Jordan Miles'], status: 'upcoming', bot: false },
    { id: 'mtg4', title: 'Solar + storage kickoff', platform: 'Zoom', when: 'Mon · 14:00', dealOrg: 'Brightleaf Farms', dealId: 'd3', personId: 'p5', attendees: ['Dana Kirk', 'Jordan Miles', 'Priya Nair'], status: 'recorded', bot: true, duration: '42:10' },
    { id: 'mtg5', title: 'Renewal check-in', platform: 'Google Meet', when: 'Last Fri', dealOrg: 'Northgate Rail', dealId: 'd6', personId: 'p6', attendees: ['Nadia Frost', 'Jordan Miles'], status: 'recorded', bot: true, duration: '27:55' },
  ]

  const agents: Agent[] = [
    { id: 'ag1', name: 'Inbox triage', desc: 'Reads new email, links to deals, drafts replies', runs: '48 today', on: true },
    { id: 'ag2', name: 'Deal-risk watch', desc: 'Flags stalls and suggests recovery plays', runs: '6 alerts', on: true },
    { id: 'ag3', name: 'Meeting notetaker', desc: 'Joins calls, transcribes, updates cards', runs: '3 this week', on: true },
    { id: 'ag4', name: 'Lead qualifier', desc: 'Scores & routes inbound leads', runs: '12 today', on: true },
    { id: 'ag5', name: 'Follow-up chaser', desc: 'Nudges deals with no next step', runs: 'Paused', on: false },
  ]

  const agentRuns: AgentRun[] = [
    { id: 'ar1', agent: 'Inbox triage', kind: 'draft', title: 'Drafted reply to Callum Reed', detail: 'Re: Revised proposal v3 — addresses the liability-cap question and proposes a legal call. Ready to review and send.', when: mins(20), status: 'pending', dealId: 'd9', personId: 'p2', emailTo: 'callum@cirrus.com', emailBody: 'Hi Callum,\n\nThanks for the quick turnaround. On the liability caps: our standard is a 12-month fees cap and I’ve reflected that in the SOW. Happy to get legal on a short call this week to close it out.\n\nBest,\nJordan' },
    { id: 'ar2', agent: 'Deal-risk watch', kind: 'risk', title: 'Gale Renewables has gone quiet', detail: 'No activity in 9 days on a $512K deal stuck in budget review. Recommend a re-engagement email to the economic buyer.', when: hrs(2), status: 'pending', dealId: 'd10' },
    { id: 'ar3', agent: 'Follow-up chaser', kind: 'task', title: 'Suggested task: chase PO on Northgate Rail', detail: 'HV cabling deal has an overdue step. Create a task to chase the purchase order?', when: hrs(3), status: 'pending', dealId: 'd6', personId: 'p6' },
    { id: 'ar4', agent: 'Lead qualifier', kind: 'triage', title: 'Qualified & routed 3 new leads', detail: 'Scored Elena Voss (88), Callum Reed (91) and Sam Idris (82) as high-intent and assigned to Jordan.', when: hrs(5), status: 'approved' },
    { id: 'ar5', agent: 'Meeting notetaker', kind: 'summary', title: 'Summarised the Brightleaf kickoff', detail: 'Wrote notes + 3 action items to Brightleaf Farms after the recorded call.', when: days(1), status: 'approved', dealId: 'd3', personId: 'p5' },
    { id: 'ar6', agent: 'Inbox triage', kind: 'enrich', title: 'Enriched Cirrus Hosting', detail: 'Added firmographics (250 staff, £48M revenue) and 2 stakeholders from public sources.', when: days(1), status: 'approved', personId: 'p2' },
  ]

  const connections: Connection[] = [
    { id: 'cn1', kind: 'email', provider: 'Microsoft 365', account: 'jordan@simplr.io', connected: true, color: '#0078D4', protocol: 'oauth' },
    { id: 'cn2', kind: 'email', provider: 'Gmail', account: 'j.miles@gmail.com', connected: true, color: '#EA4335', protocol: 'oauth' },
    { id: 'cn3', kind: 'email', provider: 'IMAP / SMTP', connected: false, color: '#5D6878', protocol: 'imap' },
    { id: 'cn4', kind: 'meeting', provider: 'Teams', account: 'jordan@simplr.io', connected: true, color: '#5059C9', protocol: 'oauth' },
    { id: 'cn5', kind: 'meeting', provider: 'Google Meet', account: 'jordan@simplr.io', connected: true, color: '#00897B', protocol: 'oauth' },
    { id: 'cn6', kind: 'meeting', provider: 'Zoom', connected: false, color: '#2D8CFF', protocol: 'oauth' },
    { id: 'cn7', kind: 'social', provider: 'LinkedIn', account: 'Simplr', connected: true, color: '#0A66C2', protocol: 'api' },
    { id: 'cn8', kind: 'social', provider: 'X', account: '@simplrhq', connected: true, color: '#0B1220', protocol: 'api' },
    { id: 'cn9', kind: 'social', provider: 'Facebook', connected: false, color: '#1877F2', protocol: 'api' },
    { id: 'cn10', kind: 'social', provider: 'Instagram', connected: false, color: '#E4405F', protocol: 'api' },
  ]

  const webhooks: Webhook[] = [
    { id: 'wh1', url: 'https://hooks.zapier.com/hooks/catch/8241/a3f9', events: ['deal.won', 'deal.stage_changed'], active: true },
    { id: 'wh2', url: 'https://api.acme.co/simplr/leads', events: ['lead.created'], active: true },
  ]
  const apiKeys: ApiKey[] = [
    { id: 'ak1', label: 'Production', key: 'sk_live_9f2a…c71b', created: 'Aug 2, 2026' },
    { id: 'ak2', label: 'Zapier', key: 'sk_live_4d8e…22aa', created: 'Aug 14, 2026' },
  ]
  const integrations: Integration[] = [
    { id: 'in1', name: 'Slack', category: 'Messaging', desc: 'Deal alerts & @mentions in channels', installed: true, color: '#4A154B', initials: 'Sl' },
    { id: 'in2', name: 'Zapier', category: 'Automation', desc: 'Connect 6,000+ apps, no code', installed: true, color: '#FF4A00', initials: 'Zp' },
    { id: 'in3', name: 'Make', category: 'Automation', desc: 'Visual multi-step scenarios', installed: false, color: '#6D00CC', initials: 'Mk' },
    { id: 'in4', name: 'Nylas', category: 'Email & calendar', desc: 'Unified email/calendar for any provider', installed: true, color: '#0068FF', initials: 'Ny' },
    { id: 'in5', name: 'Ayrshare', category: 'Social', desc: 'Post to every social network via one API', installed: true, color: '#1DA1F2', initials: 'Ay' },
    { id: 'in6', name: 'Stripe', category: 'Billing', desc: 'Sync payments & subscriptions', installed: false, color: '#635BFF', initials: 'St' },
    { id: 'in7', name: 'DocuSign', category: 'Documents', desc: 'E-signature for quotes & contracts', installed: false, color: '#D5001C', initials: 'Ds' },
    { id: 'in8', name: 'HubSpot', category: 'Migration', desc: 'Two-way sync via unified API', installed: false, color: '#FF7A59', initials: 'Hs' },
    { id: 'in9', name: 'Merge.dev', category: 'Unified API', desc: 'One integration, dozens of CRMs/tools', installed: false, color: '#0B1220', initials: 'Mg' },
  ]
  const socialPosts: SocialPost[] = [
    { id: 'sp1', channels: ['LinkedIn', 'X'], body: 'Thrilled to power the next generation of energy infrastructure. New case study on the Cirrus data-centre UPS refresh 👇', when: 'Tomorrow · 09:00', status: 'scheduled' },
    { id: 'sp2', channels: ['LinkedIn'], body: 'We’re hiring account executives across the North West. Come build the future of clean power with us.', when: 'Fri · 12:00', status: 'scheduled' },
  ]

  // silence unused helpers referenced only conditionally
  void dealByOrg
  void personByName
  void mLeads

  const leads = mLeads.map((l) => ({ ...l }))

  const customFields: CustomField[] = [
    { id: 'cf1', entity: 'deal', label: 'Contract length', type: 'select', options: ['1 year', '2 years', '3 years', '5 years'] },
    { id: 'cf2', entity: 'deal', label: 'Region', type: 'text' },
    { id: 'cf3', entity: 'person', label: 'LinkedIn', type: 'url' },
  ]
  deals[8].custom = { cf1: '3 years', cf2: 'North West' }
  deals[0].custom = { cf1: '2 years', cf2: 'London' }
  people[1].custom = { cf3: 'linkedin.com/in/callumreed' }

  return { deals, people, orgs, leads, activities, emails, meetings, agents, agentRuns, connections, webhooks, apiKeys, integrations, socialPosts, customFields, toasts: [], railExpanded: true }
}
