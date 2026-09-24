import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Kpi, Panel, Segmented } from '../components/ui'
import { MonthColumns, Funnel, HBars, Legend, DataTable, Delta, C } from '../components/charts'
import { Target, Pie, Bars, Users, Wrench, Clock, Dollar, Sun } from '../components/icons'
import { useState_ } from '../store/store'
import type { Deal, Showroom } from '../store/types'
import { money } from '../lib/format'
import { SH_STAGES, SHOWROOM_META } from '../lib/solarHouseData'
import { stageAge, enquiredAt } from '../lib/journey'
import { installAt } from '../lib/installs'

/* Sales forecast — month-by-month, board-pack style.
 * Actuals come from the dated journey steps on every deal; the forward view weights each open deal by
 * its stage's historic chance of signing and lands it in the month it's expected to close. */

const DAY = 86_400_000
// Chance an open deal in each stage goes on to sign, and typical days left until it does.
const STAGE_P: Record<string, number> = { 'New enquiry': 0.08, Contacted: 0.14, Consultation: 0.3, 'Proposal sent': 0.48, Survey: 0.78, Signed: 1 }
const DAYS_LEFT: Record<string, number> = { 'New enquiry': 38, Contacted: 31, Consultation: 22, 'Proposal sent': 13, Survey: 6, Signed: 0 }
const mKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const mLabel = (k: string, long = false) => new Date(`${k}-15`).toLocaleDateString('en-GB', { month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}) })
const at = (d: Deal, key: string) => d.journey?.steps.find((s) => s.key === key)?.at
const fmtK = (n: number) => money(n, { compact: true })
const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]
const TARGET_KEY = 'shc.forecast.target'

export function Forecast() {
  const nav = useNavigate()
  const { deals } = useState_()
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const [target, setTarget] = useState<number | null>(() => { try { const v = localStorage.getItem(TARGET_KEY); return v ? Number(v) : null } catch { return null } })

  const now = Date.now()
  const all = useMemo(() => deals.filter((d) => d.journey && (showroom === 'all' || d.journey.showroom === showroom)), [deals, showroom])
  const open = all.filter((d) => !d.won && !d.lost)

  // months: 6 back, this month, 3 forward
  const thisKey = mKey(now)
  const months = useMemo(() => {
    const out: string[] = []
    const d = new Date(); d.setDate(15)
    for (let i = -6; i <= 3; i++) { const x = new Date(d.getFullYear(), d.getMonth() + i, 15); out.push(mKey(x.getTime())) }
    return out
  }, [])
  const pastKeys = months.filter((k) => k < thisKey)
  const futureKeys = months.filter((k) => k > thisKey)

  // actuals by month
  const byMonth = useMemo(() => {
    const m: Record<string, { enq: number; cons: number; prop: number; signedN: number; signedV: number; installs: number; lost: number }> = {}
    months.forEach((k) => (m[k] = { enq: 0, cons: 0, prop: 0, signedN: 0, signedV: 0, installs: 0, lost: 0 }))
    all.forEach((d) => {
      const e = at(d, 'enquiry') ?? enquiredAt(d); if (e && m[mKey(e)]) m[mKey(e)].enq++
      const c = at(d, 'consultation'); if (c && m[mKey(c)]) m[mKey(c)].cons++
      const p = at(d, 'proposal'); if (p && m[mKey(p)]) m[mKey(p)].prop++
      const s = at(d, 'signed'); if (s && d.won && m[mKey(s)]) { m[mKey(s)].signedN++; m[mKey(s)].signedV += d.value }
      const i = d.journey?.steps.find((x) => x.key === 'install')?.done; if (i && m[mKey(i)]) m[mKey(i)].installs++
    })
    return m
  }, [all, months])

  // forward view: each open deal weighted by stage, landed in its expected close month
  const fwdPipe = useMemo(() => {
    const m: Record<string, { weighted: number; best: number; n: number }> = {}
    months.forEach((k) => (m[k] = { weighted: 0, best: 0, n: 0 }))
    open.forEach((d) => {
      const p = STAGE_P[d.stage] ?? 0.1
      const eta = now + Math.max(2, DAYS_LEFT[d.stage] ?? 30) * DAY
      const k = mKey(eta)
      if (m[k]) { m[k].weighted += d.value * p; m[k].best += p >= 0.3 ? d.value : 0; m[k].n++ }
    })
    return m
  }, [open, months, now])

  // …plus new business that hasn't enquired yet: recent enquiry run-rate × conversion × avg system,
  // phased in (half next month while the current pipeline dominates, then full).
  const runRate = useMemo(() => {
    const last3 = pastKeys.slice(-3)
    const enq = last3.reduce((s, k) => s + byMonth[k].enq, 0) / Math.max(1, last3.length)
    const decided = all.filter((d) => d.won || d.lost)
    const conv = decided.length ? decided.filter((d) => d.won).length / decided.length : 0.3
    const won = all.filter((d) => d.won)
    const avg = won.length ? won.reduce((s, d) => s + d.value, 0) / won.length : 12_000
    return enq * conv * avg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, byMonth])
  const fwd = useMemo(() => {
    const m: typeof fwdPipe = {}
    Object.entries(fwdPipe).forEach(([k, v]) => { const i = futureKeys.indexOf(k); m[k] = { ...v, weighted: v.weighted + (i >= 0 ? runRate * (i === 0 ? 0.5 : 1) : 0) } })
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fwdPipe, runRate])

  const avg3 = pastKeys.slice(-3).reduce((s, k) => s + byMonth[k].signedV, 0) / 3
  const autoTarget = Math.max(10_000, Math.round((avg3 * 1.1) / 5_000) * 5_000)
  const monthTarget = target ?? autoTarget
  const signedThis = byMonth[thisKey]?.signedV ?? 0
  const landingThis = signedThis + (fwd[thisKey]?.weighted ?? 0)
  const lastKey = pastKeys[pastKeys.length - 1]
  const signedLast = byMonth[lastKey]?.signedV ?? 0
  const weightedPipe = open.reduce((s, d) => s + d.value * (STAGE_P[d.stage] ?? 0.1), 0)
  const openValue = open.reduce((s, d) => s + d.value, 0)
  const next3 = futureKeys.reduce((s, k) => s + fwd[k].weighted, 0)
  const atRisk = open.filter((d) => stageAge(d).tone === 'late')
  const dayOfMonth = new Date().getDate(), daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()

  const chart = months.map((k) => ({
    label: mLabel(k),
    value: k < thisKey ? byMonth[k].signedV : k === thisKey ? landingThis : fwd[k].weighted,
    forecast: k >= thisKey,
    sub: k < thisKey ? `${byMonth[k].signedN} systems signed` : k === thisKey ? `${fmtK(signedThis)} signed so far + ${fmtK(fwd[k].weighted)} weighted` : `${fwd[k].n} deals expected · best case ${fmtK(fwd[k].best)}`,
  }))

  // pipeline by stage
  const stageRows = SH_STAGES.filter((s) => s !== 'Signed').map((s) => {
    const list = open.filter((d) => d.stage === s)
    const v = list.reduce((a, d) => a + d.value, 0)
    return { s, n: list.length, v, w: v * STAGE_P[s], p: STAGE_P[s], age: list.length ? Math.round(list.reduce((a, d) => a + stageAge(d).days, 0) / list.length) : 0 }
  })

  // by showroom & adviser
  const srRows = SHOWROOMS.map((s) => {
    const mine = deals.filter((d) => d.journey?.showroom === s)
    const o = mine.filter((d) => !d.won && !d.lost)
    const sig = mine.filter((d) => d.won && (at(d, 'signed') ?? 0) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime())
    const decided = mine.filter((d) => d.won || d.lost)
    return { s, open: o.reduce((a, d) => a + d.value, 0), w: o.reduce((a, d) => a + d.value * (STAGE_P[d.stage] ?? 0.1), 0), signed: sig.reduce((a, d) => a + d.value, 0), win: decided.length ? Math.round((decided.filter((d) => d.won).length / decided.length) * 100) : 0 }
  })
  const owners = [...new Set(all.map((d) => d.owner))]
  const advRows = owners.map((o) => {
    const mine = all.filter((d) => d.owner === o)
    const op = mine.filter((d) => !d.won && !d.lost)
    const decided = mine.filter((d) => d.won || d.lost)
    return { o, n: op.length, w: op.reduce((a, d) => a + d.value * (STAGE_P[d.stage] ?? 0.1), 0), signed: byMonth[thisKey] ? mine.filter((d) => d.won && mKey(at(d, 'signed') ?? 0) === thisKey).reduce((a, d) => a + d.value, 0) : 0, win: decided.length ? Math.round((decided.filter((d) => d.won).length / decided.length) * 100) : 0 }
  }).sort((a, b) => b.w - a.w)

  // expected installs (cash-in) forward
  const installFwd = futureKeys.concat(thisKey).sort().map((k) => {
    const list = all.filter((d) => d.won && installAt(d) && mKey(installAt(d)!) === k)
    return { k, n: list.length, v: list.reduce((a, d) => a + d.value, 0) }
  })

  return (
    <>
      <TopBar
        title="Forecast"
        crumbs={['Sales']}
        identity={{ icon: Target, accent: '#15223B' }}
        center={<Segmented options={['All', ...SHOWROOMS.map((s) => SHOWROOM_META[s].name)]} value={showroom === 'all' ? 'All' : SHOWROOM_META[showroom].name} onChange={(v) => setShowroom(v === 'All' ? 'all' : (SHOWROOMS.find((s) => SHOWROOM_META[s].name === v) ?? 'all'))} />}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="px-7 py-6 flex flex-col gap-5 max-w-[1500px]">
          {/* headline */}
          <div className="grid grid-cols-4 gap-4">
            <Kpi variant="navy" icon={Target} label={`${mLabel(thisKey, true)} — landing at`} value={fmtK(landingThis)} meter={Math.min(100, (landingThis / monthTarget) * 100)} meterMark={Math.min(100, (dayOfMonth / daysInMonth) * 100)}
              delta={`${Math.round((landingThis / monthTarget) * 100)}% of ${fmtK(monthTarget)} target · ${fmtK(signedThis)} signed so far`} />
            <Kpi icon={Dollar} label="Signed last month" value={fmtK(signedLast)} delta={`${byMonth[lastKey]?.signedN ?? 0} systems · ${mLabel(lastKey, true)}`} deltaTone="muted" />
            <Kpi icon={Bars} label="Weighted pipeline" value={fmtK(weightedPipe)} delta={`of ${fmtK(openValue)} open across ${open.length} homes`} deltaTone="muted" />
            <Kpi variant="teal" icon={Sun} label="Next 3 months (weighted)" value={fmtK(next3)} delta={futureKeys.map((k) => `${mLabel(k)} ${fmtK(fwd[k].weighted)}`).join(' · ')} />
          </div>

          {/* month by month */}
          <Panel title="Signed revenue — month by month" sub="Six months of actuals, this month's landing estimate and the next three months weighted by stage" icon={Bars}
            action={<label className="flex items-center gap-2 text-[12px] text-muted-b">Monthly target £<input type="number" value={monthTarget} onChange={(e) => { const v = Number(e.target.value) || 0; setTarget(v); try { localStorage.setItem(TARGET_KEY, String(v)) } catch { /* ignore */ } }} className="w-24 h-8 px-2 rounded-[8px] border border-[#E1E6EC] text-[12.5px] font-semibold text-ink outline-none focus:border-accent-400" /></label>}>
            <div className="flex items-center justify-between mb-3"><Legend items={[{ label: 'Signed (actual)', swatch: C.actual }, { label: 'Forecast (weighted)', swatch: C.forecast, hatched: true }, { label: 'Monthly target', swatch: C.target, dashed: true }]} /></div>
            <MonthColumns data={chart} target={monthTarget} fmt={fmtK} height={240} />
          </Panel>

          <Panel title="Month-by-month comparison" sub="Every stage of the funnel, per month — with the change on the month before" icon={Pie} pad={false}>
            <div className="p-4">
              <DataTable
                cols={[{ label: 'Month', w: '120px' }, { label: 'Enquiries', align: 'right' }, { label: 'Consultations', align: 'right' }, { label: 'Proposals', align: 'right' }, { label: 'Signed', align: 'right' }, { label: 'Signed £', align: 'right' }, { label: 'Avg system', align: 'right' }, { label: 'Enquiry → signed', align: 'right' }, { label: 'vs prior month', align: 'right' }, { label: 'vs target', align: 'right' }]}
                rows={[...pastKeys, thisKey].map((k, i, arr) => {
                  const r = byMonth[k], prev = i > 0 ? byMonth[arr[i - 1]] : undefined
                  return [
                    <b key="m">{mLabel(k, true)}{k === thisKey && <span className="text-muted-3 font-normal"> · to date</span>}</b>,
                    r.enq, r.cons, r.prop, r.signedN, fmtK(r.signedV), r.signedN ? fmtK(r.signedV / r.signedN) : '—',
                    r.enq ? `${Math.round((r.signedN / r.enq) * 100)}%` : '—',
                    prev ? <Delta key="d" now={r.signedV} prev={prev.signedV} /> : '—',
                    <span key="t" className="font-semibold">{Math.round((r.signedV / monthTarget) * 100)}%</span>,
                  ]
                })}
                foot={(() => { const ks = [...pastKeys, thisKey]; const t = ks.reduce((a, k) => ({ enq: a.enq + byMonth[k].enq, cons: a.cons + byMonth[k].cons, prop: a.prop + byMonth[k].prop, n: a.n + byMonth[k].signedN, v: a.v + byMonth[k].signedV }), { enq: 0, cons: 0, prop: 0, n: 0, v: 0 }); return ['7 months', t.enq, t.cons, t.prop, t.n, fmtK(t.v), t.n ? fmtK(t.v / t.n) : '—', t.enq ? `${Math.round((t.n / t.enq) * 100)}%` : '—', '', ''] })()}
              />
            </div>
          </Panel>

          <div className="grid grid-cols-[1.25fr_1fr] gap-5">
            <Panel title="Expected pipeline by stage" sub="Open value, the chance each stage signs, and what that's worth today" icon={Target} pad={false}>
              <div className="p-4 flex flex-col gap-4">
                <Funnel steps={stageRows.map((r) => ({ label: r.s, value: r.v }))} fmt={fmtK} />
                <DataTable
                  cols={[{ label: 'Stage', w: '130px' }, { label: 'Homes', align: 'right' }, { label: 'Open value', align: 'right' }, { label: 'Chance', align: 'right' }, { label: 'Weighted', align: 'right' }, { label: 'Avg days in stage', align: 'right' }]}
                  rows={stageRows.map((r) => [<b key="s">{r.s}</b>, r.n, fmtK(r.v), `${Math.round(r.p * 100)}%`, <b key="w">{fmtK(r.w)}</b>, r.age])}
                  foot={['Total', stageRows.reduce((a, r) => a + r.n, 0), fmtK(openValue), '', fmtK(weightedPipe), '']}
                />
              </div>
            </Panel>
            <div className="flex flex-col gap-5">
              <Panel title="By showroom" sub="Open, weighted and signed this month" icon={Sun}>
                <HBars data={srRows.map((r) => ({ label: SHOWROOM_META[r.s].name, value: r.w, color: SHOWROOM_META[r.s].color, tip: `Open ${fmtK(r.open)} · signed this month ${fmtK(r.signed)} · win rate ${r.win}%` }))} fmt={fmtK} />
                <div className="mt-4">
                  <DataTable cols={[{ label: 'Showroom' }, { label: 'Open', align: 'right' }, { label: 'Weighted', align: 'right' }, { label: 'Signed MTD', align: 'right' }, { label: 'Win rate', align: 'right' }]}
                    rows={srRows.map((r) => [<span key="n" className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: SHOWROOM_META[r.s].color }} />{SHOWROOM_META[r.s].name}</span>, fmtK(r.open), fmtK(r.w), fmtK(r.signed), `${r.win}%`])} />
                </div>
              </Panel>
              <Panel title="Installs booked ahead" sub="Signed work landing by month — the revenue you'll actually invoice" icon={Wrench}>
                <HBars data={installFwd.map((r) => ({ label: mLabel(r.k, true), value: r.v, sub: `${r.n} installs` }))} fmt={fmtK} color="#15223B" />
              </Panel>
            </div>
          </div>

          <div className="grid grid-cols-[1.25fr_1fr] gap-5">
            <Panel title="Advisers" sub="Weighted pipeline, signed this month and win rate" icon={Users} pad={false}>
              <div className="p-4">
                <DataTable cols={[{ label: 'Adviser', w: 'minmax(140px,1.4fr)' }, { label: 'Open homes', align: 'right' }, { label: 'Weighted', align: 'right' }, { label: 'Signed MTD', align: 'right' }, { label: 'Win rate', align: 'right' }]}
                  rows={advRows.map((r) => [<b key="o">{r.o}</b>, r.n, fmtK(r.w), fmtK(r.signed), `${r.win}%`])} />
              </div>
            </Panel>
            <Panel title="Slipping deals" sub="Past the usual time for their stage — worth a push" icon={Clock}>
              <div className="flex items-baseline gap-3 mb-3"><span className="text-[28px] font-extrabold text-ink tabular-nums">{fmtK(atRisk.reduce((a, d) => a + d.value, 0))}</span><span className="text-[12.5px] text-muted-b">across {atRisk.length} homes · {fmtK(atRisk.reduce((a, d) => a + d.value * (STAGE_P[d.stage] ?? 0.1), 0))} weighted</span></div>
              <div className="flex flex-col divide-y divide-[#F0F2F5]">
                {[...atRisk].sort((a, b) => b.value - a.value).slice(0, 6).map((d) => (
                  <button key={d.id} onClick={() => nav(`/deals/${d.id}`)} className="py-2 flex items-center gap-3 text-left hover:bg-[#FAFCFB] -mx-1 px-1 rounded">
                    <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink-2 truncate">{d.name}</span><span className="block text-[11.5px] text-muted-2 truncate">{d.stage} · {stageAge(d).days} days · {d.owner}</span></span>
                    <span className="text-[13px] font-bold text-ink tabular-nums">{fmtK(d.value)}</span>
                  </button>
                ))}
                {!atRisk.length && <div className="py-6 text-center text-[12.5px] text-muted-2">Nothing slipping.</div>}
              </div>
            </Panel>
          </div>
          <div className="text-[11.5px] text-muted-3">How it's worked out: signed figures are real signatures by month. The forward view weights every open deal by its stage's chance of signing ({SH_STAGES.filter((s) => s !== 'Signed').map((s) => `${s} ${Math.round(STAGE_P[s] * 100)}%`).join(', ')}) and places it in the month it would typically close.</div>
        </div>
      </main>
    </>
  )
}
