/* Installs — the post-sale half of the customer journey, derived from the same dated steps the
 * Sales side uses. One source of truth: a signed deal IS the install job. */
import type { Deal, Showroom } from '../store/types'
import { SHOWROOM_META } from './solarHouseData'
import type { Range } from './salesAnalytics'

const DAY = 86_400_000
export const INSTALL_STAGES = ['Contract signed', 'DNO pending', 'Ready to book', 'Install booked', 'On site', 'Handover', 'Complete'] as const
export type InstallStage = (typeof INSTALL_STAGES)[number]
export const INSTALL_STAGE_HELP: Record<InstallStage, string> = {
  'Contract signed': 'Signed — DNO not yet submitted, kit not ordered',
  'DNO pending': 'Waiting on the network operator',
  'Ready to book': 'DNO approved — needs an install date',
  'Install booked': 'Date set, kit & scaffold being lined up',
  'On site': 'Install in progress',
  Handover: 'Installed — commissioning, MCS & portal handover',
  Complete: 'Handed over — aftercare only',
}

const step = (d: Deal, k: string) => d.journey?.steps.find((s) => s.key === k)
export function installStage(d: Deal, now = Date.now()): InstallStage {
  const dno = step(d, 'dno'), ins = step(d, 'install'), hand = step(d, 'handover')
  if (hand?.done) return 'Complete'
  if (ins?.done) return 'Handover'
  if (ins && ins.at <= now) return 'On site'
  if (ins) return 'Install booked'
  if (dno?.done) return 'Ready to book'
  if (dno) return 'DNO pending'
  return 'Contract signed'
}
export const signedAt = (d: Deal) => step(d, 'signed')?.at ?? 0
export const installAt = (d: Deal) => step(d, 'install')?.at
export const daysSince = (t: number, now = Date.now()) => Math.max(0, Math.floor((now - t) / DAY))
export const outstanding = (d: Deal) => (d.journey?.delivery?.payments ?? []).filter((p) => p.status === 'due' || p.status === 'overdue').reduce((s, p) => s + p.amount, 0)

/** Delivery analytics — cohorts by the date the thing happened. */
export function analyseInstalls(deals: Deal[], r: Range, showroom: Showroom | 'all', now = Date.now()) {
  const ds = deals.filter((d) => d.won && d.journey?.delivery && (showroom === 'all' || d.journey.showroom === showroom))
  const inR = (t?: number) => t != null && t >= r.from && t <= r.to
  const installed = ds.filter((d) => inR(step(d, 'install')?.done))
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0)
  const days = (a?: number, b?: number) => (a != null && b != null ? (b - a) / DAY : undefined)
  const pick = (arr: (number | undefined)[]) => arr.filter((x): x is number => x != null)

  const dnoApproved = ds.filter((d) => inR(step(d, 'dno')?.done))
  const g98 = dnoApproved.filter((d) => step(d, 'dno')?.data?.form === 'G98'), g99 = dnoApproved.filter((d) => step(d, 'dno')?.data?.form === 'G99')
  const backlog = ds.filter((d) => !step(d, 'install')?.done)
  const byStage = INSTALL_STAGES.map((s) => ({ stage: s, n: ds.filter((d) => installStage(d, now) === s).length }))
  const teams = [...new Set(installed.map((d) => d.journey!.delivery!.team ?? '—'))].map((team) => {
    const t = installed.filter((d) => d.journey!.delivery!.team === team)
    return { team, installs: t.length, kwp: Math.round(t.reduce((s, d) => s + (d.journey!.system?.kwp ?? 0), 0) * 10) / 10, days: t.reduce((s, d) => s + d.journey!.delivery!.installDays, 0), snagRate: t.length ? Math.round((t.filter((d) => d.journey!.delivery!.snags.length).length / t.length) * 100) : 0 }
  }).sort((a, b) => b.installs - a.installs)
  const perShowroom = (Object.keys(SHOWROOM_META) as Showroom[]).map((s) => ({ s, n: installed.filter((d) => d.journey!.showroom === s).length }))
  const weeks: { start: number; n: number; kwp: number }[] = []
  for (let t = r.from; t < r.to; t += 7 * DAY) { const w = installed.filter((d) => { const x = step(d, 'install')!.done!; return x >= t && x < t + 7 * DAY }); weeks.push({ start: t, n: w.length, kwp: Math.round(w.reduce((s, d) => s + (d.journey!.system?.kwp ?? 0), 0)) }) }
  const upcoming = ds.filter((d) => { const a = installAt(d); return a && a > now && a < now + 14 * DAY }).sort((a, b) => installAt(a)! - installAt(b)!)
  const orders = ds.flatMap((d) => d.journey!.delivery!.orders)
  const payments = ds.flatMap((d) => d.journey!.delivery!.payments)
  const snagOpen = ds.filter((d) => d.journey!.delivery!.snags.some((s) => s.status === 'open'))
  const reviews = ds.filter((d) => inR(step(d, 'handover')?.at))

  return {
    kpi: {
      installed: installed.length, kwp: Math.round(installed.reduce((s, d) => s + (d.journey!.system?.kwp ?? 0), 0)), value: installed.reduce((s, d) => s + d.value, 0),
      signedToInstall: avg(pick(installed.map((d) => days(signedAt(d), step(d, 'install')!.done)))),
      signedToDno: avg(pick(ds.filter((d) => inR(step(d, 'dno')?.at)).map((d) => days(signedAt(d), step(d, 'dno')!.at)))),
      dnoG98: avg(pick(g98.map((d) => days(step(d, 'dno')!.at, step(d, 'dno')!.done)))), dnoG99: avg(pick(g99.map((d) => days(step(d, 'dno')!.at, step(d, 'dno')!.done)))),
      installToHandover: avg(pick(ds.filter((d) => inR(step(d, 'handover')?.at)).map((d) => days(step(d, 'install')!.done, step(d, 'handover')!.at)))),
      backlog: backlog.length, backlogValue: backlog.reduce((s, d) => s + d.value, 0),
      snagRate: installed.length ? Math.round((installed.filter((d) => d.journey!.delivery!.snags.length).length / installed.length) * 100) : 0,
      openSnags: snagOpen.length,
      outstanding: payments.filter((p) => p.status === 'due' || p.status === 'overdue').reduce((s, p) => s + p.amount, 0),
      overdue: payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + p.amount, 0),
      kitOnOrder: orders.filter((o) => o.status === 'ordered').reduce((s, o) => s + o.value, 0),
      toOrder: orders.filter((o) => o.status === 'to-order').length,
      fiveStar: reviews.length ? Math.round((reviews.filter((d) => String(step(d, 'handover')?.data?.review ?? '').startsWith('5★')).length / reviews.length) * 100) : 0,
    },
    byStage, teams, perShowroom, weeks, upcoming,
    dnoSplit: [{ k: 'G98 (notify)', n: g98.length }, { k: 'G99 (apply)', n: g99.length }],
  }
}
