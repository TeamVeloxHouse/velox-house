/* Customer journey helpers — shared by the Deals board, the work queue and the customer record. */
import type { Deal, JourneyKey, JourneyStep } from '../store/types'
import { JOURNEY, SH_STAGES } from './solarHouseData'

const DAY = 86_400_000

/** What each stage needs before it can be completed — drives the checklist on the record. */
export const STAGE_GUIDE: Record<JourneyKey, { what: string; needs: string[]; next: string; slaDays: number }> = {
  enquiry: { what: 'A homeowner has asked about solar. Speed wins here: call within the hour.', needs: ['Call or message the homeowner', 'Confirm address & roof direction', 'Capture annual usage or a recent bill'], next: 'Call back', slaDays: 1 },
  contacted: { what: 'We’ve spoken. Get them to a consultation, in the showroom or at home.', needs: ['Understand goals (bills, EV, backup)', 'Book the consultation', 'Send the showroom confirmation'], next: 'Book consultation', slaDays: 5 },
  consultation: { what: 'Face-to-face with an adviser. Design the system together and explain the ROI.', needs: ['Walk through ROI assessment', 'Agree system size & battery', 'Discuss finance options'], next: 'Send proposal', slaDays: 3 },
  proposal: { what: 'The proposal is with the homeowner. Follow up, handle questions, and book the survey.', needs: ['Proposal sent & opened', 'Questions answered', 'Survey date agreed'], next: 'Book survey', slaDays: 10 },
  survey: { what: 'A surveyor checks the roof, electrics and access so the price is final.', needs: ['Roof & structure checked', 'Consumer unit & earthing checked', 'Photos uploaded', 'Final price confirmed'], next: 'Send contract', slaDays: 7 },
  signed: { what: 'Contract signed and deposit taken. Now it’s over to operations.', needs: ['Contract signed', 'Deposit received', 'Finance approved (if used)'], next: 'Submit DNO', slaDays: 3 },
  dno: { what: 'Notify or apply to the network operator and lock in the install date.', needs: ['G98 notified / G99 approved', 'Install date booked', 'Kit ordered', 'Scaffold booked'], next: 'Install', slaDays: 30 },
  install: { what: 'Scaffold up, panels on, battery in and the system commissioned.', needs: ['Install completed', 'System commissioned', 'Photos & test results logged'], next: 'Handover', slaDays: 3 },
  handover: { what: 'MCS certificate, warranties and the customer portal handed over. Ask for a review.', needs: ['MCS certificate issued', 'Portal live & walkthrough done', 'Review requested'], next: 'Aftercare', slaDays: 7 },
}

export const labelOf = (k: JourneyKey) => JOURNEY.find((j) => j.key === k)?.label ?? k
export const currentStep = (d: Deal): JourneyStep | undefined => d.journey?.steps[d.journey.steps.length - 1]
export const daysInStage = (d: Deal, now = Date.now()) => { const s = currentStep(d); return s ? Math.max(0, Math.floor((now - s.at) / DAY)) : 0 }
export const enquiredAt = (d: Deal) => d.journey?.steps[0]?.at ?? 0
export const isComplete = (d: Deal) => !!d.journey?.steps.find((s) => s.key === 'handover')?.done

/** Traffic-light on time spent in the current stage vs that stage's expected turnaround. */
export function stageAge(d: Deal): { days: number; tone: 'ok' | 'warn' | 'late'; color: string; bg: string } {
  const s = currentStep(d)
  const days = daysInStage(d)
  const sla = s ? STAGE_GUIDE[s.key].slaDays : 7
  const tone = days <= sla ? 'ok' : days <= sla * 2 ? 'warn' : 'late'
  return { days, tone, color: tone === 'ok' ? '#0E7C66' : tone === 'warn' ? '#B45309' : '#B01B4F', bg: tone === 'ok' ? '#E9F5F1' : tone === 'warn' ? '#FDF3E3' : '#FDECEF' }
}

export function dueLabel(due: number, now = Date.now()) {
  const d = Math.round((due - now) / DAY)
  return { text: d < -1 ? `${-d}d overdue` : d === -1 ? 'Due yesterday' : d === 0 ? 'Due today' : d === 1 ? 'Tomorrow' : `In ${d}d`, overdue: d < 0 }
}

/** Complete the current stage and open the next one — returns the Deal patch to apply. */
export function advancePatch(d: Deal, by: string, now = Date.now()): Partial<Deal> | null {
  const j = d.journey
  if (!j) return null
  const cur = j.steps[j.steps.length - 1]
  const idx = JOURNEY.findIndex((x) => x.key === cur.key)
  const next = JOURNEY[idx + 1]
  const steps = j.steps.map((s, i) => (i === j.steps.length - 1 ? { ...s, done: s.done ?? now } : s))
  if (next) steps.push({ key: next.key, at: now, by })
  const nextStage = next ? next.stage : SH_STAGES[5]
  const signed = steps.some((s) => s.key === 'signed')
  const guide = next ? STAGE_GUIDE[next.key] : null
  return {
    stage: nextStage,
    won: signed || undefined,
    probability: signed ? 100 : [10, 20, 40, 60, 80, 100][SH_STAGES.indexOf(nextStage as (typeof SH_STAGES)[number])] ?? d.probability,
    health: 'Healthy',
    journey: { ...j, steps, nextAction: guide ? { label: guide.next, due: now + guide.slaDays * DAY } : undefined },
  }
}
