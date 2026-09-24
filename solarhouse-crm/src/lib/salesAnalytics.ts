/* Showroom & sales analytics — every number is computed live from the deals' dated journeys and the
 * showroom diary, so it reflects exactly what's in the CRM. Cohorts are by the date the stage
 * happened (e.g. "proposal acceptance" = of proposals SENT in the range, how many have signed). */
import type { Deal, JourneyKey, ShowroomSession, Showroom } from '../store/types'
import { SHOWROOM_META } from './solarHouseData'

export type Range = { from: number; to: number }
const DAY = 86_400_000
const at = (d: Deal, k: JourneyKey) => d.journey?.steps.find((s) => s.key === k)?.at
const inR = (t: number | undefined, r: Range) => t != null && t >= r.from && t <= r.to
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const brand = (s?: string) => (s ? s.split(' ')[0] : '—')

export type Breakdown = { key: string; proposed: number; signed: number; acceptance: number; revenue: number; share: number }

export function analyse(deals: Deal[], sessions: ShowroomSession[], r: Range, showroom: Showroom | 'all') {
  const ds = deals.filter((d) => d.journey && (showroom === 'all' || d.journey.showroom === showroom))
  const locName = showroom === 'all' ? null : SHOWROOM_META[showroom].name
  const ss = sessions.filter((s) => s.scheduledDate && (!locName || s.location === locName))

  const enquiries = ds.filter((d) => inR(at(d, 'enquiry'), r))
  const consults = ds.filter((d) => inR(at(d, 'consultation'), r))
  const proposals = ds.filter((d) => inR(at(d, 'proposal'), r))
  const surveys = ds.filter((d) => inR(at(d, 'survey'), r))
  const signed = ds.filter((d) => inR(at(d, 'signed'), r))
  const installs = ds.filter((d) => { const s = d.journey!.steps.find((x) => x.key === 'install'); return inR(s?.done, r) })
  const revenue = signed.reduce((s, d) => s + d.value, 0)
  const sys = signed.map((d) => d.journey!.system!).filter(Boolean)

  const propSigned = proposals.filter((d) => at(d, 'signed'))
  const consultSigned = consults.filter((d) => at(d, 'signed'))
  const daysPropToSign = propSigned.map((d) => (at(d, 'signed')! - at(d, 'proposal')!) / DAY)
  const daysEnqToSign = signed.map((d) => (at(d, 'signed')! - at(d, 'enquiry')!) / DAY)
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0)

  const visits = ss.filter((s) => { const t = new Date(`${s.scheduledDate}T12:00`).getTime(); return t >= r.from && t <= r.to && s.bookingStatus !== 'cancelled' })
  const held = visits.filter((s) => s.bookingStatus === 'completed')
  const noShow = visits.filter((s) => s.bookingStatus === 'no-show')

  // Product acceptance — what's IN the proposals vs what actually gets signed.
  const by = (keyOf: (d: Deal) => string | undefined): Breakdown[] => {
    const m = new Map<string, { proposed: number; signed: number; revenue: number }>()
    proposals.forEach((d) => {
      const k = keyOf(d); if (!k) return
      const e = m.get(k) ?? { proposed: 0, signed: 0, revenue: 0 }
      e.proposed++
      if (at(d, 'signed')) { e.signed++; e.revenue += d.value }
      m.set(k, e)
    })
    const totalSigned = [...m.values()].reduce((s, e) => s + e.signed, 0)
    return [...m.entries()].map(([key, e]) => ({ key, ...e, acceptance: pct(e.signed, e.proposed), share: pct(e.signed, totalSigned) })).sort((a, b) => b.signed - a.signed || b.proposed - a.proposed)
  }
  const sysOf = (d: Deal) => d.journey?.system
  const products = {
    panels: by((d) => sysOf(d)?.panelModel),
    inverters: by((d) => sysOf(d)?.inverter),
    inverterBrand: by((d) => brand(sysOf(d)?.inverter)),
    batteries: by((d) => (sysOf(d)?.batteryKwh ? sysOf(d)?.batteryModel ?? 'Battery' : 'No battery')),
    batterySize: by((d) => { const k = sysOf(d)?.batteryKwh ?? 0; return !k ? 'No battery' : k < 8 ? 'Up to 8 kWh' : k < 12 ? '8–12 kWh' : '12 kWh +' }),
    systemSize: by((d) => { const k = sysOf(d)?.kwp ?? 0; return k < 4 ? 'Under 4 kWp' : k < 6 ? '4–6 kWp' : k < 8 ? '6–8 kWp' : '8 kWp +' }),
    finance: by((d) => sysOf(d)?.finance),
    ev: by((d) => (sysOf(d)?.evCharger ? 'With EV charger' : 'No EV charger')),
  }

  // Advisers
  const advisers = [...new Set(ds.map((d) => d.owner))].map((name) => {
    const c = consults.filter((d) => d.owner === name), p = proposals.filter((d) => d.owner === name), s = signed.filter((d) => d.owner === name)
    const rev = s.reduce((x, d) => x + d.value, 0)
    return { name, consults: c.length, proposals: p.length, signed: s.length, acceptance: pct(p.filter((d) => at(d, 'signed')).length, p.length), closeRate: pct(c.filter((d) => at(d, 'signed')).length, c.length), revenue: rev, aov: s.length ? Math.round(rev / s.length) : 0, batteryAttach: pct(s.filter((d) => d.journey?.system?.batteryKwh).length, s.length) }
  }).filter((a) => a.consults + a.proposals + a.signed > 0).sort((a, b) => b.revenue - a.revenue)

  // Lead sources (cohort by enquiry date)
  const sources = [...new Set(enquiries.map((d) => d.journey!.source))].map((src) => {
    const e = enquiries.filter((d) => d.journey!.source === src)
    const w = e.filter((d) => at(d, 'signed'))
    return { source: src, enquiries: e.length, signed: w.length, conversion: pct(w.length, e.length), revenue: w.reduce((s, d) => s + d.value, 0) }
  }).sort((a, b) => b.enquiries - a.enquiries)

  // Lost reasons (deals whose last activity fell in the range)
  const lostMap = new Map<string, number>()
  ds.filter((d) => d.lost && inR(d.journey!.steps[d.journey!.steps.length - 1].at, r)).forEach((d) => lostMap.set(d.lostReason ?? 'Other', (lostMap.get(d.lostReason ?? 'Other') ?? 0) + 1))
  const lost = [...lostMap.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n)

  // Weekly signed revenue across the range
  const weeks: { start: number; revenue: number; signed: number; proposals: number }[] = []
  for (let t = r.from; t < r.to; t += 7 * DAY) {
    const w = { from: t, to: Math.min(r.to, t + 7 * DAY - 1) }
    const sg = signed.filter((d) => inR(at(d, 'signed'), w))
    weeks.push({ start: t, revenue: sg.reduce((s, d) => s + d.value, 0), signed: sg.length, proposals: proposals.filter((d) => inR(at(d, 'proposal'), w)).length })
  }

  return {
    funnel: [
      { label: 'Enquiries', n: enquiries.length }, { label: 'Consultations', n: consults.length }, { label: 'Proposals', n: proposals.length },
      { label: 'Surveys', n: surveys.length }, { label: 'Signed', n: signed.length }, { label: 'Installed', n: installs.length },
    ],
    kpi: {
      revenue, signed: signed.length, installs: installs.length, enquiries: enquiries.length, consultations: consults.length, proposals: proposals.length,
      acceptance: pct(propSigned.length, proposals.length), closeRate: pct(consultSigned.length, consults.length), enquiryConversion: pct(enquiries.filter((d) => at(d, 'signed')).length, enquiries.length),
      aov: signed.length ? Math.round(revenue / signed.length) : 0, avgKwp: avg(sys.map((s) => s.kwp)),
      batteryAttach: pct(sys.filter((s) => s.batteryKwh).length, sys.length), evAttach: pct(sys.filter((s) => s.evCharger).length, sys.length), financeTakeUp: pct(sys.filter((s) => s.finance !== 'Cash').length, sys.length),
      daysPropToSign: avg(daysPropToSign), daysEnqToSign: avg(daysEnqToSign),
      visits: visits.length, visitsHeld: held.length, noShowRate: pct(noShow.length, held.length + noShow.length),
      visitClose: pct(held.filter((s) => s.status === 'won').length, held.length),
    },
    products, advisers, sources, lost, weeks,
  }
}
export type Analysis = ReturnType<typeof analyse>

export const PRESETS: { id: string; label: string; range: () => Range }[] = [
  { id: 'month', label: 'This month', range: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth(), 1).getTime(), to: Date.now() } } },
  { id: 'last-month', label: 'Last month', range: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 1, 1).getTime(), to: new Date(n.getFullYear(), n.getMonth(), 1).getTime() - 1 } } },
  { id: '30', label: 'Last 30 days', range: () => ({ from: Date.now() - 30 * DAY, to: Date.now() }) },
  { id: '90', label: 'Last 90 days', range: () => ({ from: Date.now() - 90 * DAY, to: Date.now() }) },
  { id: 'quarter', label: 'This quarter', range: () => { const n = new Date(); return { from: new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1).getTime(), to: Date.now() } } },
  { id: 'ytd', label: 'Year to date', range: () => ({ from: new Date(new Date().getFullYear(), 0, 1).getTime(), to: Date.now() }) },
]
/** The equally-long window immediately before — for "vs previous period" deltas. */
export const previous = (r: Range): Range => ({ from: r.from - (r.to - r.from) - 1, to: r.from - 1 })
