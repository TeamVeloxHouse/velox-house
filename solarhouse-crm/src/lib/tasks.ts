import type { Activity } from '../store/types'

/** The activity types that behave like a to-do (vs. notes / change-log entries). */
export const isTask = (a: Activity) => a.type === 'task' || a.type === 'call' || a.type === 'meeting' || a.type === 'email'

export function isoDay(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const todayISO = () => isoDay()
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return isoDay(dt)
}

/** Machine-readable due date — falls back to parsing the legacy free-text `due` so seed data still buckets. */
export function effectiveDueDate(a: Activity): string | undefined {
  if (a.dueDate) return a.dueDate
  const t = (a.due ?? '').toLowerCase()
  if (!t) return undefined
  const today = todayISO()
  if (t.includes('today')) return today
  if (t.includes('tomorrow')) return addDaysISO(today, 1)
  if (t.includes('overdue') || t.includes('yesterday')) return addDaysISO(today, -1)
  if (t.includes('this week')) return addDaysISO(today, 3)
  if (t.includes('next week')) return addDaysISO(today, 7)
  return undefined
}

export type Bucket = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none' | 'done'
export function bucketOf(a: Activity): Bucket {
  if (a.done) return 'done'
  const due = effectiveDueDate(a)
  if (!due) return 'none'
  const today = todayISO()
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  if (due === addDaysISO(today, 1)) return 'tomorrow'
  return 'upcoming'
}

/** Was this task completed yesterday, or was it due yesterday? (drives the "Yesterday" review) */
export function isYesterday(a: Activity): boolean {
  const y = addDaysISO(todayISO(), -1)
  if (a.completedAt) return isoDay(new Date(a.completedAt)) === y
  return effectiveDueDate(a) === y
}

export function fmtMins(m?: number): string {
  if (!m) return ''
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h && mm) return `${h}h ${mm}m`
  if (h) return `${h}h`
  return `${mm}m`
}

export const ESTIMATES = [
  { m: 15, l: '15m' }, { m: 30, l: '30m' }, { m: 45, l: '45m' },
  { m: 60, l: '1h' }, { m: 120, l: '2h' }, { m: 240, l: 'Half day' }, { m: 480, l: 'Full day' },
]

export const BUCKET_META: Record<Bucket, { label: string; tone: string }> = {
  overdue: { label: 'Overdue', tone: '#C2410C' },
  today: { label: 'Today', tone: '#13927B' },
  tomorrow: { label: 'Tomorrow', tone: '#159C86' },
  upcoming: { label: 'Upcoming', tone: '#5B6577' },
  none: { label: 'No date', tone: '#8A93A3' },
  done: { label: 'Done', tone: '#0E7C66' },
}

/** Deterministic stand-in for Ovi's task breakdown — a real backend swaps this for a model call. */
export function oviSubtasks(subject: string): { subs: string[]; detail: string } {
  const s = subject.toLowerCase()
  if (s.includes('proposal') || s.includes('quote'))
    return { subs: ['Confirm scope & requirements', 'Build pricing / line items', 'Send for internal review', 'Email to the client'], detail: 'Ovi: pull the latest deal context and the price book, draft the proposal, and route it for a quick sign-off before it goes out.' }
  if (s.includes('call') || s.includes('follow'))
    return { subs: ['Review the last conversation', 'Note the 3 points to raise', 'Log the outcome + next step'], detail: 'Ovi: I’ve pulled the recent activity so you can open the call with context and leave with a clear next step.' }
  if (s.includes('meeting') || s.includes('demo'))
    return { subs: ['Confirm attendees & agenda', 'Prep the deck / talking points', 'Send the invite + joining link', 'Book the follow-up'], detail: 'Ovi: agenda drafted from the deal stage; I can send invites and add the notetaker automatically.' }
  if (s.includes('invoice') || s.includes('chase') || s.includes('payment'))
    return { subs: ['Check the amount & due date', 'Draft a friendly chase', 'Send + diarise a re-chase'], detail: 'Ovi: I can draft the chase with the exact figures and schedule the follow-up if it’s not paid.' }
  return { subs: ['Prep & gather what you need', 'Do the work', 'Follow up / hand off'], detail: 'Ovi: broken this into steps — tell me any one of them and I’ll take it on.' }
}
