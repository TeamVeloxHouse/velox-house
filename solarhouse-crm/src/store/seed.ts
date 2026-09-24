import { deals as mDeals, people as mPeople, orgs as mOrgs, leads as mLeads, products as mProducts } from '../data/mock'
import type { State, Deal, Person, Activity, EmailMsg, Meeting, Agent, AgentRun, Connection, CustomField, Webhook, ApiKey, Integration, SocialPost, Sequence, Automation, LinkedInThread, Enrolment, ReachCampaign, ScheduledTask, StudioConfig, StudioProject, Engineer, Job, SiteSurvey } from './types'
import { MILESTONES } from '../lib/delivery'
import { buildApplication } from '../lib/dno'
import { tradeByKey } from '../lib/trades'
import { buildConversations } from './commsSeed' // unified-inbox demo threads
import { generateSolarHouse, solarHousePipeline, defaultPortalConfig } from '../lib/solarHouseData'
import { pipelineFromTemplate, templateByKey } from '../lib/pipelines'
import { money } from '../lib/format'
import { AI_MEMBER_ID, YOU_MEMBER_ID } from './types'
import type { TeamMember, TeamChannel, TeamMessage, Announcement, Employee, LeaveRequest, Policy, Certification, Expense, StockItem, Review } from './types'

const now = Date.now()
const mins = (m: number) => now - m * 60_000
const hrs = (h: number) => now - h * 3_600_000
const days = (d: number) => now - d * 86_400_000
// ISO date for the day `offset` days from today — keeps seeded jobs in the visible week.
const isoDay = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}
// Monday-anchored offset so seeded jobs spread across the current working week.
const dow = new Date().getDay() // 0=Sun..6=Sat
const monOff = (weekday: number) => weekday - (dow === 0 ? 7 : dow) // weekday: 1=Mon..5=Fri

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
    { id: 'act3', type: 'change', subject: 'Stage moved to Negotiations Started', body: 'From Proposal Made · deal value updated to £415,000.', dealId: 'd9', done: true, who: 'System', createdAt: days(2) },
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
    // ── richer tasks: assignees, time estimates, checklists, files, real due dates ──
    {
      id: 'act20', type: 'task', subject: 'Build the Cirrus proposal v4', body: 'Legal cleared the liability caps — rebuild the proposal with the phased rollout and the maintenance retainer as a line item.',
      dealId: 'd9', personId: 'p2', due: 'Today', dueDate: isoDay(0), done: false, priority: 'High', who: 'Jordan Miles', createdAt: hrs(3), source: 'manual',
      assigneeIds: [YOU_MEMBER_ID], estimateMins: 120,
      subtasks: [
        { id: 'st20a', label: 'Confirm final scope with Callum', done: true },
        { id: 'st20b', label: 'Add phased-rollout pricing', done: false },
        { id: 'st20c', label: 'Insert maintenance retainer line', done: false },
        { id: 'st20d', label: 'Send to Dana for sign-off', done: false },
      ],
      files: [{ id: 'f20a', name: 'Cirrus-proposal-v3.pdf', kind: 'application/pdf' }, { id: 'f20b', name: 'liability-redlines.docx' }],
    },
    {
      id: 'act21', type: 'meeting', subject: 'Joint legal walkthrough — Cirrus', body: 'Get both legal teams on a call to close the liability-cap wording.',
      dealId: 'd9', personId: 'p2', due: 'Today', dueDate: isoDay(0), done: false, priority: 'High', who: 'Jordan Miles', createdAt: hrs(5), source: 'manual',
      assigneeIds: [YOU_MEMBER_ID, 'tm-priya'], estimateMins: 60,
    },
    {
      id: 'act22', type: 'task', subject: 'Prep Fenwick microgrid deck', dealId: 'd8', personId: 'p3', due: 'Tomorrow', dueDate: isoDay(1), done: false, priority: 'Medium', who: 'Jordan Miles', createdAt: hrs(7),
      assigneeIds: [YOU_MEMBER_ID], estimateMins: 90,
      subtasks: [{ id: 'st22a', label: 'Pull site survey numbers', done: false }, { id: 'st22b', label: 'Draw the single-line diagram', done: false }],
    },
    {
      id: 'act23', type: 'task', subject: 'Chase Ashford revised quote', dealId: 'd7', personId: 'p4', due: 'Overdue', dueDate: isoDay(-2), done: false, priority: 'High', who: 'Jordan Miles', createdAt: days(2),
      assigneeIds: [YOU_MEMBER_ID], estimateMins: 30,
    },
    {
      id: 'act24', type: 'task', subject: 'Send Meridian the case study', dealId: 'd1', personId: 'p1', due: 'Yesterday', dueDate: isoDay(-1), done: true, who: 'Jordan Miles', createdAt: days(1), completedAt: days(1),
      assigneeIds: [YOU_MEMBER_ID], estimateMins: 15,
    },
    {
      id: 'act25', type: 'call', subject: 'Priya: qualify Harbour Logistics', dealId: 'd6', due: 'Today', dueDate: isoDay(0), done: false, priority: 'Medium', who: 'Priya Nair', createdAt: hrs(6),
      assigneeIds: ['tm-priya'], estimateMins: 30,
    },
    {
      id: 'act26', type: 'task', subject: 'Marcus: build Q3 renewals list', due: 'In 3 days', dueDate: isoDay(3), done: false, priority: 'Low', who: 'Marcus Webb', createdAt: hrs(9),
      assigneeIds: ['tm-marcus'], estimateMins: 60,
    },
  ]

  const emails: EmailMsg[] = [
    { id: 'em1', folder: 'inbox', from: 'Callum Reed', fromEmail: 'callum@cirrus.com', to: 'jordan@tellovi.io', subject: 'Re: Revised proposal v3', body: 'Hi Jordan,\n\nThis looks good — the phased rollout is exactly what we needed to make the numbers work for this budget cycle. Marta wants to see where legal landed on the liability caps before we sign off, so if you can flag that in the SOW it would speed things along.\n\nWe’re aiming to have a decision by the end of next week. Appreciate the quick turnaround on v3.\n\nBest,\nCallum', dealId: 'd9', personId: 'p2', dealLabel: 'UPS refresh', unread: true, time: '09:41', createdAt: mins(45) },
    { id: 'em2', folder: 'inbox', from: 'Elena Voss', fromEmail: 'elena@meridian.com', to: 'jordan@tellovi.io', subject: 'Site access for survey', body: 'We can offer Thursday morning or Friday afternoon for the team to come in and assess the substation. Let me know what suits.', dealId: 'd1', personId: 'p1', dealLabel: 'Substation upgrade', unread: true, time: '08:12', createdAt: hrs(3) },
    { id: 'em3', folder: 'inbox', from: 'Sam Idris', fromEmail: 'sam@fenwick.com', to: 'jordan@tellovi.io', subject: 'Budget approval update', body: 'Finance committee meets next week — I’ll push for a decision then.', dealId: 'd8', personId: 'p3', dealLabel: 'Campus microgrid', time: 'Yesterday', createdAt: days(1) },
    { id: 'em4', folder: 'inbox', from: 'Owen Pryce', fromEmail: 'owen@staidan.com', to: 'jordan@tellovi.io', subject: 'Maintenance terms', body: 'Can we extend the retainer to cover the standby generators as well?', dealId: 'd4', personId: 'p4', dealLabel: 'Generator retrofit', time: 'Yesterday', createdAt: days(1) },
    { id: 'em5', folder: 'inbox', from: 'Dana Kirk', fromEmail: 'dana@brightleaf.com', to: 'jordan@tellovi.io', subject: 'Panel spec question', body: 'What’s the degradation warranty on the modules you quoted?', dealId: 'd3', personId: 'p5', dealLabel: 'Solar + storage', time: 'Mon', createdAt: days(3) },
  ]

  const meetings: Meeting[] = [
    { id: 'mtg1', title: 'UPS refresh — legal & scope call', platform: 'Teams', when: 'Today · 16:00', date: isoDay(0), start: '16:00', dealOrg: 'Cirrus Hosting', dealId: 'd9', personId: 'p2', attendees: ['Callum Reed', 'Marta Lund', 'Jordan Miles'], status: 'live', bot: true, duration: '18:42' },
    { id: 'mtg2', title: 'Microgrid proposal review', platform: 'Google Meet', when: 'Tomorrow · 10:00', date: isoDay(1), start: '10:00', dealOrg: 'Fenwick University', dealId: 'd8', personId: 'p3', attendees: ['Sam Idris', 'Jordan Miles'], status: 'upcoming', bot: true },
    { id: 'mtg3', title: 'Discovery — substation upgrade', platform: 'Teams', when: 'In 2 days · 09:30', date: isoDay(2), start: '09:30', dealOrg: 'Meridian Power', dealId: 'd1', personId: 'p1', attendees: ['Elena Voss', 'Jordan Miles'], status: 'upcoming', bot: false },
    { id: 'mtg4', title: 'Solar + storage kickoff', platform: 'Zoom', when: 'In 4 days · 14:00', date: isoDay(4), start: '14:00', dealOrg: 'Brightleaf Farms', dealId: 'd3', personId: 'p5', attendees: ['Dana Kirk', 'Jordan Miles', 'Priya Nair'], status: 'upcoming', bot: true },
    { id: 'mtg5', title: 'Renewal check-in', platform: 'Google Meet', when: 'Yesterday', date: isoDay(-1), start: '11:00', dealOrg: 'Northgate Rail', dealId: 'd6', personId: 'p6', attendees: ['Nadia Frost', 'Jordan Miles'], status: 'recorded', bot: true, duration: '27:55' },
  ]

  const agents: Agent[] = [
    { id: 'ag1', name: 'Inbox triage', desc: 'Reads new email, links to deals, drafts replies', runs: '48 today', on: true, schedule: 'Realtime' },
    { id: 'ag2', name: 'Deal-risk watch', desc: 'Flags stalls and suggests recovery plays', runs: '6 alerts', on: true, schedule: 'Every hour' },
    { id: 'ag3', name: 'Meeting notetaker', desc: 'Joins calls, transcribes, updates cards', runs: '3 this week', on: true, schedule: 'On meetings' },
    { id: 'ag4', name: 'Lead qualifier', desc: 'Scores & routes inbound leads', runs: '12 today', on: true, schedule: 'Realtime' },
    { id: 'ag5', name: 'Follow-up chaser', desc: 'Nudges deals with no next step', runs: 'Paused', on: false, schedule: 'Daily · 07:00' },
  ]

  const agentRuns: AgentRun[] = [
    { id: 'ar1', agent: 'Inbox triage', kind: 'draft', title: 'Drafted reply to Callum Reed', detail: 'Re: Revised proposal v3 — addresses the liability-cap question and proposes a legal call. Ready to review and send.', when: mins(20), status: 'pending', dealId: 'd9', personId: 'p2', emailTo: 'callum@cirrus.com', emailBody: 'Hi Callum,\n\nThanks for the quick turnaround. On the liability caps: our standard is a 12-month fees cap and I’ve reflected that in the SOW. Happy to get legal on a short call this week to close it out.\n\nBest,\nJordan' },
    { id: 'ar2', agent: 'Deal-risk watch', kind: 'risk', title: 'Gale Renewables has gone quiet', detail: 'No activity in 9 days on a £512K deal stuck in budget review. Recommend a re-engagement email to the economic buyer.', when: hrs(2), status: 'pending', dealId: 'd10' },
    { id: 'ar3', agent: 'Follow-up chaser', kind: 'task', title: 'Suggested task: chase PO on Northgate Rail', detail: 'HV cabling deal has an overdue step. Create a task to chase the purchase order?', when: hrs(3), status: 'pending', dealId: 'd6', personId: 'p6' },
    { id: 'ar4', agent: 'Lead qualifier', kind: 'triage', title: 'Qualified & routed 3 new leads', detail: 'Scored Elena Voss (88), Callum Reed (91) and Sam Idris (82) as high-intent and assigned to Jordan.', when: hrs(5), status: 'approved' },
    { id: 'ar5', agent: 'Meeting notetaker', kind: 'summary', title: 'Summarised the Brightleaf kickoff', detail: 'Wrote notes + 3 action items to Brightleaf Farms after the recorded call.', when: days(1), status: 'approved', dealId: 'd3', personId: 'p5' },
    { id: 'ar6', agent: 'Inbox triage', kind: 'enrich', title: 'Enriched Cirrus Hosting', detail: 'Added firmographics (250 staff, £48M revenue) and 2 stakeholders from public sources.', when: days(1), status: 'approved', personId: 'p2' },
    // more of today's activity, to make the log read like a real day
    { id: 'ar7', agent: 'Inbox triage', kind: 'triage', title: 'Triaged 12 overnight emails', detail: 'Linked 9 to existing deals, flagged 2 as new leads, archived 1 newsletter.', when: mins(75), status: 'approved' },
    { id: 'ar8', agent: 'Lead qualifier', kind: 'triage', title: 'Scored 5 new inbound leads', detail: 'Two above threshold (Aiko Retail 84, Dorset Homes 79) routed to Marcus.', when: mins(120), status: 'approved' },
    { id: 'ar9', agent: 'Follow-up chaser', kind: 'draft', title: 'Drafted 3 re-engagement emails', detail: 'For deals with no next step in 5+ days. Awaiting your review before send.', when: mins(150), status: 'pending' },
    { id: 'ar10', agent: 'Deal-risk watch', kind: 'risk', title: 'St. Aidan Hospital losing momentum', detail: 'No next step booked and last touch 8 days ago. Suggested a check-in call.', when: hrs(3), status: 'pending', dealId: 'd4', personId: 'p4' },
    { id: 'ar11', agent: 'Inbox triage', kind: 'draft', title: 'Drafted reply to Elena Voss', detail: 'Re: site access — proposed Thursday morning for the survey.', when: hrs(4), status: 'dismissed', dealId: 'd1', personId: 'p1' },
    { id: 'ar12', agent: 'Meeting notetaker', kind: 'summary', title: 'Summarised Northgate renewal check-in', detail: 'Notes + 2 action items written to the record after the recorded call.', when: hrs(6), status: 'approved', dealId: 'd6', personId: 'p6' },
  ]

  const connections: Connection[] = [
    { id: 'cn1', kind: 'email', provider: 'Microsoft 365', account: 'jordan@tellovi.io', connected: true, color: '#0078D4', protocol: 'oauth' },
    { id: 'cn2', kind: 'email', provider: 'Gmail', account: 'j.miles@gmail.com', connected: true, color: '#EA4335', protocol: 'oauth' },
    { id: 'cn3', kind: 'email', provider: 'IMAP / SMTP', connected: false, color: '#5D6878', protocol: 'imap' },
    { id: 'cn4', kind: 'meeting', provider: 'Teams', account: 'jordan@tellovi.io', connected: true, color: '#5059C9', protocol: 'oauth' },
    { id: 'cn5', kind: 'meeting', provider: 'Google Meet', account: 'jordan@tellovi.io', connected: true, color: '#00897B', protocol: 'oauth' },
    { id: 'cn6', kind: 'meeting', provider: 'Zoom', connected: false, color: '#2D8CFF', protocol: 'oauth' },
    { id: 'cn7', kind: 'social', provider: 'LinkedIn', account: 'Solar House', connected: true, color: '#0A66C2', protocol: 'api' },
    { id: 'cn8', kind: 'social', provider: 'X', account: '@tellovihq', connected: true, color: '#0B1220', protocol: 'api' },
    { id: 'cn9', kind: 'social', provider: 'Facebook', connected: false, color: '#1877F2', protocol: 'api' },
    { id: 'cn10', kind: 'social', provider: 'Instagram', connected: false, color: '#E4405F', protocol: 'api' },
  ]

  const webhooks: Webhook[] = [
    { id: 'wh1', url: 'https://hooks.zapier.com/hooks/catch/8241/a3f9', events: ['deal.won', 'deal.stage_changed'], active: true },
    { id: 'wh2', url: 'https://api.acme.co/tellovi/leads', events: ['lead.created'], active: true },
  ]
  const apiKeys: ApiKey[] = [
    { id: 'ak1', label: 'Production', key: 'sk_live_9f2a…c71b', created: 'Aug 2, 2026' },
    { id: 'ak2', label: 'Zapier', key: 'sk_live_4d8e…22aa', created: 'Aug 14, 2026' },
  ]
  const mk = (id: string, name: string, category: string, desc: string, color: string, domain: string, installed = false, popular = false): Integration => ({
    id, name, category, desc, color, domain, installed, popular, initials: name.replace(/[^A-Za-z ]/g, '').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
  })
  const integrations: Integration[] = [
    // Messaging & collaboration
    mk('in1', 'Slack', 'Messaging', 'Deal alerts & @mentions in channels', '#4A154B', 'slack.com', true, true),
    mk('in2', 'Microsoft Teams', 'Messaging', 'Notifications & meeting sync', '#5059C9', 'microsoft.com', true),
    mk('in3', 'WhatsApp Business', 'Messaging', 'Two-way chat linked to contacts', '#25D366', 'whatsapp.com'),
    mk('in4', 'Intercom', 'Messaging', 'Sync conversations & tickets', '#1F8DED', 'intercom.com'),
    mk('in5', 'Discord', 'Messaging', 'Community & team alerts', '#5865F2', 'discord.com'),
    // Automation & unified API
    mk('in6', 'Zapier', 'Automation', 'Connect 8,000+ apps, no code', '#FF4A00', 'zapier.com', true, true),
    mk('in7', 'Make', 'Automation', 'Visual multi-step scenarios', '#6D00CC', 'make.com'),
    mk('in8', 'n8n', 'Automation', 'Open-source workflow automation', '#EA4B71', 'n8n.io'),
    mk('in9', 'Merge.dev', 'Unified API', 'One integration, dozens of CRMs/tools', '#3B5CCC', 'merge.dev'),
    mk('in10', 'Paragon', 'Unified API', 'Embedded native integrations', '#6C5CE7', 'useparagon.com'),
    mk('in11', 'Nango', 'Unified API', 'Open-source unified API', '#0B1220', 'nango.dev'),
    // Email & calendar
    mk('in12', 'Gmail', 'Email & calendar', 'Send & sync from Google Workspace', '#EA4335', 'google.com', true, true),
    mk('in13', 'Outlook', 'Email & calendar', 'Send & sync from Microsoft 365', '#0078D4', 'outlook.com', true, true),
    mk('in14', 'Nylas', 'Email & calendar', 'Unified email/calendar for any provider', '#0068FF', 'nylas.com', true),
    mk('in15', 'Unipile', 'Email & calendar', 'Email, calendar & LinkedIn in one API', '#13927B', 'unipile.com'),
    mk('in16', 'Calendly', 'Email & calendar', 'Meeting scheduling links', '#006BFF', 'calendly.com', false, true),
    mk('in17', 'Google Calendar', 'Email & calendar', 'Two-way calendar sync', '#4285F4', 'calendar.google.com'),
    // Meetings & calls
    mk('in18', 'Zoom', 'Meetings & calls', 'Video meetings + notetaker', '#2D8CFF', 'zoom.us', false, true),
    mk('in19', 'Google Meet', 'Meetings & calls', 'Video meetings + notetaker', '#00897B', 'meet.google.com', true),
    mk('in20', 'Gong', 'Meetings & calls', 'Conversation intelligence & coaching', '#8039DF', 'gong.io'),
    mk('in21', 'Aircall', 'Meetings & calls', 'Cloud phone with click-to-dial', '#00B388', 'aircall.io'),
    mk('in22', 'Twilio', 'Meetings & calls', 'Programmable SMS & voice', '#F22F46', 'twilio.com'),
    // Data & enrichment (the prospecting layer)
    mk('in23', 'Apollo.io', 'Data & enrichment', 'B2B database & sequences', '#5A2FF5', 'apollo.io', false, true),
    mk('in24', 'Clay', 'Data & enrichment', 'Waterfall enrichment, 100+ sources', '#1A1A1A', 'clay.com'),
    mk('in25', 'People Data Labs', 'Data & enrichment', 'Person & company data API', '#0B1220', 'peopledatalabs.com'),
    mk('in26', 'Cognism', 'Data & enrichment', 'Phone-verified B2B data', '#3B29CC', 'cognism.com'),
    mk('in27', 'Hunter', 'Data & enrichment', 'Find & verify email addresses', '#FA5A32', 'hunter.io', true),
    mk('in28', 'Clearbit', 'Data & enrichment', 'Company & contact enrichment', '#4E5BF2', 'clearbit.com'),
    mk('in29', 'Companies House', 'Data & enrichment', 'UK firmographics & filings (free)', '#0B0C0C', 'gov.uk'),
    // Marketing & social
    mk('in30', 'Ayrshare', 'Marketing & social', 'Post to every network via one API', '#1DA1F2', 'ayrshare.com', true),
    mk('in31', 'LinkedIn', 'Marketing & social', 'Social selling & outreach', '#0A66C2', 'linkedin.com', true, true),
    mk('in32', 'Mailchimp', 'Marketing & social', 'Email marketing & audiences', '#FFE01B', 'mailchimp.com'),
    mk('in33', 'Meta Ads', 'Marketing & social', 'Lead ads → straight to Leads', '#0866FF', 'meta.com'),
    mk('in34', 'Google Ads', 'Marketing & social', 'Ad performance & lead sync', '#4285F4', 'ads.google.com'),
    // Billing & documents
    mk('in35', 'Stripe', 'Billing', 'Sync payments & subscriptions', '#635BFF', 'stripe.com', false, true),
    mk('in36', 'QuickBooks', 'Billing', 'Invoices & accounting sync', '#2CA01C', 'quickbooks.intuit.com'),
    mk('in37', 'Xero', 'Billing', 'Accounting & invoicing', '#13B5EA', 'xero.com'),
    mk('in38', 'DocuSign', 'Documents', 'E-signature for quotes & contracts', '#D5001C', 'docusign.com', false, true),
    mk('in39', 'PandaDoc', 'Documents', 'Proposals, quotes & e-sign', '#25C16F', 'pandadoc.com'),
    mk('in40', 'Google Drive', 'Documents', 'Attach & sync files to records', '#1FA463', 'drive.google.com'),
    mk('in41', 'Dropbox', 'Documents', 'File storage & sharing', '#0061FF', 'dropbox.com'),
    // Productivity & PM
    mk('in42', 'Notion', 'Productivity', 'Sync notes & docs', '#0B0C0C', 'notion.so'),
    mk('in43', 'Asana', 'Productivity', 'Turn won deals into projects', '#F06A6A', 'asana.com'),
    mk('in44', 'Jira', 'Productivity', 'Link deals to delivery tickets', '#0052CC', 'atlassian.com'),
    mk('in45', 'Trello', 'Productivity', 'Board sync for delivery', '#0079BF', 'trello.com'),
    mk('in46', 'Google Sheets', 'Productivity', 'Export & two-way sync', '#0F9D58', 'sheets.google.com'),
    // Support
    mk('in47', 'Zendesk', 'Support', 'Tickets on the contact timeline', '#03363D', 'zendesk.com'),
    mk('in48', 'HubSpot', 'Migration', 'Two-way sync via unified API', '#FF7A59', 'hubspot.com'),
    mk('in49', 'Salesforce', 'Migration', 'Import & sync from Salesforce', '#00A1E0', 'salesforce.com'),
    mk('in50', 'Segment', 'Data & enrichment', 'Customer data pipeline', '#52BD94', 'segment.com'),
  ]
  const socialPosts: SocialPost[] = [
    { id: 'sp1', channels: ['LinkedIn', 'X'], body: 'Thrilled to power the next generation of energy infrastructure. New case study on the Cirrus data-centre UPS refresh 👇', when: 'Tomorrow · 09:00', status: 'scheduled' },
    { id: 'sp2', channels: ['LinkedIn'], body: 'We’re hiring account executives across the North West. Come build the future of clean power with us.', when: 'Fri · 12:00', status: 'scheduled' },
  ]

  // silence unused helpers referenced only conditionally
  void dealByOrg
  void personByName
  void mLeads

  // Give each lead a real timestamp derived from its relative label, so the
  // Leads page can filter by date range.
  const parseWhen = (s: string): number => {
    const t = s.toLowerCase()
    if (t.includes('just now')) return mins(2)
    if (t === 'yesterday') return days(1)
    const h = t.match(/(\d+)\s*h/); if (h) return hrs(Number(h[1]))
    const d = t.match(/(\d+)\s*day/); if (d) return days(Number(d[1]))
    return days(3)
  }
  const leadStatusFor = (score: number, i: number): import('./types').LeadStatus => {
    if (i % 7 === 3) return 'unqualified'
    if (score >= 82) return 'qualified'
    if (score >= 72) return 'working'
    if (score >= 62) return 'nurturing'
    return 'new'
  }
  const leads = mLeads.map((l, i) => ({ ...l, createdAt: parseWhen(l.created) - i * 3_600_000, status: leadStatusFor(l.score, i) }))

  const sequences: Sequence[] = [
    { id: 'sq1', name: 'Renewables outbound', enrolled: 42, active: true, replyRate: 18, steps: [
      { id: 'ss1', type: 'email', label: 'Intro email — problem/insight', day: 0 },
      { id: 'ss2', type: 'wait', label: 'Wait 2 days', day: 2 },
      { id: 'ss3', type: 'linkedin', label: 'LinkedIn connect + note', day: 2 },
      { id: 'ss4', type: 'email', label: 'Follow-up — case study', day: 4 },
      { id: 'ss5', type: 'call', label: 'Call attempt', day: 6 },
      { id: 'ss6', type: 'email', label: 'Break-up email', day: 9 },
    ] },
    { id: 'sq2', name: 'Inbound lead nurture', enrolled: 68, active: true, replyRate: 31, steps: [
      { id: 'ss7', type: 'email', label: 'Thanks + book a call', day: 0 },
      { id: 'ss8', type: 'wait', label: 'Wait 1 day', day: 1 },
      { id: 'ss9', type: 'task', label: 'Rep reviews & personalises', day: 1 },
      { id: 'ss10', type: 'email', label: 'Value follow-up', day: 3 },
    ] },
  ]

  const automations: Automation[] = [
    { id: 'au1', name: 'Qualified deal handoff', active: true, steps: [
      { id: 'as1', kind: 'trigger', title: 'Deal enters "Demo Scheduled"', subtitle: 'When a deal is moved into the stage' },
      { id: 'as2', kind: 'condition', title: 'Value is over £50,000', subtitle: 'Only run for higher-value opportunities' },
      { id: 'as3', kind: 'email', title: 'Send intro email from owner', subtitle: 'Template: "Qualified — next steps"' },
      { id: 'as4', kind: 'task', title: 'Create follow-up task', subtitle: 'Due 2 business days after entry' },
      { id: 'as5', kind: 'notify', title: 'Notify sales manager', subtitle: 'Slack #deals channel' },
    ] },
  ]

  const linkedinThreads: LinkedInThread[] = [
    { id: 'li1', name: 'Elena Voss', company: 'Meridian Power', headline: 'Facilities Director', kind: 'message', status: 'unread', preview: 'Happy to connect — send me the survey details and I’ll take a look.', time: '11:20', createdAt: mins(35), personId: 'p1', sequence: 'Solar site owners' },
    { id: 'li2', name: 'Tom Reyes', company: 'Harbour Logistics', headline: 'Operations Lead', kind: 'connection', status: 'pending', preview: 'Connection request sent · “Hi Tom, we help logistics firms electrify fleets…”', time: '09:05', createdAt: hrs(4), sequence: 'Facilities directors — energy' },
    { id: 'li3', name: 'Callum Reed', company: 'Cirrus Hosting', headline: 'CTO', kind: 'message', status: 'accepted', preview: 'Thanks for connecting. Let’s line up that call re: the UPS refresh.', time: 'Yesterday', createdAt: days(1), personId: 'p2' },
    { id: 'li4', name: 'Sam Idris', company: 'Fenwick University', headline: 'Sustainability Lead', kind: 'connection', status: 'accepted', preview: 'Connection accepted', time: 'Mon', createdAt: days(3), personId: 'p3', sequence: 'Solar site owners' },
    { id: 'li5', name: 'Nadia Frost', company: 'Northgate Rail', headline: 'Project Manager', kind: 'message', status: 'open', preview: 'Not the right time for us, but check back in Q1.', time: 'Mon', createdAt: days(3), personId: 'p6' },
  ]

  const enrolments: Enrolment[] = [
    { id: 'en1', sequenceId: 'sq1', name: 'Elena Voss', company: 'Meridian Power', channel: 'LinkedIn', stepIndex: 3, totalSteps: 6, stepLabel: 'LinkedIn connect + note', status: 'replied', nextDue: 'Replied', personId: 'p1' },
    { id: 'en2', sequenceId: 'sq1', name: 'Owen Pryce', company: 'St. Aidan Hospital', channel: 'Email', stepIndex: 2, totalSteps: 6, stepLabel: 'Follow-up — case study', status: 'opened', nextDue: 'Today', personId: 'p4' },
    { id: 'en3', sequenceId: 'sq1', name: 'Dana Kirk', company: 'Brightleaf Farms', channel: 'Email', stepIndex: 1, totalSteps: 6, stepLabel: 'Intro email', status: 'sent', nextDue: 'in 2 days', personId: 'p5' },
    { id: 'en4', sequenceId: 'sq1', name: 'Tom Reyes', company: 'Harbour Logistics', channel: 'LinkedIn', stepIndex: 3, totalSteps: 6, stepLabel: 'LinkedIn connect + note', status: 'due', nextDue: 'Today', },
    { id: 'en5', sequenceId: 'sq2', name: 'Sam Idris', company: 'Fenwick University', channel: 'Email', stepIndex: 3, totalSteps: 4, stepLabel: 'ROI follow-up', status: 'due', nextDue: 'Today', personId: 'p3' },
    { id: 'en6', sequenceId: 'sq2', name: 'Ruth Bello', company: 'Cavendish Retail', channel: 'Email', stepIndex: 1, totalSteps: 4, stepLabel: 'Problem/insight opener', status: 'bounced', nextDue: 'Fix email', personId: 'p7' },
    { id: 'en7', sequenceId: 'sq2', name: 'Nadia Frost', company: 'Northgate Rail', channel: 'LinkedIn', stepIndex: 2, totalSteps: 4, stepLabel: 'LinkedIn connect', status: 'connected', nextDue: 'in 1 day', personId: 'p6' },
  ]

  const reachCampaigns: ReachCampaign[] = [
    { id: 'rc1', name: 'Solar site owners — NW England', vertical: 'Solar', audience: 240, sequence: 'Renewables outbound', channels: ['Email', 'LinkedIn'], status: 'running', sent: 612, replies: 44, meetings: 12, createdBy: 'You', createdAt: days(6) },
    { id: 'rc2', name: 'Facilities directors — energy retrofit', vertical: 'Utilities', audience: 180, sequence: 'Inbound lead nurture', channels: ['Email', 'LinkedIn'], status: 'running', sent: 430, replies: 31, meetings: 8, createdBy: 'AI', createdAt: days(3) },
  ]
  const scheduledTasks: ScheduledTask[] = [
    { id: 'st1', prompt: 'Find 20 new solar-suitable sites in Manchester and add them to Leads', cadence: 'Every Monday · 08:00', nextRun: 'Mon 08:00', active: true, lastResult: '20 sites added', createdAt: days(1) },
    { id: 'st2', prompt: 'Chase every prospect who opened but didn’t reply in the last 3 days', cadence: 'Daily · 07:30', nextRun: 'Tomorrow 07:30', active: true, lastResult: '14 follow-ups sent', createdAt: days(1) },
    { id: 'st3', prompt: 'Draft a LinkedIn post from this week’s won deals', cadence: 'Every Friday · 15:00', nextRun: 'Fri 15:00', active: false, createdAt: days(2) },
  ]

  const studioConfig: StudioConfig = {
    costPerKwp: 1350,
    baseCost: 1800,
    perPanel: 0,
    marginPct: 18,
    vatPct: 0, // 0% VAT on UK domestic solar
    currency: '£',
    adders: [
      { id: 'ad1', name: 'Battery storage (5 kWh)', amount: 3200 },
      { id: 'ad2', name: 'EV charger', amount: 900 },
      { id: 'ad3', name: 'Bird protection', amount: 350 },
      { id: 'ad4', name: 'Scaffolding (3-storey)', amount: 600 },
    ],
    finance: [
      { id: 'fin1', name: 'Green Energy Loan', provider: 'GoodLeap', apr: 6.9, termMonths: 120, depositPct: 0, type: 'loan' },
      { id: 'fin2', name: '0% for 12 months', provider: 'Sunlight', apr: 0, termMonths: 12, depositPct: 10, type: 'buy-now-pay-later' },
      { id: 'fin3', name: 'Solar Lease', provider: 'Dividend', apr: 4.5, termMonths: 240, depositPct: 0, type: 'lease' },
    ],
  }

  const mkProject = (id: string, address: string, customer: string, value: number, kwp: number, mIdx: number, products: { name: string; detail: string; value: number }[], installDate?: string): StudioProject => ({
    id, address, customer, owner: 'Jordan Miles', value, systemKwp: kwp, milestoneIndex: mIdx,
    milestones: MILESTONES.map((m, i) => ({ ...m, done: i < mIdx })),
    tasks: ['Book site survey', 'Complete MCS paperwork', 'Submit DNO / G99 application', 'Order panels & inverter', 'Book scaffolding', 'Book install team & electrician', 'Install & test', 'Building control / inspection', 'Issue MCS certificate', 'Submit for PTO', 'Handover pack to customer'].map((label, i) => ({ id: `t${i}`, label, done: i < mIdx })),
    products, installDate, createdAt: days(mIdx + 2),
  })
  const projects: StudioProject[] = [
    mkProject('pj1', '14 Brightleaf Way, Manchester', 'Dana Kirk', 12450, 5.28, 2, [{ name: 'Solar PV', detail: '12 panels · 5.28 kWp', value: 8950 }, { name: 'Battery storage', detail: '5 kWh', value: 3200 }, { name: 'EV charger', detail: '7 kW', value: 900 }]),
    mkProject('pj2', '8 Meridian Road, Leeds', 'Elena Voss', 9200, 4.4, 4, [{ name: 'Solar PV', detail: '10 panels · 4.4 kWp', value: 8300 }, { name: 'Bird protection', detail: 'Full perimeter', value: 350 }], 'Tue 26 Aug'),
    mkProject('pj3', 'Unit 4, Harbour Estate, Hull', 'Tom Reyes', 21800, 9.7, 6, [{ name: 'Solar PV', detail: '22 panels · 9.7 kWp', value: 17400 }, { name: 'Battery storage', detail: '10 kWh', value: 6400 }], 'Thu 14 Aug'),
    mkProject('pj4', '31 Victoria St, Rochdale', 'Owen Pryce', 7600, 3.5, 1, [{ name: 'Solar PV', detail: '8 panels · 3.5 kWp', value: 7600 }]),
  ]

  // Orders (materials/equipment) + invoices per installation
  projects[0].orders = [
    { id: 'or1', supplier: 'Segen', status: 'ordered', orderedDate: '6 Aug', expectedDate: '22 Aug', items: [{ name: 'JA Solar 440W panel', qty: 12, unitCost: 92 }, { name: 'GivEnergy 5.2 kWh battery', qty: 1, unitCost: 2100 }] },
    { id: 'or2', supplier: 'City Electrical Factors', status: 'delivered', orderedDate: '4 Aug', items: [{ name: 'Solis 3.6kW hybrid inverter', qty: 1, unitCost: 640 }, { name: 'DC isolators + cabling', qty: 1, unitCost: 180 }] },
  ]
  projects[0].invoices = [
    { id: 'in1', number: 'INV-PJ1-01', kind: 'deposit', amount: 3735, status: 'paid', issuedDate: '2 Aug', dueDate: '9 Aug', paidDate: '5 Aug' },
    { id: 'in2', number: 'INV-PJ1-02', kind: 'interim', amount: 4000, status: 'sent', issuedDate: '18 Aug', dueDate: '1 Sep' },
  ]
  projects[1].orders = [
    { id: 'or3', supplier: 'Midsummer Wholesale', status: 'delivered', orderedDate: '1 Aug', items: [{ name: 'Aiko 445W panel', qty: 10, unitCost: 98 }, { name: 'Bird protection mesh', qty: 1, unitCost: 120 }] },
  ]
  projects[1].invoices = [
    { id: 'in3', number: 'INV-PJ2-01', kind: 'deposit', amount: 2760, status: 'paid', issuedDate: '30 Jul', dueDate: '6 Aug', paidDate: '2 Aug' },
  ]
  projects[2].invoices = [
    { id: 'in4', number: 'INV-PJ3-01', kind: 'deposit', amount: 6540, status: 'paid', issuedDate: '10 Jul', dueDate: '17 Jul', paidDate: '12 Jul' },
    { id: 'in5', number: 'INV-PJ3-02', kind: 'final', amount: 15260, status: 'overdue', issuedDate: '14 Aug', dueDate: '21 Aug' },
  ]

  // DNO Autopilot — seed applications at different lifecycle stages so the queue is alive.
  projects[1].dno = buildApplication(projects[1], { mpan: '2000012345672', phase: 1 })
  projects[1].dno = {
    ...projects[1].dno,
    status: 'submitted',
    submittedAt: '26 Aug 2026',
    proposedInstallDate: '9 Sep 2026',
    signatures: { installer: { by: 'Jordan Miles', signedAt: '24 Aug 2026' }, client: { by: 'Elena Voss', signedAt: '25 Aug 2026' } },
    documents: [
      { id: 'd1', name: 'G99A_Application_1.pdf', kind: 'pre-install', pages: 3, generatedAt: '24 Aug 2026' },
      { id: 'd2', name: 'G99A_SingleLineDiagram.pdf', kind: 'pre-install', pages: 1, generatedAt: '24 Aug 2026' },
      { id: 'd3', name: 'G99A_EquipmentSchedule.pdf', kind: 'pre-install', pages: 2, generatedAt: '24 Aug 2026' },
    ],
    messages: [],
    events: [
      { id: 'e1', label: 'Application created', at: '22 Aug 2026' },
      { id: 'e2', label: 'Validated — ready to submit', at: '24 Aug 2026' },
      { id: 'e3', label: 'Submitted to DNO', at: '26 Aug 2026' },
    ],
  }
  projects[2].dno = buildApplication(projects[2], { mpan: '1500012345672', phase: 3 })
  projects[2].dno = {
    ...projects[2].dno,
    status: 'installed',
    submittedAt: '12 Jul 2026',
    decisionAt: '2 Aug 2026',
    reference: 'NPG-4821973',
    proposedInstallDate: '14 Aug 2026',
    actualInstallDate: '14 Aug 2026',
    signatures: { installer: { by: 'Jordan Miles', signedAt: '10 Jul 2026' }, client: { by: 'Tom Reyes', signedAt: '11 Jul 2026' } },
    documents: [
      { id: 'd4', name: 'G99B_Application_1.pdf', kind: 'pre-install', pages: 3, generatedAt: '10 Jul 2026' },
      { id: 'd5', name: 'G99B_SingleLineDiagram.pdf', kind: 'pre-install', pages: 1, generatedAt: '10 Jul 2026' },
      { id: 'd6', name: 'G99B_EquipmentSchedule.pdf', kind: 'pre-install', pages: 2, generatedAt: '10 Jul 2026' },
    ],
    messages: [
      { id: 'm1', from: 'dno', body: 'Application received. A connection offer has been issued — reference NPG-4821973. Commission within 3 months.', at: '2 Aug 2026' },
    ],
    events: [
      { id: 'e4', label: 'Application created', at: '8 Jul 2026' },
      { id: 'e5', label: 'Validated — ready to submit', at: '10 Jul 2026' },
      { id: 'e6', label: 'Submitted to DNO', at: '12 Jul 2026' },
      { id: 'e7', label: 'Approved by DNO', at: '2 Aug 2026' },
      { id: 'e8', label: 'Installed', at: '14 Aug 2026' },
    ],
  }

  const emailCampaigns: import('./types').EmailCampaign[] = [
    { id: 'ec1', name: 'Q3 Renewables outreach', type: 'Sequence', sent: 480, opens: 62, clicks: 18, deals: 9, status: 'Sending', createdAt: days(4) },
    { id: 'ec2', name: 'Data-centre resilience', type: 'Email', sent: 1240, opens: 48, clicks: 12, deals: 14, status: 'Live', createdAt: days(12) },
    { id: 'ec3', name: 'Grid webinar invite', type: 'Email', sent: 890, opens: 55, clicks: 21, deals: 6, status: 'Complete', createdAt: days(25) },
    { id: 'ec4', name: 'EV fleet nurture', type: 'Sequence', sent: 0, opens: 0, clicks: 0, deals: 0, status: 'Draft', createdAt: days(1) },
    { id: 'ec5', name: 'Site survey follow-up', type: 'Form', sent: 210, opens: 71, clicks: 34, deals: 4, status: 'Live', createdAt: days(8) },
  ]

  const documents: import('./types').CrmDocument[] = [
    { id: 'doc1', ref: 'QUO-1042', deal: 'UPS refresh', value: 415000, status: 'Viewed', views: 6, sent: '2h ago', createdAt: days(1) },
    { id: 'doc2', ref: 'QUO-1041', deal: 'Campus microgrid', value: 268000, status: 'Sent', views: 1, sent: 'Yesterday', createdAt: days(2) },
    { id: 'doc3', ref: 'QUO-1039', deal: 'Solar + storage', value: 210000, status: 'Signed', views: 9, sent: 'Sep 8', createdAt: days(9) },
    { id: 'doc4', ref: 'QUO-1036', deal: 'Metering rollout', value: 118000, status: 'Expired', views: 3, sent: 'Aug 21', createdAt: days(20) },
    { id: 'doc5', ref: 'QUO-1044', deal: 'HV cabling', value: 320000, status: 'Draft', views: 0, sent: '—', createdAt: days(0) },
  ]

  const brandKit: import('./types').BrandKit = {
    company: 'Solar House Solar', primary: '#13927B', accent: '#F5A623', font: 'Inter',
    tone: 'Confident, warm and plain-English. Lead with the customer’s goal, show savings before cost, never pushy.',
    logoName: 'logo-simplr-solar.svg',
  }
  const docTemplates: import('./types').DocTemplate[] = [
    { id: 'dt1', name: 'Pitch deck', kind: 'deck', format: 'pptx', desc: '10–12 slide investor / sales deck — problem, solution, savings, proof, ask.' },
    { id: 'dt2', name: 'Sales proposal', kind: 'proposal', format: 'pdf', desc: 'Customer-facing proposal — system, savings, finance, next steps.' },
    { id: 'dt3', name: 'One-pager', kind: 'onepager', format: 'pdf', desc: 'Single-page overview to leave behind or attach to an email.' },
    { id: 'dt4', name: 'Case study', kind: 'case-study', format: 'pdf', desc: 'A completed install told as a story — before, after, numbers.' },
    { id: 'dt5', name: 'Cover letter', kind: 'letter', format: 'docx', desc: 'Branded letter to accompany a quote or contract.' },
  ]
  const brandDocs: import('./types').BrandDoc[] = [
    { id: 'bd1', title: 'Brightleaf Way — Sales proposal', kind: 'proposal', format: 'pdf', source: 'template', createdAt: days(3) },
  ]

  const playbooks: import('./types').Playbook[] = [
    { id: 'pb1', title: 'Ideal customer profile', scope: 'sourcing', source: 'written', active: true, updatedAt: days(20),
      body: 'Target UK solar & renewables installers, 5–50 staff, MCS-certified, actively hiring installers or surveyors. Prioritise firms doing commercial + domestic. Avoid pure lead-gen resellers and single-person outfits.' },
    { id: 'pb2', title: 'Outreach tone & rules', scope: 'outreach', source: 'written', active: true, updatedAt: days(12),
      body: 'Warm, direct, no hype. Lead with a specific observation about their business. One clear ask (a 15-min call). Never mention price in a first touch. British spelling. Max 90 words. Always reference the research, never a generic template.' },
    { id: 'pb3', title: 'Lead qualification checklist', scope: 'qualifying', source: 'written', active: true, updatedAt: days(8),
      body: 'Qualified = (1) installs solar as a core service, (2) 5+ staff, (3) an identifiable decision-maker with contactable email, (4) a recent growth or hiring signal. Score fit 0–100 and always attach the "why now".' },
    { id: 'pb4', title: 'Proposal style guide', scope: 'proposal', source: 'uploaded', fileName: 'Proposal-guidelines-2026.pdf', active: true, updatedAt: days(30),
      body: 'Open with the customer\'s goal, not the company bio. Show savings before cost. Always include payback, 25-year saving and CO₂. Finance shown as monthly-from. Confident, plain English — no jargon, no pushy language.' },
    { id: 'pb5', title: 'Install handover process', scope: 'delivery', source: 'written', active: false, updatedAt: days(45),
      body: 'On PTO: issue MCS certificate + DNO confirmation, send the handover pack, book a 6-month service check, and trigger a referral ask 2 weeks after go-live once the customer has seen a bill.' },
  ]

  // ── Field operations: crew + a working-week schedule ──
  const engineers: Engineer[] = [
    { id: 'eng1', name: 'Ryan Cole', skills: 'Lead installer · MCS', color: '#13927B', initials: 'RC' },
    { id: 'eng2', name: 'Dev Sharma', skills: 'Electrician · Part P', color: '#0E9F6E', initials: 'DS' },
    { id: 'eng3', name: 'Marek Nowak', skills: 'Installer · roofing', color: '#E8721A', initials: 'MN' },
    { id: 'eng4', name: 'Chloe Adams', skills: 'Surveyor', color: '#159C86', initials: 'CA' },
  ]
  const mkJob = (id: string, ref: string, kind: Job['kind'], title: string, customer: string, address: string, crew: string[], weekday: number, start: string, mins: number, status: Job['status'], extra: Partial<Job> = {}): Job => ({
    id, ref, kind, title, customer, address, crew, date: isoDay(monOff(weekday)), start, durationMins: mins, status, createdAt: now, ...extra,
  })
  const jobs: Job[] = [
    mkJob('job1', 'JOB-2041', 'survey', 'Site survey', 'Dana Kirk', '14 Brightleaf Way, Manchester', ['eng4'], 1, '09:30', 90, 'scheduled', { dealId: 'd3', personId: 'p5', value: 12450 }),
    mkJob('job2', 'JOB-2042', 'install', 'Solar + battery install', 'Tom Reyes', 'Unit 4, Harbour Estate, Hull', ['eng1', 'eng2'], 1, '08:00', 480, 'scheduled', { value: 21800 }),
    mkJob('job3', 'JOB-2043', 'showroom', 'Home consultation', 'Elena Voss', '8 Meridian Road, Leeds', ['eng4'], 2, '11:00', 60, 'scheduled', { dealId: 'd1', personId: 'p1' }),
    mkJob('job4', 'JOB-2044', 'install', 'Panel install (10 panels)', 'Elena Voss', '8 Meridian Road, Leeds', ['eng1', 'eng3'], 3, '08:30', 420, 'scheduled', { value: 9200 }),
    mkJob('job5', 'JOB-2045', 'service', 'Monitoring visit', 'Owen Pryce', '31 Victoria St, Rochdale', ['eng2'], 3, '14:00', 60, 'scheduled', { personId: 'p4' }),
    mkJob('job6', 'JOB-2046', 'remedial', 'Inverter fault callback', 'Nadia Frost', 'Northgate Depot, Crewe', ['eng2'], 4, '10:00', 120, 'scheduled', { personId: 'p6' }),
    mkJob('job7', 'JOB-2047', 'install', 'Battery retrofit', 'Callum Reed', 'Cirrus DC, Warrington', ['eng1', 'eng3'], 5, '08:00', 360, 'scheduled', { dealId: 'd9', personId: 'p2', value: 6400 }),
    // Unassigned / unscheduled — the backlog the scheduler (and AI) fills
    { id: 'job8', ref: 'JOB-2048', kind: 'survey', title: 'Site survey', customer: 'Owen Pryce', address: '31 Victoria St, Rochdale', crew: [], durationMins: 90, status: 'unscheduled', personId: 'p4', value: 7600, createdAt: now },
    { id: 'job9', ref: 'JOB-2049', kind: 'showroom', title: 'Showroom appointment', customer: 'Sam Idris', address: 'Showroom — Deansgate', crew: [], durationMins: 60, status: 'unscheduled', personId: 'p3', createdAt: now },
  ]

  // ── Team space — one internal chat + announcements board across every workspace ──
  const teamMembers: TeamMember[] = [
    { id: YOU_MEMBER_ID, name: 'Jordan Miles', role: 'Account Executive', color: '#13927B', status: 'online', you: true, voiceEnrolled: true },
    { id: 'tm-dana', name: 'Dana Okafor', role: 'CEO & Founder', color: '#B01B4F', status: 'online', boss: true, voiceEnrolled: true },
    { id: 'tm-priya', name: 'Priya Nair', role: 'Account Executive', color: '#0E9F6E', status: 'online', voiceEnrolled: true },
    { id: 'tm-marcus', name: 'Marcus Webb', role: 'Sales Lead', color: '#E8721A', status: 'away' },
    { id: 'tm-sofia', name: 'Sofia Reyes', role: 'Marketing', color: '#159C86', status: 'dnd' },
    { id: 'tm-ryan', name: 'Ryan Cole', role: 'Lead Installer', color: '#0891B2', status: 'offline' },
    { id: AI_MEMBER_ID, name: 'Ovi', role: 'Works across every app', color: '#1FAE94', status: 'online', bot: true },
  ]
  const everyone = teamMembers.map((m) => m.id)

  const teamChannels: TeamChannel[] = [
    { id: 'ch-general', name: 'general', kind: 'channel', topic: 'Company-wide — anything and everything', memberIds: everyone, ai: true, unread: 0 },
    { id: 'ch-sales', name: 'sales', kind: 'channel', topic: 'Pipeline, deals & forecasting', memberIds: [YOU_MEMBER_ID, 'tm-dana', 'tm-priya', 'tm-marcus', AI_MEMBER_ID], ai: true, unread: 2 },
    { id: 'ch-random', name: 'random', kind: 'channel', topic: 'Off-topic & watercooler', memberIds: everyone, ai: false, unread: 0 },
    { id: 'ch-enterprise', name: 'Enterprise pod', kind: 'group', topic: 'The big-logo working group', memberIds: [YOU_MEMBER_ID, 'tm-marcus', 'tm-dana', AI_MEMBER_ID], ai: true, unread: 0 },
    { id: 'ch-solar', name: 'Solar delivery', kind: 'group', topic: 'Design → install → PTO handover', memberIds: [YOU_MEMBER_ID, 'tm-priya', 'tm-ryan', AI_MEMBER_ID], ai: true, unread: 0 },
    { id: 'dm-dana', name: 'Dana Okafor', kind: 'dm', memberIds: [YOU_MEMBER_ID, 'tm-dana', AI_MEMBER_ID], ai: true, unread: 1 },
    { id: 'dm-ai', name: 'Ovi', kind: 'dm', topic: 'Your private copilot', memberIds: [YOU_MEMBER_ID, AI_MEMBER_ID], ai: true, unread: 0 },
  ]

  // A real, computed answer the AI already posted in #sales — accurate to the seeded pipeline.
  const openForBars = deals.filter((d) => !d.won && !d.lost)
  const byStage = openForBars.reduce<Record<string, number>>((acc, d) => { acc[d.stage] = (acc[d.stage] ?? 0) + d.value; return acc }, {})
  const stageBars = Object.entries(byStage)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, display: money(value, { compact: true }), tone: 'accent' as const }))
  const totalOpen = openForBars.reduce((s, d) => s + d.value, 0)

  const teamMessages: TeamMessage[] = [
    // #general
    { id: 'msg-g1', channelId: 'ch-general', authorId: 'tm-dana', text: 'Morning all — strong start to the week. Board’s next Thursday, let’s go in with our best numbers 💪', createdAt: hrs(6) },
    { id: 'msg-g2', channelId: 'ch-general', authorId: 'tm-priya', text: 'Portal maintenance window’s done, everything’s back up 👍', createdAt: hrs(5), reactions: [{ emoji: '🙌', by: ['tm-marcus'] }] },
    { id: 'msg-g3', channelId: 'ch-general', authorId: 'tm-marcus', text: 'Reminder: pipeline review Thursday 3pm. Come with your top 3 at-risk deals.', createdAt: hrs(3) },

    // #sales — a data question the AI answered with a visual
    { id: 'msg-s1', channelId: 'ch-sales', authorId: 'tm-priya', text: '@Ovi how’s the pipeline shaping up for the quarter?', createdAt: hrs(2) },
    {
      id: 'msg-s2', channelId: 'ch-sales', authorId: AI_MEMBER_ID, createdAt: hrs(2) + 40_000,
      text: 'Healthy but back-loaded — most value is sitting in the late stages. Here’s the open pipeline right now:',
      ai: [
        { type: 'stats', items: [
          { label: 'Open pipeline', value: money(totalOpen, { compact: true }) },
          { label: 'Weighted', value: money(Math.round(totalOpen * 0.33), { compact: true }), tone: 'muted' },
          { label: 'Open deals', value: String(openForBars.length) },
          { label: 'To quota', value: '68%', tone: 'positive' },
        ] },
        { type: 'bars', title: 'Open pipeline by stage', items: stageBars },
        { type: 'text', text: 'Cirrus Hosting and Gale Renewables alone are ~40% of open value — keep both moving so the quarter doesn’t hinge on one slip.' },
      ],
      reactions: [{ emoji: '👍', by: ['tm-priya', 'tm-marcus'] }],
    },

    // Enterprise pod
    { id: 'msg-e1', channelId: 'ch-enterprise', authorId: 'tm-marcus', text: 'Cirrus verbal yes is in 🎉 legal redlines on the liability caps are the only blocker now.', createdAt: hrs(7), reactions: [{ emoji: '🎉', by: [YOU_MEMBER_ID, 'tm-dana'] }] },
    { id: 'msg-e2', channelId: 'ch-enterprise', authorId: YOU_MEMBER_ID, text: 'On it — chasing procurement this week and lining up a joint legal call.', createdAt: hrs(6) },

    // Solar delivery
    { id: 'msg-so1', channelId: 'ch-solar', authorId: 'tm-priya', text: 'Brightleaf Way install is booked for Monday, Ryan’s crew assigned. Survey came back clean.', createdAt: hrs(8) },

    // #random
    { id: 'msg-r1', channelId: 'ch-random', authorId: 'tm-sofia', text: 'The floor-2 coffee machine has risen from the dead ☕', createdAt: hrs(4), reactions: [{ emoji: '☕', by: [YOU_MEMBER_ID, 'tm-priya', 'tm-marcus'] }] },

    // DM from the boss — the fresh, actionable request (left unhandled so the AI can act on it live)
    { id: 'msg-d1', channelId: 'dm-dana', authorId: 'tm-dana', text: 'Hey — can you prepare a presentation for next week’s board? Focus on Q3 pipeline and our recent wins. Would love a first cut by Friday 🙏', createdAt: mins(9) },
  ]

  const announcements: Announcement[] = [
    { id: 'an-win1', kind: 'win', title: 'Cirrus Hosting — £415k closed 🎉', body: 'Six-month cycle, phased rollout landed. Huge credit to Jordan for holding the line on the liability caps and to Marcus for keeping procurement warm.', authorId: 'tm-dana', createdAt: hrs(20), value: 415000, cheers: ['tm-priya', 'tm-marcus', 'tm-sofia', 'tm-dana'], pinned: true },
    { id: 'an-win2', kind: 'win', title: 'Ashford Utilities renewal secured', body: 'Renewed a year early on a bigger footprint — metering + monitoring added. Priya ran the whole save.', authorId: 'tm-marcus', createdAt: days(2), value: 128000, cheers: [YOU_MEMBER_ID, 'tm-dana'] },
    { id: 'an-news1', kind: 'news', title: '68% of quarterly quota with 3 weeks to go', body: 'Best position we’ve been in at this point in a quarter. Late-stage pipeline is strong — let’s convert.', authorId: 'tm-dana', createdAt: days(3), cheers: ['tm-priya'] },
    { id: 'an-update1', kind: 'update', title: 'Ovi now lives inside Team', body: '@mention Ovi in any channel to get instant answers, visuals, or have it action a request — it can prep a deck, book a meeting or push tasks straight into your list, across every app.', authorId: 'tm-sofia', createdAt: days(1), cheers: [YOU_MEMBER_ID, 'tm-marcus'] },
    { id: 'an-shout1', kind: 'shoutout', title: 'Shoutout to Priya 🙌', body: 'Fastest lead → booked-demo turnaround this month, twice over. The follow-up game is unmatched.', authorId: 'tm-marcus', createdAt: days(4), cheers: [YOU_MEMBER_ID, 'tm-dana', 'tm-sofia'] },
  ]

  // ── Departments — the whole-workforce layer ──
  const isoAgo = (d: number) => new Date(now - d * 86_400_000).toISOString().slice(0, 10)
  const isoIn = (d: number) => new Date(now + d * 86_400_000).toISOString().slice(0, 10)

  const employees: Employee[] = [
    { id: 'emp-jordan', name: 'Jordan Miles', role: 'Account Executive', dept: 'sales', startDate: isoAgo(720), status: 'active', managerId: 'emp-dana', color: '#13927B' },
    { id: 'emp-dana', name: 'Dana Okafor', role: 'CEO & Founder', dept: 'operations', startDate: isoAgo(1600), status: 'active', color: '#B01B4F' },
    { id: 'emp-priya', name: 'Priya Nair', role: 'Account Executive', dept: 'sales', startDate: isoAgo(400), status: 'active', managerId: 'emp-dana', color: '#0E9F6E' },
    { id: 'emp-marcus', name: 'Marcus Webb', role: 'Sales Lead', dept: 'sales', startDate: isoAgo(900), status: 'active', managerId: 'emp-dana', color: '#E8721A' },
    { id: 'emp-sofia', name: 'Sofia Reyes', role: 'Marketing Manager', dept: 'marketing', startDate: isoAgo(300), status: 'active', managerId: 'emp-dana', color: '#159C86' },
    { id: 'emp-nia', name: 'Nia Bennett', role: 'Finance Manager', dept: 'finance', startDate: isoAgo(540), status: 'active', managerId: 'emp-dana', color: '#0891B2' },
    { id: 'emp-ryan', name: 'Ryan Cole', role: 'Lead Installer', dept: 'delivery', startDate: isoAgo(650), status: 'active', managerId: 'emp-dana', color: '#0E9F6E' },
    { id: 'emp-dev', name: 'Dev Sharma', role: 'Electrician (Part P)', dept: 'delivery', startDate: isoAgo(210), status: 'active', managerId: 'emp-ryan', color: '#13927B' },
    { id: 'emp-marek', name: 'Marek Nowak', role: 'Installer / Roofer', dept: 'delivery', startDate: isoAgo(140), status: 'probation', managerId: 'emp-ryan', color: '#E8721A' },
    { id: 'emp-chloe', name: 'Chloe Adams', role: 'Surveyor', dept: 'delivery', startDate: isoAgo(95), status: 'active', managerId: 'emp-ryan', color: '#159C86' },
  ]

  const leaveRequests: LeaveRequest[] = [
    { id: 'lv1', employeeId: 'emp-dev', type: 'holiday', from: isoIn(6), to: isoIn(10), days: 3, status: 'pending', note: 'Family holiday', createdAt: hrs(20) },
    { id: 'lv2', employeeId: 'emp-chloe', type: 'holiday', from: isoIn(14), to: isoIn(18), days: 5, status: 'pending', createdAt: hrs(30) },
    { id: 'lv3', employeeId: 'emp-marek', type: 'sick', from: isoAgo(1), to: isoAgo(1), days: 1, status: 'approved', createdAt: days(1) },
    { id: 'lv4', employeeId: 'emp-priya', type: 'holiday', from: isoAgo(20), to: isoAgo(16), days: 4, status: 'approved', createdAt: days(30) },
  ]

  const policies: Policy[] = [
    { id: 'pol1', title: 'Employee handbook', category: 'Employment', owner: 'Dana Okafor', updatedAt: days(40), status: 'current' },
    { id: 'pol2', title: 'Health & Safety policy', category: 'Health & Safety', owner: 'Ryan Cole', updatedAt: days(200), status: 'review-due' },
    { id: 'pol3', title: 'Working at height — RAMS template', category: 'Health & Safety', owner: 'Ryan Cole', updatedAt: days(120), status: 'current' },
    { id: 'pol4', title: 'Data protection (UK GDPR)', category: 'IT & Data', owner: 'Dana Okafor', updatedAt: days(400), status: 'review-due' },
    { id: 'pol5', title: 'Expenses & travel policy', category: 'Finance', owner: 'Nia Bennett', updatedAt: days(60), status: 'current' },
    { id: 'pol6', title: 'Disciplinary & grievance', category: 'Conduct', owner: 'Dana Okafor', updatedAt: days(90), status: 'current' },
  ]

  const certifications: Certification[] = [
    { id: 'ct1', employeeId: 'emp-ryan', name: 'MCS (Solar PV)', issued: isoAgo(700), expires: isoIn(40) },
    { id: 'ct2', employeeId: 'emp-dev', name: 'NICEIC / Part P', issued: isoAgo(300), expires: isoIn(200) },
    { id: 'ct3', employeeId: 'emp-dev', name: 'First Aid at Work', issued: isoAgo(1000), expires: isoIn(18) },
    { id: 'ct4', employeeId: 'emp-marek', name: 'CSCS card', issued: isoAgo(500), expires: isoIn(25) },
    { id: 'ct5', employeeId: 'emp-ryan', name: 'Working at Height', issued: isoAgo(360), expires: isoIn(300) },
    { id: 'ct6', employeeId: 'emp-chloe', name: 'CSCS card', issued: isoAgo(90), expires: isoIn(640) },
  ]

  const expenses: Expense[] = [
    { id: 'ex1', date: isoAgo(2), category: 'Fuel', vendor: 'Shell', amount: 88.4, who: 'Ryan Cole', status: 'pending' },
    { id: 'ex2', date: isoAgo(3), category: 'Materials', vendor: 'City Electrical Factors', amount: 412.9, who: 'Dev Sharma', status: 'pending' },
    { id: 'ex3', date: isoAgo(5), category: 'Tools', vendor: 'Screwfix', amount: 149.99, who: 'Marek Nowak', status: 'approved' },
    { id: 'ex4', date: isoAgo(7), category: 'Software', vendor: 'Adobe', amount: 59.99, who: 'Sofia Reyes', status: 'reimbursed' },
    { id: 'ex5', date: isoAgo(1), category: 'Subsistence', vendor: 'Greggs', amount: 24.6, who: 'Chloe Adams', status: 'pending' },
  ]

  const stock: StockItem[] = [
    { id: 'st1', name: '450W mono panel', sku: 'PNL-450M', qty: 42, reorderAt: 60, unitCost: 92, supplier: 'Segen' },
    { id: 'st2', name: '5kW hybrid inverter', sku: 'INV-5KH', qty: 6, reorderAt: 8, unitCost: 780, supplier: 'Segen' },
    { id: 'st3', name: '5.2kWh battery module', sku: 'BAT-52', qty: 3, reorderAt: 6, unitCost: 1350, supplier: 'GivEnergy' },
    { id: 'st4', name: 'Roof mounting rail 4.2m', sku: 'MNT-42', qty: 120, reorderAt: 80, unitCost: 18, supplier: 'Van der Valk' },
    { id: 'st5', name: 'DC isolator', sku: 'ISO-DC', qty: 9, reorderAt: 20, unitCost: 14, supplier: 'City Electrical' },
  ]

  const reviews: Review[] = [
    { id: 'rv1', author: 'Helen T.', rating: 5, text: 'Immaculate install, tidy team, panels producing more than quoted. Highly recommend.', source: 'Google', date: isoAgo(2), responded: false },
    { id: 'rv2', author: 'Raj P.', rating: 5, text: 'From survey to switch-on in three weeks. Ryan’s crew were brilliant.', source: 'Checkatrade', date: isoAgo(6), responded: true },
    { id: 'rv3', author: 'Moira K.', rating: 4, text: 'Great work overall, slight delay on the battery but kept us informed.', source: 'Google', date: isoAgo(9), responded: false },
    { id: 'rv4', author: 'Dan W.', rating: 5, text: 'Best quote, no pressure, proper MCS paperwork. Would use again.', source: 'Trustpilot', date: isoAgo(14), responded: true },
  ]

  const customFields: CustomField[] = [
    { id: 'cf1', entity: 'deal', label: 'Contract length', type: 'select', options: ['1 year', '2 years', '3 years', '5 years'] },
    { id: 'cf2', entity: 'deal', label: 'Region', type: 'text' },
    { id: 'cf3', entity: 'person', label: 'LinkedIn', type: 'url' },
  ]
  deals[8].custom = { cf1: '3 years', cf2: 'North West' }
  deals[0].custom = { cf1: '2 years', cf2: 'London' }
  people[1].custom = { cf3: 'linkedin.com/in/callumreed' }

  // ── Solar House Marketing — brand & content operations ──
  const brandAssets: import('./types').BrandAsset[] = [
    { id: 'ba1', name: 'Primary logo — full colour', type: 'logo', format: 'SVG', tags: ['logo', 'primary'], version: 'v3', updatedAt: days(30), latest: true, note: 'Use on light backgrounds. Min width 120px.' },
    { id: 'ba2', name: 'Logo — reversed (white)', type: 'logo', format: 'SVG', tags: ['logo', 'reversed', 'dark-bg'], version: 'v3', updatedAt: days(30), latest: true },
    { id: 'ba3', name: 'Logo — monochrome', type: 'logo', format: 'PNG', tags: ['logo', 'mono'], version: 'v3', updatedAt: days(30), latest: true },
    { id: 'ba4', name: 'Brand guidelines', type: 'guideline', format: 'PDF', tags: ['guidelines', 'brand'], version: 'v2', updatedAt: days(45), latest: true, note: 'Logo, colour, type, tone, do’s & don’ts.' },
    { id: 'ba5', name: 'Pitch deck template', type: 'deck', format: 'PPTX', tags: ['deck', 'template', 'sales'], version: 'v4', updatedAt: days(14), latest: true },
    { id: 'ba6', name: 'Branded letterhead', type: 'header', format: 'DOCX', tags: ['letterhead', 'template'], version: 'v2', updatedAt: days(60), latest: true },
    { id: 'ba7', name: 'Proposal PDF template', type: 'pdf', format: 'PDF', tags: ['proposal', 'template'], version: 'v3', updatedAt: days(20), latest: true },
    { id: 'ba8', name: 'Email header banner', type: 'header', format: 'PNG', tags: ['email', 'header'], version: 'v1', updatedAt: days(90), latest: true },
    { id: 'ba9', name: 'Instrument Sans (brand font)', type: 'font', format: 'OTF', tags: ['font', 'type'], version: 'v1', updatedAt: days(120), latest: true },
  ]
  const messaging: import('./types').MessagingSnippet[] = [
    { id: 'ms1', label: 'Tagline', category: 'tagline', text: 'Own your energy.' },
    { id: 'ms2', label: 'Boilerplate (short)', category: 'boilerplate', text: 'Solar House Solar designs, installs and maintains MCS-certified solar & battery systems for homes and businesses across the North West.' },
    { id: 'ms3', label: 'Value prop — savings', category: 'value-prop', text: 'Cut your electricity bill from day one — and get paid for what you export.' },
    { id: 'ms4', label: 'Value prop — trust', category: 'value-prop', text: 'MCS-certified, fully insured, and rated 4.9★ by the homeowners we’ve switched on.' },
    { id: 'ms5', label: 'Tone of voice', category: 'tone', text: 'Confident, warm and plain-English. Lead with the customer’s goal, show savings before cost, never pushy.' },
    { id: 'ms6', label: 'Words we avoid', category: 'banned', text: 'No “cheap”, no “free” (say “included”), never over-promise output — always “estimated”.' },
  ]
  const mediaAssets: import('./types').MediaAsset[] = [
    { id: 'md1', name: 'Rooftop install — Manchester', type: 'image', tags: ['install', 'rooftop', 'hero'], source: 'upload', when: '3 days ago' },
    { id: 'md2', name: 'Crew on site (team photo)', type: 'image', tags: ['team', 'people'], source: 'upload', when: '2 weeks ago' },
    { id: 'md3', name: 'Battery unit — product shot', type: 'image', tags: ['product', 'battery'], source: 'upload', when: '1 month ago' },
    { id: 'md4', name: 'Install timelapse', type: 'video', tags: ['video', 'social'], source: 'upload', when: '5 days ago', license: 'Owned' },
    { id: 'md5', name: 'Savings explainer graphic', type: 'graphic', tags: ['social', 'explainer'], source: 'canva', when: 'Yesterday' },
    { id: 'md6', name: 'Winter offer — story card', type: 'graphic', tags: ['campaign', 'story'], source: 'claude-design', when: 'Today' },
  ]
  const contentItems: import('./types').ContentItem[] = [
    { id: 'ci1', title: 'Case study: Brightleaf Way install', channel: 'Blog', campaign: 'Winter warm-up', status: 'draft', owner: 'Sana Ali', date: 'Fri 29 Aug', note: 'From the won deal — savings + export income.' },
    { id: 'ci2', title: 'Manchester install — before/after carousel', channel: 'Instagram', campaign: 'Winter warm-up', status: 'review', owner: 'Sana Ali', date: 'Wed 27 Aug' },
    { id: 'ci3', title: '“Own your energy” — brand post', channel: 'LinkedIn', status: 'approved', owner: 'Sana Ali', date: 'Thu 28 Aug' },
    { id: 'ci4', title: 'SEG export — how getting paid works', channel: 'Blog', status: 'idea', owner: 'Ovi', date: 'Next week' },
    { id: 'ci5', title: 'Customer review spotlight — Helen T.', channel: 'X', status: 'scheduled', owner: 'Ovi', date: 'Mon 25 Aug 09:00' },
    { id: 'ci6', title: 'October battery offer — launch email', channel: 'Email', campaign: 'Autumn battery', status: 'brief', owner: 'Sana Ali', date: '1 Oct' },
    { id: 'ci7', title: 'Winter warm-up — teaser reel', channel: 'Instagram', campaign: 'Winter warm-up', status: 'published', owner: 'Sana Ali', date: '20 Aug' },
  ]
  const mktRequests: import('./types').MarketingRequest[] = [
    { id: 'mr1', from: 'Marcus Webb (Sales)', ask: 'Latest pitch deck template for the Fenwick meeting', status: 'found', assetId: 'ba5', when: '10 min ago' },
    { id: 'mr2', from: 'Priya Nair (Finance)', ask: 'Company logo in PNG for the invoice footer', status: 'new', when: '25 min ago' },
    { id: 'mr3', from: 'Devan Rao (Ops)', ask: 'Branded letterhead for a supplier letter', status: 'new', when: '1 hour ago' },
    { id: 'mr4', from: 'Jordan Miles (Sales)', ask: 'A social graphic for the Manchester install', status: 'in-progress', when: 'Yesterday', note: 'Sent to Canva with brand kit applied.' },
  ]
  const mktConnectors: import('./types').MarketingConnector[] = [
    { id: 'mc1', name: 'Canva', kind: 'design', connected: true, account: 'Solar House Solar (Team)', note: 'Designs sync back to Assets, tagged.' },
    { id: 'mc2', name: 'Claude Design', kind: 'design', connected: true, account: 'Workspace', note: 'Outputs (HTML/PNG/PDF) land in Assets. Editor opens in a new tab.' },
    { id: 'mc3', name: 'Figma', kind: 'design', connected: false, note: 'Connect to pull frames as brand assets.' },
    { id: 'mc4', name: 'Google Drive', kind: 'storage', connected: true, account: 'marketing@tellovi.io' },
    { id: 'mc5', name: 'LinkedIn Page', kind: 'social', connected: true, account: 'Solar House Solar' },
    { id: 'mc6', name: 'Instagram', kind: 'social', connected: true, account: '@tellovihq' },
    { id: 'mc7', name: 'X (Twitter)', kind: 'social', connected: false },
    { id: 'mc8', name: 'Google Analytics 4', kind: 'analytics', connected: true, account: 'veloxhouse.co.uk' },
    { id: 'mc9', name: 'Mailchimp', kind: 'email', connected: false, note: 'Connect for email campaign sync.' },
  ]

  const activeTrade = 'solar' as const
  const features = { ...tradeByKey(activeTrade).features }

  // Default pipeline matches the existing deal stage names (solar template).
  const defaultPipeline = pipelineFromTemplate(templateByKey('solar')!, 'pipe-default', 'Sales pipeline')
  const pipelines = [defaultPipeline]
  const activePipelineId = 'pipe-default'

  // ── Customer portals + analytics + resource library ──
  // Build a customer install journey from a list of [key,label,blurb] + how far along they are.
  const mile = (key: import('./types').PortalMilestoneKey, label: string, blurb: string, done: boolean, at?: number, date?: string): import('./types').PortalMilestone => ({ key, label, blurb, done, at, date })
  const portals: import('./types').CustomerPortal[] = [
    { id: 'cp1', dealId: 'd3', customer: 'Dana Kirk', email: 'dana@brightleaf.com', address: '14 Brightleaf Way, Manchester', systemKwp: 8.2, systemCost: 11480, annualSavings: 1420, installDate: isoDay(-40), status: 'active', invitedAt: days(45), lastActiveAt: hrs(3),
      hasBattery: true, hasEv: false, monitoringPlatform: 'Tesla', monitoringUrl: 'https://www.tesla.com/energy',
      journey: [
        mile('accepted', 'Proposal accepted', 'You signed off your system design and pricing.', true, days(52)),
        mile('survey', 'Technical survey', 'Our surveyor checked your roof, loft and consumer unit.', true, days(50)),
        mile('design', 'System design signed off', 'Final panel layout and battery position confirmed.', true, days(48)),
        mile('dno-submitted', 'Grid (DNO) application submitted', 'We applied to your network operator to connect your system.', true, days(47)),
        mile('dno-approved', 'Grid application approved', 'Your DNO gave the go-ahead to install and export.', true, days(43)),
        mile('scheduled', 'Installation booked', 'Your install date was confirmed with our crew.', true, days(42), isoDay(-40)),
        mile('installed', 'Installation complete', 'Panels, inverter and battery fitted in a single day.', true, days(40)),
        mile('commissioned', 'System switched on', 'We commissioned the system and set up your app.', true, days(40)),
        mile('handover', 'Handover & warranty pack', 'MCS certificate, DNO sign-off and all warranties issued.', true, days(38)),
      ] },
    { id: 'cp2', dealId: 'd1', customer: 'Elena Voss', email: 'elena@meridianpower.com', address: '8 Meridian Road, Leeds', systemKwp: 6.4, systemCost: 9200, annualSavings: 1090, status: 'active', invitedAt: days(9), lastActiveAt: hrs(26),
      hasBattery: false, hasEv: true, monitoringPlatform: 'SolarEdge', monitoringUrl: 'https://monitoring.solaredge.com',
      journey: [
        mile('accepted', 'Proposal accepted', 'You signed off your system design and pricing.', true, days(9)),
        mile('survey', 'Technical survey', 'Our surveyor checked your roof, loft and consumer unit.', true, days(7)),
        mile('design', 'System design signed off', 'Final panel layout confirmed.', true, days(5)),
        mile('dno-submitted', 'Grid (DNO) application submitted', 'We applied to your network operator to connect your system.', true, days(4)),
        mile('dno-approved', 'Grid application approved', 'Waiting on your network operator — usually 10 working days.', false, undefined),
        mile('scheduled', 'Installation booked', 'We’ll confirm your install date as soon as the grid’s approved.', false, undefined, isoDay(18)),
        mile('installed', 'Installation complete', 'Panels and inverter fitted — usually a single day.', false),
        mile('commissioned', 'System switched on', 'We commission the system and set up your app.', false),
        mile('handover', 'Handover & warranty pack', 'MCS certificate, DNO sign-off and all warranties.', false),
      ] },
    { id: 'cp3', dealId: 'd9', customer: 'Callum Reed', email: 'callum@cirrus.io', address: 'Cirrus DC, Warrington', systemKwp: 24, systemCost: 31200, annualSavings: 4180, status: 'invited', invitedAt: hrs(20),
      hasBattery: true, hasEv: false, monitoringPlatform: 'SolisCloud', monitoringUrl: 'https://www.soliscloud.com',
      journey: [
        mile('accepted', 'Proposal accepted', 'You signed off your system design and pricing.', true, hrs(22)),
        mile('survey', 'Technical survey', 'We’ll book a surveyor to visit the site.', false),
        mile('design', 'System design signed off', 'Final layout confirmed after survey.', false),
        mile('dno-submitted', 'Grid (DNO) application submitted', 'Larger systems need a formal connection application.', false),
        mile('dno-approved', 'Grid application approved', 'Awaiting network operator approval.', false),
        mile('scheduled', 'Installation booked', 'Install date confirmed with our crew.', false),
        mile('installed', 'Installation complete', 'System fitted and tidied.', false),
        mile('commissioned', 'System switched on', 'Commissioned and app set up.', false),
        mile('handover', 'Handover & warranty pack', 'Certificates and warranties issued.', false),
      ] },
  ]
  let _pe = 0
  const ev = (portalId: string, section: string, label: string, kind: import('./types').PortalEventKind, at: number, dwellMs?: number): import('./types').PortalEvent => ({ id: `pe${++_pe}`, portalId, section, label, kind, at, dwellMs })
  const portalEvents: import('./types').PortalEvent[] = [
    ev('cp1', 'Ask Ovi', 'Logged in', 'login', hrs(3)),
    ev('cp1', 'Proposal', 'System design & savings', 'view', hrs(3), 254_000),
    ev('cp1', 'Energy', 'Live generation', 'view', hrs(3), 132_000),
    ev('cp1', 'Documents', 'Handover certificate', 'download', hrs(3), 0),
    ev('cp1', 'Resources', 'Using the monitoring app', 'video', days(2), 96_000),
    ev('cp1', 'Ask Ovi', '“How do I read my export figures?”', 'chat', days(2)),
    ev('cp1', 'Resources', 'Tesla Powerwall — manual', 'view', days(5), 210_000),
    ev('cp2', 'Proposal', 'System design & savings', 'view', hrs(26), 188_000),
    ev('cp2', 'Proposal', 'Payment & finance options', 'click', hrs(26), 61_000),
    ev('cp2', 'Documents', 'Your proposal (PDF)', 'download', hrs(26), 0),
    ev('cp2', 'Ask Ovi', '“What happens on install day?”', 'chat', hrs(25)),
    ev('cp2', 'Energy', 'Projected savings', 'view', hrs(25), 74_000),
    ev('cp3', 'Proposal', 'System design & savings', 'view', hrs(20), 143_000),
    ev('cp3', 'Ask Ovi', 'Logged in', 'login', hrs(20)),
  ]
  const portalResources: import('./types').PortalResource[] = [
    { id: 'pr1', type: 'video', title: 'Welcome to your solar system', desc: 'A 3-minute tour of your new system and what to expect.', duration: '3:12', global: true },
    { id: 'pr2', type: 'video', title: 'Using the monitoring app', desc: 'Track generation, usage and savings from your phone.', duration: '4:48', global: true },
    { id: 'pr3', type: 'case-study', title: 'Brightleaf Farms — 62% off their bills', desc: 'How an 8.2 kWp system with battery transformed a working farm’s energy costs.', global: true },
    { id: 'pr4', type: 'guide', title: 'Getting the most from your battery', desc: 'Charge on cheap overnight rates, run the house on stored solar by day.', content: 'To maximise savings, set your battery to charge during your off-peak window (typically 00:30–04:30). Use the app’s schedule tab. In summer, leave 20% headroom so the battery can soak up midday solar. In winter, prioritise grid-charging overnight on a cheap tariff.', global: true },
    { id: 'pr5', type: 'manual', title: 'Tesla Powerwall — owner’s manual', manufacturer: 'Tesla', desc: 'Install, operation and troubleshooting for the Powerwall battery.', content: 'TROUBLESHOOTING. If the Powerwall shows a red light or the app reports it is offline: 1) Check the Powerwall is switched on — the ON/OFF switch is on the side of the unit; flip it to ON and wait 60 seconds. 2) Restart the Gateway: turn the grid isolator off for 30 seconds, then back on. 3) Re-connect Wi-Fi in the Tesla app under Settings → Network. 4) If it still shows offline after 5 minutes, the system is likely fine and just needs a Gateway reboot; if the red light persists, contact your installer. A flashing green light means it is charging normally.', global: true },
    { id: 'pr6', type: 'manual', title: 'SolarEdge inverter — quick guide', manufacturer: 'SolarEdge', desc: 'Reading the display, error codes and resets.', content: 'ERROR CODES. Error 18xx (AC voltage) usually clears itself when the grid stabilises. To reset the inverter: switch the ON/OFF/P switch to OFF, wait for the screen to power down, then back to ON. A steady green LED means normal production; a red LED indicates a fault — note the code on the display and share it with your installer.', global: true },
    { id: 'pr7', type: 'manual', title: 'GivEnergy battery — maintenance', manufacturer: 'GivEnergy', desc: 'Keeping your battery healthy year-round.', content: 'Keep the area around the battery clear and ventilated. Update firmware via the portal when prompted. If the battery stops charging, check the breaker and the app’s system status page before calling out an engineer.', global: true },
    { id: 'pr8', type: 'manual', title: 'Your Powerwall guide', manufacturer: 'Tesla', desc: 'Personalised for your install.', content: 'Your system pairs a Tesla Powerwall with a SolarEdge inverter. See the Tesla and SolarEdge manuals for troubleshooting. Your installer commissioned the system on your handover date.', global: false, portalId: 'cp1' },
  ]

  // ── Offers surfaced inside portals — some global, some pushed to one customer ──
  const portalOffers: import('./types').PortalOffer[] = [
    { id: 'po1', global: true, kind: 'referral', title: 'Refer a neighbour, you both get £150', blurb: 'Know someone with a sunny roof? When they go solar with us, you each get £150.', cta: 'Refer a friend', createdAt: days(20), status: 'active' },
    { id: 'po2', global: true, kind: 'service', title: 'Solar Care — annual health check', blurb: 'A yearly panel clean, performance check and priority support from £8/month.', cta: 'See Solar Care', savingHint: 'Keeps output at its best', createdAt: days(6), status: 'active' },
    { id: 'po3', portalId: 'cp2', kind: 'battery', title: 'Add a battery to your system', blurb: 'You’re exporting cheap solar by day and buying it back at night. A battery could store it — most of our customers add one within a year.', cta: 'Get a battery quote', savingHint: 'Save ~£320/yr more', createdAt: days(2), status: 'active' },
  ]

  // ── A live showroom session (a walk-in we're building a proposal with) ──
  const showroom: import('./types').ShowroomSession[] = [
    { id: 'show1', createdAt: hrs(1), name: 'Marcus & Jo Bell', email: 'marcus.bell@gmail.com', phone: '07700 900321', address: '22 Hazel Grove, Cheltenham', postcode: 'GL52 3AB',
      monthlySpend: 185, annualKwh: 4600, tariffPence: 28, occupancy: 'in_half_day', evMilesPerYear: 8000,
      design: { systemKwp: 4.8, panels: 10, hasBattery: false, batteryKwh: 5, hasEv: false, addEvCharger: false }, status: 'draft', presenter: 'Jordan Miles' },
  ]

  const dashboardWidgets: import('./types').DashboardWidget[] = [
    { id: 'w1', title: 'Open value by stage', metric: 'open', groupBy: 'stage', chart: 'bar' },
    { id: 'w2', title: 'Weighted value by owner', metric: 'weighted', groupBy: 'owner', chart: 'bar' },
    { id: 'w3', title: 'Deals by stage', metric: 'count', groupBy: 'stage', chart: 'donut' },
    { id: 'w4', title: 'Won value by owner', metric: 'won', groupBy: 'owner', chart: 'table' },
  ]

  // ── A submitted demo site survey (Owen Pryce — solar + battery), links job8 ↔ project pj4 ──
  const surveyPhoto = (section: string, key: string, label: string, required: boolean, captured: boolean) =>
    ({ id: `sph-${key}`, section, key, label, required, captured, name: captured ? `${key}.jpg` : undefined })
  const surveys: SiteSurvey[] = [
    {
      id: 'sur1', ref: 'SUR-2048', jobId: 'job8', projectId: 'pj4', personId: 'p4',
      address: '31 Victoria St, Rochdale', customer: 'Owen Pryce', surveyor: 'Priya Shah',
      products: ['solar', 'battery'], status: 'submitted',
      answers: {
        'prop.type': 'Semi-detached', 'prop.age': '1945–1964', 'prop.tenure': 'Owner-occupied', 'prop.present': 'true', 'prop.listed': 'false',
        'shade.level': 'Light', 'shade.sources': 'Neighbour’s conifer to the SW', 'shade.loss': '6',
        'loft.rafter': '47 × 100 mm', 'loft.spacing': '400', 'loft.membrane': 'true', 'loft.condition': 'Good', 'loft.access': 'Easy',
        'elec.mainFuse': '80 A', 'elec.phase': 'Single phase', 'elec.meter': 'Smart (SMETS2)', 'elec.earthing': 'TN-C-S (PME)',
        'elec.spareWays': '3', 'elec.existingGen': 'false', 'elec.inverterLoc': 'Loft, beside water tank', 'elec.isolatorLoc': 'External, beside meter box', 'elec.cableRun': '8',
        'bat.location': 'Garage, rear wall', 'bat.env': 'Garage', 'bat.wall': 'Brick', 'bat.distance': '4', 'bat.backup': 'true',
        'acc.scaffoldSides': '2', 'acc.scaffoldHeight': '6', 'acc.fragile': 'false', 'acc.asbestos': 'false', 'acc.parking': 'Good',
      },
      roof: [
        { id: 'rf-a', name: 'Rear (main)', orientationDeg: 175, pitchDeg: 35, covering: 'Concrete tile', coveringAge: '~55 yrs', condition: 'Good', widthM: 7.2, heightM: 4.1, obstructions: 'Soil vent pipe, bottom-right' },
        { id: 'rf-b', name: 'Front', orientationDeg: 355, pitchDeg: 35, covering: 'Concrete tile', condition: 'Good', widthM: 7.2, heightM: 4.1, obstructions: 'Chimney to the left' },
      ],
      photos: [
        surveyPhoto('property', 'front-elevation', 'Front of property', true, true),
        surveyPhoto('shading', 'horizon', 'Horizon from array location', true, true),
        surveyPhoto('loft', 'rafters', 'Rafters / structure', true, true),
        surveyPhoto('loft', 'defect', 'Any defect', false, false),
        surveyPhoto('electrical', 'consumer-unit', 'Consumer unit (open)', true, true),
        surveyPhoto('electrical', 'meter', 'Meter & main fuse', true, true),
        surveyPhoto('electrical', 'earthing', 'Earthing point', false, true),
        surveyPhoto('battery', 'battery-loc', 'Proposed battery location', true, true),
        surveyPhoto('access', 'access', 'Access / street view', false, false),
      ],
      surveyorNote: 'Straightforward job. Customer keen to add EV charger later — left space in the CU plan.',
      createdAt: days(3), updatedAt: days(3), submittedAt: days(3),
    },
  ]

  const sh = generateSolarHouse()
  return { deals: sh.deals, pipelines: [solarHousePipeline()], activePipelineId, dashboardWidgets, portals: [...sh.portals, ...portals], portalEvents: [...sh.portalEvents, ...portalEvents], portalResources, portalOffers, showroom: [...sh.sessions, ...showroom], portalTemplate: { live: defaultPortalConfig(), draft: defaultPortalConfig(), versions: [{ id: 'pv0', at: now - 30 * 86_400_000, by: 'Jordan Miles', note: 'First version of the customer portal', config: defaultPortalConfig() }] }, people: sh.people, orgs, leads: sh.leads, activities: sh.activities, emails, conversations: buildConversations(), inboxAutoReply: 'off' as const, meetings, agents, agentRuns, connections, webhooks, apiKeys, integrations, socialPosts, sequences, automations, linkedinThreads, enrolments, reachCampaigns, scheduledTasks, studioConfig, projects, playbooks, brandKit, docTemplates, brandDocs, products: mProducts, documents, emailCampaigns, customFields, activeTrade, features, onboarded: true, engineers, jobs, currentRole: 'owner', teamMembers, teamChannels, teamMessages, announcements, employees, leaveRequests, policies, certifications, expenses, stock, reviews, brandAssets, messaging, mediaAssets, contentItems, mktRequests, mktConnectors, solarCampaigns: [], solarProspects: [], designs: [], surveys, toasts: [], railExpanded: true }
}
