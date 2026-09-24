import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Users, Search, Pie, Sliders, ChevronRight, Plus } from '../components/icons'
import { useActions, useState_ } from '../store/store'
import { classNames, money } from '../lib/format'
import type { Showroom } from '../store/types'
import { SHOWROOM_META } from '../lib/solarHouseData'
import { portalRows, relTime, type PortalRow } from '../lib/portalStats'

/* Customer portals — built for hundreds of live portals: segment by where the customer is in their
 * journey, filter by showroom, sort by engagement, and page through a dense table. */

type Seg = 'all' | PortalRow['stage'] | 'dormant' | 'engaged'
const SEGMENTS: { id: Seg; label: string; hint: string }[] = [
  { id: 'all', label: 'All portals', hint: 'Every customer' },
  { id: 'awaiting', label: 'Awaiting first login', hint: 'Invited, never opened' },
  { id: 'pre-install', label: 'Waiting for install', hint: 'Signed, install not yet booked soon' },
  { id: 'installing', label: 'Installing soon', hint: 'Install within 14 days' },
  { id: 'live', label: 'Live systems', hint: 'Installed and generating' },
  { id: 'dormant', label: 'Gone quiet', hint: 'No login in 30+ days' },
  { id: 'engaged', label: 'Most engaged', hint: 'Engagement score 60+' },
]
type Sort = 'recent' | 'engaged' | 'install' | 'name'
const PAGE = 25

export function PortalList() {
  const nav = useNavigate()
  const act = useActions()
  const { portals, portalEvents, deals } = useState_()
  const rows = useMemo(() => portalRows(portals, portalEvents, deals), [portals, portalEvents, deals])
  const [seg, setSeg] = useState<Seg>('all')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [page, setPage] = useState(0)

  const inSeg = (r: PortalRow, s: Seg) => s === 'all' ? true : s === 'dormant' ? r.dormant : s === 'engaged' ? r.score >= 60 : r.stage === s
  const filtered = rows
    .filter((r) => inSeg(r, seg))
    .filter((r) => showroom === 'all' || r.showroom === showroom)
    .filter((r) => !q || `${r.p.customer} ${r.p.address} ${r.p.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'engaged' ? b.score - a.score : sort === 'name' ? a.p.customer.localeCompare(b.p.customer) : sort === 'install' ? (a.p.installDate ?? '9999').localeCompare(b.p.installDate ?? '9999') : (b.lastLogin ?? 0) - (a.lastLogin ?? 0))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const wonNoPortal = deals.filter((d) => d.won && d.journey && !portals.some((p) => p.dealId === d.id))
  const active7 = rows.filter((r) => r.lastLogin && Date.now() - r.lastLogin < 7 * 86_400_000).length

  return (
    <>
      <TopBar title="Customer portals" crumbs={['Customers']} identity={{ icon: Users, accent: '#0E7A66' }}
        actions={<>
          <Button icon={<Pie size={15} />} onClick={() => nav('/customers/analytics')}>Portal analytics</Button>
          <Button icon={<Sliders size={15} />} onClick={() => nav('/customers/builder')}>Portal builder</Button>
        </>} />
      <div className="flex-1 min-h-0 flex">
        {/* segments */}
        <aside className="w-[232px] shrink-0 bg-surface border-r border-border p-3 flex flex-col gap-0.5 overflow-y-auto">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-3 px-2 pb-1.5">Segments</div>
          {SEGMENTS.map((s) => {
            const n = rows.filter((r) => inSeg(r, s.id) && (showroom === 'all' || r.showroom === showroom)).length
            return (
              <button key={s.id} onClick={() => { setSeg(s.id); setPage(0) }} title={s.hint} className={classNames('h-9 px-2.5 rounded-lg flex items-center gap-2 text-[13px] text-left', seg === s.id ? 'bg-accent-wash text-accent font-semibold' : 'text-ink-3 hover:bg-control')}>
                <span className="flex-1 truncate">{s.label}</span><span className={classNames('text-[11px] font-semibold', seg === s.id ? 'text-accent' : 'text-muted-3')}>{n}</span>
              </button>
            )
          })}
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-3 px-2 pt-4 pb-1.5">Showroom</div>
          {(['all', ...Object.keys(SHOWROOM_META)] as (Showroom | 'all')[]).map((s) => (
            <button key={s} onClick={() => { setShowroom(s); setPage(0) }} className={classNames('h-8 px-2.5 rounded-lg flex items-center gap-2 text-[12.5px] text-left', showroom === s ? 'bg-control text-ink font-semibold' : 'text-ink-3 hover:bg-control')}>
              {s !== 'all' && <span className="w-2 h-2 rounded-full" style={{ background: SHOWROOM_META[s].color }} />}{s === 'all' ? 'All showrooms' : SHOWROOM_META[s].name}
            </button>
          ))}
          {wonNoPortal.length > 0 && (
            <div className="mt-4 rounded-xl bg-[#FDF3E3] border border-[#F5D9A8] p-3">
              <div className="text-[12.5px] font-bold text-[#92400E]">{wonNoPortal.length} customers without a portal</div>
              <button onClick={() => { wonNoPortal.forEach((d) => act.createPortal({ dealId: d.id, customer: d.name, email: d.journey!.email, address: d.journey!.address, systemKwp: d.journey!.system?.kwp ?? 0, systemCost: d.value, annualSavings: Math.round(d.value * 0.09), hasBattery: !!d.journey!.system?.batteryKwh })); act.toast(`${wonNoPortal.length} portals created & invites queued`) }} className="mt-2 h-8 px-3 rounded-md bg-[#B45309] text-white text-[12px] font-semibold flex items-center gap-1"><Plus size={12} />Create all</button>
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          <div className="shrink-0 px-5 py-3 border-b border-border bg-surface flex items-center gap-3 flex-wrap">
            <div className="h-9 w-[280px] rounded-control border border-border flex items-center gap-2 px-3"><Search size={14} className="text-muted-3" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search customer, address or email…" className="flex-1 outline-none text-[13px]" /></div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 px-3 rounded-control border border-border text-[13px] text-ink-3 outline-none focus:border-accent">
              <option value="recent">Last login first</option><option value="engaged">Most engaged first</option><option value="install">Install date</option><option value="name">Name A–Z</option>
            </select>
            <div className="ml-auto flex items-center gap-5 text-[12px] text-muted-b">
              <span><b className="text-[14px] text-ink">{rows.length}</b> portals</span>
              <span><b className="text-[14px] text-ink">{rows.filter((r) => r.p.status === 'active').length}</b> activated</span>
              <span><b className="text-[14px] text-ink">{active7}</b> active this week</span>
              <span><b className="text-[14px] text-ink">{rows.filter((r) => r.dormant).length}</b> gone quiet</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="rounded-card bg-surface border border-border shadow-card overflow-hidden">
              <div className="grid gap-3 px-4 h-10 items-center border-b border-divider bg-[#FAFBFC] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-3" style={{ gridTemplateColumns: 'minmax(220px,1.6fr) 100px minmax(200px,1.4fr) 100px 90px 80px 110px 24px' }}>
                <span>Customer</span><span>Showroom</span><span>Journey</span><span>Install</span><span>Last login</span><span>Logins</span><span>Engagement</span><span />
              </div>
              {shown.map((r) => (
                <button key={r.p.id} onClick={() => nav(`/customers/${r.p.id}`)} className="w-full grid gap-3 px-4 py-2.5 items-center border-b border-divider-row text-left text-[12.5px] hover:bg-[#FAFCFB]" style={{ gridTemplateColumns: 'minmax(220px,1.6fr) 100px minmax(200px,1.4fr) 100px 90px 80px 110px 24px' }}>
                  <div className="min-w-0"><div className="font-semibold text-ink-2 truncate">{r.p.customer}</div><div className="text-[11.5px] text-muted-2 truncate">{r.p.systemKwp} kWp{r.p.hasBattery ? ' + battery' : ''} · {money(r.p.systemCost, { compact: true })}</div></div>
                  <span className="flex items-center gap-1.5 text-ink-3">{r.showroom && <span className="w-1.5 h-1.5 rounded-full" style={{ background: SHOWROOM_META[r.showroom].color }} />}{r.showroom ? SHOWROOM_META[r.showroom].name : '—'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="h-1.5 flex-1 max-w-[110px] rounded-full bg-control overflow-hidden"><span className="block h-full bg-accent-500" style={{ width: `${r.progress * 100}%` }} /></span><span className="text-[11px] text-muted-2">{Math.round(r.progress * 9)}/9</span></div>
                    <div className="text-[11.5px] text-ink-3 truncate mt-0.5">{r.stage === 'awaiting' ? <span className="text-[#B45309] font-semibold">Invite not opened</span> : r.currentStep}</div>
                  </div>
                  <span className="text-ink-3">{r.p.installDate ? new Date(r.p.installDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</span>
                  <span className={classNames(r.dormant ? 'text-[#B01B4F] font-semibold' : 'text-ink-3')}>{relTime(r.lastLogin)}</span>
                  <span className="tabular-nums text-ink-3">{r.logins}<span className="text-muted-3"> · {r.logins30} in 30d</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-14 h-1.5 rounded-full bg-control overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${r.score}%`, background: '#0E7A66' }} /></span><span className="tabular-nums font-semibold text-ink-2">{r.score}</span></span>
                  <ChevronRight size={14} className="text-muted-3" />
                </button>
              ))}
              {!shown.length && <div className="p-10 text-center text-[13px] text-muted-2">No portals in this segment.</div>}
            </div>
            <div className="flex items-center justify-between mt-3 text-[12.5px] text-muted-b">
              <span>Showing {filtered.length ? page * PAGE + 1 : 0}–{Math.min(filtered.length, page * PAGE + PAGE)} of {filtered.length}</span>
              <div className="flex items-center gap-1.5">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-8 px-3 rounded-control border border-border disabled:opacity-40 hover:bg-control flex items-center gap-1"><ChevronRight size={13} className="rotate-180" />Prev</button>
                <span className="px-2">Page {page + 1} of {pages}</span>
                <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="h-8 px-3 rounded-control border border-border disabled:opacity-40 hover:bg-control flex items-center gap-1">Next<ChevronRight size={13} /></button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
