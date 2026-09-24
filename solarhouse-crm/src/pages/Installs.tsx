import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Button } from '../components/ui'
import { Wrench, Bars, Grid, Search, Pie, Clock, ChevronDown } from '../components/icons'
import { useState_ } from '../store/store'
import { money, classNames } from '../lib/format'
import type { Deal, Showroom } from '../store/types'
import { SHOWROOM_META } from '../lib/solarHouseData'
import { INSTALL_STAGES, INSTALL_STAGE_HELP, installStage, signedAt, installAt, daysSince, outstanding, type InstallStage } from '../lib/installs'

/* Installs — every signed customer from contract to handover, in one pipeline. This replaces the
 * old Delivery / Installs / Field jobs / Jobs / Projects pages: a signed deal IS the install job,
 * and clicking it opens the same customer record on its Delivery tab. */

const SHOWROOMS = Object.keys(SHOWROOM_META) as Showroom[]
// Distinct stage colours (same validated set as Sales), always paired with the stage name.
const SHADES = ['#16A34A', '#D97706', '#DB2777', '#7C3AED', '#0284C7', '#0891B2', '#64748B']

export function Installs() {
  const nav = useNavigate()
  const { deals } = useState_()
  const [view, setView] = useState<'board' | 'table'>('board')
  const [showroom, setShowroom] = useState<Showroom | 'all'>('all')
  const [q, setQ] = useState('')
  const [issues, setIssues] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const open = (d: Deal) => nav(`/deals/${d.id}?tab=delivery`)

  const all = useMemo(() => deals.filter((d) => d.won && d.journey?.delivery), [deals])
  const hasIssue = (d: Deal) => d.journey!.delivery!.snags.some((s) => s.status === 'open') || d.journey!.delivery!.payments.some((p) => p.status === 'overdue') || d.journey!.delivery!.orders.some((o) => o.status === 'to-order' && installStage(d) === 'Install booked')
  const list = all.filter((d) => (showroom === 'all' || d.journey!.showroom === showroom) && (!q || `${d.name} ${d.org} ${d.journey!.postcode}`.toLowerCase().includes(q.toLowerCase())) && (!issues || hasIssue(d)))
  const stages = INSTALL_STAGES.filter((s) => showDone || s !== 'Complete')
  const by = (s: InstallStage) => list.filter((d) => installStage(d) === s).sort((a, b) => (installAt(a) ?? signedAt(a)) - (installAt(b) ?? signedAt(b)))
  const thisWeek = list.filter((d) => { const a = installAt(d); return a && a >= Date.now() - 86_400_000 && a < Date.now() + 7 * 86_400_000 }).length

  return (
    <>
      <TopBar title="Installs" crumbs={['Delivery']} identity={{ icon: Wrench, accent: '#0A8F79' }}
        actions={<Button icon={<Pie size={15} />} onClick={() => nav('/installs/analytics')}>Delivery analytics</Button>} />
      <div className="sh-toolbar shrink-0 px-7 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', ...SHOWROOMS] as (Showroom | 'all')[]).map((s) => {
            const n = all.filter((d) => (s === 'all' || d.journey!.showroom === s) && installStage(d) !== 'Complete').length
            return <button key={s} onClick={() => setShowroom(s)} className={classNames('h-9 pl-3 pr-2 rounded-full border flex items-center gap-2 text-[13px] font-semibold', showroom === s ? 'chip-on' : 'bg-surface border-border text-ink-3 hover:border-input-border')}>
              {s !== 'all' && <span className="w-2 h-2 rounded-full" style={{ background: SHOWROOM_META[s].color }} />}{s === 'all' ? 'All showrooms' : SHOWROOM_META[s].name}<span className={classNames('text-[11px] rounded-full px-1.5 font-bold', showroom === s ? 'chip-on-count' : 'bg-control text-muted-b')}>{n}</span></button>
          })}
          <div className="ml-auto inline-flex bg-[#E9EDF2] border border-[#DDE3EA] rounded-control p-[3px] gap-0.5">
            {([['board', Bars, 'Board'], ['table', Grid, 'Table']] as const).map(([id, I, l]) => <button key={id} onClick={() => setView(id)} className={classNames('h-[30px] px-3 rounded-[7px] flex items-center gap-1.5 text-[12.5px] font-semibold', view === id ? 'bg-white text-accent font-bold shadow-[0_1px_3px_rgba(11,18,32,0.14)]' : 'text-ink-3')}><I size={14} />{l}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-9 w-[250px] rounded-control border border-border flex items-center gap-2 px-3"><Search size={15} className="text-muted-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, street or postcode…" className="flex-1 outline-none text-[13px]" /></div>
          <button onClick={() => setIssues((x) => !x)} className={classNames('h-9 px-3 rounded-control border text-[12.5px] font-semibold flex items-center gap-1.5', issues ? 'bg-[#B01B4F] text-white border-[#B01B4F]' : 'border-border text-ink-3 hover:bg-control')}><Clock size={13} />Has an issue</button>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-3 ml-1"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: '#0E7A66' }} />Show completed</label>
          <div className="ml-auto flex items-center gap-5 text-[12px] text-muted-b">
            <span><b className="text-[14px] text-ink">{list.filter((d) => installStage(d) !== 'Complete').length}</b> in delivery</span>
            <span><b className="text-[14px] text-ink">{thisWeek}</b> installing this week</span>
            <span><b className="text-[14px] text-ink">{by('Ready to book').length}</b> ready to book</span>
            <span><b className="text-[14px] text-ink">{money(list.reduce((s, d) => s + outstanding(d), 0), { compact: true })}</b> to collect</span>
          </div>
        </div>
      </div>

      {view === 'board' ? (
        <main className="flex-1 min-h-0 overflow-x-auto p-5">
          <div className="grid gap-3 h-full" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(228px, 1fr))` }}>
            {stages.map((s, i) => { const col = by(s); return (
              <div key={s} className="flex flex-col min-h-0 rounded-xl border border-[#E1E6EC] overflow-hidden" style={{ background: `color-mix(in srgb, ${SHADES[i]} 5%, #F3F5F8)` }}>
                <div className="px-3 pb-2.5 bg-white border-b border-[#E6EAF0]" title={INSTALL_STAGE_HELP[s]}>
                  <div className="h-[4px] -mx-3 mb-2.5" style={{ background: SHADES[i] }} />
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md text-[10.5px] font-extrabold text-white flex items-center justify-center shrink-0" style={{ background: SHADES[i] }}>{i + 1}</span>
                    <span className="text-[13.5px] font-extrabold text-ink truncate">{s}</span>
                    <span className="text-[11px] font-bold rounded-full px-1.5 min-w-[22px] text-center" style={{ color: SHADES[i], background: `color-mix(in srgb, ${SHADES[i]} 12%, white)` }}>{col.length}</span>
                  </div>
                  <div className="text-[11px] text-muted-b mt-1 truncate">{INSTALL_STAGE_HELP[s]}</div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
                  {col.slice(0, 40).map((d) => <Card key={d.id} d={d} onOpen={() => open(d)} flag={hasIssue(d)} />)}
                  {col.length > 40 && <button onClick={() => { setView('table') }} className="h-8 rounded-lg border border-dashed border-input-border text-[12px] font-semibold text-muted-b">See all {col.length} in the table</button>}
                  {!col.length && <div className="text-[12px] text-muted-3 text-center py-6">Nothing here</div>}
                </div>
              </div>
            ) })}
          </div>
        </main>
      ) : (
        <InstallTable list={list} onOpen={open} hasIssue={hasIssue} />
      )}
    </>
  )
}

function Card({ d, onOpen, flag }: { d: Deal; onOpen: () => void; flag: boolean }) {
  const st = installStage(d), del = d.journey!.delivery!
  const at = installAt(d)
  const sr = SHOWROOM_META[d.journey!.showroom]
  const info = st === 'Install booked' || st === 'On site' ? `${at! > Date.now() ? 'Install' : 'Started'} ${new Date(at!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
    : st === 'Handover' ? `Installed ${daysSince(d.journey!.steps.find((s) => s.key === 'install')!.done!)}d ago`
      : `Signed ${daysSince(signedAt(d))}d ago`
  const kit = del.orders.every((o) => o.status === 'delivered') ? 'Kit in' : del.orders.some((o) => o.status === 'ordered') ? 'Kit ordered' : 'Kit to order'
  return (
    <button onClick={onOpen} className="bg-white rounded-lg border border-[#E1E6EC] border-l-[3px] pl-2.5 pr-3 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_12px_-4px_rgba(16,24,40,0.16)] hover:-translate-y-px transition-all" style={{ borderLeftColor: flag ? '#DC2626' : kit === 'Kit to order' && (st === 'Install booked' || st === 'Ready to book') ? '#F59E0B' : '#34D399' }}>
      <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sr.color }} /><span className="text-[13px] font-semibold text-ink-2 truncate flex-1">{d.name}</span>{flag && <span className="w-2 h-2 rounded-full bg-negative shrink-0" title="Has an issue" />}</div>
      <div className="text-[11.5px] text-muted-2 mt-0.5 truncate">{d.journey!.system?.kwp} kWp{d.journey!.system?.batteryKwh ? ` + ${d.journey!.system.batteryKwh} kWh` : ''} · {d.org.split(',').slice(-1)[0]}</div>
      <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
        <span className="text-ink-3 font-medium flex-1 truncate">{info}</span>
        <span className={classNames('rounded px-1.5 py-px font-semibold', kit === 'Kit in' ? 'bg-positive-wash text-positive' : kit === 'Kit ordered' ? 'bg-[#E7F0FA] text-[#0A64AD]' : 'bg-[#FDF3E3] text-[#B45309]')}>{kit}</span>
      </div>
    </button>
  )
}

function InstallTable({ list, onOpen, hasIssue }: { list: Deal[]; onOpen: (d: Deal) => void; hasIssue: (d: Deal) => boolean }) {
  const [sortBy, setSortBy] = useState<'install' | 'signed' | 'stage' | 'value' | 'owed'>('install')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ Complete: true })
  const T = 'minmax(210px,1.6fr) 100px 130px 110px 120px 110px 110px 100px 90px'
  const sorted = [...list].sort((a, b) => sortBy === 'signed' ? signedAt(b) - signedAt(a) : sortBy === 'value' ? b.value - a.value : sortBy === 'owed' ? outstanding(b) - outstanding(a) : (installAt(a) ?? Infinity) - (installAt(b) ?? Infinity))
  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-5">
      <div className="flex items-center gap-2 mb-3 text-[12.5px] text-muted-b">Sort
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="h-8 px-2 rounded-control border border-border bg-surface text-[12.5px] text-ink-3 outline-none">
          <option value="install">Install date</option><option value="signed">Newest signed</option><option value="value">Value</option><option value="owed">Most to collect</option>
        </select>
      </div>
      <div className="rounded-card bg-surface border border-border shadow-card overflow-hidden">
        <div className="grid gap-3 px-4 h-10 items-center border-b border-divider bg-[#FAFBFC] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-3" style={{ gridTemplateColumns: T }}>
          <span>Customer</span><span>Showroom</span><span>System</span><span>Signed</span><span>Install</span><span>DNO</span><span>Kit</span><span>To collect</span><span>Team</span>
        </div>
        {INSTALL_STAGES.map((s) => { const rows = sorted.filter((d) => installStage(d) === s); if (!rows.length) return null; return (
          <div key={s}>
            <button onClick={() => setCollapsed((c) => ({ ...c, [s]: !c[s] }))} className="w-full h-9 px-4 flex items-center gap-2 bg-[#F6F8FA] border-b border-divider-row text-[12.5px] font-bold text-ink-2">
              <ChevronDown size={13} className={classNames('text-muted-3 transition-transform', collapsed[s] && '-rotate-90')} />{s}<span className="text-muted-2 font-semibold">{rows.length}</span><span className="text-muted-3 font-normal text-[11.5px]">· {INSTALL_STAGE_HELP[s]}</span>
            </button>
            {!collapsed[s] && rows.map((d) => {
              const del = d.journey!.delivery!, dno = d.journey!.steps.find((x) => x.key === 'dno'), ins = installAt(d), owed = outstanding(d)
              const kit = del.orders.every((o) => o.status === 'delivered') ? 'All delivered' : del.orders.some((o) => o.status === 'ordered') ? 'On order' : 'To order'
              return (
                <button key={d.id} onClick={() => onOpen(d)} className="w-full grid gap-3 px-4 py-2.5 items-center border-b border-divider-row text-left text-[12.5px] hover:bg-[#FAFCFB]" style={{ gridTemplateColumns: T }}>
                  <div className="min-w-0"><div className="font-semibold text-ink-2 truncate flex items-center gap-1.5">{d.name}{hasIssue(d) && <span className="w-1.5 h-1.5 rounded-full bg-negative" />}</div><div className="text-[11.5px] text-muted-2 truncate">{d.org}</div></div>
                  <span className="flex items-center gap-1.5 text-ink-3"><span className="w-1.5 h-1.5 rounded-full" style={{ background: SHOWROOM_META[d.journey!.showroom].color }} />{SHOWROOM_META[d.journey!.showroom].name}</span>
                  <span className="text-ink-3">{d.journey!.system?.kwp} kWp{d.journey!.system?.batteryKwh ? ` + ${d.journey!.system.batteryKwh}` : ''}</span>
                  <span className="text-muted-b">{new Date(signedAt(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-ink-3 font-medium">{ins ? new Date(ins).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</span>
                  <span className="text-muted-b">{dno ? `${dno.data?.form} · ${dno.done ? 'approved' : 'pending'}` : 'Not submitted'}</span>
                  <span className={classNames(kit === 'To order' ? 'text-[#B45309] font-semibold' : 'text-muted-b')}>{kit}</span>
                  <span className={classNames('tabular-nums', owed ? 'font-semibold text-ink-2' : 'text-muted-3')}>{owed ? money(owed, { compact: true }) : '—'}</span>
                  <span className="text-muted-b truncate">{del.team?.replace('Install team ', 'Team ') ?? '—'}</span>
                </button>
              )
            })}
          </div>
        ) })}
      </div>
    </main>
  )
}
