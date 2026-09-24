import { useMemo, useState, type ReactNode } from 'react'
import { TopBar } from '../components/TopBar'
import { Pie, Lock, ChevronDown } from '../components/icons'
import { useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import type { Showroom } from '../store/types'
import { SHOWROOM_META, SHOWROOM_MANAGER } from '../lib/solarHouseData'
import { analyse, PRESETS, previous, type Range, type Breakdown, type Analysis } from '../lib/salesAnalytics'

/* Showroom analytics — each showroom manager sees only their own showroom; the managing director
 * sees every showroom plus a side-by-side comparison. Everything responds to the date range. */

const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]
const INK_BAR = '#0E7A66' // single-series magnitude: one hue
type Viewer = 'md' | Showroom
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export function ShowroomAnalytics() {
  const { deals, showroom: sessions } = useState_()
  const [viewer, setViewer] = useState<Viewer>('md')
  const [tab, setTab] = useState<Showroom | 'all'>('all')
  const [preset, setPreset] = useState('90')
  const [custom, setCustom] = useState<Range | null>(null)
  const range: Range = custom ?? (PRESETS.find((p) => p.id === preset) ?? PRESETS[3]).range()
  const scope: Showroom | 'all' = viewer === 'md' ? tab : viewer

  const a = useMemo(() => analyse(deals, sessions, range, scope), [deals, sessions, range.from, range.to, scope]) // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => analyse(deals, sessions, previous(range), scope), [deals, sessions, range.from, range.to, scope]) // eslint-disable-line react-hooks/exhaustive-deps
  // Only compare when the previous window is fully covered by data — otherwise the deltas lie.
  const dataStart = useMemo(() => Math.min(...deals.filter((d) => d.journey).map((d) => d.journey!.steps[0].at)), [deals])
  const canCompare = previous(range).from >= dataStart
  const perShowroom = useMemo(() => SHOWROOMS.map((s) => ({ s, a: analyse(deals, sessions, range, s) })), [deals, sessions, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <TopBar title="Showroom analytics" crumbs={['Customers', 'Showroom']} identity={{ icon: Pie, accent: '#0E7A66' }}
        tabs={viewer === 'md' ? { items: [{ id: 'all', label: 'All showrooms' }, ...SHOWROOMS.map((s) => ({ id: s, label: SHOWROOM_META[s].name }))], value: tab, onChange: (v) => setTab(v as Showroom | 'all') } : undefined} />

      {/* filters — one row above everything */}
      <div className="shrink-0 bg-surface border-b border-border px-7 py-3 flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-[12.5px] text-muted-b">Viewing as
          <select value={viewer} onChange={(e) => setViewer(e.target.value as Viewer)} className="h-9 px-3 rounded-control border border-border bg-surface text-[13px] font-semibold text-ink-2 outline-none focus:border-accent">
            <option value="md">Managing director (all showrooms)</option>
            {SHOWROOMS.map((s) => <option key={s} value={s}>{SHOWROOM_MANAGER[s]} · {SHOWROOM_META[s].name} manager</option>)}
          </select>
        </label>
        {viewer !== 'md' && <span className="h-8 px-2.5 rounded-full bg-control text-[12px] font-semibold text-ink-3 flex items-center gap-1.5"><Lock size={12} />Only {SHOWROOM_META[viewer].name} data is visible</span>}
        <div className="ml-auto flex items-center gap-1 bg-control rounded-control p-[3px]">
          {PRESETS.map((p) => <button key={p.id} onClick={() => { setPreset(p.id); setCustom(null) }} className={classNames('h-[30px] px-2.5 rounded-[7px] text-[12px] font-semibold', !custom && preset === p.id ? 'bg-white text-accent shadow-[0_1px_2px_rgba(11,18,32,0.08)]' : 'text-muted-b hover:text-ink-3')}>{p.label}</button>)}
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-muted-b">
          <input type="date" value={iso(range.from)} onChange={(e) => setCustom({ from: new Date(e.target.value).getTime(), to: range.to })} className="h-9 px-2 rounded-control border border-border bg-surface text-[12.5px] text-ink-2 outline-none focus:border-accent" />
          to
          <input type="date" value={iso(range.to)} onChange={(e) => setCustom({ from: range.from, to: new Date(e.target.value).getTime() + 86_399_999 })} className="h-9 px-2 rounded-control border border-border bg-surface text-[12.5px] text-ink-2 outline-none focus:border-accent" />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
        {/* headline */}
        <div className="grid grid-cols-4 xl:grid-cols-8 gap-3">
          <Kpi cmp={canCompare} l="Revenue signed" v={money(a.kpi.revenue, { compact: true })} cur={a.kpi.revenue} prev={prev.kpi.revenue} />
          <Kpi cmp={canCompare} l="Systems signed" v={String(a.kpi.signed)} cur={a.kpi.signed} prev={prev.kpi.signed} />
          <Kpi cmp={canCompare} l="Proposal acceptance" v={`${a.kpi.acceptance}%`} cur={a.kpi.acceptance} prev={prev.kpi.acceptance} pts hint="Of proposals sent in range, signed" />
          <Kpi cmp={canCompare} l="Consultation close rate" v={`${a.kpi.closeRate}%`} cur={a.kpi.closeRate} prev={prev.kpi.closeRate} pts hint="Of consultations held, signed" />
          <Kpi cmp={canCompare} l="Average order value" v={money(a.kpi.aov, { compact: true })} cur={a.kpi.aov} prev={prev.kpi.aov} />
          <Kpi cmp={canCompare} l="Battery attach" v={`${a.kpi.batteryAttach}%`} cur={a.kpi.batteryAttach} prev={prev.kpi.batteryAttach} pts />
          <Kpi cmp={canCompare} l="Proposal → signed" v={`${a.kpi.daysPropToSign}d`} cur={a.kpi.daysPropToSign} prev={prev.kpi.daysPropToSign} lowerBetter />
          <Kpi cmp={canCompare} l="Showroom no-shows" v={`${a.kpi.noShowRate}%`} cur={a.kpi.noShowRate} prev={prev.kpi.noShowRate} pts lowerBetter hint={`${a.kpi.visitsHeld} visits held`} />
        </div>

        <div className="grid grid-cols-[1.1fr_1fr] gap-5">
          <Card title="Funnel" sub="Stage reached within the range, and the step-to-step conversion">
            <Funnel a={a} />
          </Card>
          <Card title="Signed revenue by week" sub="Hover a bar for the week's detail">
            <Weekly a={a} />
          </Card>
        </div>

        {scope === 'all' && viewer === 'md' && (
          <Card title="Showrooms side by side" sub="Same range, same definitions">
            <Compare rows={perShowroom} />
          </Card>
        )}

        <div className="grid grid-cols-2 gap-5">
          <Card title="Panels: proposed vs accepted" sub="Which panels are in the proposals, and which ones customers sign">
            <ProductTable rows={a.products.panels} />
          </Card>
          <Card title="Inverters & hybrid systems" sub="By model: acceptance and share of what's sold">
            <ProductTable rows={a.products.inverters} />
          </Card>
          <Card title="Batteries" sub="Model mix and attach">
            <ProductTable rows={a.products.batteries} />
          </Card>
          <Card title="Battery size" sub="Does bigger storage sell or stall?">
            <ProductTable rows={a.products.batterySize} />
          </Card>
          <Card title="System size" sub="kWp bands">
            <ProductTable rows={a.products.systemSize} />
          </Card>
          <Card title="Finance" sub="How customers pay, and how it affects acceptance">
            <ProductTable rows={a.products.finance} />
          </Card>
        </div>

        <Card title="Advisers" sub="Ranked by revenue signed in the range">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-[10.5px] uppercase tracking-[0.07em] text-muted-3 text-left">{['Adviser', 'Consultations', 'Proposals', 'Signed', 'Acceptance', 'Close rate', 'Revenue', 'Avg order', 'Battery attach'].map((h, i) => <th key={h} className={classNames('font-semibold py-2 px-2', i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {a.advisers.map((r) => (
                  <tr key={r.name} className="border-t border-divider-row">
                    <td className="py-2.5 px-2 font-semibold text-ink-2">{r.name}</td>
                    <td className="text-right px-2 tabular-nums">{r.consults}</td><td className="text-right px-2 tabular-nums">{r.proposals}</td><td className="text-right px-2 tabular-nums font-semibold">{r.signed}</td>
                    <td className="text-right px-2"><RateCell v={r.acceptance} /></td><td className="text-right px-2"><RateCell v={r.closeRate} /></td>
                    <td className="text-right px-2 font-semibold text-ink-2 tabular-nums">{money(r.revenue, { compact: true })}</td><td className="text-right px-2 tabular-nums">{money(r.aov, { compact: true })}</td><td className="text-right px-2 tabular-nums">{r.batteryAttach}%</td>
                  </tr>
                ))}
                {!a.advisers.length && <tr><td colSpan={9} className="py-6 text-center text-muted-2">No activity in this range.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-[1.3fr_1fr] gap-5">
          <Card title="Lead sources" sub="Enquiries in range and how many went on to sign">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-[10.5px] uppercase tracking-[0.07em] text-muted-3 text-left">{['Source', 'Enquiries', 'Signed', 'Conversion', 'Revenue'].map((h, i) => <th key={h} className={classNames('font-semibold py-2 px-2', i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>{a.sources.map((s) => <tr key={s.source} className="border-t border-divider-row"><td className="py-2 px-2 text-ink-2 font-medium">{s.source}</td><td className="text-right px-2 tabular-nums">{s.enquiries}</td><td className="text-right px-2 tabular-nums">{s.signed}</td><td className="text-right px-2"><RateCell v={s.conversion} /></td><td className="text-right px-2 tabular-nums">{money(s.revenue, { compact: true })}</td></tr>)}</tbody>
            </table>
          </Card>
          <Card title="Why deals were lost" sub="Deals closed as lost in the range">
            <div className="flex flex-col gap-2">
              {a.lost.map((l) => { const max = a.lost[0]?.n || 1; return (
                <div key={l.reason} className="grid grid-cols-[150px_1fr_28px] items-center gap-2 text-[12.5px]" title={`${l.reason}: ${l.n}`}>
                  <span className="text-ink-3 truncate">{l.reason}</span>
                  <span className="h-2.5 rounded-r bg-control overflow-hidden"><span className="block h-full rounded-r" style={{ width: `${(l.n / max) * 100}%`, background: '#98A1B0' }} /></span>
                  <span className="text-right font-semibold text-ink-2 tabular-nums">{l.n}</span>
                </div>
              ) })}
              {!a.lost.length && <div className="text-[12.5px] text-muted-2">No lost deals in this range.</div>}
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <section className="rounded-card bg-surface border border-border shadow-card p-5"><div className="mb-3"><div className="text-[14px] font-bold text-ink">{title}</div>{sub && <div className="text-[12px] text-muted-2 mt-0.5">{sub}</div>}</div>{children}</section>
}

function Kpi({ l, v, cur, prev, pts, lowerBetter, hint, cmp = true }: { l: string; v: string; cur: number; prev: number; pts?: boolean; lowerBetter?: boolean; hint?: string; cmp?: boolean }) {
  const diff = pts ? Math.round((cur - prev) * 10) / 10 : prev ? Math.round(((cur - prev) / prev) * 100) : 0
  const good = lowerBetter ? diff < 0 : diff > 0
  const flat = diff === 0 || (!prev && !pts)
  return (
    <div className="rounded-card bg-surface border border-border shadow-card px-3.5 py-3 min-w-0" title={hint}>
      <div className="text-[11.5px] text-muted-b truncate">{l}</div>
      <div className="text-[21px] font-bold text-ink tracking-[-0.02em] mt-0.5 tabular-nums">{v}</div>
      <div className={classNames('text-[11px] font-semibold mt-0.5', flat ? 'text-muted-3' : good ? 'text-positive' : 'text-negative')}>
        {!cmp ? <span className="font-normal text-muted-3">No earlier data to compare</span> : flat ? 'No change' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}${pts ? ' pts' : '%'}`} {cmp && <span className="font-normal text-muted-3">vs prev.</span>}
      </div>
    </div>
  )
}

function RateCell({ v }: { v: number }) {
  return <span className="inline-flex items-center gap-1.5 justify-end"><span className="w-12 h-1.5 rounded-full bg-control overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, v)}%`, background: INK_BAR }} /></span><span className="tabular-nums font-semibold text-ink-2 w-10 text-right">{v}%</span></span>
}

function Funnel({ a }: { a: Analysis }) {
  const max = Math.max(1, ...a.funnel.map((f) => f.n))
  return (
    <div className="flex flex-col gap-2">
      {a.funnel.map((f, i) => {
        const prev = a.funnel[i - 1]
        const conv = prev && prev.n ? Math.round((f.n / prev.n) * 100) : null
        return (
          <div key={f.label} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 text-[12.5px]">
            <span className="text-ink-3 font-medium">{f.label}</span>
            <span className="h-6 rounded-r-md bg-[#F1F4F6] overflow-hidden"><span className="h-full rounded-r-md flex items-center justify-end pr-2 text-[11px] font-bold text-white" style={{ width: `${Math.max(6, (f.n / max) * 100)}%`, background: INK_BAR, opacity: 1 - i * 0.09 }}>{f.n}</span></span>
            <span className="text-right text-[11.5px] text-muted-2">{conv != null ? `${conv}% →` : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

function Weekly({ a }: { a: Analysis }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...a.weeks.map((w) => w.revenue))
  const h = hover != null ? a.weeks[hover] : null
  return (
    <div className="relative">
      <div className="h-[188px] flex items-end gap-[2px] border-b border-border">
        {a.weeks.map((w, i) => (
          <div key={w.start} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="flex-1 h-full flex items-end cursor-default">
            <div className="w-full rounded-t-[4px] transition-opacity" style={{ height: `${Math.max(1, (w.revenue / max) * 100)}%`, background: INK_BAR, opacity: hover == null || hover === i ? 1 : 0.45 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10.5px] text-muted-3 mt-1.5"><span>{new Date(a.weeks[0]?.start ?? Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><span>{money(max, { compact: true })} peak week</span><span>This week</span></div>
      {h && (
        <div className="absolute top-0 right-0 rounded-lg bg-ink text-white text-[12px] px-3 py-2 shadow-lift pointer-events-none">
          <div className="font-semibold">Week of {new Date(h.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
          <div className="text-white/80">{money(h.revenue)} signed · {h.signed} systems · {h.proposals} proposals sent</div>
        </div>
      )}
    </div>
  )
}

function ProductTable({ rows }: { rows: Breakdown[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 6)
  return (
    <div>
      <table className="w-full text-[12.5px]">
        <thead><tr className="text-[10.5px] uppercase tracking-[0.07em] text-muted-3 text-left">{['Product', 'Proposed', 'Signed', 'Acceptance', 'Share of sales', 'Revenue'].map((h, i) => <th key={h} className={classNames('font-semibold py-2 px-1.5', i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key} className="border-t border-divider-row">
              <td className="py-2 px-1.5 text-ink-2 font-medium truncate max-w-[180px]" title={r.key}>{r.key}</td>
              <td className="text-right px-1.5 tabular-nums">{r.proposed}</td>
              <td className="text-right px-1.5 tabular-nums font-semibold">{r.signed}</td>
              <td className="text-right px-1.5"><RateCell v={r.acceptance} /></td>
              <td className="text-right px-1.5 tabular-nums">{r.share}%</td>
              <td className="text-right px-1.5 tabular-nums">{money(r.revenue, { compact: true })}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-muted-2">No proposals in this range.</td></tr>}
        </tbody>
      </table>
      {rows.length > 6 && <button onClick={() => setAll((x) => !x)} className="mt-2 text-[12px] font-semibold text-accent flex items-center gap-1"><ChevronDown size={12} className={all ? 'rotate-180' : ''} />{all ? 'Show fewer' : `Show all ${rows.length}`}</button>}
    </div>
  )
}

function Compare({ rows }: { rows: { s: Showroom; a: Analysis }[] }) {
  const metrics: { l: string; get: (a: Analysis) => number; fmt: (n: number) => string }[] = [
    { l: 'Revenue signed', get: (a) => a.kpi.revenue, fmt: (n) => money(n, { compact: true }) },
    { l: 'Systems signed', get: (a) => a.kpi.signed, fmt: String },
    { l: 'Proposal acceptance', get: (a) => a.kpi.acceptance, fmt: (n) => `${n}%` },
    { l: 'Consultation close rate', get: (a) => a.kpi.closeRate, fmt: (n) => `${n}%` },
    { l: 'Average order value', get: (a) => a.kpi.aov, fmt: (n) => money(n, { compact: true }) },
    { l: 'Battery attach', get: (a) => a.kpi.batteryAttach, fmt: (n) => `${n}%` },
  ]
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-[12px] text-ink-3">{rows.map(({ s }) => <span key={s} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SHOWROOM_META[s].color }} />{SHOWROOM_META[s].name} · {SHOWROOM_MANAGER[s]}</span>)}</div>
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m) => {
          const max = Math.max(1, ...rows.map((r) => m.get(r.a)))
          return (
            <div key={m.l}>
              <div className="text-[11.5px] text-muted-b mb-2">{m.l}</div>
              <div className="flex flex-col gap-1.5">
                {rows.map(({ s, a }) => (
                  <div key={s} className="grid grid-cols-[1fr_58px] items-center gap-2" title={`${SHOWROOM_META[s].name}: ${m.fmt(m.get(a))}`}>
                    <span className="h-3 rounded-r bg-[#F1F4F6] overflow-hidden"><span className="block h-full rounded-r" style={{ width: `${(m.get(a) / max) * 100}%`, background: SHOWROOM_META[s].color }} /></span>
                    <span className="text-[12px] font-semibold text-ink-2 tabular-nums text-right">{m.fmt(m.get(a))}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
