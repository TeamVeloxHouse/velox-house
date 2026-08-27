/* TellOvi AI — the copilot that sits inside the Team channel.
 *
 * A deterministic, offline stand-in for a live LLM (same pattern as lib/ai.ts):
 * it parses intent from a chat message, composes an accurate answer with visuals
 * from the real store data, and — crucially — plans concrete actions that get
 * executed against the CRM/Reach/Studio store so a request like "prepare a
 * presentation" turns into a real deck + tasks the moment it's read.
 *
 * Swap `teamAnswer()` for a Claude tool-use backend and the plan contract below
 * stays identical, so the channel UI is unchanged.
 */
import { live } from '../store/store'
import { buildSeed } from '../store/seed'
import { money } from './format'
import type { TeamAiBlock, TeamActionKind } from '../store/types'

const S = () => live.state ?? buildSeed()
const openDeals = () => S().deals.filter((d) => !d.won && !d.lost)
const wonDeals = () => S().deals.filter((d) => d.won)
const atRisk = () => openDeals().filter((d) => d.health === 'At risk' || d.health === 'Stalled' || d.health === 'No next step')

/** A concrete thing the AI will do, executed by the page and shown as an openable chip. */
export type PlannedAction = { kind: TeamActionKind; label: string; to?: string }

export type TeamAiPlan = {
  text: string // the lead line of the reply
  blocks?: TeamAiBlock[] // structured answer + visuals
  actions?: PlannedAction[] // side-effects to run + render as chips
  working: string[] // step labels streamed while "working" before the reply lands
}

/** True when a message clearly wants the AI to do or answer something. */
export function wantsAi(text: string, channelHasAi: boolean): boolean {
  const q = text.toLowerCase()
  if (/@\s?(tellovi|ai)\b/.test(q)) return true
  if (!channelHasAi) return false
  if (text.trim().endsWith('?')) return true
  return /\b(prepare|draft|write|book|schedule|set up|create|send|show|find|summar|build|pull|chase|remind|analyse|analyze|report|forecast)\b/.test(q)
}

const nextWeek = () => {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}
const friday = () => {
  const d = new Date()
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

function pipelineBars(): TeamAiBlock {
  const byStage = openDeals().reduce<Record<string, number>>((a, d) => { a[d.stage] = (a[d.stage] ?? 0) + d.value; return a }, {})
  const items = Object.entries(byStage)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, display: money(value, { compact: true }), tone: 'accent' as const }))
  return { type: 'bars', title: 'Open pipeline by stage', items }
}

export function teamAnswer(prompt: string): TeamAiPlan {
  const q = prompt.toLowerCase().trim()
  const totalOpen = openDeals().reduce((s, d) => s + d.value, 0)

  // 1. Prepare a presentation / deck / board pack → real deck + prep tasks
  if (/\b(presentation|deck|slides|board pack|pitch|present|slide)\b/.test(q)) {
    const focus = /win/.test(q) ? 'Q3 pipeline & recent wins' : /pipeline|forecast|quarter/.test(q) ? 'Q3 pipeline' : 'the quarter'
    const wonTotal = wonDeals().reduce((s, d) => s + d.value, 0)
    return {
      working: ['Reading the request', 'Pulling Q3 pipeline & won deals', 'Drafting the narrative & slide outline', 'Creating prep tasks and a deck in Studio'],
      text: `On it — I’ve drafted a board deck on **${focus}** and pushed the prep into your tasks. Aim is a first cut by **${friday()}**, ready for the board on **${nextWeek()}**.`,
      blocks: [
        { type: 'agenda', title: 'Board deck — proposed outline', items: [
          'Where we are — 68% to quota, 3 weeks left',
          `Open pipeline — ${money(totalOpen, { compact: true })} across ${openDeals().length} deals`,
          'Late-stage concentration & the two deals that swing the quarter',
          `Recent wins — ${money(wonTotal, { compact: true })} closed, incl. Cirrus Hosting`,
          'At-risk deals & the plan to unblock them',
          'Ask of the board',
        ] },
        { type: 'stats', items: [
          { label: 'Open pipeline', value: money(totalOpen, { compact: true }) },
          { label: 'Won (lifetime)', value: money(wonTotal, { compact: true }), tone: 'positive' },
          { label: 'At risk', value: String(atRisk().length), tone: 'negative' },
          { label: 'Draft due', value: friday().split(',')[0] },
        ] },
      ],
      actions: [
        { kind: 'deck', label: 'Board deck — Q3 review', to: '/studio/brand' },
        { kind: 'task', label: '3 prep tasks added', to: '/activities' },
      ],
    }
  }

  // 2. Book / schedule a meeting → real meeting
  if (/\b(book|schedule|set up|arrange)\b.*\b(meeting|call|review|catch.?up|sync|walkthrough|demo)\b/.test(q) || /\bbook a (call|meeting|slot)\b/.test(q)) {
    return {
      working: ['Reading the request', 'Checking calendars', 'Creating the meeting'],
      text: `Done — I’ve put a meeting on the calendar and added it to your activities. I’ll send invites once you confirm the attendees.`,
      actions: [
        { kind: 'meeting', label: 'Meeting scheduled', to: '/meetings' },
        { kind: 'task', label: 'Prep task added', to: '/activities' },
      ],
    }
  }

  // 3. Pipeline / forecast / numbers → stats + bar-chart visual
  if (/\b(pipeline|forecast|quota|numbers|revenue|how.*(doing|going|shaping)|quarter|target)\b/.test(q)) {
    return {
      working: ['Aggregating deals by stage', 'Applying win-probability weights'],
      text: `Here’s the pipeline as it stands. Healthy but back-loaded — the value is in the late stages.`,
      blocks: [
        { type: 'stats', items: [
          { label: 'Open pipeline', value: money(totalOpen, { compact: true }) },
          { label: 'Weighted', value: money(Math.round(totalOpen * 0.33), { compact: true }), tone: 'muted' },
          { label: 'Open deals', value: String(openDeals().length) },
          { label: 'To quota', value: '68%', tone: 'positive' },
        ] },
        pipelineBars(),
      ],
    }
  }

  // 4. At risk → visual of the exposure
  if (/\b(risk|stalled|stuck|slipping|attention|blocked|blocker)\b/.test(q)) {
    const risk = atRisk()
    const bars = risk.slice(0, 6).map((d) => ({ label: d.org, value: d.value, display: money(d.value, { compact: true }), tone: 'warning' as const }))
    return {
      working: ['Scanning deal-health signals'],
      text: `${risk.length} open deals need attention — **${money(risk.reduce((s, d) => s + d.value, 0), { compact: true })}** of exposure. Mostly stalled activity, not lost interest, so it’s recoverable.`,
      blocks: [{ type: 'bars', title: 'At-risk deals by value', items: bars }],
      actions: [{ kind: 'task', label: 'Add a next step to each', to: '/activities' }],
    }
  }

  // 5. Wins / closed → celebrate + offer to post to the board
  if (/\b(win|won|closed|celebrat|smashed|landed)\b/.test(q)) {
    const wonTotal = wonDeals().reduce((s, d) => s + d.value, 0)
    return {
      working: ['Tallying closed-won this period'],
      text: `Nice — **${money(wonTotal, { compact: true })}** closed so far. Want me to post it to the Announcements board so the whole team sees it?`,
      blocks: [{ type: 'stats', items: [
        { label: 'Won (lifetime)', value: money(wonTotal, { compact: true }), tone: 'positive' },
        { label: 'Deals won', value: String(wonDeals().length), tone: 'positive' },
      ] }],
    }
  }

  // 6. Draft an email
  if (/\b(draft|write|compose|follow.?up|email|reply|reach out)\b/.test(q)) {
    const person = S().people[1]
    const deal = openDeals()[0]
    return {
      working: ['Reading the thread & deal history', 'Matching your tone'],
      text: `Here’s a draft follow-up you can send — warm, specific, one clear ask:`,
      blocks: [{
        type: 'email',
        to: `${person?.name.split(' ')[0].toLowerCase() ?? 'there'}@${(person?.org ?? 'client').split(' ')[0].toLowerCase()}.com`,
        subject: `Next steps on ${deal?.name ?? 'our proposal'}`,
        body: `Hi ${person?.name.split(' ')[0] ?? 'there'},\n\nThanks again for the time. I’ve incorporated the phased rollout and split out the maintenance retainer so finance can see it clearly.\n\nCould we aim to confirm by end of next week? I’ll hold the pricing until then.\n\nBest,\nJordan`,
      }],
      actions: [{ kind: 'email', label: 'Open in Sales Inbox', to: '/inbox' }],
    }
  }

  // 7. Create a task / reminder → real task pushed to activities
  if (/\b(task|remind|todo|to-do|chase|action|add a|note to)\b/.test(q)) {
    return {
      working: ['Adding it to your tasks'],
      text: `Added to your tasks — it’ll show up in Activities with a due date of tomorrow.`,
      actions: [{ kind: 'task', label: 'Task added', to: '/activities' }],
    }
  }

  // 8. Summarise a deal / account
  if (/\b(summar|brief|tell me about|status of|where.*at|overview|recap)\b/.test(q)) {
    const deal = openDeals()[0]
    return {
      working: ['Reading activities, emails & the quote'],
      text: `**${deal?.name ?? 'That deal'}** — ${deal?.org ?? ''}. Verbal yes with a champion, gated on legal redlines and procurement sign-off. Momentum is good; probability ~65%.`,
      blocks: deal ? [{ type: 'stats', items: [
        { label: 'Value', value: money(deal.value, { compact: true }) },
        { label: 'Stage', value: deal.stage },
        { label: 'Health', value: deal.health, tone: deal.health === 'Healthy' ? 'positive' : 'negative' },
      ] }] : undefined,
    }
  }

  // Fallback — describe what it can do, in-channel
  return {
    working: ['Thinking'],
    text: `I’m in this channel and connected to every app. I can pull live numbers with a chart, draft & send emails, prep a board deck, book meetings, or push tasks to your list — just ask, or @mention me on any teammate’s message and I’ll handle it.`,
  }
}
