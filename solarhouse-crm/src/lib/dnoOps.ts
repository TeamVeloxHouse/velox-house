import type { Deal, Journey } from '../store/types'

/* DNO applications, derived from the customer journeys (the 'dno' step) — one source of truth.
 * G98 = small systems (≤16A/phase): notify the network within 28 days of commissioning, no wait.
 * G99 = larger systems/batteries: apply first; the network has 45 working days to respond.
 * The step's data holds form, network, reference and any reply; `done` = approval received. */

const DAY = 86_400_000
export type DnoState = 'to-submit' | 'submitted' | 'info' | 'approved' | 'connected'
export const DNO_STATE: Record<DnoState, { label: string; color: string; bg: string; help: string }> = {
  'to-submit': { label: 'To submit', color: '#4A5A78', bg: '#EDF0F5', help: 'Contract signed — application not sent yet' },
  submitted: { label: 'With the DNO', color: '#15223B', bg: '#E9EDF4', help: 'Sent — waiting on the network' },
  info: { label: 'Info requested', color: '#B01B4F', bg: '#FDECEF', help: 'The network has asked a question' },
  approved: { label: 'Approved', color: '#0A5A4C', bg: '#E1F6F1', help: 'Offer / acceptance in — clear to install' },
  connected: { label: 'Connected', color: '#0A5A4C', bg: '#D6F7F0', help: 'Installed and commissioning notice filed' },
}
export const DNO_COLUMNS: DnoState[] = ['to-submit', 'submitted', 'info', 'approved', 'connected']

export type DnoRow = {
  deal: Deal
  state: DnoState
  form: 'G98' | 'G99'
  network: string
  reference?: string
  submittedAt?: number
  approvedAt?: number
  installAt?: number
  installed: boolean
  waitingDays: number // days with the DNO (or since signing, if not submitted)
  slaDays: number // G99: 45 working days ≈ 63 calendar; G98: 28 days to notify
  question?: string
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }
const QUESTIONS = ['Please confirm the inverter export limit setting.', 'Provide the battery datasheet and its G100 export-limitation scheme.', 'Please send a single-line diagram showing the battery connection point.', 'Confirm the MPAN and cut-out rating for the property.']

export function dnoOf(d: Deal, now = Date.now()): DnoRow | null {
  const j = d.journey
  if (!j || !d.won) return null
  const sys = j.system
  const step = j.steps.find((s) => s.key === 'dno')
  const signed = j.steps.find((s) => s.key === 'signed')
  const inst = j.steps.find((s) => s.key === 'install')
  const data = step?.data ?? {}
  const form = ((data.form as string) || ((sys?.kwp ?? 0) + (sys?.batteryKwh ?? 0) * 0.4 > 7 ? 'G99' : 'G98')) as 'G98' | 'G99'
  const network = (data.network as string) || (j.showroom === 'melksham' ? 'SSEN' : 'NGED')
  const installed = !!inst?.done
  const approvedAt = step?.done ?? (typeof data.approvedAt === 'number' ? data.approvedAt : undefined)
  const h = hash(d.id)
  let state: DnoState
  if (!step) state = 'to-submit'
  else if (installed && approvedAt) state = 'connected'
  else if (approvedAt) state = 'approved'
  else if (data.info === 'open' || (data.info !== 'answered' && form === 'G99' && now - step.at > 12 * DAY && h % 4 === 0)) state = 'info'
  else state = 'submitted'
  const since = step?.at ?? signed?.at ?? now
  return {
    deal: d, state, form, network, reference: data.reference as string | undefined,
    submittedAt: step?.at, approvedAt, installAt: inst?.at, installed,
    waitingDays: Math.max(0, Math.floor(((approvedAt ?? now) - since) / DAY)),
    slaDays: form === 'G99' ? 63 : 28,
    question: state === 'info' ? ((data.question as string) || QUESTIONS[h % QUESTIONS.length]) : undefined,
  }
}
export const allDno = (deals: Deal[], now = Date.now()) => deals.map((d) => dnoOf(d, now)).filter((x): x is DnoRow => !!x)

const withStep = (d: Deal, fn: (j: Journey) => Journey['steps']): Partial<Deal> => ({ journey: { ...(d.journey as Journey), steps: fn(d.journey as Journey) } })

/** Submit: opens the dno step with a generated reference. */
export function submitPatch(r: DnoRow, now = Date.now()): Partial<Deal> {
  const ref = `${r.network}-${4_000_000 + (hash(r.deal.id) % 999_999)}`
  return withStep(r.deal, (j) => {
    const steps = j.steps.filter((s) => s.key !== 'dno')
    const at = steps.findIndex((s) => s.key === 'install')
    const step = { key: 'dno' as const, at: now, by: 'Ops team', data: { form: r.form, network: r.network, reference: ref, approved: 'Awaiting' } }
    if (r.form === 'G98') Object.assign(step, { done: now }) // G98 is a notification — no wait
    return at < 0 ? [...steps, step] : [...steps.slice(0, at), step, ...steps.slice(at)]
  })
}
export function approvePatch(r: DnoRow, now = Date.now()): Partial<Deal> {
  return withStep(r.deal, (j) => j.steps.map((s) => (s.key === 'dno' ? { ...s, done: now, data: { ...(s.data ?? {}), approved: new Date(now).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), info: 'answered' } } : s)))
}
export function infoPatch(r: DnoRow, state: 'open' | 'answered', question?: string): Partial<Deal> {
  return withStep(r.deal, (j) => j.steps.map((s) => (s.key === 'dno' ? { ...s, data: { ...(s.data ?? {}), info: state, ...(question ? { question } : {}) } } : s)))
}
