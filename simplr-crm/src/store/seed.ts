import { deals as mDeals, people as mPeople, orgs as mOrgs, leads as mLeads, products as mProducts } from '../data/mock'
import type { State, Deal, Person, Activity, EmailMsg, Meeting, Agent, AgentRun, Connection, CustomField, Webhook, ApiKey, Integration, SocialPost, Sequence, Automation, LinkedInThread, Enrolment, ReachCampaign, ScheduledTask, StudioConfig, StudioProject, Engineer, Job } from './types'
import { MILESTONES } from '../lib/delivery'
import { tradeByKey } from '../lib/trades'

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
    { id: 'ag1', name: 'Inbox triage', desc: 'Reads new email, links to deals, drafts replies', runs: '48 today', on: true, schedule: 'Realtime' },
    { id: 'ag2', name: 'Deal-risk watch', desc: 'Flags stalls and suggests recovery plays', runs: '6 alerts', on: true, schedule: 'Every hour' },
    { id: 'ag3', name: 'Meeting notetaker', desc: 'Joins calls, transcribes, updates cards', runs: '3 this week', on: true, schedule: 'On meetings' },
    { id: 'ag4', name: 'Lead qualifier', desc: 'Scores & routes inbound leads', runs: '12 today', on: true, schedule: 'Realtime' },
    { id: 'ag5', name: 'Follow-up chaser', desc: 'Nudges deals with no next step', runs: 'Paused', on: false, schedule: 'Daily · 07:00' },
  ]

  const agentRuns: AgentRun[] = [
    { id: 'ar1', agent: 'Inbox triage', kind: 'draft', title: 'Drafted reply to Callum Reed', detail: 'Re: Revised proposal v3 — addresses the liability-cap question and proposes a legal call. Ready to review and send.', when: mins(20), status: 'pending', dealId: 'd9', personId: 'p2', emailTo: 'callum@cirrus.com', emailBody: 'Hi Callum,\n\nThanks for the quick turnaround. On the liability caps: our standard is a 12-month fees cap and I’ve reflected that in the SOW. Happy to get legal on a short call this week to close it out.\n\nBest,\nJordan' },
    { id: 'ar2', agent: 'Deal-risk watch', kind: 'risk', title: 'Gale Renewables has gone quiet', detail: 'No activity in 9 days on a $512K deal stuck in budget review. Recommend a re-engagement email to the economic buyer.', when: hrs(2), status: 'pending', dealId: 'd10' },
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
    mk('in15', 'Unipile', 'Email & calendar', 'Email, calendar & LinkedIn in one API', '#1D4ED8', 'unipile.com'),
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
  const leads = mLeads.map((l, i) => ({ ...l, createdAt: parseWhen(l.created) - i * 3_600_000 }))

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
      { id: 'as2', kind: 'condition', title: 'Value is over $50,000', subtitle: 'Only run for higher-value opportunities' },
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
    company: 'Simplr Solar', primary: '#1D4ED8', accent: '#F5A623', font: 'Inter',
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
    { id: 'eng1', name: 'Ryan Cole', skills: 'Lead installer · MCS', color: '#1D4ED8', initials: 'RC' },
    { id: 'eng2', name: 'Dev Sharma', skills: 'Electrician · Part P', color: '#0E9F6E', initials: 'DS' },
    { id: 'eng3', name: 'Marek Nowak', skills: 'Installer · roofing', color: '#E8721A', initials: 'MN' },
    { id: 'eng4', name: 'Chloe Adams', skills: 'Surveyor', color: '#7C5CFF', initials: 'CA' },
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

  const customFields: CustomField[] = [
    { id: 'cf1', entity: 'deal', label: 'Contract length', type: 'select', options: ['1 year', '2 years', '3 years', '5 years'] },
    { id: 'cf2', entity: 'deal', label: 'Region', type: 'text' },
    { id: 'cf3', entity: 'person', label: 'LinkedIn', type: 'url' },
  ]
  deals[8].custom = { cf1: '3 years', cf2: 'North West' }
  deals[0].custom = { cf1: '2 years', cf2: 'London' }
  people[1].custom = { cf3: 'linkedin.com/in/callumreed' }

  const activeTrade = 'solar' as const
  const features = { ...tradeByKey(activeTrade).features }

  return { deals, people, orgs, leads, activities, emails, meetings, agents, agentRuns, connections, webhooks, apiKeys, integrations, socialPosts, sequences, automations, linkedinThreads, enrolments, reachCampaigns, scheduledTasks, studioConfig, projects, playbooks, brandKit, docTemplates, brandDocs, products: mProducts, documents, emailCampaigns, customFields, activeTrade, features, onboarded: false, engineers, jobs, currentRole: 'owner', toasts: [], railExpanded: true }
}
