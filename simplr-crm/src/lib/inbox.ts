import type { EmailMsg } from '../store/types'

export type Intent = 'interested' | 'question' | 'objection' | 'scheduling' | 'ooo' | 'other'
export type Triage = { intent: Intent; label: string; tone: 'positive' | 'accent' | 'warning' | 'neutral' }

/** Deterministic stand-in for Ovi's inbox triage — a real backend swaps this for a model call. */
export function triageEmail(e: EmailMsg): Triage {
  const t = `${e.subject} ${e.body}`.toLowerCase()
  if (/out of office|annual leave|on leave|away until|auto[- ]?reply/.test(t)) return { intent: 'ooo', label: 'Out of office', tone: 'neutral' }
  if (/price|budget|cost|expensive|discount|too much|cheaper|redline|liability|terms/.test(t)) return { intent: 'objection', label: 'Needs handling', tone: 'warning' }
  if (/when (are|can|is)|available|what time|book (a|the)|schedule|calendar|set up a (call|meeting)|jump on/.test(t)) return { intent: 'scheduling', label: 'Wants to meet', tone: 'accent' }
  if (/\b(yes|great|sounds good|go ahead|happy to|let'?s|looks good|interested|approved|works for us)\b/.test(t)) return { intent: 'interested', label: 'Positive', tone: 'positive' }
  if (/\?|could you|can you|how (do|does|much)|what (is|are)|clarif|question/.test(t)) return { intent: 'question', label: 'Question', tone: 'accent' }
  return { intent: 'other', label: 'General', tone: 'neutral' }
}

export type ReplyDraft = { summary: string; body: string; suggestions: string[] }

/** Draft a contextual reply to an inbound email. */
export function draftReply(e: EmailMsg, opts: { dealName?: string; contactFirst?: string } = {}): ReplyDraft {
  const first = opts.contactFirst || e.from.split(' ')[0]
  const { intent } = triageEmail(e)
  const dealBit = opts.dealName ? ` on ${opts.dealName}` : ''
  const sign = '\n\nBest,\nJordan'

  const summaries: Record<Intent, string> = {
    interested: `${first} is positive and ready to move forward${dealBit}. Best next step is to lock the next milestone and keep momentum.`,
    question: `${first} has a question that needs a clear, specific answer before they can move${dealBit}. Answer it directly and offer a call if it's involved.`,
    objection: `${first} has raised a commercial concern${dealBit}. Acknowledge it, reframe the value, and offer a concrete way to resolve it — a call or written terms.`,
    scheduling: `${first} wants to find time to talk${dealBit}. Offer two concrete slots and confirm the agenda.`,
    ooo: `${first} is out of office. No reply needed now — Ovi can follow up when they're back.`,
    other: `${first} sent a general note${dealBit}. A short, warm acknowledgement keeps the thread alive.`,
  }
  const bodies: Record<Intent, string> = {
    interested: `Hi ${first},\n\nGreat to hear — thanks for confirming. I'll get the next step moving straight away and send everything you need to review. If it's easier to talk it through, I can grab 20 minutes this week.${sign}`,
    question: `Hi ${first},\n\nGood question — here's the short version, and I've kept it specific so you can move quickly. If it would help to walk through it live, I'm happy to jump on a quick call this week.${sign}`,
    objection: `Hi ${first},\n\nCompletely understand the concern. Here's how we usually resolve it: I'll put the key terms in writing so it's clear, and I'm glad to get the right people on a short call to work through the detail. I'll hold current pricing while we do.${sign}`,
    scheduling: `Hi ${first},\n\nHappy to find time. Would Wednesday morning or Thursday afternoon work? I'll send an invite with a short agenda so we make the most of it.${sign}`,
    ooo: `Hi ${first},\n\nThanks for the note — I'll follow up when you're back. Nothing needed from you in the meantime.${sign}`,
    other: `Hi ${first},\n\nThanks for getting in touch — really appreciate it. Let me know if there's anything you'd like me to pull together, and I'll turn it around quickly.${sign}`,
  }
  const suggestionSets: Record<Intent, string[]> = {
    interested: ['Confirm & book next step', 'Send what they need', 'Offer a quick call'],
    question: ['Answer directly', 'Offer a call', 'Attach the detail'],
    objection: ['Put terms in writing', 'Offer a legal/finance call', 'Hold pricing'],
    scheduling: ['Offer two slots', 'Send an invite', 'Confirm the agenda'],
    ooo: ['Snooze until they’re back', 'Log & move on'],
    other: ['Acknowledge', 'Ask what they need'],
  }
  return { summary: summaries[intent], body: bodies[intent], suggestions: suggestionSets[intent] }
}
