import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Pie, Search, Clock, Bars as BarsIcon, Grid, File, Flow, Lock, Sparkle, Person, Users, Check, Robot } from '../components/icons'
import { Panel, StatTile } from '../components/ui'
import { useState_ } from '../store/store'
import { classNames } from '../lib/format'
import type { Showroom, PortalEvent } from '../store/types'
import { SHOWROOM_META } from '../lib/solarHouseData'
import { PRESETS, previous, type Range } from '../lib/salesAnalytics'
import { portalRows, relTime } from '../lib/portalStats'

/* Portal analytics — how customers actually use their portals: logins, what they look at, how long,
 * where they are in their journey, and a per-customer activity timeline. */

const BAR = '#0E7A66'
const DAY = 86_400_000
const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]

export function PortalAnalytics() {
  const nav = useNavigate()
  const { portals, portalEvents, deals } = useState_()
  const [preset, setPreset] = useState('30')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const [who, setWho] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const range: Range = (PRESETS.find((p) => p.id === preset) ?? PRESETS[2]).range()

  const rows = useMemo(() => portalRows(portals, portalEvents, deals), [portals, portalEvents, deals])
  const inShowroom = useMemo(() => new Set(rows.filter((r) => showroom === 'all' || r.showroom === showroom).map((r) => r.p.id)), [rows, showroom])
  const evIn = (r: Range) => portalEvents.filter((e) => inShowroom.has(e.portalId) && e.at >= r.from && e.at <= r.to)
  const ev = useMemo(() => evIn(range), [portalEvents, inShowroom, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const evPrev = useMemo(() => evIn(previous(range)), [portalEvents, inShowroom, range.from, range.to]) // eslint-disable-line react-hooks/exhaustive-deps

  const logins = ev.filter((e) => e.kind === 'login'), loginsPrev = evPrev.filter((e) => e.kind === 'login')
  const views = ev.filter((e) => e.kind !== 'login')
  const uniq = new Set(logins.map((e) => e.portalId)).size, uniqPrev = new Set(loginsPrev.map((e) => e.portalId)).size
  const scoped = rows.filter((r) => inShowroom.has(r.p.id))
  const activation = scoped.length ? Math.round((scoped.filter((r) => r.p.status === 'active').length / scoped.length) * 100) : 0
  const avgSessionMins = logins.length ? Math.round((views.reduce((s, e) => s + (e.dwellMs ?? 0), 0) / 60000 / logins.length) * 10) / 10 : 0

  const bySection = group(views, (e) => e.section)
  const byItem = group(views, (e) => `${e.section} · ${e.label}`).slice(0, 10)
  const byMethod = group(logins, (e) => e.label)
  const weeks: { start: number; n: number; u: number }[] = []
  for (let t = range.from; t < range.to; t += 7 * DAY) { const w = logins.filter((e) => e.at >= t && e.at < t + 7 * DAY); weeks.push({ start: t, n: w.length, u: new Set(w.map((e) => e.portalId)).size }) }

  // Where they are in the journey vs what they look at
  const stageOf = new Map(rows.map((r) => [r.p.id, r.stage]))
  const stageSections = (['pre-install', 'installing', 'live'] as const).map((st) => ({ st, top: group(views.filter((e) => stageOf.get(e.portalId) === st), (e) => e.section).slice(0, 4) }))

  const engaged = [...scoped].sort((a, b) => b.score - a.score).slice(0, 8)
  const quiet = scoped.filter((r) => r.dormant || r.stage === 'awaiting').sort((a, b) => (a.lastLogin ?? 0) - (b.lastLogin ?? 0)).slice(0, 8)
  const matches = who.trim().length < 2 ? [] : scoped.filter((r) => r.p.customer.toLowerCase().includes(who.toLowerCase())).slice(0, 6)
  const person = rows.find((r) => r.p.id === pick)
  const personEvents = person ? portalEvents.filter((e) => e.portalId === person.p.id).sort((a, b) => b.at - a.at) : []

  return (
    <>
      <TopBar title="Portal analytics" crumbs={['Customers', 'Portals']} identity={{ icon: Pie, accent: '#0E7A66' }} />
      <div className="shrink-0 bg-surface border-b border-border px-7 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-[#E9EDF2] border border-[#DDE3EA] rounded-control p-[3px]">
          {PRESETS.map((p) => <button key={p.id} onClick={() => setPreset(p.id)} className={classNames('h-[30px] px-2.5 rounded-[7px] text-[12px] font-semibold', preset === p.id ? 'bg-white text-accent font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-ink-3 hover:text-ink-3')}>{p.label}</button>)}
        </div>
        <select value={showroom} onChange={(e) => setShowroom(e.target.value as Showroom | 'all')} className="h-9 px-3 rounded-control border border-border text-[13px] text-ink-3 outline-none focus:border-accent">
          <option value="all">All showrooms</option>{SHOWROOMS.map((s) => <option key={s} value={s}>{SHOWROOM_META[s].name}</option>)}
        </select>
      </div>
      <main className="flex-1 overflow-y-auto p-7 flex flex-col gap-5">
        <div className="grid grid-cols-3 2xl:grid-cols-6 gap-3">
          <Tile l="Logins" v={logins.length} prev={loginsPrev.length} />
          <Tile l="Customers who logged in" v={uniq} prev={uniqPrev} />
          <Tile l="Activation" v={`${activation}%`} hint="Portals opened at least once" />
          <Tile l="Pages viewed" v={views.length} prev={evPrev.filter((e) => e.kind !== 'login').length} />
          <Tile l="Avg time per visit" v={`${avgSessionMins} min`} />
          <Tile l="Ask Ovi questions" v={views.filter((e) => e.kind === 'chat').length} prev={evPrev.filter((e) => e.kind === 'chat').length} />
        </div>

        <div className="grid grid-cols-[1.2fr_1fr] gap-5">
          <Card title="Logins by week" sub="Bars = logins; label = distinct customers">
            <div className="h-[170px] flex items-end gap-[2px] border-b border-border">
              {weeks.map((w) => { const max = Math.max(1, ...weeks.map((x) => x.n)); return (
                <div key={w.start} className="flex-1 h-full flex flex-col justify-end items-center group" title={`Week of ${new Date(w.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${w.n} logins by ${w.u} customers`}>
                  <span className="text-[10px] text-muted-3 opacity-0 group-hover:opacity-100">{w.u}</span>
                  <div className="w-full rounded-t-[4px] group-hover:opacity-80" style={{ height: `${Math.max(1, (w.n / max) * 100)}%`, background: BAR }} />
                </div>
              ) })}
            </div>
            <div className="text-[10.5px] text-muted-3 mt-1.5">Hover a bar for the week</div>
          </Card>
          <Card title="Most visited sections" sub="Views and average time spent">
            <Bars rows={bySection.map((s) => ({ k: s.k, n: s.n, extra: `${Math.round(s.dwell / Math.max(1, s.n) / 1000)}s avg` }))} />
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <Card title="Top pages & items" sub="The specific things customers open">
            <Bars rows={byItem.map((s) => ({ k: s.k, n: s.n }))} />
          </Card>
          <Card title="What they look at, by journey stage" sub="Top sections for each group">
            <div className="flex flex-col gap-3">
              {stageSections.map(({ st, top }) => (
                <div key={st}><div className="text-[12px] font-bold text-ink-2 mb-1">{{ 'pre-install': 'Waiting for install', installing: 'Installing soon', live: 'Live systems' }[st]}</div>
                  <div className="flex flex-wrap gap-1.5">{top.map((t) => <span key={t.k} className="text-[11.5px] rounded-full bg-control px-2 py-0.5 text-ink-3">{t.k} <b className="text-ink-2">{t.n}</b></span>)}{!top.length && <span className="text-[12px] text-muted-2">No views</span>}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="How they log in" sub="Login method mix">
            <Bars rows={byMethod.map((s) => ({ k: s.k, n: s.n }))} />
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Card title="Most engaged customers" sub="Engagement score, last 30 days">
            <PeopleList rows={engaged} onPick={(id) => setPick(id)} right={(r) => `${r.score}`} />
          </Card>
          <Card title="Gone quiet or never opened" sub="Worth a nudge: resend the invite or call">
            <PeopleList rows={quiet} onPick={(id) => setPick(id)} right={(r) => (r.stage === 'awaiting' ? 'Not opened' : relTime(r.lastLogin))} />
          </Card>
        </div>

        <Card title="Individual customer activity" sub="Pick anyone to see every login and page they viewed">
          <div className="grid grid-cols-[300px_1fr] gap-5">
            <div>
              <div className="h-9 rounded-control border border-border flex items-center gap-2 px-3"><Search size={14} className="text-muted-3" /><input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Search a customer…" className="flex-1 outline-none text-[13px]" /></div>
              <div className="flex flex-col mt-1.5">{matches.map((r) => <button key={r.p.id} onClick={() => setPick(r.p.id)} className={classNames('text-left px-2.5 py-2 rounded-lg text-[13px]', pick === r.p.id ? 'bg-accent-wash text-accent font-semibold' : 'hover:bg-control text-ink-2')}>{r.p.customer}</button>)}</div>
              {person && (
                <div className="mt-3 rounded-xl border border-divider p-3 flex flex-col gap-1.5 text-[12.5px]">
                  <div className="font-bold text-ink">{person.p.customer}</div>
                  <KV k="Journey" v={person.stageLabel} /><KV k="Logins" v={`${person.logins} (${person.logins30} in 30d)`} /><KV k="Pages viewed" v={String(person.views)} /><KV k="Time in portal" v={`${person.minutes} min`} /><KV k="Last login" v={relTime(person.lastLogin)} />
                  <button onClick={() => nav(`/customers/${person.p.id}`)} className="mt-1 text-[12px] font-semibold text-accent text-left">Open their portal →</button>
                </div>
              )}
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {!person && <div className="h-full flex items-center justify-center text-[13px] text-muted-2 py-10">Choose a customer on the left, or click one in the lists above.</div>}
              {person && personEvents.map((e) => <EventLine key={e.id} e={e} />)}
              {person && !personEvents.length && <div className="text-[13px] text-muted-2 py-6">They haven’t opened their portal yet.</div>}
            </div>
          </div>
        </Card>
      </main>
    </>
  )
}

function group(ev: PortalEvent[], key: (e: PortalEvent) => string) {
  const m = new Map<string, { n: number; dwell: number }>()
  ev.forEach((e) => { const k = key(e); const x = m.get(k) ?? { n: 0, dwell: 0 }; x.n++; x.dwell += e.dwellMs ?? 0; m.set(k, x) })
  return [...m.entries()].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n)
}
type IconT = (p: { size?: number; className?: string }) => JSX.Element
const PANEL_ICON: Record<string, IconT> = {
  'Logins by week': BarsIcon, 'Most visited sections': Grid, 'Top pages & items': File, 'What they look at, by journey stage': Flow, 'How they log in': Lock,
  'Most engaged customers': Sparkle, 'Gone quiet or never opened': Clock, 'Individual customer activity': Person,
}
const TILE_ICON: Record<string, IconT> = { Logins: Lock, 'Customers who logged in': Users, Activation: Check, 'Pages viewed': Grid, 'Avg time per visit': Clock, 'Ask Ovi questions': Robot }
function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <Panel title={title} sub={sub} icon={PANEL_ICON[title]}>{children}</Panel>
}
function Tile({ l, v, prev, hint }: { l: string; v: number | string; prev?: number; hint?: string }) {
  const n = typeof v === 'number' ? v : 0
  const d = prev != null && prev > 0 ? Math.round(((n - prev) / prev) * 100) : null
  return <StatTile label={l} value={typeof v === 'number' ? v.toLocaleString() : v} icon={TILE_ICON[l]} hint={hint}
    delta={d != null && d !== 0 ? `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}%` : undefined} deltaGood={d != null && d !== 0 ? d > 0 : undefined} sub={d != null ? 'vs previous period' : hint} />
}
function Bars({ rows }: { rows: { k: string; n: number; extra?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.k} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-2 text-[12.5px]" title={`${r.k}: ${r.n}${r.extra ? ` · ${r.extra}` : ''}`}>
          <span className="truncate text-ink-3">{r.k}</span>
          <span className="h-2.5 rounded-r bg-[#F1F4F6] overflow-hidden"><span className="block h-full rounded-r" style={{ width: `${(r.n / max) * 100}%`, background: BAR }} /></span>
          <span className="tabular-nums font-semibold text-ink-2 text-right">{r.n}{r.extra && <span className="font-normal text-muted-3 ml-1.5">{r.extra}</span>}</span>
        </div>
      ))}
      {!rows.length && <div className="text-[12.5px] text-muted-2">No activity in this range.</div>}
    </div>
  )
}
function PeopleList({ rows, onPick, right }: { rows: ReturnType<typeof portalRows>; onPick: (id: string) => void; right: (r: ReturnType<typeof portalRows>[number]) => string }) {
  return (
    <div className="flex flex-col">
      {rows.map((r) => (
        <button key={r.p.id} onClick={() => onPick(r.p.id)} className="flex items-center gap-3 py-2 border-b border-divider-row last:border-0 text-left hover:bg-surface-tint -mx-2 px-2 rounded-lg">
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-ink-2 truncate">{r.p.customer}</span><span className="block text-[11.5px] text-muted-2 truncate">{r.stageLabel} · {r.logins} logins</span></span>
          <span className="text-[12px] font-semibold text-ink-3">{right(r)}</span>
        </button>
      ))}
    </div>
  )
}
function KV({ k, v }: { k: string; v: string }) { return <div className="flex justify-between gap-2"><span className="text-muted-2">{k}</span><span className="text-ink-2 font-medium">{v}</span></div> }
function EventLine({ e }: { e: PortalEvent }) {
  const login = e.kind === 'login'
  return (
    <div className={classNames('flex items-center gap-3 py-1.5 text-[12.5px] border-b border-divider-row', login && 'bg-[#F6F8FA] font-semibold')}>
      <Clock size={12} className="text-muted-3 shrink-0" />
      <span className="w-[120px] shrink-0 text-muted-2">{new Date(e.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="text-ink-2 flex-1 truncate">{login ? `Logged in · ${e.label}` : `${e.section} → ${e.label}`}</span>
      {e.dwellMs ? <span className="text-muted-3">{Math.round(e.dwellMs / 1000)}s</span> : null}
    </div>
  )
}
