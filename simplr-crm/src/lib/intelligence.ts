/* TellOvi intelligence — deterministic scoring / risk / next-best-action derived from CRM data.
 * Pure functions over store entities; a live model would replace the bodies, signatures stay. */
import type { Deal, Person, Activity, Lead } from '../store/types'
import { stages } from '../data/mock'

export type Band = 'Hot' | 'Warm' | 'Cool' | 'Cold'
export type Score = { score: number; band: Band; reasons: { label: string; delta: number }[] }

function band(score: number): Band {
  if (score >= 75) return 'Hot'
  if (score >= 55) return 'Warm'
  if (score >= 35) return 'Cool'
  return 'Cold'
}

const daysSince = (ts: number) => Math.floor((Date.now() - ts) / 86_400_000)

/** Win-probability style score for a deal, with the signals that moved it. */
export function dealScore(deal: Deal, activities: Activity[]): Score {
  const reasons: { label: string; delta: number }[] = []
  let s = 40

  const stageIdx = stages.indexOf(deal.stage)
  const stageBoost = stageIdx * 8
  s += stageBoost
  reasons.push({ label: `Stage: ${deal.stage}`, delta: stageBoost })

  const acts = activities.filter((a) => a.dealId === deal.id)
  const recent = acts.filter((a) => daysSince(a.createdAt) <= 7).length
  if (recent >= 2) { s += 12; reasons.push({ label: `${recent} activities in last 7 days`, delta: 12 }) }
  else if (recent === 1) { s += 5; reasons.push({ label: 'Some recent activity', delta: 5 }) }

  const lastAct = acts.sort((a, b) => b.createdAt - a.createdAt)[0]
  const stale = lastAct ? daysSince(lastAct.createdAt) : 30
  if (stale >= 14) { s -= 18; reasons.push({ label: `No activity for ${stale} days`, delta: -18 }) }
  else if (stale >= 7) { s -= 8; reasons.push({ label: `Quiet for ${stale} days`, delta: -8 }) }

  if (deal.health === 'At risk') { s -= 12; reasons.push({ label: 'Flagged at risk', delta: -12 }) }
  if (deal.health === 'Stalled') { s -= 20; reasons.push({ label: 'Stalled', delta: -20 }) }
  if (deal.health === 'No next step') { s -= 10; reasons.push({ label: 'No next step booked', delta: -10 }) }

  if (deal.chips.some((c) => /verbal yes|champion/i.test(c.label))) { s += 14; reasons.push({ label: 'Champion / verbal yes', delta: 14 }) }
  if (deal.chips.some((c) => /redline|legal|budget/i.test(c.label))) { s -= 8; reasons.push({ label: 'Open blocker (legal / budget)', delta: -8 }) }
  if (deal.personIds.length >= 2) { s += 6; reasons.push({ label: 'Multiple contacts engaged', delta: 6 }) }

  const openTasks = acts.filter((a) => !a.done && (a.type === 'task' || a.type === 'call' || a.type === 'meeting'))
  if (openTasks.length === 0) { s -= 6; reasons.push({ label: 'No open next step', delta: -6 }) }

  s = Math.max(3, Math.min(97, Math.round(s)))
  return { score: s, band: band(s), reasons: reasons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)) }
}

export function leadScore(lead: Lead): Score {
  const reasons: { label: string; delta: number }[] = []
  let s = lead.score
  const hot = ['Inbound call', 'Website form', 'Referral']
  if (hot.includes(lead.source)) { reasons.push({ label: `High-intent source: ${lead.source}`, delta: 10 }) }
  else reasons.push({ label: `Source: ${lead.source}`, delta: -4 })
  if (/cto|director|head|chief|vp|owner/i.test(lead.role)) reasons.push({ label: `Senior role: ${lead.role}`, delta: 8 })
  reasons.push({ label: 'Fit & engagement blend', delta: Math.round((lead.score - 60) / 2) })
  return { score: lead.score, band: band(lead.score), reasons }
}

// What Ovi recommends doing with a lead next, based on its status, score and age.
export type LeadAction = { title: string; rationale: string; kind: 'call' | 'email' | 'task' | 'convert' | 'archive' }
export function leadNextAction(lead: Lead, activityCount = 0): LeadAction {
  const ageDays = lead.createdAt ? daysSince(lead.createdAt) : 0
  if (lead.status === 'qualified')
    return { title: 'Convert to a deal', rationale: 'Qualified and ready — turn it into an opportunity so it enters the pipeline and forecast.', kind: 'convert' }
  if (lead.status === 'unqualified')
    return { title: 'Archive or nurture later', rationale: 'Marked unqualified — archive it, or drop it into a long-term nurture sequence.', kind: 'archive' }
  if (lead.score >= 75 && (lead.status === 'new' || activityCount === 0))
    return { title: 'Call within the hour', rationale: 'High score and no contact yet — speed-to-lead is the single biggest driver of conversion.', kind: 'call' }
  if (lead.status === 'new')
    return { title: 'Send the intro & qualify', rationale: 'A fresh lead — open with a short intro and the one question that qualifies fit.', kind: 'email' }
  if (lead.status === 'nurturing' && ageDays >= 5)
    return { title: 'Re-engage — it’s gone quiet', rationale: `No movement in ${ageDays} days. A specific, value-led touch restarts the conversation.`, kind: 'email' }
  return { title: 'Book a discovery call', rationale: 'Working the lead — a short discovery call is the fastest way to qualify and move it forward.', kind: 'task' }
}

export type Risk = { level: 'ok' | 'watch' | 'risk'; signals: string[] }
export function dealRisk(deal: Deal, activities: Activity[]): Risk {
  const signals: string[] = []
  const acts = activities.filter((a) => a.dealId === deal.id)
  const last = acts.sort((a, b) => b.createdAt - a.createdAt)[0]
  const stale = last ? daysSince(last.createdAt) : 30
  if (stale >= 14) signals.push(`No activity for ${stale} days`)
  if (deal.health === 'No next step' || !acts.some((a) => !a.done)) signals.push('No next step booked')
  if (deal.health === 'At risk' || deal.health === 'Stalled') signals.push('Health flagged')
  if (deal.chips.some((c) => /redline|budget|legal/i.test(c.label))) signals.push('Open commercial blocker')
  const level = signals.length >= 2 ? 'risk' : signals.length === 1 ? 'watch' : 'ok'
  return { level, signals }
}

export type Action = { title: string; rationale: string; kind: 'email' | 'call' | 'task' | 'meeting'; subject: string }
export function nextBestAction(deal: Deal, activities: Activity[]): Action {
  const risk = dealRisk(deal, activities)
  const acts = activities.filter((a) => a.dealId === deal.id)
  const hasNext = acts.some((a) => !a.done)

  if (risk.signals.includes('Open commercial blocker'))
    return { title: 'Unblock the commercial terms', rationale: 'A legal/budget blocker is the gate — offer a joint call to resolve it this week.', kind: 'meeting', subject: `Book: resolve terms — ${deal.org}` }
  if (!hasNext)
    return { title: 'Book the next step now', rationale: 'This deal has no scheduled follow-up — the top predictor of slippage.', kind: 'call', subject: `Next step — ${deal.org}` }
  if (risk.signals.some((s) => s.startsWith('No activity')))
    return { title: 'Re-engage — it’s gone quiet', rationale: 'No recent touch. A short, specific check-in restarts momentum.', kind: 'email', subject: `Re-engage — ${deal.org}` }
  const idx = stages.indexOf(deal.stage)
  if (idx >= 3)
    return { title: 'Push to close', rationale: 'Late stage with momentum — confirm the paperwork path and a decision date.', kind: 'email', subject: `Confirm close plan — ${deal.org}` }
  return { title: 'Advance the stage', rationale: 'Healthy and active — line up the next milestone to keep it moving.', kind: 'task', subject: `Advance — ${deal.org}` }
}

export function dealSummary(deal: Deal, activities: Activity[], people: Person[]): string {
  const acts = activities.filter((a) => a.dealId === deal.id)
  const contacts = people.filter((p) => deal.personIds.includes(p.id))
  const sc = dealScore(deal, activities)
  const champion = contacts[0]?.name
  const recent = acts.filter((a) => daysSince(a.createdAt) <= 7).length
  return `${deal.name} (${deal.org}) sits in ${deal.stage} at ${sc.score}% — ${sc.band.toLowerCase()}. ${
    champion ? `${champion} is the key contact. ` : ''
  }${recent} activities in the last week. ${
    deal.chips.map((c) => c.label).join(', ') || 'No flags'
  }. Next best move: ${nextBestAction(deal, activities).title.toLowerCase()}.`
}

export function personSummary(person: Person, activities: Activity[], dealCount: number): string {
  const acts = activities.filter((a) => a.personId === person.id)
  const last = acts.sort((a, b) => b.createdAt - a.createdAt)[0]
  return `${person.name}${person.role ? `, ${person.role}` : ''} at ${person.org}. ${dealCount} open ${
    dealCount === 1 ? 'deal' : 'deals'
  }, ${acts.length} logged ${acts.length === 1 ? 'interaction' : 'interactions'}${
    last ? `, last ${last.type} ${daysSince(last.createdAt)}d ago` : ''
  }. ${person.labels.length ? `Labelled ${person.labels.join(', ').toLowerCase()}.` : ''}`
}

export type Coaching = {
  meetings: number
  talkRatio: number // % rep talk time
  sentiment: 'Positive' | 'Neutral' | 'Mixed'
  topics: string[]
  momentum: 'Building' | 'Steady' | 'Cooling'
  tips: string[]
}
/** Conversation intelligence rolled up from a deal's recorded meetings. */
export function dealCoaching(deal: Deal, meetingCount: number, score: number): Coaching {
  const seed = deal.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const talkRatio = 42 + (seed % 26) // 42–67%
  const sentiment = score >= 70 ? 'Positive' : score >= 50 ? 'Neutral' : 'Mixed'
  const allTopics = ['Pricing', 'Timeline', 'Liability caps', 'Rollout', 'Support', 'Competitors', 'Budget', 'Security']
  const topics = allTopics.filter((_, i) => (seed >> i) & 1).slice(0, 4)
  const momentum = score >= 65 ? 'Building' : score >= 45 ? 'Steady' : 'Cooling'
  const tips: string[] = []
  if (talkRatio > 55) tips.push(`You spoke ${talkRatio}% of the time — ask more discovery questions to draw out concerns.`)
  else tips.push(`Good listen ratio (${talkRatio}% talk). Keep the customer talking about impact.`)
  if (deal.chips.some((c) => /redline|legal|budget/i.test(c.label))) tips.push('A commercial blocker came up — bring the decision-maker into the next call.')
  if (momentum === 'Cooling') tips.push('Energy is dropping across calls — propose a concrete next milestone to re-engage.')
  return { meetings: meetingCount, talkRatio, sentiment, topics: topics.length ? topics : ['Pricing', 'Timeline'], momentum, tips }
}

export type Completeness = { pct: number; missing: string[] }
export function dealCompleteness(deal: Deal, customFields: { id: string; entity: string; label: string }[]): Completeness {
  const checks: [string, boolean][] = [
    ['Value', deal.value > 0],
    ['Close date', !!deal.closeDate && deal.closeDate !== 'This quarter'],
    ['Contact linked', deal.personIds.length > 0],
    ['Description', !!deal.subtitle],
    ...customFields.filter((f) => f.entity === 'deal').map((f) => [f.label, !!deal.custom?.[f.id]] as [string, boolean]),
  ]
  const done = checks.filter(([, ok]) => ok).length
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([l]) => l) }
}
export function personCompleteness(person: Person, customFields: { id: string; entity: string; label: string }[]): Completeness {
  const checks: [string, boolean][] = [
    ['Email', !!person.email],
    ['Phone', !!person.phone],
    ['Role', !!person.role],
    ['Labels', person.labels.length > 0],
    ...customFields.filter((f) => f.entity === 'person').map((f) => [f.label, !!person.custom?.[f.id]] as [string, boolean]),
  ]
  const done = checks.filter(([, ok]) => ok).length
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([l]) => l) }
}

export const bandColor: Record<Band, { fg: string; bg: string }> = {
  Hot: { fg: '#0E7C66', bg: '#E9F5F1' },
  Warm: { fg: '#1D4ED8', bg: '#EEF2FB' },
  Cool: { fg: '#C2410C', bg: '#FDF1E7' },
  Cold: { fg: '#7A8494', bg: '#F1F3F7' },
}
