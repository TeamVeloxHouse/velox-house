import type { Deal, Journey } from '../store/types'
import { SURVEYORS } from './solarHouseData'

/* Site surveys, derived from the customer journeys (the 'survey' step) — one source of truth.
 * The visit date + surveyor live in the step's data (`visit`, `surveyor`); deals seeded without a
 * stored visit get a stable derived one so the schedule is realistic. Completion is `completedAt`
 * (or the step being closed when the contract was signed). */

const DAY = 86_400_000
export type SurveyStatus = 'to-book' | 'booked' | 'today' | 'overdue' | 'completed'
export const SURVEY_STATUS: Record<SurveyStatus, { label: string; color: string; bg: string }> = {
  'to-book': { label: 'To book', color: '#4A5A78', bg: '#EDF0F5' },
  booked: { label: 'Booked', color: '#15223B', bg: '#E9EDF4' },
  today: { label: 'Today', color: '#0A5A4C', bg: '#D6F7F0' },
  overdue: { label: 'Not done yet', color: '#15223B', bg: '#D6F7F0' },
  completed: { label: 'Completed', color: '#0A5A4C', bg: '#E1F6F1' },
}
export const SLOTS = ['09:00', '11:30', '14:00'] as const

export type SurveyRow = {
  deal: Deal
  status: SurveyStatus
  visit?: number // start time of the visit
  surveyor?: string
  completedAt?: number
  bookedAt: number // when it entered the survey stage
  findings: { roof?: string; scaffold?: string; shading?: string; consumerUnit?: string; photos?: number }
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

export function surveyOf(d: Deal, now = Date.now()): SurveyRow | null {
  const step = d.journey?.steps.find((s) => s.key === 'survey')
  if (!step) return null
  const data = step.data ?? {}
  const h = hash(d.id)
  const completedAt = typeof data.completedAt === 'number' ? data.completedAt : step.done
  let visit = typeof data.visit === 'number' ? data.visit : undefined
  if (visit == null && !completedAt && h % 6 !== 0) {
    // stable derived booking: 2–12 days after entering the stage, in one of the day's slots
    const base = new Date(step.at + (2 + (h % 11)) * DAY); base.setHours([9, 11, 14][h % 3], [0, 30, 0][h % 3], 0, 0)
    if (base.getDay() === 0) base.setDate(base.getDate() + 1)
    visit = base.getTime()
  }
  if (completedAt && visit == null) { const v = new Date(completedAt); v.setHours([9, 11, 14][h % 3], [0, 30, 0][h % 3], 0, 0); visit = v.getTime() } // snap to a real slot
  const surveyor = (data.surveyor as string) || (completedAt || visit ? SURVEYORS[h % SURVEYORS.length] : undefined)
  const status: SurveyStatus = completedAt ? 'completed' : visit == null ? 'to-book' : sameDay(visit, now) ? 'today' : visit < now ? 'overdue' : 'booked'
  return {
    deal: d, status, visit, surveyor, completedAt, bookedAt: step.at,
    findings: { roof: data.roof as string, scaffold: data.scaffold as string, shading: data.shading as string, consumerUnit: data.consumerUnit as string, photos: data.photos as number },
  }
}

export function allSurveys(deals: Deal[], now = Date.now()): SurveyRow[] {
  return deals.map((d) => surveyOf(d, now)).filter((x): x is SurveyRow => !!x)
}

/** Patch for booking / rescheduling a visit. */
export function bookPatch(d: Deal, visit: number, surveyor: string): Partial<Deal> {
  const j = d.journey as Journey
  return {
    journey: {
      ...j,
      steps: j.steps.map((s) => (s.key === 'survey' ? { ...s, data: { ...(s.data ?? {}), visit, surveyor } } : s)),
      nextAction: { label: `Site survey with ${surveyor.split(' ')[0]}`, due: visit },
    },
  }
}

/** Patch for marking the survey done, with what the surveyor found. */
export function completePatch(d: Deal, findings: SurveyRow['findings'], surveyor: string, now = Date.now()): Partial<Deal> {
  const j = d.journey as Journey
  return {
    journey: {
      ...j,
      steps: j.steps.map((s) => (s.key === 'survey' ? { ...s, by: surveyor, data: { ...(s.data ?? {}), ...Object.fromEntries(Object.entries(findings).filter(([, v]) => v != null && v !== '')), surveyor, completedAt: now } } : s)),
      nextAction: { label: 'Send contract for signature', due: now + 2 * DAY },
    },
  }
}

export const needsUpgrade = (r: SurveyRow) => /upgrade/i.test(r.findings.consumerUnit ?? '')
export const needsBridging = (r: SurveyRow) => /bridg/i.test(r.findings.scaffold ?? '')
export const hasShading = (r: SurveyRow) => !!r.findings.shading && !/none/i.test(r.findings.shading)
