import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Pie } from '../components/icons'
import { useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import type { Showroom } from '../store/types'
import { SHOWROOM_META } from '../lib/solarHouseData'
import { PRESETS, type Range } from '../lib/salesAnalytics'
import { analyseInstalls } from '../lib/installs'

/* Delivery analytics — throughput, speed at every hand-off, DNO turnaround, backlog, crews,
 * quality (snags, reviews) and cash still to collect. */

const BAR = '#0A8F79'
const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]

export function DeliveryAnalytics() {
  const nav = useNavigate()
  const { deals } = useState_()
  const [preset, setPreset] = useState('90')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const range: Range = (PRESETS.find((p) => p.id === preset) ?? PRESETS[3]).range()
  const a = useMemo(() => analyseInstalls(deals, range, showroom), [deals, range.from, range.to, showroom]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <TopBar title="Delivery analytics" crumbs={['Delivery', 'Installs']} identity={{ icon: Pie, accent: '#0A8F79' }}
        tabs={{ items: [{ id: 'all', label: 'All showrooms' }, ...SHOWROOMS.map((s) => ({ id: s, label: SHOWROOM_META[s].name }))], value: showroom, onChange: (v) => setShowroom(v as Showroom | 'all') }} />
      <div className="shrink-0 bg-surface border-b border-border px-7 py-3 flex items-center gap-3">
        <div className="flex items-center gap-1 bg-control rounded-control p-[3px]">
          {PRESETS.map((p) => <button key={p.id} onClick={() => setPreset(p.id)} className={classNames('h-[30px] px-2.5 rounded-[7px] text-[12px] font-semibold', preset === p.id ? 'bg-white text-accent shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b hover:text-ink-3')}>{p.label}</button>)}
        </div>
        <span className="text-[12px] text-muted-2">Installs, DNO and hand-offs counted by the date they happened</span>
      </div>
      <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
        <div className="grid grid-cols-4 xl:grid-cols-8 gap-3">
          <Tile l="Installs completed" v={String(a.kpi.installed)} s={`${a.kpi.kwp} kWp · ${money(a.kpi.value, { compact: true })}`} />
          <Tile l="Signed → installed" v={`${a.kpi.signedToInstall}d`} s="average" />
          <Tile l="Signed → DNO submitted" v={`${a.kpi.signedToDno}d`} s="average" />
          <Tile l="DNO turnaround" v={`${a.kpi.dnoG99}d`} s={`G99 · G98 ${a.kpi.dnoG98}d`} />
          <Tile l="Install → handover" v={`${a.kpi.installToHandover}d`} s="MCS + portal" />
          <Tile l="Backlog" v={String(a.kpi.backlog)} s={`${money(a.kpi.backlogValue, { compact: true })} signed, not installed`} />
          <Tile l="Snag rate" v={`${a.kpi.snagRate}%`} s={`${a.kpi.openSnags} open now`} tone={a.kpi.openSnags ? 'warn' : undefined} />
          <Tile l="To collect" v={money(a.kpi.outstanding, { compact: true })} s={`${money(a.kpi.overdue, { compact: true })} overdue`} tone={a.kpi.overdue ? 'bad' : undefined} />
        </div>

        <div className="grid grid-cols-[1.3fr_1fr] gap-5">
          <Card title="Installs completed by week" sub="Hover for kWp installed">
            <div className="h-[180px] flex items-end gap-[2px] border-b border-border">
              {a.weeks.map((w) => { const max = Math.max(1, ...a.weeks.map((x) => x.n)); return (
                <div key={w.start} className="flex-1 h-full flex flex-col justify-end items-center group" title={`Week of ${new Date(w.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${w.n} installs · ${w.kwp} kWp`}>
                  <span className="text-[10px] font-semibold text-muted-2 opacity-0 group-hover:opacity-100">{w.n}</span>
                  <div className="w-full rounded-t-[4px] group-hover:opacity-80" style={{ height: `${Math.max(1, (w.n / max) * 100)}%`, background: BAR }} />
                </div>
              ) })}
            </div>
          </Card>
          <Card title="Where every job is right now" sub="Live pipeline, not date-filtered">
            <div className="flex flex-col gap-1.5">
              {a.byStage.filter((s) => s.stage !== 'Complete').map((s) => { const max = Math.max(1, ...a.byStage.filter((x) => x.stage !== 'Complete').map((x) => x.n)); return (
                <button key={s.stage} onClick={() => nav('/installs')} className="grid grid-cols-[120px_1fr_32px] items-center gap-2 text-[12.5px] text-left" title={`${s.stage}: ${s.n}`}>
                  <span className="text-ink-3">{s.stage}</span>
                  <span className="h-3 rounded-r bg-[#F1F4F6] overflow-hidden"><span className="block h-full rounded-r" style={{ width: `${(s.n / max) * 100}%`, background: BAR }} /></span>
                  <span className="text-right font-semibold text-ink-2 tabular-nums">{s.n}</span>
                </button>
              ) })}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <Card title="Install teams" sub="Completed in range">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-[10.5px] uppercase tracking-[0.07em] text-muted-3 text-left">{['Team', 'Installs', 'kWp', 'Days', 'Snags'].map((h, i) => <th key={h} className={classNames('font-semibold py-2', i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>{a.teams.map((t) => <tr key={t.team} className="border-t border-divider-row"><td className="py-2 text-ink-2 font-medium">{t.team.replace('Install team ', 'Team ')}</td><td className="text-right tabular-nums">{t.installs}</td><td className="text-right tabular-nums">{t.kwp}</td><td className="text-right tabular-nums">{t.days}</td><td className="text-right tabular-nums">{t.snagRate}%</td></tr>)}</tbody>
            </table>
          </Card>
          <Card title="DNO applications" sub="Approved in range, by route">
            {a.dnoSplit.map((x) => <div key={x.k} className="flex items-center justify-between py-2 border-b border-divider-row last:border-0 text-[12.5px]"><span className="text-ink-3">{x.k}</span><b className="text-ink-2 tabular-nums">{x.n}</b></div>)}
            <div className="text-[12px] text-muted-2 mt-2">G99 averages <b className="text-ink-3">{a.kpi.dnoG99} days</b> to approve vs <b className="text-ink-3">{a.kpi.dnoG98}</b> for G98, so book G99 installs later.</div>
          </Card>
          <Card title="Quality & cash" sub="Right now">
            {[['Open snags', String(a.kpi.openSnags)], ['Installs with a snag', `${a.kpi.snagRate}%`], ['5★ reviews at handover', `${a.kpi.fiveStar}%`], ['Kit on order', money(a.kpi.kitOnOrder, { compact: true })], ['Orders still to place', String(a.kpi.toOrder)], ['Payments overdue', money(a.kpi.overdue, { compact: true })]].map(([k, v]) => <div key={k} className="flex items-center justify-between py-1.5 border-b border-divider-row last:border-0 text-[12.5px]"><span className="text-ink-3">{k}</span><b className="text-ink-2 tabular-nums">{v}</b></div>)}
          </Card>
        </div>

        <Card title="Installing in the next 14 days" sub="Click to open the delivery record">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {a.upcoming.map((d) => {
              const at = d.journey!.steps.find((s) => s.key === 'install')!.at, kit = d.journey!.delivery!.orders.every((o) => o.status === 'delivered')
              return (
                <button key={d.id} onClick={() => nav(`/deals/${d.id}?tab=delivery`)} className="rounded-lg border border-border px-3 py-2 text-left hover:border-input-border flex items-center gap-3">
                  <div className="w-12 text-center shrink-0"><div className="text-[10.5px] font-semibold text-muted-2 uppercase">{new Date(at).toLocaleDateString('en-GB', { weekday: 'short' })}</div><div className="text-[17px] font-bold text-ink leading-none">{new Date(at).getDate()}</div></div>
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-2 truncate">{d.name}</div><div className="text-[11.5px] text-muted-2 truncate">{d.journey!.system?.kwp} kWp · {d.journey!.delivery!.team?.replace('Install team ', 'Team ')}</div></div>
                  <span className={classNames('text-[10.5px] font-semibold rounded px-1.5 py-px', kit ? 'bg-positive-wash text-positive' : 'bg-[#FDF3E3] text-[#B45309]')}>{kit ? 'Kit in' : 'Kit pending'}</span>
                </button>
              )
            })}
            {!a.upcoming.length && <div className="text-[12.5px] text-muted-2">Nothing booked in the next fortnight.</div>}
          </div>
        </Card>
      </main>
    </>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <section className="rounded-card bg-surface border border-border shadow-card p-5"><div className="mb-3"><div className="text-[14px] font-bold text-ink">{title}</div>{sub && <div className="text-[12px] text-muted-2 mt-0.5">{sub}</div>}</div>{children}</section>
}
function Tile({ l, v, s, tone }: { l: string; v: string; s?: string; tone?: 'warn' | 'bad' }) {
  return (
    <div className="rounded-card bg-surface border border-border shadow-card px-3.5 py-3 min-w-0">
      <div className="text-[11.5px] text-muted-b truncate">{l}</div>
      <div className={classNames('text-[21px] font-bold tracking-[-0.02em] mt-0.5 tabular-nums', tone === 'bad' ? 'text-negative' : tone === 'warn' ? 'text-[#B45309]' : 'text-ink')}>{v}</div>
      {s && <div className="text-[11px] text-muted-2 truncate">{s}</div>}
    </div>
  )
}
